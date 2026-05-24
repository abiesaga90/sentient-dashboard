import { useMemo } from "react";
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

interface TrajectoryRow {
  date: string;
  cum_long_pct: number;
  cum_short_pct: number;
  cum_spread_pct: number;
  spread_daily_return_pct: number;
  z_30d: number | null;
  z_90d: number | null;
  z_180d: number | null;
  drift_30d_ann_pct: number | null;
  drift_90d_ann_pct: number | null;
  drift_180d_ann_pct: number | null;
  rolling_return_30d_pct: number | null;
  rolling_return_90d_pct: number | null;
  rolling_return_180d_pct: number | null;
}

type RegimeTag =
  | "expanding_strong"
  | "expanding"
  | "flat"
  | "contracting"
  | "contracting_strong";

interface TrajectoryCurrent {
  date: string | null;
  regime_tag: RegimeTag;
  regime_z: number | null;
  regime_window_days: number;
  cum_long_pct: number;
  cum_short_pct: number;
  cum_spread_pct: number;
  long_contrib_pct_of_spread: number;
  short_contrib_pct_of_spread: number;
  z_30d: number | null;
  z_90d: number | null;
  z_180d: number | null;
  drift_30d_ann_pct: number | null;
  drift_90d_ann_pct: number | null;
  drift_180d_ann_pct: number | null;
  rolling_return_30d_pct: number | null;
  rolling_return_90d_pct: number | null;
  rolling_return_180d_pct: number | null;
}

interface TrajectoryResponse {
  trajectory: TrajectoryRow[];
  current: TrajectoryCurrent;
  trading_days: number;
  windows: number[];
  thresholds: { z_strong: number; z_directional: number };
  regime_z_window: number;
  baseline?: Record<string, { mu_pct: number; sigma_pct: number; n_obs: number }>;
  error?: string;
}

const REGIME_STYLES: Record<RegimeTag, { label: string; cls: string }> = {
  expanding_strong: {
    label: "Expanding strong",
    cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  expanding: {
    label: "Expanding",
    cls: "bg-emerald-500/10 text-emerald-300/80 border-emerald-500/20",
  },
  flat: {
    label: "Flat",
    cls: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  },
  contracting: {
    label: "Contracting",
    cls: "bg-amber-500/10 text-amber-300/80 border-amber-500/20",
  },
  contracting_strong: {
    label: "Contracting strong",
    cls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
};

function fmtZ(z: number | null): string {
  if (z === null || z === undefined || !Number.isFinite(z)) return "–";
  return (z >= 0 ? "+" : "") + z.toFixed(2);
}

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return (v >= 0 ? "+" : "") + v.toFixed(digits) + "%";
}

function shortDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s.slice(5); // MM-DD
  }
  return s;
}

export function SpreadTrajectoryPanel() {
  const { client, engine } = useEngine();

  const { data, isLoading } = useQuery<TrajectoryResponse>({
    queryKey: ["spread-trajectory", engine.id],
    queryFn: () => client.get("/api/spread-trajectory"),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const chartData = useMemo(() => {
    if (!data?.trajectory) return [];
    return data.trajectory.map((r) => ({
      date: r.date,
      cum_long: r.cum_long_pct,
      cum_short: r.cum_short_pct,
      cum_spread: r.cum_spread_pct,
    }));
  }, [data]);

  const cur = data?.current;
  const regime = cur?.regime_tag ?? "flat";
  const style = REGIME_STYLES[regime];

  const action = (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${style.cls}`}
        title={
          cur?.regime_z !== null && cur?.regime_z !== undefined
            ? `z(${cur.regime_window_days}d) = ${fmtZ(cur.regime_z)}`
            : "insufficient history"
        }
      >
        {style.label}
      </span>
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span>
          z<sub>30d</sub>{" "}
          <span className="text-gray-200">{fmtZ(cur?.z_30d ?? null)}</span>
        </span>
        <span>
          z<sub>90d</sub>{" "}
          <span className="text-gray-200">{fmtZ(cur?.z_90d ?? null)}</span>
        </span>
        <span>
          z<sub>180d</sub>{" "}
          <span className="text-gray-200">{fmtZ(cur?.z_180d ?? null)}</span>
        </span>
      </div>
    </div>
  );

  if (data?.error) {
    return (
      <ChartContainer title="L/S Spread Trajectory" height={320} action={action}>
        <div className="flex items-center justify-center h-full text-xs text-rose-400">
          {data.error}
        </div>
      </ChartContainer>
    );
  }

  if (isLoading || !data || chartData.length === 0) {
    return (
      <ChartContainer title="L/S Spread Trajectory" height={320} action={action}>
        <div className="flex items-center justify-center h-full text-xs text-gray-500">
          {isLoading ? "loading…" : "no data yet"}
        </div>
      </ChartContainer>
    );
  }

  return (
    <div className="space-y-2">
      <ChartContainer title="L/S Spread Trajectory" height={320} action={action}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#1e1e2e" }}
            tickFormatter={shortDate}
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
            domain={["auto", "auto"]}
          />
          <ReferenceLine y={0} stroke="#1e1e2e" strokeDasharray="2 4" />
          <Tooltip
            contentStyle={{
              background: "#111118",
              border: "1px solid #1e1e2e",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            labelFormatter={(s: unknown) => `Date: ${String(s ?? "")}`}
            formatter={(v, name) => [
              `${Number(v).toFixed(2)}%`,
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
          <Line
            type="monotone"
            dataKey="cum_long"
            name="Cum long P&L (% of gross)"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="cum_short"
            name="Cum short P&L (% of gross)"
            stroke="#f97316"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="cum_spread"
            name="Cum spread = long + short"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>

      {cur && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-1">
          <KpiTile
            label="Cum spread (since inception)"
            value={fmtPct(cur.cum_spread_pct)}
            sub={
              cur.cum_spread_pct !== 0
                ? `long ${cur.long_contrib_pct_of_spread.toFixed(0)}% / short ${cur.short_contrib_pct_of_spread.toFixed(0)}%`
                : undefined
            }
          />
          <KpiTile
            label="Rolling 30d spread return"
            value={fmtPct(cur.rolling_return_30d_pct)}
            sub={`drift ann ${fmtPct(cur.drift_30d_ann_pct, 1)}`}
          />
          <KpiTile
            label="Rolling 90d spread return"
            value={fmtPct(cur.rolling_return_90d_pct)}
            sub={`drift ann ${fmtPct(cur.drift_90d_ann_pct, 1)}`}
          />
          <KpiTile
            label="Rolling 180d spread return"
            value={fmtPct(cur.rolling_return_180d_pct)}
            sub={`drift ann ${fmtPct(cur.drift_180d_ann_pct, 1)}`}
          />
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#0a0a14] border border-[#1e1e2e] rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-sm text-gray-200 mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
