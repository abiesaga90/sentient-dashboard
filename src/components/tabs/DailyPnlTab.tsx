import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  useDailyPnlPerSymbol,
  useDailyPnlHistory,
} from "../../hooks/useDashboardQuery";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { ChartContainer } from "../shared/ChartContainer";
import { formatUSD, formatPct, cn } from "../../lib/utils";
import type { DailyPnlPerSymbolRow } from "../../types/api";

const POS_COLOR = "#22c55e"; // green-500
const NEG_COLOR = "#ef4444"; // red-500
const LONG_COLOR = "#3b82f6"; // blue-500
const SHORT_COLOR = "#f97316"; // orange-500

type SortKey = "day_pnl" | "pct_move" | "notional" | "symbol";

function todayUtcStr(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function fmtSigned(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${formatUSD(v, decimals)}`;
}

function pnlClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return "text-gray-300";
  return v > 0 ? "text-emerald-400" : "text-rose-400";
}

export function DailyPnlTab() {
  const [date, setDate] = useState<string>(todayUtcStr());
  const [sortKey, setSortKey] = useState<SortKey>("day_pnl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [historyDays, setHistoryDays] = useState<number>(30);

  const todayStr = todayUtcStr();
  const isToday = date === todayStr;

  const dailyQ = useDailyPnlPerSymbol(isToday ? undefined : date);
  const histQ = useDailyPnlHistory(historyDays);

  const sortedRows = useMemo(() => {
    const rows = dailyQ.data?.rows ?? [];
    const cmp = (a: DailyPnlPerSymbolRow, b: DailyPnlPerSymbolRow): number => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "symbol":
          av = a.symbol;
          bv = b.symbol;
          break;
        case "pct_move":
          av = a.pct_move;
          bv = b.pct_move;
          break;
        case "notional":
          av = a.notional;
          bv = b.notional;
          break;
        case "day_pnl":
        default:
          av = a.day_pnl;
          bv = b.day_pnl;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const ad = av as number;
      const bd = bv as number;
      return sortDir === "asc" ? ad - bd : bd - ad;
    };
    return [...rows].sort(cmp);
  }, [dailyQ.data, sortKey, sortDir]);

  const contributionData = useMemo(() => {
    return sortedRows
      .filter((r) => r.day_pnl !== 0 && Number.isFinite(r.day_pnl))
      .map((r) => ({
        symbol: r.symbol.replace("USDT", ""),
        day_pnl: r.day_pnl,
        side: r.side,
        pct_move: r.pct_move,
        notional: r.notional,
      }));
  }, [sortedRows]);

  if (dailyQ.isLoading && !dailyQ.data) {
    return <div className="p-6 text-gray-400">Loading daily PnL…</div>;
  }
  if (dailyQ.error) {
    return (
      <div className="p-6 text-rose-400">
        Failed to load daily PnL: {String(dailyQ.error)}
      </div>
    );
  }
  const data = dailyQ.data;
  if (!data || data.rows.length === 0) {
    return (
      <div className="p-6 text-gray-400">
        No data for {date}. {data?.error ?? "Snapshot not available yet."}
      </div>
    );
  }

  const t = data.totals;
  const s = data.stats;
  const engineNet = t.engine_net_pnl;
  const headlineNet = engineNet ?? t.day_pnl;
  const navStart = t.engine_nav_prev;
  const navEnd = t.engine_nav;
  const pctReturn =
    navStart && navStart > 0 ? (headlineNet / navStart) * 100 : null;

  const topWinner = sortedRows.reduce<DailyPnlPerSymbolRow | null>(
    (acc, r) => (acc == null || r.day_pnl > acc.day_pnl ? r : acc),
    null,
  );
  const topLoser = sortedRows.reduce<DailyPnlPerSymbolRow | null>(
    (acc, r) => (acc == null || r.day_pnl < acc.day_pnl ? r : acc),
    null,
  );

  const carryShapeDelta =
    engineNet != null ? t.day_pnl - engineNet : null;

  return (
    <div className="space-y-6 p-4">
      {/* Header: date picker + source badge */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">UTC date:</label>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value || todayStr)}
            className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-200"
          />
        </div>
        <Badge variant={isToday ? "default" : "secondary"}>
          {isToday ? "today (live)" : `${data.source}`}
        </Badge>
        {data.note && (
          <span
            className="text-xs text-gray-500 max-w-2xl"
            title={data.note}
          >
            ⓘ formula
          </span>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Day P&L (truth)"
          value={fmtSigned(headlineNet)}
          sub={
            engineNet != null
              ? "engine NAV delta"
              : "carry shape (no NAV record)"
          }
          valueColor={pnlClass(headlineNet)}
        />
        <KpiCard
          label="Day return"
          value={pctReturn != null ? formatPct(pctReturn / 100, 2) : "—"}
          sub={navStart ? `on $${formatUSD(navStart, 0)} NAV` : ""}
          valueColor={pnlClass(pctReturn)}
        />
        <KpiCard
          label="NAV start → end"
          value={
            navStart != null && navEnd != null
              ? `$${formatUSD(navStart, 0)} → $${formatUSD(navEnd, 0)}`
              : "—"
          }
          sub={isToday ? "intraday" : "EOD"}
        />
        <KpiCard
          label="Hit rate"
          value={`${s.hit_rate_pct.toFixed(0)}%`}
          sub={`${s.n_winners} green / ${s.n_losers} red`}
        />
        <KpiCard
          label="Top winner"
          value={topWinner ? topWinner.symbol.replace("USDT", "") : "—"}
          sub={topWinner ? fmtSigned(topWinner.day_pnl) : ""}
          valueColor="text-emerald-400"
        />
        <KpiCard
          label="Top loser"
          value={topLoser ? topLoser.symbol.replace("USDT", "") : "—"}
          sub={topLoser ? fmtSigned(topLoser.day_pnl) : ""}
          valueColor="text-rose-400"
        />
      </div>

      {/* Truth vs shape callout */}
      {engineNet != null && carryShapeDelta != null && Math.abs(carryShapeDelta) > 1 && (
        <Card className="p-3 bg-gray-900/40 border-amber-800/50">
          <div className="flex items-start gap-3 text-xs">
            <Badge variant="secondary">truth vs shape</Badge>
            <div className="text-gray-300">
              Headline <span className="text-emerald-400">{fmtSigned(engineNet)}</span> is the engine NAV delta (truth).
              Carry-shape day_pnl is <span className={pnlClass(t.day_pnl)}>{fmtSigned(t.day_pnl)}</span>
              {" "}(Δ {fmtSigned(carryShapeDelta)}).
              {" "}The gap is realized P&L from a rebalance (<span className="text-amber-400">{fmtSigned(t.realized)}</span>)
              {" "}plus carry-vs-actual-qty drift. Per-symbol rows below show carry-shape attribution; the engine NAV is the cash-truth.
            </div>
          </div>
        </Card>
      )}

      {/* Per-symbol contribution chart */}
      <Card>
        <CardHeader>
          <CardTitle>
            Per-symbol contribution ({contributionData.length}/{s.n_positions})
          </CardTitle>
        </CardHeader>
        <ChartContainer height={Math.max(300, contributionData.length * 14)}>
          <BarChart
            layout="vertical"
            data={contributionData}
            margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              type="number"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => `$${formatUSD(v, 0)}`}
            />
            <YAxis
              type="category"
              dataKey="symbol"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value: number, _name: string, props: { payload?: { pct_move?: number; side?: string; notional?: number } }) => {
                const p = props.payload ?? {};
                return [
                  `${fmtSigned(value)}  (${p.pct_move?.toFixed(2)}% · ${p.side} · $${formatUSD(p.notional, 0)} notional)`,
                  "day_pnl",
                ];
              }}
            />
            <ReferenceLine x={0} stroke="#64748b" />
            <Bar dataKey="day_pnl">
              {contributionData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.day_pnl >= 0 ? POS_COLOR : NEG_COLOR}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </Card>

      {/* Per-symbol table */}
      <Card>
        <CardHeader>
          <CardTitle>Per-position breakdown</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800 text-xs uppercase text-gray-500">
              <tr>
                <SortHeader
                  k="symbol"
                  label="Symbol"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  setSortKey={setSortKey}
                  setSortDir={setSortDir}
                />
                <th className="px-3 py-2 text-left">Side</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <SortHeader
                  k="notional"
                  label="Notional"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  setSortKey={setSortKey}
                  setSortDir={setSortDir}
                  align="right"
                />
                <th className="px-3 py-2 text-right">Open</th>
                <th className="px-3 py-2 text-right">Close</th>
                <SortHeader
                  k="pct_move"
                  label="% Move"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  setSortKey={setSortKey}
                  setSortDir={setSortDir}
                  align="right"
                />
                <th className="px-3 py-2 text-right">Carry</th>
                <th className="px-3 py-2 text-right">Funding</th>
                <th className="px-3 py-2 text-right">Fees</th>
                <th className="px-3 py-2 text-right">
                  Realized
                  <span
                    className="ml-1 text-amber-400"
                    title="Shown for transparency, excluded from day_pnl to avoid the rebalance double-count."
                  >
                    *
                  </span>
                </th>
                <SortHeader
                  k="day_pnl"
                  label="Day P&L"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  setSortKey={setSortKey}
                  setSortDir={setSortDir}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr
                  key={r.symbol}
                  className="border-b border-gray-900 hover:bg-gray-900/40"
                >
                  <td className="px-3 py-1.5 font-mono">
                    {r.symbol.replace("USDT", "")}
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge
                      variant={r.side === "LONG" ? "default" : "secondary"}
                    >
                      {r.side}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.qty < 1 ? r.qty.toFixed(4) : formatUSD(r.qty, 2)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    ${formatUSD(r.notional, 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.open_px != null
                      ? `$${r.open_px.toFixed(r.open_px < 1 ? 4 : 2)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.close_px != null
                      ? `$${r.close_px.toFixed(r.close_px < 1 ? 4 : 2)}`
                      : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right tabular-nums",
                      pnlClass(r.pct_move),
                    )}
                  >
                    {r.pct_move >= 0 ? "+" : ""}
                    {r.pct_move.toFixed(2)}%
                  </td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums", pnlClass(r.carry_pnl))}>
                    {fmtSigned(r.carry_pnl)}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums text-xs", pnlClass(r.funding_pnl))}>
                    {fmtSigned(r.funding_pnl)}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums text-xs", pnlClass(r.fees))}>
                    {fmtSigned(r.fees)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-amber-400/70">
                    {r.realized_pnl !== 0 ? fmtSigned(r.realized_pnl) : ""}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right font-semibold tabular-nums",
                      pnlClass(r.day_pnl),
                    )}
                  >
                    {fmtSigned(r.day_pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-700 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>
                  Total ({s.n_positions} positions)
                </td>
                <td className="px-3 py-2 text-right" colSpan={5}>
                  Long: <span className={pnlClass(t.long_basket)}>{fmtSigned(t.long_basket)}</span>
                  {"  ·  "}
                  Short: <span className={pnlClass(t.short_basket)}>{fmtSigned(t.short_basket)}</span>
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", pnlClass(t.carry))}>
                  {fmtSigned(t.carry)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", pnlClass(t.funding))}>
                  {fmtSigned(t.funding)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", pnlClass(t.fees))}>
                  {fmtSigned(t.fees)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-400/70">
                  {fmtSigned(t.realized)}*
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", pnlClass(t.day_pnl))}>
                  {fmtSigned(t.day_pnl)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-3 text-xs text-gray-500">
          * Realized P&L is shown for transparency but excluded from day_pnl.
          See the truth-vs-shape callout above for the rationale.
        </div>
      </Card>

      {/* History: 30d stacked + cumulative */}
      <Card>
        <CardHeader>
          <CardTitle>
            Daily history
            <select
              value={historyDays}
              onChange={(e) => setHistoryDays(Number(e.target.value))}
              className="ml-3 rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-xs text-gray-300"
            >
              <option value={14}>14d</option>
              <option value={30}>30d</option>
              <option value={60}>60d</option>
              <option value={90}>90d</option>
            </select>
          </CardTitle>
        </CardHeader>

        {histQ.isLoading && !histQ.data ? (
          <div className="p-4 text-gray-400">Loading history…</div>
        ) : !histQ.data || histQ.data.daily.length === 0 ? (
          <div className="p-4 text-gray-400">No history available yet.</div>
        ) : (
          <>
            <div className="p-3 text-xs text-gray-500">
              Headline net P&L = engine NAV delta (truth) when available, else carry-shape. Long/Short bars are carry-based directional shapes.
            </div>
            <ChartContainer height={260}>
              <BarChart data={histQ.data.daily} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(v) => `$${formatUSD(v, 0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(value: number) => `${fmtSigned(value)}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#64748b" />
                <Bar dataKey="long_pnl" name="Long" stackId="basket" fill={LONG_COLOR} />
                <Bar dataKey="short_pnl" name="Short" stackId="basket" fill={SHORT_COLOR} />
              </BarChart>
            </ChartContainer>

            <ChartContainer height={240}>
              <LineChart data={histQ.data.daily} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(v) => `$${formatUSD(v, 0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(value: number) => `${fmtSigned(value)}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#64748b" />
                <Line
                  type="monotone"
                  dataKey="cum_long"
                  name="Cum Long (carry)"
                  stroke={LONG_COLOR}
                  dot={false}
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="cum_short"
                  name="Cum Short (carry)"
                  stroke={SHORT_COLOR}
                  dot={false}
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="cum_net"
                  name="Cum Net (engine truth)"
                  stroke="#a78bfa"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ChartContainer>

            <div className="p-3 text-xs text-gray-400 flex flex-wrap gap-x-6 gap-y-1">
              <span>
                Cumulative net (engine):{" "}
                <span className={pnlClass(histQ.data.cumulative.net_engine)}>
                  {fmtSigned(histQ.data.cumulative.net_engine)}
                </span>
              </span>
              <span>
                Long carry:{" "}
                <span className={pnlClass(histQ.data.cumulative.long_carry)}>
                  {fmtSigned(histQ.data.cumulative.long_carry)}
                </span>
              </span>
              <span>
                Short carry:{" "}
                <span className={pnlClass(histQ.data.cumulative.short_carry)}>
                  {fmtSigned(histQ.data.cumulative.short_carry)}
                </span>
              </span>
              <span className="text-gray-600">
                ({histQ.data.daily.length} days · {histQ.data.n_priced}/{histQ.data.n_symbols} symbols priced)
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

interface SortHeaderProps {
  k: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  setSortKey: (k: SortKey) => void;
  setSortDir: (d: "asc" | "desc") => void;
  align?: "left" | "right";
}

function SortHeader({
  k,
  label,
  sortKey,
  sortDir,
  setSortKey,
  setSortDir,
  align = "left",
}: SortHeaderProps) {
  const active = sortKey === k;
  return (
    <th
      className={cn(
        "cursor-pointer select-none px-3 py-2 hover:text-gray-300",
        align === "right" ? "text-right" : "text-left",
      )}
      onClick={() => {
        if (active) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else {
          setSortKey(k);
          setSortDir("desc");
        }
      }}
    >
      {label}
      {active && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}
