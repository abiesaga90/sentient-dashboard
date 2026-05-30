import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { useEngine } from "../../../hooks/useEngine";

/**
 * Indicator × dependent × horizon IC heatmap.
 *
 * Reuses the existing /api/macro-ic payload — which already returns
 * ``horizons[]`` and ``dependents[]`` arrays. The current Overview tab
 * displays a single IC column (primary_dependent_primary_horizon); this
 * view pivots the same data so an indicator that is strong for
 * BTC-return-7d but weak for NAV-Sortino-90d is immediately visible.
 */
interface MacroICEntry {
  ic_value: number | null;
  hit_rate: number | null;
  n_observations: number | null;
  lookback_days: number | null;
  classification: string;
}

interface MacroICIndicator {
  key: string;
  label: string;
  category: string;
  weight: number;
  type: string;
  ic: Record<string, MacroICEntry>;
}

interface MacroICResponse {
  indicators: MacroICIndicator[];
  last_computed: string | null;
  horizons: number[];
  dependents: string[];
  primary_dependent: string;
  primary_horizon: number;
}

function icToColor(ic: number | null): string {
  if (ic == null) return "#374151";
  const mag = Math.min(1, Math.abs(ic) / 0.3);
  const alpha = 0.2 + 0.6 * mag;
  return ic >= 0
    ? `rgba(34, 197, 94, ${alpha})`
    : `rgba(239, 68, 68, ${alpha})`;
}

export function ICHeatmapSubTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<MacroICResponse>({
    queryKey: ["macro-ic", engine.id],
    queryFn: () => client.get("/api/macro-ic"),
    refetchInterval: 300_000,
    staleTime: 180_000,
  });

  const [dependent, setDependent] = useState<string>("nav_sortino");
  const [classFilter, setClassFilter] = useState<"all" | "strong" | "moderate">("all");

  const horizons = data?.horizons ?? [7, 30, 90];
  const dependents = data?.dependents ?? ["nav_sortino"];

  const rows = useMemo(() => {
    if (!data) return [];
    return data.indicators
      .filter((ind) => {
        if (classFilter === "all") return true;
        return horizons.some((h) => {
          const cell = ind.ic[`${dependent}_${h}d`];
          if (!cell) return false;
          if (classFilter === "strong") return cell.classification === "strong";
          return cell.classification === "strong" || cell.classification === "moderate";
        });
      })
      .sort((a, b) => {
        const aPrimary = a.ic[`${dependent}_${data.primary_horizon}d`]?.ic_value ?? 0;
        const bPrimary = b.ic[`${dependent}_${data.primary_horizon}d`]?.ic_value ?? 0;
        return Math.abs(bPrimary) - Math.abs(aPrimary);
      });
  }, [data, dependent, classFilter, horizons]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Loading IC heatmap...
      </div>
    );
  }
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>IC Heatmap</CardTitle>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="text-gray-500">
              Dependent:{" "}
              <select
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1"
                value={dependent}
                onChange={(e) => setDependent(e.target.value)}
              >
                {dependents.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="text-gray-500">
              Filter:{" "}
              <select
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value as typeof classFilter)}
              >
                <option value="all">All indicators</option>
                <option value="moderate">Moderate+ only</option>
                <option value="strong">Strong only</option>
              </select>
            </label>
            <span className="text-gray-600">
              {data.last_computed
                ? `computed ${new Date(data.last_computed).toLocaleString()}`
                : "—"}
            </span>
          </div>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500">Indicator</th>
              <th className="px-3 py-2 text-left text-gray-500">Category</th>
              <th className="px-3 py-2 text-right text-gray-500">Weight</th>
              {horizons.map((h) => (
                <th key={h} className="px-3 py-2 text-center text-gray-500">
                  IC @ {h}d
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((ind) => (
              <tr key={ind.key}>
                <td className="px-3 py-2 text-gray-200">{ind.label}</td>
                <td className="px-3 py-2 text-gray-500">{ind.category}</td>
                <td className="px-3 py-2 text-right text-gray-500">{ind.weight}</td>
                {horizons.map((h) => {
                  const cell = ind.ic[`${dependent}_${h}d`];
                  const ic = cell?.ic_value ?? null;
                  const n = cell?.n_observations ?? 0;
                  const cls = cell?.classification ?? "insufficient_data";
                  const bg = icToColor(ic);
                  return (
                    <td
                      key={h}
                      className="px-3 py-2 text-center font-mono text-gray-100"
                      style={{ backgroundColor: bg }}
                      title={`classification=${cls}, n=${n}, hit_rate=${cell?.hit_rate?.toFixed(2) ?? "—"}`}
                    >
                      {ic != null
                        ? `${ic >= 0 ? "+" : ""}${ic.toFixed(3)}`
                        : <span className="text-gray-500">—</span>}
                      <div className="text-[9px] text-gray-300/70">n={n}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3 + horizons.length} className="px-3 py-8 text-center text-gray-500">
                  No indicators match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-[10px] text-gray-500 border-t border-[var(--border)]">
        Cell color encodes IC magnitude (green positive, red negative). Click an
        indicator label in the Overview tab to drill down into rolling IC.
      </div>
    </Card>
  );
}
