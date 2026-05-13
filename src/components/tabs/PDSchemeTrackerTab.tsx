import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface Candidate {
  symbol: string;
  state: string;
  long_score: number | null;
  short_score: number | null;
  long_pillars?: Record<string, number>;
  short_pillars?: Record<string, number>;
  alpha_listed_at?: string | null;
  bitget_listed_at?: string | null;
  bitget_listing_type?: string | null;
  cross_age_hours?: number | null;
  chain?: string | null;
  incubator?: string | null;
  fluff_score?: number | null;
  top10_pct?: number | null;
  fdv_mcap?: number | null;
  circulating_pct?: number | null;
  pump_multiple?: number | null;
  last_long_alert_at?: string | null;
  last_short_alert_at?: string | null;
  source?: string;
  notes?: string | null;
  updated_at?: string;
  // Live-enriched fields
  binance_perp_listed?: boolean;
  market_cap_usd?: number | null;
  fdv_usd?: number | null;
  volume_24h_usd?: number | null;
  funding_rate_8h?: number | null;
  funding_rate_ann_pct?: number | null;
  current_price?: number | null;
  return_24h_pct?: number | null;
  return_7d_pct?: number | null;
  return_30d_pct?: number | null;
  // Chinese-cohort pattern (analyst flag, not in score)
  chinese_pattern_score?: number | null;
  chinese_pattern_flags?: string[] | null;
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtFunding(ann: number | null | undefined): string {
  if (ann == null) return "—";
  const sign = ann >= 0 ? "+" : "";
  return `${sign}${ann.toFixed(0)}%`;
}

interface AlphaOnly {
  symbol: string;
  first_seen: string;
  chain?: string | null;
}

interface ScamBalance {
  n_held_long: number;
  n_held_short: number;
  held_long_symbols: string[];
  held_short_symbols: string[];
  n_long_alerted: number;
  n_short_alerted: number;
  n_long_watch: number;
  n_short_watch: number;
  imbalance: number;
  message: string | null;
}

interface SourceHealth {
  last_observation: string | null;
  rows_last_24h: number;
  error?: string;
}

interface PDResponse {
  longs: Candidate[];
  shorts: Candidate[];
  alpha_only: AlphaOnly[];
  scam_balance: ScamBalance;
  source_health: {
    binance_alpha: SourceHealth;
    bitget: SourceHealth;
    x_feed: SourceHealth;
    last_scan: string | null;
    scanner_enabled: boolean;
  };
  history: Candidate[];
  fetched_at: string;
}

function fmtAge(hours: number | null | undefined): string {
  if (hours == null) return "—";
  if (hours < 24) return `${hours.toFixed(0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v == null) return "—";
  return `${v.toFixed(digits)}%`;
}

function fmtMultiple(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(2)}×`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function stateBadgeVariant(state: string): "success" | "danger" | "warning" | "info" | "default" {
  if (state === "LONG_ALERTED") return "success";
  if (state === "SHORT_ALERTED") return "danger";
  if (state === "LONG_WATCH") return "info";
  if (state === "SHORT_WATCH") return "warning";
  return "default";
}

function ScoreCell({ score, threshold }: { score: number | null | undefined; threshold: number }) {
  if (score == null) return <span className="text-gray-600">—</span>;
  const cls = score >= threshold
    ? "text-green-400 font-semibold"
    : score >= threshold - 0.15
      ? "text-yellow-400"
      : "text-gray-400";
  return <span className={cls}>{score.toFixed(2)}</span>;
}

function PillarPopover({ pillars }: { pillars?: Record<string, number> }) {
  if (!pillars || Object.keys(pillars).length === 0) return null;
  return (
    <div className="text-[10px] text-gray-500 grid grid-cols-2 gap-x-3 mt-1">
      {Object.entries(pillars).map(([k, v]) => (
        <span key={k}>
          {k}: <span className="text-gray-300">{v.toFixed(2)}</span>
        </span>
      ))}
    </div>
  );
}

function CandidateRow({ c, side }: { c: Candidate; side: "long" | "short" }) {
  const [expanded, setExpanded] = useState(false);
  const score = side === "long" ? c.long_score : c.short_score;
  const pillars = side === "long" ? c.long_pillars : c.short_pillars;
  const threshold = side === "long" ? 0.60 : 0.65;
  const symbol = c.symbol.replace(/USDT$/, "");

  return (
    <>
      <tr
        className="border-b border-gray-800/50 hover:bg-gray-900/40 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-1.5 pr-3 font-medium text-gray-200">{symbol}</td>
        <td className="py-1.5 px-2 text-right">
          <ScoreCell score={score} threshold={threshold} />
        </td>
        <td className="py-1.5 px-2 text-center">
          <Badge variant={stateBadgeVariant(c.state)} className="text-[10px] px-1 py-0">
            {c.state}
          </Badge>
        </td>
        <td className="py-1.5 px-2 text-center text-[11px]">
          {c.binance_perp_listed ? (
            <span className="text-green-400">✓</span>
          ) : <span className="text-gray-600">—</span>}
        </td>
        <td className="py-1.5 px-2 text-right text-[11px] text-gray-300">
          {fmtUsd(c.market_cap_usd)}
        </td>
        <td className="py-1.5 px-2 text-right text-[11px] text-gray-300">
          {fmtUsd(c.volume_24h_usd)}
        </td>
        <td className="py-1.5 px-2 text-right text-[11px]">
          {c.funding_rate_ann_pct != null ? (
            <span className={c.funding_rate_ann_pct > 50 ? "text-red-400" :
                             c.funding_rate_ann_pct < -50 ? "text-green-400" : "text-gray-400"}>
              {fmtFunding(c.funding_rate_ann_pct)}
            </span>
          ) : <span className="text-gray-600">—</span>}
        </td>
        <td className="py-1.5 px-2 text-right text-[11px] text-gray-400">
          {fmtAge(c.cross_age_hours)}
        </td>
        <td className="py-1.5 px-2 text-center text-[11px]">
          {c.chain ? (
            <Badge variant={c.chain === "BNB" ? "warning" : "default"} className="text-[10px] px-1 py-0">
              {c.chain}
            </Badge>
          ) : <span className="text-gray-600">—</span>}
        </td>
        <td className="py-1.5 px-2 text-right text-[11px]">
          {c.top10_pct != null ? (
            <span className={c.top10_pct >= 85 ? "text-red-400 font-medium" : c.top10_pct >= 70 ? "text-yellow-400" : "text-gray-400"}>
              {c.top10_pct.toFixed(0)}%
            </span>
          ) : <span className="text-gray-600">—</span>}
        </td>
        <td className="py-1.5 px-2 text-right text-[11px]">
          {c.circulating_pct != null ? (
            <span className={c.circulating_pct < 15 ? "text-red-400 font-medium" : c.circulating_pct < 30 ? "text-yellow-400" : "text-gray-400"}
                  title={c.circulating_pct < 15 ? "Low float — high distribution risk on unlocks" : ""}>
              {c.circulating_pct.toFixed(0)}%
            </span>
          ) : <span className="text-gray-600">—</span>}
        </td>
        <td className="py-1.5 px-2 text-right text-[11px] text-gray-400">
          {fmtMultiple(c.fdv_mcap)}
        </td>
        <td className="py-1.5 px-2 text-right text-[11px] text-gray-400">
          {fmtMultiple(c.pump_multiple)}
        </td>
        <td className="py-1.5 px-2 text-center text-[11px]"
            title={c.chinese_pattern_flags?.join(" | ") ?? ""}>
          {(() => {
            const s = c.chinese_pattern_score ?? 0;
            if (s >= 0.6) return <span className="text-red-400 font-medium">🚩 {s.toFixed(2)}</span>;
            if (s >= 0.35) return <span className="text-yellow-400">⚠ {s.toFixed(2)}</span>;
            if (s > 0) return <span className="text-gray-500">{s.toFixed(2)}</span>;
            return <span className="text-green-400/60">clean</span>;
          })()}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-800">
          <td colSpan={14} className="py-3 px-4 bg-gray-900/30">
            <div className="grid grid-cols-2 gap-4 text-[11px]">
              <div>
                <div className="text-gray-500 mb-1 uppercase tracking-wider">Pillars</div>
                <PillarPopover pillars={pillars} />
              </div>
              <div>
                <div className="text-gray-500 mb-1 uppercase tracking-wider">Listings</div>
                <div>Binance Alpha: <span className="text-gray-300">{fmtTime(c.alpha_listed_at)}</span></div>
                <div>Bitget: <span className="text-gray-300">{fmtTime(c.bitget_listed_at)}</span></div>
                {c.last_long_alert_at && (
                  <div>Last long alert: <span className="text-green-400">{fmtTime(c.last_long_alert_at)}</span></div>
                )}
                {c.last_short_alert_at && (
                  <div>Last short alert: <span className="text-red-400">{fmtTime(c.last_short_alert_at)}</span></div>
                )}
              </div>
            </div>
            {c.chinese_pattern_flags && c.chinese_pattern_flags.length > 0 && (
              <div className="mt-3 text-[11px] border-l-2 border-red-700 pl-3">
                <div className="text-red-400 font-medium mb-1">
                  🚩 Chinese-cohort pattern (score {(c.chinese_pattern_score ?? 0).toFixed(2)})
                </div>
                {c.chinese_pattern_flags.map((f, i) => (
                  <div key={i} className="text-gray-400">• {f}</div>
                ))}
              </div>
            )}
            {c.notes && (
              <div className="mt-3 text-[11px] text-gray-400 italic border-l-2 border-gray-700 pl-3">
                {c.notes}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CandidateTable({ items, side, emptyMsg }: {
  items: Candidate[]; side: "long" | "short"; emptyMsg: string;
}) {
  if (items.length === 0) {
    return <div className="text-[11px] text-gray-500 py-3 italic">{emptyMsg}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800">
            <th className="text-left py-1 pr-3">Symbol</th>
            <th className="text-right py-1 px-2">Score</th>
            <th className="text-center py-1 px-2">State</th>
            <th className="text-center py-1 px-2" title="Available on Binance Perp">B.Perp</th>
            <th className="text-right py-1 px-2">MC</th>
            <th className="text-right py-1 px-2" title="24h quote volume">24h Vol</th>
            <th className="text-right py-1 px-2" title="Annualised 8h funding rate">Fund% ann</th>
            <th className="text-right py-1 px-2" title="Days since cross-listing observed">Age</th>
            <th className="text-center py-1 px-2">Chain</th>
            <th className="text-right py-1 px-2" title="Top-10 holder concentration (Nansen, when available)">Top-10</th>
            <th className="text-right py-1 px-2" title="Circulating supply / total supply — low % = locked supply overhang, concentration proxy">Circ%</th>
            <th className="text-right py-1 px-2">FDV/MC</th>
            <th className="text-right py-1 px-2">Pump×</th>
            <th className="text-center py-1 px-2" title="Chinese-cohort pattern score (0-1). 🚩 ≥0.6 = LAB/GUA-like cohort; ⚠ ≥0.35 = partial match; clean = no signals.">CN Pattern</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => <CandidateRow key={c.symbol} c={c} side={side} />)}
        </tbody>
      </table>
    </div>
  );
}

function SourceHealthRow({ name, h }: { name: string; h: SourceHealth }) {
  const fresh = h.last_observation && (
    (Date.now() - new Date(h.last_observation).getTime()) < 30 * 60 * 1000
  );
  const dot = h.error ? "🔴" : fresh ? "🟢" : "🟡";
  return (
    <span className="text-[10px] text-gray-400">
      {dot} {name}: <span className="text-gray-200">{h.rows_last_24h}/24h</span>
      {h.error && <span className="text-red-400 ml-1">({h.error.slice(0, 40)})</span>}
    </span>
  );
}

export function PDSchemeTrackerTab() {
  const { client, engine } = useEngine();

  const { data, isLoading, error } = useQuery<PDResponse>({
    queryKey: ["pd-scheme", engine.id],
    queryFn: () => client.get("/api/pd-scheme"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading P&D Scheme Tracker…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-red-400 text-sm">
            Failed to load P&D Scheme data. The screener may still be initialising.
          </div>
        </Card>
      </div>
    );
  }

  const { longs, shorts, alpha_only, scam_balance, source_health, history } = data;

  return (
    <div className="space-y-4 p-2">
      {/* Scam-balance gauge */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>P&D Scheme Tracker</CardTitle>
          <div className="text-[10px] text-gray-500">
            Last scan: {fmtTime(source_health.last_scan)}
            {!source_health.scanner_enabled && (
              <span className="text-red-400 ml-2">SCANNER DISABLED</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Scam longs <span className="text-gray-600">held</span></div>
            <div className="text-2xl text-green-400 font-medium">
              {scam_balance.n_held_long}
            </div>
            <div className="text-[10px] text-gray-500 truncate" title={scam_balance.held_long_symbols.join(", ")}>
              {scam_balance.held_long_symbols.length > 0
                ? scam_balance.held_long_symbols.map(s => s.replace(/USDT$/, "")).join(", ")
                : "—"}
            </div>
            <div className="text-[9px] text-gray-700 mt-0.5">+ {scam_balance.n_long_watch} on watch</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Scam shorts <span className="text-gray-600">held</span></div>
            <div className="text-2xl text-red-400 font-medium">
              {scam_balance.n_held_short}
            </div>
            <div className="text-[10px] text-gray-500 truncate" title={scam_balance.held_short_symbols.join(", ")}>
              {scam_balance.held_short_symbols.length > 0
                ? scam_balance.held_short_symbols.map(s => s.replace(/USDT$/, "")).join(", ")
                : "—"}
            </div>
            <div className="text-[9px] text-gray-700 mt-0.5">+ {scam_balance.n_short_watch} on watch</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Imbalance</div>
            <div className={`text-2xl font-medium ${Math.abs(scam_balance.imbalance) >= 2 ? "text-yellow-400" : "text-gray-300"}`}>
              {scam_balance.imbalance > 0 ? "+" : ""}{scam_balance.imbalance}
            </div>
            <div className="text-[10px] text-gray-600">short minus long</div>
          </div>
          <div className="md:col-span-2 flex items-center">
            {scam_balance.message && (
              <div className="text-[11px] text-yellow-400 border-l-2 border-yellow-500 pl-3">
                {scam_balance.message}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Longs */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="text-green-400">🟢 Potential LONGS</span>
            <span className="text-[10px] text-gray-500 ml-2">
              ({longs.length} candidates — sorted by long_score)
            </span>
          </CardTitle>
        </CardHeader>
        <CandidateTable
          items={longs}
          side="long"
          emptyMsg="No long candidates yet. Wait for the next cross-match or a fresh Binance Alpha listing."
        />
      </Card>

      {/* Shorts */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="text-red-400">🔴 Potential SHORTS</span>
            <span className="text-[10px] text-gray-500 ml-2">
              ({shorts.length} candidates — sorted by short_score)
            </span>
          </CardTitle>
        </CardHeader>
        <CandidateTable
          items={shorts}
          side="short"
          emptyMsg="No short candidates yet."
        />
      </Card>

      {/* Alpha-only (diagnostic — collapsible visual) */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="text-yellow-400/80">⚠️ Alpha-only watchlist</span>
            <span className="text-[10px] text-gray-500 ml-2">
              ({alpha_only.length} on Binance Alpha but not yet on Bitget — pre-alert pipeline)
            </span>
          </CardTitle>
        </CardHeader>
        {alpha_only.length === 0 ? (
          <div className="text-[11px] text-gray-500 italic">No Alpha-only tokens.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-[11px]">
            {alpha_only.slice(0, 30).map((a) => (
              <div key={a.symbol} className="border border-gray-800 rounded px-2 py-1.5 bg-gray-900/30">
                <div className="font-medium text-gray-200">{a.symbol.replace(/USDT$/, "")}</div>
                <div className="text-[10px] text-gray-500">{fmtTime(a.first_seen)}</div>
                {a.chain && <div className="text-[10px] text-yellow-400">{a.chain}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="text-gray-300">📜 Alert history</span>
            <span className="text-[10px] text-gray-500 ml-2">
              ({history.length} past alerts)
            </span>
          </CardTitle>
        </CardHeader>
        {history.length === 0 ? (
          <div className="text-[11px] text-gray-500 italic">No alerts have fired yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800">
                  <th className="text-left py-1 pr-3">Symbol</th>
                  <th className="text-center py-1 px-2">State</th>
                  <th className="text-right py-1 px-2">Long</th>
                  <th className="text-right py-1 px-2">Short</th>
                  <th className="text-right py-1 px-2">Pump×</th>
                  <th className="text-right py-1 px-2">FDV/MC</th>
                  <th className="text-right py-1 px-2">Long alert</th>
                  <th className="text-right py-1 px-2">Short alert</th>
                  <th className="text-center py-1 px-2">Chain</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.symbol} className="border-b border-gray-800/50">
                    <td className="py-1.5 pr-3 font-medium text-gray-200">
                      {h.symbol.replace(/USDT$/, "")}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <Badge variant={stateBadgeVariant(h.state)} className="text-[10px] px-1 py-0">
                        {h.state}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-2 text-right">{h.long_score?.toFixed(2) ?? "—"}</td>
                    <td className="py-1.5 px-2 text-right">{h.short_score?.toFixed(2) ?? "—"}</td>
                    <td className="py-1.5 px-2 text-right">{fmtMultiple(h.pump_multiple)}</td>
                    <td className="py-1.5 px-2 text-right">{fmtMultiple(h.fdv_mcap)}</td>
                    <td className="py-1.5 px-2 text-right text-[10px] text-green-400/70">
                      {fmtTime(h.last_long_alert_at)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-[10px] text-red-400/70">
                      {fmtTime(h.last_short_alert_at)}
                    </td>
                    <td className="py-1.5 px-2 text-center text-[10px] text-gray-400">
                      {h.chain ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Source-feed health */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>
            <span className="text-gray-400 text-sm">Source feed health</span>
          </CardTitle>
          <div className="flex items-center gap-4 flex-wrap">
            <SourceHealthRow name="Binance Alpha (CMS)" h={source_health.binance_alpha} />
            <SourceHealthRow name="Bitget (API)" h={source_health.bitget} />
            <SourceHealthRow name="X feed" h={source_health.x_feed} />
          </div>
        </div>
      </Card>

      {/* Canonical cohort playbook reference */}
      <PlaybookReference />
    </div>
  );
}

function Phase({ title, color, rows }: {
  title: string; color: string; rows: [string, string][];
}) {
  return (
    <div>
      <div className={`${color} font-medium mb-1`}>{title}</div>
      <table className="w-full text-[11px]">
        <tbody>
          {rows.map(([signal, why], i) => (
            <tr key={i} className="border-b border-gray-800/30">
              <td className="py-1 pr-3 text-gray-300 align-top w-[55%]">{signal}</td>
              <td className="py-1 text-gray-500 italic">{why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlaybookReference() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <CardTitle>
          <span className="text-gray-300 text-sm">
            📖 Canonical Chinese-CEX-cohort P&amp;D playbook
          </span>
          <span className="text-[10px] text-gray-500 ml-2">
            (SIREN · RAVE · LAB · GUA · BILL · UB · M · H lifecycle)
          </span>
        </CardTitle>
        <span className="text-gray-500 text-xs">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-4 text-[11px]">
          <Phase
            title="Phase 1: Setup — best LONG entry (pre-pump)"
            color="text-blue-400"
            rows={[
              ["BNB Chain or Solana deployment", "Default cohort venues (cheap gas, MM-friendly)"],
              ["Bitget listing first (spot → margin → perp)", '"The Chinese CEX cartel venue" per @zachxbt'],
              ["Sister listings on Gate / MEXC / KuCoin / XT", "Chinese-CEX cluster"],
              ["Aster DEX trading campaign", "BNB-affiliated front-running"],
              ["<15% circulating, ≥3× FDV/MC", "Locked supply weaponised for distribution"],
              ["Top-10 wallets >85%", "Orchestrators control float"],
              ["Known incubator: Manta Network, HairDAO, DWF Labs, Amber Group", "Cohort sponsors"],
              ["Fluff narrative: AI/MBTI/metaphysics (GUA), DeSci hair (LAB), AI agent (SIREN), Chinese meme (币安人生)", "Disguises pure speculation"],
            ]}
          />
          <Phase
            title="Phase 2: Catalyst — last LONG entry (mid-pump)"
            color="text-green-400"
            rows={[
              ["Binance Alpha showcase", "Mainstream retail discovery — pump begins"],
              ["Binance Futures perp launch", "Retail can lever — parabolic leg"],
              ["CT mentions surge ($SYMBOL cashtag volume)", "FOMO entering"],
              ["Pump multiple ≥3× from listing", "Late but momentum alive"],
              ["Funding flips ≥+50% ann", "Crowded long forming — often exact peak"],
            ]}
          />
          <Phase
            title="Phase 3: Distribution — SHORT entry zone"
            color="text-orange-400"
            rows={[
              ["0xNoxxx-style alerts: X tokens moved from Bitget cold wallet", "Insider preparation to dump"],
              ["Nansen smart money 7d outflow ≥ -$5M", "Smart wallets exit before retail"],
              ["CEX inflow 7d ≥ +$10M", "Pre-distribution staging"],
              ["CT divergence: zachxbt 'crime cartel' vs shillers '$20+ coming'", "Cycle apex marker"],
              ["Pump multiple ≥5–10×", "Reflexive top"],
              ["@antiMoonn / @Eveningtraders posting short setups", "Smart-money shorts activated"],
              ["Funding ≥+200% ann (GUA-level)", "Late-stage crowded long, ripe to flip"],
            ]}
          />
          <Phase
            title="Phase 4: Terminal — close shorts"
            color="text-red-400"
            rows={[
              ["Bitget removes the pair (like $ZEREBRO)", "Scheme over — cover shorts"],
              ["Volume collapses ≥80% from peak", "Liquidity exit by orchestrators"],
              ["CT goes silent", "No more retail to harvest"],
            ]}
          />
          <div className="text-[10px] text-gray-500 italic border-t border-gray-800 pt-2">
            Scanner coverage: Phase 1 (Live — Bitget feed, small_mc pillar, CN-pattern detector, incubator),
            Phase 2 (Live — CMS feed, perp_launched_at, funding_favor),
            Phase 3 (Partial — Nansen sparse, manual X-inject),
            Phase 4 (Not wired — Bitget delisting detection pending).
          </div>
        </div>
      )}
    </Card>
    </div>
  );
}
