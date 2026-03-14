import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ChartContainer } from "../shared/ChartContainer";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  CartesianGrid,
} from "recharts";

interface MacroIndicator {
  name: string;
  value: number | null;
  threshold: number;
  direction: string;
  available: boolean;
}

interface ChartPoint {
  date: string;
  composite_score: number;
  regime: string;
}

interface RegimeThresholds {
  risk_on: number;
  neutral: number;
  risk_off: number;
}

interface MacroRegimeResponse {
  composite_score: number;
  regime: string;
  regime_label: string;
  regime_color: string;
  indicators: MacroIndicator[];
  chart: ChartPoint[];
  regime_thresholds: RegimeThresholds;
  sources_available: number;
  sources_total: number;
  error?: string;
}

const directionArrow = (dir: string) => {
  if (dir === "bullish" || dir === "up") return "text-green-400";
  if (dir === "bearish" || dir === "down") return "text-red-400";
  return "text-gray-400";
};

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

  // Handle pending state
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

  return (
    <div className="space-y-4 p-4">
      {/* ── Composite Score + Regime Badge ── */}
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
            <div
              className="text-4xl font-bold"
              style={{ color: regimeColor }}
            >
              {data.composite_score.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <div>Risk-On threshold: {data.regime_thresholds.risk_on}</div>
              <div>Neutral threshold: {data.regime_thresholds.neutral}</div>
              <div>Risk-Off threshold: {data.regime_thresholds.risk_off}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Indicator Table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Indicators ({data.indicators.length})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Indicator</th>
                <th className="px-3 py-2 text-right text-gray-500">Value</th>
                <th className="px-3 py-2 text-right text-gray-500">Threshold</th>
                <th className="px-3 py-2 text-center text-gray-500">Direction</th>
                <th className="px-3 py-2 text-center text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.indicators.map((ind) => (
                <tr key={ind.name} className="hover:bg-[var(--bg-card-hover)]">
                  <td className="px-3 py-2 text-gray-200">{ind.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">
                    {ind.value != null ? ind.value.toFixed(3) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">
                    {ind.threshold.toFixed(3)}
                  </td>
                  <td className={`px-3 py-2 text-center font-medium ${directionArrow(ind.direction)}`}>
                    {ind.direction}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {ind.available ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-gray-600" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 30-Day Regime Chart ── */}
      {data.chart && data.chart.length > 0 && (
        <ChartContainer title="Composite Score (30d)" height={300}>
          <LineChart data={data.chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 10 }}
              domain={[-1, 1]}
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
            {/* Regime bands */}
            <ReferenceArea
              y1={data.regime_thresholds.risk_on}
              y2={1}
              fill="#22c55e"
              fillOpacity={0.05}
            />
            <ReferenceArea
              y1={data.regime_thresholds.risk_off}
              y2={data.regime_thresholds.risk_on}
              fill="#eab308"
              fillOpacity={0.05}
            />
            <ReferenceArea
              y1={-1}
              y2={data.regime_thresholds.risk_off}
              fill="#ef4444"
              fillOpacity={0.05}
            />
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
