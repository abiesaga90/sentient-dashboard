import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  useSizingMode,
  useSizingShadow,
  useSizingShadowHistory,
  type SizingShadowPerShort,
} from "../../hooks/useDashboardQuery";

/**
 * Sizing Shadow tab — Phase C critical.
 *
 * Renders what the INACTIVE short-sizing mode would have produced at the
 * last rebalance, alongside live. Backs the "should we flip?" decision
 * during the shadow run (see nickel-ls-rv tasks/option2_symmetric_residual_vol.md).
 *
 * Kill-switch thresholds from /api/sizing/shadow/latest drive row colors
 * and the status-pill badge. If max |Δshare| breaches the crit line,
 * this tab says so loudly — no log-grepping required.
 */

type SortKey =
  | "symbol"
  | "live_share_pct"
  | "shadow_share_pct"
  | "delta_share_pct"
  | "beta"
  | "correlation"
  | "residual_vol_ratio";

const fmtPct = (n: number | null | undefined, digits = 2): string =>
  n == null ? "—" : `${n.toFixed(digits)}%`;

const fmtNum = (n: number | null | undefined, digits = 3): string =>
  n == null ? "—" : n.toFixed(digits);

const fmtNotional = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
};

const fmtTimestamp = (iso?: string): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const deltaColor = (
  absDelta: number,
  warn: number,
  crit: number
): string => {
  if (absDelta >= crit) return "text-red-400 font-semibold";
  if (absDelta >= warn) return "text-orange-400";
  if (absDelta >= warn / 2) return "text-yellow-400";
  return "text-gray-300";
};

const deltaBg = (absDelta: number, warn: number, crit: number): string => {
  if (absDelta >= crit) return "bg-red-500/10 border-red-500/40";
  if (absDelta >= warn) return "bg-orange-500/10 border-orange-500/30";
  return "";
};

const ratioColor = (ratio: number | null | undefined): string => {
  if (ratio == null) return "text-gray-400";
  if (ratio < 0.3) return "text-green-400";
  if (ratio < 0.6) return "text-yellow-400";
  if (ratio < 0.85) return "text-orange-400";
  return "text-red-400";
};

const sideDirection = (
  delta: number
): "gains" | "loses" | "flat" => {
  if (delta > 0.1) return "gains";
  if (delta < -0.1) return "loses";
  return "flat";
};

export function SizingShadowTab() {
  const { data: mode, isLoading: modeLoading } = useSizingMode();
  const { data: shadow, isLoading: shadowLoading, error } = useSizingShadow();
  const { data: history } = useSizingShadowHistory();

  const [sortKey, setSortKey] = useState<SortKey>("delta_share_pct");
  const [sortDesc, setSortDesc] = useState(true);

  const sortedRows = useMemo<SizingShadowPerShort[]>(() => {
    const rows = shadow?.per_short ?? [];
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = (a as any)[sortKey];
      const vb = (b as any)[sortKey];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      // For delta_share_pct, sort by absolute value by default
      if (sortKey === "delta_share_pct") {
        const na = Math.abs(Number(va ?? 0));
        const nb = Math.abs(Number(vb ?? 0));
        return sortDesc ? nb - na : na - nb;
      }
      const na = Number(va ?? 0);
      const nb = Number(vb ?? 0);
      return sortDesc ? nb - na : na - nb;
    });
    return arr;
  }, [shadow, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-red-400 text-sm">
            Failed to load sizing shadow: {String(error)}
          </div>
        </Card>
      </div>
    );
  }

  if ((modeLoading || shadowLoading) && !shadow) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-gray-400 text-sm">Loading sizing shadow…</div>
        </Card>
      </div>
    );
  }

  if (!shadow?.available) {
    return (
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Sizing Shadow</CardTitle>
          </CardHeader>
          <div className="text-gray-400 text-sm">
            {shadow?.reason ||
              "No sizing-shadow snapshot yet. The first shadow is computed on the next rebalance."}
          </div>
        </Card>
      </div>
    );
  }

  const totals = shadow.totals!;
  const thresholds = shadow.thresholds!;
  const betaErr = shadow.beta_neutrality_err_pct!;
  const maxDelta = totals.max_abs_delta_share_pct;

  const killSwitchFired =
    maxDelta >= thresholds.delta_share_crit_pct ||
    (betaErr.shadow ?? 0) >= thresholds.beta_neutrality_crit_pct;

  const killSwitchWarn =
    !killSwitchFired &&
    (maxDelta >= thresholds.delta_share_warn_pct ||
      (betaErr.shadow ?? 0) >=
        thresholds.beta_neutrality_crit_pct * 0.6);

  const statusColor = killSwitchFired
    ? "text-red-400"
    : killSwitchWarn
    ? "text-orange-400"
    : "text-green-400";

  const statusLabel = killSwitchFired
    ? "CRIT — REVERT CONDITION"
    : killSwitchWarn
    ? "WARN — elevated divergence"
    : "OK — within thresholds";

  return (
    <div className="p-4 space-y-4">
      {/* Kill-switch banner */}
      {(killSwitchFired || killSwitchWarn) && (
        <div
          className={`rounded-xl border p-4 ${
            killSwitchFired
              ? "border-red-500/60 bg-red-500/10"
              : "border-orange-500/50 bg-orange-500/10"
          }`}
        >
          <div
            className={`text-sm font-semibold ${
              killSwitchFired ? "text-red-400" : "text-orange-400"
            }`}
          >
            {killSwitchFired
              ? "Kill-switch triggered — investigate before flipping sizing mode"
              : "Elevated sizing divergence — monitor"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Max |Δshare| = {fmtPct(maxDelta, 2)} (warn≥
            {thresholds.delta_share_warn_pct}%, crit≥
            {thresholds.delta_share_crit_pct}%). β-err shadow ={" "}
            {fmtPct(betaErr.shadow, 2)} (crit≥
            {thresholds.beta_neutrality_crit_pct}%).
          </div>
        </div>
      )}

      {/* Mode explainer card */}
      <Card>
        <CardHeader>
          <CardTitle>Active sizing modes</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-xs uppercase text-gray-500">Longs</div>
            <div className="font-mono text-gray-200">
              {mode?.longs.mode ?? "—"}
            </div>
            <div className="font-mono text-xs text-gray-500">
              {mode?.longs.formula ?? ""}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              vol_power={mode?.longs.vol_power} · floor=
              {mode?.longs.residual_vol_floor_ratio}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase text-gray-500">Shorts</div>
            <div className="font-mono text-gray-200">
              {mode?.shorts.mode ?? "—"}
            </div>
            <div className="font-mono text-xs text-gray-500">
              {mode?.shorts.formula ?? ""}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              vol_power={mode?.shorts.vol_power} · floor=
              {mode?.shorts.residual_vol_floor_ratio}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <Badge variant={mode?.symmetric ? "success" : "warning"}>
            {mode?.symmetric ? "symmetric" : "asymmetric"}
          </Badge>
          lookback {mode?.vol_lookback_hours}h · hedge basket for longs:{" "}
          {mode?.hedge_basket_for_longs}
        </div>
      </Card>

      {/* Status KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Status"
          value={statusLabel}
          valueColor={statusColor}
          sub={`computed ${fmtTimestamp(shadow.computed_at)}`}
        />
        <KpiCard
          label="Live mode"
          value={shadow.live_mode ?? "—"}
          sub="active in production"
        />
        <KpiCard
          label="Shadow mode"
          value={shadow.shadow_mode ?? "—"}
          sub="what-if simulation"
        />
        <KpiCard
          label="Max |Δshare|"
          value={fmtPct(maxDelta, 2)}
          valueColor={deltaColor(
            maxDelta,
            thresholds.delta_share_warn_pct,
            thresholds.delta_share_crit_pct
          )}
          sub={`warn≥${thresholds.delta_share_warn_pct}% crit≥${thresholds.delta_share_crit_pct}%`}
        />
        <KpiCard
          label="β-neutrality err"
          value={`${fmtPct(betaErr.live, 2)} / ${fmtPct(betaErr.shadow, 2)}`}
          valueColor={
            (betaErr.shadow ?? 0) >= thresholds.beta_neutrality_crit_pct
              ? "text-red-400"
              : "text-gray-200"
          }
          sub="live / shadow"
        />
      </div>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Basket totals</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">Short gross (live)</div>
            <div className="text-gray-200 font-mono">
              {fmtNotional(totals.live_short_gross)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Short gross (shadow)</div>
            <div className="text-gray-200 font-mono">
              {fmtNotional(totals.shadow_short_gross)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Long gross (live)</div>
            <div className="text-gray-200 font-mono">
              {fmtNotional(totals.live_long_gross)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Long gross (shadow)</div>
            <div className="text-gray-200 font-mono">
              {fmtNotional(totals.shadow_long_gross)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">N shorts live / shadow</div>
            <div className="text-gray-200 font-mono">
              {totals.n_shorts_live} / {totals.n_shorts_shadow}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">NAV</div>
            <div className="text-gray-200 font-mono">
              {fmtNotional(shadow.nav)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Sizing base</div>
            <div className="text-gray-200 font-mono">
              {fmtNotional(shadow.sizing_base)}
            </div>
          </div>
        </div>
      </Card>

      {/* Cumulative P&L curve — live vs shadow + delta */}
      <ShadowEquityCurve history={history} />

      {/* Per-short table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Per-short comparison ({sortedRows.length} names) — sorted by |Δshare|
          </CardTitle>
        </CardHeader>
        <div className="text-xs text-gray-500 mb-2">
          Δshare = shadow_share − live_share. Positive = Option 2 gives this
          name more weight; negative = less. Color reflects kill-switch
          thresholds.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {headerCell(
                  "Symbol",
                  "symbol",
                  "left",
                  sortKey,
                  sortDesc,
                  handleSort
                )}
                {headerCell(
                  "Live %",
                  "live_share_pct",
                  "right",
                  sortKey,
                  sortDesc,
                  handleSort
                )}
                {headerCell(
                  "Shadow %",
                  "shadow_share_pct",
                  "right",
                  sortKey,
                  sortDesc,
                  handleSort
                )}
                {headerCell(
                  "Δshare %",
                  "delta_share_pct",
                  "right",
                  sortKey,
                  sortDesc,
                  handleSort
                )}
                {headerCell(
                  "β",
                  "beta",
                  "right",
                  sortKey,
                  sortDesc,
                  handleSort
                )}
                {headerCell(
                  "ρ",
                  "correlation",
                  "right",
                  sortKey,
                  sortDesc,
                  handleSort
                )}
                <th className="px-3 py-2 text-xs uppercase tracking-wider text-gray-500 text-right">
                  Vol
                </th>
                {headerCell(
                  "Resid/σ",
                  "residual_vol_ratio",
                  "right",
                  sortKey,
                  sortDesc,
                  handleSort
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const absDelta = Math.abs(r.delta_share_pct);
                const dir = sideDirection(r.delta_share_pct);
                return (
                  <tr
                    key={r.symbol}
                    className={`border-b border-[var(--border)] border-opacity-50 hover:bg-[var(--bg-card)] ${deltaBg(
                      absDelta,
                      thresholds.delta_share_warn_pct,
                      thresholds.delta_share_crit_pct
                    )}`}
                  >
                    <td className="px-3 py-2 text-gray-200 font-mono">
                      {r.symbol.replace("USDT", "")}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {fmtPct(r.live_share_pct, 2)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {fmtPct(r.shadow_share_pct, 2)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${deltaColor(
                        absDelta,
                        thresholds.delta_share_warn_pct,
                        thresholds.delta_share_crit_pct
                      )}`}
                    >
                      {r.delta_share_pct > 0 ? "+" : ""}
                      {r.delta_share_pct.toFixed(2)}%
                      {dir === "gains" && (
                        <span className="text-green-400 ml-1">↑</span>
                      )}
                      {dir === "loses" && (
                        <span className="text-red-400 ml-1">↓</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300 font-mono">
                      {fmtNum(r.beta, 2)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300 font-mono">
                      {fmtNum(r.correlation, 2)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400 font-mono">
                      {r.vol != null ? `${(r.vol * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${ratioColor(
                        r.residual_vol_ratio
                      )}`}
                    >
                      {r.residual_vol_ratio != null
                        ? r.residual_vol_ratio.toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          Resid/σ = residual_vol ÷ standalone_vol. Low = well-hedged by long
          basket (Option 2 tends to give these more weight). High = idio — gets
          less weight under Option 2 because risk contribution is larger.
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────── Helpers ──────────────────────── */

function headerCell(
  label: string,
  key: SortKey,
  align: "left" | "right",
  sortKey: SortKey,
  sortDesc: boolean,
  handleSort: (k: SortKey) => void
) {
  return (
    <th
      className={`px-3 py-2 text-xs uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-300 ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => handleSort(key)}
    >
      {label}
      {sortKey === key && (
        <span className="ml-1 text-gray-400">{sortDesc ? "↓" : "↑"}</span>
      )}
    </th>
  );
}

/* ────────────────── Shadow equity curve ────────────────── */

function ShadowEquityCurve({
  history,
}: {
  history: ReturnType<typeof useSizingShadowHistory>["data"];
}) {
  if (!history) return null;

  if (!history.available || (history.points?.length ?? 0) < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cumulative shadow P&L (shorts only)</CardTitle>
        </CardHeader>
        <div className="text-xs text-gray-500">
          {history.reason ??
            "Not enough snapshots yet — the curve needs ≥2 rebalances. Check back after the next rotation."}
        </div>
      </Card>
    );
  }

  const chartData = history.points.map((p) => ({
    ts: p.ts,
    live: p.cum_pnl_live_usd,
    shadow: p.cum_pnl_shadow_usd,
    delta: p.cum_pnl_shadow_usd - p.cum_pnl_live_usd,
    label: new Date(p.ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  const cumLive = history.cumulative_live_usd ?? 0;
  const cumShadow = history.cumulative_shadow_usd ?? 0;
  const cumDelta = history.cumulative_delta_usd ?? cumShadow - cumLive;
  const deltaColor =
    cumDelta > 0 ? "text-green-400" : cumDelta < 0 ? "text-red-400" : "text-gray-300";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Cumulative shadow P&L (shorts only)</CardTitle>
          <div className="text-xs text-gray-400">
            Live: <span className="text-gray-200 font-mono">${cumLive.toFixed(0)}</span>{" "}
            · Shadow:{" "}
            <span className="text-gray-200 font-mono">${cumShadow.toFixed(0)}</span>{" "}
            · Δ:{" "}
            <span className={`font-mono ${deltaColor}`}>
              {cumDelta >= 0 ? "+" : ""}${cumDelta.toFixed(0)}
            </span>
          </div>
        </div>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#888" }}
              stroke="#333"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#888" }}
              stroke="#333"
              tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
            />
            <Tooltip
              contentStyle={{
                background: "#111",
                border: "1px solid #333",
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : Number(value ?? 0);
                const sign = v >= 0 ? "+" : "";
                return [`${sign}$${v.toFixed(0)}`, String(name)];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="line"
            />
            <ReferenceLine y={0} stroke="#444" strokeDasharray="2 4" />
            <Line
              type="monotone"
              dataKey="live"
              name="Live"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="shadow"
              name="Shadow (Option 2)"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="delta"
              name="Δ (shadow − live)"
              stroke="#fbbf24"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-[11px] text-gray-500">
        {history.note ??
          "Shorts-only. Applies each snapshot's notionals to the realized price move until the next snapshot."}{" "}
        Positive delta = Option 2 would have outperformed.
      </div>
    </Card>
  );
}
