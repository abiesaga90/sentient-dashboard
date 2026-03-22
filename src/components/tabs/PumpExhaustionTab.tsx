import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { Badge } from "../ui/Badge";

interface SubSignal {
  value: number;
  peak?: number;
  signal: number;
  weight: number;
  drop_pct?: number;
  description: string;
  threshold: string;
}

interface PumpCandidate {
  symbol: string;
  state: string;
  exhaustion_score: number;
  pump_detected_at: string | null;
  peak_price: number;
  inclusion_price: number | null;
  stalk_cycles: number;
  inclusion_cycles: number;
  current_price: number | null;
  last_updated: string;
  sub_signals?: Record<string, SubSignal> | null;
}

interface UniversePump {
  symbol: string;
  ret_7d_pct: number;
  exhaustion_score: number;
  state: string;
  source: string;
  current_price: number | null;
  volume_24h?: number;
  open_interest?: number;
  funding_rate?: number | null;
  market_cap?: number | null;
  fdv_mcap_ratio?: number | null;
  wallet_tracker?: {
    wallets: Array<{
      address: string;
      label: string;
      type: string;
      balance: number | null;
      value_usd: number | null;
      is_empty: boolean;
    }>;
    total_held: number;
    total_held_pct: number;
    total_empty: number;
    hedgey_total: number;
    hedgey_total_pct: number;
    distribution_status: string;
    thesis: string;
  } | null;
  short_thesis?: {
    name: string;
    thesis: string;
    bull_case: string[];
    bear_case: string[];
    key_metrics: Record<string, string>;
    category: string;
  } | null;
}

interface CompTimeline {
  day: number;
  dd_pct: number;
}

interface PumpComp {
  symbol: string;
  pump_pct: number;
  ath_price: number;
  ath_date: string;
  current_dd_pct: number;
  peak_daily_vol_m: number;
  timeline: CompTimeline[];
  days_to_50pct: number;
  days_to_75pct: number;
}

interface PumpExhaustionResponse {
  enabled: boolean;
  config: {
    threshold: number;
    detect_threshold_pct: number;
    max_included: number;
    max_stalk_cycles: number;
    weight_pct: number;
  };
  candidates: PumpCandidate[];
  universe_pumps: UniversePump[];
  historical_comps?: {
    comparables: PumpComp[];
    avg_day1_dd: number;
    avg_days_to_50: number;
    avg_days_to_75: number;
  };
  focus_symbols?: string[];
}

const stateBadge = (state: string) => {
  switch (state) {
    case "INCLUDED":
      return <Badge variant="success">INCLUDED</Badge>;
    case "STALKING":
      return <Badge variant="warning">STALKING</Badge>;
    default:
      return <Badge variant="default">EXCLUDED</Badge>;
  }
};

function buildPumpColumns(onSymbolClick?: (sym: string) => void): Column<UniversePump>[] {
  return [
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => (
      <button
        onClick={() => onSymbolClick?.(r.symbol)}
        className="flex items-center gap-2 text-left hover:text-blue-400 transition-colors"
      >
        <span className="font-medium text-gray-200">
          {r.symbol.replace("USDT", "")}
        </span>
        {r.exhaustion_score >= 0.35 && stateBadge(r.state)}
        {r.short_thesis && <span className="text-[9px] text-purple-400">DEEP DIVE</span>}
      </button>
    ),
    sortKey: (r) => r.symbol,
  },
  {
    key: "source",
    header: "Source",
    render: (r) => (
      <Badge variant={r.source === "excluded" ? "warning" : "info"}>
        {r.source}
      </Badge>
    ),
    sortKey: (r) => r.source,
  },
  {
    key: "ret_7d_pct",
    header: "7d Return",
    render: (r) => (
      <span className="text-red-400 font-mono">+{r.ret_7d_pct.toFixed(1)}%</span>
    ),
    sortKey: (r) => r.ret_7d_pct,
    align: "right",
  },
  {
    key: "exhaustion_score",
    header: "Exhaustion",
    render: (r) => (
      <span
        className={`font-mono ${
          r.exhaustion_score >= 0.5
            ? "text-green-400"
            : r.exhaustion_score >= 0.35
              ? "text-yellow-400"
              : "text-gray-400"
        }`}
      >
        {r.exhaustion_score.toFixed(3)}
      </span>
    ),
    sortKey: (r) => r.exhaustion_score,
    align: "right",
  },
  {
    key: "current_price",
    header: "Price",
    render: (r) =>
      r.current_price ? `$${r.current_price.toFixed(4)}` : "-",
    sortKey: (r) => r.current_price ?? 0,
    align: "right",
  },
  {
    key: "volume_24h",
    header: "Vol 24h",
    render: (r) =>
      r.volume_24h ? `$${(r.volume_24h / 1e6).toFixed(1)}M` : "-",
    sortKey: (r) => r.volume_24h ?? 0,
    align: "right",
  },
  {
    key: "funding_rate",
    header: "Funding",
    render: (r) => {
      if (r.funding_rate == null) return <span className="text-gray-700">-</span>;
      const pct = r.funding_rate * 100;
      const color = pct > 0.01 ? "text-red-400" : pct < -0.01 ? "text-green-400" : "text-gray-400";
      return <span className={`font-mono ${color}`}>{pct.toFixed(4)}%</span>;
    },
    sortKey: (r) => r.funding_rate ?? 0,
    align: "right",
  },
  {
    key: "fdv_mcap",
    header: "FDV/MC",
    render: (r) =>
      r.fdv_mcap_ratio ? `${r.fdv_mcap_ratio.toFixed(1)}x` : "-",
    sortKey: (r) => r.fdv_mcap_ratio ?? 0,
    align: "right",
  },
];}

function ExhaustionBreakdown({ signals, threshold }: { signals: Record<string, SubSignal>; threshold: number }) {
  const composite = Object.values(signals).reduce((sum, s) => sum + s.weight * s.signal, 0);
  const SIGNAL_LABELS: Record<string, string> = {
    funding: "Funding Squeeze Recovery",
    oi_rollover: "OI Rollover",
    volume_decay: "Volume Climax Decay",
    price_extension: "Price Extension (3σ)",
  };
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">
        Exhaustion Score Breakdown (need ≥{threshold} to enter short)
      </div>
      {["funding", "oi_rollover", "volume_decay", "price_extension"].map((key) => {
        const sig = signals[key];
        if (!sig) return null;
        const fired = sig.signal >= 0.5;
        const pct = sig.signal * 100;
        return (
          <div key={key} className="bg-[var(--bg-secondary)] rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${fired ? "bg-green-400" : sig.signal > 0.1 ? "bg-yellow-400" : "bg-gray-600"}`} />
                <span className="text-[11px] text-gray-300">{SIGNAL_LABELS[key] || key}</span>
                <span className="text-[10px] text-gray-600">({(sig.weight * 100).toFixed(0)}% weight)</span>
              </div>
              <span className={`font-mono text-[12px] ${fired ? "text-green-400" : "text-gray-500"}`}>
                {sig.signal.toFixed(3)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${fired ? "bg-green-500" : sig.signal > 0.1 ? "bg-yellow-500" : "bg-gray-700"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-600">
              <span>
                {sig.peak != null
                  ? key === "funding" ? `Peak: ${(sig.peak * 100).toFixed(4)}% → Now: ${(sig.value * 100).toFixed(4)}%`
                  : `Peak: $${(sig.peak / 1e6).toFixed(1)}M → Now: $${(sig.value / 1e6).toFixed(1)}M${sig.drop_pct != null ? ` (${sig.drop_pct > 0 ? "-" : "+"}${Math.abs(sig.drop_pct).toFixed(1)}%)` : ""}`
                  : `Current: ${sig.value}`
                }
              </span>
              <span>{sig.threshold}</span>
            </div>
          </div>
        );
      })}
      {/* Gate Status */}
      {signals._gates && (
        <div className="mt-2 bg-gray-900/50 rounded p-2">
          <div className="text-[10px] text-gray-600 uppercase mb-1">Entry Gates (all must pass)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            {[
              { pass: (signals._gates as any).oi_pass, label: "Gate 1: OI Rollover ≥ 0.5" },
              { pass: (signals._gates as any).price_pass, label: "Gate 2: Price Extension ≥ 0.5" },
              { pass: (signals._gates as any).volume_pass, label: "Gate 3: Volume Decay ≥ 0.3" },
              { pass: (signals._gates as any).funding_pass, label: `Gate 4: Funding > -0.5% (now ${(signals._gates as any).funding_rate_pct?.toFixed(2) ?? "?"}%)` },
            ].map(({ pass: p, label }) => (
              <div key={label} className={`flex items-center gap-1.5 px-2 py-1 rounded ${p ? "bg-green-900/30 border border-green-700/30" : "bg-gray-800 border border-gray-700/30"}`}>
                <span className={`text-sm ${p ? "text-green-400" : "text-gray-600"}`}>{p ? "✓" : "✗"}</span>
                <span className={p ? "text-green-300" : "text-gray-500"}>{label}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-gray-600 mt-1">Gate 4 blocks entry when funding costs make the trade unprofitable (shorts paying &gt;0.5%/period = &gt;3%/day)</div>
          <div className="flex justify-between font-mono px-2 pt-1 text-[12px] mt-1">
            <span className="text-gray-400">Status</span>
            <span className={`font-bold ${(signals._gates as any).entry_ready ? "text-green-400" : "text-yellow-400"}`}>
              {(signals._gates as any).entry_ready ? "ALL GATES PASSED → SHORT ENTRY" : "WAITING — gates incomplete"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PumpDetailPanel({ pump, candidate, threshold, onClose, comps }: { pump: UniversePump; candidate?: PumpCandidate; threshold: number; onClose: () => void; comps?: PumpExhaustionResponse["historical_comps"] }) {
  const thesis = pump.short_thesis;
  return (
    <Card className="border-l-2 border-l-purple-500">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-100">{pump.symbol.replace("USDT", "")}</span>
            {thesis && <span className="text-sm text-gray-500">{thesis.name}</span>}
            <Badge variant={pump.source === "excluded" ? "warning" : "info"}>{pump.source}</Badge>
            <span className="text-red-400 font-mono text-sm">+{pump.ret_7d_pct.toFixed(1)}% 7d</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">Close</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          {[
            { label: "Price", value: pump.current_price ? `$${pump.current_price.toFixed(4)}` : "—" },
            { label: "Volume 24h", value: pump.volume_24h ? `$${(pump.volume_24h / 1e6).toFixed(1)}M` : "—" },
            { label: "Open Interest", value: pump.open_interest ? `$${(pump.open_interest / 1e6).toFixed(1)}M` : "—" },
            { label: "Funding Rate", value: pump.funding_rate != null ? `${(pump.funding_rate * 100).toFixed(4)}%` : "—" },
            { label: "FDV/MCap", value: pump.fdv_mcap_ratio ? `${pump.fdv_mcap_ratio.toFixed(1)}x` : "—" },
            { label: "Market Cap", value: pump.market_cap ? `$${(pump.market_cap / 1e6).toFixed(0)}M` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-[10px] text-gray-600 uppercase">{label}</div>
              <div className="text-sm font-medium text-gray-200">{value}</div>
            </div>
          ))}
        </div>

        {thesis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Short Thesis</div>
              <div className="bg-[var(--bg-secondary)] rounded p-3 text-[12px] text-gray-300 mb-3">{thesis.thesis}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-red-400 uppercase mb-1">Bear Case</div>
                  <ul className="text-[11px] text-gray-400 space-y-0.5">
                    {thesis.bear_case.map((b, i) => <li key={i}><span className="text-red-500 mr-1">-</span>{b}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] text-yellow-400 uppercase mb-1">Bull Case (Risks)</div>
                  <ul className="text-[11px] text-gray-400 space-y-0.5">
                    {thesis.bull_case.map((b, i) => <li key={i}><span className="text-yellow-500 mr-1">+</span>{b}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Key Metrics</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(thesis.key_metrics).map(([k, v]) => (
                  <div key={k} className="flex justify-between bg-gray-900/50 rounded px-2 py-1">
                    <span className="text-[10px] text-gray-600">{k}</span>
                    <span className="text-[11px] text-gray-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Exhaustion Score Breakdown */}
        {candidate?.sub_signals && (
          <div className="md:col-span-2 mt-2">
            <ExhaustionBreakdown signals={candidate.sub_signals} threshold={threshold} />
          </div>
        )}

        {/* Wallet Tracker */}
        {pump.wallet_tracker && (
          <div className="md:col-span-2 mt-2">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
              On-Chain Distribution Tracker
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] ${
                pump.wallet_tracker.distribution_status === "HOLDING" ? "bg-yellow-900/50 text-yellow-300" :
                pump.wallet_tracker.distribution_status === "DISTRIBUTING" ? "bg-red-900/50 text-red-300" :
                "bg-green-900/50 text-green-300"
              }`}>{pump.wallet_tracker.distribution_status}</span>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded p-3 text-[11px] text-gray-400 mb-2">
              {pump.wallet_tracker.thesis}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2 text-center">
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-[10px] text-gray-600">Tracked Held</div>
                <div className="text-sm text-gray-200">{(pump.wallet_tracker.total_held / 1e6).toFixed(1)}M</div>
                <div className="text-[10px] text-gray-500">{pump.wallet_tracker.total_held_pct}% of supply</div>
              </div>
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-[10px] text-gray-600">Hedgey Unlock</div>
                <div className="text-sm text-gray-200">{(pump.wallet_tracker.hedgey_total / 1e6).toFixed(0)}M</div>
                <div className="text-[10px] text-gray-500">{pump.wallet_tracker.hedgey_total_pct}% of supply</div>
              </div>
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-[10px] text-gray-600">Wallets Empty</div>
                <div className="text-sm text-gray-200">{pump.wallet_tracker.total_empty} / {pump.wallet_tracker.wallets.length}</div>
                <div className="text-[10px] text-gray-500">sold / tracked</div>
              </div>
            </div>
            <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
              {pump.wallet_tracker.wallets.map((w) => (
                <div key={w.address} className={`flex items-center justify-between px-2 py-1 rounded text-[11px] ${
                  w.is_empty ? "bg-green-900/20" : w.type === "mm" ? "bg-orange-900/20" : "bg-gray-900/30"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${w.is_empty ? "bg-green-400" : "bg-yellow-400"}`} />
                    <span className="text-gray-400">{w.label}</span>
                  </div>
                  <span className={`font-mono ${w.is_empty ? "text-green-400" : "text-gray-300"}`}>
                    {w.is_empty ? "EMPTY" : w.balance != null ? `${(w.balance / 1e6).toFixed(1)}M` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historical Comps */}
        {comps && comps.comparables.length > 0 && (
          <div className="md:col-span-2 mt-2">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
              Historical Pump-and-Dump Comparables
              <span className="text-gray-500 ml-2">What happened to similar pumps after ATH</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-gray-600 border-b border-gray-800">
                    <th className="text-left py-1 px-2">Token</th>
                    <th className="text-right py-1 px-1">Pump</th>
                    <th className="text-right py-1 px-1">Day 1</th>
                    <th className="text-right py-1 px-1">Day 3</th>
                    <th className="text-right py-1 px-1">Day 7</th>
                    <th className="text-right py-1 px-1">Day 14</th>
                    <th className="text-right py-1 px-1">Day 30</th>
                    <th className="text-right py-1 px-1">-50%</th>
                    <th className="text-right py-1 px-1">-75%</th>
                    <th className="text-right py-1 px-2">Now</th>
                  </tr>
                </thead>
                <tbody>
                  {comps.comparables.map((c) => (
                    <tr key={c.symbol} className="border-b border-gray-900 hover:bg-gray-900/30">
                      <td className="py-1 px-2 text-gray-300">{c.symbol}</td>
                      <td className="text-right px-1 text-red-400">+{c.pump_pct}%</td>
                      {[1, 3, 7, 14, 30].map((d) => {
                        const entry = c.timeline.find((t) => t.day === d);
                        return (
                          <td key={d} className="text-right px-1 text-green-400">
                            {entry ? `${entry.dd_pct.toFixed(0)}%` : "—"}
                          </td>
                        );
                      })}
                      <td className="text-right px-1 text-yellow-400">{c.days_to_50pct}d</td>
                      <td className="text-right px-1 text-yellow-400">{c.days_to_75pct}d</td>
                      <td className="text-right px-2 text-green-400">{c.current_dd_pct.toFixed(0)}%</td>
                    </tr>
                  ))}
                  {/* SIREN row */}
                  <tr className="border-t-2 border-orange-500/50 bg-orange-900/10">
                    <td className="py-1 px-2 text-orange-300 font-bold">SIREN</td>
                    <td className="text-right px-1 text-red-400">+1447%</td>
                    <td colSpan={5} className="text-center px-1 text-gray-500 italic">← you are here (Day 0)</td>
                    <td className="text-right px-1 text-gray-600">?</td>
                    <td className="text-right px-1 text-gray-600">?</td>
                    <td className="text-right px-2 text-gray-400">-7%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-[10px] text-gray-600">Avg Day 1</div>
                <div className="text-sm text-green-400">{comps.avg_day1_dd}%</div>
              </div>
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-[10px] text-gray-600">Avg -50%</div>
                <div className="text-sm text-yellow-400">{comps.avg_days_to_50}d</div>
              </div>
              <div className="bg-gray-900/50 rounded p-2">
                <div className="text-[10px] text-gray-600">Avg -75%</div>
                <div className="text-sm text-yellow-400">{comps.avg_days_to_75}d</div>
              </div>
            </div>
          </div>
        )}

        {!thesis && !candidate?.sub_signals && !pump.wallet_tracker && (
          <div className="text-gray-600 text-sm text-center py-4">
            No deep dive data available yet. Token needs to enter STALKING state for exhaustion tracking.
          </div>
        )}
      </div>
    </Card>
  );
}

export function PumpExhaustionTab() {
  const [selectedPump, setSelectedPump] = useState<string | null>(null);
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<PumpExhaustionResponse>({
    queryKey: ["pump-exhaustion", engine.id],
    queryFn: () => client.get("/api/pump-exhaustion"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading pump exhaustion data...
      </div>
    );
  }

  if (!data) return null;

  if (!data.enabled || !data.config) {
    return (
      <div className="p-4">
        <Card className="flex flex-col items-center justify-center h-64">
          <div className="text-lg font-medium text-gray-400">Pump Scanner Disabled</div>
          <div className="text-sm text-gray-600 mt-2">
            Set PUMP_EXHAUSTION_ENABLED=true to activate.
          </div>
        </Card>
      </div>
    );
  }

  const aboveThreshold = data.universe_pumps.filter(
    (p) => p.exhaustion_score >= data.config.threshold
  );

  return (
    <div className="space-y-4 p-4">
      {/* Config Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <ConfigCard
          label="Scanner"
          value={data.enabled ? "ENABLED" : "DISABLED"}
          color={data.enabled ? "text-green-400" : "text-gray-500"}
        />
        <ConfigCard
          label="Threshold"
          value={data.config.threshold.toFixed(2)}
        />
        <ConfigCard
          label="Detect"
          value={`>${data.config.detect_threshold_pct}%`}
        />
        <ConfigCard
          label="Max Slots"
          value={String(data.config.max_included)}
        />
        <ConfigCard
          label="Weight"
          value={`${data.config.weight_pct}% NAV`}
        />
        <ConfigCard
          label="Pumping"
          value={`${data.universe_pumps.length} tokens`}
          color={data.universe_pumps.length > 0 ? "text-yellow-400" : "text-gray-500"}
        />
      </div>

      {/* Sleeve-ready candidates — full signal breakdown */}
      {aboveThreshold.length > 0 && (
        <Card className="border-l-2 border-l-green-500">
          <CardHeader>
            <CardTitle>
              Sleeve Candidates ({aboveThreshold.length} above {data.config.threshold} threshold, {data.config.max_included} slots)
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-4">
            {aboveThreshold.slice(0, data.config.max_included).map((p) => {
              const candidate = data.candidates.find(c => c.symbol === p.symbol);
              return (
                <div key={p.symbol} className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-green-400">{p.symbol.replace("USDT", "")}</span>
                      <Badge variant="success">INCLUDED</Badge>
                      <span className="text-red-400 font-mono text-sm">+{p.ret_7d_pct.toFixed(1)}% 7d</span>
                    </div>
                    <span className="text-green-400 font-mono text-lg">{p.exhaustion_score.toFixed(3)}</span>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-3">
                    {[
                      { label: "Price", value: p.current_price ? `$${p.current_price.toFixed(4)}` : "—" },
                      { label: "Volume 24h", value: p.volume_24h ? `$${(p.volume_24h / 1e6).toFixed(1)}M` : "—" },
                      { label: "Open Interest", value: p.open_interest ? `$${(p.open_interest / 1e6).toFixed(1)}M` : "—" },
                      { label: "Funding", value: p.funding_rate != null ? `${(p.funding_rate * 100).toFixed(4)}%` : "—" },
                      { label: "FDV/MCap", value: p.fdv_mcap_ratio ? `${p.fdv_mcap_ratio.toFixed(1)}x` : "—" },
                      { label: "From Peak", value: candidate && candidate.current_price && candidate.peak_price > 0
                        ? `${((candidate.current_price / candidate.peak_price - 1) * 100).toFixed(1)}%` : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <div className="text-[10px] text-gray-600 uppercase">{label}</div>
                        <div className="text-sm font-medium text-gray-200">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Sub-signal breakdown — always visible */}
                  {candidate?.sub_signals && (
                    <ExhaustionBreakdown signals={candidate.sub_signals} threshold={data.config.threshold} />
                  )}
                </div>
              );
            })}
            {aboveThreshold.length > data.config.max_included && (
              <div className="text-xs text-gray-500">
                +{aboveThreshold.length - data.config.max_included} more above threshold (capped at {data.config.max_included})
              </div>
            )}
          </div>
        </Card>
      )}

      {/* All Pumping Tokens — single unified table */}
      {data.universe_pumps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Pumping Tokens ({data.universe_pumps.length})
            </CardTitle>
            <p className="text-xs text-gray-600 mt-1">
              {data.candidates.filter(c => c.state === "INCLUDED").length} INCLUDED, {data.candidates.filter(c => c.state === "STALKING").length} STALKING. Click symbol for deep dive.
            </p>
          </CardHeader>
          <div className="p-4 pt-0">
            <DataTable
              columns={buildPumpColumns((sym) => setSelectedPump(prev => prev === sym ? null : sym))}
              data={data.universe_pumps}
              defaultSort="exhaustion_score"
              defaultDir="desc"
              maxHeight="600px"
            />
          </div>
        </Card>
      )}

      {/* Pump Detail Panel */}
      {selectedPump && (() => {
        const pump = data.universe_pumps.find(p => p.symbol === selectedPump);
        if (!pump) return null;
        const candidate = data.candidates.find(c => c.symbol === selectedPump);
        return (
          <PumpDetailPanel
            pump={pump}
            candidate={candidate}
            threshold={data.config.threshold}
            onClose={() => setSelectedPump(null)}
            comps={data.historical_comps}
          />
        );
      })()}

      {/* Empty state */}
      {data.candidates.length === 0 && data.universe_pumps.length === 0 && (
        <Card>
          <div className="p-8 text-center text-gray-500">
            No pump candidates detected. Scanner monitors excluded tokens and
            the universe for 7d returns &gt;{data.config.detect_threshold_pct}%.
          </div>
        </Card>
      )}
    </div>
  );
}

function ConfigCard({
  label,
  value,
  color = "text-gray-200",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}
