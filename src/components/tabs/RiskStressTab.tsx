import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
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
            <span>Next trim at: {formatPct(-(((risk as any).last_trim_dd_pct ?? 0) + 1.0))}</span>
          </div>
        </div>
      </Card>

      {/* ── Exit Methodology ── */}
      {risk.exit_methodology && (
        <Card>
          <CardHeader>
            <CardTitle>Exit Methodology</CardTitle>
          </CardHeader>
          {(() => {
            const em = risk.exit_methodology as any;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-gray-500">Long TP</div>
                  <div className="text-gray-200 font-medium">{em.long_tp_vol_multiple ?? em.tp_vol_multiple ?? "—"}x vol ({em.tp_min_pct ?? 0}–{em.tp_max_pct ?? 20}%)</div>
                </div>
                <div>
                  <div className="text-gray-500">Short TP</div>
                  <div className="text-gray-200 font-medium">{em.short_tp_vol_multiple ?? em.tp_vol_multiple ?? "—"}x vol ({em.tp_min_pct ?? 0}–{em.tp_max_pct ?? 20}%)</div>
                </div>
                <div>
                  <div className="text-gray-500">Emergency SL</div>
                  <div className="text-gray-200 font-medium">{em.emergency_sl_pct ?? 25}%</div>
                </div>
                <div>
                  <div className="text-gray-500">Max Hold (Short)</div>
                  <div className="text-gray-200 font-medium">{em.short_max_hold_hours ?? 720}h</div>
                </div>
                <div>
                  <div className="text-gray-500">Rebalance Every</div>
                  <div className="text-gray-200 font-medium">{em.rebalance_every_hours ?? 72}h</div>
                </div>
                <div>
                  <div className="text-gray-500">Regime Exit Width</div>
                  <div className="text-gray-200 font-medium">{em.regime_exit_width ?? 1.0}x</div>
                </div>
              </div>
            );
          })()}
        </Card>
      )}

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
