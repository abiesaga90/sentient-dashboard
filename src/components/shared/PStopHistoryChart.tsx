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
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { useEngine } from "../../hooks/useEngine";

interface PStopPoint {
  timestamp: string;
  p_stop_7d_pct: number | null;
  p_stop_30d_pct: number | null;
  p_stop_365d_pct: number | null;
  sigma_daily_pct: number | null;
  vol_budget_ratio: number | null;
  gross_pct: number | null;
  dd_pct: number | null;
}

interface PStopHistoryResponse {
  hours: number;
  count: number;
  series: PStopPoint[];
}

const PERIODS = ["1D", "1W", "1M", "ALL"] as const;
type Period = (typeof PERIODS)[number];

function periodHours(p: Period): number {
  switch (p) {
    case "1D":
      return 24;
    case "1W":
      return 168;
    case "1M":
      return 720;
    case "ALL":
      return 24 * 90;
  }
}

function formatLabel(ts: string, p: Period): string {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return ts;
  if (p === "1D") {
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (p === "1W") {
    return `${month}-${day} ${String(d.getUTCHours()).padStart(2, "0")}h`;
  }
  return `${month}-${day}`;
}

export function PStopHistoryChart() {
  const [period, setPeriod] = useState<Period>("1W");
  const { client, engine } = useEngine();
  const hours = periodHours(period);

  const { data, isLoading } = useQuery<PStopHistoryResponse>({
    queryKey: ["pstop-history", engine.id, hours],
    queryFn: () => client.get(`/api/risk-posture/history?hours=${hours}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const series = useMemo(() => {
    const raw = data?.series ?? [];
    return raw.map((p) => ({
      label: formatLabel(p.timestamp, period),
      p_stop_7d: p.p_stop_7d_pct,
      p_stop_30d: p.p_stop_30d_pct,
    }));
  }, [data, period]);

  const action = (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-500">
        {data?.count ?? 0} pts · refreshed 60s
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>P(stop) Trend</CardTitle>
          {action}
        </div>
      </CardHeader>

      <div className="px-4 pb-3 text-xs text-gray-400 leading-relaxed space-y-1.5">
        <p>
          <strong className="text-gray-300">What you&rsquo;re looking at.</strong>{" "}
          Monte-Carlo probability of hitting the DD stop within the next 7 or
          30 days, given current gross, realized spread vol, drift, and elastic
          gross trim. Computed from the same MC the vol budget targets at
          5%/yr.
        </p>
        <p>
          <strong className="text-gray-300">How to read it.</strong>{" "}
          <span className="text-emerald-400">Green band (&lt; 5%)</span>:
          comfortable.{" "}
          <span className="text-amber-400">Amber (5&ndash;15%)</span>: realized
          vol is tracking high or DD is close to the stop.{" "}
          <span className="text-rose-400">Red (≥ 15%)</span>: meaningful stop
          risk on the horizon &mdash; consider trim or de-risk.
        </p>
        <p className="text-[11px] text-gray-500">
          Persisted from <code>/api/risk-posture</code> polls (~1 row/min when
          a dashboard is open). Gaps are normal when no dashboard was running.
          Up to 90 days retained server-side.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500 p-4">Loading…</div>
      ) : series.length === 0 ? (
        <div className="text-sm text-gray-500 p-4">
          No history yet for this window. P(stop) values are recorded as the
          dashboard polls; check back after a few minutes.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
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
              tickFormatter={(v) => `${v}%`}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1f2937",
                fontSize: 11,
              }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value: unknown) => {
                if (value == null || typeof value !== "number") return "—";
                return `${value.toFixed(2)}%`;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
              iconType="line"
            />
            <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="2 4" label={{ value: "5% amber", position: "right", fill: "#f59e0b", fontSize: 9 }} />
            <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="2 4" label={{ value: "15% red", position: "right", fill: "#ef4444", fontSize: 9 }} />
            <Line
              type="monotone"
              dataKey="p_stop_7d"
              name="P(stop) 7d"
              stroke="#22d3ee"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="p_stop_30d"
              name="P(stop) 30d"
              stroke="#a855f7"
              strokeWidth={1.75}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
