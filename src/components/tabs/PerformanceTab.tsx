import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ChartContainer } from "../shared/ChartContainer";
import { formatUSD } from "../../lib/utils";

interface PerformanceResponse {
  sharpe_30d: number;
  sharpe_90d: number;
  sortino_30d: number;
  sortino_90d: number;
  rolling_sharpe_30d: number[];
  rolling_sharpe_90d: number[];
  rolling_sortino_30d: number[];
  rolling_sortino_90d: number[];
  drawdown_duration: {
    max_dd_duration_days: number;
    max_dd_start: string;
    max_dd_end: string;
    current_dd_duration_days: number;
  };
  short_hit_rate: {
    short_exits_total: number;
    short_exits_profitable: number;
    short_hit_rate_pct: number;
    short_avg_win_pct: number;
    short_avg_loss_pct: number;
  };
  long_short_pnl: {
    long_realized_pnl: number;
    short_realized_pnl: number;
    long_trade_count: number;
    short_trade_count: number;
    long_avg_pnl: number;
    short_avg_pnl: number;
  };
  hedge_effectiveness: {
    long_short_correlation: number;
    rolling_30d_correlations: number[];
    hedge_quality: string;
  };
  hedge_per_short: Array<{
    symbol: string;
    beta: number;
    correlation: number;
    hedge_score: number;
    unrealized_pnl: number;
  }>;
}

export function PerformanceTab() {
  const { client, engine } = useEngine();
  const { data, isLoading, error } = useQuery<PerformanceResponse>({
    queryKey: ["performance", engine.id],
    queryFn: () => client.get("/api/performance"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading performance data...
      </div>
    );
  }

  if (error || !data) {
    const errMsg = (data as Record<string, string> | undefined)?.error;
    return (
      <div className="p-4">
        <Card className="flex flex-col items-center justify-center h-64">
          <div className="text-lg font-medium text-gray-400">Performance</div>
          <div className="text-sm text-gray-600 mt-2">
            {errMsg || "LP reporting may be disabled on this engine."}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Ratio KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <RatioCard label="Sharpe (30d)" value={data.sharpe_30d} />
        <RatioCard label="Sharpe (90d)" value={data.sharpe_90d} />
        <RatioCard label="Sortino (30d)" value={data.sortino_30d} />
        <RatioCard label="Sortino (90d)" value={data.sortino_90d} />
      </div>

      {/* Rolling Sharpe Chart */}
      {(data.rolling_sharpe_30d.length > 0 || data.rolling_sortino_30d.length > 0) && (
        <RollingChart
          title="Rolling Sharpe Ratio"
          data30={data.rolling_sharpe_30d}
          data90={data.rolling_sharpe_90d}
          label30="30d"
          label90="90d"
        />
      )}

      {/* Rolling Sortino Chart */}
      {(data.rolling_sortino_30d.length > 0) && (
        <RollingChart
          title="Rolling Sortino Ratio"
          data30={data.rolling_sortino_30d}
          data90={data.rolling_sortino_90d}
          label30="30d"
          label90="90d"
        />
      )}

      {/* Drawdown Duration + Short Hit Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* DD Duration */}
        <Card>
          <CardHeader>
            <CardTitle>Drawdown Duration</CardTitle>
          </CardHeader>
          <div className="space-y-2 text-xs">
            <StatRow
              label="Max DD Duration"
              value={`${data.drawdown_duration.max_dd_duration_days} days`}
            />
            <StatRow label="DD Start" value={data.drawdown_duration.max_dd_start} />
            <StatRow label="DD End" value={data.drawdown_duration.max_dd_end} />
            <StatRow
              label="Current DD Duration"
              value={`${data.drawdown_duration.current_dd_duration_days} days`}
              highlight={data.drawdown_duration.current_dd_duration_days > 0}
            />
          </div>
        </Card>

        {/* Short Hit Rate */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Short Hit Rate</CardTitle>
              <span className="text-lg font-bold text-gray-100">
                {data.short_hit_rate.short_hit_rate_pct.toFixed(1)}%
              </span>
            </div>
          </CardHeader>
          <div className="space-y-2 text-xs">
            <StatRow
              label="Total Exits"
              value={String(data.short_hit_rate.short_exits_total)}
            />
            <StatRow
              label="Profitable"
              value={String(data.short_hit_rate.short_exits_profitable)}
            />
            <StatRow
              label="Avg Win"
              value={`+${data.short_hit_rate.short_avg_win_pct.toFixed(2)}%`}
              color="text-green-400"
            />
            <StatRow
              label="Avg Loss"
              value={`${data.short_hit_rate.short_avg_loss_pct.toFixed(2)}%`}
              color="text-red-400"
            />
            <StatRow
              label="Win/Loss Ratio"
              value={
                data.short_hit_rate.short_avg_loss_pct !== 0
                  ? (
                      Math.abs(data.short_hit_rate.short_avg_win_pct) /
                      Math.abs(data.short_hit_rate.short_avg_loss_pct)
                    ).toFixed(2)
                  : "—"
              }
            />
          </div>
        </Card>
      </div>

      {/* Long vs Short P&L */}
      <Card>
        <CardHeader>
          <CardTitle>Long vs Short Realized P&L</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-green-400 font-medium mb-2">Longs</div>
            <div className="space-y-1 text-xs">
              <StatRow label="Realized P&L" value={formatUSD(data.long_short_pnl.long_realized_pnl)} color="text-green-400" />
              <StatRow label="Trades" value={String(data.long_short_pnl.long_trade_count)} />
              <StatRow label="Avg P&L/Trade" value={formatUSD(data.long_short_pnl.long_avg_pnl)} />
            </div>
          </div>
          <div>
            <div className="text-xs text-red-400 font-medium mb-2">Shorts</div>
            <div className="space-y-1 text-xs">
              <StatRow label="Realized P&L" value={formatUSD(data.long_short_pnl.short_realized_pnl)} color={data.long_short_pnl.short_realized_pnl >= 0 ? "text-green-400" : "text-red-400"} />
              <StatRow label="Trades" value={String(data.long_short_pnl.short_trade_count)} />
              <StatRow label="Avg P&L/Trade" value={formatUSD(data.long_short_pnl.short_avg_pnl)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Hedge Effectiveness */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Hedge Effectiveness</CardTitle>
            <Badge
              variant={
                data.hedge_effectiveness.hedge_quality === "GOOD"
                  ? "success"
                  : data.hedge_effectiveness.hedge_quality === "MODERATE"
                    ? "warning"
                    : "danger"
              }
            >
              {data.hedge_effectiveness.hedge_quality}
            </Badge>
          </div>
        </CardHeader>
        <div className="space-y-2 text-xs">
          <StatRow
            label="L/S Correlation"
            value={data.hedge_effectiveness.long_short_correlation.toFixed(4)}
          />
          {data.hedge_effectiveness.rolling_30d_correlations.length > 0 && (
            <StatRow
              label="Latest 30d Corr"
              value={data.hedge_effectiveness.rolling_30d_correlations[
                data.hedge_effectiveness.rolling_30d_correlations.length - 1
              ].toFixed(4)}
            />
          )}
        </div>
      </Card>

      {/* Per-Short Hedge Metrics */}
      {data.hedge_per_short.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Per-Short Hedge Metrics ({data.hedge_per_short.length})</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
                <tr>
                  <th className="px-2 py-1.5 text-left text-gray-500">Symbol</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Beta</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Corr</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Hedge Score</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Unreal. P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.hedge_per_short
                  .sort((a, b) => b.hedge_score - a.hedge_score)
                  .map((h) => (
                    <tr key={h.symbol} className="hover:bg-[var(--bg-card-hover)]">
                      <td className="px-2 py-1.5 text-gray-200 font-medium">
                        {h.symbol.replace("USDT", "")}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-400">
                        {h.beta.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-400">
                        {h.correlation.toFixed(3)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span
                          className={
                            h.hedge_score > 0.8
                              ? "text-green-400"
                              : h.hedge_score > 0.5
                                ? "text-yellow-400"
                                : "text-red-400"
                          }
                        >
                          {h.hedge_score.toFixed(3)}
                        </span>
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          h.unrealized_pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {h.unrealized_pnl >= 0 ? "+" : ""}
                        {formatUSD(h.unrealized_pnl)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Helper components ──

function RatioCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          value > 1
            ? "text-green-400"
            : value > 0
              ? "text-yellow-400"
              : value === 0
                ? "text-gray-500"
                : "text-red-400"
        }`}
      >
        {value.toFixed(2)}
      </div>
    </Card>
  );
}

function RollingChart({
  title,
  data30,
  data90,
  label30,
  label90,
}: {
  title: string;
  data30: number[];
  data90: number[];
  label30: string;
  label90: string;
}) {
  const maxLen = Math.max(data30.length, data90.length);
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    idx: i,
    [label30]: data30[i] ?? null,
    [label90]: data90[i] ?? null,
  }));

  return (
    <ChartContainer title={title} height={250}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="idx"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#1e1e2e" }}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v.toFixed(1)}
        />
        <Tooltip
          contentStyle={{
            background: "#111118",
            border: "1px solid #1e1e2e",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          formatter={(v) => [(Number(v)).toFixed(3)]}
        />
        <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
        {/* Zero reference line */}
        <Line
          type="monotone"
          dataKey={label30}
          name={label30}
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey={label90}
          name={label90}
          stroke="#f97316"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

function StatRow({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between py-0.5 ${highlight ? "bg-yellow-900/10 px-1 rounded" : ""}`}>
      <span className="text-gray-500">{label}</span>
      <span className={color || "text-gray-300"}>{value}</span>
    </div>
  );
}
