import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { DataTable, type Column } from "../shared/DataTable";
import { AdlMonitor } from "../overview/AdlMonitor";
import { formatUSD, formatPct } from "../../lib/utils";
import type { AdlData } from "../../types/api";

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
  var_contribution: number;
  var_pct: number;
}

interface VarResponse {
  portfolio: {
    historical_95: number;
    historical_99: number;
    parametric_95: number;
    parametric_99: number;
    cvar_95: number;
    cvar_99: number;
  };
  components: ComponentVar[];
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
      <span className="text-red-400 font-mono">{formatUSD(r.var_contribution)}</span>
    ),
    sortKey: (r) => r.var_contribution,
    align: "right",
  },
  {
    key: "var_pct",
    header: "VaR %",
    render: (r) => (
      <span className="text-red-400 font-mono">{formatPct(r.var_pct)}</span>
    ),
    sortKey: (r) => r.var_pct,
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

  if (riskLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading risk data...
      </div>
    );
  }

  if (!risk) return null;

  const ddPct = Math.abs(risk.dd_pct);
  const stopPct = Math.abs(risk.limits.dd_stop_pct);
  const ddGaugePct = stopPct > 0 ? Math.min((ddPct / stopPct) * 100, 100) : 0;

  return (
    <div className="space-y-4 p-4">
      {/* ── Drawdown Gauge ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Drawdown</CardTitle>
            <Badge
              variant={ddGaugePct > 80 ? "danger" : ddGaugePct > 50 ? "warning" : "success"}
            >
              {formatPct(-ddPct)} / {formatPct(-stopPct)} stop
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
            <span>Distance to SL: {formatPct(risk.distance_to_sl_pct)}</span>
            <span>{formatPct(-stopPct)}</span>
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
            <Row label="Vol Scale" value={risk.vol_scale.toFixed(3)} />
            <Row label="Combined Vol Scale" value={risk.combined_vol_scale.toFixed(3)} />
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
            <div className="text-gray-200 font-medium">{risk.dd_scale.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-gray-500">Vol Scale</div>
            <div className="text-gray-200 font-medium">{risk.vol_scale.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-gray-500">Recovery Scale</div>
            <div className="text-gray-200 font-medium">{risk.recovery_scale?.toFixed(3) ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-500">Effective Scale</div>
            <div className="text-gray-200 font-semibold">{risk.effective_scale.toFixed(3)}</div>
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

      {/* ── Exit Methodology ── */}
      {risk.exit_methodology && (
        <Card>
          <CardHeader>
            <CardTitle>Exit Methodology</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs">
            <div>
              <div className="text-gray-500">Take Profit</div>
              <div className="text-gray-200 font-medium">
                {formatPct(risk.exit_methodology.tp_pct)}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Stop Loss</div>
              <div className="text-gray-200 font-medium">
                {formatPct(-risk.exit_methodology.sl_pct)}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Trailing TP</div>
              <Badge variant={risk.exit_methodology.trailing_tp ? "success" : "default"}>
                {risk.exit_methodology.trailing_tp ? "ON" : "OFF"}
              </Badge>
            </div>
            <div>
              <div className="text-gray-500">Vol SL</div>
              <Badge variant={risk.exit_methodology.vol_sl_enabled ? "success" : "default"}>
                {risk.exit_methodology.vol_sl_enabled ? "ON" : "OFF"}
              </Badge>
            </div>
            <div>
              <div className="text-gray-500">Vol SL Mult</div>
              <div className="text-gray-200 font-medium">
                {risk.exit_methodology.vol_sl_multiplier.toFixed(1)}x
              </div>
            </div>
            <div>
              <div className="text-gray-500">Cooldown</div>
              <div className="text-gray-200 font-medium">
                {risk.exit_methodology.cooldown_hours}h
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── ADL Monitor ── */}
      {adl && <AdlMonitor adl={adl} />}

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
                    {formatUSD(varData.portfolio.historical_95)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.historical_99)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-300">Parametric</td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.parametric_95)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.parametric_99)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-300">CVaR (Expected Shortfall)</td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.cvar_95)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">
                    {formatUSD(varData.portfolio.cvar_99)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Component VaR ── */}
      {varData && varData.components && varData.components.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Component VaR ({varData.components.length})</CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <DataTable
              columns={componentVarColumns}
              data={varData.components}
              defaultSort="var_contribution"
              maxHeight="400px"
            />
          </div>
        </Card>
      )}
    </div>
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
