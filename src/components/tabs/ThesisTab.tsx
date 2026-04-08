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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading thesis data...
      </div>
    );
  }

  if (!data) return null;

  const activeTable = levered && data.levered_spread_table ? data.levered_spread_table : data.spread_table;

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
