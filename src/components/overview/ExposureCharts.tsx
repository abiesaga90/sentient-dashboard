import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartContainer } from "../shared/ChartContainer";
import type { RiskHistoryPoint } from "../../types/api";

interface ExposureChartsProps {
  history: RiskHistoryPoint[];
}

export function ExposureCharts({ history }: ExposureChartsProps) {
  const data = history.map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    gross: h.gross_pct,
    net: h.net_pct,
  }));

  return (
    <ChartContainer title="Exposure History" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="time"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#1e1e2e" }}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v.toFixed(0)}%`}
        />
        <Tooltip
          contentStyle={{
            background: "#111118",
            border: "1px solid #1e1e2e",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          formatter={(v, name) => [
            `${Number(v).toFixed(1)}%`,
            String(name),
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
        />
        <Line
          type="monotone"
          dataKey="gross"
          name="Gross"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke="#f97316"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
