import { useMemo, useState } from "react";
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

const PERIODS = ["1W", "1M", "MTD", "QTD", "YTD", "ALL"] as const;
type Period = (typeof PERIODS)[number];

function periodCutoff(period: Period, now: Date): Date | null {
  if (period === "ALL") return null;
  if (period === "1W") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 7);
    return d;
  }
  if (period === "1M") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 30);
    return d;
  }
  if (period === "MTD") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  if (period === "QTD") {
    const qStart = Math.floor(now.getUTCMonth() / 3) * 3;
    return new Date(Date.UTC(now.getUTCFullYear(), qStart, 1));
  }
  if (period === "YTD") {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  return null;
}

export function EquityCurve({ data, startingCapital }: EquityCurveProps) {
  const [period, setPeriod] = useState<Period>("ALL");

  const chartData = useMemo(() => {
    const cutoff = periodCutoff(period, new Date());
    const filtered = cutoff
      ? data.filter((d) => {
          // d.date is "YYYY-MM-DD"; parse as UTC midnight for stable compare
          const ts = Date.parse(`${d.date}T00:00:00Z`);
          return Number.isFinite(ts) && ts >= cutoff.getTime();
        })
      : data;

    const points = filtered.map((d) => ({ date: d.date, nav: d.nav }));

    // For ALL view, prepend the starting-capital baseline so the curve
    // starts from inception. Period views start from the first in-range
    // observation — the starting capital marker would be misleading.
    if (period === "ALL" && points.length > 0 && points[0].nav !== startingCapital) {
      points.unshift({ date: "Start", nav: startingCapital });
    }

    return points;
  }, [data, period, startingCapital]);

  const action = (
    <div className="flex gap-1">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wider transition-colors ${
            period === p
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "text-gray-500 hover:text-gray-300 border border-transparent"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );

  return (
    <ChartContainer title="Equity Curve" height={280} action={action}>
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
