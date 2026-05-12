import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useEngine } from "../../hooks/useEngine";

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

interface BasketPnlResponse {
  series: BasketPnlPoint[];
  count: number;
  granularity?: string;
  hours?: number;
  days?: number;
}

interface Props {
  /** Optional fallback series (e.g. the daily query from the parent) */
  series?: BasketPnlPoint[];
  showSpread?: boolean;
}

const PERIODS = ["1D", "1W", "1M", "MTD", "QTD", "YTD", "ALL"] as const;
type Period = (typeof PERIODS)[number];

function periodFetch(period: Period): { granularity: "auto" | "daily"; hours: number } {
  const now = new Date();
  switch (period) {
    case "1D":
      return { granularity: "auto", hours: 24 };
    case "1W":
      return { granularity: "auto", hours: 24 * 7 };
    case "1M":
      return { granularity: "auto", hours: 24 * 30 };
    case "MTD": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const h = Math.max(24, Math.ceil((now.getTime() - start.getTime()) / 3_600_000));
      return { granularity: "auto", hours: h };
    }
    case "QTD": {
      const qStart = Math.floor(now.getUTCMonth() / 3) * 3;
      const start = new Date(Date.UTC(now.getUTCFullYear(), qStart, 1));
      const h = Math.max(24, Math.ceil((now.getTime() - start.getTime()) / 3_600_000));
      return { granularity: "auto", hours: h };
    }
    case "YTD": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const h = Math.max(24, Math.ceil((now.getTime() - start.getTime()) / 3_600_000));
      return { granularity: "auto", hours: h };
    }
    case "ALL":
      return { granularity: "daily", hours: 24 * 365 };
  }
}

function parsePointTime(s: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00Z`);
  return Date.parse(s);
}

function formatTick(s: string, gran: string): string {
  const t = parsePointTime(s);
  if (!Number.isFinite(t)) return s;
  const d = new Date(t);
  if (gran === "daily") {
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  if (gran === "4h" || gran === "12h" || gran === "hourly") {
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  // tick / 15m / 30m — HH:MM
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function BasketPnlChart({ series: propSeries, showSpread = true }: Props) {
  const [period, setPeriod] = useState<Period>("1M");
  const { client, engine } = useEngine();
  const fetchSpec = periodFetch(period);

  const { data: response } = useQuery<BasketPnlResponse>({
    queryKey: ["basket-pnl-history", engine.id, fetchSpec.granularity, fetchSpec.hours],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("granularity", fetchSpec.granularity);
      params.set("hours", String(fetchSpec.hours));
      if (fetchSpec.granularity === "daily") params.set("days", String(Math.ceil(fetchSpec.hours / 24)));
      return client.get(`/api/basket-pnl/history?${params.toString()}`);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const granularity = response?.granularity ?? fetchSpec.granularity;
  const sourceSeries: BasketPnlPoint[] = response?.series ?? propSeries ?? [];

  const data = useMemo(() => {
    return sourceSeries.map((p) => ({
      date: p.date,
      label: formatTick(p.date, granularity),
      long: p.long_unrealized,
      short: p.short_unrealized,
      spread: p.spread_unrealized,
    }));
  }, [sourceSeries, granularity]);

  const action = (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-500">
        {granularity === "daily" ? "EOD" : granularity === "tick" ? "60s" : granularity} · {sourceSeries.length} pts
      </span>
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
    </div>
  );

  return (
    <ChartContainer
      title="Unrealized P&L by Side (history)"
      height={280}
      action={action}
    >
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#1e1e2e" }}
          minTickGap={32}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`
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
            const fd = (payload?.[0]?.payload as { date?: string } | undefined)?.date;
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
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="short"
          name="Shorts (unrealized)"
          stroke="#ef4444"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
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
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
