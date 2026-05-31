import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { ChartContainer } from "../../shared/ChartContainer";
import { useMacroICRolling } from "../../../hooks/useMacroRegime";

/**
 * Per-indicator drill-down — rolling IC trajectory + score history +
 * sign-stability summary. Reuses the backend's /api/macro_regime/ic-rolling
 * endpoint (server-side rolling Spearman IC reusing the macro_ic plumbing
 * so the dashboard doesn't recompute anything client-side).
 *
 * Driven by `initialKey` from the IC Heatmap click-through. When opened
 * cold (no preselection) a search box lets the operator pick an indicator.
 */
const HORIZONS = [7, 30, 90] as const;
const DEPENDENTS = [
  "nav_sortino",
  "nav_sharpe",
  "btc_return",
  "btc_sortino",
  "tokenized_stock_return",
  "tokenized_metal_return",
  "tokenized_commodity_return",
  "tokenized_etf_return",
] as const;

export interface IndicatorDrilldownSubTabProps {
  initialKey?: string;
  initialDependent?: string;
  initialHorizon?: 7 | 30 | 90;
  onClear?: () => void;
}

export function IndicatorDrilldownSubTab({
  initialKey,
  initialDependent = "nav_sortino",
  initialHorizon = 30,
  onClear,
}: IndicatorDrilldownSubTabProps) {
  const [indicatorKey, setIndicatorKey] = useState<string>(initialKey ?? "");
  const [dependent, setDependent] = useState<string>(initialDependent);
  const [horizon, setHorizon] = useState<7 | 30 | 90>(initialHorizon);
  const [lookback, setLookback] = useState<number>(180);

  const { data, isLoading } = useMacroICRolling(
    indicatorKey || undefined,
    dependent,
    horizon,
    lookback,
    /* enabled */ Boolean(indicatorKey),
  );

  // Rolling IC chart data — server provides one row per IC compute.
  const icChartData = useMemo(() => {
    if (!data?.ic_history) return [];
    return data.ic_history.map((r) => ({
      date: r.computed_at?.slice(0, 10) ?? "",
      ic: r.ic_value,
      n: r.n_observations,
      hit: r.hit_rate,
    }));
  }, [data]);

  // Score history chart — one row per daily snapshot from
  // macro_indicator_history.
  const scoreChartData = useMemo(() => {
    if (!data?.score_history) return [];
    return data.score_history.map((r) => ({
      date: r.date?.slice(0, 10) ?? "",
      score: r.score,
    }));
  }, [data]);

  // Sign-stability summary — % of IC samples that share the dominant sign.
  const signStability = useMemo(() => {
    if (!data?.ic_history?.length) return null;
    const signs = data.ic_history
      .map((r) => (r.ic_value == null ? 0 : (r.ic_value >= 0 ? 1 : -1)))
      .filter((s) => s !== 0);
    if (!signs.length) return null;
    const pos = signs.filter((s) => s > 0).length;
    const neg = signs.length - pos;
    const dom = Math.max(pos, neg);
    return {
      total: signs.length,
      positive: pos,
      negative: neg,
      dominantPct: (dom / signs.length) * 100,
      direction: pos >= neg ? "positive" : "negative",
    };
  }, [data]);

  const latestIc = data?.ic_history?.[data.ic_history.length - 1];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              Indicator drill-down
              {indicatorKey && (
                <span className="ml-3 text-xs font-normal text-purple-300">
                  · {indicatorKey}
                </span>
              )}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <input
                value={indicatorKey}
                onChange={(e) => setIndicatorKey(e.target.value.trim())}
                placeholder="indicator_key (e.g. fear_greed_alt)"
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1 w-64 text-xs"
              />
              <label className="text-gray-500">
                Dep:{" "}
                <select
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1"
                  value={dependent}
                  onChange={(e) => setDependent(e.target.value)}
                >
                  {DEPENDENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-1">
                {HORIZONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={`px-2 py-1 rounded border ${
                      horizon === h
                        ? "bg-purple-500/20 border-purple-500 text-purple-300"
                        : "border-[var(--border)] text-gray-400 hover:text-purple-300"
                    }`}
                  >
                    {h}d
                  </button>
                ))}
              </div>
              <label className="text-gray-500">
                Lookback:{" "}
                <select
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1"
                  value={lookback}
                  onChange={(e) => setLookback(Number(e.target.value))}
                >
                  <option value={90}>90d</option>
                  <option value={180}>180d</option>
                  <option value={365}>365d</option>
                </select>
              </label>
              {onClear && indicatorKey && (
                <button
                  onClick={() => { setIndicatorKey(""); onClear(); }}
                  className="text-gray-500 hover:text-gray-300"
                >
                  ✕ clear
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        {!indicatorKey && (
          <div className="px-4 pb-4 text-xs text-gray-500">
            Type an indicator_key above, or click a cell in the IC Heatmap to
            land here pre-filtered.
          </div>
        )}
      </Card>

      {indicatorKey && isLoading && (
        <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
          Loading IC rolling history for {indicatorKey}...
        </div>
      )}

      {indicatorKey && data && (
        <>
          {/* Summary KPI bar */}
          <Card>
            <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-gray-500">Latest IC</div>
                <div className={`text-lg font-mono ${
                  latestIc?.ic_value != null
                    ? (latestIc.ic_value > 0 ? "text-green-400" : "text-red-400")
                    : "text-gray-600"
                }`}>
                  {latestIc?.ic_value != null
                    ? `${latestIc.ic_value >= 0 ? "+" : ""}${latestIc.ic_value.toFixed(3)}`
                    : "—"}
                </div>
                <div className="text-[10px] text-gray-600">
                  n={latestIc?.n_observations ?? 0} · hit={(latestIc?.hit_rate ?? 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Sign stability</div>
                <div className="text-lg font-mono text-gray-200">
                  {signStability ? `${signStability.dominantPct.toFixed(0)}%` : "—"}
                </div>
                <div className="text-[10px] text-gray-600">
                  {signStability
                    ? `${signStability.direction} · ${signStability.positive}/${signStability.total} ticks`
                    : ""}
                </div>
              </div>
              <div>
                <div className="text-gray-500">IC samples</div>
                <div className="text-lg font-mono text-gray-200">
                  {data.ic_history.length}
                </div>
                <div className="text-[10px] text-gray-600">
                  lookback {lookback}d
                </div>
              </div>
              <div>
                <div className="text-gray-500">Score samples</div>
                <div className="text-lg font-mono text-gray-200">
                  {data.score_history.length}
                </div>
                <div className="text-[10px] text-gray-600">
                  daily snapshots
                </div>
              </div>
            </div>
          </Card>

          {/* Rolling IC chart */}
          {icChartData.length > 0 && (
            <ChartContainer
              title={`Rolling IC vs ${dependent}_${horizon}d`}
              height={260}
            >
              <LineChart data={icChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  domain={[-0.5, 0.5]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="2 2" />
                <ReferenceLine y={0.10} stroke="#22c55e" strokeDasharray="2 4" label={{ value: "flip+", fill: "#22c55e", fontSize: 9 }} />
                <ReferenceLine y={-0.10} stroke="#ef4444" strokeDasharray="2 4" label={{ value: "flip−", fill: "#ef4444", fontSize: 9 }} />
                <Line
                  type="monotone"
                  dataKey="ic"
                  name="IC"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ChartContainer>
          )}

          {/* Score history chart */}
          {scoreChartData.length > 0 && (
            <ChartContainer
              title={`${indicatorKey} score history`}
              height={220}
            >
              <LineChart data={scoreChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="2 2" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}

          {/* IC sample distribution (n vs ic scatter) */}
          {icChartData.length > 5 && (
            <ChartContainer
              title="IC magnitude vs sample size (each dot = one daily IC compute)"
              height={220}
            >
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="n"
                  name="n_observations"
                  type="number"
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                />
                <YAxis
                  dataKey="ic"
                  name="ic"
                  domain={[-0.5, 0.5]}
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="2 2" />
                <Scatter data={icChartData} fill="#a855f7" />
              </ScatterChart>
            </ChartContainer>
          )}

          {/* Review checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Review checklist</CardTitle>
            </CardHeader>
            <div className="px-4 pb-4 space-y-2 text-xs">
              {(() => {
                const n = latestIc?.n_observations ?? 0;
                const icMag = Math.abs(latestIc?.ic_value ?? 0);
                const stab = signStability?.dominantPct ?? 0;
                const items = [
                  {
                    label: `Sample size n ≥ 60`,
                    passed: n >= 60,
                    detail: `current n = ${n}`,
                  },
                  {
                    label: `|IC| > 0.10 (flip threshold)`,
                    passed: icMag > 0.10,
                    detail: `|IC| = ${icMag.toFixed(3)}`,
                  },
                  {
                    label: `Sign-stability > 70%`,
                    passed: stab > 70,
                    detail: `stability = ${stab.toFixed(0)}%`,
                  },
                  {
                    label: `|IC| > 0.15 (graduation threshold)`,
                    passed: icMag > 0.15,
                    detail: `|IC| = ${icMag.toFixed(3)}`,
                  },
                ];
                return items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className={it.passed ? "text-green-400" : "text-gray-500"}>
                      {it.passed ? "✓" : "○"} {it.label}
                    </span>
                    <span className="font-mono text-gray-500">{it.detail}</span>
                  </div>
                ));
              })()}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
