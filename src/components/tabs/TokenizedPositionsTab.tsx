import { useTokenizedPositions } from "../../hooks/useDashboardQuery";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { formatUSD, cn } from "../../lib/utils";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { TokenizedPairRow } from "../../types/api";

// formatUSD already prepends "$" and handles negative sign — these wrappers
// just add a "+" for positives so colour-coded P&Ls look right.
function fmtPnL(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${formatUSD(v, decimals)}`;
}
function fmtUSD(v: number | null | undefined, decimals = 0): string {
  if (v == null) return "—";
  return formatUSD(v, decimals);
}
function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  const decimals = v < 1 ? 4 : v < 100 ? 3 : 2;
  return formatUSD(v, decimals);
}
function pnlClass(v: number | null | undefined): string {
  if (v == null) return "text-gray-400";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-gray-400";
}
function fmtAPR(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}
function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}

type Variant = "default" | "success" | "danger" | "warning" | "info";
function statusBadgeVariant(status: TokenizedPairRow["status"]): Variant {
  switch (status) {
    case "active": return "success";
    case "ready": return "info";
    case "dry_run": return "warning";
    case "exit_fired": return "danger";
    case "cold": return "default";
    default: return "default";
  }
}
function statusLabel(status: TokenizedPairRow["status"]): string {
  switch (status) {
    case "active": return "LIVE / active";
    case "ready": return "LIVE / next rebalance";
    case "dry_run": return "DRY-RUN (logging only)";
    case "exit_fired": return "EXIT GATE FIRED";
    case "cold": return "cold (no cache yet)";
    default: return status;
  }
}

function fmtBigUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${formatUSD(v / 1e9, 2)}B`;
  if (abs >= 1e6) return `${formatUSD(v / 1e6, 1)}M`;
  if (abs >= 1e3) return `${formatUSD(v / 1e3, 1)}K`;
  return formatUSD(v, 0);
}

// 7d funding APR cell colors amber when it diverges from all-history by
// more than ~30% relative — early warning that trailing carry is rolling
// off (or spiking) before the exit gate fires.
function divergedFromAllTime(
  recent: number | null | undefined,
  allTime: number | null | undefined,
): boolean {
  if (recent == null || allTime == null) return false;
  if (Math.abs(allTime) < 1.0) return false; // tiny baselines are noisy
  return Math.abs(recent - allTime) / Math.abs(allTime) > 0.30;
}

type FundingWindows = {
  apr_24h_756: number | null;
  apr_7d_756: number | null;
  apr_all_756: number | null;
  apr_all_1095: number | null;
  n_weekday_24h: number | null;
  n_weekday_7d: number | null;
  n_weekday_all: number | null;
  first_event_iso: string | null;
  last_event_iso: string | null;
  span_days: number | null;
} | null;

function LegRow({
  side, symbol, qty, entry, mark, notional, target_notional, pnl, pnl_pct, funding,
  fundingApr, fundingAprNow, fundingPerSettle, fundingWindows, vol24h, openInterest,
}: {
  side: "LONG" | "SHORT";
  symbol: string;
  qty: number | null;
  entry: number | null;
  mark: number | null;
  notional: number | null;
  target_notional: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  funding: number | null;
  fundingApr: number | null;
  fundingAprNow: number | null;
  fundingPerSettle: number | null;
  fundingWindows: FundingWindows;
  vol24h: number | null;
  openInterest: number | null;
}) {
  const sideColor = side === "LONG" ? "text-blue-400" : "text-orange-400";
  const driftPct = (notional != null && target_notional != null && target_notional > 0)
    ? (notional - target_notional) / target_notional * 100
    : null;
  return (
    <tr className="border-b border-gray-900 hover:bg-gray-900/40">
      <td className="px-2 py-2">
        <span className={cn("font-mono text-sm font-semibold", sideColor)}>{side}</span>
      </td>
      <td className="px-2 py-2 font-mono text-sm text-gray-200">{symbol.replace(/USDT$/, "")}</td>
      <td className="px-2 py-2 text-right tabular-nums text-sm text-gray-300">
        {qty == null ? "—" : qty.toFixed(4)}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-sm text-gray-300">{fmtPrice(entry)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-sm text-gray-300">{fmtPrice(mark)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-sm text-gray-100">{fmtUSD(notional)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-xs text-gray-500">{fmtUSD(target_notional)}</td>
      <td className={cn("px-2 py-2 text-right tabular-nums text-xs", driftPct != null && Math.abs(driftPct) > 5 ? "text-amber-400" : "text-gray-500")}>
        {driftPct == null ? "—" : (driftPct >= 0 ? "+" : "") + driftPct.toFixed(1) + "%"}
      </td>
      <td className={cn("px-2 py-2 text-right tabular-nums text-sm font-semibold", pnlClass(pnl))}>
        {fmtPnL(pnl)}
      </td>
      <td className={cn("px-2 py-2 text-right tabular-nums text-xs", pnlClass(pnl_pct))}>
        {fmtPct(pnl_pct)}
      </td>
      <td className={cn("px-2 py-2 text-right tabular-nums text-sm", pnlClass(funding))}>
        {fmtPnL(funding)}
      </td>
      <td className="px-2 py-2 text-right text-xs tabular-nums">
        <div className={cn("font-semibold", pnlClass(fundingAprNow ?? fundingApr))} title="Live current funding APR — last published 8h rate × 756 (weekday-only, 3 settles/day × 252 weekday days). Position-relative sign. Falls back to all-history weekday mean for tokenized perps when Binance publishes lastFundingRate=0 between settles.">
          {fundingAprNow != null ? (
            <>
              <span className="text-[9px] text-gray-500 mr-1">NOW</span>
              {fmtAPR(fundingAprNow)}
            </>
          ) : (
            fmtAPR(fundingApr)
          )}
        </div>
        {fundingWindows && (
          <div className="text-[10px] leading-tight text-gray-500 mt-0.5 space-y-px">
            {fundingAprNow != null && fundingApr != null && (
              <div>
                <span className="text-gray-600">all-time</span>{" "}
                <span className="tabular-nums">{fmtAPR(fundingApr)}</span>
              </div>
            )}
            <div>
              <span className="text-gray-600">24h</span>{" "}
              <span className="tabular-nums">{fmtAPR(fundingWindows.apr_24h_756)}</span>
            </div>
            <div>
              <span className="text-gray-600">7d</span>{" "}
              <span className={cn("tabular-nums",
                divergedFromAllTime(fundingWindows.apr_7d_756, fundingWindows.apr_all_756) ? "text-amber-400" : ""
              )}>
                {fmtAPR(fundingWindows.apr_7d_756)}
              </span>
            </div>
            <div className="text-gray-600">n={fundingWindows.n_weekday_all ?? "—"}</div>
          </div>
        )}
      </td>
      <td className={cn("px-2 py-2 text-right tabular-nums text-xs", pnlClass(fundingPerSettle))}>
        {fmtPnL(fundingPerSettle, 3)}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-xs text-gray-400">{fmtBigUSD(vol24h)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-xs text-gray-400">{fmtBigUSD(openInterest)}</td>
    </tr>
  );
}

function PairCard({ pair }: { pair: TokenizedPairRow }) {
  const t = pair.target;
  const a = pair.actual;
  const c = pair.carry;
  const longLabel = pair.long_symbol.replace(/USDT$/, "");
  const shortLabel = pair.short_symbol.replace(/USDT$/, "");

  const seriesData = pair.carry_series_30d.map((p) => ({
    ts: p.ts,
    iso: new Date(p.ts * 1000).toISOString().slice(5, 10),
    carry: p.carry_apr_2x,
  }));

  const carryTrend = (() => {
    if (seriesData.length < 2) return null;
    return seriesData[seriesData.length - 1].carry - seriesData[0].carry;
  })();

  const distancePct = c.distance_to_threshold_pct_pts;
  const distanceColor =
    distancePct == null ? "text-gray-400" :
    distancePct > 10 ? "text-emerald-400" :
    distancePct > 0 ? "text-amber-400" : "text-rose-400";

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold text-gray-100">L {longLabel} / S {shortLabel}</div>
            <Badge variant={statusBadgeVariant(pair.status)}>{statusLabel(pair.status)}</Badge>
          </div>
          <div className="text-xs text-gray-500 font-mono">pair_id: {pair.id}</div>
          {pair.underlying && (
            <div className="text-xs text-gray-400 mt-0.5 max-w-xl">
              <span className="text-blue-400">Long</span> {pair.underlying.long.label ?? longLabel}
              {pair.underlying.long.subsector ? ` (${pair.underlying.long.subsector})` : ""}
              {" · "}
              <span className="text-orange-400">Short</span> {pair.underlying.short.label ?? shortLabel}
              {pair.underlying.short.subsector ? ` (${pair.underlying.short.subsector})` : ""}
            </div>
          )}
        </div>
        {a && (
          <div className="text-xs text-gray-500 text-right">
            <div>held for <span className="text-gray-300 tabular-nums">{a.days_held.toFixed(2)}d</span></div>
            {a.long_entry_time && <div>since {a.long_entry_time.slice(0, 10)}</div>}
          </div>
        )}
      </div>

      {/* Sizing / construction */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-0.5">
          <div className="text-xs text-gray-500">Pair gross (target)</div>
          <div className="text-base font-semibold text-gray-100 tabular-nums">
            {t ? fmtUSD(t.pair_gross) : "—"}
          </div>
          {t && (
            <div className="text-xs text-gray-500">
              {t.natural_share_pct.toFixed(2)}% of pool
              {t.cap_binding && <span className="ml-1 text-amber-400">/CAP</span>}
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-gray-500">Pair gross (actual)</div>
          <div className="text-base font-semibold text-gray-100 tabular-nums">
            {a ? fmtUSD(a.long_notional + a.short_notional) : "—"}
          </div>
          {a && t && (
            <div className="text-xs text-gray-500">
              {((a.long_notional + a.short_notional) / t.pair_gross * 100).toFixed(0)}% of target
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-gray-500">h* (beta-neutral)</div>
          <div className="text-base text-gray-100 tabular-nums">{t ? t.h_star.toFixed(3) : "—"}</div>
          {t && (
            <div className="text-xs text-gray-500">σ pair {t.pair_residual_vol_daily_pct.toFixed(2)}%/d</div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-gray-500">Expected carry APR</div>
          <div className={cn("text-base font-semibold tabular-nums", t && t.expected_carry_apr_2x >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {t ? fmtAPR(t.expected_carry_apr_2x) : "—"}
          </div>
          <div className="text-xs text-gray-500">2x leverage</div>
        </div>
      </div>

      {/* Per-leg table — entry, mark, qty, notional, drift, P&L, funding */}
      {a ? (
        <div className="overflow-x-auto rounded border border-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900/60 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-2 py-2 text-left">Side</th>
                <th className="px-2 py-2 text-left">Symbol</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Entry</th>
                <th className="px-2 py-2 text-right">Mark</th>
                <th className="px-2 py-2 text-right">Notional</th>
                <th className="px-2 py-2 text-right">Target</th>
                <th className="px-2 py-2 text-right">Drift</th>
                <th className="px-2 py-2 text-right">P&L $</th>
                <th className="px-2 py-2 text-right">P&L %</th>
                <th className="px-2 py-2 text-right">Funding $</th>
                <th className="px-2 py-2 text-right">Funding APR</th>
                <th className="px-2 py-2 text-right">Per settle</th>
                <th className="px-2 py-2 text-right">24h Vol</th>
                <th className="px-2 py-2 text-right">OI</th>
              </tr>
            </thead>
            <tbody>
              <LegRow
                side="LONG" symbol={pair.long_symbol}
                qty={a.long_qty} entry={a.long_entry_price} mark={a.long_mark_price}
                notional={a.long_notional} target_notional={t?.long_notional ?? null}
                pnl={a.long_pnl_usd} pnl_pct={a.long_pnl_pct} funding={a.long_funding_accrued_usd}
                fundingApr={t?.long_received_funding_apr_pct ?? null}
                fundingAprNow={a.long_funding_rate_ann_now_pct ?? null}
                fundingPerSettle={t?.long_expected_funding_per_settle_usd ?? null}
                fundingWindows={t?.long_funding_windows ?? null}
                vol24h={a.long_vol_24h_usd} openInterest={a.long_open_interest_usd}
              />
              <LegRow
                side="SHORT" symbol={pair.short_symbol}
                qty={a.short_qty} entry={a.short_entry_price} mark={a.short_mark_price}
                notional={a.short_notional} target_notional={t?.short_notional ?? null}
                pnl={a.short_pnl_usd} pnl_pct={a.short_pnl_pct} funding={a.short_funding_accrued_usd}
                fundingApr={t?.short_received_funding_apr_pct ?? null}
                fundingAprNow={a.short_funding_rate_ann_now_pct ?? null}
                fundingPerSettle={t?.short_expected_funding_per_settle_usd ?? null}
                fundingWindows={t?.short_funding_windows ?? null}
                vol24h={a.short_vol_24h_usd} openInterest={a.short_open_interest_usd}
              />
              <tr className="border-t border-gray-800 bg-gray-900/30 font-semibold">
                <td colSpan={5} className="px-2 py-2 text-right text-xs text-gray-500 uppercase">Pair total</td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-100">
                  {fmtUSD(a.long_notional + a.short_notional)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-xs text-gray-500">
                  {t ? fmtUSD(t.pair_gross) : "—"}
                </td>
                <td className="px-2 py-2"></td>
                <td className={cn("px-2 py-2 text-right tabular-nums", pnlClass(a.spread_pnl_usd))}>
                  {fmtPnL(a.spread_pnl_usd)}
                </td>
                <td className="px-2 py-2"></td>
                <td className={cn("px-2 py-2 text-right tabular-nums", pnlClass(a.total_funding_accrued_usd))}>
                  {fmtPnL(a.total_funding_accrued_usd)}
                </td>
                <td colSpan={4} className="px-2 py-2"></td>
              </tr>
              <tr className="bg-gray-900/30">
                <td colSpan={8} className="px-2 py-2 text-right text-xs text-gray-500 uppercase">
                  Total return (spread P&L + funding)
                </td>
                <td colSpan={7} className={cn("px-2 py-2 text-right tabular-nums text-base font-semibold", pnlClass(a.total_pnl_with_funding_usd))}>
                  {fmtPnL(a.total_pnl_with_funding_usd)}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="px-2 pt-2 pb-1 text-[10px] leading-snug text-gray-500 border-t border-gray-900 bg-gray-950/40">
            <span className="text-gray-400 font-medium">Funding APR basis.</span>{" "}
            Headline figure is the all-history weekday mean annualized × 756
            (3 settles/day × 252 weekday days). Reconciles to realized cash
            flow. Position-relative sign (long earns −funding_rate, short earns
            +funding_rate). Sub-lines show last 24h and last 7d on the same
            756 base; 7d turns amber when it diverges from all-time by more
            than ~30%. {t?.long_funding_windows?.first_event_iso && (
              <span>EWJUSDT history begins {t.long_funding_windows.first_event_iso.slice(0, 10)} (n={t.long_funding_windows.n_weekday_all ?? "—"} weekday settles).</span>
            )}{" "}
            The Binance API publishes APR on a × 3 × 365 = 1095 base which
            overstates cash yield on weekday-only contracts by ~45%; we keep
            it under <code className="text-gray-400">apr_all_1095</code> for
            back-compat but do not use it as a headline.
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          No active positions yet.{" "}
          {pair.status === "dry_run"
            ? "Dry-run logs the targets above; live trades begin when TOKENIZED_DRY_RUN env var is set to false."
            : "Targets above will fire on the next rebalance."}
        </div>
      )}

      {/* Carry status */}
      <div className="rounded border border-gray-800 bg-gray-900/40 p-3 space-y-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-gray-200">Carry status (exit gate)</div>
          <div className="text-xs text-gray-500">
            {c.window_days}d rolling · {c.n_snapshots} snapshots · decision: <span className="text-gray-300">{c.decision_reason}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">Current carry APR (2x)</div>
            <div className={cn("font-semibold tabular-nums", c.now_apr_2x != null && c.now_apr_2x >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {fmtAPR(c.now_apr_2x)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{c.window_days}d rolling mean</div>
            <div className={cn("font-semibold tabular-nums", c.rolling_mean_apr_2x != null && c.rolling_mean_apr_2x >= c.threshold_apr_2x ? "text-emerald-400" : "text-rose-400")}>
              {fmtAPR(c.rolling_mean_apr_2x)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Exit threshold</div>
            <div className="font-semibold text-gray-300 tabular-nums">{fmtAPR(c.threshold_apr_2x)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Distance to threshold</div>
            <div className={cn("font-semibold tabular-nums", distanceColor)}>
              {distancePct == null ? "—" : (distancePct >= 0 ? "+" : "") + distancePct.toFixed(2) + "pp"}
            </div>
          </div>
        </div>
        {seriesData.length >= 2 && (
          <div className="mt-2">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-xs text-gray-500">30d carry trajectory</div>
              {carryTrend != null && (
                <div className={cn("text-xs tabular-nums", carryTrend >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {carryTrend >= 0 ? "↑" : "↓"} {Math.abs(carryTrend).toFixed(2)}pp over series
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={seriesData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="iso" tick={{ fill: "#64748b", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} width={36} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                  formatter={(v) => `${Number(v ?? 0).toFixed(2)}% APR`}
                  labelFormatter={(l) => `date ${l}`}
                />
                <ReferenceLine y={c.threshold_apr_2x} stroke="#f59e0b" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="carry" stroke="#10b981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}

export function TokenizedPositionsTab() {
  const { data, isLoading, error } = useTokenizedPositions(30);

  if (isLoading && !data) {
    return <div className="p-4 text-gray-400">Loading tokenized positions…</div>;
  }
  if (error) {
    return <div className="p-4 text-rose-400">Failed to load tokenized positions: {(error as Error).message}</div>;
  }
  if (!data) return null;

  if (!data.enabled) {
    return (
      <div className="p-4 space-y-2">
        <Card className="p-4 text-sm text-gray-300">
          Tokenized positions sleeve is disabled (<code>TOKENIZED_ENABLED=false</code>).
          No positions in this category.
        </Card>
      </div>
    );
  }

  const h = data.health;
  const dryRunBadge = data.dry_run ? "DRY-RUN" : "LIVE";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-semibold text-gray-100">Tokenized positions</div>
          <div className="text-xs text-gray-500">
            Permanent index/ETF pairs on Binance USDT-M. Sized at residual-vol with
            no alpha tilt, beta-neutral via h*, included in resize rebalances,
            excluded from rotation. Closed only when {data.config?.carry_eval_window_days ?? 7}d
            rolling carry falls below per-pair threshold.
          </div>
        </div>
        <Badge variant={data.dry_run ? "warning" : "success"}>{dryRunBadge}</Badge>
      </div>

      {/* Funding schedule banner */}
      {data.funding_info && (
        <Card className="p-3 bg-gray-900/40 border-gray-800">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Funding</div>
            <div>
              <span className="text-gray-500">Cycle:</span>{" "}
              <span className="text-gray-200">8h (00 / 08 / 16 UTC)</span>
            </div>
            <div>
              <span className="text-gray-500">Accrual:</span>{" "}
              <span className="text-amber-300">weekdays only</span>{" "}
              <span className="text-gray-500">(~{data.funding_info.settles_per_year} settles/yr)</span>
            </div>
            <div>
              <span className="text-gray-500">Next settle:</span>{" "}
              <span className="text-gray-200 tabular-nums">
                {new Date(data.funding_info.next_settle_utc).toLocaleString(undefined, {
                  weekday: "short", month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
                })}
              </span>{" "}
              <span className="text-gray-500">
                (in {data.funding_info.hours_to_next_settle.toFixed(1)}h)
              </span>
              {data.funding_info.is_weekend && (
                <span className="ml-2 text-xs text-amber-400">[weekend skip in effect]</span>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1 italic">
            {data.funding_info.weekday_only_note}
          </div>
        </Card>
      )}

      {/* Health header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Active pairs"
          value={`${h.n_active} / ${h.n_configured}`}
          sub={h.n_pending_close > 0 ? `${h.n_pending_close} pending close` : undefined}
        />
        <KpiCard
          label="Gross (target)"
          value={fmtUSD(h.total_gross_target)}
          sub={h.total_gross_target_pct_of_notional != null ? `${h.total_gross_target_pct_of_notional.toFixed(2)}% of notional` : undefined}
        />
        <KpiCard label="Gross (actual)" value={fmtUSD(h.total_gross_actual)} />
        <KpiCard
          label="Weighted carry APR"
          value={fmtAPR(h.weighted_avg_carry_apr_2x)}
          valueColor={(h.weighted_avg_carry_apr_2x ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}
          sub="2x leverage, gross-weighted"
        />
        <KpiCard
          label="Unrealized P&L"
          value={fmtPnL(h.total_unrealized_pnl_usd)}
          valueColor={pnlClass(h.total_unrealized_pnl_usd)}
        />
        <KpiCard
          label="Funding accrued"
          value={fmtPnL(h.total_funding_accrued_usd)}
          valueColor={pnlClass(h.total_funding_accrued_usd)}
          sub={h.oldest_position_days_held != null ? `oldest pos ${h.oldest_position_days_held.toFixed(2)}d held` : "no positions yet"}
        />
      </div>

      {/* Per-pair cards */}
      {data.pairs.length === 0 ? (
        <Card className="p-4 text-sm text-gray-400">
          No pairs configured. Add entries to <code>TOKENIZED_PAIRS</code> in config.py.
        </Card>
      ) : (
        <div className="space-y-3">
          {data.pairs.map((p) => <PairCard key={p.id} pair={p} />)}
        </div>
      )}

      <div className="text-xs text-gray-500 italic">
        Updated {new Date(data.updated_at).toLocaleTimeString()} · refreshes every 60s ·
        carry snapshots persisted every ~5 min · exit gate needs ≥
        {data.config?.carry_eval_window_days != null ? Math.max(24, 0) : 24} snapshots before it can fire.
      </div>
    </div>
  );
}
