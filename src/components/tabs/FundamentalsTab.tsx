import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";

/* ──────────────────────── Types ──────────────────────── */

interface FundToken {
  symbol: string;
  side: string;
  sector: string | null;
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
  nansen_sm_holders: number | null;
  nansen_sm_netflow_30d: number | null;
  last_updated: string | null;
  va_score: number | null;
  sm_score: number | null;
  p3_score: number | null;
  mm_score: number | null;
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

/* ──────────────────────── Helpers ──────────────────────── */

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

/* ──────────────────────── Research Deep Dive ──────────────────────── */

function ResearchDeepDive({ t }: { t: any }) {
  const va = t.va_score ?? 0;
  const sm = t.sm_score ?? 0;
  const p3 = t.p3_score ?? 0;
  const adj = t.adjusted_score ?? 0;
  const conf = t.confidence ?? 1;
  const mapped = adj != null ? Math.round(adj * 50 + 50) : null;

  const row = (label: string, value: string, color?: string, detail?: string) => (
    <div className="flex items-center py-0.5">
      <span className="text-gray-500 text-xs w-32">{label}</span>
      <span className={`text-sm font-mono w-28 ${color || "text-gray-300"}`}>{value}</span>
      {detail && <span className="text-gray-600 text-[11px]">{detail}</span>}
    </div>
  );

  const sc = (v: number) => v > 0.01 ? "text-green-400" : v < -0.01 ? "text-red-400" : "text-gray-500";
  const pct = (v: number | null) => v != null ? (v > 0 ? "text-green-400" : "text-red-400") : "text-gray-600";

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-lg px-5 py-4 mx-1 mb-2">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-semibold text-gray-200">{t.symbol.replace("USDT", "")}</span>
        <span className="text-xs text-gray-500 capitalize">{t.category || t.sector || "—"}</span>
        {t.tdr_coverage && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/30">TDR</span>}
        <span className={`text-xs font-mono font-bold ${scoreColor(mapped)}`}>Score: {mapped ?? "—"}</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Column 1: Revenue */}
        <div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Revenue</div>
          {row("Fees 30d", fmt(t.fees_30d))}
          {row("Holder Rev", fmt(t.holders_revenue_30d), (t.holders_revenue_30d || 0) > 0 ? "text-green-400" : "text-red-400")}
          {row("Rev Capture", t.revenue_capture_pct ? `${t.revenue_capture_pct.toFixed(1)}%` : "—", t.revenue_capture_pct > 50 ? "text-green-400" : t.revenue_capture_pct > 10 ? "text-yellow-400" : "text-gray-500")}
          {row("Buyback Yield", t.holders_revenue_yield_pct ? `${t.holders_revenue_yield_pct.toFixed(1)}%` : "—", (t.holders_revenue_yield_pct || 0) > 5 ? "text-green-400" : undefined)}
          {row("Fee Mom 30d", t.fee_change_1m != null ? `${t.fee_change_1m > 0 ? "+" : ""}${t.fee_change_1m.toFixed(0)}%` : "—", pct(t.fee_change_1m))}
        </div>

        {/* Column 2: Valuation */}
        <div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Valuation</div>
          {row("PE", t.pe_ratio != null ? (t.pe_ratio > 999 ? "n.m." : `${t.pe_ratio.toFixed(0)}x`) : "—", t.pe_ratio != null && t.pe_ratio < 20 ? "text-green-400" : undefined)}
          {row("P/S", t.ps_ratio != null ? (t.ps_ratio > 999 ? "n.m." : `${t.ps_ratio.toFixed(0)}x`) : "—", t.ps_ratio != null && t.ps_ratio < 20 ? "text-green-400" : undefined)}
          {row("TVL", fmt(t.tvl))}
          {row("TVL Δ 30d", t.tvl_change_30d != null ? `${(t.tvl_change_30d * 100).toFixed(1)}%` : "—", pct(t.tvl_change_30d))}
          {row("MCap", fmt(t.market_cap))}
        </div>

        {/* Column 3: Risk & Signals */}
        <div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Risk & Signals</div>
          {row("FDV/MCap", t.fdv_mcap_ratio ? `${t.fdv_mcap_ratio.toFixed(1)}x` : "—", (t.fdv_mcap_ratio || 0) >= 3 ? "text-red-400" : (t.fdv_mcap_ratio || 0) >= 1.5 ? "text-yellow-400" : "text-green-400")}
          {row("SM Holders", t.nansen_sm_holders != null ? `${t.nansen_sm_holders}` : "—")}
          {row("SM Flow 30d", t.nansen_sm_netflow_30d ? `$${(t.nansen_sm_netflow_30d / 1e6).toFixed(1)}M` : "—", pct(t.nansen_sm_netflow_30d))}
          {row("Dev Commits", t.cg_commit_count_4_weeks != null ? `${t.cg_commit_count_4_weeks}` : "—")}
          {row("Vol 24h", fmt(t.volume_24h_usd))}
        </div>
      </div>

      {/* Three-pillar breakdown */}
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Four-Pillar Scoring (VA+SM+OP+MM)</div>
        <div className="flex items-center gap-6 text-xs">
          <span>VA: <span className={`font-mono font-medium ${sc(va)}`}>{va > 0 ? "+" : ""}{va.toFixed(3)}</span> <span className="text-gray-600">({t.n_va ?? 0}/8)</span></span>
          <span>SM: <span className={`font-mono font-medium ${sc(sm)}`}>{sm > 0 ? "+" : ""}{sm.toFixed(3)}</span> <span className="text-gray-600">({t.n_sm ?? 0}/10)</span></span>
          <span>OP: <span className={`font-mono font-medium ${sc(p3)}`}>{p3 > 0 ? "+" : ""}{p3.toFixed(3)}</span> <span className="text-gray-600">({t.n_p3 ?? 0})</span></span>
          <span className="text-gray-600">→</span>
          <span>Adj: <span className={`font-mono font-bold ${sc(adj)}`}>{adj > 0 ? "+" : ""}{adj.toFixed(3)}</span></span>
          <span>× Conf: <span className="font-mono text-gray-300">{(conf * 100).toFixed(0)}%</span></span>
          <span>= <span className={`font-mono font-bold ${scoreColor(mapped)}`}>{mapped}</span></span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Main Component ──────────────────────── */

export function FundamentalsTab() {
  const { client, engine } = useEngine();
  const [sideFilter, setSideFilter] = useState<"ALL" | "LONG" | "SHORT" | "LONG_RESEARCH" | "SHORT_UNIVERSE" | "EXCLUDED">("ALL");
  const [sortCol, setSortCol] = useState<string>("data_coverage");
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  // Fundamentals query
  const { data, isLoading } = useQuery<FundResponse>({
    queryKey: ["fundamentals", engine.id],
    queryFn: () => client.get("/api/fundamentals"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  // Thesis health query (for health badges in table)
  const { data: health } = useQuery<any>({
    queryKey: ["thesis-health", engine.id],
    queryFn: () => client.get("/api/thesis/health"),
    refetchInterval: 900_000,
    staleTime: 600_000,
    retry: false,
  });

  if (isLoading) return <div className="p-4 text-gray-500 text-sm">Loading fundamentals...</div>;
  if (!data?.tokens?.length) return <div className="p-4 text-gray-500 text-sm">No fundamental data available.</div>;

  // Compute data coverage score for each token (count non-null data fields)
  const _dataFields = [
    "fees_30d", "holders_revenue_30d", "tvl", "tvl_change_30d",
    "sm_flow_30d", "sm_holders", "fee_momentum_pct",
    "rev_capture_pct", "rev_yield_pct", "pe_ratio",
  ];
  const withCoverage = data.tokens.map(t => ({
    ...t,
    data_coverage: _dataFields.filter(f => (t as any)[f] != null && (t as any)[f] !== 0).length,
  }));

  const filtered = withCoverage
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

  const longs = withCoverage.filter(t => t.side === "LONG");
  const shorts = withCoverage.filter(t => t.side === "SHORT");
  const longResearch = withCoverage.filter(t => t.side === "LONG_RESEARCH");
  const shortUniverse = withCoverage.filter(t => t.side === "SHORT_UNIVERSE");
  const excluded = withCoverage.filter(t => t.side === "EXCLUDED");

  // Build a lookup of long token symbols for health badge in universe table
  const healthLookup: Record<string, string> = {};
  const hasAlpha = health?.tokens?.some((ht: any) => ht.alpha_pct != null) ?? false;
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
                  <th className="px-2 py-1.5 text-right text-gray-500">Score</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">VA</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">SM</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">OP</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">MM</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Adj.</th>
                  {hasAlpha && <th className="px-2 py-1.5 text-right text-gray-500">Alpha</th>}
                  <th className="px-2 py-1.5 text-right text-gray-500">PE</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Rev Yield</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Rev Cap %</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Fees 30d</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Fee Mom 30d</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Holders Rev</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">TVL</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">TVL Δ 30d</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">FDV/MCap</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">P/S</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">SM Flow 30d</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">SM Holders</th>
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
                    <td className={`px-2 py-1.5 text-right font-mono font-semibold ${scoreColor(t.fundamental_score)}`}>
                      {t.fundamental_score?.toFixed(0) ?? "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${pillarColor(t.va_score)}`}>
                      {t.va_score != null ? t.va_score.toFixed(1) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${pillarColor(t.sm_score)}`}>
                      {t.sm_score != null ? t.sm_score.toFixed(1) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${pillarColor(t.p3_score)}`}>
                      {t.p3_score != null ? t.p3_score.toFixed(1) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${pillarColor(t.mm_score)}`}>
                      {t.mm_score != null ? t.mm_score.toFixed(1) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono font-semibold ${pillarColor(t.adjusted_score)}`}>
                      {t.adjusted_score != null ? t.adjusted_score.toFixed(1) : "—"}
                    </td>
                    {hasAlpha && (
                    <td className={`px-2 py-1.5 text-right font-mono ${t.alpha_pct != null ? (t.alpha_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                      {t.alpha_pct != null ? `${t.alpha_pct > 0 ? "+" : ""}${t.alpha_pct.toFixed(1)}%` : "—"}
                    </td>
                    )}
                    <td className={`px-2 py-1.5 text-right font-mono ${t.pe_ratio != null && t.pe_ratio > 80 ? "text-red-400" : "text-gray-300"}`}>
                      {t.pe_ratio != null ? (t.pe_ratio > 999 ? "n.m." : `${t.pe_ratio.toFixed(0)}x`) : "—"}
                      {t.pe_trend && <span className="text-[8px] ml-0.5 text-gray-600">{t.pe_trend === "falling" ? "↓" : t.pe_trend === "rising" ? "↑" : ""}</span>}
                    </td>
                    <td className={`px-2 py-1.5 text-right ${pctColor(t.holders_revenue_yield_pct)}`}>
                      {t.holders_revenue_yield_pct ? `${t.holders_revenue_yield_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right ${t.revenue_capture_pct && t.revenue_capture_pct > 50 ? "text-green-400" : t.revenue_capture_pct && t.revenue_capture_pct > 10 ? "text-yellow-400" : "text-gray-500"}`}>
                      {t.revenue_capture_pct ? `${t.revenue_capture_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-300">
                      {t.fees_30d > 0 ? (t.fees_30d >= 1e6 ? `$${(t.fees_30d/1e6).toFixed(1)}M` : `$${(t.fees_30d/1e3).toFixed(0)}K`) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${t.fee_change_30d_pct != null ? (t.fee_change_30d_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                      {t.fee_change_30d_pct != null ? `${t.fee_change_30d_pct > 0 ? "+" : ""}${t.fee_change_30d_pct.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-400">
                      {t.holders_revenue_30d > 0 ? (t.holders_revenue_30d >= 1e6 ? `$${(t.holders_revenue_30d/1e6).toFixed(1)}M` : `$${(t.holders_revenue_30d/1e3).toFixed(0)}K`) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-300">
                      {t.tvl > 0 ? (t.tvl >= 1e9 ? `$${(t.tvl/1e9).toFixed(1)}B` : `$${(t.tvl/1e6).toFixed(0)}M`) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${t.tvl_change_30d_pct != null ? (t.tvl_change_30d_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                      {t.tvl_change_30d_pct != null ? `${t.tvl_change_30d_pct > 0 ? "+" : ""}${t.tvl_change_30d_pct.toFixed(0)}%` : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right ${t.fdv_mcap_ratio && t.fdv_mcap_ratio > 3 ? "text-red-400" : t.fdv_mcap_ratio && t.fdv_mcap_ratio > 1.5 ? "text-yellow-400" : "text-green-400"}`}>
                      {t.fdv_mcap_ratio ? `${t.fdv_mcap_ratio.toFixed(1)}x` : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right ${t.ps_ratio && t.ps_ratio < 20 ? "text-green-400" : t.ps_ratio && t.ps_ratio < 50 ? "text-yellow-400" : "text-gray-500"}`}>
                      {t.ps_ratio ? (t.ps_ratio > 999 ? "n.m." : `${t.ps_ratio.toFixed(0)}x`) : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${t.sm_netflow_30d > 1e6 ? "text-green-400" : t.sm_netflow_30d < -1e6 ? "text-red-400" : "text-gray-600"}`}>
                      {t.sm_netflow_30d !== 0 ? `$${(t.sm_netflow_30d/1e6).toFixed(1)}M` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-400">{t.nansen_sm_holders ?? t.sm_holders ?? "—"}</td>
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
          <div className="space-y-3 p-4">
            {health.recommendations.map((r: any) => (
              <div key={r.symbol} className={`rounded-lg border px-4 py-3 ${r.severity === "critical" ? "border-red-800/30 bg-red-900/10" : "border-yellow-800/30 bg-yellow-900/10"}`}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className={`text-sm font-bold ${r.severity === "critical" ? "text-red-400" : "text-yellow-400"}`}>
                    {r.action.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-200 font-semibold">{r.symbol.replace("USDT", "")}</span>
                  <span className="text-xs text-gray-500 capitalize">{r.case?.sector}</span>
                  {r.case?.is_sector_rotation && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">sector rotation</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  {r.case?.issues?.slice(0, 3).join(" · ")}
                </div>
                {r.case?.downgrade_reason && (
                  <div className="text-[11px] text-gray-600 mt-1.5 italic">{r.case.downgrade_reason}</div>
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
                <th className="text-left py-2">Sector</th>
                {th("Score", "fundamental_score")}
                {th("VA", "va_score")}
                {th("SM", "sm_score")}
                {th("OP", "p3_score")}
                {th("MM", "mm_score")}
                {th("Adj.", "adjusted_score")}
                {hasAlpha && th("Alpha", "alpha_pct")}
                {th("PE", "pe_ratio")}
                {th("Rev Yield", "holders_revenue_yield_pct")}
                {th("Rev Cap %", "revenue_capture_pct")}
                {th("Fees 30d", "fees_30d")}
                {th("Fee Mom 30d", "fee_change_1m")}
                {th("Holders Rev", "holders_revenue_30d")}
                {th("TVL", "tvl")}
                {th("TVL Δ 30d", "tvl_change_30d")}
                {th("FDV/MCap", "fdv_mcap_ratio")}
                {th("P/S", "ps_ratio")}
                {th("SM Flow 30d", "nansen_sm_netflow_30d")}
                {th("SM Holders", "nansen_sm_holders")}
              </tr>
            </thead>
            <tbody>
              {filtered.filter(t => t.data_coverage >= 2 || t.side === "LONG" || t.side === "SHORT").map(t => {
                const _healthToken = health?.tokens?.find((ht: any) => ht.symbol === t.symbol);
                const _isExpanded = expandedToken === t.symbol;
                return (<>
                <tr key={t.symbol} className={`border-b border-gray-800/50 cursor-pointer transition-colors ${_isExpanded ? "bg-gray-800/30" : "hover:bg-white/[0.02]"}`}
                    onClick={() => setExpandedToken(_isExpanded ? null : t.symbol)}>
                  <td className="py-2 pl-2 font-medium text-gray-200 whitespace-nowrap">
                    {t.symbol.replace("USDT", "")}
                  </td>
                  <td className="py-2">
                    <Badge variant={t.side === "LONG" || t.side === "LONG_RESEARCH" ? "success" : t.side === "SHORT" ? "danger" : "default"}>{sideLabel[t.side] ?? t.side}</Badge>
                  </td>
                  <td className="py-2 text-gray-500 text-[10px]">{t.sector || "—"}</td>
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
                  <td className={`py-2 text-right font-mono ${pillarColor(t.mm_score)}`}>
                    {t.mm_score != null ? t.mm_score.toFixed(1) : "—"}
                  </td>
                  <td className={`py-2 text-right font-mono font-semibold ${pillarColor(t.adjusted_score)}`}>
                    {t.adjusted_score != null ? t.adjusted_score.toFixed(1) : "—"}
                  </td>
                  {hasAlpha && (
                  <td className={`py-2 text-right font-mono ${_healthToken?.alpha_pct != null ? (_healthToken.alpha_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                    {_healthToken?.alpha_pct != null ? `${_healthToken.alpha_pct > 0 ? "+" : ""}${_healthToken.alpha_pct.toFixed(1)}%` : "—"}
                  </td>
                  )}
                  <td className={`py-2 text-right font-mono ${t.pe_ratio != null && t.pe_ratio > 80 ? "text-red-400" : "text-gray-300"}`}>
                    {t.pe_ratio != null ? (t.pe_ratio > 999 ? "n.m." : `${t.pe_ratio.toFixed(0)}x`) : "—"}
                  </td>
                  <td className={`py-2 text-right ${pctColor(t.holders_revenue_yield_pct)}`}>
                    {t.holders_revenue_yield_pct ? `${t.holders_revenue_yield_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-2 text-right ${t.revenue_capture_pct && t.revenue_capture_pct > 50 ? "text-green-400" : t.revenue_capture_pct && t.revenue_capture_pct > 10 ? "text-yellow-400" : "text-gray-500"}`}>
                    {t.revenue_capture_pct ? `${t.revenue_capture_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-400">{fmt(t.fees_30d)}</td>
                  <td className={`py-2 text-right ${pctColor(t.fee_change_1m)}`}>
                    {t.fee_change_1m != null ? `${t.fee_change_1m > 0 ? "+" : ""}${t.fee_change_1m.toFixed(0)}%` : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-400">{fmt(t.holders_revenue_30d)}</td>
                  <td className="py-2 text-right text-gray-400">{fmt(t.tvl)}</td>
                  <td className={`py-2 text-right font-mono ${t.tvl_change_30d != null ? (t.tvl_change_30d > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                    {t.tvl_change_30d != null ? `${(t.tvl_change_30d * 100) > 0 ? "+" : ""}${(t.tvl_change_30d * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className={`py-2 text-right ${t.fdv_mcap_ratio && t.fdv_mcap_ratio > 3 ? "text-red-400" : t.fdv_mcap_ratio && t.fdv_mcap_ratio > 1.5 ? "text-yellow-400" : "text-green-400"}`}>
                    {t.fdv_mcap_ratio ? `${t.fdv_mcap_ratio.toFixed(1)}x` : "—"}
                  </td>
                  <td className={`py-2 text-right ${t.ps_ratio && t.ps_ratio < 20 ? "text-green-400" : t.ps_ratio && t.ps_ratio < 50 ? "text-yellow-400" : "text-gray-500"}`}>
                    {t.ps_ratio ? (t.ps_ratio > 999 ? "n.m." : `${t.ps_ratio.toFixed(0)}x`) : "—"}
                  </td>
                  <td className={`py-2 text-right font-mono ${(t.nansen_sm_netflow_30d ?? 0) > 1e6 ? "text-green-400" : (t.nansen_sm_netflow_30d ?? 0) < -1e6 ? "text-red-400" : "text-gray-600"}`}>
                    {t.nansen_sm_netflow_30d ? `$${(t.nansen_sm_netflow_30d/1e6).toFixed(1)}M` : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-400">{t.nansen_sm_holders ?? "—"}</td>
                </tr>
                {_isExpanded && (
                  <tr key={`${t.symbol}-detail`}><td colSpan={99} className="p-0"><ResearchDeepDive t={t} /></td></tr>
                )}
                </>);
              })}
              {/* Collapsed low-data tokens */}
              {(() => {
                const lowData = filtered.filter(t => t.data_coverage < 2 && t.side !== "LONG" && t.side !== "SHORT");
                if (lowData.length === 0) return null;
                return (
                  <tr className="border-t border-gray-700">
                    <td colSpan={99} className="py-3 px-2">
                      <details className="text-gray-500">
                        <summary className="cursor-pointer text-xs hover:text-gray-300">
                          {lowData.length} tokens with insufficient data (click to expand)
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {lowData.map(t => (
                            <span key={t.symbol} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800/50 text-[10px] text-gray-500"
                                  title={`Score: ${t.fundamental_score?.toFixed(0) ?? "—"} | FDV/MCap: ${t.fdv_mcap_ratio?.toFixed(1) ?? "—"}x | Sector: ${t.sector || "—"}`}>
                              <span className={t.side === "LONG" || t.side === "LONG_RESEARCH" ? "text-green-600" : t.side === "SHORT" ? "text-red-600" : "text-gray-600"}>
                                {t.symbol.replace("USDT", "")}
                              </span>
                              {t.fdv_mcap_ratio && t.fdv_mcap_ratio > 2 && <span className="text-red-700">{t.fdv_mcap_ratio.toFixed(1)}x</span>}
                            </span>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Thesis Validation + Kingmaker → separate Thesis tab */}
    </div>
  );
}
