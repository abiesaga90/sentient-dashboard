import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { SignalFlowDiagram } from "../shared/SignalFlowDiagram";
import { useState } from "react";

const VA_PROFILE_LABELS: Record<string, string> = {
  l1_platform: "L1",
  defi: "DeFi",
  ai_compute: "AI",
  pow_monetary: "PoW",
  _default: "Other",
};

const VA_PROFILE_COLORS: Record<string, string> = {
  l1_platform: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  defi: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ai_compute: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pow_monetary: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  _default: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

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
  has_nansen: boolean;
  market_cap: number | null;
  fees_30d: number | null;
  holders_revenue_30d: number | null;
  supply_delta_30d_pct: number | null;
  signals: Record<string, Signal>;
  mindshare_gainer: number;
  mindshare_loser: number;
  mindshare_delta: number;
  mindshare_mult: number;
  sentiment_score?: number | null;
}

interface AccrualToken {
  symbol: string;
  mechanism: string;
  confidence: string;
  description: string;
  defillama_accurate: boolean;
  defillama_issue: string;
  defillama_holders_revenue_30d: number | null;
  defillama_fees_30d: number | null;
  corrected_holders_revenue_30d: number | null;
  correction_reason: string;
  revenue_capture_pct: number | null;
  last_audited: string;
}

interface LongSignalsResponse {
  tokens: LongToken[];
  va_weights?: Record<string, number>;
  va_weights_effective?: Record<string, number>;
  va_profiles?: Record<string, Record<string, number>>;
  config: Record<string, number> & {
    use_supply_composite?: boolean;
    use_zscore?: boolean;
    use_freshness_confidence?: boolean;
    zscore_clamp?: number;
  };
  summary?: {
    avg_tilt: number;
    max_tilt: number;
    min_tilt: number;
    avg_confidence: number;
    full_va_coverage: number;
    with_sm: number;
    total: number;
  };
  nansen_status?: {
    fresh_count: number;
    stale_count: number;
    oldest_update: string | null;
  };
  mindshare_status?: {
    enabled: boolean;
    gainers_count: number;
    losers_count: number;
    long_tilt: number;
    short_dampen: number;
  };
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

interface SignalComponent {
  value: number | null;
  signal: number;
  label: string;
}

interface TokenSignal {
  source: string;
  signal: number | null;
  tilt_contribution: number;
  weight: number;
  token_boost: number;
  enabled: boolean;
  components: Record<string, SignalComponent>;
  pillar: string;
  error?: string;
}

interface TokenSignalsResponse {
  tokens: Record<string, TokenSignal>;
  coverage: {
    total_longs: number;
    with_signals: number;
    enabled: number;
    three_pillar: boolean;
  };
}

const fmt = (n: number | null | undefined): string => {
  if (n == null) return "\u2014";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const mechanismBadge = (m: string) => {
  const map: Record<string, { variant: "success" | "info" | "warning" | "danger" | "default"; label: string }> = {
    buyback_burn: { variant: "success", label: "Buyback+Burn" },
    buyback_treasury: { variant: "success", label: "Buyback\u2192Treasury" },
    fee_distribution: { variant: "info", label: "Fee Distribution" },
    fee_switch_partial: { variant: "warning", label: "Partial Fee Switch" },
    staking_rewards: { variant: "default", label: "Staking (Inflation)" },
    none: { variant: "danger", label: "None" },
    unknown: { variant: "default", label: "Unknown" },
  };
  const entry = map[m] || { variant: "default" as const, label: m };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
};

const confidenceBadge = (c: string) => {
  const map: Record<string, "success" | "warning" | "danger" | "default"> = {
    verified: "success", undercount: "warning", missing: "danger", correct_zero: "default", unknown: "default",
  };
  return <Badge variant={map[c] || "default"}>{c}</Badge>;
};

const tiltColor = (t: number) => t >= 1.3 ? "text-green-400" : t >= 1.1 ? "text-green-300" : t <= 0.9 ? "text-red-400" : t < 1.0 ? "text-red-300" : "text-gray-300";

const scoreBar = (score: number, maxWidth = 48) => {
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


// Maps backend va_weights keys to signal entry keys
const VA_WEIGHT_TO_SIGNAL: Record<string, string> = {
  dilution: "fdv_mcap",
  supply_delta: "supply_delta",
  unlock: "unlock_pressure",
  buyback: "buyback_intensity",
  rev_capture: "rev_capture",
  fee_momentum: "fee_momentum",
};

const VA_SIGNAL_LABELS: Record<string, string> = {
  dilution: "Dilution (FDV/MCap)",
  supply_delta: "Supply Momentum",
  unlock: "Unlock Pressure",
  buyback: "Buyback Intensity",
  rev_capture: "Revenue Capture",
  fee_momentum: "Fee Momentum",
};

const SM_SIGNAL_KEYS = new Set(["sm_netflow", "sm_holders", "perp_pressure", "perp_funding", "dex_net_volume", "dat_accumulation", "arkham_exchange_flow", "arkham_fund_flow", "arkham_concentration", "arkham_whale_direction"]);

const freshnessDot = (f: number | undefined) => {
  if (f == null) return null;
  const color = f >= 1.0 ? "bg-green-500" : f >= 0.5 ? "bg-yellow-500" : "bg-red-500";
  const title = f >= 1.0 ? "Fresh (<48h)" : f >= 0.5 ? "Aging (48-96h)" : "Stale (>96h)";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} shrink-0`} title={title} />;
};

function TokenDetailView({
  symbol, tokenData, longToken, accrualToken, base, vaWeights,
}: {
  symbol: string;
  tokenData: TokenSignal | undefined;
  longToken: LongToken | undefined;
  accrualToken: AccrualToken | undefined;
  base: number;
  vaWeights?: Record<string, number>;
}) {
  const displaySymbol = symbol.replace("USDT", "");
  const p3Components = tokenData ? Object.entries(tokenData.components) : [];
  const t = longToken;
  const a = accrualToken;

  return (
    <div className="space-y-4">
      {/* Header KPIs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{displaySymbol} — Full Tilt Breakdown</CardTitle>
            <div className="flex items-center gap-2">
              {a && mechanismBadge(a.mechanism)}
              {a && confidenceBadge(a.confidence)}
              {tokenData?.enabled && (
                <Badge variant="info">{tokenData.source === "custom" ? "Custom P3" : "Blockworks P3"}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        {t ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <div className="text-center p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Tilt</div>
              <div className={`text-xl font-mono font-bold ${tiltColor(t.tilt)}`}>{t.tilt.toFixed(2)}x</div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Raw Score</div>
              <div className={`text-lg font-mono font-semibold ${t.raw_score > 0 ? "text-green-400" : t.raw_score < 0 ? "text-red-400" : "text-gray-400"}`}>
                {t.raw_score > 0 ? "+" : ""}{t.raw_score.toFixed(3)}
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Confidence</div>
              <div className="text-lg font-mono font-semibold text-gray-200">{(t.confidence * 100).toFixed(0)}%</div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Fees 30d</div>
              <div className="text-lg font-mono font-semibold text-gray-200">{fmt(t.fees_30d)}</div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Holders Rev</div>
              <div className={`text-lg font-mono font-semibold ${a && !a.defillama_accurate ? "text-yellow-400" : "text-gray-200"}`}>
                {a?.corrected_holders_revenue_30d != null ? fmt(a.corrected_holders_revenue_30d) : fmt(t.holders_revenue_30d)}
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Signals</div>
              <div className="text-lg font-mono font-semibold">
                <span className="text-purple-400">{t.va_count}</span>
                <span className="text-gray-600">/</span>
                <span className="text-blue-400">{t.sm_count}</span>
                <span className="text-gray-600">/</span>
                <span className="text-orange-400">{p3Components.length}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm py-4">No long signal data for {displaySymbol}.</div>
        )}
      </Card>

      {/* Three-Pillar Signal Breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Pillar 1: Value Accrual */}
        <Card>
          <CardHeader><CardTitle><span className="text-purple-400">P1</span> Value Accrual</CardTitle></CardHeader>
          <div className="space-y-2">
            {/* Supply Health Composite (if present) */}
            {t && t.signals.supply_health && t.signals.supply_health.is_composite && (
              <div className="flex items-center justify-between text-xs px-2 py-1.5 bg-purple-900/20 rounded border border-purple-800/30">
                <span className="text-purple-300 truncate flex-1">Supply Health (composite)</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-purple-400">40%</span>
                  {scoreBar(t.signals.supply_health.score, 48)}
                </div>
              </div>
            )}
            {t && Object.entries(t.signals)
              .filter(([k]) => !SM_SIGNAL_KEYS.has(k) && k !== "supply_health")
              .map(([key, sig]) => {
                // Find weight for this signal
                const wKey = Object.entries(VA_WEIGHT_TO_SIGNAL).find(([, sk]) => sk === key)?.[0];
                const weight = wKey && vaWeights ? vaWeights[wKey] : undefined;
                return (
                  <div key={key} className="flex items-center justify-between text-xs px-2 py-1.5 bg-[var(--bg-secondary)] rounded">
                    <div className="flex items-center gap-1.5 truncate flex-1">
                      {freshnessDot(sig.freshness)}
                      <span className="text-gray-400 truncate">{sig.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sig.z_score != null && (
                        <span className={`text-[10px] font-mono ${sig.z_score > 0 ? "text-green-500" : sig.z_score < 0 ? "text-red-500" : "text-gray-600"}`}>
                          z={sig.z_score > 0 ? "+" : ""}{sig.z_score.toFixed(1)}
                        </span>
                      )}
                      {weight != null && <span className="text-[10px] text-gray-600">{(weight * 100).toFixed(0)}%</span>}
                      {scoreBar(sig.score, 48)}
                    </div>
                  </div>
                );
              })}
            {(!t || t.va_count === 0) && <div className="text-xs text-gray-600 py-2">No VA signals</div>}
          </div>
          {a && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Mechanism</span>{mechanismBadge(a.mechanism)}</div>
              <div className="flex justify-between"><span className="text-gray-500">Capture %</span>
                <span className={a.revenue_capture_pct && a.revenue_capture_pct > 50 ? "text-green-400" : a.revenue_capture_pct && a.revenue_capture_pct > 10 ? "text-yellow-400" : "text-red-400"}>
                  {a.revenue_capture_pct ? `${a.revenue_capture_pct.toFixed(1)}%` : "\u2014"}
                </span>
              </div>
              {a.defillama_issue && <p className="text-yellow-500/80 text-[10px]">DL: {a.defillama_issue}</p>}
              {a.correction_reason && a.correction_reason !== `verified (${a.mechanism})` && (
                <p className="text-yellow-400 text-[10px]">Fix: {a.correction_reason}</p>
              )}
              <p className="text-gray-600 text-[10px]">{a.description}</p>
            </div>
          )}
        </Card>

        {/* Pillar 2: Smart Money */}
        <Card>
          <CardHeader><CardTitle><span className="text-blue-400">P2</span> Smart Money</CardTitle></CardHeader>
          <div className="space-y-2">
            {t && Object.entries(t.signals)
              .filter(([k]) => SM_SIGNAL_KEYS.has(k))
              .map(([key, sig]) => (
                <div key={key} className="flex items-center justify-between text-xs px-2 py-1.5 bg-[var(--bg-secondary)] rounded">
                  <span className="text-gray-400 truncate flex-1">{sig.label}</span>
                  {scoreBar(sig.score, 48)}
                </div>
              ))}
            {(!t || t.sm_count === 0) && <div className="text-xs text-gray-600 py-2">No SM data available</div>}
          </div>
        </Card>

        {/* Pillar 3: Token Signals */}
        <Card className={tokenData?.enabled ? "border-orange-800/30" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle><span className="text-orange-400">P3</span> Token Signals</CardTitle>
              {tokenData && <Badge variant={tokenData.enabled ? "success" : "default"}>{tokenData.enabled ? "ON" : "OFF"}</Badge>}
            </div>
          </CardHeader>
          <div className="space-y-2">
            {p3Components.length > 0 ? p3Components.map(([name, comp]) => (
              <div key={name} className="px-2 py-2 bg-[var(--bg-secondary)] rounded">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 truncate flex-1">{comp.label}</span>
                  {scoreBar(comp.signal, 48)}
                </div>
                {comp.value != null && (
                  <div className="text-[10px] text-gray-600 font-mono mt-0.5 pl-1">raw={comp.value.toFixed(2)}</div>
                )}
              </div>
            )) : (
              <div className="text-xs text-gray-600 py-2">{tokenData ? "Awaiting data" : "No Blockworks data"}</div>
            )}
          </div>
          {tokenData?.error && (
            <div className="mt-2 text-[10px] text-red-400 bg-red-900/20 rounded px-2 py-1 border border-red-800/30">
              {tokenData.error}
            </div>
          )}
        </Card>
      </div>

      {/* Tilt Computation Waterfall */}
      {t && (() => {
        // Compute VA weighted score from individual signals
        const weights = vaWeights ?? { dilution: 0.20, supply_delta: 0.20, unlock: 0.20, buyback: 0.20, rev_capture: 0.10, fee_momentum: 0.10 };
        let vaWeightedSum = 0;
        let vaWeightSum = 0;
        const vaRows: { name: string; label: string; score: number; weight: number; contribution: number }[] = [];
        for (const [wKey, w] of Object.entries(weights)) {
          const sigKey = VA_WEIGHT_TO_SIGNAL[wKey];
          const sig = sigKey ? t.signals[sigKey] : undefined;
          const score = sig?.score ?? 0;
          const hasSignal = sig && sig.value !== null;
          if (hasSignal) {
            vaWeightedSum += w * score;
            vaWeightSum += w;
          }
          vaRows.push({ name: wKey, label: VA_SIGNAL_LABELS[wKey] ?? wKey, score, weight: w, contribution: hasSignal ? w * score : 0 });
        }
        const vaScore = vaWeightSum > 0 ? vaWeightedSum / vaWeightSum : 0;

        // Compute SM average from SM signals
        const smEntries = Object.entries(t.signals).filter(([k]) => SM_SIGNAL_KEYS.has(k));
        const smActive = smEntries.filter(([, s]) => s.value !== null);
        const smAvg = smActive.length > 0 ? smActive.reduce((sum, [, s]) => sum + s.score, 0) / smActive.length : 0;
        const smWeight = 0.50;  // SM_PILLAR_WEIGHT
        const smContrib = smWeight * smAvg;

        // P3 contribution
        const p3Signal = tokenData?.enabled && tokenData?.signal != null ? tokenData.signal : null;
        const p3Boost = tokenData?.token_boost ?? 0.30;  // P3_PILLAR_WEIGHT
        const p3Contrib = p3Signal != null ? p3Boost * p3Signal : 0;

        const rawScore = vaScore + smContrib + p3Contrib;

        return (
          <Card>
            <CardHeader><CardTitle>Tilt Computation</CardTitle></CardHeader>
            <div className="space-y-3 text-xs">
              {/* P1: VA Weighted Breakdown */}
              <div>
                <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-1.5 font-semibold">P1: Value Accrual (weighted)</div>
                <div className="space-y-0.5">
                  {/* Supply Health Composite Row (if active) */}
                  {t.signals.supply_health?.is_composite && (
                    <div className="grid grid-cols-[1fr_50px_60px_70px] gap-2 font-mono px-2 py-1 bg-purple-900/20 rounded items-center border border-purple-800/30">
                      <span className="text-purple-300">Supply Health</span>
                      <span className="text-purple-400 text-right">40%</span>
                      <span className={`text-right ${t.signals.supply_health.score > 0 ? "text-green-400" : t.signals.supply_health.score < 0 ? "text-red-400" : "text-gray-600"}`}>
                        {t.signals.supply_health.score > 0 ? "+" : ""}{t.signals.supply_health.score.toFixed(3)}
                      </span>
                      <span className={`text-right ${t.signals.supply_health.score > 0 ? "text-green-400" : t.signals.supply_health.score < 0 ? "text-red-400" : "text-gray-600"}`}>
                        → {(0.40 * t.signals.supply_health.score) > 0 ? "+" : ""}{(0.40 * t.signals.supply_health.score).toFixed(4)}
                      </span>
                    </div>
                  )}
                  {vaRows.map(r => {
                    const sig = t.signals[VA_WEIGHT_TO_SIGNAL[r.name]];
                    const hasData = sig && sig.value !== null;
                    const isSupplyChild = t.signals.supply_health?.is_composite && ["dilution", "supply_delta", "unlock"].includes(r.name);
                    return (
                      <div key={r.name} className={`grid grid-cols-[1fr_50px_60px_70px] gap-2 font-mono px-2 py-1 bg-[var(--bg-secondary)] rounded items-center ${isSupplyChild ? "opacity-50 text-[10px]" : ""}`}>
                        <div className="flex items-center gap-1">
                          {freshnessDot(sig?.freshness)}
                          <span className={hasData ? "text-gray-400" : "text-gray-600"}>
                            {isSupplyChild ? "↳ " : ""}{sig?.label ?? r.label}
                          </span>
                          {sig?.z_score != null && (
                            <span className={`text-[9px] ${sig.z_score > 0 ? "text-green-500" : "text-red-500"}`}>
                              z{sig.z_score > 0 ? "+" : ""}{sig.z_score.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-600 text-right">{isSupplyChild ? "—" : `${(r.weight * 100).toFixed(0)}%`}</span>
                        <span className={`text-right ${r.score > 0 ? "text-green-400" : r.score < 0 ? "text-red-400" : "text-gray-600"}`}>
                          {hasData ? `${r.score > 0 ? "+" : ""}${r.score.toFixed(3)}` : "—"}
                        </span>
                        <span className={`text-right ${r.contribution > 0 ? "text-green-400" : r.contribution < 0 ? "text-red-400" : "text-gray-600"}`}>
                          {hasData && !isSupplyChild ? `→ ${r.contribution > 0 ? "+" : ""}${r.contribution.toFixed(4)}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between font-mono px-2 pt-1 text-gray-300">
                  <span>VA Score ({t.va_count}/6 signals)</span>
                  <span className={`font-semibold ${vaScore > 0 ? "text-green-400" : vaScore < 0 ? "text-red-400" : "text-gray-400"}`}>
                    {vaScore > 0 ? "+" : ""}{vaScore.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* P2: SM */}
              <div>
                <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1.5 font-semibold">P2: Smart Money (×{smWeight.toFixed(2)})</div>
                <div className="space-y-0.5">
                  {smEntries.map(([key, sig]) => (
                    <div key={key} className="grid grid-cols-[1fr_60px] gap-2 font-mono px-2 py-1 bg-[var(--bg-secondary)] rounded items-center">
                      <span className={sig.value !== null ? "text-gray-400" : "text-gray-600"}>{sig.label}</span>
                      <span className={`text-right ${sig.score > 0 ? "text-green-400" : sig.score < 0 ? "text-red-400" : "text-gray-600"}`}>
                        {sig.value !== null ? `${sig.score > 0 ? "+" : ""}${sig.score.toFixed(3)}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-mono px-2 pt-1 text-gray-300">
                  <span>SM avg × {smWeight.toFixed(2)} ({smActive.length}/{smEntries.length} signals)</span>
                  <span className={`font-semibold ${smContrib > 0 ? "text-green-400" : smContrib < 0 ? "text-red-400" : "text-gray-400"}`}>
                    {smContrib > 0 ? "+" : ""}{smContrib.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* P3: Token Signals */}
              {p3Signal != null && (
                <div>
                  <div className="text-[10px] text-orange-400 uppercase tracking-wider mb-1.5 font-semibold">P3: Token Signal</div>
                  <div className="flex justify-between font-mono px-2 text-gray-300">
                    <span>{p3Boost.toFixed(2)} × {p3Signal.toFixed(3)}</span>
                    <span className={`font-semibold ${p3Contrib > 0 ? "text-green-400" : p3Contrib < 0 ? "text-red-400" : "text-gray-400"}`}>
                      {p3Contrib > 0 ? "+" : ""}{p3Contrib.toFixed(4)}
                    </span>
                  </div>
                </div>
              )}

              {/* Final computation */}
              <div className="border-t border-gray-800 pt-2 font-mono space-y-1 px-2">
                <div className="flex justify-between text-gray-300">
                  <span>raw_score = VA + SM + P3</span>
                  <span className={`font-semibold ${rawScore > 0 ? "text-green-400" : rawScore < 0 ? "text-red-400" : "text-gray-400"}`}>
                    {rawScore > 0 ? "+" : ""}{rawScore.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>× confidence ({t.va_count}/6 + {smWeight}×{smActive.length}/10)</span>
                  <span>{(t.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>= adjusted_score</span>
                  <span className="font-semibold">{t.adjusted_score > 0 ? "+" : ""}{t.adjusted_score.toFixed(4)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-800 text-gray-200">
                  <span>tilt = max(0.25, {base}^{t.adjusted_score.toFixed(4)})</span>
                  <span className={`font-bold text-lg ${tiltColor(t.tilt)}`}>{t.tilt.toFixed(4)}x</span>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

export function LongSignalsTab() {
  const { client, engine } = useEngine();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<string>("overview");

  const { data: signals, isLoading: loadingSignals } = useQuery<LongSignalsResponse>({
    queryKey: ["long-signals", engine.id],
    queryFn: () => client.get("/api/long-signals"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: accrual } = useQuery<AccrualResponse>({
    queryKey: ["value-accrual", engine.id],
    queryFn: () => client.get("/api/value-accrual"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: tokenSignals } = useQuery<TokenSignalsResponse>({
    queryKey: ["token-signals", engine.id],
    queryFn: () => client.get("/api/token-signals"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: protocolDirect } = useQuery<{
    direct_apis: {
      hyperliquid?: { daily_volume: number; daily_buyback_est: number; monthly_buyback_est: number; total_users: number };
      ethena?: { protocol_yield_pct: number; staking_yield_pct: number; avg_30d_protocol_yield: number };
      pendle?: { total_markets: number; active_markets: number; total_tvl_usd: number };
    };
    dune_queries: { configured: number; total: number };
  }>({
    queryKey: ["protocol-direct", engine.id],
    queryFn: () => client.get("/api/protocol-direct"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  const accrualMap = new Map(accrual?.tokens.map(t => [t.symbol, t]) || []);
  const tokenMap = tokenSignals?.tokens ?? {};

  // Build subtab list: overview + per-symbol for tokens with P3 data (long basket only)
  const longBasketSymbols = new Set(signals?.tokens?.map(t => t.symbol) ?? []);
  const p3Symbols = Object.entries(tokenMap)
    .filter(([sym]) => longBasketSymbols.has(sym))
    .sort(([, a], [, b]) => Math.abs(b.signal ?? 0) - Math.abs(a.signal ?? 0))
    .map(([sym]) => sym);

  if (loadingSignals) {
    return <div className="p-4 text-gray-500 text-sm">Loading long signals...</div>;
  }

  if (!signals?.tokens?.length) {
    return <div className="p-4 text-gray-500 text-sm">No long signal data available.</div>;
  }

  const sorted = [...signals.tokens].sort((a, b) => b.tilt - a.tilt);
  const avgTilt = sorted.reduce((s, t) => s + t.tilt, 0) / sorted.length;
  const overweight = sorted.filter(t => t.tilt > 1.1).length;
  const underweight = sorted.filter(t => t.tilt < 0.95).length;
  const gated = sorted.filter(t => {
    const a = accrualMap.get(t.symbol);
    return a && !a.defillama_accurate;
  }).length;

  // Per-symbol subtab view
  if (subTab !== "overview") {
    return (
      <div className="space-y-4">
        {/* Subtab Bar */}
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4 scrollbar-none">
          <button
            onClick={() => setSubTab("overview")}
            className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
          >
            Overview
          </button>
          {p3Symbols.map(sym => {
            const d = tokenMap[sym];
            const isActive = subTab === sym;
            return (
              <button
                key={sym}
                onClick={() => setSubTab(sym)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                {sym.replace("USDT", "")}
                {d?.enabled && (
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    d.signal != null && d.signal > 0 ? "bg-green-500" :
                    d.signal != null && d.signal < 0 ? "bg-red-500" : "bg-gray-600"
                  }`} />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          <TokenDetailView
            symbol={subTab}
            tokenData={tokenMap[subTab]}
            longToken={signals?.tokens.find(x => x.symbol === subTab)}
            accrualToken={accrualMap.get(subTab)}
            base={signals?.config?.base || 2.0}
            vaWeights={signals?.va_weights}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subtab Bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4 scrollbar-none">
        <button
          onClick={() => setSubTab("overview")}
          className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px border-blue-500 text-blue-400"
        >
          Overview
        </button>
        {p3Symbols.map(sym => {
          const d = tokenMap[sym];
          return (
            <button
              key={sym}
              onClick={() => setSubTab(sym)}
              className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
            >
              {sym.replace("USDT", "")}
              {d?.enabled && (
                <span className={`w-1.5 h-1.5 rounded-full ${
                  d.signal != null && d.signal > 0 ? "bg-green-500" :
                  d.signal != null && d.signal < 0 ? "bg-red-500" : "bg-gray-600"
                }`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 space-y-4">
        {/* Nansen Staleness Banner */}
        {signals.nansen_status && signals.nansen_status.stale_count > 0 && (
          <div className="rounded-lg border border-yellow-800/50 bg-yellow-950/30 px-4 py-2 flex items-center gap-2 text-xs text-yellow-400">
            <span className="text-yellow-500 text-sm">&#x26A0;</span>
            Nansen data stale for {signals.nansen_status.stale_count} tokens
            {signals.nansen_status.oldest_update && ` (oldest: ${new Date(signals.nansen_status.oldest_update).toLocaleDateString()})`}
            {" "}&mdash; SM signals excluded for stale tokens
          </div>
        )}

        {/* Mindshare Status Banner */}
        {signals.mindshare_status?.enabled && (signals.mindshare_status.gainers_count > 0 || signals.mindshare_status.losers_count > 0) && (
          <div className="rounded-lg border border-blue-800/50 bg-blue-950/30 px-4 py-2 flex items-center gap-2 text-xs text-blue-400">
            <span className="text-blue-500 text-sm">&#x1F4E1;</span>
            Messari mindshare active &mdash; {signals.mindshare_status.gainers_count} gainers, {signals.mindshare_status.losers_count} losers
            {" "}(long tilt: {signals.mindshare_status.long_tilt}, short dampen: {signals.mindshare_status.short_dampen})
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Avg Tilt" value={`${avgTilt.toFixed(2)}x`} />
          <KpiCard label="Overweight (>1.1x)" value={String(overweight)} valueColor="text-green-400" />
          <KpiCard label="Underweight (<0.95x)" value={String(underweight)} valueColor="text-red-400" />
          <KpiCard label="VA Gate Active" value={String(gated)} valueColor="text-yellow-400" sub="Data corrections applied" />
          {accrual && (
            <KpiCard
              label="Revenue Correction"
              value={accrual.summary.correction_delta_pct ? `+${accrual.summary.correction_delta_pct.toFixed(1)}%` : "\u2014"}
              sub={`${fmt(accrual.summary.correction_delta)} vs DefiLlama`}
              valueColor="text-yellow-400"
            />
          )}
        </div>

        {/* Scoring Architecture */}
        <Card>
          <CardHeader><CardTitle>Scoring Architecture</CardTitle></CardHeader>
          <div className="space-y-3">
            {/* Signal Flow Diagram */}
            <SignalFlowDiagram
              token={expanded ? sorted.find(x => x.symbol === expanded) ?? null : null}
              vaWeights={signals.va_weights}
              config={signals.config}
            />

            {/* VA Signal Weights (dynamic from backend) */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                Pillar 1: Value Accrual Weights
                {signals.va_weights_effective && signals.config?.use_supply_composite && (
                  <span className="text-purple-400 ml-2">(Supply Health composite active)</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(() => {
                  const effectiveWeights = signals.va_weights_effective ?? signals.va_weights;
                  const labelMap: Record<string, string> = {
                    supply_health: "Supply Health (composite)",
                    dilution: "Dilution (FDV/MCap)",
                    supply_delta: "Supply Momentum",
                    unlock: "Unlock Pressure",
                    buyback: "Buyback Intensity",
                    rev_capture: "Revenue Capture",
                    fee_momentum: "Fee Momentum",
                  };
                  return effectiveWeights ? Object.entries(effectiveWeights).map(([key, weight]) => (
                    <div key={key} className={`flex items-center justify-between rounded px-2 py-1.5 ${key === "supply_health" ? "bg-purple-900/30 border border-purple-800/30" : "bg-gray-900/50"}`}>
                      <span className={`text-[11px] ${key === "supply_health" ? "text-purple-300" : "text-gray-400"}`}>{labelMap[key] ?? key}</span>
                      <span className="text-xs font-medium text-gray-200">{(weight * 100).toFixed(0)}%</span>
                    </div>
                  )) : null;
                })()}
              </div>
              {signals.config?.use_zscore && (
                <div className="text-[10px] text-gray-600 mt-1">Z-scored across basket (clamped ±{signals.config?.zscore_clamp ?? 2}σ)</div>
              )}
            </div>

            {/* SM Signal Weights */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Pillar 2: Smart Money <span className="text-gray-700">(weight 0.50 &mdash; 33% of base score)</span></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { label: "SM Netflow 30d", source: "Nansen" },
                  { label: "SM Holders (rel)", source: "Nansen" },
                  { label: "Perp Pressure", source: "Nansen" },
                  { label: "Perp Funding", source: "Nansen" },
                  { label: "DEX Net Volume", source: "Nansen" },
                  { label: "DAT Accumulation", source: "Arkham+CG" },
                  { label: "Exchange Flow", source: "Arkham" },
                  { label: "Fund Distributions", source: "Arkham" },
                  { label: "Concentration", source: "Arkham" },
                  { label: "Whale Direction", source: "Arkham" },
                ].map(({ label, source }) => (
                  <div key={label} className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                    <span className="text-[11px] text-gray-400">{label}</span>
                    <span className="text-[10px] text-gray-600">{source}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-gray-600 mt-1">Equal-weighted mean of available signals, normalized to [-1, +1]. Exchange flow deduped: Nansen 24h first, Arkham 7d fallback.</div>
            </div>

            {/* Pillar 3 + Modifiers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Pillar 3: Token Signals</div>
                <div className="grid grid-cols-1 gap-2 text-[11px]">
                  {["Revenue (Blockworks blend)", "Protocol Activity (DEX vol, AUM)", "MEV & Burn Metrics", "Per-token bespoke signals"].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-900/50 rounded px-2 py-1.5 text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{s}
                    </div>
                  ))}
                  <div className="text-[10px] text-gray-600">{tokenSignals?.coverage.enabled ?? 0} enabled / {p3Symbols.length} tokens</div>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Modifiers</div>
                <div className="grid grid-cols-1 gap-2 text-[11px]">
                  <div className="bg-gray-900/50 rounded px-2 py-1.5 text-gray-400">
                    <span className="text-gray-500">VA Gate</span>
                    <span className="text-gray-400 float-right">caps if no holder revenue</span>
                  </div>
                  <div className="bg-gray-900/50 rounded px-2 py-1.5 text-gray-400">
                    <span className="text-gray-500">Confidence</span>
                    <span className="text-gray-400 float-right">
                      {signals.config?.use_freshness_confidence ? "freshness-weighted" : "n_va/6 + 0.50 × n_sm/10"}
                    </span>
                  </div>
                  <div className="bg-gray-900/50 rounded px-2 py-1.5 text-gray-400">
                    <span className="text-gray-500">Aggression</span>
                    <span className="text-gray-400 float-right">{signals.config?.aggression?.toFixed(1) ?? "1.0"}×</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Protocol Health (Direct APIs) */}
        {protocolDirect?.direct_apis && (
          <Card>
            <CardHeader><CardTitle>Protocol Health (Direct APIs)</CardTitle></CardHeader>
            <div className="grid grid-cols-3 gap-4 text-xs">
              {protocolDirect.direct_apis.hyperliquid && (
                <div className="space-y-1">
                  <div className="text-gray-500 uppercase tracking-wider text-[10px]">Hyperliquid</div>
                  <div className="flex justify-between"><span className="text-gray-400">Daily Volume</span><span>${(protocolDirect.direct_apis.hyperliquid.daily_volume / 1e9).toFixed(1)}B</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Monthly Buyback</span><span className="text-green-400">${(protocolDirect.direct_apis.hyperliquid.monthly_buyback_est / 1e6).toFixed(1)}M</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Users</span><span>{(protocolDirect.direct_apis.hyperliquid.total_users / 1e6).toFixed(1)}M</span></div>
                </div>
              )}
              {protocolDirect.direct_apis.ethena && (
                <div className="space-y-1">
                  <div className="text-gray-500 uppercase tracking-wider text-[10px]">Ethena</div>
                  <div className="flex justify-between"><span className="text-gray-400">Protocol Yield</span><span>{protocolDirect.direct_apis.ethena.protocol_yield_pct.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Staking Yield</span><span className="text-green-400">{protocolDirect.direct_apis.ethena.staking_yield_pct.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">30d Avg</span><span>{protocolDirect.direct_apis.ethena.avg_30d_protocol_yield.toFixed(1)}%</span></div>
                </div>
              )}
              {protocolDirect.direct_apis.pendle && (
                <div className="space-y-1">
                  <div className="text-gray-500 uppercase tracking-wider text-[10px]">Pendle</div>
                  <div className="flex justify-between"><span className="text-gray-400">Markets</span><span>{protocolDirect.direct_apis.pendle.active_markets} active</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">TVL</span><span>${(protocolDirect.direct_apis.pendle.total_tvl_usd / 1e6).toFixed(0)}M</span></div>
                </div>
              )}
            </div>
            <div className="mt-2 text-[10px] text-gray-600">
              Dune queries: {protocolDirect.dune_queries?.configured || 0}/{protocolDirect.dune_queries?.total || 0} configured for on-chain buyback verification
            </div>
          </Card>
        )}

        {/* Token Table */}
        <Card>
          <CardHeader><CardTitle>Long Basket Tilts</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pl-2">Token</th>
                  <th className="text-left py-2">Mechanism</th>
                  <th className="text-right py-2">Tilt</th>
                  <th className="text-right py-2">Raw Score</th>
                  <th className="text-right py-2">P3</th>
                  <th className="text-right py-2">Confidence</th>
                  <th className="text-center py-2">VA / SM / P3</th>
                  <th className="text-right py-2">Fees 30d</th>
                  <th className="text-right py-2">Holders Rev</th>
                  <th className="text-center py-2">DL OK?</th>
                  <th className="text-right py-2">Mindshare</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => {
                  const a = accrualMap.get(t.symbol);
                  const p3 = tokenMap[t.symbol];
                  const isExpanded = expanded === t.symbol;
                  const hasCorrection = a && !a.defillama_accurate;
                  const p3Count = p3 ? Object.keys(p3.components).length : 0;

                  return (
                    <tr key={t.symbol} className="border-b border-gray-800/50 hover:bg-white/[0.02] cursor-pointer" onClick={() => setExpanded(isExpanded ? null : t.symbol)}>
                      {/* Row */}
                      <>
                        <td className="py-2.5 pl-2">
                          <span className="font-medium text-gray-200">{t.symbol.replace("USDT", "")}</span>
                          {t.va_profile && (() => {
                            const key = t.va_profile || "_default";
                            const label = VA_PROFILE_LABELS[key] || key;
                            const color = VA_PROFILE_COLORS[key] || VA_PROFILE_COLORS._default;
                            return <span className={`ml-1.5 inline-block text-[9px] font-medium px-1.5 py-0.5 rounded border ${color}`}>{label}</span>;
                          })()}
                          {hasCorrection && <span className="ml-1 text-yellow-500">*</span>}
                          {p3 && p3.enabled && (
                            <span
                              className="ml-1 text-[10px] font-semibold text-orange-400 bg-orange-500/10 px-1 rounded cursor-pointer hover:bg-orange-500/20"
                              title={`Pillar 3: ${Object.keys(p3.components).length} signals — click for detail`}
                              onClick={(e) => { e.stopPropagation(); setSubTab(t.symbol); }}
                            >P3</span>
                          )}
                        </td>
                        <td className="py-2.5">{a ? mechanismBadge(a.mechanism) : <span className="text-gray-600">{"\u2014"}</span>}</td>
                        <td className={`py-2.5 text-right font-mono font-semibold ${tiltColor(t.tilt)}`}>{t.tilt.toFixed(2)}x</td>
                        <td className="py-2.5 text-right">{scoreBar(t.raw_score)}</td>
                        <td className="py-2.5 text-right">
                          {p3 && p3.enabled && p3.signal != null
                            ? scoreBar(p3.signal, 40)
                            : <span className="text-gray-600">&mdash;</span>}
                        </td>
                        <td className="py-2.5 text-right text-gray-400">{(t.confidence * 100).toFixed(0)}%</td>
                        <td className="py-2.5 text-center">
                          <span className="text-purple-400">{t.va_count}</span>
                          <span className="text-gray-600">/6 </span>
                          <span className="text-blue-400">{t.sm_count}</span>
                          <span className="text-gray-600">/10 </span>
                          <span className={p3Count > 0 ? "text-orange-400" : "text-gray-600"}>{p3Count}</span>
                        </td>
                        <td className="py-2.5 text-right text-gray-400">{fmt(t.fees_30d)}</td>
                        <td className="py-2.5 text-right">
                          {a && a.corrected_holders_revenue_30d != null && a.corrected_holders_revenue_30d !== a.defillama_holders_revenue_30d ? (
                            <span className="text-yellow-400" title={`DL: ${fmt(a.defillama_holders_revenue_30d)} \u2192 Corrected`}>
                              {fmt(a.corrected_holders_revenue_30d)}
                            </span>
                          ) : (
                            <span className="text-gray-400">{fmt(t.holders_revenue_30d)}</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center">
                          {a?.defillama_accurate
                            ? <span className="text-green-500">{"\u2713"}</span>
                            : <span className="text-red-400">{"\u2717"}</span>}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          {t.mindshare_delta !== 0 ? (
                            <div>
                              <span className={t.mindshare_delta > 0 ? "text-green-400" : "text-red-400"}>
                                {t.mindshare_delta > 0 ? "+" : ""}{t.mindshare_delta.toFixed(2)}
                              </span>
                              {t.mindshare_mult !== 1.0 && (
                                <span className="text-gray-500 text-[10px] ml-1">
                                  ({t.mindshare_mult > 1 ? "+" : ""}{((t.mindshare_mult - 1) * 100).toFixed(0)}%)
                                </span>
                              )}
                              {t.sentiment_score != null && (
                                <div className={`text-[10px] ${t.sentiment_score > 0.2 ? "text-green-600" : t.sentiment_score < -0.2 ? "text-red-600" : "text-gray-600"}`}>
                                  sent:{t.sentiment_score > 0 ? "+" : ""}{t.sentiment_score.toFixed(2)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-600">&mdash;</span>
                          )}
                        </td>
                      </>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-gray-600">
            <span className="text-yellow-500">*</span> VA registry correction applied. <span className="text-orange-500">P3</span> = Pillar 3 token signal active. Yellow holders_rev = corrected value (hover for DefiLlama original).
          </div>
        </Card>

        {/* Expanded Signal Detail */}
        {expanded && (() => {
          const t = sorted.find(x => x.symbol === expanded);
          const a = accrualMap.get(expanded);
          const p3 = tokenMap[expanded];
          if (!t) return null;
          return (
            <Card>
              <CardHeader>
                <CardTitle>{t.symbol.replace("USDT", "")} — Signal Breakdown</CardTitle>
              </CardHeader>
              <div className="grid md:grid-cols-3 gap-4">
                {/* VA Signals */}
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Pillar 1: Value Accrual</div>
                  <div className="space-y-2">
                    {Object.entries(t.signals).filter(([k]) => !SM_SIGNAL_KEYS.has(k)).map(([key, sig]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{sig.label}</span>
                        {scoreBar(sig.score, 64)}
                      </div>
                    ))}
                  </div>
                </div>
                {/* SM Signals */}
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Pillar 2: Smart Money</div>
                  <div className="space-y-2">
                    {Object.entries(t.signals).filter(([k]) => SM_SIGNAL_KEYS.has(k)).map(([key, sig]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{sig.label}</span>
                        {scoreBar(sig.score, 64)}
                      </div>
                    ))}
                    {t.sm_count === 0 && <div className="text-xs text-gray-600">No Nansen data available</div>}
                  </div>
                </div>
                {/* P3 Token Signals */}
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Pillar 3: Token Signal</div>
                  {p3 && Object.keys(p3.components).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(p3.components).map(([name, comp]) => (
                        <div key={name} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">{comp.label}</span>
                          {scoreBar(comp.signal, 64)}
                        </div>
                      ))}
                      {p3.signal != null && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-800">
                          <span className="text-gray-500">Combined</span>
                          {scoreBar(p3.signal, 64)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600">
                      {p3 ? "Awaiting data" : "No Blockworks data available"}
                    </div>
                  )}
                  {p3 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSubTab(expanded); }}
                      className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 underline"
                    >
                      View full detail →
                    </button>
                  )}
                </div>
              </div>

              {/* Value Accrual Detail */}
              {a && (
                <div className="mt-4 pt-3 border-t border-gray-800">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Value Accrual Assessment</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-2">
                    <div>
                      <span className="text-gray-600">Mechanism</span><br />
                      {mechanismBadge(a.mechanism)}
                    </div>
                    <div>
                      <span className="text-gray-600">Confidence</span><br />
                      {confidenceBadge(a.confidence)}
                    </div>
                    <div>
                      <span className="text-gray-600">Capture %</span><br />
                      <span className={a.revenue_capture_pct && a.revenue_capture_pct > 50 ? "text-green-400" : a.revenue_capture_pct && a.revenue_capture_pct > 10 ? "text-yellow-400" : "text-red-400"}>
                        {a.revenue_capture_pct ? `${a.revenue_capture_pct.toFixed(1)}%` : "\u2014"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Audited</span><br />
                      <span className="text-gray-400">{a.last_audited}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{a.description}</p>
                  {a.defillama_issue && (
                    <p className="text-xs text-yellow-500/80 mt-1">DL Issue: {a.defillama_issue}</p>
                  )}
                  {a.correction_reason && a.correction_reason !== `verified (${a.mechanism})` && (
                    <p className="text-xs text-yellow-400 mt-1">Correction: {a.correction_reason}</p>
                  )}
                </div>
              )}

              {/* Tilt Formula */}
              <div className="mt-3 pt-3 border-t border-gray-800 text-[10px] text-gray-600 font-mono">
                raw={t.raw_score.toFixed(3)} × conf={t.confidence.toFixed(2)} → adjusted={t.adjusted_score.toFixed(3)} → tilt={signals.config?.base || 2.0}^{t.adjusted_score.toFixed(3)} = <span className={tiltColor(t.tilt)}>{t.tilt.toFixed(4)}x</span>
              </div>
            </Card>
          );
        })()}

        {/* Value Accrual Summary */}
        {accrual && accrual.summary.tokens_with_issues > 0 && (
          <Card className="border-yellow-800/30">
            <CardHeader><CardTitle>Value Accrual Data Quality</CardTitle></CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
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
            <div className="flex flex-wrap gap-2">
              {Object.entries(accrual.summary.by_mechanism).map(([m, count]) => (
                <div key={m} className="flex items-center gap-1 text-[10px]">
                  {mechanismBadge(m)} <span className="text-gray-500">×{count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
