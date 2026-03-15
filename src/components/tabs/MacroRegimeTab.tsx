import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ChartContainer } from "../shared/ChartContainer";

interface Indicator {
  key: string;
  label: string;
  category: string;
  type: string;
  weight: number;
  description: string;
  score: number | null;
  raw_value: number | string | null;
}

interface ChartPoint {
  timestamp: string;
  composite_score: number;
  regime: string;
}

interface MacroRegimeResponse {
  composite_score: number;
  regime: string;
  regime_label: string;
  regime_color: string;
  indicators: Indicator[];
  chart: ChartPoint[];
  regime_thresholds: Record<string, [number, number]>;
  sources_available: number;
  sources_total: number;
  error?: string;
}

export function MacroRegimeTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<MacroRegimeResponse>({
    queryKey: ["macro-regime", engine.id],
    queryFn: () => client.get("/api/macro_regime"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading macro regime data...
      </div>
    );
  }

  if (!data) return null;

  if (data.error === "pending") {
    return (
      <div className="p-4">
        <Card className="flex flex-col items-center justify-center h-64">
          <div className="text-lg font-medium text-yellow-400">Macro Data Pending</div>
          <div className="text-sm text-gray-500 mt-2">
            Indicators are still being fetched. Check back shortly.
          </div>
        </Card>
      </div>
    );
  }

  const regimeColor = data.regime_color || "#6b7280";

  const chartData = (data.chart || []).map((p) => ({
    ...p,
    date: p.timestamp?.slice(5, 10) || "",
  }));

  return (
    <div className="space-y-4 p-4">
      {/* Composite Score + Regime Badge */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Macro Regime</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {data.sources_available}/{data.sources_total} sources
              </span>
              <Badge
                variant="default"
                className="text-sm px-3 py-1"
                style={{ backgroundColor: regimeColor + "22", color: regimeColor, borderColor: regimeColor + "44" }}
              >
                {data.regime_label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold" style={{ color: regimeColor }}>
              {data.composite_score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              {Object.entries(data.regime_thresholds || {}).map(([name, [lo, hi]]) => (
                <div key={name}>{name}: {lo}–{hi}</div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Indicator Table */}
      <Card>
        <CardHeader>
          <CardTitle>Indicators ({data.indicators?.length || 0})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Indicator</th>
                <th className="px-3 py-2 text-left text-gray-500">Category</th>
                <th className="px-3 py-2 text-right text-gray-500">Raw</th>
                <th className="px-3 py-2 text-right text-gray-500">Score</th>
                <th className="px-3 py-2 text-right text-gray-500">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {(data.indicators || []).map((ind) => (
                <tr key={ind.key} className="hover:bg-[var(--bg-card-hover)]">
                  <td className="px-3 py-2 text-gray-200">{ind.label}</td>
                  <td className="px-3 py-2 text-gray-500">{ind.category}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">
                    {ind.raw_value != null ? String(ind.raw_value) : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${
                    ind.score != null
                      ? ind.score >= 60 ? "text-green-400" : ind.score <= 40 ? "text-red-400" : "text-yellow-400"
                      : "text-gray-600"
                  }`}>
                    {ind.score != null ? ind.score.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">{ind.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Chart */}
      {chartData.length > 0 && (
        <ChartContainer title="Composite Score (30d)" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 10 }}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 10 }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <ReferenceLine y={55} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Bull", fill: "#22c55e", fontSize: 10 }} />
            <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Bear", fill: "#ef4444", fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="composite_score"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
