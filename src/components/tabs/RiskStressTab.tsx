import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { DataTable, type Column } from "../shared/DataTable";
import { KpiCard } from "../shared/KpiCard";
import { ChartContainer } from "../shared/ChartContainer";
import { AdlMonitor } from "../overview/AdlMonitor";
import { formatUSD, formatPct, pnlColor } from "../../lib/utils";
import type { AdlData, HedgeQualityResponse, PerShortHedge } from "../../types/api";

// ── Collapsible section ──
function Collapsible({ title, defaultOpen = false, children, count }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <div
        className="flex items-center justify-between cursor-pointer px-4 py-3"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
          <span className="text-sm font-medium text-gray-200">{title}</span>
          {count != null && <span className="text-xs text-gray-500">({count})</span>}
        </div>
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}

// ── Risk types ──

interface ExitMethodology {
  tp_pct: number;
  sl_pct: number;
  trailing_tp: boolean;
  vol_sl_enabled: boolean;
  vol_sl_multiplier: number;
  cooldown_hours: number;
}

interface CorrelationRegime {
  avg_pairwise_corr: number;
  danger_score: number;
  regime: string;
}

interface RiskResponse {
  dd_pct: number;
  dd_scale: number;
  distance_to_sl_pct: number;
  max_drawdown_pct: number;
  nav: number;
  hwm: number;
  vol_scale: number;
  btc_fast_vol: number | null;
  btc_slow_vol: number | null;
  vol_ratio: number | null;
  combined_vol_scale: number;
  effective_scale: number;
  recovery_scale?: number;
  recovery_stage?: string;
  cooldown_until?: string;
  limits: { dd_stop_pct: number; max_leverage_pct: number; max_net_pct: number };
  compliance: { max_dd_ok: boolean; gross_ok: boolean; net_ok: boolean };
  correlation_regime?: CorrelationRegime;
  exit_methodology?: ExitMethodology;
}

// ── Stress types ──

interface StressScenario {
  name: string;
  description: string;
  estimated_pnl: number;
  estimated_pnl_pct: number;
  affected_positions: number;
}

interface ReverseStress {
  scenario: string;
  move_required_pct: number;
  description: string;
}

interface StressResponse {
  scenarios: StressScenario[];
  reverse_stress: ReverseStress[];
  var_summary?: {
    historical_95: number;
    historical_99: number;
    parametric_95: number;
    parametric_99: number;
  };
}

// ── VaR types ──

interface ComponentVar {
  symbol: string;
  side: string;
  notional: number;
  beta: number;
  component_var_usd: number;
  component_var_pct: number;
  pct_of_total: number;
  // Legacy fields
  var_contribution?: number;
  var_pct?: number;
}

interface VarEntry {
  var_pct?: number;
  var_usd?: number;
  cvar_pct?: number;
  cvar_usd?: number;
}

interface VarResponse {
  portfolio: {
    // New nested format (current API)
    historical_95_1d?: VarEntry;
    historical_99_1d?: VarEntry;
    parametric_95_1d?: VarEntry;
    parametric_99_1d?: VarEntry;
    cvar_95_1d?: VarEntry;
    cvar_99_1d?: VarEntry;
    // Legacy flat format
    historical_95?: number;
    historical_99?: number;
    parametric_95?: number;
    parametric_99?: number;
    cvar_95?: number;
    cvar_99?: number;
  };
  component?: ComponentVar[];
  components?: ComponentVar[];
}

// ── Component VaR columns ──

const componentVarColumns: Column<ComponentVar>[] = [
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => (
      <span className="font-medium text-gray-200">{r.symbol.replace("USDT", "")}</span>
    ),
    sortKey: (r) => r.symbol,
  },
  {
    key: "side",
    header: "Side",
    render: (r) => (
      <Badge variant={r.side === "LONG" ? "success" : "danger"} className="text-[10px]">
        {r.side}
      </Badge>
    ),
    sortKey: (r) => r.side,
  },
  {
    key: "notional",
    header: "Notional",
    render: (r) => formatUSD(r.notional),
    sortKey: (r) => r.notional,
    align: "right",
  },
  {
    key: "var_contribution",
    header: "VaR Contribution",
    render: (r) => (
      <span className="text-red-400 font-mono">{formatUSD(r.component_var_usd ?? r.var_contribution)}</span>
    ),
    sortKey: (r) => r.component_var_usd ?? r.var_contribution ?? 0,
    align: "right",
  },
  {
    key: "var_pct",
    header: "% of Total",
    render: (r) => (
      <span className="text-red-400 font-mono">{formatPct(r.pct_of_total ?? r.var_pct)}</span>
    ),
    sortKey: (r) => r.pct_of_total ?? r.var_pct ?? 0,
    align: "right",
  },
];

export function RiskStressTab() {
  const { client, engine } = useEngine();

  const { data: risk, isLoading: riskLoading } = useQuery<RiskResponse>({
    queryKey: ["risk", engine.id],
    queryFn: () => client.get("/api/risk"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: stress } = useQuery<StressResponse>({
    queryKey: ["stress", engine.id],
    queryFn: () => client.get("/api/stress"),
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: false,
  });

  const { data: varData } = useQuery<VarResponse>({
    queryKey: ["var", engine.id],
    queryFn: () => client.get("/api/var"),
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: false,
  });

  const { data: adl } = useQuery<AdlData>({
    queryKey: ["adl", engine.id],
    queryFn: () => client.get("/api/adl"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: hedgeData } = useQuery<HedgeQualityResponse>({
    queryKey: ["hedge-quality", engine.id],
    queryFn: () => client.get("/api/hedge-quality"),
    refetchInterval: 300_000,
    staleTime: 120_000,
    retry: false,
  });

  interface SpreadRiskHorizon {
    period: string;
    expected_pct: number;
    median_pct: number;
    vol_pct: number;
    max_positive_pct: number;
    max_negative_pct: number;
    current_pct: number | null;
    percentile: number | null;
    expected_pct_lev: number;
    median_pct_lev: number;
    vol_pct_lev: number;
    max_positive_pct_lev: number;
    max_negative_pct_lev: number;
    current_pct_lev: number | null;
  }
  interface SpreadRiskResponse {
    horizons: SpreadRiskHorizon[];
    skew: number;
    kurtosis: number;
    leverage: number;
    n_observations: number;
    data_start: string;
    long_count: number;
    short_count: number;
    strategy_days_live: number;
  }

  const { data: spreadRisk } = useQuery<SpreadRiskResponse>({
    queryKey: ["spread-risk", engine.id],
    queryFn: () => client.get("/api/spread-risk"),
    refetchInterval: 3600_000,
    staleTime: 1800_000,
    retry: false,
  });

  const [spreadLevered, setSpreadLevered] = useState(false);

  interface DriftStats {
    drift_per_day: number;
    drift_vol_per_day: number;
    weekend_multiplier: number;
    kurtosis: number;
    drift_autocorr: number;
  }
  interface TimeToBreach { median_days: number; p95_days: number }
  interface DriftDecomposition {
    systematic_drift_per_day: number;
    idiosyncratic_drift_per_day: number;
    r_squared: number;
    btc_sensitivity: number;
    recent_24h_systematic: number;
    recent_24h_idiosyncratic: number;
    idiosyncratic_fraction: number;
  }
  interface DriftDecision {
    action: "HOLD" | "REBALANCE";
    reason: string;
    urgency: "low" | "medium" | "high" | "compliance";
    hours_to_breakeven: number | null;
    hours_since_last_rebalance: number;
    backstop_hours_remaining: number;
  }
  interface DriftCosts {
    holding_cost_bps: number;
    holding_cost_per_day_bps: number;
    rebalance_cost_bps: number;
    break_even_hours: number | null;
    realized_cost_bps: number;
    cost_source: "realized" | "static";
    n_fills_used: number;
  }
  interface FactorAttribution {
    factor: string;
    current_value: number;
    loading: number;
    persistence: number;
    contribution_bps: number;
    direction: "favorable" | "unfavorable" | "neutral";
  }
  interface DriftBands {
    lower_pct: number;
    upper_pct: number;
    current_beta_net_pct: number;
    hard_limit_pct: number;
    hard_limit_buffer_pct: number;
  }
  interface GarchForecast {
    daily_vol_pct: number;
    unconditional_vol_pct: number;
    vol_ratio: number;
    params: { omega: number; alpha: number; beta: number };
  }
  interface DriftSnapshot {
    ts: string;
    beta_net_pct: number;
    net_pct: number;
    gross_pct: number;
    holding_cost_bps: number;
    rebalance_cost_bps: number;
    garch_vol_pct: number;
    band_lower_pct: number;
    band_upper_pct: number;
    decision: string;
    urgency: string;
  }
  interface DriftResponse {
    current_state: {
      beta_net_pct: number; gross_pct: number; net_pct: number;
      hours_since_rebalance: number; vol_regime: string; corr_regime: string;
    };
    drift_stats: { beta_net: DriftStats; gross_pct: DriftStats; net_pct: DriftStats };
    drift_decomposition: DriftDecomposition;
    time_to_breach: Record<string, TimeToBreach>;
    crypto_characteristics: {
      weekend_vol_premium: number; empirical_kurtosis: number;
      drift_autocorrelation: number; student_t_df: number;
    };
    decision: DriftDecision;
    costs: DriftCosts;
    factor_attribution: FactorAttribution[];
    bands: DriftBands;
    garch: GarchForecast;
    n_hours_analyzed: number;
    n_daily_observations: number;
  }

  const { data: driftData } = useQuery<DriftResponse>({
    queryKey: ["drift-analysis", engine.id],
    queryFn: () => client.get("/api/drift-analysis"),
    refetchInterval: 900_000,
    staleTime: 600_000,
    retry: false,
  });

  const { data: driftHistory } = useQuery<{ snapshots: DriftSnapshot[] }>({
    queryKey: ["drift-history", engine.id],
    queryFn: () => client.get("/api/drift-analysis/history?days=7"),
    refetchInterval: 900_000,
    staleTime: 600_000,
    retry: false,
  });

  if (riskLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading risk data...
      </div>
    );
  }

  if (!risk) return null;

  const r = risk as any;
  // Use Nickel's DD as primary when available
  const ntDd = r.nt_dd_pct != null ? Math.abs(r.nt_dd_pct) : null;
  const internalDd = Math.abs(risk.dd_pct);
  const ddPct = ntDd ?? internalDd;
  const stopPct = Math.abs(risk.limits.dd_stop_pct);
  const ddGaugePct = stopPct > 0 ? Math.min((ddPct / stopPct) * 100, 100) : 0;
  const ddSource = r.dd_source === "nt" ? "Nickel" : "Internal";
  const ddUsd = r.nav ? Math.round(ddPct / 100 * (r.notional_capital || 100000)) : 0;

  return (
    <div className="space-y-4 p-4">
      {/* ── Spread Risk Distribution (top of page) ── */}
      {spreadRisk && spreadRisk.horizons && (
        <Card>
          <div className="flex items-center justify-between">
            <CardHeader>
              <CardTitle>Spread Risk Distribution</CardTitle>
            </CardHeader>
            <button
              onClick={() => setSpreadLevered(!spreadLevered)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors mr-4 ${
                spreadLevered
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                  : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
              }`}
              title={`Apply ${spreadRisk.leverage}x leverage`}
            >
              {spreadLevered ? `${spreadRisk.leverage}x` : "Levered"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500"></th>
                  {spreadRisk.horizons.map((h) => (
                    <th key={h.period} className="px-3 py-2 text-right text-gray-500 font-medium">{h.period}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <tr>
                  <td className="px-3 py-2 text-gray-400">Mean</td>
                  {spreadRisk.horizons.map((h) => {
                    const v = spreadLevered ? h.expected_pct_lev : h.expected_pct;
                    return (
                      <td key={h.period} className={`px-3 py-2 text-right font-mono ${v >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {v >= 0 ? "+" : ""}{v.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-400">Median</td>
                  {spreadRisk.horizons.map((h) => {
                    const v = spreadLevered ? h.median_pct_lev : h.median_pct;
                    if (v == null) return <td key={h.period} className="px-3 py-2 text-right text-gray-600">—</td>;
                    return (
                      <td key={h.period} className={`px-3 py-2 text-right font-mono ${v >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {v >= 0 ? "+" : ""}{v.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-400">Vol (1σ)</td>
                  {spreadRisk.horizons.map((h) => {
                    const v = spreadLevered ? h.vol_pct_lev : h.vol_pct;
                    return (
                      <td key={h.period} className="px-3 py-2 text-right font-mono text-gray-300">
                        {v.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-400">95th (best)</td>
                  {spreadRisk.horizons.map((h) => {
                    const v = spreadLevered ? h.max_positive_pct_lev : h.max_positive_pct;
                    return (
                      <td key={h.period} className="px-3 py-2 text-right font-mono text-green-400">
                        {v >= 0 ? "+" : ""}{v.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-400">5th (worst)</td>
                  {spreadRisk.horizons.map((h) => {
                    const v = spreadLevered ? h.max_negative_pct_lev : h.max_negative_pct;
                    return (
                      <td key={h.period} className="px-3 py-2 text-right font-mono text-red-400">
                        {v >= 0 ? "+" : ""}{v.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t-2 border-[var(--border)]">
                  <td className="px-3 py-2 text-gray-300 font-medium">Current</td>
                  {spreadRisk.horizons.map((h) => {
                    const v = h.current_pct != null ? (spreadLevered ? h.current_pct_lev : h.current_pct) : null;
                    if (v == null) return <td key={h.period} className="px-3 py-2 text-right text-gray-600">—</td>;
                    const hDays = parseInt(h.period);
                    const daysLive = spreadRisk.strategy_days_live ?? 0;
                    const isLive = hDays <= daysLive;
                    const exp = spreadLevered ? h.expected_pct_lev : h.expected_pct;
                    const aboveExpected = v >= exp;
                    return (
                      <td key={h.period} className={`px-3 py-2 text-right font-mono font-bold ${isLive ? (aboveExpected ? "text-green-400" : "text-red-400") : "text-gray-500 italic"}`}>
                        {v >= 0 ? "+" : ""}{v.toFixed(2)}%
                        {!isLive && <span className="text-[8px] text-gray-600 ml-0.5 not-italic">sim</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500 text-[10px]">Percentile</td>
                  {spreadRisk.horizons.map((h) => {
                    const p = h.percentile;
                    if (p == null) return <td key={h.period} className="px-3 py-2 text-right text-gray-600">—</td>;
                    const color = p >= 60 ? "text-green-400" : p <= 40 ? "text-red-400" : "text-gray-400";
                    return (
                      <td key={h.period} className={`px-3 py-2 text-right font-mono text-[10px] ${color}`}>
                        {p.toFixed(0)}th
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex gap-4 mt-2 px-3 pb-2 text-[10px] text-gray-600">
            <span>Skew: <span className="text-gray-400">{spreadRisk.skew.toFixed(2)}</span></span>
            <span>Kurtosis: <span className="text-gray-400">{spreadRisk.kurtosis.toFixed(2)}</span></span>
            <span>Obs: <span className="text-gray-400">{spreadRisk.n_observations}</span></span>
            <span>Since: <span className="text-gray-400">{spreadRisk.data_start}</span></span>
            <span>{spreadRisk.long_count}L / {spreadRisk.short_count}S</span>
          </div>
        </Card>
      )}

      {/* ── Drift Analysis v2 — Decision Engine ── */}
      {driftData && driftData.drift_stats && (
        <Card>
          <CardHeader>
            <CardTitle>Exposure Drift Analysis</CardTitle>
          </CardHeader>

          {/* Current State pills */}
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            <span className="bg-gray-800 px-2 py-1 rounded">
              Beta Net: <span className={`font-mono font-medium ${Math.abs(driftData.current_state.beta_net_pct) > 5 ? "text-red-400" : "text-green-400"}`}>
                {driftData.current_state.beta_net_pct >= 0 ? "+" : ""}{driftData.current_state.beta_net_pct.toFixed(1)}%
              </span>
            </span>
            <span className="bg-gray-800 px-2 py-1 rounded">
              Gross: <span className="font-mono text-gray-300">{driftData.current_state.gross_pct.toFixed(1)}%</span>
            </span>
            <span className="bg-gray-800 px-2 py-1 rounded">
              Net: <span className={`font-mono ${Math.abs(driftData.current_state.net_pct) > 15 ? "text-yellow-400" : "text-gray-300"}`}>
                {driftData.current_state.net_pct >= 0 ? "+" : ""}{driftData.current_state.net_pct.toFixed(1)}%
              </span>
            </span>
            <span className="bg-gray-800 px-2 py-1 rounded text-gray-500">
              {driftData.current_state.hours_since_rebalance.toFixed(0)}h since rebal
            </span>
            <Badge variant="default" className="text-[10px]">{driftData.current_state.vol_regime}</Badge>
            <Badge variant="default" className="text-[10px]">{driftData.current_state.corr_regime}</Badge>
          </div>

          {/* Beta Drift Chart (time-series) */}
          {driftHistory?.snapshots && driftHistory.snapshots.length > 2 && (
            <div className="mb-3 px-1">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 px-2">Beta Net % — 7 Day Drift</div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={driftHistory.snapshots} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="ts"
                    tick={{ fontSize: 9, fill: "#6b7280" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,"0")}:00`;
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", fontSize: 11 }}
                    labelFormatter={(v) => new Date(String(v)).toLocaleString()}
                    formatter={(value, name) => [
                      `${Number(value).toFixed(2)}%`,
                      name === "beta_net_pct" ? "Beta Net" : name === "band_upper_pct" ? "Upper Band" : name === "band_lower_pct" ? "Lower Band" : String(name),
                    ]}
                  />
                  <Area dataKey="band_upper_pct" stroke="none" fill="#16a34a" fillOpacity={0.08} />
                  <Area dataKey="band_lower_pct" stroke="none" fill="#16a34a" fillOpacity={0.08} />
                  <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                  <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                  <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
                  <Line dataKey="beta_net_pct" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line dataKey="band_upper_pct" stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                  <Line dataKey="band_lower_pct" stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Decision Banner */}
          {driftData.decision && (() => {
            const dec = driftData.decision;
            const bannerColor = dec.action === "HOLD"
              ? "text-green-400 bg-green-900/15 border-green-800/30"
              : dec.urgency === "compliance"
              ? "text-red-400 bg-red-900/25 border-red-800/40"
              : dec.urgency === "high"
              ? "text-red-400 bg-red-900/15 border-red-800/30"
              : "text-yellow-400 bg-yellow-900/15 border-yellow-800/30";
            return (
              <div className={`rounded border px-3 py-2 mb-3 ${bannerColor}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">{dec.action}</span>
                  <span className="text-[10px] text-gray-500">backstop {dec.backstop_hours_remaining.toFixed(0)}h</span>
                </div>
                <div className="text-[11px]">{dec.reason}</div>
                {dec.hours_to_breakeven != null && (
                  <div className="text-[10px] text-gray-500 mt-1">
                    Break-even: {dec.hours_to_breakeven.toFixed(0)}h ({(dec.hours_to_breakeven / 24).toFixed(1)}d)
                  </div>
                )}
              </div>
            );
          })()}

          {/* Cost Comparison */}
          {driftData.costs && (
            <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
              <div className="bg-gray-800 rounded px-3 py-2">
                <div className="text-gray-500 text-[10px] uppercase mb-1">Holding Cost</div>
                <div className="font-mono text-gray-200 text-sm">{driftData.costs.holding_cost_bps.toFixed(1)} <span className="text-[10px] text-gray-500">bps cumul.</span></div>
                <div className="font-mono text-gray-400 text-[11px]">{driftData.costs.holding_cost_per_day_bps.toFixed(1)} bps/day</div>
              </div>
              <div className="bg-gray-800 rounded px-3 py-2">
                <div className="text-gray-500 text-[10px] uppercase mb-1">Rebalance Cost</div>
                <div className="font-mono text-gray-200 text-sm">{driftData.costs.rebalance_cost_bps.toFixed(1)} <span className="text-[10px] text-gray-500">bps</span></div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {driftData.costs.cost_source === "realized"
                    ? `${driftData.costs.realized_cost_bps.toFixed(1)} bps/fill (${driftData.costs.n_fills_used} fills)`
                    : `Static ${driftData.costs.realized_cost_bps.toFixed(1)} bps/fill`}
                </div>
              </div>
            </div>
          )}

          {/* Factor Attribution */}
          {driftData.factor_attribution && driftData.factor_attribution.length > 0 && (
            <div className="overflow-x-auto mb-3">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 px-3">Factor Attribution</div>
              <table className="w-full text-xs">
                <thead className="border-b border-[var(--border)]">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-gray-500">Factor</th>
                    <th className="px-3 py-1.5 text-right text-gray-500">Value</th>
                    <th className="px-3 py-1.5 text-right text-gray-500">Loading</th>
                    <th className="px-3 py-1.5 text-right text-gray-500">AR(1)</th>
                    <th className="px-3 py-1.5 text-right text-gray-500">Cost (bps)</th>
                    <th className="px-3 py-1.5 text-right text-gray-500">Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {driftData.factor_attribution.map((f) => {
                    const dirColor = f.direction === "favorable" ? "text-green-400" : f.direction === "unfavorable" ? "text-red-400" : "text-gray-500";
                    return (
                      <tr key={f.factor}>
                        <td className="px-3 py-1.5 text-gray-300">{f.factor}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-300">{f.current_value.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-500">{f.loading.toFixed(4)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-500">{f.persistence.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-300">{f.contribution_bps.toFixed(1)}</td>
                        <td className={`px-3 py-1.5 text-right font-mono text-[10px] font-medium ${dirColor}`}>{f.direction}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Drift Band Visualization */}
          {driftData.bands && (() => {
            const b = driftData.bands;
            const range = b.hard_limit_pct * 2;
            const toPos = (v: number) => ((v + b.hard_limit_pct) / range) * 100;
            const curPos = Math.max(0, Math.min(100, toPos(b.current_beta_net_pct)));
            const inBand = b.current_beta_net_pct >= b.lower_pct && b.current_beta_net_pct <= b.upper_pct;
            return (
              <div className="mb-3 px-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Dynamic Drift Bands (beta net %)</div>
                <div className="relative h-10 bg-gray-900 rounded-md overflow-hidden border border-gray-700">
                  {/* Danger zones near hard limits */}
                  <div className="absolute h-full bg-red-900/15" style={{ left: 0, width: `${toPos(-b.hard_limit_pct + 5)}%` }} />
                  <div className="absolute h-full bg-red-900/15" style={{ left: `${toPos(b.hard_limit_pct - 5)}%`, right: 0 }} />
                  {/* Band region */}
                  <div
                    className="absolute h-full bg-green-500/15 border-l border-r border-green-500/30"
                    style={{ left: `${toPos(b.lower_pct)}%`, width: `${toPos(b.upper_pct) - toPos(b.lower_pct)}%` }}
                  />
                  {/* Band edge labels */}
                  <div className="absolute top-0.5 text-[8px] font-mono text-green-500/60" style={{ left: `${toPos(b.lower_pct)}%`, transform: "translateX(-50%)" }}>
                    {b.lower_pct.toFixed(0)}
                  </div>
                  <div className="absolute top-0.5 text-[8px] font-mono text-green-500/60" style={{ left: `${toPos(b.upper_pct)}%`, transform: "translateX(-50%)" }}>
                    {b.upper_pct.toFixed(0)}
                  </div>
                  {/* Hard limit markers */}
                  <div className="absolute h-full w-px bg-red-500/60" style={{ left: `${toPos(-b.hard_limit_pct)}%` }} />
                  <div className="absolute h-full w-px bg-red-500/60" style={{ left: `${toPos(b.hard_limit_pct)}%` }} />
                  {/* Hard limit labels */}
                  <div className="absolute bottom-0.5 text-[8px] font-mono text-red-500/50" style={{ left: `${toPos(-b.hard_limit_pct)}%`, marginLeft: 2 }}>-{b.hard_limit_pct}%</div>
                  <div className="absolute bottom-0.5 text-[8px] font-mono text-red-500/50" style={{ left: `${toPos(b.hard_limit_pct)}%`, transform: "translateX(-100%)", marginRight: 2 }}>+{b.hard_limit_pct}%</div>
                  {/* Zero line */}
                  <div className="absolute h-full w-px bg-gray-600" style={{ left: "50%" }} />
                  <div className="absolute top-0.5 text-[8px] text-gray-600" style={{ left: "50%", marginLeft: 2 }}>0</div>
                  {/* Current position marker */}
                  <div
                    className={`absolute h-full w-1 rounded-sm ${inBand ? "bg-blue-400" : "bg-yellow-400"}`}
                    style={{ left: `${curPos}%`, transform: "translateX(-50%)" }}
                  />
                  <div
                    className={`absolute bottom-0.5 text-[9px] font-mono font-bold ${inBand ? "text-blue-400" : "text-yellow-400"}`}
                    style={{ left: `${curPos}%`, transform: "translateX(-50%)" }}
                  >
                    {b.current_beta_net_pct.toFixed(1)}%
                  </div>
                </div>
                <div className="flex justify-between text-[10px] mt-1 px-0.5">
                  <span className="text-gray-500">Band: <span className="font-mono text-green-400/70">[{b.lower_pct.toFixed(1)}, {b.upper_pct.toFixed(1)}]</span></span>
                  <span className="text-gray-500">Buffer to limit: <span className={`font-mono ${b.hard_limit_buffer_pct < 10 ? "text-yellow-400" : "text-gray-300"}`}>{b.hard_limit_buffer_pct.toFixed(1)}%</span></span>
                </div>
              </div>
            );
          })()}

          {/* Drift Decomposition (v1 kept) */}
          {driftData.drift_decomposition && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-[11px]">
              <div className="bg-gray-800 rounded px-2 py-1.5">
                <div className="text-gray-500">Systematic drift/day</div>
                <div className="font-mono text-gray-300">{driftData.drift_decomposition.systematic_drift_per_day.toFixed(2)}%</div>
              </div>
              <div className="bg-gray-800 rounded px-2 py-1.5">
                <div className="text-gray-500">Idiosyncratic drift/day</div>
                <div className="font-mono text-gray-300">{driftData.drift_decomposition.idiosyncratic_drift_per_day.toFixed(2)}%</div>
              </div>
              <div className="bg-gray-800 rounded px-2 py-1.5">
                <div className="text-gray-500">BTC sensitivity</div>
                <div className="font-mono text-gray-300">{driftData.drift_decomposition.btc_sensitivity.toFixed(3)} β/1%</div>
              </div>
              <div className="bg-gray-800 rounded px-2 py-1.5">
                <div className="text-gray-500">24h: sys / idio</div>
                <div className="font-mono text-gray-300">
                  {driftData.drift_decomposition.recent_24h_systematic >= 0 ? "+" : ""}{driftData.drift_decomposition.recent_24h_systematic.toFixed(1)}% / {driftData.drift_decomposition.recent_24h_idiosyncratic >= 0 ? "+" : ""}{driftData.drift_decomposition.recent_24h_idiosyncratic.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Drift Statistics (v1 kept) */}
          <div className="overflow-x-auto mb-3">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 px-3">Drift Statistics (hourly, annualized to daily)</div>
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-1.5 text-left text-gray-500"></th>
                  <th className="px-3 py-1.5 text-right text-gray-500">Beta Net</th>
                  <th className="px-3 py-1.5 text-right text-gray-500">Gross %</th>
                  <th className="px-3 py-1.5 text-right text-gray-500">Net %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  { label: "Drift/day", key: "drift_per_day" as const, fmt: (v: number) => `${v.toFixed(2)}%` },
                  { label: "Drift vol", key: "drift_vol_per_day" as const, fmt: (v: number) => `${v.toFixed(2)}%` },
                  { label: "Weekend ×", key: "weekend_multiplier" as const, fmt: (v: number) => `${v.toFixed(2)}×` },
                  { label: "Kurtosis", key: "kurtosis" as const, fmt: (v: number) => v.toFixed(1) },
                  { label: "Autocorr", key: "drift_autocorr" as const, fmt: (v: number) => v.toFixed(3) },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-1.5 text-gray-400">{row.label}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-300">{row.fmt(driftData.drift_stats.beta_net[row.key])}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-300">{row.fmt(driftData.drift_stats.gross_pct[row.key])}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-300">{row.fmt(driftData.drift_stats.net_pct[row.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Time-to-Breach (v1 kept) */}
          <div className="overflow-x-auto mb-3">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 px-3">Time-to-Breach (Monte Carlo, {driftData.n_hours_analyzed}h analyzed)</div>
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-1.5 text-left text-gray-500">Threshold</th>
                  <th className="px-3 py-1.5 text-right text-gray-500">Median</th>
                  <th className="px-3 py-1.5 text-right text-gray-500">95th (fastest)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {Object.entries(driftData.time_to_breach).map(([key, ttb]) => {
                  const label = key.replace("_", " ±").replace("pct", "%").replace("_drift", " drift");
                  const urgent = ttb.p95_days < 3;
                  return (
                    <tr key={key}>
                      <td className="px-3 py-1.5 text-gray-400">{label}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-300">{ttb.median_days.toFixed(1)}d</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${urgent ? "text-red-400 font-bold" : "text-yellow-400"}`}>
                        {ttb.p95_days.toFixed(1)}d
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* GARCH + Crypto characteristics footer */}
          <div className="flex flex-wrap gap-4 px-3 pb-2 text-[10px] text-gray-600">
            {driftData.garch && driftData.garch.daily_vol_pct > 0 && (<>
              <span>GARCH vol: <span className={driftData.garch.vol_ratio > 1.2 ? "text-yellow-400" : "text-gray-400"}>{driftData.garch.daily_vol_pct.toFixed(2)}%/d</span></span>
              <span>Uncond: <span className="text-gray-400">{driftData.garch.unconditional_vol_pct.toFixed(2)}%</span></span>
              <span>Ratio: <span className={driftData.garch.vol_ratio > 1.2 ? "text-yellow-400" : "text-gray-400"}>{driftData.garch.vol_ratio.toFixed(2)}×</span></span>
              <span>α/β: <span className="text-gray-400">{driftData.garch.params.alpha.toFixed(2)}/{driftData.garch.params.beta.toFixed(2)}</span></span>
            </>)}
            <span>Weekend vol: <span className="text-gray-400">{driftData.crypto_characteristics.weekend_vol_premium.toFixed(2)}×</span></span>
            <span>Kurtosis: <span className="text-gray-400">{driftData.crypto_characteristics.empirical_kurtosis.toFixed(1)}</span></span>
            <span>AR(1): <span className="text-gray-400">{driftData.crypto_characteristics.drift_autocorrelation.toFixed(3)}</span></span>
            <span>t-df: <span className="text-gray-400">{driftData.crypto_characteristics.student_t_df.toFixed(0)}</span></span>
            {driftData.n_daily_observations > 0 && (
              <span>2Y obs: <span className="text-gray-400">{driftData.n_daily_observations}</span></span>
            )}
          </div>
        </Card>
      )}

      {/* ── Drawdown Gauge ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Drawdown ({ddSource})</CardTitle>
            <Badge
              variant={ddGaugePct > 80 ? "danger" : ddGaugePct > 50 ? "warning" : "success"}
            >
              {formatPct(-ddPct)} ({formatUSD(-ddUsd)}) / {formatPct(-stopPct)} stop
            </Badge>
          </div>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                ddGaugePct > 80
                  ? "bg-red-500"
                  : ddGaugePct > 50
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${ddGaugePct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>Distance to SL: {formatPct(stopPct - ddPct)}</span>
            <span>{formatPct(-stopPct)}</span>
          </div>

          {/* DD Views + Trim Tracking */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            {ntDd != null && (
              <div className="bg-gray-800/50 rounded px-2 py-1.5">
                <div className="text-gray-500">Nickel DD</div>
                <div className="text-gray-200 font-semibold">{formatPct(-ntDd)}</div>
              </div>
            )}
            <div className="bg-gray-800/50 rounded px-2 py-1.5">
              <div className="text-gray-500">Internal DD</div>
              <div className="text-gray-400 font-medium">{formatPct(-internalDd)}</div>
            </div>
            <div className="bg-gray-800/50 rounded px-2 py-1.5">
              <div className="text-gray-500">HWM</div>
              <div className="text-gray-400 font-medium">{formatUSD(risk.hwm)}</div>
            </div>
            <div className="bg-gray-800/50 rounded px-2 py-1.5">
              <div className="text-gray-500">Last Trim At</div>
              <div className="text-gray-200 font-medium">
                {r.last_trim_dd_pct > 0
                  ? formatPct(-r.last_trim_dd_pct)
                  : "None"}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded px-2 py-1.5">
              <div className="text-gray-500">Next Trim At</div>
              <div className="text-amber-400 font-medium">
                {formatPct(-(risk as any).next_trim_dd_pct)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Vol & Correlation Regime + Scale Breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vol Regime */}
        <Card>
          <CardHeader>
            <CardTitle>Volatility Regime</CardTitle>
          </CardHeader>
          <div className="space-y-2 text-xs">
            <Row label="BTC Fast Vol" value={risk.btc_fast_vol?.toFixed(4) ?? "—"} />
            <Row label="BTC Slow Vol" value={risk.btc_slow_vol?.toFixed(4) ?? "—"} />
            <Row label="Vol Ratio" value={risk.vol_ratio?.toFixed(3) ?? "—"} />
            <Row label="Vol Scale" value={risk.vol_scale?.toFixed(3) ?? "—"} />
            <Row label="Combined Vol Scale" value={risk.combined_vol_scale?.toFixed(3) ?? "—"} />
          </div>
        </Card>

        {/* Correlation Regime */}
        <Card>
          <CardHeader>
            <CardTitle>Correlation Regime</CardTitle>
          </CardHeader>
          {risk.correlation_regime ? (
            <div className="space-y-2 text-xs">
              <Row label="Regime" value={risk.correlation_regime.regime} />
              <Row
                label="Avg Pairwise Corr"
                value={risk.correlation_regime.avg_pairwise_corr.toFixed(3)}
              />
              <Row
                label="Danger Score"
                value={risk.correlation_regime.danger_score.toFixed(3)}
                valueColor={
                  risk.correlation_regime.danger_score > 0.7
                    ? "text-red-400"
                    : risk.correlation_regime.danger_score > 0.4
                      ? "text-yellow-400"
                      : "text-green-400"
                }
              />
            </div>
          ) : (
            <div className="text-xs text-gray-500">No correlation data</div>
          )}
        </Card>
      </div>

      {/* ── Effective Scale Breakdown ── */}
      <Card>
        <CardHeader>
          <CardTitle>Effective Scale Breakdown</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <div className="text-gray-500">DD Scale</div>
            <div className="text-gray-200 font-medium">{risk.dd_scale?.toFixed(3) ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-500">Vol Scale</div>
            <div className="text-gray-200 font-medium">{risk.vol_scale?.toFixed(3) ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-500">Recovery Scale</div>
            <div className="text-gray-200 font-medium">{risk.recovery_scale?.toFixed(3) ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-500">Effective Scale</div>
            <div className="text-gray-200 font-semibold">{risk.effective_scale?.toFixed(3) ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-500">Recovery Stage</div>
            <Badge
              variant={
                risk.recovery_stage === "NORMAL"
                  ? "success"
                  : risk.recovery_stage === "COOLDOWN"
                    ? "danger"
                    : "warning"
              }
            >
              {risk.recovery_stage || "NORMAL"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* ── DD Trim Schedule ── */}
      <Card>
        <CardHeader>
          <CardTitle>DD Trim Schedule</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="text-[10px] text-gray-500 mb-2">
            Formula: scale = (1 - DD / {stopPct}%)^0.5 | Trims every 1pp DD worsening | Source: {(risk as any).dd_source === "nt" ? "Nickel" : "Internal"}
          </div>
          <div className="grid grid-cols-10 gap-1 text-[10px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 9.5].map((dd) => {
              const scale = dd >= stopPct ? 0 : Math.pow(1 - dd / stopPct, 0.5);
              const isActive = Math.abs(ddPct - dd) < 0.5;
              const isPast = ddPct > dd;
              return (
                <div key={dd} className={`text-center rounded py-1 ${
                  isActive ? "bg-amber-900/50 border border-amber-500" :
                  isPast ? "bg-gray-800/80" : "bg-gray-800/30"
                }`}>
                  <div className="text-gray-400">{dd}%</div>
                  <div className={`font-medium ${scale === 0 ? "text-red-400" : scale < 0.5 ? "text-amber-400" : "text-gray-200"}`}>
                    {(scale * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
            <span>Current DD: {formatPct(-ddPct)}</span>
            <span>Scale: {((risk as any).dd_scale ?? 1).toFixed ? `${(((risk as any).dd_scale ?? 1) * 100).toFixed(1)}%` : "—"}</span>
            <span>Last trim: {(risk as any).last_trim_dd_pct > 0 ? formatPct(-(risk as any).last_trim_dd_pct) : "None"}</span>
            <span>Next trim at: {formatPct(-((risk as any).next_trim_dd_pct ?? 3.0))}</span>
          </div>
        </div>
      </Card>


      {/* ── ADL Monitor ── */}
      {adl && <AdlMonitor adl={adl} />}

      {/* ── Hedge Quality Analytics ── */}
      {hedgeData && hedgeData.kpis && <HedgeQualitySection data={hedgeData} />}

      {/* ── Stress Scenarios (LP_REPORTING gated) ── */}
      {stress && stress.scenarios && stress.scenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stress Scenarios</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 pt-0">
            {stress.scenarios.map((s) => (
              <div
                key={s.name}
                className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-200">{s.name}</span>
                  <span
                    className={`text-sm font-mono ${
                      s.estimated_pnl < 0 ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {formatUSD(s.estimated_pnl)} ({formatPct(s.estimated_pnl_pct)})
                  </span>
                </div>
                <div className="text-xs text-gray-500">{s.description}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {s.affected_positions} positions affected
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Reverse Stress ── */}
      {stress && stress.reverse_stress && stress.reverse_stress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reverse Stress Test</CardTitle>
          </CardHeader>
          <div className="space-y-2 p-4 pt-0 text-xs">
            {stress.reverse_stress.map((r) => (
              <div key={r.scenario} className="flex items-center justify-between">
                <span className="text-gray-300">{r.scenario}</span>
                <span className="text-red-400 font-mono">
                  {formatPct(r.move_required_pct)} move required
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Portfolio VaR ── */}
      {varData && varData.portfolio && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Value at Risk</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">Method</th>
                  <th className="px-3 py-2 text-right text-gray-500">95% VaR</th>
                  <th className="px-3 py-2 text-right text-gray-500">99% VaR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <tr>
                  <td className="px-3 py-2 text-gray-300">Historical</td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.historical_95_1d?.var_usd ?? varData.portfolio.historical_95)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.historical_99_1d?.var_usd ?? varData.portfolio.historical_99)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-300">Parametric</td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.parametric_95_1d?.var_usd ?? varData.portfolio.parametric_95)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.parametric_99_1d?.var_usd ?? varData.portfolio.parametric_99)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-300">CVaR (Expected Shortfall)</td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.cvar_95_1d?.cvar_usd ?? varData.portfolio.cvar_95)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.cvar_99_1d?.cvar_usd ?? varData.portfolio.cvar_99)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Component VaR ── */}
      {varData && (() => {
        const comps = varData.component ?? varData.components ?? [];
        return comps.length > 0 ? (
          <Collapsible title="Component VaR" count={comps.length}>
            <DataTable
              columns={componentVarColumns}
              data={comps}
              defaultSort="var_contribution"
              maxHeight="400px"
            />
          </Collapsible>
        ) : null;
      })()}

    </div>
  );
}

// ── Hedge Quality Section ──

const perShortColumns: Column<PerShortHedge>[] = [
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => <span className="font-medium text-gray-200">{r.symbol.replace("USDT", "")}</span>,
    sortKey: (r) => r.symbol,
  },
  {
    key: "beta",
    header: "Beta",
    render: (r) => <span className="font-mono text-gray-300">{r.beta.toFixed(3)}</span>,
    sortKey: (r) => r.beta,
    align: "right",
  },
  {
    key: "downside_beta",
    header: "DS Beta",
    render: (r) => <span className="font-mono text-gray-300">{r.downside_beta.toFixed(3)}</span>,
    sortKey: (r) => r.downside_beta,
    align: "right",
  },
  {
    key: "correlation",
    header: "Corr",
    render: (r) => <span className="font-mono text-gray-300">{r.correlation.toFixed(3)}</span>,
    sortKey: (r) => r.correlation,
    align: "right",
  },
  {
    key: "notional",
    header: "Notional",
    render: (r) => <span className="font-mono text-gray-300">{formatUSD(r.notional)}</span>,
    sortKey: (r) => r.notional,
    align: "right",
  },
  {
    key: "hedge_score",
    header: "Hedge Score",
    render: (r) => {
      const color = r.hedge_score >= 0.5 ? "text-green-400" : r.hedge_score >= 0.2 ? "text-yellow-400" : "text-red-400";
      return <span className={`font-mono font-semibold ${color}`}>{r.hedge_score.toFixed(3)}</span>;
    },
    sortKey: (r) => r.hedge_score,
    align: "right",
  },
  {
    key: "unrealized_pnl",
    header: "Unreal P&L",
    render: (r) => <span className={`font-mono ${pnlColor(r.unrealized_pnl)}`}>{formatUSD(r.unrealized_pnl)}</span>,
    sortKey: (r) => r.unrealized_pnl,
    align: "right",
  },
];

function heatmapColor(corr: number): string {
  // blue (-1) → white (0) → red (+1)
  const clamped = Math.max(-1, Math.min(1, corr));
  if (clamped >= 0) {
    const t = clamped;
    const r = 255;
    const g = Math.round(255 * (1 - t));
    const b = Math.round(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -clamped;
    const r = Math.round(255 * (1 - t));
    const g = Math.round(255 * (1 - t));
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}

function HedgeQualitySection({ data }: { data: HedgeQualityResponse }) {
  const { kpis } = data;
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const longCount = useMemo(
    () => data.correlation_heatmap.sides.filter((s) => s === "LONG").length,
    [data.correlation_heatmap.sides],
  );

  return (
    <>
      {/* ── Hedge Quality KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Down-Day Capture"
          value={`${kpis.down_day_capture_rate.toFixed(1)}%`}
          valueColor={kpis.down_day_capture_rate >= 60 ? "text-green-400" : kpis.down_day_capture_rate >= 40 ? "text-yellow-400" : "text-red-400"}
        />
        <KpiCard
          label="Beta Hedge Ratio"
          value={`${kpis.beta_hedge_ratio_pct.toFixed(1)}%`}
          valueColor={
            kpis.beta_hedge_ratio_pct >= 90 && kpis.beta_hedge_ratio_pct <= 110
              ? "text-green-400"
              : kpis.beta_hedge_ratio_pct >= 80 && kpis.beta_hedge_ratio_pct <= 120
                ? "text-yellow-400"
                : "text-red-400"
          }
          sub="Target: 100%"
        />
        <KpiCard
          label="Net Beta Exposure"
          value={`${Math.abs(kpis.net_beta_pct).toFixed(1)}%`}
          sub={formatUSD(kpis.net_beta_usd)}
          valueColor={Math.abs(kpis.net_beta_pct) < 5 ? "text-green-400" : Math.abs(kpis.net_beta_pct) < 15 ? "text-yellow-400" : "text-red-400"}
        />
        <KpiCard
          label="Tracking Error"
          value={`${kpis.tracking_error_ann.toFixed(1)}%`}
          sub="Annualized"
        />
        <KpiCard
          label="Information Ratio"
          value={kpis.information_ratio.toFixed(2)}
          valueColor={kpis.information_ratio > 0.5 ? "text-green-400" : kpis.information_ratio > 0 ? "text-yellow-400" : "text-red-400"}
        />
        <KpiCard
          label="DS Beta Ratio"
          value={kpis.downside_beta_ratio.toFixed(2)}
          valueColor={
            kpis.downside_beta_ratio >= 0.8 && kpis.downside_beta_ratio <= 1.2
              ? "text-green-400"
              : kpis.downside_beta_ratio >= 0.6 && kpis.downside_beta_ratio <= 1.4
                ? "text-yellow-400"
                : "text-red-400"
          }
          sub="DS / Symmetric"
        />
      </div>

      {/* ── Rolling Hedge Ratio Chart ── */}
      {data.rolling_hedge_ratio.length > 0 && (
        <ChartContainer title="Rolling Hedge Ratio" height={250}>
          <LineChart data={data.rolling_hedge_ratio}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: "#888" }} domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid #333", fontSize: 12 }}
              formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, "Hedge Ratio"]}
              labelFormatter={(l) => `Date: ${l}`}
            />
            <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="6 3" label={{ value: "100% Target", fill: "#22c55e", fontSize: 10 }} />
            <Line type="monotone" dataKey="hedge_ratio_pct" stroke="#3b82f6" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      )}

      {/* ── Per-Short Hedge Contribution Table ── */}
      {data.per_short_hedge.length > 0 && (
        <Collapsible title="Per-Short Hedge Contribution" count={data.per_short_hedge.length}>
          <DataTable
            columns={perShortColumns}
            data={data.per_short_hedge}
            defaultSort="hedge_score"
            defaultDir="desc"
            maxHeight="max-h-[400px]"
          />
        </Collapsible>
      )}

      {/* ── Correlation Heatmap ── */}
      {data.correlation_heatmap.symbols.length > 0 && (
        <Collapsible title="Position Correlation Heatmap" count={data.correlation_heatmap.symbols.length}>
          <div className="overflow-x-auto">
            <div className="inline-block">
              {/* Column headers */}
              <div className="flex" style={{ marginLeft: 60 }}>
                {data.correlation_heatmap.symbols.map((sym, j) => (
                  <div
                    key={j}
                    className="text-[8px] text-gray-500 overflow-hidden"
                    style={{
                      width: 20,
                      height: 50,
                      transform: "rotate(-45deg)",
                      transformOrigin: "bottom left",
                      whiteSpace: "nowrap",
                      marginLeft: j === longCount && longCount > 0 ? 2 : 0,
                    }}
                  >
                    {sym.replace("USDT", "")}
                  </div>
                ))}
              </div>
              {/* Rows */}
              {data.correlation_heatmap.matrix.map((row, i) => (
                <div key={i} className="flex items-center" style={{ marginTop: i === longCount && longCount > 0 ? 2 : 0 }}>
                  <div className="text-[8px] text-gray-500 w-[60px] text-right pr-1 truncate">
                    {data.correlation_heatmap.symbols[i].replace("USDT", "")}
                  </div>
                  {row.map((corr, j) => (
                    <div
                      key={j}
                      className="relative cursor-crosshair"
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: i === j ? "#333" : heatmapColor(corr),
                        marginLeft: j === longCount && longCount > 0 ? 2 : 0,
                      }}
                      onMouseEnter={() => setHoveredCell({ row: i, col: j })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {hoveredCell?.row === i && hoveredCell?.col === j && (
                        <div className="absolute z-10 -top-8 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200 whitespace-nowrap">
                          {data.correlation_heatmap.symbols[i].replace("USDT", "")} / {data.correlation_heatmap.symbols[j].replace("USDT", "")}: {corr.toFixed(3)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-500">
                <span>-1</span>
                <div className="flex h-3">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} style={{ width: 8, backgroundColor: heatmapColor(-1 + (i / 19) * 2) }} />
                  ))}
                </div>
                <span>+1</span>
                <span className="ml-2">|</span>
                <span className="ml-2">L = Long, S = Short</span>
              </div>
            </div>
          </div>
        </Collapsible>
      )}

      {/* ── L/S Basket Correlation Trend ── */}
      {data.ls_correlation_trend.series.length > 0 && (
        <ChartContainer title="L/S Basket Correlation Trend" height={200}>
          <LineChart data={data.ls_correlation_trend.series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: "#888" }} domain={[-0.5, 1.0]} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid #333", fontSize: 12 }}
              formatter={(v: unknown) => [v != null ? Number(v).toFixed(3) : "—"]}
              labelFormatter={(l) => `Date: ${l}`}
            />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="corr_7d" stroke="#f97316" dot={false} strokeWidth={2} name="7d Corr" connectNulls />
            <Line type="monotone" dataKey="corr_30d" stroke="#3b82f6" dot={false} strokeWidth={2} name="30d Corr" connectNulls />
          </LineChart>
        </ChartContainer>
      )}
    </>
  );
}

function Row({
  label,
  value,
  valueColor = "text-gray-200",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
