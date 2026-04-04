import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
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
}

const PERIODS = ["1d", "7d", "14d", "30d", "60d", "90d", "YTD", "1Y"] as const;

export function ThesisTab() {
  const [levered, setLevered] = React.useState(false);
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<ThesisResponse>({
    queryKey: ["thesis", engine.id],
    queryFn: () => client.get("/api/thesis"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  const { data: health } = useQuery<any>({
    queryKey: ["thesis-health", engine.id],
    queryFn: () => client.get("/api/thesis/health"),
    refetchInterval: 900_000,
    staleTime: 600_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading thesis data...
      </div>
    );
  }

  if (!data) return null;

  const activeTable = levered && data.levered_spread_table ? data.levered_spread_table : data.spread_table;

  const healthColors: Record<string, string> = {
    green: "text-green-400 bg-green-900/10",
    yellow: "text-yellow-400 bg-yellow-900/10",
    warning: "text-orange-400 bg-orange-900/10",
    critical: "text-red-400 bg-red-900/10",
  };

  return (
    <div className="p-4 space-y-4">
      {/* Long Basket Health */}
      {health && health.tokens && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Long Basket Health</CardTitle>
              <div className="flex gap-2 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-green-900/20 text-green-400">{health.summary?.healthy ?? 0} healthy</span>
                <span className="px-1.5 py-0.5 rounded bg-yellow-900/20 text-yellow-400">{health.summary?.yellow ?? 0} watch</span>
                <span className="px-1.5 py-0.5 rounded bg-orange-900/20 text-orange-400">{health.summary?.warning ?? 0} warning</span>
                <span className="px-1.5 py-0.5 rounded bg-red-900/20 text-red-400">{health.summary?.critical ?? 0} critical</span>
                {health.summary?.avg_alpha_pct != null && (
                  <span className={`px-1.5 py-0.5 rounded font-mono ${health.summary.avg_alpha_pct >= 0 ? "text-green-400 bg-green-900/20" : "text-red-400 bg-red-900/20"}`}>
                    avg α {health.summary.avg_alpha_pct >= 0 ? "+" : ""}{health.summary.avg_alpha_pct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="px-2 py-1.5 text-left text-gray-500">Token</th>
                  <th className="px-2 py-1.5 text-left text-gray-500">Sector</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Alpha</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">PE</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Fees/30d</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Fee Δ</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">TVL</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">SM 30d</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Health</th>
                  <th className="px-2 py-1.5 text-left text-gray-500">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[...health.tokens].sort((a: any, b: any) => {
                  const order = { critical: 0, warning: 1, yellow: 2, green: 3 };
                  return (order[a.thesis_health as keyof typeof order] ?? 4) - (order[b.thesis_health as keyof typeof order] ?? 4);
                }).map((t: any) => (
                  <tr key={t.symbol} className={healthColors[t.thesis_health] || ""}>
                    <td className="px-2 py-1.5 font-medium">{t.symbol.replace("USDT", "")}</td>
                    <td className="px-2 py-1.5 text-gray-500">{t.sector}</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${t.alpha_pct != null ? (t.alpha_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                      {t.alpha_pct != null ? `${t.alpha_pct > 0 ? "+" : ""}${t.alpha_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${t.pe_ratio != null && t.pe_ratio > 80 ? "text-red-400" : "text-gray-300"}`}>
                      {t.pe_ratio != null ? t.pe_ratio.toFixed(0) : "—"}
                      {t.pe_trend && <span className="text-[8px] ml-0.5 text-gray-600">{t.pe_trend === "falling" ? "↓" : t.pe_trend === "rising" ? "↑" : ""}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-300">
                      {t.fees_30d > 0 ? (t.fees_30d >= 1e6 ? `$${(t.fees_30d/1e6).toFixed(1)}M` : `$${(t.fees_30d/1e3).toFixed(0)}K`) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${t.fee_change_30d_pct != null ? (t.fee_change_30d_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                      {t.fee_change_30d_pct != null ? `${t.fee_change_30d_pct > 0 ? "+" : ""}${t.fee_change_30d_pct.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-300">
                      {t.tvl > 0 ? (t.tvl >= 1e9 ? `$${(t.tvl/1e9).toFixed(1)}B` : `$${(t.tvl/1e6).toFixed(0)}M`) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${t.sm_netflow_30d > 1e6 ? "text-green-400" : t.sm_netflow_30d < -1e6 ? "text-red-400" : "text-gray-600"}`}>
                      {t.sm_netflow_30d !== 0 ? `$${(t.sm_netflow_30d/1e6).toFixed(1)}M` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${healthColors[t.thesis_health] || "text-gray-500"}`}>
                        {t.thesis_health?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-gray-500 max-w-[200px] truncate" title={t.thesis_issues?.join("; ")}>
                      {t.thesis_issues?.[0] || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sector Analysis */}
          {health.sector_analysis && health.sector_analysis.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--border)]">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Sector Analysis</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                {health.sector_analysis.map((s: any) => (
                  <div key={s.sector} className="bg-gray-800/50 rounded px-2 py-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-300 font-medium capitalize">{s.sector}</span>
                      <span className="text-gray-500">{s.count} tokens</span>
                    </div>
                    <div className="flex gap-3 text-[10px] mt-0.5">
                      {s.avg_alpha_pct != null && (
                        <span className={s.avg_alpha_pct >= 0 ? "text-green-400" : "text-red-400"}>α {s.avg_alpha_pct > 0 ? "+" : ""}{s.avg_alpha_pct.toFixed(1)}%</span>
                      )}
                      {s.avg_pe != null && <span className="text-gray-500">PE {s.avg_pe}</span>}
                      {s.n_critical > 0 && <span className="text-red-400">{s.n_critical} critical</span>}
                    </div>
                    <div className="text-[9px] text-gray-600 mt-0.5">{s.verdict}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {health.recommendations && health.recommendations.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--border)]">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Recommendations</div>
              <div className="space-y-2">
                {health.recommendations.map((r: any) => (
                  <div key={r.symbol} className={`rounded border px-3 py-2 ${r.severity === "critical" ? "border-red-800/30 bg-red-900/10" : "border-yellow-800/30 bg-yellow-900/10"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${r.severity === "critical" ? "text-red-400" : "text-yellow-400"}`}>
                        {r.action.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-300 font-medium">{r.symbol.replace("USDT", "")}</span>
                      <span className="text-[10px] text-gray-500 capitalize">{r.case?.sector}</span>
                      {r.case?.is_sector_rotation && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-500">sector rotation</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {r.case?.issues?.slice(0, 3).join(" · ")}
                    </div>
                    {r.replacements && r.replacements.length > 0 && (
                      <div className="mt-1.5 border-t border-gray-800 pt-1.5">
                        <div className="text-[9px] text-gray-600 mb-1">REPLACE WITH:</div>
                        {r.replacements.map((rep: any) => (
                          <div key={rep.symbol} className="flex items-center gap-3 text-[10px]">
                            <span className="text-blue-400 font-medium">{rep.symbol.replace("USDT", "")}</span>
                            <span className="text-gray-500 capitalize">{rep.sector}</span>
                            {rep.pe != null && <span className="font-mono text-gray-400">PE {rep.pe}</span>}
                            {rep.fees_30d > 0 && <span className="font-mono text-gray-400">${(rep.fees_30d/1e6).toFixed(1)}M fees</span>}
                            {rep.tvl > 0 && <span className="font-mono text-gray-400">${(rep.tvl/1e9).toFixed(1)}B TVL</span>}
                            {rep.sm_netflow_30d > 1e6 && <span className="font-mono text-green-400">SM +${(rep.sm_netflow_30d/1e6).toFixed(0)}M</span>}
                            <span className="font-mono text-gray-500">β{rep.beta} ρ{rep.correlation}</span>
                            <span className="text-gray-600">{rep.sector_concentration_impact}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.case?.downgrade_reason && (
                      <div className="text-[9px] text-gray-600 mt-1 italic">{r.case.downgrade_reason}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regime Context */}
          {health.regime_context && (
            <div className="px-3 pb-2 text-[10px] text-gray-600">
              Macro: <span className="text-gray-400">{health.regime_context.regime_label} ({health.regime_context.macro_regime_score}/100)</span>
              {" — "}{health.regime_context.implication}
            </div>
          )}
        </Card>
      )}

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
            </div>
            <Badge variant={data.working_count >= data.total_periods / 2 ? "success" : "warning"}>
              {data.working_count}/{data.total_periods} periods working
            </Badge>
          </div>
        </CardHeader>
        <p className="text-xs text-gray-500 mb-3">
          Longs should outperform shorts across time horizons. A positive spread = thesis is working.
          {levered && <span className="text-blue-400 ml-1">Showing levered returns ({data.leverage}x gross/NAV).</span>}
        </p>
      </Card>

      {/* Spread Chart */}
      <ChartContainer title={`Long vs Short Returns by Period${levered ? ` (${data.leverage}x)` : ""}`} height={280}>
        <BarChart data={activeTable}>
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
            formatter={(v) => [`${Number(v).toFixed(2)}%`]}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="longs_pct" name="Longs" fill="#22c55e" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
          <Bar dataKey="shorts_pct" name="Shorts" fill="#ef4444" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
          <Bar dataKey="spread_pct" name="Spread" fill="#3b82f6" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>

      {/* Spread Table */}
      <Card>
        <CardHeader>
          <CardTitle>Period Spread</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-1.5 text-left text-gray-500">Period</th>
                <th className="px-3 py-1.5 text-right text-gray-500">Longs</th>
                <th className="px-3 py-1.5 text-right text-gray-500">Shorts</th>
                <th className="px-3 py-1.5 text-right text-gray-500">Spread</th>
                <th className="px-3 py-1.5 text-center text-gray-500">Working?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {activeTable.map((r) => (
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
                  <td className="px-3 py-1.5 text-center">
                    {r.working ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-red-400">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
