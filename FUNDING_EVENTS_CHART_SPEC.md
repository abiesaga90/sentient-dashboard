# Funding Summary — granular per-payment chart

Make the "Funding Summary" card (Positions tab) show the **exact timing of every
funding settlement and every USDT-borrow charge**, instead of only the daily
cumulative area.

Backend is already shipped: `GET /api/funding-earned/events?days=30`.

## 1. Backend contract (live)

```ts
type FundingEvent = {
  ts: string;            // ISO8601, e.g. "2026-06-07T16:00:00+00:00"
  binance_ts: number;    // epoch ms — use for the time axis
  type: "funding" | "borrow";
  symbol: string;        // "KITEUSDT" | "SAHARAUSDT" | "USDT" (borrow)
  amount: number;        // signed $: funding +recv / -paid; borrow always negative
  cumulative_net: number;// running net (funding − borrow) up to & incl. this event
};
type FundingEventsResp = {
  anchor_ts: string | null;
  since: string;
  events: FundingEvent[];   // ascending by binance_ts
  summary: {
    funding_total: number; borrow_total: number; net_total: number;
    n_funding: number; n_borrow: number;
  };
};
```

Events are already ascending with `cumulative_net` pre-computed, so the front-end
does **no** running-sum math — just plot.

## 2. Data wiring (`src/components/tabs/PositionsTab.tsx`)

Add a query next to the existing `funding-earned-series` one (~line 551):

```tsx
const { data: fundingEvents } = useQuery<FundingEventsResp>({
  queryKey: ["funding-earned-events", engine.id],
  queryFn: () => client.get("/api/funding-earned/events", { days: 30 }),
  refetchInterval: 5 * 60_000,
  staleTime: 60_000,
});
```

Pass it into the card (~line 624):

```tsx
<FundingSummary positions={positions} risk={risk} earned={fundingEarned}
  series={fundingSeries} events={fundingEvents}
  carry={fundingCarry} sleeve={basisSleeve} />
```

Extend the `FundingSummary` props type with `events?: FundingEventsResp`.

## 3. Chart — replace the cumulative block (current lines ~401-416)

Keep the existing daily AreaChart as a fallback, but default to the granular
view with a small Daily ↔ Per-payment toggle.

### Imports (add to the recharts import at top of file)

```tsx
import {
  AreaChart, Area, ComposedChart, Line, Scatter, ZAxis,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer,
} from "recharts";
```

### State (inside FundingSummary, near the other consts)

```tsx
const [chartMode, setChartMode] = useState<"events" | "daily">("events");

// Granular events, anchored (anchor already filtered server-side, but guard).
const ev = (events?.events ?? []).map((e) => ({
  ...e,
  absAmount: Math.abs(e.amount),       // drives marker size
}));
const fundingPts = ev.filter((e) => e.type === "funding");
const borrowPts  = ev.filter((e) => e.type === "borrow");
const haveEvents = ev.length > 1;
```

### Render (replaces the `cumChart` block)

```tsx
{/* toggle */}
<div className="flex items-center gap-2 mb-1">
  <div className="text-[10px] text-gray-500 uppercase">
    Cumulative carry — {chartMode === "events" ? "every payment" : "daily"}
  </div>
  <div className="ml-auto flex rounded border border-[var(--border)] overflow-hidden text-[10px]">
    {(["events", "daily"] as const).map((m) => (
      <button key={m} onClick={() => setChartMode(m)}
        className={`px-2 py-0.5 ${chartMode === m
          ? "bg-[var(--bg-secondary)] text-gray-200" : "text-gray-500"}`}>
        {m === "events" ? "Per-payment" : "Daily"}
      </button>
    ))}
  </div>
</div>

{chartMode === "events" && haveEvents ? (
  <div className="h-44 mb-3">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={ev} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis dataKey="binance_ts" type="number" scale="time"
          domain={["dataMin", "dataMax"]}
          tick={{ fill: "#64748b", fontSize: 9 }} minTickGap={45}
          tickFormatter={(v) => new Date(v).toLocaleString(undefined,
            { month: "2-digit", day: "2-digit", hour: "2-digit" })} />
        <YAxis tick={{ fill: "#64748b", fontSize: 9 }}
          tickFormatter={(v) => `$${v.toFixed(0)}`} />
        <ZAxis dataKey="absAmount" range={[18, 140]} />
        <Tooltip
          contentStyle={{ background: "#111118", border: "1px solid #1e1e2e", fontSize: 11 }}
          labelFormatter={(v) => new Date(v as number).toUTCString().slice(5, 22) + " UTC"}
          formatter={(val: number, name, p: any) => {
            const e = p?.payload;
            if (name === "Cumulative net") return [`$${val.toFixed(2)}`, "Cumulative net"];
            const sign = e.amount >= 0 ? "+" : "";
            return [`${sign}$${e.amount.toFixed(4)} · ${e.symbol}`,
                    e.type === "borrow" ? "USDT borrow" : "Funding settle"];
          }} />
        <ReferenceLine y={0} stroke="#334155" />
        {/* stepped cumulative line */}
        <Line type="stepAfter" dataKey="cumulative_net" name="Cumulative net"
          stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        {/* per-payment markers, sitting on the line, color-split */}
        <Scatter data={fundingPts} dataKey="cumulative_net" name="Funding"
          fill="#22c55e" isAnimationActive={false} />
        <Scatter data={borrowPts} dataKey="cumulative_net" name="USDT borrow"
          fill="#ef4444" isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
) : chartMode === "daily" && cumChart.length > 1 ? (
  <div className="h-40 mb-3">{/* existing AreaChart block, unchanged */}</div>
) : (
  <div className="text-[10px] text-gray-600 mb-3">
    Per-payment chart populates as settlements accrue since the pivot.
  </div>
)}

{/* tiny legend + counts */}
{chartMode === "events" && haveEvents && (
  <div className="flex gap-3 text-[10px] text-gray-500 mb-3 -mt-1">
    <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
      {events!.summary.n_funding} funding · +${events!.summary.funding_total.toFixed(2)}</span>
    <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
      {events!.summary.n_borrow} borrow · ${events!.summary.borrow_total.toFixed(2)}</span>
    <span className="ml-auto text-gray-400">net ${events!.summary.net_total.toFixed(2)}</span>
  </div>
)}
```

## 4. Visual result

- **Stepped green line** = cumulative net carry (funding − borrow) over real time —
  each funding settlement steps it up, each borrow charge steps it down.
- **Dots on the line**, sized by payment magnitude (`ZAxis`): **green** = funding
  settlement received, **red** = USDT borrow charge. Hover shows exact UTC time,
  symbol, and signed $.
- **Time X-axis** (`scale="time"`) so spacing reflects true 8h funding cadence and
  the weekday-only / hourly-settle gaps, not evenly-spaced days.
- Legend line shows counts + split totals reconciling to the card's net.

## 5. Notes / edge cases

- `scale="time"` needs the numeric `binance_ts`; do **not** use the ISO `ts` string
  for the axis (recharts treats strings as categorical → loses true spacing).
- Multiple symbols settle at the same `binance_ts` (00/08/16 UTC) → several markers
  share an x. That's correct; they stack at different cumulative_net values along
  the step. Tooltip will show whichever point is hovered.
- If `events` is undefined (first load) or has ≤1 row, fall back to the empty
  message; the Daily toggle still works off the existing `series`.
- Window is anchored server-side to the pivot; bump `days` if you want a longer tail.
