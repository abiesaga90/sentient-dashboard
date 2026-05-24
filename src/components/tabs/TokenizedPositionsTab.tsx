import { useTokenizedPositions } from "../../hooks/useDashboardQuery";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { formatUSD, cn } from "../../lib/utils";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { TokenizedPairRow } from "../../types/api";

function fmtPnL(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "−";
  return `${sign}$${formatUSD(Math.abs(v), 2)}`;
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
    const first = seriesData[0].carry;
    const last = seriesData[seriesData.length - 1].carry;
    return last - first;
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
            <div className="text-lg font-semibold text-gray-100">
              L {longLabel}  /  S {shortLabel}
            </div>
            <Badge variant={statusBadgeVariant(pair.status)}>
              {statusLabel(pair.status)}
            </Badge>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            pair_id: {pair.id}
          </div>
        </div>
        {a && (
          <div className="text-xs text-gray-500 text-right">
            <div>held for <span className="text-gray-300 tabular-nums">{a.days_held.toFixed(1)}d</span></div>
            {a.long_entry_time && (
              <div>since {a.long_entry_time.slice(0, 10)}</div>
            )}
          </div>
        )}
      </div>

      {/* Sizing block */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-0.5">
          <div className="text-xs text-gray-500">Pair gross (target)</div>
          <div className="text-base font-semibold text-gray-100 tabular-nums">
            ${t ? formatUSD(t.pair_gross, 0) : "—"}
          </div>
          {t && (
            <div className="text-xs text-gray-500">
              {t.natural_share_pct.toFixed(2)}% of pool
              {t.cap_binding && <span className="ml-1 text-amber-400">/CAP</span>}
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-gray-500">Long {longLabel}</div>
          <div className="text-base text-blue-400 tabular-nums">
            ${t ? formatUSD(t.long_notional, 0) : "—"}
          </div>
          {a && (
            <div className="text-xs text-gray-500 tabular-nums">
              actual ${formatUSD(a.long_notional, 0)}
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-gray-500">Short {shortLabel}</div>
          <div className="text-base text-orange-400 tabular-nums">
            ${t ? formatUSD(t.short_notional, 0) : "—"}
          </div>
          {a && (
            <div className="text-xs text-gray-500 tabular-nums">
              actual ${formatUSD(a.short_notional, 0)}
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-gray-500">h* (beta-neutral)</div>
          <div className="text-base text-gray-100 tabular-nums">
            {t ? t.h_star.toFixed(3) : "—"}
          </div>
          {t && (
            <div className="text-xs text-gray-500">
              σ pair {t.pair_residual_vol_daily_pct.toFixed(2)}%/d
            </div>
          )}
        </div>
      </div>

      {/* Carry status */}
      <div className="rounded border border-gray-800 bg-gray-900/40 p-3 space-y-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-gray-200">
            Carry status (exit gate)
          </div>
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
            <div className="text-xs text-gray-500">7d rolling mean</div>
            <div className={cn("font-semibold tabular-nums", c.rolling_mean_apr_2x != null && c.rolling_mean_apr_2x >= c.threshold_apr_2x ? "text-emerald-400" : "text-rose-400")}>
              {fmtAPR(c.rolling_mean_apr_2x)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Exit threshold</div>
            <div className="font-semibold text-gray-300 tabular-nums">
              {fmtAPR(c.threshold_apr_2x)}
            </div>
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

      {/* P&L + funding accrued (the realized carry) */}
      {a ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">Long P&L</div>
            <div className={cn("font-semibold tabular-nums", pnlClass(a.long_pnl_usd))}>
              {fmtPnL(a.long_pnl_usd)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Short P&L</div>
            <div className={cn("font-semibold tabular-nums", pnlClass(a.short_pnl_usd))}>
              {fmtPnL(a.short_pnl_usd)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Spread P&L (long + short)</div>
            <div className={cn("text-base font-semibold tabular-nums", pnlClass(a.spread_pnl_usd))}>
              {fmtPnL(a.spread_pnl_usd)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Funding accrued (realized carry)</div>
            <div className={cn("text-base font-semibold tabular-nums", pnlClass(a.total_funding_accrued_usd))}>
              {fmtPnL(a.total_funding_accrued_usd)}
            </div>
            <div className="text-xs text-gray-500">
              L {fmtPnL(a.long_funding_accrued_usd)}  ·  S {fmtPnL(a.short_funding_accrued_usd)}
            </div>
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
            excluded from rotation. Closed only when {h.n_configured > 0 ? data.config?.carry_eval_window_days ?? 7 : 7}d rolling carry falls below per-pair threshold.
          </div>
        </div>
        <Badge variant={data.dry_run ? "warning" : "success"}>{dryRunBadge}</Badge>
      </div>

      {/* Health header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Active pairs"
          value={`${h.n_active} / ${h.n_configured}`}
          sub={h.n_pending_close > 0 ? `${h.n_pending_close} pending close` : undefined}
        />
        <KpiCard
          label="Gross (target)"
          value={`$${formatUSD(h.total_gross_target, 0)}`}
          sub={h.total_gross_target_pct_of_notional != null ? `${h.total_gross_target_pct_of_notional.toFixed(2)}% of notional` : undefined}
        />
        <KpiCard
          label="Gross (actual)"
          value={`$${formatUSD(h.total_gross_actual, 0)}`}
        />
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
          sub={h.oldest_position_days_held != null ? `oldest pos ${h.oldest_position_days_held.toFixed(1)}d held` : "no positions yet"}
        />
      </div>

      {/* Per-pair cards */}
      {data.pairs.length === 0 ? (
        <Card className="p-4 text-sm text-gray-400">
          No pairs configured. Add entries to <code>TOKENIZED_PAIRS</code> in config.py.
        </Card>
      ) : (
        <div className="space-y-3">
          {data.pairs.map((p) => (
            <PairCard key={p.id} pair={p} />
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500 italic">
        Updated {new Date(data.updated_at).toLocaleTimeString()} · refreshes every 60s ·
        carry snapshots persisted every {data.config?.carry_eval_window_days ? "~5 min" : "5 min"} ·
        exit gate needs ≥24 snapshots (~2h) before it can fire.
      </div>
    </div>
  );
}
