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
import { useEngine } from "../../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { ChartContainer } from "../../shared/ChartContainer";

// Types kept local since they are only consumed here.
interface GeopolMarketLeg {
  source: string;
  event_slug: string;
  market_slug: string;
  label: string;
  side: string;
  end_date: string;
  prob_yes: number;
  peace_prob: number;
  volume_24h_usd: number;
  liquidity_usd: number;
  used: boolean;
  skip_reason: string;
}

interface GeopolDetails {
  mean_peace_prob: number;
  n_used: number;
  n_total: number;
  baseline: number;
  breakdown: GeopolMarketLeg[];
  confidence?: "high" | "low";
}

interface Indicator {
  key: string;
  label: string;
  category: string;
  type: string;
  weight: number;
  description: string;
  score: number | null;
  raw_value: number | string | null;
  details?: GeopolDetails;
}

interface MacroICEntry {
  ic_value: number | null;
  hit_rate: number | null;
  n_observations: number | null;
  lookback_days: number | null;
  classification: string;
}

interface MacroICIndicator {
  key: string;
  label: string;
  category: string;
  weight: number;
  type: string;
  ic: Record<string, MacroICEntry>;
}

interface MacroICResponse {
  indicators: MacroICIndicator[];
  last_computed: string | null;
  horizons: number[];
  dependents: string[];
  primary_dependent: string;
  primary_horizon: number;
}

interface ChartPoint {
  timestamp: string;
  composite_score: number;
  regime: string;
  axis_b_score?: number | null;
  quadrant?: string | null;
}

interface AxisBSubsignal {
  key: string;
  label: string;
  tilt: number | null;
  score: number | null;
  weight: number;
}

interface QuadrantDef {
  label: string;
  color: string;
  description: string;
}

interface MacroRegimeResponse {
  composite_score: number;
  regime: string;
  regime_label: string;
  regime_color: string;
  indicators: Indicator[];
  chart: ChartPoint[];
  regime_thresholds: Record<string, [number, number]>;
  sources_available: number;
  sources_total: number;
  axis_b_score: number | null;
  axis_b_subsignals: AxisBSubsignal[];
  quadrant: string | null;
  quadrant_label: string | null;
  quadrant_color: string | null;
  quadrant_definitions: Record<string, QuadrantDef>;
  error?: string;
}

interface RiskSnapshot {
  net_pct_notional?: number;
  net_beta_pct_notional?: number;
  error?: string;
}

const QUADRANT_GRID: string[] = [
  "risk_off_alt_led",
  "risk_on_alt_led",
  "risk_off_btc_led",
  "risk_on_btc_led",
];

export function OverviewSubTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<MacroRegimeResponse>({
    queryKey: ["macro-regime", engine.id],
    queryFn: () => client.get("/api/macro_regime"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const { data: risk } = useQuery<RiskSnapshot>({
    queryKey: ["macro-regime-risk", engine.id],
    queryFn: () => client.get("/api/risk"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const { data: macroIC } = useQuery<MacroICResponse>({
    queryKey: ["macro-ic", engine.id],
    queryFn: () => client.get("/api/macro-ic"),
    refetchInterval: 300_000,
    staleTime: 180_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading macro regime data...
      </div>
    );
  }
  if (!data) return null;
  if (data.error === "pending") {
    return (
      <Card className="flex flex-col items-center justify-center h-64">
        <div className="text-lg font-medium text-yellow-400">Macro Data Pending</div>
        <div className="text-sm text-gray-500 mt-2">
          Indicators are still being fetched. Check back shortly.
        </div>
      </Card>
    );
  }

  const regimeColor = data.regime_color || "#6b7280";
  const chartData = (data.chart || []).map((p) => ({
    ...p,
    date: p.timestamp?.slice(5, 10) || "",
  }));
  const hasAxisB = data.axis_b_score != null && data.quadrant != null;
  const axisB = data.axis_b_score ?? 50;
  const quadDefs = data.quadrant_definitions || {};
  const netNotional = risk && !risk.error ? risk.net_pct_notional : undefined;
  const netBeta = risk && !risk.error ? risk.net_beta_pct_notional : undefined;
  const hasAxisBChart = chartData.some((p) => p.axis_b_score != null);

  return (
    <div className="space-y-4">
      {/* Composite Score + Axis B + Regime Badge */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Macro Regime</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {data.sources_available}/{data.sources_total} sources
              </span>
              <Badge
                variant="default"
                className="text-sm px-3 py-1"
                style={{ backgroundColor: regimeColor + "22", color: regimeColor, borderColor: regimeColor + "44" }}
              >
                {data.regime_label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="flex items-center gap-8">
            <div>
              <div className="text-4xl font-bold" style={{ color: regimeColor }}>
                {data.composite_score.toFixed(1)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">
                Axis A · Composite
              </div>
            </div>
            {hasAxisB && (
              <div>
                <div className="text-4xl font-bold" style={{ color: data.quadrant_color || "#6b7280" }}>
                  {axisB.toFixed(1)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">
                  Axis B · Alt-Leadership
                </div>
              </div>
            )}
            <div className="text-xs text-gray-500 space-y-0.5">
              {Object.entries(data.regime_thresholds || {}).map(([name, [lo, hi]]) => (
                <div key={name}>{name}: {lo}–{hi}</div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Quadrant + Sub-Signals */}
      {hasAxisB && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Regime Quadrant</CardTitle>
              <Badge
                variant="default"
                className="text-sm px-3 py-1"
                style={{
                  backgroundColor: (data.quadrant_color || "#6b7280") + "22",
                  color: data.quadrant_color || "#6b7280",
                  borderColor: (data.quadrant_color || "#6b7280") + "44",
                }}
              >
                {data.quadrant_label}
              </Badge>
            </div>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-6">
              <div className="relative" style={{ width: 320, height: 220 }}>
                <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
                  {QUADRANT_GRID.map((key) => {
                    const def = quadDefs[key];
                    const active = key === data.quadrant;
                    const color = def?.color || "#6b7280";
                    return (
                      <div
                        key={key}
                        className="flex flex-col items-center justify-center rounded text-center px-2"
                        style={{
                          backgroundColor: active ? color + "33" : "var(--bg-card-hover)",
                          border: `1px solid ${active ? color : "var(--border)"}`,
                        }}
                      >
                        <div className="text-xs font-semibold" style={{ color: active ? color : "#9ca3af" }}>
                          {def?.label || key}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="absolute w-3 h-3 rounded-full border-2 border-white"
                  style={{
                    backgroundColor: data.quadrant_color || "#6b7280",
                    left: `calc(${Math.max(0, Math.min(100, data.composite_score))}% - 6px)`,
                    top: `calc(${Math.max(0, Math.min(100, 100 - axisB))}% - 6px)`,
                  }}
                />
                <div className="absolute -bottom-5 left-0 text-[10px] text-gray-500">◀ Risk-Off</div>
                <div className="absolute -bottom-5 right-0 text-[10px] text-gray-500">Risk-On ▶</div>
              </div>
              <div className="flex-1 min-w-[220px] space-y-3 text-xs">
                <div className="text-gray-400">
                  {data.quadrant ? quadDefs[data.quadrant]?.description : ""}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border border-[var(--border)] p-2">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Net Beta (β-space)</div>
                    <div className="text-lg font-mono text-gray-200">
                      {netBeta != null ? `${netBeta >= 0 ? "+" : ""}${netBeta.toFixed(2)}%` : "—"}
                    </div>
                  </div>
                  <div className="rounded border border-[var(--border)] p-2">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Net Notional (cap ±30%)</div>
                    <div className="text-lg font-mono text-gray-200">
                      {netNotional != null ? `${netNotional >= 0 ? "+" : ""}${netNotional.toFixed(2)}%` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Indicator Table — with IC column + confidence badge */}
      <Card>
        <CardHeader>
          <CardTitle>
            Indicators ({data.indicators?.length || 0})
            {macroIC?.last_computed && (
              <span className="ml-3 text-xs font-normal text-gray-500">
                IC vs {macroIC.primary_dependent}_{macroIC.primary_horizon}d ·
                computed {new Date(macroIC.last_computed).toLocaleString()}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Indicator</th>
                <th className="px-3 py-2 text-left text-gray-500">Category</th>
                <th className="px-3 py-2 text-right text-gray-500">Raw</th>
                <th className="px-3 py-2 text-right text-gray-500">Score</th>
                <th className="px-3 py-2 text-right text-gray-500">Weight</th>
                <th className="px-3 py-2 text-center text-gray-500">Conf.</th>
                <th className="px-3 py-2 text-right text-gray-500" title="IC vs NAV-Sortino-30d.">
                  IC (Sortino 30d)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {(data.indicators || []).map((ind) => {
                const icEntry = macroIC?.indicators
                  .find((i) => i.key === ind.key)
                  ?.ic[`${macroIC.primary_dependent}_${macroIC.primary_horizon}d`];
                const icVal = icEntry?.ic_value;
                const icN = icEntry?.n_observations ?? 0;
                const cls = icEntry?.classification ?? "insufficient_data";
                const icColor =
                  cls === "strong" ? "text-green-400"
                  : cls === "weak" ? "text-red-400"
                  : cls === "neutral" ? "text-yellow-400"
                  : "text-gray-600";
                const conf = ind.details?.confidence;
                return (
                  <tr key={ind.key} className="hover:bg-[var(--bg-card-hover)]">
                    <td className="px-3 py-2 text-gray-200">{ind.label}</td>
                    <td className="px-3 py-2 text-gray-500">{ind.category}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-300">
                      {ind.raw_value != null ? String(ind.raw_value) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${
                      ind.score != null
                        ? ind.score >= 60 ? "text-green-400" : ind.score <= 40 ? "text-red-400" : "text-yellow-400"
                        : "text-gray-600"
                    }`}>
                      {ind.score != null ? ind.score.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{ind.weight}</td>
                    <td className="px-3 py-2 text-center">
                      {conf ? (
                        <Badge variant={conf === "high" ? "default" : "warning"}>{conf}</Badge>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${icColor}`} title={`classification=${cls}, n=${icN}`}>
                      {icVal != null
                        ? `${icVal >= 0 ? "+" : ""}${icVal.toFixed(3)} (n=${icN})`
                        : <span className="text-gray-600">N/A (n={icN})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Composite Chart */}
      {chartData.length > 0 && (
        <ChartContainer title="Composite Score (30d)" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <ReferenceLine y={55} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Bull", fill: "#22c55e", fontSize: 10 }} />
            <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Bear", fill: "#ef4444", fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="composite_score"
              name="Axis A (composite)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            {hasAxisBChart && (
              <Line
                type="monotone"
                dataKey="axis_b_score"
                name="Axis B (alt-leadership)"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
