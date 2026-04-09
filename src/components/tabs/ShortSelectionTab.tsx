import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import type { RankingCandidate, RankingsResponse } from "../../types/api";

// ── Helpers ──

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
  const color = score > 0 ? "bg-red-500" : score < 0 ? "bg-green-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden" style={{ width: maxWidth }}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs ${score > 0 ? "text-red-400" : score < 0 ? "text-green-400" : "text-gray-500"}`}>
        {score > 0 ? "+" : ""}{score.toFixed(2)}
      </span>
    </div>
  );
};

const pillarBar = (label: string, score: number | null | undefined, color: string) => {
  if (score == null) return null;
  const pct = Math.min(100, Math.abs(score) * 100);
  const barColor = score > 0 ? "bg-red-500" : score < 0 ? "bg-green-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <span className={`${color} w-6 text-right`}>{label}</span>
      <div className="h-1 rounded-full bg-gray-800 overflow-hidden w-8">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={score > 0 ? "text-red-400" : score < 0 ? "text-green-400" : "text-gray-600"}>
        {score > 0 ? "+" : ""}{score.toFixed(2)}
      </span>
    </div>
  );
};

// For shorts: higher inverted score = weaker fundamentals = better short
const shortScoreColor = (score: number) =>
  score > 0.3 ? "text-red-400" : score > 0.1 ? "text-red-300" : "text-gray-300";

// ── Component ──

export function ShortSelectionTab() {
  const { client, engine } = useEngine();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery<RankingsResponse>({
    queryKey: ["rankings", engine.id],
    queryFn: () => client.get("/api/rankings", { limit: 200 }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="p-4 text-gray-500 text-sm">Loading short selection...</div>;
  }

  if (!data?.candidates?.length) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No short selection data available &mdash; waiting for next rotation to score universe.
      </div>
    );
  }

  // Split into proposed basket vs rest
  const proposed = data.candidates.filter(c => (c.status || []).includes("in_targets"));
  const eligible = data.candidates.filter(c => !c.gate_failure && !(c.filter_reasons?.length));
  const gated = data.candidates.filter(c => c.gate_failure || (c.filter_reasons?.length));

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
    ? proposed.reduce((s, c) => s + (c.fund_confidence || 0), 0) / proposed.length
    : 0;
  const avgCorr = proposed.length > 0
    ? proposed.reduce((s, c) => s + (c.corr || 0), 0) / proposed.length
    : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Selection Mode Banner */}
      <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-400 font-semibold text-sm">QUANTITATIVE SHORT SELECTION</span>
            <Badge variant="danger">INVERTED 4-PILLAR</Badge>
          </div>
          {data.timestamp && (
            <span className="text-[10px] text-gray-500">
              scored {new Date(data.timestamp).toLocaleString()}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Shorts ranked by inverted four-pillar scoring (VA + SM + OP + MM). Weak fundamentals + institutional distribution = strong short signal.
          Greedy diversity-penalized selection with correlation/beta gates and sector hedging.
          Target: 2&times; long basket size ({data.n_shorts} shorts).
        </div>
      </div>

      {/* Nansen Staleness Banner */}
      {data.nansen_status && data.nansen_status.stale_count > 0 && (
        <div className="rounded-lg border border-yellow-800/50 bg-yellow-950/30 px-4 py-2 flex items-center gap-2 text-xs text-yellow-400">
          <span className="text-yellow-500 text-sm">&#x26A0;</span>
          Nansen data stale for {data.nansen_status.stale_count} tokens &mdash; SM signals excluded for stale tokens
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Proposed Basket" value={String(proposed.length)} sub={`target: ${data.n_shorts}`} />
        <KpiCard
          label="Avg Score"
          value={avgScore > 0 ? `+${avgScore.toFixed(2)}` : avgScore.toFixed(2)}
          valueColor="text-red-400"
          sub="inverted (higher = weaker)"
        />
        <KpiCard label="Avg Confidence" value={`${(avgConfidence * 100).toFixed(0)}%`} />
        <KpiCard
          label="Avg Correlation"
          value={avgCorr.toFixed(2)}
          valueColor={avgCorr > 0.5 ? "text-green-400" : "text-yellow-400"}
          sub="to long basket"
        />
        <KpiCard label="Universe Scored" value={String(data.count)} sub={`of ${data.universe_size}`} />
        <KpiCard label="Signals" value={`${proposed.length > 0 ? (proposed.reduce((s, c) => s + c.n_fund_signals, 0) / proposed.length).toFixed(0) : 0} avg`} sub="per token" />
      </div>

      {/* Sector Diversity */}
      <Card>
        <CardHeader><CardTitle>Sector Diversity</CardTitle></CardHeader>
        <div className="flex flex-wrap gap-2">
          {Object.entries(sectorCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([sector, count]) => (
              <div key={sector} className="flex items-center gap-1.5 bg-gray-900/50 rounded px-2.5 py-1.5 text-xs">
                <span className="text-gray-400">{SECTOR_LABELS[sector] || sector}</span>
                <span className="font-mono font-semibold text-gray-200">{count}</span>
              </div>
            ))}
        </div>
      </Card>

      {/* Proposed Short Basket */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Proposed Short Basket ({proposed.length})</CardTitle>
            <span className="text-[10px] text-gray-500">Sorted by inverted score descending &mdash; higher = weaker fundamentals</span>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pl-2">#</th>
                <th className="text-left py-2">Token</th>
                <th className="text-left py-2">Sector</th>
                <th className="text-right py-2">Score</th>
                <th className="text-center py-2">VA / SM / OP / MM</th>
                <th className="text-right py-2">Confidence</th>
                <th className="text-right py-2">Corr</th>
                <th className="text-right py-2">Beta</th>
                <th className="text-right py-2">FDV/MCap</th>
                <th className="text-right py-2">Volume 24h</th>
                <th className="text-right py-2">MCap #</th>
                <th className="text-right py-2">Mindshare</th>
              </tr>
            </thead>
            <tbody>
              {proposed
                .sort((a, b) => b.score - a.score)
                .map((c, i) => {
                  const isExpanded = expanded === c.symbol;

                  return (
                    <>
                      <tr
                        key={c.symbol}
                        className="border-b border-gray-800/50 hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => setExpanded(isExpanded ? null : c.symbol)}
                      >
                        <td className="py-2.5 pl-2 text-gray-600">{i + 1}</td>
                        <td className="py-2.5">
                          <span className="font-medium text-gray-200">{c.symbol.replace("USDT", "")}</span>
                          {c.sector && (
                            <span className="ml-1.5 inline-block text-[9px] font-medium px-1.5 py-0.5 rounded border bg-gray-500/20 text-gray-400 border-gray-500/30">
                              {SECTOR_LABELS[c.sector] || c.sector}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-gray-400">{SECTOR_LABELS[c.sector || "other"] || c.sector}</td>
                        <td className="py-2.5 text-right">{scoreBar(c.score)}</td>
                        <td className="py-2.5 text-center text-[10px]">
                          <span className="text-purple-400">{c.va_score != null ? Math.abs(c.va_score).toFixed(1) : "?"}</span>
                          <span className="text-gray-600"> / </span>
                          <span className="text-blue-400">{c.sm_score != null ? Math.abs(c.sm_score).toFixed(1) : "?"}</span>
                          <span className="text-gray-600"> / </span>
                          <span className="text-orange-400">{c.op_score != null ? Math.abs(c.op_score).toFixed(1) : "?"}</span>
                          <span className="text-gray-600"> / </span>
                          <span className="text-cyan-400">{c.mm_score != null ? Math.abs(c.mm_score).toFixed(1) : "?"}</span>
                        </td>
                        <td className="py-2.5 text-right text-gray-400">{(c.fund_confidence * 100).toFixed(0)}%</td>
                        <td className={`py-2.5 text-right font-mono ${c.corr >= 0.5 ? "text-green-400" : c.corr >= 0.3 ? "text-yellow-400" : "text-red-400"}`}>
                          {c.corr.toFixed(2)}
                        </td>
                        <td className={`py-2.5 text-right font-mono ${c.beta >= 0.7 && c.beta <= 1.5 ? "text-gray-300" : "text-yellow-400"}`}>
                          {c.beta.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          {c.fdv_mcap_ratio != null ? (
                            <span className={c.fdv_mcap_ratio > 3 ? "text-red-400" : c.fdv_mcap_ratio > 2 ? "text-yellow-400" : "text-gray-400"}>
                              {c.fdv_mcap_ratio.toFixed(1)}x
                            </span>
                          ) : "\u2014"}
                        </td>
                        <td className="py-2.5 text-right text-gray-400">{fmt(c.volume_24h)}</td>
                        <td className="py-2.5 text-right text-gray-400">#{c.mcap_rank ?? "\u2014"}</td>
                        <td className="py-2.5 text-right font-mono">
                          {c.mindshare_delta != null && c.mindshare_delta !== 0 ? (
                            <span className={c.mindshare_delta > 0 ? "text-green-400" : "text-red-400"}>
                              {c.mindshare_delta > 0 ? "+" : ""}{c.mindshare_delta.toFixed(2)}
                            </span>
                          ) : <span className="text-gray-600">&mdash;</span>}
                        </td>
                      </tr>
                      {/* Expanded signal detail */}
                      {isExpanded && (
                        <tr key={`${c.symbol}-detail`}>
                          <td colSpan={12} className="py-3 px-4 bg-gray-900/30">
                            <ExpandedShortDetail candidate={c} />
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

      {/* Scoring Architecture */}
      <Card>
        <CardHeader><CardTitle>Scoring Architecture</CardTitle></CardHeader>
        <div className="space-y-3">
          <div className="bg-gray-900/50 rounded p-3 text-xs font-mono text-gray-300 space-y-1">
            <div>fund_score = &minus;1 &times; (VA_w &times; va_score + SM_w &times; sm_score + OP_w &times; op_score + MM_w &times; mm_score)</div>
            <div>score = fund_score &times; confidence &times; liquidity_gate &times; momentum_mult &times; mindshare_mult</div>
            <div className="text-gray-500">Greedy selection: pick top N by score with diversity penalty (&lambda; &times; avg_corr), hard corr/beta gates, and sector need bonus</div>
          </div>

          {/* Selection Gates */}
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Hard Gates (pre-scoring filters)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              {[
                { label: "Corr Floor", value: data.short_corr_floor?.toFixed(2) ?? "0.40" },
                { label: "Beta Range", value: `${data.min_beta?.toFixed(1) ?? "0.7"} \u2013 1.5` },
                { label: "Min Volume", value: fmt(data.min_volume) },
                { label: "Confidence Floor", value: `${((data.short_fund_confidence_floor ?? 0.3) * 100).toFixed(0)}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-gray-200 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selection Parameters */}
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Selection Parameters</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              {[
                { label: "Target Basket", value: String(data.n_shorts) },
                { label: "Diversity Penalty", value: data.diversity_penalty?.toFixed(2) ?? "0.30" },
                { label: "Diversity Cap", value: data.diversity_cap?.toFixed(2) ?? "0.85" },
                { label: "Lookback", value: `${data.lookback_hours ?? 2160}h` },
                { label: "Momentum", value: `${data.momentum_weight?.toFixed(2) ?? "0"} (7d MR)` },
                { label: "Universe", value: String(data.universe_size) },
                { label: "Corr Method", value: data.correlation_method ?? "pearson" },
                { label: "Funding Veto", value: "-0.1%/8h" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-gray-200 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Exit Framework */}
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Exit Framework</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              {[
                { label: "Monthly Rotation", value: "720h (30d)" },
                { label: "Momentum Exit", value: "15% / 14d spread" },
                { label: "Max Hold", value: "30 days" },
                { label: "DD Stop", value: "9.5% PTT DD" },
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

      {/* Unmapped Top Coins */}
      {data.unmapped_top_coins && data.unmapped_top_coins.length > 0 && (
        <Card className="border-gray-800/30">
          <CardHeader>
            <CardTitle>Missing from Universe ({data.unmapped_top_coins.length})</CardTitle>
          </CardHeader>
          <div className="text-xs text-gray-500 mb-2">
            Coins in global top 250 by market cap without Binance USDT-M futures &mdash; cannot short.
          </div>
          <div className="flex flex-wrap gap-2">
            {data.unmapped_top_coins.map(c => (
              <div key={c.symbol} className="flex items-center gap-1.5 bg-gray-900/50 rounded px-2 py-1 text-[10px]">
                <span className="text-gray-500">#{c.global_rank}</span>
                <span className="text-gray-300">{c.symbol}</span>
                {c.market_cap && <span className="text-gray-600">{fmt(c.market_cap)}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Expanded Detail for a Short Candidate ──

function ExpandedShortDetail({ candidate: c }: { candidate: RankingCandidate }) {
  const vaSignals = c.va_signals || {};
  const smSignals = c.sm_signals || {};

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* VA Signals (inverted) */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">VA: Value Accrual (inverted)</div>
        <div className="space-y-1.5">
          {Object.entries(vaSignals).map(([key, sig]) => {
            if (key === "alpha_tilt") return null;
            const signal = typeof sig === "object" && sig != null ? (sig as { signal?: number }).signal : null;
            const label = typeof sig === "object" && sig != null ? (sig as { label?: string }).label : key;
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 truncate flex-1">{label || key}</span>
                {scoreBar(signal != null ? signal : null, 48)}
              </div>
            );
          })}
          {Object.keys(vaSignals).length === 0 && <div className="text-xs text-gray-600">No VA data</div>}
        </div>
      </div>

      {/* SM Signals */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">SM: Smart Money</div>
        <div className="space-y-1.5">
          {Object.entries(smSignals).map(([key, sig]) => {
            if (!sig) return null;
            const signal = (sig as { signal?: number }).signal;
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 truncate flex-1">{key.replace(/_/g, " ")}</span>
                {scoreBar(signal != null ? signal : null, 48)}
              </div>
            );
          })}
          {Object.keys(smSignals).length === 0 && <div className="text-xs text-gray-600">No SM data</div>}
        </div>
      </div>

      {/* Pillar Scores + Hedge Quality */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Pillar Scores</div>
        <div className="space-y-1.5">
          {pillarBar("VA", c.va_score, "text-purple-400")}
          {pillarBar("SM", c.sm_score, "text-blue-400")}
          {pillarBar("OP", c.op_score, "text-orange-400")}
          {pillarBar("MM", c.mm_score, "text-cyan-400")}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Hedge Quality</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Correlation</span>
              <span className={c.corr >= 0.5 ? "text-green-400" : "text-yellow-400"}>{c.corr.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Beta</span>
              <span className="text-gray-300">{c.beta.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">FDV/MCap</span>
              <span className={c.fdv_mcap_ratio && c.fdv_mcap_ratio > 3 ? "text-red-400" : "text-gray-300"}>
                {c.fdv_mcap_ratio?.toFixed(2) ?? "\u2014"}x
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Volume</span>
              <span className="text-gray-300">{fmt(c.volume_24h)}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-gray-500 font-mono">
          fund_score={c.fund_score?.toFixed(3)} &times; conf={c.fund_confidence?.toFixed(2)} = score={c.score.toFixed(3)}
        </div>
      </div>
    </div>
  );
}
