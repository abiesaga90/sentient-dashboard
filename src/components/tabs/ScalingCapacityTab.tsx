import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { ChartContainer } from "../shared/ChartContainer";
import { DataTable, type Column } from "../shared/DataTable";
import { formatUSD } from "../../lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ComposedChart,
  Area,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────

interface SortinoPoint {
  date: string;
  value: number;            // 28-day (gate)
  value_5d?: number | null;
  value_7d?: number | null;
  value_14d?: number | null;
}

interface SortinoProjectionPoint {
  day: number;
  date: string | null;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  p_above_gate: number;
}

interface SortinoCrossPoint {
  days_ahead: number;
  date: string | null;
  median_sortino: number;
  p_above_gate: number;
}

interface SortinoProjection {
  available: boolean;
  reason?: string;
  window_days?: number;
  horizon_days?: number;
  lookback_days?: number | null;
  n_sims?: number;
  gate?: number;
  current_sortino?: number;
  sample_daily_mean?: number;
  sample_daily_std?: number;
  sample_annualized_return_pct?: number;
  sample_annualized_vol_pct?: number;
  scenario_mode?: boolean;
  prior?: string;
  prior_meta?: {
    n_days?: number;
    start_date?: string | null;
    end_date?: string | null;
    ann_return_pct?: number;
    ann_vol_pct?: number;
  };
  median_cross?: SortinoCrossPoint | null;
  p25_cross?: SortinoCrossPoint | null;
  p50_cross?: SortinoCrossPoint | null;
  p75_cross?: SortinoCrossPoint | null;
  breakeven_daily_return?: number | null;
  breakeven_daily_return_pct?: number | null;
  breakeven_annualized_pct?: number | null;
  projection?: SortinoProjectionPoint[];
}

interface TokenCapacity {
  symbol: string;
  side: string;
  current_notional: number;
  adv_usd: number | null;
  pct_adv_current: number | null;
  constrained_at: string | null;
  [key: string]: unknown; // dynamic pct_adv_$Xk / pct_adv_$XM keys
}

interface FillQualityTier {
  avg_slippage_bps: number;
  fill_ratio_pct: number;
  n_trades: number;
}

interface ConstrainedSummary {
  tier: number;
  label: string;
  n_constrained: number;
  pct_constrained: number;
}

interface ScalingScenario {
  tier: number;
  label: string;
  is_current: boolean;
  nickel_capital?: number;
  gross_exposure?: number;
  max_position_usd: number;
  n_constrained: number;
  pct_constrained: number;
  est_slippage_bps: number;
  feasibility: "GREEN" | "YELLOW" | "RED";
}

interface ScalingResponse {
  scaling_tracker: {
    current_notional: number;
    current_tier_index: number;
    tiers: number[];
    tier_labels: string[];
    next_tier: number | null;
    next_tier_label: string | null;
    days_at_current_tier: number | null;
    tier_start_date: string | null;
    sortino_4w: number | null;
    sortino_4w_close?: number | null;
    sortino_4w_is_live?: boolean;
    sortino_5d?: number | null;
    sortino_7d?: number | null;
    sortino_14d?: number | null;
    sortino_gate_ok: boolean;
    sortino_trend: SortinoPoint[];
    sortino_projection?: SortinoProjection;
    ptt_dd_pct: number;
    dd_gate_ok: boolean;
    avg_slippage_bps: number;
    fill_ratio_pct: number;
    n_trades_30d: number;
    infra_gate_ok: boolean;
    scaling_ready: boolean;
  };
  capacity_analysis: {
    tokens: TokenCapacity[];
    projection_labels: string[];
    constrained_summary: ConstrainedSummary[];
    fill_quality_by_tier: Record<string, FillQualityTier>;
    funding_drag: {
      total_funding_30d: number;
      annualized_pct: number;
      long_funding_30d: number;
      short_funding_30d: number;
    };
    adv_constraint_pct: number;
  };
  scaling_scenarios: ScalingScenario[];
  capacity_ceiling: {
    ceiling_notional: number;
    ceiling_nickel_capital?: number;
    ceiling_gross?: number;
    ceiling_label: string;
    n_constrained: number;
    pct_constrained: number;
    reason: string;
  } | null;
}

// ── Helpers ────────────────────────────────────────────────────

function gateColor(ok: boolean) {
  return ok ? "text-green-400" : "text-red-400";
}

function formatCompact(n: number | null | undefined): string {
  if (n == null) return "--";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function advPctColor(pct: number | null | undefined): string {
  if (pct == null) return "text-gray-500";
  if (pct > 2) return "text-red-400";
  if (pct > 1) return "text-yellow-400";
  return "text-gray-300";
}

function fmtCross(c: SortinoCrossPoint | null | undefined): {
  primary: string;
  sub: string;
} {
  if (!c) return { primary: "Not within horizon", sub: "" };
  return {
    primary: `${c.days_ahead}d`,
    sub: `${c.date ?? "--"} · median ${c.median_sortino.toFixed(2)} · P ${(c.p_above_gate * 100).toFixed(0)}%`,
  };
}

// Recharts Area with two dataKeys can't render a "band" directly — feed
// per-point [lower, upper] tuples and render with type="step"/"monotone".
function buildBandSeries(proj: SortinoProjectionPoint[]) {
  return proj.map((p) => ({
    day: p.day,
    date: p.date,
    p05: p.p05,
    p25: p.p25,
    p50: p.p50,
    p75: p.p75,
    p95: p.p95,
    p_above_gate: p.p_above_gate,
    band90: [p.p05, p.p95] as [number, number],
    band50: [p.p25, p.p75] as [number, number],
    p_above_pct: p.p_above_gate * 100,
  }));
}

// ── Sortino Projection Panel ──────────────────────────────────

function SortinoProjectionPanel({ proj }: { proj: SortinoProjection }) {
  const points = proj.projection ?? [];
  if (points.length === 0) return null;
  const data = buildBandSeries(points);
  const gate = proj.gate ?? 1.5;
  const medianCross = fmtCross(proj.median_cross);
  const pCross = fmtCross(proj.p50_cross);
  const breakevenDaily = proj.breakeven_daily_return_pct;
  const breakevenAnn = proj.breakeven_annualized_pct;
  const sampleRet = proj.sample_annualized_return_pct;
  const sampleVol = proj.sample_annualized_vol_pct;

  // Use the date axis if available, otherwise day index
  const xKey = data[0]?.date ? "date" : "day";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Forward Sortino Projection
        </h3>
        <span className="text-[10px] text-gray-500 text-right">
          {(() => {
            const prior = (proj.prior ?? "live").toLowerCase();
            const pm = proj.prior_meta ?? {};
            if (prior === "backtest" && pm.start_date && pm.end_date) {
              return (
                <>
                  Prior: backtest {pm.start_date} → {pm.end_date} ({pm.n_days}d)
                  {pm.ann_return_pct != null && pm.ann_vol_pct != null
                    ? ` · ann ${pm.ann_return_pct >= 0 ? "+" : ""}${pm.ann_return_pct.toFixed(1)}% / ${pm.ann_vol_pct.toFixed(1)}% vol`
                    : ""}
                  {` · ${proj.n_sims ?? "?"} sims`}
                </>
              );
            }
            if (prior === "scenario") {
              return (
                <>
                  Prior: scenario · sample {sampleRet != null ? `${sampleRet >= 0 ? "+" : ""}${sampleRet.toFixed(1)}% / ${sampleVol?.toFixed(1)}% vol` : ""}
                  {` · ${proj.n_sims ?? "?"} sims`}
                </>
              );
            }
            return (
              <>
                Prior: live last {proj.lookback_days ?? "?"}d · {proj.n_sims ?? "?"} sims
                {sampleRet != null && sampleVol != null
                  ? ` · sample ${sampleRet >= 0 ? "+" : ""}${sampleRet.toFixed(1)}% / ${sampleVol.toFixed(1)}% vol`
                  : ""}
              </>
            );
          })()}
        </span>
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="Median crosses 1.5"
          value={medianCross.primary}
          valueColor={proj.median_cross ? "text-green-400" : "text-gray-500"}
          sub={medianCross.sub || " "}
        />
        <KpiCard
          label="P(≥1.5) ≥ 50% at"
          value={pCross.primary}
          valueColor={proj.p50_cross ? "text-green-400" : "text-gray-500"}
          sub={pCross.sub || " "}
        />
        <KpiCard
          label="Break-even daily return"
          value={
            breakevenDaily != null
              ? `${breakevenDaily >= 0 ? "+" : ""}${breakevenDaily.toFixed(3)}%`
              : "--"
          }
          valueColor="text-blue-400"
          sub={
            breakevenAnn != null
              ? `≈ ${breakevenAnn >= 0 ? "+" : ""}${breakevenAnn.toFixed(1)}% annualized`
              : ""
          }
        />
      </div>

      {/* Fan chart: p05-p95 outer, p25-p75 inner, p50 line, gate */}
      <ChartContainer title="Projected 28-Day Sortino (forward)" height={260}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="band90grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="band50grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) =>
              typeof v === "string" && v.length >= 10 ? v.slice(5) : String(v)
            }
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "#111118",
              border: "1px solid #1e1e2e",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(v: unknown, name: unknown) => {
              if (Array.isArray(v))
                return [
                  `${Number(v[0]).toFixed(2)} — ${Number(v[1]).toFixed(2)}`,
                  String(name),
                ];
              return [Number(v).toFixed(2), String(name)];
            }}
            labelFormatter={(l) => `Forward: ${l}`}
          />
          <ReferenceLine
            y={gate}
            stroke="#ef4444"
            strokeDasharray="6 3"
            label={{
              value: `${gate} Gate`,
              fill: "#ef4444",
              fontSize: 10,
              position: "right",
            }}
          />
          <Area
            type="monotone"
            dataKey="band90"
            name="p05–p95"
            stroke="none"
            fill="url(#band90grad)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="band50"
            name="p25–p75"
            stroke="none"
            fill="url(#band50grad)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="median"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>

      {/* P(>= gate) curve */}
      <ChartContainer title="P(Sortino ≥ 1.5) over horizon" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v) =>
              typeof v === "string" && v.length >= 10 ? v.slice(5) : String(v)
            }
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#111118",
              border: "1px solid #1e1e2e",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(v: unknown) => [`${Number(v).toFixed(0)}%`, "P(≥1.5)"]}
            labelFormatter={(l) => `Forward: ${l}`}
          />
          <ReferenceLine y={50} stroke="#a3a3a3" strokeDasharray="4 4" />
          <ReferenceLine y={25} stroke="#525252" strokeDasharray="2 4" />
          <ReferenceLine y={75} stroke="#525252" strokeDasharray="2 4" />
          <Line
            type="monotone"
            dataKey="p_above_pct"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>

      <p className="text-[10px] text-gray-500 leading-snug">
        {(() => {
          const prior = (proj.prior ?? "live").toLowerCase();
          if (prior === "backtest") {
            const pm = proj.prior_meta ?? {};
            return (
              <>
                Forward daily returns are bootstrapped from the strategy backtest
                ({pm.start_date ?? "?"} → {pm.end_date ?? "?"},{" "}
                {pm.n_days ?? "?"} days, ann{" "}
                {pm.ann_return_pct != null
                  ? `${pm.ann_return_pct >= 0 ? "+" : ""}${pm.ann_return_pct.toFixed(1)}%`
                  : "?"}{" "}
                / {pm.ann_vol_pct?.toFixed(1) ?? "?"}% vol) — the long-run thesis
                distribution, not the recent live drawdown. The 28-day window
                still starts from current live returns, so existing drawdown
                tarnishes early days until it ages out. Break-even is the
                average daily return needed for the rolling window to clear the
                gate at current downside vol.
              </>
            );
          }
          return (
            <>
              Bootstrap of forward daily returns from the last{" "}
              {proj.lookback_days ?? "?"} days of live NAV. Each forward day
              adds one simulated return and rolls one historical day out of the
              28-day window, so early crossings may reflect a bad day aging out
              rather than fresh upside. Break-even is the average daily return
              needed for the rolling window to clear the gate at current
              downside vol.
            </>
          );
        })()}
      </p>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────

export function ScalingCapacityTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<ScalingResponse>({
    queryKey: ["scaling", engine.id],
    queryFn: () => client.get("/api/scaling"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading scaling data...
      </div>
    );
  }

  const { scaling_tracker: st, capacity_analysis: ca, scaling_scenarios, capacity_ceiling } = data;

  return (
    <div className="p-4 space-y-6">
      {/* ── Section 1: Scaling Tracker ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Scaling Readiness
        </h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <KpiCard
            label="Current Tier"
            value={st.tier_labels[st.current_tier_index]}
            sub={`Tier ${st.current_tier_index + 1} of ${st.tiers.length}${
              st.days_at_current_tier != null ? ` \u00B7 ${st.days_at_current_tier}d` : ""
            }`}
          />
          <KpiCard
            label={st.sortino_4w_is_live ? "Rolling 4w Sortino \u00b7 live" : "Rolling 4w Sortino"}
            value={st.sortino_4w != null ? st.sortino_4w.toFixed(2) : "N/A"}
            valueColor={st.sortino_4w != null ? gateColor(st.sortino_gate_ok) : "text-gray-500"}
            sub={
              st.sortino_4w_is_live && st.sortino_4w_close != null
                ? `Gate: \u2265 1.5 \u00b7 close ${st.sortino_4w_close.toFixed(2)}`
                : "Gate: \u2265 1.5"
            }
          />
          <KpiCard
            label="PTT Drawdown"
            value={`${st.ptt_dd_pct.toFixed(2)}%`}
            valueColor={gateColor(st.dd_gate_ok)}
            sub="Gate: < 5%"
          />
          <Card className="flex flex-col gap-1 min-w-[140px]">
            <div className="text-xs text-gray-500">Scaling Status</div>
            <div className="mt-1">
              {st.scaling_ready ? (
                <Badge variant="success">READY TO SCALE</Badge>
              ) : (
                <Badge variant="danger">
                  PAUSED
                  {!st.sortino_gate_ok ? " \u00B7 Sortino" : ""}
                  {!st.dd_gate_ok ? " \u00B7 DD" : ""}
                  {!st.infra_gate_ok ? " \u00B7 Infra" : ""}
                </Badge>
              )}
            </div>
            {st.next_tier_label && (
              <div className="text-xs text-gray-500">
                Next: {st.next_tier_label}
              </div>
            )}
          </Card>
        </div>

        {/* Leading-indicator Sortinos (5d / 7d / 14d / 28d) */}
        {(st.sortino_5d != null || st.sortino_7d != null || st.sortino_14d != null) && (
          <Card>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Sortino Ladder · leading indicators
                </div>
                <div className="text-[10px] text-gray-500">
                  Small-window values are noisy; treat as directional hints, not gates
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "5-day", value: st.sortino_5d ?? null, note: "noisiest" },
                  { label: "7-day", value: st.sortino_7d ?? null, note: "" },
                  { label: "14-day", value: st.sortino_14d ?? null, note: "" },
                  { label: "28-day · gate", value: st.sortino_4w ?? null, note: "≥ 1.5" },
                ].map((row) => {
                  const v = row.value;
                  const colorClass =
                    v == null
                      ? "text-gray-500"
                      : v >= 1.5
                        ? "text-emerald-400"
                        : v >= 0
                          ? "text-amber-400"
                          : "text-red-400";
                  return (
                    <div key={row.label} className="flex flex-col">
                      <div className="text-[10px] text-gray-500">{row.label}</div>
                      <div className={`text-xl font-mono ${colorClass}`}>
                        {v == null ? "—" : v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)}
                      </div>
                      {row.note && (
                        <div className="text-[9px] text-gray-600 mt-0.5">{row.note}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Tier Ladder */}
        <Card>
          <CardHeader>
            <CardTitle>Scaling Ladder</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between gap-1">
              {st.tier_labels.map((label, i) => {
                const isCurrent = i === st.current_tier_index;
                const isPast = i < st.current_tier_index;
                return (
                  <div key={label} className="flex flex-col items-center flex-1">
                    {/* Connector line + node */}
                    <div className="flex items-center w-full">
                      {i > 0 && (
                        <div
                          className={`flex-1 h-0.5 ${
                            isPast ? "bg-green-500/50" : "bg-gray-700"
                          }`}
                        />
                      )}
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                          isCurrent
                            ? "bg-green-500 border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                            : isPast
                              ? "bg-green-800 border-green-600"
                              : "bg-gray-800 border-gray-600"
                        }`}
                      />
                      {i < st.tier_labels.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 ${
                            isPast ? "bg-green-500/50" : "bg-gray-700"
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`mt-1.5 text-[10px] ${
                        isCurrent
                          ? "text-green-400 font-semibold"
                          : isPast
                            ? "text-green-600"
                            : "text-gray-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Sortino Trend Chart */}
        {st.sortino_trend.length > 0 && (
          <ChartContainer title="Rolling 28-Day Sortino" height={240}>
            <LineChart data={st.sortino_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)} // MM-DD
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                domain={[-10, 10]}
                allowDataOverflow
                ticks={[-10, -5, 0, 1.5, 5, 10]}
              />
              <Tooltip
                contentStyle={{
                  background: "#111118",
                  border: "1px solid #1e1e2e",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v) => [Number(v).toFixed(2), "Sortino"]}
              />
              <ReferenceLine
                y={1.5}
                stroke="#ef4444"
                strokeDasharray="6 3"
                label={{
                  value: "1.5 Gate",
                  fill: "#ef4444",
                  fontSize: 10,
                  position: "right",
                }}
              />
              {/* Time-series overlays for shorter rolling windows. Each Line
                  is a real rolling-Sortino series at the named window. The 28d
                  is the gate; 5/7/14d are leading indicators. */}
              <Line
                type="monotone"
                dataKey="value_5d"
                name="5d"
                stroke="#f59e0b"
                strokeWidth={1.25}
                strokeDasharray="2 3"
                strokeOpacity={0.85}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value_7d"
                name="7d"
                stroke="#a78bfa"
                strokeWidth={1.25}
                strokeDasharray="3 3"
                strokeOpacity={0.85}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value_14d"
                name="14d"
                stroke="#34d399"
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="28d (gate)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        )}

        {/* ── Forward Sortino Projection ── */}
        {st.sortino_projection?.available && st.sortino_projection.projection && (
          <SortinoProjectionPanel proj={st.sortino_projection} />
        )}

        {/* Infrastructure Gate KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="Avg Slippage (30d)"
            value={`${st.avg_slippage_bps.toFixed(1)} bps`}
            valueColor={gateColor(st.avg_slippage_bps < 10)}
            sub={`${st.n_trades_30d} trades`}
          />
          <KpiCard
            label="Fill Ratio (30d)"
            value={`${st.fill_ratio_pct.toFixed(1)}%`}
            valueColor={gateColor(st.fill_ratio_pct >= 95)}
            sub="Gate: \u2265 95%"
          />
          <KpiCard
            label="Funding Drag (ann.)"
            value={`${ca.funding_drag.annualized_pct >= 0 ? "+" : ""}${ca.funding_drag.annualized_pct.toFixed(2)}%`}
            valueColor={ca.funding_drag.annualized_pct >= 0 ? "text-green-400" : "text-yellow-400"}
            sub={`30d: ${formatUSD(ca.funding_drag.total_funding_30d, 2)}`}
          />
        </div>
      </div>

      {/* ── Section 2: Capacity Analysis ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Capacity Analysis
        </h2>

        {/* Constrained summary */}
        {ca.constrained_summary.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ca.constrained_summary.map((cs) => (
              <KpiCard
                key={cs.label}
                label={`Constrained @ ${cs.label}`}
                value={`${cs.n_constrained} tokens`}
                valueColor={
                  cs.pct_constrained >= 30
                    ? "text-red-400"
                    : cs.pct_constrained >= 10
                      ? "text-yellow-400"
                      : "text-green-400"
                }
                sub={`${cs.pct_constrained}% of positions > ${ca.adv_constraint_pct}% ADV`}
              />
            ))}
          </div>
        )}

        {/* Per-Token Capacity Table */}
        <Card>
          <CardHeader>
            <CardTitle>Per-Token Capacity ({ca.adv_constraint_pct}% ADV Threshold)</CardTitle>
          </CardHeader>
          <DataTable<TokenCapacity>
            columns={buildCapacityColumns(ca.projection_labels)}
            data={ca.tokens}
            defaultSort="pct_adv"
            defaultDir="desc"
            maxHeight="max-h-[480px]"
          />
        </Card>

        {/* Fill Quality by Volume Tier */}
        <Card>
          <CardHeader>
            <CardTitle>Fill Quality by Volume Tier</CardTitle>
          </CardHeader>
          <DataTable<{ tier: string } & FillQualityTier>
            columns={fillQualityColumns}
            data={Object.entries(ca.fill_quality_by_tier).map(([tier, d]) => ({
              tier,
              ...d,
            }))}
          />
        </Card>
      </div>

      {/* ── Section 3: Scaling Scenarios ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Scaling Scenarios
        </h2>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Analysis</CardTitle>
          </CardHeader>
          <DataTable<ScalingScenario>
            columns={scenarioColumns}
            data={scaling_scenarios}
          />
        </Card>

        {/* Capacity Ceiling */}
        {capacity_ceiling && (
          <Card className="border-yellow-800/40">
            <div className="p-4 flex items-start gap-3">
              <div className="text-yellow-400 text-lg mt-0.5">&#9888;</div>
              <div>
                <div className="text-sm font-semibold text-yellow-400">
                  Strategy Capacity Ceiling: {capacity_ceiling.ceiling_label}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {capacity_ceiling.reason}
                </div>
                <div className="text-xs text-gray-500 mt-2 border-t border-gray-700/50 pt-2">
                  <span className="text-gray-400 font-medium">Scaling playbook:</span>{" "}
                  (1) Add venues — Bybit, OKX, dYdX via CoinRoutes multiplies ADV 2-4x.{" "}
                  (2) Expand basket to 30-40 L/S positions.{" "}
                  (3) Tilt sizing toward liquid tokens at higher tiers.{" "}
                  <span className="text-gray-600">ADV shown is Binance-only — aggregate multi-venue ADV would be significantly higher.</span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Column Definitions ─────────────────────────────────────────

function buildCapacityColumns(projLabels: string[]): Column<TokenCapacity>[] {
  const cols: Column<TokenCapacity>[] = [
    {
      key: "symbol",
      header: "Symbol",
      render: (r) => (
        <span className="font-mono text-xs">{r.symbol.replace("USDT", "")}</span>
      ),
      sortKey: (r) => r.symbol,
    },
    {
      key: "side",
      header: "Side",
      render: (r) => (
        <Badge variant={r.side === "LONG" ? "info" : "warning"}>
          {r.side}
        </Badge>
      ),
      sortKey: (r) => r.side,
    },
    {
      key: "notional",
      header: "Notional",
      align: "right",
      render: (r) => <span className="text-xs">{formatUSD(r.current_notional)}</span>,
      sortKey: (r) => r.current_notional,
    },
    {
      key: "adv",
      header: "ADV",
      align: "right",
      render: (r) => <span className="text-xs">{formatCompact(r.adv_usd)}</span>,
      sortKey: (r) => r.adv_usd ?? 0,
    },
    {
      key: "pct_adv",
      header: "% ADV Now",
      align: "right",
      render: (r) => (
        <span className={`text-xs ${advPctColor(r.pct_adv_current)}`}>
          {r.pct_adv_current != null ? `${r.pct_adv_current.toFixed(4)}%` : "--"}
        </span>
      ),
      sortKey: (r) => r.pct_adv_current ?? 0,
    },
  ];

  // Dynamic projection columns
  for (const label of projLabels) {
    const key = `pct_adv_${label}`;
    cols.push({
      key,
      header: `% @${label}`,
      align: "right",
      render: (r) => {
        const v = r[key] as number | null;
        return (
          <span className={`text-xs ${advPctColor(v)}`}>
            {v != null ? `${v.toFixed(3)}%` : "--"}
          </span>
        );
      },
      sortKey: (r) => (r[key] as number) ?? 0,
    });
  }

  cols.push({
    key: "constrained",
    header: "Constrained At",
    align: "right",
    render: (r) =>
      r.constrained_at ? (
        <Badge variant="danger">{r.constrained_at}</Badge>
      ) : (
        <span className="text-xs text-gray-600">--</span>
      ),
    sortKey: (r) => r.constrained_at ?? "zzz",
  });

  return cols;
}

const fillQualityColumns: Column<{ tier: string } & FillQualityTier>[] = [
  {
    key: "tier",
    header: "Volume Tier",
    render: (r) => (
      <Badge
        variant={
          r.tier === "HIGH" ? "success" : r.tier === "MED" ? "warning" : "danger"
        }
      >
        {r.tier}
      </Badge>
    ),
  },
  {
    key: "slippage",
    header: "Avg Slippage",
    align: "right",
    render: (r) => <span className="text-xs">{r.avg_slippage_bps.toFixed(1)} bps</span>,
    sortKey: (r) => r.avg_slippage_bps,
  },
  {
    key: "fill",
    header: "Fill Ratio",
    align: "right",
    render: (r) => (
      <span className={`text-xs ${r.fill_ratio_pct >= 95 ? "text-green-400" : "text-yellow-400"}`}>
        {r.fill_ratio_pct.toFixed(1)}%
      </span>
    ),
    sortKey: (r) => r.fill_ratio_pct,
  },
  {
    key: "trades",
    header: "Trades",
    align: "right",
    render: (r) => <span className="text-xs">{r.n_trades}</span>,
    sortKey: (r) => r.n_trades,
  },
];

const scenarioColumns: Column<ScalingScenario>[] = [
  {
    key: "tier",
    header: "Notional",
    render: (r) => (
      <span className={`text-xs font-mono ${r.is_current ? "text-green-400 font-semibold" : ""}`}>
        {r.label}
        {r.is_current && " \u25C0"}
      </span>
    ),
  },
  {
    key: "nickel",
    header: "Nickel Capital",
    align: "right",
    render: (r) => <span className="text-xs text-gray-400">{r.nickel_capital ? formatUSD(r.nickel_capital) : "—"}</span>,
  },
  {
    key: "gross",
    header: "Gross Exposure",
    align: "right",
    render: (r) => <span className="text-xs text-gray-400">{r.gross_exposure ? formatUSD(r.gross_exposure) : "—"}</span>,
  },
  {
    key: "max_pos",
    header: "Max Position",
    align: "right",
    render: (r) => <span className="text-xs">{formatUSD(r.max_position_usd)}</span>,
    sortKey: (r) => r.max_position_usd,
  },
  {
    key: "constrained",
    header: "Constrained",
    align: "right",
    render: (r) => <span className="text-xs">{r.n_constrained}</span>,
    sortKey: (r) => r.n_constrained,
  },
  {
    key: "pct_constrained",
    header: "% Constrained",
    align: "right",
    render: (r) => (
      <span
        className={`text-xs ${
          r.pct_constrained >= 30
            ? "text-red-400"
            : r.pct_constrained >= 10
              ? "text-yellow-400"
              : "text-green-400"
        }`}
      >
        {r.pct_constrained.toFixed(1)}%
      </span>
    ),
    sortKey: (r) => r.pct_constrained,
  },
  {
    key: "slippage",
    header: "Est. Slippage",
    align: "right",
    render: (r) => <span className="text-xs">{r.est_slippage_bps.toFixed(1)} bps</span>,
    sortKey: (r) => r.est_slippage_bps,
  },
  {
    key: "feasibility",
    header: "Feasibility",
    align: "right",
    render: (r) => (
      <Badge
        variant={
          r.feasibility === "GREEN"
            ? "success"
            : r.feasibility === "YELLOW"
              ? "warning"
              : "danger"
        }
      >
        {r.feasibility === "GREEN"
          ? "FEASIBLE"
          : r.feasibility === "YELLOW"
            ? "CAUTION"
            : "CONSTRAINED"}
      </Badge>
    ),
  },
];
