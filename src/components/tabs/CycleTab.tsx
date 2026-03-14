import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { ChartContainer } from "../shared/ChartContainer";
import { formatPct } from "../../lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface CycleChartPoint {
  date: string;
  mvrv: number | null;
  wma_200_ratio: number | null;
}

interface CycleResponse {
  mvrv: number | null;
  wma_200_ratio: number | null;
  mayer_multiple: number | null;
  btc_drawdown_pct: number | null;
  bear_market_overlay: boolean;
  cycle_phase: string;
  chart: CycleChartPoint[];
  error?: string;
}

const phaseBadgeVariant = (phase: string): "success" | "danger" | "warning" | "info" | "default" => {
  switch (phase.toLowerCase()) {
    case "accumulation":
      return "info";
    case "markup":
    case "bull":
      return "success";
    case "distribution":
      return "warning";
    case "markdown":
    case "bear":
      return "danger";
    default:
      return "default";
  }
};

export function CycleTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<CycleResponse>({
    queryKey: ["cycle", engine.id],
    queryFn: () => client.get("/api/cycle"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading cycle data...
      </div>
    );
  }

  if (!data) return null;

  // Handle pending state
  if (data.error === "pending") {
    return (
      <div className="p-4">
        <Card className="flex flex-col items-center justify-center h-64">
          <div className="text-lg font-medium text-yellow-400">Cycle Data Pending</div>
          <div className="text-sm text-gray-500 mt-2">
            On-chain metrics are still being fetched. Check back shortly.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* ── Phase Badge ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cycle Awareness</CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant={phaseBadgeVariant(data.cycle_phase)} className="text-sm px-3 py-1">
                {data.cycle_phase}
              </Badge>
              {data.bear_market_overlay && (
                <Badge variant="danger" className="text-sm px-3 py-1">
                  Bear Overlay Active
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="MVRV Z-Score"
          value={data.mvrv != null ? data.mvrv.toFixed(2) : "—"}
          valueColor={
            data.mvrv != null
              ? data.mvrv > 3
                ? "text-red-400"
                : data.mvrv < 1
                  ? "text-green-400"
                  : "text-gray-100"
              : "text-gray-500"
          }
        />
        <KpiCard
          label="200 WMA Ratio"
          value={data.wma_200_ratio != null ? data.wma_200_ratio.toFixed(3) : "—"}
          valueColor={
            data.wma_200_ratio != null
              ? data.wma_200_ratio < 1
                ? "text-green-400"
                : data.wma_200_ratio > 3
                  ? "text-red-400"
                  : "text-gray-100"
              : "text-gray-500"
          }
        />
        <KpiCard
          label="Mayer Multiple"
          value={data.mayer_multiple != null ? data.mayer_multiple.toFixed(3) : "—"}
          valueColor={
            data.mayer_multiple != null
              ? data.mayer_multiple < 0.8
                ? "text-green-400"
                : data.mayer_multiple > 2.4
                  ? "text-red-400"
                  : "text-gray-100"
              : "text-gray-500"
          }
        />
        <KpiCard
          label="BTC Drawdown"
          value={data.btc_drawdown_pct != null ? formatPct(data.btc_drawdown_pct) : "—"}
          valueColor={
            data.btc_drawdown_pct != null
              ? data.btc_drawdown_pct < -30
                ? "text-red-400"
                : data.btc_drawdown_pct < -10
                  ? "text-yellow-400"
                  : "text-green-400"
              : "text-gray-500"
          }
        />
      </div>

      {/* ── Bear Market Overlay ── */}
      <Card>
        <CardHeader>
          <CardTitle>Bear Market Overlay</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4 flex items-center gap-3">
          <div
            className={`w-4 h-4 rounded-full ${
              data.bear_market_overlay ? "bg-red-500 animate-pulse" : "bg-green-500"
            }`}
          />
          <span className={`text-sm font-medium ${data.bear_market_overlay ? "text-red-400" : "text-green-400"}`}>
            {data.bear_market_overlay
              ? "Bear overlay is ACTIVE — position sizing reduced"
              : "No bear overlay — normal position sizing"}
          </span>
        </div>
      </Card>

      {/* ── Historical Chart ── */}
      {data.chart && data.chart.length > 0 && (
        <ChartContainer title="Cycle Indicators (Historical)" height={300}>
          <LineChart data={data.chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              yAxisId="mvrv"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              orientation="left"
            />
            <YAxis
              yAxisId="wma"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              orientation="right"
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
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            <Line
              yAxisId="mvrv"
              type="monotone"
              dataKey="mvrv"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="MVRV"
            />
            <Line
              yAxisId="wma"
              type="monotone"
              dataKey="wma_200_ratio"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="200 WMA Ratio"
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
