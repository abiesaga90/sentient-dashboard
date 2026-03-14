import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartContainer } from "../shared/ChartContainer";
import { formatUSD } from "../../lib/utils";
import type { EquityPoint } from "../../types/api";

interface EquityCurveProps {
  data: EquityPoint[];
  startingCapital: number;
}

export function EquityCurve({ data, startingCapital }: EquityCurveProps) {
  const chartData = data.map((d) => ({
    date: d.date,
    nav: d.nav,
  }));

  // Add starting capital as first point if not present
  if (chartData.length > 0 && chartData[0].nav !== startingCapital) {
    chartData.unshift({ date: "Start", nav: startingCapital });
  }

  return (
    <ChartContainer title="Equity Curve" height={280}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#1e1e2e" }}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatUSD(v, 0)}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "#111118",
            border: "1px solid #1e1e2e",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "#94a3b8" }}
          formatter={(value) => [formatUSD(Number(value)), "NAV"]}
        />
        <Area
          type="monotone"
          dataKey="nav"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#navGradient)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
