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

const fmt = (n: number | null | undefined): string => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const mechanismBadge = (m: string) => {
  const map: Record<string, { variant: "success" | "info" | "warning" | "danger" | "default"; label: string }> = {
    buyback_burn: { variant: "success", label: "Buyback+Burn" },
    buyback_treasury: { variant: "success", label: "Buyback→Treasury" },
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

export function LongSignalsTab() {
  const { client, engine } = useEngine();
  const [expanded, setExpanded] = useState<string | null>(null);

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

  return (
    <div className="p-4 space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Avg Tilt" value={`${avgTilt.toFixed(2)}x`} />
        <KpiCard label="Overweight (>1.1x)" value={String(overweight)} valueColor="text-green-400" />
        <KpiCard label="Underweight (<0.95x)" value={String(underweight)} valueColor="text-red-400" />
        <KpiCard label="VA Gate Active" value={String(gated)} valueColor="text-yellow-400" sub="Data corrections applied" />
        {accrual && (
          <KpiCard
            label="Revenue Correction"
            value={accrual.summary.correction_delta_pct ? `+${accrual.summary.correction_delta_pct.toFixed(1)}%` : "—"}
            sub={`${fmt(accrual.summary.correction_delta)} vs DefiLlama`}
            valueColor="text-yellow-400"
          />
        )}
      </div>

      {/* Signal Architecture Map */}
      <Card>
        <CardHeader><CardTitle>Signal Architecture</CardTitle></CardHeader>
        <div className="grid grid-cols-2 gap-4 text-xs">
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
            <div className="text-gray-500 mb-2 uppercase tracking-wider text-[10px]">Pillar 2: Smart Money (3 signals)</div>
            <div className="space-y-1">
              {["SM Netflow 30d (Nansen)", "SM Holders (relative to median)", "Perp Net Pressure (positioning)"].map((s, i) => (
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
                <th className="text-center py-2">VA / SM</th>
                <th className="text-right py-2">Fees 30d</th>
                <th className="text-right py-2">Holders Rev</th>
                <th className="text-center py-2">DL OK?</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => {
                const a = accrualMap.get(t.symbol);
                const isExpanded = expanded === t.symbol;
                const hasCorrection = a && !a.defillama_accurate;

                return (
                  <tr key={t.symbol} className="border-b border-gray-800/50 hover:bg-white/[0.02] cursor-pointer" onClick={() => setExpanded(isExpanded ? null : t.symbol)}>
                    {/* Row */}
                    <>
                      <td className="py-2.5 pl-2">
                        <span className="font-medium text-gray-200">{t.symbol.replace("USDT", "")}</span>
                        {hasCorrection && <span className="ml-1 text-yellow-500">*</span>}
                      </td>
                      <td className="py-2.5">{a ? mechanismBadge(a.mechanism) : <span className="text-gray-600">—</span>}</td>
                      <td className={`py-2.5 text-right font-mono font-semibold ${tiltColor(t.tilt)}`}>{t.tilt.toFixed(2)}x</td>
                      <td className="py-2.5 text-right">{scoreBar(t.raw_score)}</td>
                      <td className="py-2.5 text-right text-gray-400">{(t.confidence * 100).toFixed(0)}%</td>
                      <td className="py-2.5 text-center">
                        <span className="text-purple-400">{t.va_count}</span>
                        <span className="text-gray-600">/5 </span>
                        <span className="text-blue-400">{t.sm_count}</span>
                        <span className="text-gray-600">/3</span>
                      </td>
                      <td className="py-2.5 text-right text-gray-400">{fmt(t.fees_30d)}</td>
                      <td className="py-2.5 text-right">
                        {a && a.corrected_holders_revenue_30d != null && a.corrected_holders_revenue_30d !== a.defillama_holders_revenue_30d ? (
                          <span className="text-yellow-400" title={`DL: ${fmt(a.defillama_holders_revenue_30d)} → Corrected`}>
                            {fmt(a.corrected_holders_revenue_30d)}
                          </span>
                        ) : (
                          <span className="text-gray-400">{fmt(t.holders_revenue_30d)}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {a?.defillama_accurate
                          ? <span className="text-green-500">✓</span>
                          : <span className="text-red-400">✗</span>}
                      </td>
                    </>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[10px] text-gray-600">
          <span className="text-yellow-500">*</span> VA registry correction applied. Yellow holders_rev = corrected value (hover for DefiLlama original).
        </div>
      </Card>

      {/* Expanded Signal Detail */}
      {expanded && (() => {
        const t = sorted.find(x => x.symbol === expanded);
        const a = accrualMap.get(expanded);
        if (!t) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle>{t.symbol.replace("USDT", "")} — Signal Breakdown</CardTitle>
            </CardHeader>
            <div className="grid md:grid-cols-2 gap-4">
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
                      {a.revenue_capture_pct ? `${a.revenue_capture_pct.toFixed(1)}%` : "—"}
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
  );
}
