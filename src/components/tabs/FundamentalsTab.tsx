import { useState } from "react";
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
import { KpiCard } from "../shared/KpiCard";
import { ChartContainer } from "../shared/ChartContainer";

/* ──────────────────────── Types ──────────────────────── */

interface FundToken {
  symbol: string;
  side: string;
  position_weight_pct: number | null;
  fees_30d: number | null;
  fees_24h: number | null;
  holders_revenue_30d: number | null;
  holders_revenue_24h: number | null;
  tvl: number | null;
  tvl_change_30d: number | null;
  category: string | null;
  market_cap: number | null;
  fdv: number | null;
  float_pct: number | null;
  ps_ratio: number | null;
  pe_ratio: number | null;
  holders_revenue_yield_pct: number | null;
  revenue_capture_pct: number | null;
  fdv_mcap_ratio: number | null;
  tvl_mcap_ratio: number | null;
  fundamental_score: number | null;
  fee_change_1m: number | null;
  fee_momentum_7d7d: number | null;
  nansen_sm_holders: number | null;
  nansen_sm_netflow_30d: number | null;
  last_updated: string | null;
  // New three-pillar fields
  va_score: number | null;
  sm_score: number | null;
  p3_score: number | null;
  adjusted_score: number | null;
  confidence: number | null;
  n_va: number | null;
  n_sm: number | null;
  n_p3: number | null;
}

interface FundSummary {
  long_avg_score: number;
  short_avg_score: number;
  score_spread: number;
  long_total_holders_rev_30d: number;
  short_total_holders_rev_30d: number;
  long_avg_fee_momentum: number | null;
  short_avg_fee_momentum: number | null;
}

interface FundAlert {
  symbol: string;
  type: string;
  value: number;
  message: string;
}

interface FundResponse {
  tokens: FundToken[];
  summary: FundSummary;
  alerts: FundAlert[];
}

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

/* ──────────────────────── Helpers ──────────────────────── */

const PERIODS = ["1d", "7d", "14d", "30d", "60d", "90d", "YTD", "1Y"] as const;

const fmt = (n: number | null | undefined): string => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const scoreColor = (s: number | null) => {
  if (s == null) return "text-gray-600";
  if (s >= 60) return "text-green-400";
  if (s >= 40) return "text-yellow-400";
  return "text-red-400";
};

const pillarColor = (s: number | null) => {
  if (s == null) return "text-gray-600";
  if (s > 0) return "text-green-400";
  if (s === 0) return "text-gray-400";
  return "text-red-400";
};

const pctColor = (p: number | null, inverted = false) => {
  if (p == null) return "text-gray-600";
  const good = inverted ? p < 0 : p > 0;
  return good ? "text-green-400" : p === 0 ? "text-gray-400" : "text-red-400";
};

const healthColors: Record<string, string> = {
  green: "text-green-400 bg-green-900/10",
  yellow: "text-yellow-400 bg-yellow-900/10",
  warning: "text-orange-400 bg-orange-900/10",
  critical: "text-red-400 bg-red-900/10",
};

/* ──────────────────────── Sub-components ──────────────────────── */

function TokenReturnTable({
  title,
  tokens,
}: {
  title: string;
  tokens: TokenReturn[];
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
                    <td key={p} className={`px-1.5 py-1 text-right ${val >= 0 ? "text-green-400" : "text-red-400"}`}>
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

/* ──────────────────────── Main Component ──────────────────────── */

export function FundamentalsTab() {
  const { client, engine } = useEngine();
  const [sideFilter, setSideFilter] = useState<"ALL" | "LONG" | "SHORT" | "LONG_RESEARCH" | "SHORT_UNIVERSE" | "EXCLUDED">("ALL");
  const [sortCol, setSortCol] = useState<string>("fundamental_score");
  const [sortDesc, setSortDesc] = useState(true);
  const [levered, setLevered] = useState(false);

  // Fundamentals query
  const { data, isLoading } = useQuery<FundResponse>({
    queryKey: ["fundamentals", engine.id],
    queryFn: () => client.get("/api/fundamentals"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  // Thesis query
  const { data: thesis } = useQuery<ThesisResponse>({
    queryKey: ["thesis", engine.id],
    queryFn: () => client.get("/api/thesis"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  // Thesis health query
  const { data: health } = useQuery<any>({
    queryKey: ["thesis-health", engine.id],
    queryFn: () => client.get("/api/thesis/health"),
    refetchInterval: 900_000,
    staleTime: 600_000,
    retry: false,
  });

  if (isLoading) return <div className="p-4 text-gray-500 text-sm">Loading fundamentals...</div>;
  if (!data?.tokens?.length) return <div className="p-4 text-gray-500 text-sm">No fundamental data available.</div>;

  const filtered = data.tokens
    .filter(t => sideFilter === "ALL" || t.side === sideFilter)
    .sort((a, b) => {
      const av = (a as any)[sortCol] ?? -Infinity;
      const bv = (b as any)[sortCol] ?? -Infinity;
      return sortDesc ? bv - av : av - bv;
    });

  const sideLabel: Record<string, string> = {
    LONG: "Long", SHORT: "Short", LONG_RESEARCH: "Long Research",
    SHORT_UNIVERSE: "Short Universe", EXCLUDED: "Excluded",
  };

  const longs = data.tokens.filter(t => t.side === "LONG");
  const shorts = data.tokens.filter(t => t.side === "SHORT");
  const longResearch = data.tokens.filter(t => t.side === "LONG_RESEARCH");
  const shortUniverse = data.tokens.filter(t => t.side === "SHORT_UNIVERSE");
  const excluded = data.tokens.filter(t => t.side === "EXCLUDED");

  // Build a lookup of long token symbols for health badge in universe table
  const healthLookup: Record<string, string> = {};
  if (health?.tokens) {
    for (const ht of health.tokens as any[]) {
      healthLookup[ht.symbol] = ht.thesis_health;
    }
  }

  // Merge alerts: fundamentals + health alerts, deduplicate by symbol+type
  const mergedAlerts: FundAlert[] = [...data.alerts];
  if (health?.alerts) {
    const existing = new Set(data.alerts.map(a => `${a.symbol}:${a.type}`));
    for (const ha of health.alerts as FundAlert[]) {
      if (!existing.has(`${ha.symbol}:${ha.type}`)) {
        mergedAlerts.push(ha);
      }
    }
  }

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDesc(!sortDesc);
    else { setSortCol(col); setSortDesc(true); }
  };

  const th = (label: string, col: string, align = "text-right") => (
    <th className={`py-2 ${align} cursor-pointer hover:text-gray-300 select-none whitespace-nowrap`} onClick={() => toggleSort(col)}>
      {label} {sortCol === col ? (sortDesc ? "↓" : "↑") : ""}
    </th>
  );

  const activeTable = thesis
    ? (levered && thesis.levered_spread_table ? thesis.levered_spread_table : thesis.spread_table)
    : [];

  return (
    <div className="p-4 space-y-4">
      {/* ── 1. KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Long Avg Score" value={`${data.summary.long_avg_score.toFixed(0)}`} valueColor="text-green-400" />
        <KpiCard label="Short Avg Score" value={`${data.summary.short_avg_score.toFixed(0)}`} valueColor="text-red-400" />
        <KpiCard label="Score Spread" value={`${data.summary.score_spread.toFixed(0)} pts`} sub="Long - Short (wider = better)" valueColor={data.summary.score_spread > 20 ? "text-green-400" : "text-yellow-400"} />
        <KpiCard label="Long Holders Rev" value={fmt(data.summary.long_total_holders_rev_30d)} sub="30d total to token holders" valueColor="text-green-400" />
        <KpiCard label="Short Holders Rev" value={fmt(data.summary.short_total_holders_rev_30d)} sub="30d (should be ~$0)" valueColor={data.summary.short_total_holders_rev_30d < 1000000 ? "text-green-400" : "text-red-400"} />
        <KpiCard label="Fee Momentum" value={`L:${data.summary.long_avg_fee_momentum?.toFixed(0) ?? "—"}% S:${data.summary.short_avg_fee_momentum?.toFixed(0) ?? "—"}%`} sub="30d fee trend" />
      </div>

      {/* ── 2. Strategy Thesis Card ── */}
      <Card className="border-purple-800/30">
        <div className="text-xs text-gray-400">
          <span className="text-purple-400 font-medium">Strategy Thesis: </span>
          Long basket generates real revenue flowing to token holders (buybacks, burns, distributions). Short basket generates zero.
          The score spread ({data.summary.score_spread.toFixed(0)} pts) quantifies this divergence.
          {data.summary.score_spread > 30 ? " Currently strong separation." : data.summary.score_spread > 15 ? " Moderate separation." : " Narrow — monitor for convergence risk."}
        </div>
      </Card>

      {/* ── 3. Alerts (merged) ── */}
      {mergedAlerts.length > 0 && (
        <Card className="border-red-800/30">
          <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
          <div className="space-y-1">
            {mergedAlerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant={a.type === "fee_momentum" ? "warning" : "danger"}>{a.symbol.replace("USDT", "")}</Badge>
                <span className="text-gray-400">{a.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 4. Long Basket Health ── */}
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
                    avg alpha {health.summary.avg_alpha_pct >= 0 ? "+" : ""}{health.summary.avg_alpha_pct.toFixed(1)}%
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
                  <th className="px-2 py-1.5 text-right text-gray-500">Fee Delta</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">TVL</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">TVL Delta 30d</th>
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
                    <td className={`px-2 py-1.5 text-right font-mono ${t.tvl_change_30d_pct != null ? (t.tvl_change_30d_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                      {t.tvl_change_30d_pct != null ? `${t.tvl_change_30d_pct > 0 ? "+" : ""}${t.tvl_change_30d_pct.toFixed(0)}%` : "—"}
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
        </Card>
      )}

      {/* ── 5. Sector Analysis ── */}
      {health?.sector_analysis && health.sector_analysis.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Sector Analysis</CardTitle></CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] p-3">
            {health.sector_analysis.map((s: any) => (
              <div key={s.sector} className="bg-gray-800/50 rounded px-2 py-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-300 font-medium capitalize">{s.sector}</span>
                  <span className="text-gray-500">{s.count} tokens</span>
                </div>
                <div className="flex gap-3 text-[10px] mt-0.5">
                  {s.avg_alpha_pct != null && (
                    <span className={s.avg_alpha_pct >= 0 ? "text-green-400" : "text-red-400"}>alpha {s.avg_alpha_pct > 0 ? "+" : ""}{s.avg_alpha_pct.toFixed(1)}%</span>
                  )}
                  {s.avg_pe != null && <span className="text-gray-500">PE {s.avg_pe}</span>}
                  {s.n_critical > 0 && <span className="text-red-400">{s.n_critical} critical</span>}
                </div>
                <div className="text-[9px] text-gray-600 mt-0.5">{s.verdict}</div>
              </div>
            ))}
          </div>
          {/* Regime Context */}
          {health.regime_context && (
            <div className="px-3 pb-2 text-[10px] text-gray-600">
              Macro: <span className="text-gray-400">{health.regime_context.regime_label} ({health.regime_context.macro_regime_score}/100)</span>
              {" — "}{health.regime_context.implication}
            </div>
          )}
        </Card>
      )}

      {/* ── 6. Recommendations ── */}
      {health?.recommendations && health.recommendations.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
          <div className="space-y-2 p-3">
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
                        <span className="font-mono text-gray-500">B{rep.beta} R{rep.correlation}</span>
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
        </Card>
      )}

      {/* ── 7. Full Universe Table ── */}
      <div className="flex gap-1 flex-wrap">
        {([
          { key: "ALL" as const, label: "All", count: data.tokens.length },
          { key: "LONG" as const, label: "Long", count: longs.length },
          { key: "SHORT" as const, label: "Short", count: shorts.length },
          { key: "LONG_RESEARCH" as const, label: "Long Research", count: longResearch.length },
          { key: "SHORT_UNIVERSE" as const, label: "Short Universe", count: shortUniverse.length },
          { key: "EXCLUDED" as const, label: "Excluded", count: excluded.length },
        ]).map(f => (
          <button key={f.key} onClick={() => setSideFilter(f.key)}
            className={`px-3 py-1 text-xs rounded ${sideFilter === f.key ? "bg-purple-900/40 text-purple-400" : "text-gray-500 hover:text-gray-300"}`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pl-2">Token</th>
                <th className="text-left py-2">Side</th>
                {th("Score", "fundamental_score")}
                {th("VA", "va_score")}
                {th("SM", "sm_score")}
                {th("P3", "p3_score")}
                {th("Adj.Score", "adjusted_score")}
                {th("Rev Yield %", "holders_revenue_yield_pct")}
                {th("Rev Capture %", "revenue_capture_pct")}
                {th("Fee Mom", "fee_change_1m")}
                {th("FDV/MCap", "fdv_mcap_ratio")}
                {th("Fees 30d", "fees_30d")}
                {th("Holders Rev", "holders_revenue_30d")}
                {th("TVL", "tvl")}
                {th("P/S", "ps_ratio")}
                {th("SM Holders", "nansen_sm_holders")}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.symbol} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                  <td className="py-2 pl-2 font-medium text-gray-200 whitespace-nowrap">
                    {t.symbol.replace("USDT", "")}
                    {t.side === "LONG" && healthLookup[t.symbol] && (
                      <span className={`ml-1 text-[8px] px-1 py-0.5 rounded font-medium ${healthColors[healthLookup[t.symbol]] || "text-gray-500"}`}>
                        {healthLookup[t.symbol]?.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <Badge variant={t.side === "LONG" || t.side === "LONG_RESEARCH" ? "success" : t.side === "SHORT" ? "danger" : "default"}>{sideLabel[t.side] ?? t.side}</Badge>
                  </td>
                  <td className={`py-2 text-right font-mono font-semibold ${scoreColor(t.fundamental_score)}`}>
                    {t.fundamental_score?.toFixed(0) ?? "—"}
                  </td>
                  <td className={`py-2 text-right font-mono ${pillarColor(t.va_score)}`}>
                    {t.va_score != null ? t.va_score.toFixed(1) : "—"}
                  </td>
                  <td className={`py-2 text-right font-mono ${pillarColor(t.sm_score)}`}>
                    {t.sm_score != null ? t.sm_score.toFixed(1) : "—"}
                  </td>
                  <td className={`py-2 text-right font-mono ${pillarColor(t.p3_score)}`}>
                    {t.p3_score != null ? t.p3_score.toFixed(1) : "—"}
                  </td>
                  <td className={`py-2 text-right font-mono font-semibold ${pillarColor(t.adjusted_score)}`}>
                    {t.adjusted_score != null ? t.adjusted_score.toFixed(1) : "—"}
                  </td>
                  <td className={`py-2 text-right ${pctColor(t.holders_revenue_yield_pct)}`}>
                    {t.holders_revenue_yield_pct ? `${t.holders_revenue_yield_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-2 text-right ${t.revenue_capture_pct && t.revenue_capture_pct > 50 ? "text-green-400" : t.revenue_capture_pct && t.revenue_capture_pct > 10 ? "text-yellow-400" : "text-gray-500"}`}>
                    {t.revenue_capture_pct ? `${t.revenue_capture_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-2 text-right ${pctColor(t.fee_change_1m)}`}>
                    {t.fee_change_1m != null ? `${t.fee_change_1m > 0 ? "+" : ""}${t.fee_change_1m.toFixed(0)}%` : "—"}
                  </td>
                  <td className={`py-2 text-right ${t.fdv_mcap_ratio && t.fdv_mcap_ratio > 3 ? "text-red-400" : t.fdv_mcap_ratio && t.fdv_mcap_ratio > 1.5 ? "text-yellow-400" : "text-green-400"}`}>
                    {t.fdv_mcap_ratio ? `${t.fdv_mcap_ratio.toFixed(1)}x` : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-400">{fmt(t.fees_30d)}</td>
                  <td className="py-2 text-right text-gray-400">{fmt(t.holders_revenue_30d)}</td>
                  <td className="py-2 text-right text-gray-400">{fmt(t.tvl)}</td>
                  <td className={`py-2 text-right ${t.ps_ratio && t.ps_ratio < 20 ? "text-green-400" : t.ps_ratio && t.ps_ratio < 50 ? "text-yellow-400" : "text-gray-500"}`}>
                    {t.ps_ratio ? `${t.ps_ratio.toFixed(0)}x` : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-400">{t.nansen_sm_holders ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 8. Thesis Validation ── */}
      {thesis && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Thesis Validation</CardTitle>
                  {thesis.leverage && thesis.leverage > 1 && (
                    <button
                      onClick={() => setLevered(!levered)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        levered
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {levered ? `Levered (${thesis.leverage}x)` : "Unlevered"}
                    </button>
                  )}
                </div>
                <Badge variant={thesis.working_count >= thesis.total_periods / 2 ? "success" : "warning"}>
                  {thesis.working_count}/{thesis.total_periods} periods working
                </Badge>
              </div>
            </CardHeader>
            <p className="text-xs text-gray-500 mb-3">
              Longs should outperform shorts across time horizons. A positive spread = thesis is working.
              {levered && <span className="text-blue-400 ml-1">Showing levered returns ({thesis.leverage}x gross/NAV).</span>}
            </p>
          </Card>

          {/* Spread Chart */}
          <ChartContainer title={`Long vs Short Returns by Period${levered ? ` (${thesis.leverage}x)` : ""}`} height={280}>
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

          {/* Period Spread Table */}
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
            <TokenReturnTable title="Long Token Returns" tokens={thesis.long_tokens} />
            <TokenReturnTable title="Short Token Returns" tokens={thesis.short_tokens} />
          </div>

          {/* ── 9. Kingmaker Alignment ── */}
          <Card>
            <CardHeader>
              <CardTitle>Kingmaker Alignment</CardTitle>
            </CardHeader>
            <div className="text-xs text-gray-400 mb-3">{thesis.kingmaker.thesis}</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-gray-500 text-xs">Long Alignment</div>
                <div className="text-2xl font-bold text-green-400">
                  {thesis.kingmaker.long_alignment_pct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-gray-600">{thesis.kingmaker.n_longs} longs</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Short Alignment</div>
                <div className="text-2xl font-bold text-red-400">
                  {thesis.kingmaker.short_alignment_pct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-gray-600">{thesis.kingmaker.n_shorts} shorts</div>
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
                const tokens = (thesis.kingmaker.categories as Record<string, string[]>)?.[key] ?? [];
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
        </>
      )}
    </div>
  );
}
