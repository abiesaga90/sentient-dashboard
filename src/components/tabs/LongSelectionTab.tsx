import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { useState } from "react";

// ── Types ──

interface LongCandidate {
  symbol: string;
  score: number;
  va_score: number | null;
  sm_score: number | null;
  op_score: number | null;
  mm_score: number | null;
  adjusted_score: number | null;
  confidence: number | null;
  n_signals: number | null;
  n_va?: number;
  n_sm?: number;
  n_p3?: number;
  n_mm?: number;
  tilt?: number;
  volume_24h: number | null;
  market_cap: number | null;
  mcap_rank: number | null;
  sector: string;
  in_basket: boolean;
  in_current: boolean;
  gate_failure: string | null;
}

interface LongSelectionResponse {
  candidates: LongCandidate[];
  recommended_basket: string[];
  current_basket: string[];
  changes: {
    added: string[];
    removed: string[];
    unchanged: number;
  };
  basket_status: string | null;
  version_ts: string | null;
  metadata: Record<string, unknown>;
}

interface Signal {
  value: number | null;
  score: number;
  label: string;
  z_score?: number;
  freshness?: number;
  is_composite?: boolean;
}

interface LongToken {
  symbol: string;
  va_profile?: string;
  tilt: number;
  raw_score: number;
  adjusted_score: number;
  confidence: number;
  va_count: number;
  sm_count: number;
  mm_count?: number;
  has_nansen: boolean;
  market_cap: number | null;
  fees_30d: number | null;
  holders_revenue_30d: number | null;
  signals: Record<string, Signal>;
  mindshare_gainer: number;
  mindshare_loser: number;
  mindshare_delta: number;
  sentiment_score?: number | null;
}

interface AccrualToken {
  symbol: string;
  mechanism: string;
  confidence: string;
  defillama_accurate: boolean;
  corrected_holders_revenue_30d: number | null;
  defillama_holders_revenue_30d: number | null;
}

interface LongSignalsResponse {
  tokens: LongToken[];
  va_weights?: Record<string, number>;
  va_weights_effective?: Record<string, number>;
  config: Record<string, number> & {
    use_supply_composite?: boolean;
    use_zscore?: boolean;
    use_freshness_confidence?: boolean;
  };
  summary?: {
    avg_tilt: number;
    avg_confidence: number;
    total: number;
  };
  nansen_status?: { stale_count: number; oldest_update: string | null };
  mindshare_status?: {
    enabled: boolean;
    gainers_count: number;
    losers_count: number;
  };
}

interface WatchlistEntry {
  symbol: string;
  thesis: string;
  sector: string;
  fundamental_score: number | null;
  fdv: number | null;
  market_cap: number | null;
  float_pct: number | null;
  volume_24h_usd: number | null;
  tvl: number | null;
  revenue_30d: number | null;
  fees_30d: number | null;
  last_updated: string | null;
  selected: boolean;
  in_short_basket: boolean;
}

interface WatchlistResponse {
  conviction_shorts: WatchlistEntry[];
  long_research: WatchlistEntry[];
  watchlist: WatchlistEntry[];
  conviction_count: number;
  research_count: number;
  count: number;
}

interface AccrualResponse {
  tokens: AccrualToken[];
  summary: {
    total_defillama_holders_rev_30d: number;
    total_corrected_holders_rev_30d: number;
    correction_delta: number;
    correction_delta_pct: number | null;
    tokens_with_issues: number;
    by_mechanism: Record<string, number>;
  };
}

// ── Helpers ──

const VA_PROFILE_LABELS: Record<string, string> = {
  l1_platform: "L1", defi: "DeFi", defi_lending: "Lending", defi_dex: "DEX",
  defi_yield: "Yield", ai_compute: "AI", pow_monetary: "PoW", _default: "Other",
};
const VA_PROFILE_COLORS: Record<string, string> = {
  l1_platform: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  defi: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  defi_lending: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  defi_dex: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  defi_yield: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ai_compute: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pow_monetary: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  _default: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const SECTOR_LABELS: Record<string, string> = {
  l1: "L1", l2: "L2", defi: "DeFi", defi_lending: "Lending", defi_dex: "DEX",
  defi_yield: "Yield", ai: "AI", privacy: "Privacy", gaming: "Gaming",
  oracle: "Oracle", storage: "Storage", meme: "Meme", social: "Social",
  infra: "Infra", other: "Other",
};

const fmt = (n: number | null | undefined): string => {
  if (n == null) return "\u2014";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const scoreBar = (score: number | null | undefined, maxWidth = 48) => {
  if (score == null) return <span className="text-gray-600">&mdash;</span>;
  const pct = Math.min(100, Math.abs(score) * 100);
  const color = score > 0 ? "bg-green-500" : score < 0 ? "bg-red-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden" style={{ width: maxWidth }}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs ${score > 0 ? "text-green-400" : score < 0 ? "text-red-400" : "text-gray-500"}`}>
        {score > 0 ? "+" : ""}{score.toFixed(2)}
      </span>
    </div>
  );
};

const pillarBar = (label: string, score: number | null, color: string) => {
  if (score == null) return null;
  const pct = Math.min(100, Math.abs(score) * 100);
  const barColor = score > 0 ? "bg-green-500" : score < 0 ? "bg-red-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <span className={`${color} w-6 text-right`}>{label}</span>
      <div className="h-1 rounded-full bg-gray-800 overflow-hidden w-8">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={score > 0 ? "text-green-400" : score < 0 ? "text-red-400" : "text-gray-600"}>
        {score > 0 ? "+" : ""}{score.toFixed(2)}
      </span>
    </div>
  );
};

const mechanismBadge = (m: string) => {
  const map: Record<string, { variant: "success" | "info" | "warning" | "danger" | "default"; label: string }> = {
    buyback_burn: { variant: "success", label: "Buyback+Burn" },
    buyback_treasury: { variant: "success", label: "Buyback\u2192Treasury" },
    fee_distribution: { variant: "info", label: "Fee Distribution" },
    fee_switch_partial: { variant: "warning", label: "Partial Fee Switch" },
    staking_rewards: { variant: "default", label: "Staking (Inflation)" },
    none: { variant: "danger", label: "None" },
  };
  const entry = map[m] || { variant: "default" as const, label: m };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
};

const SM_SIGNAL_KEYS = new Set([
  "sm_netflow", "sm_holders", "perp_pressure", "perp_funding",
  "dex_net_volume", "dat_accumulation", "arkham_exchange_flow",
  "arkham_fund_flow", "arkham_concentration", "arkham_whale_direction",
]);

// ── Component ──

export function LongSelectionTab() {
  const { client, engine } = useEngine();
  const [expandedCurrent, setExpandedCurrent] = useState<string | null>(null);
  const [expandedProposed, setExpandedProposed] = useState<string | null>(null);

  // Primary data: quantitative long selection
  const { data: selection, isLoading } = useQuery<LongSelectionResponse>({
    queryKey: ["long-selection", engine.id],
    queryFn: () => client.get("/api/long-selection"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  // Signal-level enrichment (tilts, VA/SM breakdown)
  const { data: signals } = useQuery<LongSignalsResponse>({
    queryKey: ["long-signals", engine.id],
    queryFn: () => client.get("/api/long-signals"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  // Value accrual corrections
  const { data: accrual } = useQuery<AccrualResponse>({
    queryKey: ["value-accrual", engine.id],
    queryFn: () => client.get("/api/value-accrual"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  // Fundamentals for ALL tokens (fees, holders_rev, mechanism for non-basket tokens)
  const { data: fundamentals } = useQuery<any[]>({
    queryKey: ["fundamentals-all", engine.id],
    queryFn: () => client.get("/api/fundamentals"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  // Long research watchlist (curated tokens tracked for potential basket inclusion)
  const { data: watchlist } = useQuery<WatchlistResponse>({
    queryKey: ["watchlist", engine.id],
    queryFn: () => client.get("/api/watchlist"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  const signalMap = new Map(signals?.tokens?.map(t => [t.symbol, t]) || []);
  const accrualMap = new Map(accrual?.tokens?.map(t => [t.symbol, t]) || []);
  const _fundTokens = Array.isArray(fundamentals) ? fundamentals : (fundamentals as any)?.tokens || [];
  const fundMap = new Map(_fundTokens.map((t: any) => [t.symbol, t]));

  if (isLoading) {
    return <div className="p-4 text-gray-500 text-sm">Loading long selection...</div>;
  }

  if (!selection?.candidates?.length) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No long selection data available &mdash; waiting for next rebalance to score universe.
      </div>
    );
  }

  const allCandidates = selection.candidates;
  const proposed = allCandidates.filter(c => c.in_basket);
  const current = allCandidates.filter(c => c.in_current);
  const currentSet = new Set(selection.current_basket);
  const proposedSet = new Set(selection.recommended_basket);
  const eligible = allCandidates.filter(c => !c.gate_failure);
  const gated = allCandidates.filter(c => c.gate_failure);

  // Diff computation
  const added = allCandidates.filter(c => c.in_basket && !c.in_current);
  const removed = allCandidates.filter(c => c.in_current && !c.in_basket);
  const unchanged = allCandidates.filter(c => c.in_basket && c.in_current);

  // Sector breakdown of proposed basket
  const sectorCounts: Record<string, number> = {};
  for (const c of proposed) {
    const s = c.sector || "other";
    sectorCounts[s] = (sectorCounts[s] || 0) + 1;
  }

  const avgScore = proposed.length > 0
    ? proposed.reduce((s, c) => s + c.score, 0) / proposed.length
    : 0;
  const avgConfidence = proposed.length > 0
    ? proposed.reduce((s, c) => s + (c.confidence || 0), 0) / proposed.length
    : 0;
  const currentAvgScore = current.length > 0
    ? current.reduce((s, c) => s + c.score, 0) / current.length
    : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Selection Mode Banner */}
      <div className="rounded-lg border border-blue-800/50 bg-blue-950/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-blue-400 font-semibold text-sm">QUANTITATIVE LONG SELECTION</span>
            <Badge variant={selection.basket_status === "APPROVED" ? "success" : selection.basket_status === "PENDING" ? "warning" : "default"}>
              {selection.basket_status || "NO BASKET"}
            </Badge>
          </div>
          {selection.version_ts && (
            <span className="text-[10px] text-gray-500">
              scored {new Date(selection.version_ts).toLocaleString()}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Four-pillar scoring (VA + SM + OP + MM) across full universe. Greedy diversity-penalized selection with sector caps.
          {selection.changes.added.length > 0 || selection.changes.removed.length > 0 ? (
            <span className="ml-2 text-yellow-400">
              {selection.changes.added.length > 0 && `+${selection.changes.added.length} proposed`}
              {selection.changes.added.length > 0 && selection.changes.removed.length > 0 && ", "}
              {selection.changes.removed.length > 0 && `-${selection.changes.removed.length} dropped`}
              {` vs current basket (${selection.changes.unchanged} unchanged)`}
            </span>
          ) : (
            <span className="ml-2 text-green-400">Proposed basket matches current basket.</span>
          )}
        </div>
      </div>

      {/* Nansen / Mindshare Banners */}
      {signals?.nansen_status && signals.nansen_status.stale_count > 0 && (
        <div className="rounded-lg border border-yellow-800/50 bg-yellow-950/30 px-4 py-2 flex items-center gap-2 text-xs text-yellow-400">
          <span className="text-yellow-500 text-sm">&#x26A0;</span>
          Nansen data stale for {signals.nansen_status.stale_count} tokens &mdash; SM signals excluded for stale tokens
        </div>
      )}

      {/* KPI Row — mirrors Short Selection layout */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <KpiCard label="Current Basket" value={String(current.length)} sub="live positions" />
        <KpiCard label="Proposed Basket" value={String(proposed.length)} sub={`of ${eligible.length} eligible`} />
        <KpiCard label="Avg Score" value={avgScore > 0 ? `+${avgScore.toFixed(2)}` : avgScore.toFixed(2)} valueColor={avgScore > 0 ? "text-green-400" : "text-red-400"} sub="higher = stronger" />
        <KpiCard label="Avg Confidence" value={`${(avgConfidence * 100).toFixed(0)}%`} />
        <KpiCard
          label="Changes"
          value={`+${added.length} / -${removed.length}`}
          valueColor={added.length > 0 || removed.length > 0 ? "text-yellow-400" : "text-gray-500"}
          sub={`${unchanged.length} unchanged`}
        />
        <KpiCard label="Universe Scored" value={String(allCandidates.length)} sub={`${gated.length} gated out`} />
      </div>

      {/* ─── SECTION 1: Current Long Basket ─── */}
      <Card className="border-gray-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>1. Current Long Basket ({current.length})</CardTitle>
              <span className="text-[10px] text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded">LIVE</span>
            </div>
            <span className="text-[10px] text-gray-500">Avg score: {currentAvgScore > 0 ? "+" : ""}{currentAvgScore.toFixed(2)}</span>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pl-2">#</th>
                <th className="text-left py-2">Token</th>
                <th className="text-left py-2">Sector</th>
                <th className="text-left py-2">Mechanism</th>
                <th className="text-right py-2">Score</th>
                <th className="text-center py-2">VA / SM / OP / MM</th>
                <th className="text-right py-2">Confidence</th>
                <th className="text-right py-2">Tilt</th>
                <th className="text-right py-2">Fees 30d</th>
                <th className="text-right py-2">Holders Rev</th>
                <th className="text-right py-2">MCap Rank</th>
                <th className="text-right py-2">Volume 24h</th>
                <th className="text-center py-2">Proposed</th>
              </tr>
            </thead>
            <tbody>
              {current.sort((a, b) => b.score - a.score).map((c, i) => {
                const sym = c.symbol;
                const sig = signalMap.get(sym);
                const fund = fundMap.get(sym) as any;
                const acc = accrualMap.get(sym);
                const staysIn = proposedSet.has(sym);
                const isExpanded = expandedCurrent === sym;
                const profile = sig?.va_profile || "_default";
                return (
                  <>
                    <tr
                      key={sym}
                      className={`border-b border-gray-800/50 hover:bg-white/[0.02] cursor-pointer ${!staysIn ? "bg-red-950/15" : ""}`}
                      onClick={() => setExpandedCurrent(isExpanded ? null : sym)}
                    >
                      <td className="py-2.5 pl-2 text-gray-600">{i + 1}</td>
                      <td className="py-2.5">
                        <span className="font-medium text-gray-200">{sym.replace("USDT", "")}</span>
                        {sig?.va_profile && (() => {
                          const label = VA_PROFILE_LABELS[profile] || profile;
                          const color = VA_PROFILE_COLORS[profile] || VA_PROFILE_COLORS._default;
                          return <span className={`ml-1.5 inline-block text-[9px] font-medium px-1.5 py-0.5 rounded border ${color}`}>{label}</span>;
                        })()}
                        {!staysIn && <span className="ml-1.5 text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">DROPPING</span>}
                      </td>
                      <td className="py-2.5 text-gray-400">{SECTOR_LABELS[c.sector] || c.sector}</td>
                      <td className="py-2.5">{acc ? mechanismBadge(acc.mechanism) : fund?.mechanism ? mechanismBadge(fund.mechanism) : <span className="text-gray-600">&mdash;</span>}</td>
                      <td className="py-2.5 text-right">{scoreBar(c.score)}</td>
                      <td className="py-2.5 text-center">
                        <span className="text-purple-400">{c.n_va ?? sig?.va_count ?? "?"}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-blue-400">{c.n_sm ?? sig?.sm_count ?? "?"}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-orange-400">{c.n_p3 ?? (c.op_score != null ? "1" : "0")}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-cyan-400">{c.n_mm ?? sig?.mm_count ?? "?"}</span>
                      </td>
                      <td className="py-2.5 text-right text-gray-400">{c.confidence != null ? `${(c.confidence * 100).toFixed(0)}%` : "\u2014"}</td>
                      <td className="py-2.5 text-right">
                        {(() => {
                          const tilt = c.tilt ?? sig?.tilt;
                          if (tilt == null) return <span className="text-gray-600">&mdash;</span>;
                          return <span className={`font-mono font-semibold ${tilt >= 1.3 ? "text-green-400" : tilt >= 1.1 ? "text-green-300" : tilt <= 0.9 ? "text-red-400" : "text-gray-300"}`}>{tilt.toFixed(2)}x</span>;
                        })()}
                      </td>
                      <td className="py-2.5 text-right text-gray-400">{sig ? fmt(sig.fees_30d) : fund?.fees_30d ? fmt(fund.fees_30d) : "\u2014"}</td>
                      <td className="py-2.5 text-right">
                        {acc && acc.corrected_holders_revenue_30d != null && acc.corrected_holders_revenue_30d !== acc.defillama_holders_revenue_30d ? (
                          <span className="text-yellow-400">{fmt(acc.corrected_holders_revenue_30d)}</span>
                        ) : sig ? (
                          <span className="text-gray-400">{fmt(sig.holders_revenue_30d)}</span>
                        ) : fund?.holders_revenue_30d ? (
                          <span className="text-gray-400">{fmt(fund.holders_revenue_30d)}</span>
                        ) : "\u2014"}
                      </td>
                      <td className="py-2.5 text-right text-gray-400">#{c.mcap_rank ?? "\u2014"}</td>
                      <td className="py-2.5 text-right text-gray-400">{fmt(c.volume_24h)}</td>
                      <td className="py-2.5 text-center">
                        {staysIn
                          ? <Badge variant="success">KEEP</Badge>
                          : <Badge variant="danger">DROP</Badge>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${sym}-detail`}>
                        <td colSpan={13} className="py-3 px-4 bg-gray-900/30">
                          <div className="grid md:grid-cols-3 gap-4">
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">VA: Value Accrual ({c.n_va ?? "?"} signals)</div>
                              <div className="space-y-1.5">
                                {sig ? Object.entries(sig.signals)
                                  .filter(([k]) => !SM_SIGNAL_KEYS.has(k) && k !== "supply_health" && !k.startsWith("p3_"))
                                  .map(([key, s]) => (
                                    <div key={key} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-400 truncate flex-1">{s.label}</span>
                                      {scoreBar(s.score, 48)}
                                    </div>
                                  )) : (
                                  <div className="text-xs">
                                    {pillarBar("VA composite", c.va_score, "text-purple-400")}
                                    {acc && <div className="mt-1 text-gray-500">Mechanism: {acc.mechanism || "unknown"}</div>}
                                    {acc && acc.corrected_holders_revenue_30d != null && <div className="text-gray-500">Holders rev: {fmt(acc.corrected_holders_revenue_30d)}/mo</div>}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">SM: Smart Money ({c.n_sm ?? "?"} signals)</div>
                              <div className="space-y-1.5">
                                {sig ? Object.entries(sig.signals)
                                  .filter(([k]) => SM_SIGNAL_KEYS.has(k))
                                  .map(([key, s]) => (
                                    <div key={key} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-400 truncate flex-1">{s.label}</span>
                                      {scoreBar(s.score, 48)}
                                    </div>
                                  )) : (
                                  <div className="text-xs">
                                    {pillarBar("SM composite", c.sm_score, "text-blue-400")}
                                  </div>
                                )}
                                {(sig?.sm_count === 0 || (!sig && (c.n_sm ?? 0) === 0)) && <div className="text-xs text-gray-600">No SM data</div>}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Pillar Scores</div>
                              <div className="space-y-1.5">
                                {pillarBar("VA", c.va_score, "text-purple-400")}
                                {pillarBar("SM", c.sm_score, "text-blue-400")}
                                {pillarBar("OP", c.op_score, "text-orange-400")}
                                {pillarBar("MM", c.mm_score, "text-cyan-400")}
                                <div className="pt-1.5 border-t border-gray-800 text-[10px] text-gray-500 font-mono">
                                  {sig ? (
                                    <>raw={sig.raw_score.toFixed(3)} x conf={sig.confidence.toFixed(2)} = adj={sig.adjusted_score.toFixed(3)} &rarr; tilt={sig.tilt.toFixed(2)}x</>
                                  ) : (
                                    <>adj={c.adjusted_score?.toFixed(3)} | conf={c.confidence != null ? (c.confidence * 100).toFixed(0) + "%" : "?"} | signals={c.n_signals}</>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── SECTION 2: Proposed Long Basket ─── */}
      <Card className="border-blue-800/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>2. Proposed Long Basket ({proposed.length})</CardTitle>
              <span className="text-[10px] text-blue-400 bg-blue-800/30 px-2 py-0.5 rounded">RECOMMENDED</span>
            </div>
            <span className="text-[10px] text-gray-500">Avg score: {avgScore > 0 ? "+" : ""}{avgScore.toFixed(2)}</span>
          </div>
        </CardHeader>

        {/* Sector Diversity */}
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {Object.entries(sectorCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([sector, count]) => (
                <div key={sector} className="flex items-center gap-1.5 bg-gray-900/50 rounded px-2.5 py-1 text-xs">
                  <span className="text-gray-400">{SECTOR_LABELS[sector] || sector}</span>
                  <span className="font-mono font-semibold text-gray-200">{count}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pl-2">#</th>
                <th className="text-left py-2">Token</th>
                <th className="text-left py-2">Sector</th>
                <th className="text-left py-2">Mechanism</th>
                <th className="text-right py-2">Score</th>
                <th className="text-center py-2">VA / SM / OP / MM</th>
                <th className="text-right py-2">Confidence</th>
                <th className="text-right py-2">Tilt</th>
                <th className="text-right py-2">Fees 30d</th>
                <th className="text-right py-2">Holders Rev</th>
                <th className="text-right py-2">MCap Rank</th>
                <th className="text-right py-2">Volume 24h</th>
                <th className="text-center py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {proposed.sort((a, b) => b.score - a.score).map((c, i) => {
                const sym = c.symbol;
                const sig = signalMap.get(sym);
                const acc = accrualMap.get(sym);
                const fund = fundMap.get(sym) as any;
                const isNew = !currentSet.has(sym);
                const isExpanded = expandedProposed === sym;
                const profile = sig?.va_profile || "_default";

                return (
                  <>
                    <tr
                      key={sym}
                      className={`border-b border-gray-800/50 hover:bg-white/[0.02] cursor-pointer ${isNew ? "bg-green-950/20" : ""}`}
                      onClick={() => setExpandedProposed(isExpanded ? null : sym)}
                    >
                      <td className="py-2.5 pl-2 text-gray-600">{i + 1}</td>
                      <td className="py-2.5">
                        <span className="font-medium text-gray-200">{sym.replace("USDT", "")}</span>
                        {sig?.va_profile && (() => {
                          const label = VA_PROFILE_LABELS[profile] || profile;
                          const color = VA_PROFILE_COLORS[profile] || VA_PROFILE_COLORS._default;
                          return <span className={`ml-1.5 inline-block text-[9px] font-medium px-1.5 py-0.5 rounded border ${color}`}>{label}</span>;
                        })()}
                        {isNew && <span className="ml-1.5 text-[9px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">NEW</span>}
                      </td>
                      <td className="py-2.5 text-gray-400">{SECTOR_LABELS[c.sector] || c.sector}</td>
                      <td className="py-2.5">{acc ? mechanismBadge(acc.mechanism) : fund?.mechanism ? mechanismBadge(fund.mechanism) : <span className="text-gray-600">&mdash;</span>}</td>
                      <td className="py-2.5 text-right">{scoreBar(c.score)}</td>
                      <td className="py-2.5 text-center">
                        <span className="text-purple-400">{c.n_va ?? sig?.va_count ?? "?"}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-blue-400">{c.n_sm ?? sig?.sm_count ?? "?"}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-orange-400">{c.n_p3 ?? (c.op_score != null ? "1" : "0")}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-cyan-400">{c.n_mm ?? sig?.mm_count ?? "?"}</span>
                      </td>
                      <td className="py-2.5 text-right text-gray-400">{c.confidence != null ? `${(c.confidence * 100).toFixed(0)}%` : "\u2014"}</td>
                      <td className="py-2.5 text-right">
                        {(() => {
                          const tilt = c.tilt ?? sig?.tilt;
                          if (tilt == null) return <span className="text-gray-600">&mdash;</span>;
                          return (
                            <span className={`font-mono font-semibold ${tilt >= 1.3 ? "text-green-400" : tilt >= 1.1 ? "text-green-300" : tilt <= 0.9 ? "text-red-400" : "text-gray-300"}`}>
                              {tilt.toFixed(2)}x
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 text-right text-gray-400">{sig ? fmt(sig.fees_30d) : fund?.fees_30d ? fmt(fund.fees_30d) : "\u2014"}</td>
                      <td className="py-2.5 text-right">
                        {acc && acc.corrected_holders_revenue_30d != null && acc.corrected_holders_revenue_30d !== acc.defillama_holders_revenue_30d ? (
                          <span className="text-yellow-400">{fmt(acc.corrected_holders_revenue_30d)}</span>
                        ) : sig ? (
                          <span className="text-gray-400">{fmt(sig.holders_revenue_30d)}</span>
                        ) : fund?.holders_revenue_30d ? (
                          <span className="text-gray-400">{fmt(fund.holders_revenue_30d)}</span>
                        ) : "\u2014"}
                      </td>
                      <td className="py-2.5 text-right text-gray-400">#{c.mcap_rank ?? "\u2014"}</td>
                      <td className="py-2.5 text-right text-gray-400">{fmt(c.volume_24h)}</td>
                      <td className="py-2.5 text-center">
                        {c.in_current
                          ? <Badge variant="default">ACTIVE</Badge>
                          : <Badge variant="success">NEW</Badge>}
                      </td>
                    </tr>
                    {/* Expanded signal detail */}
                    {isExpanded && (
                      <tr key={`${sym}-detail`}>
                        <td colSpan={13} className="py-3 px-4 bg-gray-900/30">
                          <div className="grid md:grid-cols-3 gap-4">
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">VA: Value Accrual ({c.n_va ?? "?"} signals)</div>
                              <div className="space-y-1.5">
                                {sig ? Object.entries(sig.signals)
                                  .filter(([k]) => !SM_SIGNAL_KEYS.has(k) && k !== "supply_health" && !k.startsWith("p3_"))
                                  .map(([key, s]) => (
                                    <div key={key} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-400 truncate flex-1">{s.label}</span>
                                      {scoreBar(s.score, 48)}
                                    </div>
                                  )) : (
                                  <div className="text-xs">
                                    {pillarBar("VA composite", c.va_score, "text-purple-400")}
                                    {acc && <div className="mt-1 text-gray-500">Mechanism: {acc.mechanism || "unknown"}</div>}
                                    {acc && acc.corrected_holders_revenue_30d != null && <div className="text-gray-500">Holders rev: {fmt(acc.corrected_holders_revenue_30d)}/mo</div>}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">SM: Smart Money ({c.n_sm ?? "?"} signals)</div>
                              <div className="space-y-1.5">
                                {sig ? Object.entries(sig.signals)
                                  .filter(([k]) => SM_SIGNAL_KEYS.has(k))
                                  .map(([key, s]) => (
                                    <div key={key} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-400 truncate flex-1">{s.label}</span>
                                      {scoreBar(s.score, 48)}
                                    </div>
                                  )) : (
                                  <div className="text-xs">
                                    {pillarBar("SM composite", c.sm_score, "text-blue-400")}
                                  </div>
                                )}
                                {(sig?.sm_count === 0 || (!sig && (c.n_sm ?? 0) === 0)) && <div className="text-xs text-gray-600">No SM data</div>}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Pillar Scores</div>
                              <div className="space-y-1.5">
                                {pillarBar("VA", c.va_score, "text-purple-400")}
                                {pillarBar("SM", c.sm_score, "text-blue-400")}
                                {pillarBar("OP", c.op_score, "text-orange-400")}
                                {pillarBar("MM", c.mm_score, "text-cyan-400")}
                                <div className="pt-1.5 border-t border-gray-800 text-[10px] text-gray-500 font-mono">
                                  {sig ? (
                                    <>raw={sig.raw_score.toFixed(3)} x conf={sig.confidence.toFixed(2)} = adj={sig.adjusted_score.toFixed(3)} &rarr; tilt={sig.tilt.toFixed(2)}x</>
                                  ) : (
                                    <>adj={c.adjusted_score?.toFixed(3)} | conf={c.confidence != null ? (c.confidence * 100).toFixed(0) + "%" : "?"} | signals={c.n_signals}</>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── SECTION 3: Basket Changes ─── */}
      <Card className={added.length > 0 || removed.length > 0 ? "border-yellow-800/30" : "border-green-800/30"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>3. Basket Changes</CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-400">+{added.length} added</span>
              <span className="text-red-400">&minus;{removed.length} removed</span>
              <span className="text-gray-500">{unchanged.length} unchanged</span>
            </div>
          </div>
        </CardHeader>

        {added.length === 0 && removed.length === 0 ? (
          <div className="px-4 pb-4 text-xs text-green-400">
            No changes &mdash; proposed basket matches current basket.
          </div>
        ) : (
          <div className="space-y-3 px-4 pb-4">
            {/* Added */}
            {added.length > 0 && (
              <div>
                <div className="text-[10px] text-green-400 uppercase tracking-wider mb-2 font-semibold">Entering Basket ({added.length})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="text-left py-1.5 pl-2">Token</th>
                        <th className="text-left py-1.5">Sector</th>
                        <th className="text-right py-1.5">Score</th>
                        <th className="text-center py-1.5">VA / SM / OP / MM</th>
                        <th className="text-right py-1.5">Confidence</th>
                        <th className="text-right py-1.5">Volume 24h</th>
                        <th className="text-left py-1.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {added.sort((a, b) => b.score - a.score).map(c => (
                        <tr key={c.symbol} className="border-b border-gray-800/50 bg-green-950/15">
                          <td className="py-1.5 pl-2 font-medium text-gray-200">{c.symbol.replace("USDT", "")}</td>
                          <td className="py-1.5 text-gray-400">{SECTOR_LABELS[c.sector] || c.sector}</td>
                          <td className="py-1.5 text-right">{scoreBar(c.score)}</td>
                          <td className="py-1.5 text-center">
                            {pillarBar("VA", c.va_score, "text-purple-400")}
                            {pillarBar("SM", c.sm_score, "text-blue-400")}
                            {pillarBar("OP", c.op_score, "text-orange-400")}
                            {pillarBar("MM", c.mm_score, "text-cyan-400")}
                          </td>
                          <td className="py-1.5 text-right text-gray-400">{c.confidence != null ? `${(c.confidence * 100).toFixed(0)}%` : "\u2014"}</td>
                          <td className="py-1.5 text-right text-gray-400">{fmt(c.volume_24h)}</td>
                          <td className="py-1.5 text-green-400 text-[10px]">Outscored current member</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Removed */}
            {removed.length > 0 && (
              <div>
                <div className="text-[10px] text-red-400 uppercase tracking-wider mb-2 font-semibold">Leaving Basket ({removed.length})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="text-left py-1.5 pl-2">Token</th>
                        <th className="text-left py-1.5">Sector</th>
                        <th className="text-right py-1.5">Score</th>
                        <th className="text-center py-1.5">VA / SM / OP / MM</th>
                        <th className="text-right py-1.5">Confidence</th>
                        <th className="text-right py-1.5">Volume 24h</th>
                        <th className="text-left py-1.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {removed.sort((a, b) => a.score - b.score).map(c => (
                        <tr key={c.symbol} className="border-b border-gray-800/50 bg-red-950/15">
                          <td className="py-1.5 pl-2 font-medium text-gray-300">{c.symbol.replace("USDT", "")}</td>
                          <td className="py-1.5 text-gray-400">{SECTOR_LABELS[c.sector] || c.sector}</td>
                          <td className="py-1.5 text-right">{scoreBar(c.score)}</td>
                          <td className="py-1.5 text-center">
                            {pillarBar("VA", c.va_score, "text-purple-400")}
                            {pillarBar("SM", c.sm_score, "text-blue-400")}
                            {pillarBar("OP", c.op_score, "text-orange-400")}
                            {pillarBar("MM", c.mm_score, "text-cyan-400")}
                          </td>
                          <td className="py-1.5 text-right text-gray-400">{c.confidence != null ? `${(c.confidence * 100).toFixed(0)}%` : "\u2014"}</td>
                          <td className="py-1.5 text-right text-gray-400">{fmt(c.volume_24h)}</td>
                          <td className="py-1.5 text-red-400 text-[10px]">{c.gate_failure || "Outscored by new candidate"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ─── SECTION 4: Long Research Watchlist ─── */}
      {watchlist && watchlist.long_research && watchlist.long_research.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>4. Long Research Watchlist ({watchlist.long_research.length})</CardTitle>
              <span className="text-[10px] text-gray-500">curated candidates tracked for potential basket inclusion</span>
            </div>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-1.5 pl-2">Token</th>
                    <th className="text-left py-1.5">Sector</th>
                    <th className="text-right py-1.5">MCap</th>
                    <th className="text-right py-1.5">FDV</th>
                    <th className="text-right py-1.5">MC/FDV</th>
                    <th className="text-right py-1.5">24h Vol</th>
                    <th className="text-right py-1.5">Fees 30d</th>
                    <th className="text-right py-1.5">Holder Rev 30d</th>
                    <th className="text-left py-1.5 pl-3">Thesis</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlist.long_research.map((w) => {
                    const ratio = w.market_cap && w.fdv ? w.market_cap / w.fdv : null;
                    const ratioColor =
                      ratio == null ? "text-gray-600" :
                      ratio >= 0.5 ? "text-green-400" :
                      ratio >= 0.3 ? "text-yellow-400" : "text-red-400";
                    return (
                      <tr key={w.symbol} className="border-b border-gray-900 hover:bg-gray-900/30">
                        <td className="py-1.5 pl-2 font-medium text-gray-200">
                          {w.symbol.replace("USDT", "")}
                        </td>
                        <td className="py-1.5 text-gray-400 capitalize">
                          {w.sector === "long_research" ? "—" : w.sector.replace(/_/g, " ")}
                        </td>
                        <td className="py-1.5 text-right text-gray-300 font-mono">
                          {fmt(w.market_cap)}
                        </td>
                        <td className="py-1.5 text-right text-gray-300 font-mono">
                          {fmt(w.fdv)}
                        </td>
                        <td className={`py-1.5 text-right font-mono ${ratioColor}`}>
                          {ratio != null ? ratio.toFixed(2) : "—"}
                        </td>
                        <td className="py-1.5 text-right text-gray-400 font-mono">
                          {fmt(w.volume_24h_usd)}
                        </td>
                        <td className="py-1.5 text-right text-gray-400 font-mono">
                          {fmt(w.fees_30d)}
                        </td>
                        <td className="py-1.5 text-right text-gray-400 font-mono">
                          {fmt(w.revenue_30d)}
                        </td>
                        <td className="py-1.5 pl-3 text-gray-500 text-[11px] max-w-[420px]">
                          {w.thesis}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Scoring Architecture */}
      <Card>
        <CardHeader><CardTitle>Scoring Architecture</CardTitle></CardHeader>
        <div className="space-y-3">
          <div className="bg-gray-900/50 rounded p-3 text-xs font-mono text-gray-300 space-y-1">
            <div>raw_score = VA_w &times; va_score + SM_w &times; sm_score + OP_w &times; op_score + MM_w &times; mm_score</div>
            <div>adjusted_score = raw_score &times; confidence &times; aggression</div>
            <div className="text-gray-500">Greedy selection: pick top N by adjusted_score with diversity penalty (&lambda; &times; avg_corr) and sector caps</div>
          </div>

          {/* VA Weights */}
          {signals?.va_weights_effective && (
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                VA: Value Accrual Weights
                {signals.config?.use_supply_composite && <span className="text-purple-400 ml-2">(Supply Health composite active)</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(signals.va_weights_effective).map(([key, weight]) => (
                  <div key={key} className={`flex items-center justify-between rounded px-2 py-1.5 ${key === "supply_health" ? "bg-purple-900/30 border border-purple-800/30" : "bg-gray-900/50"}`}>
                    <span className={`text-[11px] ${key === "supply_health" ? "text-purple-300" : "text-gray-400"}`}>{key.replace(/_/g, " ")}</span>
                    <span className="text-xs font-medium text-gray-200">{(weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selection Parameters */}
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Selection Parameters</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              {[
                { label: "Basket Size", value: `${proposed.length} / ${selection.recommended_basket.length} target` },
                { label: "Min Volume", value: "$3M" },
                { label: "Min MCap", value: "$100M" },
                { label: "Max Per Sector", value: "4" },
                { label: "Diversity Penalty", value: "0.15" },
                { label: "Diversity Cap", value: "0.90" },
                { label: "Min Signals", value: "3" },
                { label: "Score Floor", value: "> 0" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-gray-200 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Value Accrual Summary */}
      {accrual && accrual.summary.tokens_with_issues > 0 && (
        <Card className="border-yellow-800/30">
          <CardHeader><CardTitle>Value Accrual Data Quality</CardTitle></CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-gray-600">DefiLlama Total</span><br />
              <span className="text-gray-300">{fmt(accrual.summary.total_defillama_holders_rev_30d)}/mo</span>
            </div>
            <div>
              <span className="text-gray-600">Corrected Total</span><br />
              <span className="text-green-400">{fmt(accrual.summary.total_corrected_holders_rev_30d)}/mo</span>
            </div>
            <div>
              <span className="text-gray-600">Delta</span><br />
              <span className="text-yellow-400">+{fmt(accrual.summary.correction_delta)} ({accrual.summary.correction_delta_pct?.toFixed(1)}%)</span>
            </div>
            <div>
              <span className="text-gray-600">Tokens with Issues</span><br />
              <span className="text-red-400">{accrual.summary.tokens_with_issues}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(accrual.summary.by_mechanism).map(([m, count]) => (
              <div key={m} className="flex items-center gap-1 text-[10px]">
                {mechanismBadge(m)} <span className="text-gray-500">&times;{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
