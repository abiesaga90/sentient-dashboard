import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ChartContainer } from "../shared/ChartContainer";
import { KpiCard } from "../shared/KpiCard";

// ── Brand palette ──
const COLOR_UNLEV = "#0b688c"; // Electric Sky
const COLOR_WARN = "#d06643"; // Sunset Ember
const COLOR_NEUTRAL = "#bfb3a8"; // Sandstone
const COLOR_DEEP = "#4e6ba8"; // brighter indigo for dark bg
const LEV_COLORS: Record<string, string> = {
  "1.0x": "#0b688c",
  "1.5x": "#3f7bb8",
  "2.0x": "#6d6cc0",
  "2.5x": "#9a5fbf",
  "3.0x": "#bf58a9",
  "3.5x": "#d0608a",
  "4.0x": "#d06643",
};
const LEVERAGE_GRID = ["1.0x", "1.5x", "2.0x", "2.5x", "3.0x", "3.5x", "4.0x"] as const;

// ── API types ──
interface SeriesRow {
  date: string;
  spread_ret: number;
  ewma_vol_ann: number;
  rolling_dd_30d: number;
  is_live: boolean;
  [k: `nav_${string}`]: number;
}

interface FrontierPoint {
  leverage: number;
  max_dd: number;
  dd_95: number;
  dd_forward_1sig: number;
  ann_vol: number;
  ann_ret?: number;
  sharpe?: number;
  breaches_stop: boolean;
  stopped_out?: boolean;
  stop_date?: string | null;
}

interface StressScenario {
  name: string;
  start: string;
  end: string;
  dd_by_lev: Record<string, number>;
}

interface VarContribution {
  symbol: string;
  side: "LONG" | "SHORT";
  weight: number;
  var_contribution: number;
  var_contribution_pct: number;
}

interface DdHistBin {
  bin_min: number;
  bin_max: number;
  bin_label: string;
  count: number;
  pct: number;
  cum_pct: number;
}

interface LevCalibResponse {
  available: boolean;
  reason?: string;
  inception_live: string;
  dd_stop_pct: number;
  lookback_days?: number;
  leverage_grid?: number[];
  long_basket?: string[];
  short_basket?: string[];
  n_longs?: number;
  n_shorts?: number;
  series: SeriesRow[];
  stats: {
    n_days?: number;
    ann_vol_unlev?: number;
    ann_ret_unlev?: number;
    sharpe_unlev?: number;
    max_dd_unlev?: number;
    dd_95_unlev?: number;
    ulcer_unlev?: number;
    ewma_vol_ann_current?: number;
    ann_vol_pretrim_at_cap?: number;
    sharpe_pretrim?: number;
    max_safe_lev?: number;
    stopped_out_at_cap?: boolean;
    stop_date_at_cap?: string | null;
    implied_safe_lev_vol?: number;
  };
  dd_histogram: DdHistBin[];
  leverage_frontier: FrontierPoint[];
  stress_scenarios: StressScenario[];
  variance_contribution: VarContribution[];
  notes?: string[];
}

type WindowKey = "ytd" | "live" | "90d" | "1y";

const LIVE_INCEPTION = "2026-02-22";

function daysBetween(fromIso: string, toDate: Date): number {
  const from = new Date(fromIso + "T00:00:00Z").getTime();
  const to = toDate.getTime();
  return Math.max(30, Math.floor((to - from) / 86_400_000));
}

function windowToLookbackDays(key: WindowKey, now: Date): number {
  if (key === "ytd") {
    const yStart = `${now.getUTCFullYear()}-01-01`;
    return daysBetween(yStart, now);
  }
  if (key === "live") return daysBetween(LIVE_INCEPTION, now);
  if (key === "90d") return 90;
  return 365;
}

function windowLabel(key: WindowKey, now: Date): string {
  const days = windowToLookbackDays(key, now);
  if (key === "ytd") return `YTD (${days}d)`;
  if (key === "live") return `Since Live (${days}d)`;
  if (key === "90d") return "90d";
  return "1Y";
}

export function LeverageCalibrationTab() {
  const { client, engine } = useEngine();
  const [windowKey, setWindowKey] = useState<WindowKey>("ytd");
  const now = useMemo(() => new Date(), []);
  const lookbackDays = windowToLookbackDays(windowKey, now);
  const { data, isLoading, error } = useQuery<LevCalibResponse>({
    queryKey: ["leverage-calibration", engine.id, lookbackDays],
    queryFn: () => client.get(`/api/leverage-calibration?lookback_days=${lookbackDays}`),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading leverage calibration...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-sm text-red-400">
        Failed to load leverage calibration: {String(error)}
      </div>
    );
  }
  if (!data || !data.available) {
    return (
      <div className="p-4 text-sm text-gray-400">
        Leverage calibration unavailable: {data?.reason ?? "no data"}
      </div>
    );
  }

  const ddStopPct = data.dd_stop_pct; // e.g. 0.095
  const ddStopPctDisplay = ddStopPct * 100;

  return (
    <div className="p-4 space-y-4">
      {/* Headline KPIs (all trim-aware: realized from path sim with hard stop) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <KpiCard
          label="Ann. vol at 4× (realized)"
          value={fmtPct(data.stats.ann_vol_unlev)}
          sub={`pre-trim ${fmtPct(data.stats.ann_vol_pretrim_at_cap)} · EWMA ${fmtPct(data.stats.ewma_vol_ann_current)}`}
        />
        <KpiCard
          label="Sharpe at 4× (realized)"
          value={(data.stats.sharpe_unlev ?? 0).toFixed(2)}
          sub={`pre-trim ${(data.stats.sharpe_pretrim ?? 0).toFixed(2)} · ret ${fmtPct(data.stats.ann_ret_unlev)}`}
        />
        <KpiCard
          label="Max DD at 4× (trim+stop)"
          value={fmtPct(data.stats.max_dd_unlev)}
          sub={
            data.stats.stopped_out_at_cap
              ? `stopped ${data.stats.stop_date_at_cap ?? ""}`
              : `ulcer ${fmtPct(data.stats.ulcer_unlev)}`
          }
          valueColor="text-[#d06643]"
        />
        <KpiCard
          label={`95%-worst 30d DD (${windowLabel(windowKey, now)})`}
          value={fmtPct(data.stats.dd_95_unlev)}
          sub="5th pctl, trim-aware"
        />
        <KpiCard
          label="Max L w/o stop-out"
          value={`${(data.stats.max_safe_lev ?? 0).toFixed(1)}x`}
          sub={`largest grid L that didn't breach ${ddStopPctDisplay.toFixed(1)}% (${windowLabel(windowKey, now)})`}
          valueColor="text-[#0b688c]"
        />
        <KpiCard
          label="Vol-budget safe lev"
          value={`${(data.stats.implied_safe_lev_vol ?? 0).toFixed(2)}x`}
          sub="2σ/mo headroom (linear)"
          valueColor="text-[#0b688c]"
        />
      </div>

      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Leverage Calibration</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded border border-[var(--border)] overflow-hidden text-[11px]">
                {(["ytd", "live", "90d", "1y"] as WindowKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setWindowKey(k)}
                    className={`px-2.5 py-1 transition-colors ${
                      windowKey === k
                        ? "bg-[#0b688c] text-white"
                        : "text-gray-400 hover:bg-[var(--bg-card-hover)]"
                    }`}
                    title={`lookback_days = ${windowToLookbackDays(k, now)}`}
                  >
                    {windowLabel(k, now)}
                  </button>
                ))}
              </div>
              <Badge variant="default">
                {data.stats.n_days ?? 0} days · {data.n_longs}L / {data.n_shorts}S
              </Badge>
              <Badge variant="warning">
                DD_STOP {ddStopPctDisplay.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </CardHeader>
        <p className="text-xs text-gray-400">
          <strong className="text-gray-200">Actual leverage</strong>: L_actual = 2 × gross notional / NAV.
          <strong className="text-gray-200"> 4.0× = Nickel cap</strong> (200% gross). Grid steps 0.5×.
          All curves run the live elastic-trim schedule path-dependently: scale = (1 − floor(peak_dd) / {ddStopPctDisplay.toFixed(1)})^0.5
          at 1pp DD steps, saturating at 1.0 below 1pp (overgear-equivalent), with 1pp hysteresis on restore.
          At peak_dd ≥ {ddStopPctDisplay.toFixed(1)}% the path is frozen (matches live DD_STOP liquidation; no auto-recovery).
          Vol and Sharpe in the frontier are <em>realized</em> from the simulated nav, not (L/4) × cap.
          Live inception: <span className="text-gray-200">{data.inception_live}</span>.
          Pre-inception is backtested with current baskets (survivorship bias).
        </p>
      </Card>

      {/* Chart 1: Equity curve with leverage overlays */}
      <ChartContainer title="Equity Curve by Gross Leverage (1.0× = unlevered, 2.0× = baseline)" height={320}>
        <LineChart data={data.series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(d) => d.slice(5)}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(2)}x`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: any, name: any) => [`${Number(v).toFixed(3)}x`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {data.series.length > 0 && data.series.find((r) => r.is_live) && (
            <ReferenceLine
              x={data.series.find((r) => r.is_live)?.date}
              stroke={COLOR_NEUTRAL}
              strokeDasharray="4 4"
              label={{ value: "live", fill: COLOR_NEUTRAL, fontSize: 10, position: "top" }}
            />
          )}
          {LEVERAGE_GRID.map((lev) => (
            <Line
              key={lev}
              type="monotone"
              dataKey={`nav_${lev}`}
              name={lev}
              stroke={LEV_COLORS[lev]}
              strokeWidth={lev === "1.0x" ? 2 : 1.2}
              strokeOpacity={lev === "1.0x" ? 1 : 0.75}
              dot={false}
            />
          ))}
        </LineChart>
      </ChartContainer>

      {/* Chart 2: Underwater drawdown */}
      <ChartContainer title="Underwater Drawdown by Gross Leverage" height={320}>
        <AreaChart data={data.series}>
          <defs>
            {LEVERAGE_GRID.map((lev) => (
              <linearGradient key={lev} id={`gradDD-${lev}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LEV_COLORS[lev]} stopOpacity={0} />
                <stop offset="100%" stopColor={LEV_COLORS[lev]} stopOpacity={0.35} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(d) => d.slice(5)}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={[(dataMin: number) => Math.min(dataMin * 1.05, -0.01), 0]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: any, name: any) => [`${(Number(v) * 100).toFixed(2)}%`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={-ddStopPct}
            stroke={COLOR_WARN}
            strokeDasharray="4 4"
            label={{
              value: `DD_STOP −${ddStopPctDisplay.toFixed(1)}%`,
              fill: COLOR_WARN,
              fontSize: 10,
              position: "insideBottomRight",
            }}
          />
          {LEVERAGE_GRID.map((lev) => (
            <Area
              key={lev}
              type="monotone"
              dataKey={`dd_${lev}`}
              name={lev}
              stroke={LEV_COLORS[lev]}
              strokeWidth={lev === "1.0x" ? 2 : 1}
              fill={`url(#gradDD-${lev})`}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ChartContainer>

      {/* Row: DD histogram + Rolling vol */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="30d Max-DD Distribution (unlevered)" height={280}>
          <ComposedChart data={data.dd_histogram}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis
              dataKey="bin_label"
              tick={{ fill: "#64748b", fontSize: 10 }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#64748b", fontSize: 10 }}
              label={{
                value: "count",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 10,
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              label={{
                value: "CDF",
                angle: 90,
                position: "insideRight",
                fill: "#64748b",
                fontSize: 10,
              }}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="count" name="Days in bin" fill={COLOR_UNLEV}>
              {data.dd_histogram.map((b, i) => (
                <Cell
                  key={i}
                  fill={b.bin_max <= -ddStopPct ? COLOR_WARN : COLOR_UNLEV}
                />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cum_pct"
              name="Cumulative %"
              stroke={COLOR_NEUTRAL}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>

        <ChartContainer title="Rolling EWMA Vol (annualized)" height={280}>
          <LineChart data={data.series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(d) => d.slice(5)}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: any) => [`${(Number(v) * 100).toFixed(2)}%`, "EWMA σ (ann.)"]}
            />
            <Line
              type="monotone"
              dataKey="ewma_vol_ann"
              name="EWMA σ (ann.)"
              stroke={COLOR_UNLEV}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </div>

      {/* Chart 5: Leverage frontier (MONEY CHART) */}
      <ChartContainer title="Gross Leverage → Drawdown Frontier" height={340}>
        <LineChart data={data.leverage_frontier}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="leverage"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(2)}x`}
            type="number"
            domain={["dataMin", "dataMax"]}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={["auto", 0]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: any, name: any) => [`${(Number(v) * 100).toFixed(2)}%`, String(name)]}
            labelFormatter={(l: any) => `Leverage ${Number(l).toFixed(2)}x`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={-ddStopPct}
            stroke={COLOR_WARN}
            strokeDasharray="4 4"
            label={{
              value: `DD_STOP −${ddStopPctDisplay.toFixed(1)}%`,
              fill: COLOR_WARN,
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
          <Line
            type="monotone"
            dataKey="max_dd"
            name="Historical max DD"
            stroke={COLOR_WARN}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="dd_95"
            name="95%-worst 30d DD"
            stroke={COLOR_DEEP}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="dd_forward_1sig"
            name="Forward 1σ/mo (EWMA)"
            stroke={COLOR_NEUTRAL}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ChartContainer>
      <Card>
        <div className="text-xs text-gray-400">
          Read the frontier: all three lines are realized from the same trim-aware path sim,
          so each L on the x-axis reflects what the strategy would actually have done at that
          cap (with elastic trim restoring on recovery, hard stop at {ddStopPctDisplay.toFixed(1)}%).
          Max-DD is the worst trough touched; 95%-worst is the 5th pctl of rolling 30d DD;
          Forward 1σ is realized vol at that L divided by √12. The "Max L w/o stop-out" KPI
          above is the largest L where the path survives the full 1Y without breaching.
        </div>
      </Card>

      {/* Chart 6: Stress replay */}
      <ChartContainer title="Stress Replay — Worst 30d Windows at Each Leverage" height={340}>
        <BarChart data={buildStressChartData(data.stress_scenarios)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 10 }}
            angle={-15}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={["auto", 0]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: any, name: any) => [`${(Number(v) * 100).toFixed(2)}%`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={-ddStopPct}
            stroke={COLOR_WARN}
            strokeDasharray="4 4"
          />
          {["1.00", "1.50", "2.00", "2.50", "3.00", "3.50", "4.00"].map((L) => (
            <Bar
              key={L}
              dataKey={`dd_${L}`}
              name={`${parseFloat(L).toFixed(1)}x`}
              fill={LEV_COLORS[`${parseFloat(L).toFixed(1)}x`] ?? COLOR_UNLEV}
              fillOpacity={0.85}
            />
          ))}
        </BarChart>
      </ChartContainer>

      {/* Chart 7: Variance contribution */}
      <ChartContainer title="Per-Token Contribution to Spread Variance" height={Math.max(260, (data.variance_contribution?.length ?? 0) * 18)}>
        <BarChart
          data={data.variance_contribution.slice(0, 40)}
          layout="vertical"
          margin={{ left: 70 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            type="number"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
          />
          <YAxis
            type="category"
            dataKey="symbol"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickFormatter={(s: string) => s.replace("USDT", "")}
            width={65}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "var contribution"]}
          />
          <ReferenceLine x={0} stroke="#374151" />
          <Bar dataKey="var_contribution_pct" name="% of portfolio variance">
            {data.variance_contribution.slice(0, 40).map((d, i) => (
              <Cell
                key={i}
                fill={d.side === "LONG" ? COLOR_UNLEV : COLOR_WARN}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Frontier table */}
      <Card>
        <CardHeader>
          <CardTitle>Leverage Frontier Detail</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-1.5 text-left text-gray-500">Actual Lev</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="Gross notional / NAV = L_actual / 2">Gross %</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="Per-side exposure = gross / 2">Per-side %</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="Realized from trim-aware sim">Ann. vol</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="Realized from trim-aware sim">Sharpe</th>
                <th className="px-3 py-1.5 text-right text-gray-500">Hist. max DD</th>
                <th className="px-3 py-1.5 text-right text-gray-500">95%-worst 30d DD</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="Realized vol / √12">Fwd 1σ/mo</th>
                <th className="px-3 py-1.5 text-center text-gray-500">Stop status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.leverage_frontier.map((f) => {
                const grossPct = f.leverage * 50; // L_actual / 2 × 100%
                const perSidePct = grossPct / 2;
                const isNickelCap = Math.abs(f.leverage - 4.0) < 0.01;
                return (
                  <tr key={f.leverage} className={`hover:bg-[var(--bg-card-hover)] ${isNickelCap ? "bg-[#d06643]/5" : ""}`}>
                    <td className="px-3 py-1.5 text-gray-200 font-medium">
                      {f.leverage.toFixed(2)}x
                      {isNickelCap && <span className="ml-2 text-[9px] text-[#d06643]">Nickel max</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300">{grossPct.toFixed(0)}%</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{perSidePct.toFixed(0)}%</td>
                    <td className="px-3 py-1.5 text-right text-gray-300">{fmtPct(f.ann_vol)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300">{(f.sharpe ?? 0).toFixed(2)}</td>
                    <td className={`px-3 py-1.5 text-right ${f.max_dd < -ddStopPct ? "text-[#d06643] font-semibold" : "text-gray-300"}`}>
                      {fmtPct(f.max_dd)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300">{fmtPct(f.dd_95)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-400">{fmtPct(f.dd_forward_1sig)}</td>
                    <td className="px-3 py-1.5 text-center">
                      {f.stopped_out ? (
                        <span className="text-[#d06643] font-semibold" title={f.stop_date ?? undefined}>
                          Stopped{f.stop_date ? ` ${f.stop_date}` : ""}
                        </span>
                      ) : f.breaches_stop ? (
                        <span className="text-[#d06643]">Breach</span>
                      ) : (
                        <span className="text-green-400">Safe</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-gray-600 mt-2 px-3">
          Gross % = L_actual × 50%. Per-side % = long side = short side as % of NAV. Nickel cap: 200% gross / 4.0× actual.
        </div>
      </Card>

      {/* Notes */}
      {data.notes && data.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Methodology Notes</CardTitle>
          </CardHeader>
          <ul className="text-xs text-gray-400 space-y-1 list-disc pl-5">
            {data.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ── helpers ──

const tooltipStyle = {
  background: "#111118",
  border: "1px solid #1e1e2e",
  borderRadius: "6px",
  fontSize: "11px",
};

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

function buildStressChartData(
  scenarios: StressScenario[],
): Array<{ name: string } & Record<string, number | string>> {
  return scenarios.map((s) => {
    const row: { name: string } & Record<string, number | string> = {
      name: s.name.replace("30d ending ", ""),
    };
    for (const [lev, dd] of Object.entries(s.dd_by_lev)) {
      row[`dd_${lev}`] = dd;
    }
    return row;
  });
}
