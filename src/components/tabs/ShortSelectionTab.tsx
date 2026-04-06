import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import { formatUSD } from "../../lib/utils";
import { ShortDetailView } from "./ShortDetailView";
import type {
  RankingCandidate,
  RankingsResponse,
  SignalInventoryResponse,
} from "../../types/api";

// ── Signal bar — inline sparkline for 0-1 signals ──
function SignalBar({ value, label, max }: { value: number | null; label?: string; max?: number }) {
  if (value == null) return <span className="text-gray-700 text-[11px]">—</span>;
  // Scale bar width: default 0-1, or 0-max if provided (for raw values like FDV/MCap)
  const scaled = max ? Math.min(1, value / max) : Math.max(0, Math.min(1, value));
  const pct = scaled * 100;
  const color =
    pct > 60 ? "bg-red-500" : pct > 30 ? "bg-yellow-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-1.5 min-w-[70px]">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-gray-400 w-8 text-right">
        {label ?? value.toFixed(2)}
      </span>
    </div>
  );
}

// ── Shared column builder ──
function buildColumns(opts: {
  showStatus: boolean;
  fundFirst: boolean;
}): Column<RankingCandidate>[] {
  const cols: Column<RankingCandidate>[] = [
    {
      key: "rank",
      header: "#",
      render: () => <span className="text-gray-500">—</span>,
      sortKey: (r) => r.score,
    },
    {
      key: "symbol",
      header: "Symbol",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-200">
            {r.symbol.replace("USDT", "")}
          </span>
          {(r.quality_tags || [])
            .filter((t) => t.startsWith("sector:"))
            .map((t) => (
              <Badge key={t} variant="default" className="text-[11px] px-1 py-0">
                {t.replace("sector:", "")}
              </Badge>
            ))}
        </div>
      ),
      sortKey: (r) => r.symbol,
    },
    {
      key: "mcap_rank",
      header: "MCap #",
      render: (r) => {
        const rank = r.mcap_rank;
        if (rank == null) return <span className="text-gray-700 text-[11px]">—</span>;
        const color = rank <= 20 ? "text-green-400" : rank <= 50 ? "text-blue-400" : rank <= 100 ? "text-gray-300" : "text-gray-500";
        return <span className={`text-xs font-mono ${color}`}>#{rank}</span>;
      },
      sortKey: (r) => r.mcap_rank ?? 9999,
      align: "right",
    },
  ];

  if (opts.showStatus) {
    cols.push({
      key: "status",
      header: "Status",
      render: (r) => <StatusBadges status={r.status} filter_reasons={r.filter_reasons} />,
    });
  }

  if (opts.fundFirst) {
    // Fundamentals-first columns: Fund Score is primary, then signals, then corr/beta as context
    cols.push(
      {
        key: "fund_score",
        header: "Fund Score",
        render: (r) => (
          <span
            className={`font-semibold ${r.fund_score > 0.4 ? "text-red-400" : r.fund_score > 0.2 ? "text-yellow-400" : "text-gray-400"}`}
          >
            {(r.fund_score ?? 0).toFixed(3)}
          </span>
        ),
        sortKey: (r) => r.fund_score,
        align: "right",
      },
      {
        key: "confidence",
        header: "Conf",
        render: (r) => {
          const denom = r.inversion_applied ? `${r.n_fund_signals}` : "6";
          return (
            <span className="text-gray-400 text-sm" title={r.inversion_applied ? `${r.n_fund_signals} signals (VA+SM inverted)` : `${r.n_fund_signals}/6 VA signals`}>
              {denom}{r.inversion_applied && <span className="text-blue-400 text-[10px] ml-0.5">inv</span>}
            </span>
          );
        },
        sortKey: (r) => r.n_fund_signals,
        align: "right",
      },
      {
        key: "score",
        header: "Final",
        render: (r) => (
          <span className="text-gray-300 text-sm">
            {(r.score ?? 0).toFixed(3)}
          </span>
        ),
        sortKey: (r) => r.score,
        align: "right",
      },
      {
        key: "supply_health",
        header: "Supply H.",
        render: (r) => {
          const sh = r.supply_health_composite;
          if (sh == null) return <span className="text-gray-700 text-[11px]">—</span>;
          return <SignalBar value={Math.abs(sh)} label={sh.toFixed(2)} />;
        },
        sortKey: (r) => r.supply_health_composite ?? -1,
        align: "right",
      },
      {
        key: "dilution",
        header: "FDV/MCap",
        render: (r) => {
          const sig = r.va_signals?.dilution;
          const zs = sig?.z_score;
          return (
            <div className="flex items-center gap-1">
              <SignalBar value={r.fdv_mcap_ratio} label={r.fdv_mcap_ratio != null ? `${r.fdv_mcap_ratio.toFixed(1)}x` : undefined} max={10} />
              {zs != null && <span className={`text-[9px] ${zs > 0 ? "text-green-500" : "text-red-500"}`}>z{zs > 0 ? "+" : ""}{zs.toFixed(1)}</span>}
            </div>
          );
        },
        sortKey: (r) => r.fdv_mcap_ratio ?? -1,
        align: "right",
      },
      {
        key: "fee_mom",
        header: "Fee Mom",
        render: (r) => {
          const sig = r.va_signals?.fee_momentum;
          return (
            <div className="flex items-center gap-1">
              <SignalBar value={sig?.signal} />
              {sig?.z_score != null && <span className={`text-[9px] ${sig.z_score > 0 ? "text-green-500" : "text-red-500"}`}>z{sig.z_score > 0 ? "+" : ""}{sig.z_score.toFixed(1)}</span>}
            </div>
          );
        },
        sortKey: (r) => r.va_signals?.fee_momentum?.signal ?? -1,
        align: "right",
      },
      {
        key: "unlock",
        header: "Unlock",
        render: (r) => {
          const sig = r.va_signals?.unlock;
          const fallback = r.va_signals?.unlock_pressure;
          const s = sig ?? fallback;
          return <SignalBar value={s?.signal} />;
        },
        sortKey: (r) => (r.va_signals?.unlock ?? r.va_signals?.unlock_pressure)?.signal ?? -1,
        align: "right",
      },
      {
        key: "supply_mom",
        header: "Supply",
        render: (r) => {
          const sig = r.va_signals?.supply_delta ?? r.va_signals?.supply_momentum;
          return <SignalBar value={sig?.signal} />;
        },
        sortKey: (r) => (r.va_signals?.supply_delta ?? r.va_signals?.supply_momentum)?.signal ?? -1,
        align: "right",
      },
      {
        key: "rev_cap",
        header: "Rev Cap",
        render: (r) => {
          const sig = r.va_signals?.rev_capture ?? r.va_signals?.revenue_capture;
          return <SignalBar value={sig?.signal} />;
        },
        sortKey: (r) => (r.va_signals?.rev_capture ?? r.va_signals?.revenue_capture)?.signal ?? -1,
        align: "right",
      },
      {
        key: "buyback",
        header: "Buyback",
        render: (r) => {
          const sig = r.va_signals?.buyback ?? r.va_signals?.buyback_intensity;
          return <SignalBar value={sig?.signal} />;
        },
        sortKey: (r) => (r.va_signals?.buyback ?? r.va_signals?.buyback_intensity)?.signal ?? -1,
        align: "right",
      },
      {
        key: "staking_delta",
        header: "Staking",
        render: (r) => {
          const sig = r.va_signals?.staking_delta;
          return sig?.signal != null ? <SignalBar value={sig.signal} /> : <span className="text-gray-700 text-[11px]">—</span>;
        },
        sortKey: (r) => r.va_signals?.staking_delta?.signal ?? -1,
        align: "right",
      },
      {
        key: "corr",
        header: "Corr",
        render: (r) => <span className="text-gray-500 text-sm">{(r.corr ?? 0).toFixed(2)}</span>,
        sortKey: (r) => r.corr,
        align: "right",
      },
      {
        key: "beta",
        header: "Beta",
        render: (r) => <span className="text-gray-500 text-sm">{(r.beta ?? 0).toFixed(2)}</span>,
        sortKey: (r) => r.beta,
        align: "right",
      },
      {
        key: "volume",
        header: "Volume",
        render: (r) => <span className="text-gray-500 text-sm">{formatUSD(r.volume_24h, 0)}</span>,
        sortKey: (r) => r.volume_24h,
        align: "right",
      },
      {
        key: "sm_flow",
        header: "SM Flow",
        render: (r) => {
          const sm = r.sm_signals?.netflow_30d;
          if (sm?.signal != null) {
            // Three-pillar signal bar (inverted: negative signal = distribution = good short)
            return <SignalBar value={Math.abs(sm.signal)} label={sm.value != null ? `${(sm.value / 1e6).toFixed(1)}M` : undefined} />;
          }
          const nf = r.nansen_signals?.sm_netflow;
          if (nf == null) return <span className="text-gray-700 text-[11px]">—</span>;
          const color = nf < 0 ? "text-red-400" : nf > 0 ? "text-green-400" : "text-gray-400";
          return <span className={`text-[11px] ${color}`}>{nf < 0 ? "" : "+"}{(nf / 1e6).toFixed(1)}M</span>;
        },
        sortKey: (r) => r.sm_signals?.netflow_30d?.signal ?? r.nansen_signals?.sm_netflow ?? 0,
        align: "right",
      },
      {
        key: "sm_holders",
        header: "SM Holders",
        render: (r) => {
          const sm = r.sm_signals?.holders_relative;
          if (sm?.signal == null) return <span className="text-gray-700 text-[11px]">—</span>;
          const color = sm.signal > 0 ? "text-green-400" : sm.signal < 0 ? "text-red-400" : "text-gray-400";
          return <span className={`text-[11px] ${color}`}>{sm.signal > 0 ? "+" : ""}{sm.signal.toFixed(2)}</span>;
        },
        sortKey: (r) => r.sm_signals?.holders_relative?.signal ?? 0,
        align: "right",
      },
      {
        key: "dex_net",
        header: "DEX Net",
        render: (r) => {
          const sm = r.sm_signals?.dex_net_volume;
          if (sm?.value == null) return <span className="text-gray-700 text-[11px]">—</span>;
          const color = sm.value < 0 ? "text-red-400" : sm.value > 0 ? "text-green-400" : "text-gray-400";
          return <span className={`text-[11px] ${color}`}>{sm.value < 0 ? "" : "+"}{(sm.value / 1e6).toFixed(2)}M</span>;
        },
        sortKey: (r) => r.sm_signals?.dex_net_volume?.signal ?? 0,
        align: "right",
      },
      {
        key: "funding",
        header: "Funding",
        render: (r) => {
          const sm = r.sm_signals?.perp_funding;
          if (sm?.value != null) {
            const color = sm.value > 0 ? "text-red-400" : sm.value < 0 ? "text-green-400" : "text-gray-400";
            return <span className={`text-[11px] ${color}`}>{(sm.value * 100).toFixed(4)}%</span>;
          }
          const fr = r.nansen_signals?.perp_funding_rate;
          if (fr == null) return <span className="text-gray-700 text-[11px]">—</span>;
          const color = fr > 0 ? "text-red-400" : fr < 0 ? "text-green-400" : "text-gray-400";
          return <span className={`text-[11px] ${color}`}>{(fr * 100).toFixed(4)}%</span>;
        },
        sortKey: (r) => r.sm_signals?.perp_funding?.signal ?? r.nansen_signals?.perp_funding_rate ?? 0,
        align: "right",
      },
    );
  } else {
    // Legacy correlation-first columns
    cols.push(
      {
        key: "score",
        header: "Score",
        render: (r) => (
          <span
            className={`font-medium ${r.score > 0.7 ? "text-red-400" : r.score > 0.5 ? "text-yellow-400" : "text-gray-300"}`}
          >
            {(r.score ?? 0).toFixed(3)}
          </span>
        ),
        sortKey: (r) => r.score,
        align: "right",
      },
      {
        key: "corr",
        header: "Corr",
        render: (r) => (r.corr ?? 0).toFixed(2),
        sortKey: (r) => r.corr,
        align: "right",
      },
      {
        key: "beta",
        header: "Beta",
        render: (r) => (r.beta ?? 0).toFixed(2),
        sortKey: (r) => r.beta,
        align: "right",
      },
      {
        key: "volume",
        header: "Volume",
        render: (r) => formatUSD(r.volume_24h, 0),
        sortKey: (r) => r.volume_24h,
        align: "right",
      },
      {
        key: "fdv_mcap",
        header: "FDV/MCap",
        render: (r) =>
          r.fdv_mcap_ratio != null ? `${r.fdv_mcap_ratio.toFixed(1)}x` : "—",
        sortKey: (r) => r.fdv_mcap_ratio ?? 0,
        align: "right",
      },
      {
        key: "va_boost",
        header: "VA Boost",
        render: (r) => {
          if (r.va_total_boost == null || r.va_total_boost === 0) return "—";
          return (
            <span
              className={
                r.va_total_boost > 0 ? "text-red-400" : "text-green-400"
              }
            >
              {r.va_total_boost > 0 ? "+" : ""}
              {r.va_total_boost.toFixed(3)}
            </span>
          );
        },
        sortKey: (r) => r.va_total_boost ?? 0,
        align: "right",
      },
    );
  }

  // Mindshare multiplier column (both paths)
  cols.push({
    key: "ms_mult",
    header: "MS",
    render: (r) => {
      const m = r.mindshare_mult;
      const sent = (r as any).sentiment_score;
      if (m == null || m === 1.0) return <span className="text-gray-700 text-[11px]">&mdash;</span>;
      const pct = ((m - 1) * 100).toFixed(0);
      return (
        <div className="text-right">
          <span className={m < 1 ? "text-red-400" : "text-green-400"}>
            {m < 1 ? "" : "+"}{pct}%
          </span>
          {sent != null && (
            <div className={`text-[10px] ${sent > 0.2 ? "text-green-600" : sent < -0.2 ? "text-red-600" : "text-gray-600"}`}>
              S:{sent > 0 ? "+" : ""}{sent.toFixed(2)}
            </div>
          )}
        </div>
      );
    },
    sortKey: (r) => r.mindshare_mult ?? 1.0,
    align: "right",
  });

  return cols;
}

// Render helper for column that takes index
function buildColumnsWithIndex(opts: {
  showStatus: boolean;
  fundFirst: boolean;
  onSymbolClick?: (sym: string) => void;
}): Column<RankingCandidate & { _idx: number }>[] {
  const base = buildColumns(opts);
  return base.map((col) => {
    if (col.key === "rank") {
      return {
        ...col,
        render: (r: RankingCandidate & { _idx: number }) => (
          <span className="text-gray-500">{r._idx}</span>
        ),
      };
    }
    if (col.key === "symbol" && opts.onSymbolClick) {
      const origRender = col.render;
      return {
        ...col,
        render: (r: RankingCandidate & { _idx: number }) => (
          <button
            onClick={() => opts.onSymbolClick!(r.symbol)}
            className="text-left hover:text-blue-400 transition-colors"
          >
            {origRender(r)}
          </button>
        ),
      };
    }
    return col as Column<RankingCandidate & { _idx: number }>;
  });
}

export function ShortSelectionTab() {
  const [selectedShort, setSelectedShort] = useState<string | null>(null);
  const { client, engine } = useEngine();

  const { data, isLoading } = useQuery({
    queryKey: ["rankings", engine.id],
    queryFn: () =>
      client.get<RankingsResponse>("/api/rankings", { limit: 200 }),
    refetchInterval: 60_000,
  });

  const { data: signalInv } = useQuery({
    queryKey: ["signal-inventory", engine.id],
    queryFn: () =>
      client.get<SignalInventoryResponse>("/api/signal-inventory"),
    refetchInterval: 300_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading rankings...
      </div>
    );
  }

  if (!data) return null;

  const fundFirst = data.fund_first_shorts ?? false;

  const handleSymbolClick = (sym: string) => setSelectedShort(prev => prev === sym ? null : sym);
  const basketColumns = buildColumnsWithIndex({ showStatus: false, fundFirst, onSymbolClick: handleSymbolClick });
  const candidateColumns = buildColumnsWithIndex({ showStatus: true, fundFirst, onSymbolClick: handleSymbolClick });

  // Split candidates into basket (in_targets) and full list
  const basket = data.candidates
    .filter((c) => (c.status || []).includes("in_targets"))
    .map((c, i) => ({ ...c, _idx: i + 1 }));

  const allCandidates = data.candidates.map((c, i) => ({
    ...c,
    _idx: i + 1,
  }));

  return (
    <div className="p-4 space-y-4">
      {/* Nansen Staleness Banner */}
      {data.nansen_status && data.nansen_status.stale_count > 0 && (
        <div className="rounded-lg border border-yellow-800/50 bg-yellow-950/30 px-4 py-2 flex items-center gap-2 text-xs text-yellow-400">
          <span className="text-yellow-500 text-sm">&#x26A0;</span>
          Nansen data stale for {data.nansen_status.stale_count} tokens
          {data.nansen_status.oldest_update && ` (oldest: ${new Date(data.nansen_status.oldest_update).toLocaleDateString()})`}
          {" "}&mdash; signals excluded for stale tokens
        </div>
      )}

      {/* Selection Mode Banner */}
      <div className={`rounded-lg border px-4 py-3 ${fundFirst ? "border-red-900/50 bg-red-950/30" : "border-gray-800 bg-gray-900/50"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold uppercase tracking-wider ${fundFirst ? "text-red-400" : "text-gray-400"}`}>
              {fundFirst ? "Fundamentals-First" : "Correlation-First"}
            </span>
            <Badge variant={fundFirst ? "danger" : "default"} className="text-[10px]">
              {fundFirst ? "ALPHA MODE" : "HEDGE MODE"}
            </Badge>
          </div>
          <div className="flex gap-4 text-[11px] text-gray-500">
            <span>Corr: <span className="text-gray-300">{data.correlation_method}</span></span>
            <span>Data Quality: <span className="text-gray-300">{data.data_quality_enabled ? "ON" : "OFF"}</span></span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-1.5">
          {fundFirst
            ? "Shorts ranked by inverted long-side VA + SM scoring (symmetric weights). Multi-timeframe momentum veto blocks sustained rallies. No individual TP/SL — positions exit via monthly rotation, 60d max hold, or DD management. Event-driven resizes adjust sizing between rotations."
            : "Shorts ranked by correlation to the long basket. VA signals added as small boosts. Beta neutrality through selection."}
        </p>
      </div>

      {/* Scoring Architecture — only in fund-first mode */}
      {fundFirst && (
        <Card>
          <CardHeader>
            <CardTitle>Scoring Architecture</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {/* Formula */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-md px-3 py-2">
              <div className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Score Formula</div>
              <code className="text-xs text-gray-300">
                score = -1 × (VA×w + SM×w + OP×w + MM×w) × confidence × aggression × liquidity × momentum
              </code>
              <div className="text-[10px] text-gray-600 mt-1">Inverted four-pillar base score (symmetric with long side). VA = value accrual (6 signals, same weights both sides), SM = smart money (10 signals), OP = operational performance. Entry guarded by multi-timeframe momentum veto (24h+7d). Exits use spread vs basket (not absolute P&L).</div>
            </div>

            {/* Floors */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-[10px] text-gray-600 uppercase">Corr Floor</div>
                <div className="text-sm font-medium text-gray-300">{data.short_corr_floor?.toFixed(2) ?? "0.40"}</div>
                <div className="text-[10px] text-gray-600">hard filter</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-600 uppercase">Min Beta</div>
                <div className="text-sm font-medium text-gray-300">{(data.min_beta ?? 0).toFixed(2)}</div>
                <div className="text-[10px] text-gray-600">hard filter</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-600 uppercase">Confidence Floor</div>
                <div className="text-sm font-medium text-gray-300">{data.short_fund_confidence_floor?.toFixed(2) ?? "0.30"}</div>
                <div className="text-[10px] text-gray-600">VA+SM signals</div>
              </div>
            </div>

            {/* Signal Weights — show effective weights (composite when active) */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                Fundamental Signal Weights (VA Pillar — symmetric with long side)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {data.fund_weights ? (
                  Object.entries({
                    "Dilution (FDV/MCap)": data.fund_weights.dilution,
                    "Supply Momentum": data.fund_weights.supply_mom,
                    "Unlock Pressure": data.fund_weights.unlock,
                    "Buyback Intensity": data.fund_weights.buyback,
                    "Revenue Capture": data.fund_weights.rev_cap,
                    "Fee Momentum": data.fund_weights.fee_mom,
                  })
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, weight]) => (
                    <div key={label} className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                      <span className="text-[11px] text-gray-400">{label}</span>
                      <span className="text-xs font-medium text-gray-200">{(weight * 100).toFixed(0)}%</span>
                    </div>
                  ))
                ) : null}
              </div>
              <div className="text-[10px] text-gray-600 mt-1">
                Inverted long-side VA scoring. Signals z-scored cross-sectionally, freshness-weighted. Same weights on both sides for symmetry.
              </div>
            </div>

            {/* SM Signal Weights */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Smart Money Signals <span className="text-gray-700">(SM pillar, sector-weighted ~21% of total score)</span></div>
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
              <div className="text-[10px] text-gray-600 mt-1">Equal-weighted mean of available signals, z-scored cross-sectionally, normalized to [-1, +1]. Inverted for short scoring. Exchange flow deduped: Nansen 24h first, Arkham 7d fallback.</div>
            </div>

            {/* Modifiers */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Score Modifiers &amp; Entry Filters</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Liquidity</span>
                  <span className="text-gray-300 float-right">min(1, vol/${formatUSD(data.min_volume, 0)})</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Momentum (7d MR)</span>
                  <span className="text-gray-300 float-right">{(data.momentum_weight ?? 0).toFixed(2)}</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Diversity</span>
                  <span className="text-gray-300 float-right">-{(data.diversity_penalty ?? 0).toFixed(2)}×corr</span>
                </div>
                {data.momentum_veto_enabled && (
                  <div className="bg-red-900/30 border border-red-800/30 rounded px-2 py-1.5">
                    <span className="text-red-400">Momentum Veto</span>
                    <span className="text-red-300 float-right">&gt;{data.momentum_veto_threshold_pct}% on 24h+7d</span>
                  </div>
                )}
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Incumbents</span>
                  <span className="text-gray-300 float-right">exempt from veto</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Perp Crowding</span>
                  <span className="text-gray-300 float-right">dampen if crowded</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">CG Trending</span>
                  <span className="text-gray-300 float-right">retail attention boost</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Messari Mindshare</span>
                  <span className="text-gray-300 float-right">sentiment overlay</span>
                </div>
              </div>
            </div>

            {/* Exit Framework */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Exit Framework</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Max Hold</span>
                  <span className="text-gray-300 float-right">60d safety valve</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Gap Fill</span>
                  <span className="text-gray-300 float-right">immediate replacement</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Rebalance</span>
                  <span className="text-gray-300 float-right">monthly full re-rank</span>
                </div>
                <div className="bg-yellow-900/30 border border-yellow-800/30 rounded px-2 py-1.5">
                  <span className="text-yellow-400">DD Trim</span>
                  <span className="text-yellow-300 float-right">elastic sizing</span>
                </div>
                <div className="bg-red-900/30 border border-red-800/30 rounded px-2 py-1.5">
                  <span className="text-red-400">DD Stop</span>
                  <span className="text-red-300 float-right">9.5% full de-risk</span>
                </div>
              </div>
              <div className="text-[10px] text-gray-600 mt-1">
                No individual TP/SL. Positions ride until monthly rotation, 60d max hold, or DD management. Event-driven resizes adjust sizing. Gap fill replaces closed positions with next-best candidate.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Momentum Veto */}
      {data.momentum_veto_enabled && (() => {
        const vetoed = allCandidates.filter(c => c.momentum_veto_pct != null);
        const bounces = allCandidates.filter(c => c.momentum_veto_7d_pct != null && c.momentum_veto_pct == null);
        if (vetoed.length === 0 && bounces.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Momentum Veto</CardTitle>
                <span className="text-xs text-red-400">
                  {vetoed.length} blocked{bounces.length > 0 ? `, ${bounces.length} bounces allowed` : ""}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Multi-timeframe filter: candidates must exceed &gt;{data.momentum_veto_threshold_pct}% relative outperformance
                on BOTH {data.momentum_veto_lookback_hours}h AND {data.momentum_veto_confirm_lookback_hours ?? 168}h windows.
                24h pumps after 7d declines (bounces) are allowed as short candidates.
              </p>
            </CardHeader>
            {vetoed.length > 0 && (
              <div className="overflow-x-auto">
                <div className="text-[10px] text-red-400 uppercase tracking-wider px-3 pt-2 pb-1">Vetoed (sustained rally)</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 text-left border-b border-gray-800">
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2 text-right">24h Rel.</th>
                      <th className="px-3 py-2 text-right">7d Rel.</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2 text-right">Corr</th>
                      <th className="px-3 py-2 text-right">Beta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vetoed
                      .sort((a, b) => (b.momentum_veto_pct ?? 0) - (a.momentum_veto_pct ?? 0))
                      .map(c => (
                        <tr key={c.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                          <td className="px-3 py-1.5 font-mono">{c.symbol.replace("USDT", "")}</td>
                          <td className="px-3 py-1.5 text-right text-red-400 font-mono">+{c.momentum_veto_pct?.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-right text-red-400 font-mono">+{c.momentum_veto_7d_pct?.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-right font-mono">{c.score?.toFixed(3)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{c.corr?.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{c.beta?.toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {bounces.length > 0 && (
              <div className="overflow-x-auto mt-2">
                <div className="text-[10px] text-yellow-400 uppercase tracking-wider px-3 pt-2 pb-1">Allowed bounces (24h pump, 7d weak)</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 text-left border-b border-gray-800">
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2 text-right">24h Rel.</th>
                      <th className="px-3 py-2 text-right">7d Rel.</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2 text-right">Corr</th>
                      <th className="px-3 py-2 text-right">Beta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bounces
                      .sort((a, b) => (b.momentum_veto_7d_pct ?? 0) - (a.momentum_veto_7d_pct ?? 0))
                      .slice(0, 10)
                      .map(c => (
                        <tr key={c.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                          <td className="px-3 py-1.5 font-mono">{c.symbol.replace("USDT", "")}</td>
                          <td className="px-3 py-1.5 text-right text-yellow-400 font-mono">+{((c.momentum_veto_7d_pct ?? 0) + (data.momentum_veto_threshold_pct ?? 8)).toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-right text-green-400 font-mono">{c.momentum_veto_7d_pct?.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-right font-mono">{c.score?.toFixed(3)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{c.corr?.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{c.beta?.toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Trading Basket */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Trading Basket
            </CardTitle>
            <span className="text-xs text-gray-500">
              {basket.length} shorts
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {fundFirst
              ? "Active shorts selected by fundamental weakness. Corr/Beta shown as context (floor filters only)."
              : "Active hedge positions from ranked candidate universe. Scores match Candidate Rankings below."}
          </p>
        </CardHeader>
        <DataTable
          columns={basketColumns}
          data={basket}
          defaultSort="score"
          defaultDir="desc"
        />
      </Card>

      {/* Short Detail View — expands when a symbol is clicked */}
      {selectedShort && (() => {
        const candidate = allCandidates.find(c => c.symbol === selectedShort)
          ?? basket.find(c => c.symbol === selectedShort);
        if (!candidate) return null;
        return (
          <ShortDetailView
            candidate={candidate}
            onClose={() => setSelectedShort(null)}
          />
        );
      })()}

      {/* Candidate Rankings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Candidate Rankings</CardTitle>
            <span className="text-xs text-gray-500">
              {data.count} candidates from {data.universe_size} universe
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {fundFirst
              ? "Full universe scored by fundamental weakness. Signal bars show individual VA signal strength (higher = weaker fundamentals = better short)."
              : "Full ranked universe — all eligible short candidates scored against the long basket. Updated live."}
          </p>
        </CardHeader>
        <DataTable
          columns={candidateColumns}
          data={allCandidates}
          defaultSort="score"
          defaultDir="desc"
          maxHeight="max-h-[600px]"
        />
      </Card>

      {/* Unmapped Top Coins — coins in global top 200 without Binance USDT-M futures */}
      {data.unmapped_top_coins && data.unmapped_top_coins.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Missing from Universe</CardTitle>
              <span className="text-xs text-gray-500">
                {data.unmapped_top_coins.length} coins without Binance USDT-M futures
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              These coins rank in the global top 250 by market cap but have no Binance USDT-M perpetual contract. We cannot short them.
            </p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-left border-b border-gray-800">
                  <th className="px-3 py-2 text-right w-12">Rank</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {data.unmapped_top_coins
                  .sort((a, b) => a.global_rank - b.global_rank)
                  .map((coin) => (
                    <tr key={coin.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                      <td className="px-3 py-1.5 text-right font-mono text-gray-500">#{coin.global_rank}</td>
                      <td className="px-3 py-1.5 font-mono font-medium text-gray-300">{coin.symbol}</td>
                      <td className="px-3 py-1.5 text-gray-400">{coin.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-400">
                        {coin.market_cap ? formatUSD(coin.market_cap, 0) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* VA Signal Weights — legacy mode only */}
      {!fundFirst && (
        <Card>
          <CardHeader>
            <CardTitle>VA Signal Weights (Additive Boosts)</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: "Dilution", weight: data.va_short_dilution_weight },
              { label: "Supply Mom.", weight: data.va_short_supply_momentum_weight },
              { label: "Buyback", weight: data.va_short_buyback_weight },
              { label: "Rev Capture", weight: data.va_short_revenue_capture_weight },
              { label: "Fee Mom.", weight: data.va_short_fee_momentum_weight },
              { label: "Unlock", weight: data.va_short_unlock_weight },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className="text-sm font-medium text-gray-200">
                  {(s.weight ?? 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Total VA envelope: {[data.va_short_dilution_weight, data.va_short_supply_momentum_weight, data.va_short_buyback_weight, data.va_short_revenue_capture_weight, data.va_short_fee_momentum_weight, data.va_short_unlock_weight].reduce((s, v) => s + v, 0).toFixed(2)}
          </div>
        </Card>
      )}

      {/* Signal Inventory */}
      {signalInv && (
        <Card>
          <CardHeader>
            <CardTitle>Signal Inventory</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
                Short Selection Signals
              </div>
              <div className="space-y-1">
                {signalInv.short_signals.map((s) => (
                  <SignalRow key={s.name} signal={s} />
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-3">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
                Long Basket Signals
              </div>
              <div className="space-y-1">
                {signalInv.long_signals.map((s) => (
                  <SignalRow key={s.name} signal={s} />
                ))}
              </div>
            </div>
            {signalInv.data_sources.length > 0 && (
              <div className="border-t border-[var(--border)] pt-3">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">
                  Data Sources
                </div>
                <div className="flex flex-wrap gap-2">
                  {signalInv.data_sources.map((ds) => (
                    <Badge key={ds} variant="default">
                      {ds}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Key Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Key Parameters</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <ParamRow label="Selection mode" value={fundFirst ? "Fundamentals-First" : "Correlation-First"} />
          <ParamRow label="Basket size" value={`${data.n_shorts} shorts`} />
          <ParamRow label="Lookback window" value={`${data.lookback_hours}h (${Math.round(data.lookback_hours / 24)}d)`} />
          <ParamRow label="Correlation" value={fundFirst ? `floor ${data.short_corr_floor?.toFixed(2) ?? "0.40"}` : `method: ${data.correlation_method}`} />
          <ParamRow label="Diversity penalty" value={(data.diversity_penalty ?? 0).toFixed(2)} />
          <ParamRow label="Diversity hard cap" value={(data.diversity_cap ?? 0).toFixed(2)} />
          <ParamRow label="Min beta" value={(data.min_beta ?? 0).toFixed(2)} />
          <ParamRow label="Min volume" value={formatUSD(data.min_volume, 0)} />
          <ParamRow label="Momentum weight" value={(data.momentum_weight ?? 0).toFixed(2)} />
          <ParamRow label="Momentum veto" value={data.momentum_veto_enabled ? `>${data.momentum_veto_threshold_pct}% on ${data.momentum_veto_lookback_hours}h + ${data.momentum_veto_confirm_lookback_hours ?? 168}h` : "OFF"} />
          <ParamRow label="Universe size" value={String(data.universe_size)} />
        </div>
      </Card>
    </div>
  );
}

// ── Helper components ──

function StatusBadges({
  status,
  filter_reasons,
}: {
  status: string[];
  filter_reasons: string[];
}) {
  const isActive = (status || []).includes("in_basket") || (status || []).includes("in_targets");
  const isExcluded = (status || []).includes("excluded");
  const reasons = filter_reasons || [];

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {(status || []).includes("in_basket") && (
        <Badge variant="info" className="text-[10px]">ACTIVE</Badge>
      )}
      {(status || []).includes("in_targets") && (
        <Badge variant="success" className="text-[10px]">TARGET</Badge>
      )}
      {isExcluded && (
        <Badge variant="danger" className="text-[10px]">EXCLUDED</Badge>
      )}
      {(status || []).includes("long_bench") && (
        <Badge variant="default" className="text-[10px]">LONG BENCH</Badge>
      )}
      {/* Show gate failure reasons prominently for non-basket tokens */}
      {!isActive && reasons.map((r) => (
        <span key={r} className={`text-[10px] leading-tight ${
          r.includes("exclusion list") ? "text-red-400" :
          r.includes("momentum veto") ? "text-red-400 font-semibold" :
          r.includes("funding veto") ? "text-orange-400" :
          "text-yellow-500"
        }`}>
          {r}
        </span>
      ))}
    </div>
  );
}

function SignalRow({ signal }: { signal: { name: string; status: string; description: string; weight?: number } }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            signal.status === "active"
              ? "bg-green-500"
              : signal.status === "planned"
                ? "bg-yellow-500"
                : "bg-gray-600"
          }`}
        />
        <span className="text-gray-300">{signal.name}</span>
      </div>
      <span className="text-gray-600 text-[10px] max-w-[300px] truncate">
        {signal.description}
      </span>
    </div>
  );
}


function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-[var(--border)]">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
