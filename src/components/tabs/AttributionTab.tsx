import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ChartContainer } from "../shared/ChartContainer";
import { formatPct } from "../../lib/utils";

interface AttributionResponse {
  total: {
    total_return_pct: number;
    mkt_contribution_pct: number;
    size_contribution_pct: number;
    value_contribution_pct: number;
    mom_contribution_pct: number;
    growth_contribution_pct: number;
    alpha_pct: number;
    costs_pct: number;
    factor_betas: Record<string, number>;
    r_squared: number;
  };
  monthly: Array<{
    month: string;
    total_return_pct: number;
    mkt_pct: number;
    size_pct: number;
    value_pct: number;
    mom_pct: number;
    growth_pct: number;
    alpha_pct: number;
    costs_pct: number;
  }>;
  factors_ready: boolean;
  factors_days_needed: number;
  factors_days_available: number;
  spread: {
    status: string;
    days: number;
    daily: Array<{
      date: string;
      long_pnl: number;
      short_pnl: number;
      residual: number;
      net_pct: number;
    }>;
    cumulative: {
      long_pnl: number;
      short_pnl: number;
      residual: number;
      total_pnl: number;
      long_pnl_pct: number;
      short_pnl_pct: number;
    };
    beta_net: {
      target_pct: number;
      realized_avg_net_pct: number;
      drift_pct: number;
    };
    ls_correlation: {
      corr_7d: number;
      corr_30d: number;
    };
  };
  btc_decorrelation: {
    available: boolean;
    corr_7d: number;
    corr_30d: number;
    regime: string;
    daily_samples: Array<{ timestamp: string; corr_7d: number }>;
    description: string;
  };
  kingmaker: {
    name: string;
    thesis: string;
    long_alignment_pct: number;
    short_alignment_pct: number;
    categories: Record<string, string[]>;
    n_longs: number;
    n_shorts: number;
  };
  descriptions: Record<string, { name: string; short: string }>;
}

const FACTOR_COLORS: Record<string, string> = {
  MKT: "#3b82f6",
  SIZE: "#8b5cf6",
  VALUE: "#f59e0b",
  MOM: "#10b981",
  GROWTH: "#ec4899",
  Alpha: "#22c55e",
  Costs: "#ef4444",
};

export function AttributionTab() {
  const { client, engine } = useEngine();
  const { data, isLoading, error } = useQuery<AttributionResponse>({
    queryKey: ["attribution", engine.id],
    queryFn: () => client.get("/api/attribution"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading attribution data...
      </div>
    );
  }

  if (error || !data) {
    const errMsg = (data as Record<string, string> | undefined)?.error;
    return (
      <div className="p-4">
        <Card className="flex flex-col items-center justify-center h-64">
          <div className="text-lg font-medium text-gray-400">Attribution</div>
          <div className="text-sm text-gray-600 mt-2">
            {errMsg || "LP reporting may be disabled on this engine."}
          </div>
        </Card>
      </div>
    );
  }

  const t = data.total;

  // Waterfall data
  const waterfall = [
    { name: "MKT", value: t.mkt_contribution_pct },
    { name: "SIZE", value: t.size_contribution_pct },
    { name: "VALUE", value: t.value_contribution_pct },
    { name: "MOM", value: t.mom_contribution_pct },
    { name: "GROWTH", value: t.growth_contribution_pct },
    { name: "Alpha", value: t.alpha_pct },
    { name: "Costs", value: -t.costs_pct },
    { name: "Total", value: t.total_return_pct },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Factor readiness */}
      {!data.factors_ready && (
        <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-3 text-xs text-yellow-400">
          Factor model needs {data.factors_days_needed} days of data.
          Currently have {data.factors_days_available} days.
        </div>
      )}

      {/* Waterfall Chart */}
      <ChartContainer title="Factor Attribution (% of NAV)" height={280}>
        <BarChart data={waterfall}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#1e1e2e" }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#111118",
              border: "1px solid #1e1e2e",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            formatter={(v) => [`${Number(v).toFixed(3)}%`]}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {waterfall.map((d) => (
              <Cell
                key={d.name}
                fill={
                  d.name === "Total"
                    ? d.value >= 0
                      ? "#22c55e"
                      : "#ef4444"
                    : FACTOR_COLORS[d.name] || "#64748b"
                }
                fillOpacity={d.name === "Total" ? 0.9 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Factor Breakdown + Factor Betas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Factor Contributions</CardTitle>
          </CardHeader>
          <div className="space-y-1.5 text-xs">
            {waterfall.slice(0, -1).map((d) => (
              <div key={d.name} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: FACTOR_COLORS[d.name] || "#64748b" }}
                  />
                  <span className="text-gray-400">{d.name}</span>
                </div>
                <span className={d.value >= 0 ? "text-green-400" : "text-red-400"}>
                  {formatPct(d.value, 3)}
                </span>
              </div>
            ))}
            <div className="border-t border-[var(--border)] pt-1 flex justify-between font-medium">
              <span className="text-gray-300">Total Return</span>
              <span className={t.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}>
                {formatPct(t.total_return_pct, 3)}
              </span>
            </div>
            <div className="flex justify-between text-gray-600 pt-1">
              <span>R²</span>
              <span>{(t.r_squared * 100).toFixed(1)}%</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Factor Betas</CardTitle>
          </CardHeader>
          <div className="space-y-1.5 text-xs">
            {Object.entries(t.factor_betas).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: FACTOR_COLORS[k] || "#64748b" }}
                  />
                  <span className="text-gray-400">{k}</span>
                </div>
                <span className="text-gray-300">{(v as number).toFixed(4)}</span>
              </div>
            ))}
          </div>

          {/* Beta Net Drift */}
          <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-1 text-xs">
            <div className="text-gray-500 font-medium mb-1">Beta Net Drift</div>
            <StatRow label="Target" value={formatPct(data.spread.beta_net.target_pct)} />
            <StatRow label="Realized Avg" value={formatPct(data.spread.beta_net.realized_avg_net_pct)} />
            <StatRow label="Drift" value={formatPct(data.spread.beta_net.drift_pct)} />
          </div>
        </Card>
      </div>

      {/* Monthly Attribution Table */}
      {data.monthly.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Attribution</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="px-2 py-1.5 text-left text-gray-500">Month</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Return</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">MKT</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">SIZE</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">VALUE</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">MOM</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Alpha</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Costs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.monthly.map((m) => (
                  <tr key={m.month} className="hover:bg-[var(--bg-card-hover)]">
                    <td className="px-2 py-1.5 text-gray-300">{m.month}</td>
                    <td className={`px-2 py-1.5 text-right font-medium ${m.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatPct(m.total_return_pct, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-400">{formatPct(m.mkt_pct, 2)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-400">{formatPct(m.size_pct, 2)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-400">{formatPct(m.value_pct, 2)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-400">{formatPct(m.mom_pct, 2)}</td>
                    <td className={`px-2 py-1.5 text-right ${m.alpha_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatPct(m.alpha_pct, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-red-400">{formatPct(-m.costs_pct, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* L/S Spread + BTC Decorrelation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* L/S Correlation */}
        <Card>
          <CardHeader>
            <CardTitle>L/S Correlation</CardTitle>
          </CardHeader>
          <div className="space-y-1.5 text-xs">
            <StatRow label="7d Correlation" value={data.spread.ls_correlation.corr_7d.toFixed(4)} />
            <StatRow label="30d Correlation" value={data.spread.ls_correlation.corr_30d.toFixed(4)} />
            <StatRow label="Spread Days" value={String(data.spread.days)} />
            <div className="border-t border-[var(--border)] pt-2 mt-2">
              <StatRow label="Long Cum P&L" value={formatPct(data.spread.cumulative.long_pnl_pct)} />
              <StatRow label="Short Cum P&L" value={formatPct(data.spread.cumulative.short_pnl_pct)} />
            </div>
          </div>
        </Card>

        {/* BTC Decorrelation */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>BTC Decorrelation</CardTitle>
              <Badge
                variant={
                  data.btc_decorrelation.regime === "NORMAL"
                    ? "success"
                    : data.btc_decorrelation.regime === "WARNING"
                      ? "warning"
                      : "danger"
                }
              >
                {data.btc_decorrelation.regime}
              </Badge>
            </div>
          </CardHeader>
          <div className="space-y-1.5 text-xs">
            <StatRow label="7d BTC-Alt Corr" value={data.btc_decorrelation.corr_7d.toFixed(4)} />
            <StatRow label="30d BTC-Alt Corr" value={data.btc_decorrelation.corr_30d.toFixed(4)} />
            <p className="text-[10px] text-gray-600 mt-2">
              {data.btc_decorrelation.description}
            </p>
          </div>
        </Card>
      </div>

      {/* BTC Decorrelation Chart */}
      {data.btc_decorrelation.daily_samples.length > 0 && (
        <ChartContainer title="BTC-Alt Correlation (7d Rolling)" height={200}>
          <LineChart
            data={data.btc_decorrelation.daily_samples.map((s) => ({
              date: s.timestamp.slice(5, 10),
              corr: s.corr_7d,
            }))}
          >
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
              domain={[0, 1]}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                background: "#111118",
                border: "1px solid #1e1e2e",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(v) => [Number(v).toFixed(4), "Corr"]}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Line type="monotone" dataKey="corr" name="7d Corr" stroke="#f97316" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ChartContainer>
      )}

      {/* Kingmaker */}
      <Card>
        <CardHeader>
          <CardTitle>Kingmaker Alignment</CardTitle>
        </CardHeader>
        <div className="text-xs space-y-2">
          <div className="text-gray-400">{data.kingmaker.thesis}</div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <div className="text-gray-500">Long Alignment</div>
              <div className="text-lg font-bold text-green-400">
                {data.kingmaker.long_alignment_pct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-gray-600">{data.kingmaker.n_longs} longs</div>
            </div>
            <div>
              <div className="text-gray-500">Short Alignment</div>
              <div className="text-lg font-bold text-red-400">
                {data.kingmaker.short_alignment_pct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-gray-600">{data.kingmaker.n_shorts} shorts</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
