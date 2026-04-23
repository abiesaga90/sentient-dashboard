import {
  ComposedChart,
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
import { useDispersionHistory } from "../../hooks/useDashboardQuery";

const TICK = { fill: "#9ca3af", fontSize: 11 };

export function DispersionChart({ days = 365 }: { days?: number }) {
  const { data, isLoading, error } = useDispersionHistory(days);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Dispersion &amp; Vol Budget</CardTitle></CardHeader>
        <div className="text-sm text-gray-500 p-4">Loading…</div>
      </Card>
    );
  }

  if (error || !data || !data.available || data.series.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Dispersion &amp; Vol Budget</CardTitle></CardHeader>
        <div className="text-sm text-gray-500 p-4">
          {data?.reason || "No dispersion history available."}
        </div>
      </Card>
    );
  }

  const series = data.series;
  const targetVol = data.target_spread_vol_pct ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Dispersion &amp; Vol Budget</CardTitle>
          <div className="text-xs text-gray-500">
            {data.basket?.n_longs} L / {data.basket?.n_shorts} S · gross{" "}
            {data.basket?.gross_pct.toFixed(0)}% · {data.lookback_days}d window
          </div>
        </div>
      </CardHeader>

      {/* Explainer */}
      <div className="px-4 pb-3 text-xs text-gray-400 leading-relaxed space-y-1.5">
        <p>
          <strong className="text-gray-300">What you&rsquo;re looking at.</strong>{" "}
          Rolling dispersion of today&rsquo;s long/short basket, projected
          backwards over the price history. It answers two questions: how
          tightly coupled are the two sides (correlation) and is realised
          spread volatility big enough for the strategy to get paid at
          current sizing (vol budget).
        </p>
        <p>
          <strong className="text-gray-300">How to read it.</strong>{" "}
          <span className="text-blue-300">ρ_30d</span> is the coincident
          hedge tightness.{" "}
          <span className="text-orange-300">ρ_90d</span> is the slower
          regime baseline &mdash; a fair benchmark of &ldquo;normal&rdquo; for
          this book.{" "}
          <span className="text-blue-300">ρ_30d rising above ρ_90d</span>{" "}
          flags compression in progress (leading indicator, typically ~15&ndash;30d
          ahead of spread vol reacting).
        </p>
        <p>
          <strong className="text-gray-300">Vol budget.</strong>{" "}
          Realised 30d spread vol divided by the vol that would produce 5%
          P(stop)/yr at current gross (closed-form, zero-drift). Values
          near 1.0× mean sizing and realised dispersion are matched.
          Below 0.5× the strategy is under-utilising its risk budget
          (&ldquo;alpha compressed&rdquo;). Above 1.0× realised vol exceeds the
          DD-plan assumption (&ldquo;over budget&rdquo;).
        </p>
      </div>

      {/* Chart 1: Correlation regime */}
      <div className="px-4 pb-2 text-xs text-gray-500 font-medium">
        Correlation regime (rolling)
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={TICK}
            minTickGap={40}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis
            domain={[0.4, 1.0]}
            tick={TICK}
            width={44}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", fontSize: 12 }}
            labelStyle={{ color: "#e5e7eb" }}
            formatter={(v: unknown) => {
              const n = typeof v === "number" ? v : Number(v);
              return Number.isFinite(n) ? n.toFixed(3) : "—";
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0.90} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "0.90", fill: "#f59e0b", fontSize: 10, position: "right" }} />
          <Line
            type="monotone"
            dataKey="ls_corr_30d"
            name="ρ 30d"
            stroke="#60a5fa"
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="ls_corr_90d"
            name="ρ 90d"
            stroke="#fb923c"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Chart 2: Spread vol + vol budget ratio */}
      <div className="px-4 pt-3 pb-2 text-xs text-gray-500 font-medium">
        Spread vol (realised vs target) &amp; vol budget ratio
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={TICK}
            minTickGap={40}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis
            yAxisId="vol"
            tick={TICK}
            width={48}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            label={{ value: "Spread vol / day", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }}
          />
          <YAxis
            yAxisId="ratio"
            orientation="right"
            tick={TICK}
            width={40}
            domain={[0, 2]}
            tickFormatter={(v: number) => `${v.toFixed(1)}×`}
            label={{ value: "Vol budget", angle: 90, position: "insideRight", fill: "#9ca3af", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", fontSize: 12 }}
            labelStyle={{ color: "#e5e7eb" }}
            formatter={(v: unknown, name: unknown) => {
              const n = typeof v === "number" ? v : Number(v);
              if (!Number.isFinite(n)) return "—";
              return name === "Vol budget" ? `${n.toFixed(2)}×` : `${n.toFixed(2)}%`;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {targetVol != null && (
            <ReferenceLine
              yAxisId="vol"
              y={targetVol}
              stroke="#10b981"
              strokeDasharray="4 3"
              label={{
                value: `Target ${targetVol.toFixed(2)}%`,
                fill: "#10b981",
                fontSize: 10,
                position: "right",
              }}
            />
          )}
          <ReferenceLine
            yAxisId="ratio"
            y={1.0}
            stroke="#ef4444"
            strokeDasharray="2 4"
          />
          <ReferenceLine
            yAxisId="ratio"
            y={0.5}
            stroke="#f59e0b"
            strokeDasharray="2 4"
          />
          <Line
            yAxisId="vol"
            type="monotone"
            dataKey="spread_vol_pct"
            name="Realised spread vol"
            stroke="#818cf8"
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="ratio"
            type="monotone"
            dataKey="vol_budget_ratio"
            name="Vol budget"
            stroke="#22d3ee"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="px-4 py-2 text-[10px] text-gray-600 leading-snug">
        {data.note}
      </div>
    </Card>
  );
}
