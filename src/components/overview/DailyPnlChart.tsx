import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { ChartContainer } from "../shared/ChartContainer";
import { formatUSD } from "../../lib/utils";
import type { DailyPnl } from "../../types/api";

interface DailyPnlChartProps {
  daily: DailyPnl[];
}

export function DailyPnlChart({ daily }: DailyPnlChartProps) {
  // Show last 30 days
  const data = daily.slice(-30);

  return (
    <ChartContainer title="Daily P&L" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#1e1e2e" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatUSD(v, 0)}
        />
        <Tooltip
          contentStyle={{
            background: "#111118",
            border: "1px solid #1e1e2e",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          formatter={(v) => [formatUSD(Number(v)), "P&L"]}
        />
        <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.pnl >= 0 ? "#22c55e" : "#ef4444"}
              fillOpacity={0.7}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
