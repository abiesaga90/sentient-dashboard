import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { useState } from "react";

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
}

interface FundResponse {
  tokens: FundToken[];
  summary: {
    long_avg_score: number;
    short_avg_score: number;
    score_spread: number;
    long_total_holders_rev_30d: number;
    short_total_holders_rev_30d: number;
    long_avg_fee_momentum: number | null;
    short_avg_fee_momentum: number | null;
  };
  alerts: { symbol: string; type: string; value: number; message: string }[];
}

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

const pctColor = (p: number | null, inverted = false) => {
  if (p == null) return "text-gray-600";
  const good = inverted ? p < 0 : p > 0;
  return good ? "text-green-400" : p === 0 ? "text-gray-400" : "text-red-400";
};

export function FundamentalsTab() {
  const { client, engine } = useEngine();
  const [sideFilter, setSideFilter] = useState<"ALL" | "LONG" | "SHORT" | "LONG_RESEARCH" | "SHORT_UNIVERSE" | "EXCLUDED">("ALL");
  const [sortCol, setSortCol] = useState<string>("fundamental_score");
  const [sortDesc, setSortDesc] = useState(true);

  const { data, isLoading } = useQuery<FundResponse>({
    queryKey: ["fundamentals", engine.id],
    queryFn: () => client.get("/api/fundamentals"),
    refetchInterval: 120_000,
    staleTime: 60_000,
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

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDesc(!sortDesc);
    else { setSortCol(col); setSortDesc(true); }
  };

  const th = (label: string, col: string, align = "text-right") => (
    <th className={`py-2 ${align} cursor-pointer hover:text-gray-300 select-none`} onClick={() => toggleSort(col)}>
      {label} {sortCol === col ? (sortDesc ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div className="p-4 space-y-4">
      {/* KPI Row — lead with the signal thesis */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Long Avg Score" value={`${data.summary.long_avg_score.toFixed(0)}`} valueColor="text-green-400" />
        <KpiCard label="Short Avg Score" value={`${data.summary.short_avg_score.toFixed(0)}`} valueColor="text-red-400" />
        <KpiCard label="Score Spread" value={`${data.summary.score_spread.toFixed(0)} pts`} sub="Long - Short (wider = better)" valueColor={data.summary.score_spread > 20 ? "text-green-400" : "text-yellow-400"} />
        <KpiCard label="Long Holders Rev" value={fmt(data.summary.long_total_holders_rev_30d)} sub="30d total to token holders" valueColor="text-green-400" />
        <KpiCard label="Short Holders Rev" value={fmt(data.summary.short_total_holders_rev_30d)} sub="30d (should be ~$0)" valueColor={data.summary.short_total_holders_rev_30d < 1000000 ? "text-green-400" : "text-red-400"} />
        <KpiCard label="Fee Momentum" value={`L:${data.summary.long_avg_fee_momentum?.toFixed(0) ?? "—"}% S:${data.summary.short_avg_fee_momentum?.toFixed(0) ?? "—"}%`} sub="30d fee trend" />
      </div>

      {/* Signal Thesis */}
      <Card className="border-purple-800/30">
        <div className="text-xs text-gray-400">
          <span className="text-purple-400 font-medium">Strategy Thesis: </span>
          Long basket generates real revenue flowing to token holders (buybacks, burns, distributions). Short basket generates zero.
          The score spread ({data.summary.score_spread.toFixed(0)} pts) quantifies this divergence.
          {data.summary.score_spread > 30 ? " Currently strong separation." : data.summary.score_spread > 15 ? " Moderate separation." : " Narrow — monitor for convergence risk."}
        </div>
      </Card>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <Card className="border-red-800/30">
          <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
          <div className="space-y-1">
            {data.alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant={a.type === "fee_momentum" ? "warning" : "danger"}>{a.symbol.replace("USDT", "")}</Badge>
                <span className="text-gray-400">{a.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter */}
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

      {/* Main Table — signal-relevant columns first */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pl-2">Token</th>
                <th className="text-left py-2">Side</th>
                {th("Score", "fundamental_score")}
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
                  <td className="py-2 pl-2 font-medium text-gray-200">{t.symbol.replace("USDT", "")}</td>
                  <td className="py-2">
                    <Badge variant={t.side === "LONG" || t.side === "LONG_RESEARCH" ? "success" : t.side === "SHORT" ? "danger" : "default"}>{sideLabel[t.side] ?? t.side}</Badge>
                  </td>
                  <td className={`py-2 text-right font-mono font-semibold ${scoreColor(t.fundamental_score)}`}>
                    {t.fundamental_score?.toFixed(0) ?? "—"}
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
    </div>
  );
}
