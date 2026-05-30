import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { useMacroWeightHistory } from "../../../hooks/useMacroRegime";
import type { MacroWeightHistoryRow } from "../../../types/api";

/**
 * Audit pane for the IC-calibrated weight engine (Phase 2).
 *
 * Shows the latest effective weight per (indicator, horizon, dependent)
 * tuple plus the most recent 30 days of weight changes. Sign flips and
 * soft-pauses are flagged with badges.
 */
export function WeightAuditSubTab() {
  const { data, isLoading } = useMacroWeightHistory(30);
  const [horizon, setHorizon] = useState<7 | 30 | 90>(30);

  const latest = data?.latest_nav_sortino?.[String(horizon)] ?? [];
  const history = data?.history ?? [];

  const recentDeltas = useMemo(() => {
    if (!history.length) return [];
    // Compute per-(indicator, horizon, dependent) delta between current and prior.
    const byTuple: Record<string, MacroWeightHistoryRow[]> = {};
    for (const row of history) {
      const k = `${row.indicator_key}|${row.horizon_days}|${row.dependent}`;
      (byTuple[k] = byTuple[k] || []).push(row);
    }
    const deltas: Array<{
      indicator: string;
      horizon: number;
      dependent: string;
      prev: number;
      curr: number;
      pctChange: number;
      kind: "sign_flip" | "pause" | "unpause" | "shift" | "stable";
      latestRow: MacroWeightHistoryRow;
    }> = [];
    for (const rows of Object.values(byTuple)) {
      if (rows.length < 2) continue;
      const sorted = rows.sort((a, b) => a.computed_at.localeCompare(b.computed_at));
      const curr = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      const prevW = prev.effective_weight ?? 0;
      const currW = curr.effective_weight ?? 0;
      let kind: typeof deltas[number]["kind"] = "stable";
      if (Boolean(prev.sign_flipped) !== Boolean(curr.sign_flipped)) kind = "sign_flip";
      else if (Boolean(prev.soft_paused) !== Boolean(curr.soft_paused))
        kind = curr.soft_paused ? "pause" : "unpause";
      else if (Math.abs(currW - prevW) / Math.max(Math.abs(prevW), 1e-6) > 0.30) kind = "shift";
      const pct = (currW - prevW) / Math.max(Math.abs(prevW), 1e-6) * 100;
      if (kind !== "stable") {
        deltas.push({
          indicator: curr.indicator_key,
          horizon: curr.horizon_days,
          dependent: curr.dependent,
          prev: prevW,
          curr: currW,
          pctChange: pct,
          kind,
          latestRow: curr,
        });
      }
    }
    return deltas.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  }, [history]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Loading weight history...
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Recent changes pane */}
      <Card>
        <CardHeader>
          <CardTitle>
            Recent weight changes (last 30d, all horizons)
            <span className="ml-3 text-xs font-normal text-gray-500">
              {recentDeltas.length} change(s)
            </span>
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Indicator</th>
                <th className="px-3 py-2 text-right text-gray-500">Horizon</th>
                <th className="px-3 py-2 text-right text-gray-500">Dep.</th>
                <th className="px-3 py-2 text-right text-gray-500">Prev → Curr</th>
                <th className="px-3 py-2 text-right text-gray-500">Δ %</th>
                <th className="px-3 py-2 text-right text-gray-500">IC</th>
                <th className="px-3 py-2 text-center text-gray-500">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {recentDeltas.slice(0, 30).map((d, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-gray-200">{d.indicator}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{d.horizon}d</td>
                  <td className="px-3 py-2 text-right text-gray-500">{d.dependent}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">
                    {d.prev.toFixed(2)} → {d.curr.toFixed(2)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${
                    d.pctChange >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {d.pctChange >= 0 ? "+" : ""}{d.pctChange.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">
                    {d.latestRow.ic_value != null
                      ? `${d.latestRow.ic_value >= 0 ? "+" : ""}${d.latestRow.ic_value.toFixed(3)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={
                      d.kind === "sign_flip" ? "warning"
                      : d.kind === "pause" ? "warning"
                      : d.kind === "unpause" ? "info"
                      : "default"
                    }>
                      {d.kind}
                    </Badge>
                  </td>
                </tr>
              ))}
              {recentDeltas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    No significant weight changes in the last 30d. Calibrator has
                    not yet run, or all weights are stable inside the ±30% band.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Latest effective weights per horizon */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current effective weights (NAV-Sortino)</CardTitle>
            <div className="flex gap-1 text-xs">
              {[7, 30, 90].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h as 7 | 30 | 90)}
                  className={`px-2 py-1 rounded border ${
                    horizon === h
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "border-[var(--border)] text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {h}d
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Indicator</th>
                <th className="px-3 py-2 text-right text-gray-500">Prior</th>
                <th className="px-3 py-2 text-right text-gray-500">IC</th>
                <th className="px-3 py-2 text-right text-gray-500">n</th>
                <th className="px-3 py-2 text-right text-gray-500">Effective</th>
                <th className="px-3 py-2 text-center text-gray-500">Status</th>
                <th className="px-3 py-2 text-left text-gray-500">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {latest
                .slice()
                .sort((a, b) => Math.abs(b.effective_weight ?? 0) - Math.abs(a.effective_weight ?? 0))
                .map((row) => (
                  <tr key={row.indicator_key}>
                    <td className="px-3 py-2 text-gray-200">{row.indicator_key}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">
                      {row.prior_weight?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-300">
                      {row.ic_value != null
                        ? `${row.ic_value >= 0 ? "+" : ""}${row.ic_value.toFixed(3)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{row.ic_n_obs ?? 0}</td>
                    <td className={`px-3 py-2 text-right font-mono ${
                      (row.effective_weight ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {row.effective_weight?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.soft_paused ? (
                        <Badge variant="warning">paused</Badge>
                      ) : row.sign_flipped ? (
                        <Badge variant="warning">flipped</Badge>
                      ) : (
                        <Badge variant="default">active</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{row.audit_note ?? "—"}</td>
                  </tr>
                ))}
              {latest.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    Calibrator has not run yet for horizon {horizon}d. Wait for the
                    next daily IC compute (00:00 UTC) and refresh.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
