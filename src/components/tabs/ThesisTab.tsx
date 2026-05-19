import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ErrorBar,
  ReferenceLine,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ChartContainer } from "../shared/ChartContainer";

interface SpreadRow {
  period: string;
  longs_pct: number;
  shorts_pct: number;
  spread_pct: number;
  working: boolean;
}

interface TokenReturn {
  symbol: string;
  "1d": number | null;
  "7d": number | null;
  "14d": number | null;
  "30d": number | null;
  "60d": number | null;
  "90d": number | null;
  YTD: number | null;
  "1Y": number | null;
}

interface PeriodStat {
  period: string;
  n_obs: number;
  cum_spread_pct: number | null;
  vol_ann_pct: number | null;
  sharpe: number | null;
  t_stat: number | null;
  significant: boolean;
  beta_ls: number | null;
  beta_adj_spread_pct: number | null;
  ci_half_width_pct: number | null;
}

interface RollingSharpePoint {
  date: string;
  sharpe: number;
  vol_ann: number;
}

interface ThesisResponse {
  timestamp: string;
  long_count: number;
  short_count: number;
  spread_table: SpreadRow[];
  levered_spread_table?: SpreadRow[];
  leverage?: number;
  working_count: number;
  total_periods: number;
  long_tokens: TokenReturn[];
  short_tokens: TokenReturn[];
  kingmaker: {
    name: string;
    thesis: string;
    long_alignment_pct: number;
    short_alignment_pct: number;
    categories: Record<string, string[]>;
    n_longs: number;
    n_shorts: number;
  };
  period_stats?: PeriodStat[];
  rolling_sharpe_30d?: RollingSharpePoint[];
  spread_table_ex_scams?: SpreadRow[];
  levered_spread_table_ex_scams?: SpreadRow[];
  period_stats_ex_scams?: PeriodStat[];
  rolling_sharpe_30d_ex_scams?: RollingSharpePoint[];
  ex_scam_symbols?: string[];
  short_count_ex_scams?: number;
  working_count_ex_scams?: number;
}

const PERIODS = ["1d", "7d", "14d", "30d", "60d", "90d", "YTD", "1Y"] as const;

export function ThesisTab() {
  const [levered, setLevered] = React.useState(false);
  const [exScams, setExScams] = React.useState(false);
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<ThesisResponse>({
    queryKey: ["thesis", engine.id],
    queryFn: () => client.get("/api/thesis"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading thesis data...
      </div>
    );
  }

  if (!data) return null;

  const hasExScams = (data.spread_table_ex_scams?.length ?? 0) > 0;
  const useExScams = exScams && hasExScams;

  const baseTable = useExScams && data.spread_table_ex_scams
    ? data.spread_table_ex_scams
    : data.spread_table;
  const baseLeveredTable = useExScams && data.levered_spread_table_ex_scams
    ? data.levered_spread_table_ex_scams
    : data.levered_spread_table;
  const activePeriodStats = useExScams && data.period_stats_ex_scams
    ? data.period_stats_ex_scams
    : (data.period_stats ?? []);
  const activeRollingSharpe = useExScams && data.rolling_sharpe_30d_ex_scams
    ? data.rolling_sharpe_30d_ex_scams
    : (data.rolling_sharpe_30d ?? []);
  const activeWorkingCount = useExScams && data.working_count_ex_scams != null
    ? data.working_count_ex_scams
    : data.working_count;
  const activeTotalPeriods = baseTable.length;

  const activeTable = levered && baseLeveredTable ? baseLeveredTable : baseTable;

  // Merge per-period stats into each row so error bars + stats columns align
  const statsByPeriod = new Map<string, PeriodStat>(
    activePeriodStats.map((s) => [s.period, s]),
  );
  const leverageMult = levered && data.leverage ? data.leverage : 1;
  const chartData = activeTable.map((r) => {
    const stat = statsByPeriod.get(r.period);
    // Confidence band scales with leverage too
    const ci = stat?.ci_half_width_pct != null ? stat.ci_half_width_pct * leverageMult : null;
    return {
      ...r,
      spread_ci: ci,
      spread_error: ci, // for ErrorBar (symmetric ± value)
    };
  });

  const significantCount = activePeriodStats.filter((s) => s.significant).length;
  const totalStatPeriods = activePeriodStats.filter((s) => s.t_stat != null).length;
  const strippedLabels = (data.ex_scam_symbols ?? []).map((s) => s.replace("USDT", "")).join(", ");

  return (
    <div className="p-4 space-y-4">

      {/* Thesis Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Thesis Validation</CardTitle>
              {data.leverage && data.leverage > 1 && (
                <button
                  onClick={() => setLevered(!levered)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    levered
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {levered ? `Levered (${data.leverage}x)` : "Unlevered"}
                </button>
              )}
              {hasExScams && (
                <button
                  onClick={() => setExScams(!exScams)}
                  title={strippedLabels ? `Stripping: ${strippedLabels}` : undefined}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    exScams
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {exScams ? `Ex-Scams (–${data.ex_scam_symbols?.length ?? 0})` : "Include All Shorts"}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Badge variant={activeWorkingCount >= activeTotalPeriods / 2 ? "success" : "warning"}>
                {activeWorkingCount}/{activeTotalPeriods} positive
              </Badge>
              {totalStatPeriods > 0 && (
                <Badge variant={significantCount > 0 ? "success" : "default"}>
                  {significantCount}/{totalStatPeriods} significant (|t|≥2)
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <p className="text-xs text-gray-500 mb-3">
          Longs should outperform shorts. Raw spread % is the headline; Sharpe and t-stat are the
          noise-adjusted reads. |t|≥2 means the outperformance is statistically distinguishable
          from zero at ~95% confidence.
          {levered && <span className="text-blue-400 ml-1">Levered ({data.leverage}x).</span>}
          {useExScams && (
            <span className="text-amber-400 ml-1">
              Excluding {strippedLabels || "scam pumps"} from shorts.
            </span>
          )}
        </p>
      </Card>

      {/* Spread Chart — with 95% CI error bars on spread */}
      <ChartContainer title={`Long vs Short Returns by Period${levered ? ` (${data.leverage}x)` : ""}${useExScams ? " — Ex-Scams" : ""} — 95% CI on Spread`} height={280}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="period"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#1e1e2e" }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#111118",
              border: "1px solid #1e1e2e",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            formatter={(v: any) => [`${Number(v).toFixed(2)}%`]}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="longs_pct" name="Longs" fill="#22c55e" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
          <Bar dataKey="shorts_pct" name="Shorts" fill="#ef4444" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
          <Bar dataKey="spread_pct" name="Spread" fill="#3b82f6" fillOpacity={0.7} radius={[3, 3, 0, 0]}>
            <ErrorBar dataKey="spread_error" width={6} stroke="#94a3b8" strokeWidth={1.5} direction="y" />
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Spread Table — extended with vol / Sharpe / t-stat / β-adjusted */}
      <Card>
        <CardHeader>
          <CardTitle>Period Spread — Risk-Adjusted</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-1.5 text-left text-gray-500">Period</th>
                <th className="px-3 py-1.5 text-right text-gray-500">Longs</th>
                <th className="px-3 py-1.5 text-right text-gray-500">Shorts</th>
                <th className="px-3 py-1.5 text-right text-gray-500">Spread</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="Annualized vol of daily spread returns">Vol (ann.)</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="Mean daily spread / std × √365">Sharpe</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="t-stat of daily spread mean vs zero; |t|≥2 ≈ 95% confident">t-stat</th>
                <th className="px-3 py-1.5 text-right text-gray-500" title="Spread adjusted for short-basket beta: L − β×S cumulative">β-adj</th>
                <th className="px-3 py-1.5 text-center text-gray-500">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {activeTable.map((r) => {
                const stat = statsByPeriod.get(r.period);
                const betaAdjScaled = stat?.beta_adj_spread_pct != null
                  ? stat.beta_adj_spread_pct * leverageMult
                  : null;
                return (
                  <tr key={r.period} className="hover:bg-[var(--bg-card-hover)]">
                    <td className="px-3 py-1.5 text-gray-300 font-medium">{r.period}</td>
                    <td className={`px-3 py-1.5 text-right ${r.longs_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {r.longs_pct >= 0 ? "+" : ""}{r.longs_pct.toFixed(2)}%
                    </td>
                    <td className={`px-3 py-1.5 text-right ${r.shorts_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {r.shorts_pct >= 0 ? "+" : ""}{r.shorts_pct.toFixed(2)}%
                    </td>
                    <td className={`px-3 py-1.5 text-right font-medium ${r.spread_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {r.spread_pct >= 0 ? "+" : ""}{r.spread_pct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-400">
                      {stat?.vol_ann_pct != null ? `${stat.vol_ann_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${sharpeColor(stat?.sharpe)}`}>
                      {stat?.sharpe != null ? stat.sharpe.toFixed(2) : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${tStatColor(stat?.t_stat)}`}>
                      {stat?.t_stat != null ? stat.t_stat.toFixed(2) : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${betaAdjScaled != null && betaAdjScaled >= 0 ? "text-green-400" : betaAdjScaled != null ? "text-red-400" : "text-gray-600"}`}>
                      {betaAdjScaled != null ? `${betaAdjScaled >= 0 ? "+" : ""}${betaAdjScaled.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {stat?.significant ? (
                        <Badge variant="success">{stat.t_stat && stat.t_stat > 0 ? "real +" : "real −"}</Badge>
                      ) : stat?.t_stat != null ? (
                        <span className="text-gray-600 text-[10px]">noise</span>
                      ) : r.working ? (
                        <span className="text-green-500 text-[10px]">+</span>
                      ) : (
                        <span className="text-red-500 text-[10px]">−</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-gray-600 mt-2 px-3">
          β-adj = cumulative (L − β<sub>LS</sub> × S) over the window. Neutralizes market exposure
          via regression slope of long-basket on short-basket daily returns.
        </div>
      </Card>

      {/* Rolling 30d Spread Sharpe */}
      {activeRollingSharpe.length > 0 && (
        <ChartContainer title={`Rolling 30d Spread Sharpe — Regime Detector${useExScams ? " (Ex-Scams)" : ""}`} height={240}>
          <LineChart data={activeRollingSharpe}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(d: string) => d.slice(5)}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                background: "#111118",
                border: "1px solid #1e1e2e",
                borderRadius: "6px",
                fontSize: "11px",
              }}
              formatter={(v: any, name: any) => [Number(v).toFixed(2), String(name)]}
            />
            <ReferenceLine y={0} stroke="#374151" />
            <ReferenceLine y={2} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "+2 strong", fill: "#22c55e", fontSize: 9, position: "right" }} />
            <ReferenceLine y={-2} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "−2 broken", fill: "#ef4444", fontSize: 9, position: "right" }} />
            <Line
              type="monotone"
              dataKey="sharpe"
              name="30d Sharpe"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}

      {/* Token Returns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TokenReturnTable title="Long Token Returns" tokens={data.long_tokens} side="long" />
        <TokenReturnTable title="Short Token Returns" tokens={data.short_tokens} side="short" />
      </div>

      {/* Kingmaker */}
      <Card>
        <CardHeader>
          <CardTitle>Kingmaker Alignment</CardTitle>
        </CardHeader>
        <div className="text-xs text-gray-400 mb-3">{data.kingmaker.thesis}</div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-gray-500 text-xs">Long Alignment</div>
            <div className="text-2xl font-bold text-green-400">
              {data.kingmaker.long_alignment_pct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-600">{data.kingmaker.n_longs} longs</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Short Alignment</div>
            <div className="text-2xl font-bold text-red-400">
              {data.kingmaker.short_alignment_pct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-600">{data.kingmaker.n_shorts} shorts</div>
          </div>
        </div>
        {/* Category breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
          {[
            { key: "long_btc", label: "BTC", color: "text-orange-400" },
            { key: "long_hype", label: "HYPE", color: "text-cyan-400" },
            { key: "long_defi", label: "DeFi", color: "text-purple-400" },
            { key: "long_ai_compute", label: "AI Compute", color: "text-blue-400" },
            { key: "long_infra", label: "Infra", color: "text-gray-300" },
            { key: "long_privacy", label: "Privacy", color: "text-green-400" },
          ].map(({ key, label, color }) => {
            const tokens = (data.kingmaker.categories as Record<string, string[]>)?.[key] ?? [];
            return (
              <div key={key} className="bg-gray-900/50 rounded px-2 py-1.5">
                <span className={`${color} font-medium`}>{label}</span>
                <span className="text-gray-500 ml-1">({tokens.length})</span>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  {tokens.length > 0 ? tokens.map(s => s.replace("USDT", "")).join(", ") : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function sharpeColor(s: number | null | undefined): string {
  if (s == null) return "text-gray-600";
  if (s >= 1.5) return "text-green-400 font-semibold";
  if (s >= 0.5) return "text-green-500";
  if (s <= -1.5) return "text-red-400 font-semibold";
  if (s <= -0.5) return "text-red-500";
  return "text-gray-400";
}

function tStatColor(t: number | null | undefined): string {
  if (t == null) return "text-gray-600";
  if (Math.abs(t) >= 2.58) return t >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold";
  if (Math.abs(t) >= 2.0) return t >= 0 ? "text-green-500" : "text-red-500";
  if (Math.abs(t) >= 1.0) return "text-gray-300";
  return "text-gray-500";
}

function TokenReturnTable({
  title,
  tokens,
}: {
  title: string;
  tokens: TokenReturn[];
  side?: "long" | "short";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="px-1.5 py-1 text-left text-gray-500">Token</th>
              {PERIODS.map((p) => (
                <th key={p} className="px-1.5 py-1 text-right text-gray-500">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {tokens.map((t) => (
              <tr key={t.symbol} className="hover:bg-[var(--bg-card-hover)]">
                <td className="px-1.5 py-1 text-gray-200 font-medium">
                  {t.symbol.replace("USDT", "")}
                </td>
                {PERIODS.map((p) => {
                  const val = t[p];
                  if (val == null) return <td key={p} className="px-1.5 py-1 text-right text-gray-700">—</td>;
                  return (
                    <td
                      key={p}
                      className={`px-1.5 py-1 text-right ${val >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {val >= 0 ? "+" : ""}{val.toFixed(1)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
