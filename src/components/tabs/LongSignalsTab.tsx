import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { useState } from "react";

interface Signal {
  value: number | null;
  score: number;
  label: string;
}

interface LongToken {
  symbol: string;
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
  config: Record<string, number>;
  nansen_status?: {
    fresh_count: number;
    stale_count: number;
    oldest_update: string | null;
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


function TokenDetailView({
  symbol, tokenData, longToken, accrualToken, base,
}: {
  symbol: string;
  tokenData: TokenSignal | undefined;
  longToken: LongToken | undefined;
  accrualToken: AccrualToken | undefined;
  base: number;
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
            {t && Object.entries(t.signals)
              .filter(([k]) => !["sm_netflow", "sm_holders", "perp_pressure", "perp_funding"].includes(k))
              .map(([key, sig]) => (
                <div key={key} className="flex items-center justify-between text-xs px-2 py-1.5 bg-[var(--bg-secondary)] rounded">
                  <span className="text-gray-400 truncate flex-1">{sig.label}</span>
                  {scoreBar(sig.score, 48)}
                </div>
              ))}
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
              .filter(([k]) => ["sm_netflow", "sm_holders", "perp_pressure", "perp_funding"].includes(k))
              .map(([key, sig]) => (
                <div key={key} className="flex items-center justify-between text-xs px-2 py-1.5 bg-[var(--bg-secondary)] rounded">
                  <span className="text-gray-400 truncate flex-1">{sig.label}</span>
                  {scoreBar(sig.score, 48)}
                </div>
              ))}
            {(!t || t.sm_count === 0) && <div className="text-xs text-gray-600 py-2">No Nansen data available</div>}
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

      {/* Tilt Formula */}
      {t && (
        <Card>
          <CardHeader><CardTitle>Tilt Computation</CardTitle></CardHeader>
          <div className="space-y-2 text-xs font-mono">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <span className="text-gray-500">VA score</span>
              <span>{t.raw_score > 0 ? "+" : ""}{t.raw_score.toFixed(4)} (from {t.va_count} signals)</span>
              <span className="text-gray-500">+ SM contribution</span>
              <span>0.50 × {t.sm_count > 0 ? "avg" : "0"} SM signals</span>
              {tokenData?.enabled && tokenData.signal != null && (
                <>
                  <span className="text-gray-500">+ P3 contribution</span>
                  <span>{(tokenData.token_boost * tokenData.signal).toFixed(4)} ({tokenData.token_boost.toFixed(2)} × {tokenData.signal.toFixed(3)})</span>
                </>
              )}
              <span className="text-gray-500">= raw_score</span>
              <span className="font-semibold">{t.raw_score > 0 ? "+" : ""}{t.raw_score.toFixed(4)}</span>
              <span className="text-gray-500">× confidence</span>
              <span>{(t.confidence * 100).toFixed(0)}%</span>
              <span className="text-gray-500">= adjusted_score</span>
              <span className="font-semibold">{t.adjusted_score > 0 ? "+" : ""}{t.adjusted_score.toFixed(4)}</span>
            </div>
            <div className="pt-2 border-t border-gray-800 text-gray-400">
              tilt = max(0.25, {base}^{t.adjusted_score.toFixed(4)}) = <span className={`font-bold ${tiltColor(t.tilt)}`}>{t.tilt.toFixed(4)}x</span>
            </div>
          </div>
        </Card>
      )}
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

  // Build subtab list: overview + per-symbol for tokens with P3 data
  const p3Symbols = Object.entries(tokenMap)
    .sort(([, a], [, b]) => Math.abs(b.signal ?? 0) - Math.abs(a.signal ?? 0))
    .map(([sym]) => sym);

  if (loadingSignals) {
    return <div className="p-4 text-gray-500 text-sm">Loading long signals...</div>;
  }

  if (!signals?.tokens?.length) {
    return <div className="p-4 text-gray-500 text-sm">No long signal data available. Dynamic tilts may be disabled (SM_TILT_WEIGHT=0).</div>;
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

        {/* Pillar 3: Blockworks Token Signals — prominent summary */}
        {p3Symbols.length > 0 && (
          <Card className="border-orange-800/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <span className="text-orange-400">Pillar 3</span> — Blockworks Token Signals
                </CardTitle>
                <Badge variant="info">{tokenSignals?.coverage.enabled ?? 0} active / {p3Symbols.length} tokens</Badge>
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {p3Symbols.map(sym => {
                const d = tokenMap[sym];
                const displaySym = sym.replace("USDT", "");
                const sig = d?.signal;
                const hasData = sig != null;
                return (
                  <button
                    key={sym}
                    onClick={() => setSubTab(sym)}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded border border-[var(--border)] hover:border-orange-600/50 hover:bg-orange-900/10 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-200">{displaySym}</div>
                      <div className="text-[10px] text-gray-500">
                        {d ? Object.keys(d.components).length + " signals" : "awaiting"}
                      </div>
                    </div>
                    {hasData ? (
                      <div className={`text-sm font-mono font-semibold ${sig > 0 ? "text-green-400" : sig < 0 ? "text-red-400" : "text-gray-500"}`}>
                        {sig > 0 ? "+" : ""}{sig.toFixed(2)}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">—</div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-gray-500">
              Click any token for full Pillar 3 signal breakdown. Revenue data blends into VA fee_momentum (50/50 DL + Blockworks).
            </div>
          </Card>
        )}

        {/* Signal Architecture Map */}
        <Card>
          <CardHeader><CardTitle>Signal Architecture</CardTitle></CardHeader>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-gray-500 mb-2 uppercase tracking-wider text-[10px]">Pillar 1: Value Accrual (5 signals)</div>
              <div className="space-y-1">
                {["FDV/MCap (dilution overhang)", "Supply Momentum (7d/30d blend)", "Buyback Intensity (holder rev yield)", "Revenue Capture (holders_rev / fees)", "Fee Momentum (30d + 7d blend)"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />{s}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-2 uppercase tracking-wider text-[10px]">Pillar 2: Smart Money (6 signals, weight 0.50)</div>
              <div className="space-y-1">
                {["SM Netflow 30d (Nansen)", "SM Holders (relative to median)", "Perp Net Pressure (positioning)", "Perp Funding Rate (crowding)", "DEX Net Volume (Nansen)", "Exchange Flow (Arkham)"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{s}
                  </div>
                ))}
              </div>
              <div className="text-gray-500 mt-3 mb-2 uppercase tracking-wider text-[10px]">VA Gate</div>
              <div className="text-gray-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Caps positive VA signals if no holder revenue mechanism
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-2 uppercase tracking-wider text-[10px]">Pillar 3: Token Signals ({p3Symbols.length} tokens)</div>
              <div className="space-y-1">
                {["Revenue → VA fee_momentum (Blockworks blend)", "Protocol Activity (DEX vol, AUM, supply)", "MEV & Burn Metrics (Jito, EIP-1559)", "Unique per-token signals (bribes, GHO)"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{s}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-gray-600">
                {tokenSignals?.coverage.enabled ?? 0} enabled / {tokenSignals?.coverage.with_signals ?? 0} configured
              </div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-gray-600">
            Tilt = max(0.25, {signals.config?.base || 2.0}^(adjusted_score)) · adjusted_score = raw × confidence × aggression
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
                  <th className="text-right py-2">Confidence</th>
                  <th className="text-center py-2">VA / SM / P3</th>
                  <th className="text-right py-2">Fees 30d</th>
                  <th className="text-right py-2">Holders Rev</th>
                  <th className="text-center py-2">DL OK?</th>
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
                        <td className="py-2.5 text-right text-gray-400">{(t.confidence * 100).toFixed(0)}%</td>
                        <td className="py-2.5 text-center">
                          <span className="text-purple-400">{t.va_count}</span>
                          <span className="text-gray-600">/5 </span>
                          <span className="text-blue-400">{t.sm_count}</span>
                          <span className="text-gray-600">/4 </span>
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
                    {Object.entries(t.signals).filter(([k]) => !["sm_netflow", "sm_holders", "sm_perp_pressure"].includes(k)).map(([key, sig]) => (
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
                    {Object.entries(t.signals).filter(([k]) => ["sm_netflow", "sm_holders", "sm_perp_pressure"].includes(k)).map(([key, sig]) => (
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
