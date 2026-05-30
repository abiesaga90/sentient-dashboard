import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { ChartContainer } from "../../shared/ChartContainer";
import { useMacroHorizons } from "../../../hooks/useMacroRegime";

/**
 * Three horizon-specific composites (7d / 30d / 90d) plus the combined
 * shadow tilt (long-heavy mix 0.20 / 0.30 / 0.50 by default).
 *
 * SHADOW MODE — the live ``target_beta_tilt_pct`` continues to follow the
 * existing single-horizon composite. This view is the audit trail used to
 * decide when (and whether) to flip ``REGIME_MULTI_HORIZON_TILT_SOURCE`` to
 * ``"multi"``.
 */
export function HorizonCompositesSubTab() {
  const { data, isLoading } = useMacroHorizons(90);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Loading horizon composites...
      </div>
    );
  }
  if (!data) return null;

  const preview = data.preview;
  const combined = preview?.combined;
  const mixWeights = data.horizon_weights;

  // Build the chart data by pivoting timeseries on horizon_days so each row
  // has score_7 / score_30 / score_90 columns.
  const byTs: Record<string, { date: string; ts: string; score_7?: number; score_30?: number; score_90?: number }> = {};
  for (const row of data.timeseries || []) {
    const ts = row.timestamp;
    if (!byTs[ts]) {
      byTs[ts] = { date: ts.slice(5, 10), ts };
    }
    const key = `score_${row.horizon_days}` as "score_7" | "score_30" | "score_90";
    byTs[ts][key] = row.composite_score ?? undefined;
  }
  const chartData = Object.values(byTs).sort((a, b) => a.ts.localeCompare(b.ts));

  return (
    <div className="space-y-4">
      {/* Live preview cards — one per horizon + combined */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[7, 30, 90].map((h) => {
          const block = preview?.horizons?.[String(h)];
          const score = block?.composite_score;
          const regime = block?.regime;
          const conf = block?.confidence;
          const color =
            score == null
              ? "#6b7280"
              : score >= 70
              ? "#22c55e"
              : score >= 50
              ? "#3b82f6"
              : score >= 30
              ? "#eab308"
              : "#ef4444";
          return (
            <Card key={h}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{h}d Composite</CardTitle>
                  <Badge variant={conf === "high" ? "default" : "warning"}>
                    {conf || "—"}
                  </Badge>
                </div>
              </CardHeader>
              <div className="px-4 pb-4">
                <div className="text-3xl font-bold" style={{ color }}>
                  {score != null ? score.toFixed(1) : "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">
                  {regime || "—"} · weight {mixWeights[String(h)] ?? "—"}
                </div>
              </div>
            </Card>
          );
        })}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Combined (shadow)</CardTitle>
              <Badge variant={combined?.confidence === "high" ? "default" : "warning"}>
                {combined?.confidence || "—"}
              </Badge>
            </div>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="text-3xl font-bold text-purple-300">
              {combined?.combined_score != null
                ? combined.combined_score.toFixed(1)
                : "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">
              tilt {combined?.combined_tilt_pct != null
                ? `${combined.combined_tilt_pct >= 0 ? "+" : ""}${combined.combined_tilt_pct.toFixed(2)}%`
                : "—"}
              {" · live source: "}
              {data.tilt_source === "multi" ? "multi" : "single (shadow)"}
            </div>
          </div>
        </Card>
      </div>

      {/* Horizon-composite timeseries */}
      {chartData.length > 0 && (
        <ChartContainer title="Per-horizon composite (last 90d)" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={55} stroke="#22c55e" strokeDasharray="3 3" />
            <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="score_7"
              name="7d"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="score_30"
              name="30d"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="score_90"
              name="90d"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      )}

      {/* Horizon contribution table */}
      <Card>
        <CardHeader>
          <CardTitle>Combined tilt breakdown</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Horizon</th>
                <th className="px-3 py-2 text-right text-gray-500">Weight in mix</th>
                <th className="px-3 py-2 text-right text-gray-500">Composite</th>
                <th className="px-3 py-2 text-right text-gray-500">Regime</th>
                <th className="px-3 py-2 text-right text-gray-500">Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {[7, 30, 90].map((h) => {
                const cb = combined?.horizon_contributions?.[String(h)];
                const score = cb?.score;
                const w = cb?.weight ?? mixWeights[String(h)] ?? 0;
                const contrib = score != null ? score * (w as number) : null;
                return (
                  <tr key={h}>
                    <td className="px-3 py-2 text-gray-200">{h}d</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-300">
                      {(w as number)?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-300">
                      {score?.toFixed(1) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {cb?.regime ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-200">
                      {contrib != null ? contrib.toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
