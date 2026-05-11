import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { ChartContainer } from "../shared/ChartContainer";

export interface BasketPnlPoint {
  date: string;
  long_unrealized: number;
  short_unrealized: number;
  spread_unrealized: number;
  gross_long?: number;
  gross_short?: number;
  n_longs?: number;
  n_shorts?: number;
  long_realized_day?: number;
  short_realized_day?: number;
}

interface Props {
  series: BasketPnlPoint[];
  showSpread?: boolean;
}

export function BasketPnlChart({ series, showSpread = true }: Props) {
  const data = series.map((p) => ({
    date: p.date.slice(5), // MM-DD
    fullDate: p.date,
    long: p.long_unrealized,
    short: p.short_unrealized,
    spread: p.spread_unrealized,
  }));

  return (
    <ChartContainer
      title="Unrealized P&L by Side (history)"
      height={280}
    >
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#1e1e2e" }}
          minTickGap={28}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            Math.abs(v) >= 1000
              ? `${(v / 1000).toFixed(1)}k`
              : `${v.toFixed(0)}`
          }
        />
        <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
        <Tooltip
          contentStyle={{
            background: "#111118",
            border: "1px solid #1e1e2e",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          labelFormatter={(_, payload) => {
            const fd = (payload?.[0]?.payload as { fullDate?: string } | undefined)?.fullDate;
            return fd ?? "";
          }}
          formatter={(v, name) => [
            `${Number(v) >= 0 ? "+" : ""}$${Number(v).toFixed(0)}`,
            String(name),
          ]}
        />
        <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
        <Line
          type="monotone"
          dataKey="long"
          name="Longs (unrealized)"
          stroke="#22c55e"
          strokeWidth={1.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="short"
          name="Shorts (unrealized)"
          stroke="#ef4444"
          strokeWidth={1.5}
          dot={false}
        />
        {showSpread && (
          <Line
            type="monotone"
            dataKey="spread"
            name="Spread (L + S)"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
