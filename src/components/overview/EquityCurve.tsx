import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useEngine } from "../../hooks/useEngine";
import type { EquityPoint } from "../../types/api";

interface EquityCurveProps {
  data: EquityPoint[];
  startingCapital: number;
}

const PERIODS = ["1W", "1M", "MTD", "QTD", "YTD", "ALL"] as const;
type Period = (typeof PERIODS)[number];

interface EquityResponse {
  equity: EquityPoint[];
  count: number;
  granularity?: string;
  live_nav?: number | null;
  now?: string;
}

// Granularity + lookback per period. Short windows get tick-level (60s)
// from risk_history; longer windows down-sample to keep payloads small;
// the legacy daily snapshots cover the longest views.
function periodFetch(
  period: Period,
): { granularity: "tick" | "hourly" | "daily"; hours?: number } | null {
  switch (period) {
    case "1W":
      return { granularity: "tick", hours: 24 * 7 };
    case "1M":
      return { granularity: "hourly", hours: 24 * 30 };
    case "MTD":
    case "QTD":
    case "YTD":
    case "ALL":
      return { granularity: "daily" };
    default:
      return null;
  }
}

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

function parsePointTime(s: string): number {
  // Accept both "YYYY-MM-DD" (daily snapshots) and ISO timestamps.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00Z`);
  return Date.parse(s);
}

function formatTick(s: string, granularity: string): string {
  const t = parsePointTime(s);
  if (!Number.isFinite(t)) return s;
  const d = new Date(t);
  if (granularity === "daily") {
    // MM-DD
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  if (granularity === "hourly") {
    // MM-DD HH:00
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  // tick — HH:MM (assume same day for 1W view) — or date if older
  const now = Date.now();
  const ageHours = (now - t) / 3_600_000;
  if (ageHours < 24) {
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function EquityCurve({ data, startingCapital }: EquityCurveProps) {
  const [period, setPeriod] = useState<Period>("ALL");
  const { client, engine } = useEngine();

  const fetchSpec = periodFetch(period);

  // For ALL / MTD / QTD / YTD we use the prop data (daily snapshots from the
  // dashboard-wide query). For 1W and 1M we fetch granular series directly and
  // poll every 30s so the chart tracks NAV in near real time.
  const granularQuery = useQuery<EquityResponse>({
    queryKey: ["equity", engine.id, fetchSpec?.granularity, fetchSpec?.hours],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fetchSpec) {
        params.set("granularity", fetchSpec.granularity);
        if (fetchSpec.hours) params.set("hours", String(fetchSpec.hours));
      }
      return client.get(`/api/equity?${params.toString()}`);
    },
    enabled: !!fetchSpec && fetchSpec.granularity !== "daily",
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const granularity: "tick" | "hourly" | "daily" =
    (granularQuery.data?.granularity as "tick" | "hourly" | "daily") ||
    fetchSpec?.granularity ||
    "daily";

  const chartData = useMemo(() => {
    const cutoff = periodCutoff(period, new Date());
    const series: EquityPoint[] =
      granularQuery.data?.equity ?? data ?? [];

    const filtered = cutoff
      ? series.filter((d) => {
          const ts = parsePointTime(d.date);
          return Number.isFinite(ts) && ts >= cutoff.getTime();
        })
      : series;

    const points = filtered.map((d) => ({ date: d.date, nav: d.nav }));

    if (period === "ALL" && points.length > 0 && points[0].nav !== startingCapital) {
      points.unshift({ date: "Start", nav: startingCapital });
    }

    return points;
  }, [data, granularQuery.data, period, startingCapital]);

  const liveNav = granularQuery.data?.live_nav;

  const action = (
    <div className="flex items-center gap-3">
      {liveNav != null && (
        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          live {formatUSD(liveNav)}
        </span>
      )}
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
          tickFormatter={(d: string) =>
            d === "Start" ? "Start" : formatTick(d, granularity)
          }
          minTickGap={32}
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
          labelFormatter={(d: unknown) => {
            const s = typeof d === "string" ? d : String(d ?? "");
            return s === "Start" ? "Inception" : formatTick(s, granularity);
          }}
          formatter={(value) => [formatUSD(Number(value)), "NAV"]}
        />
        <Area
          type="monotone"
          dataKey="nav"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#navGradient)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
