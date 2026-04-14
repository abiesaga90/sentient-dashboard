import { useState } from "react";
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
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ChartContainer } from "../shared/ChartContainer";
import { SpreadTable } from "../shared/SpreadTable";
import { useDashboard } from "../../hooks/useDashboardQuery";
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
  long_hit_rate?: {
    long_exits_total: number;
    long_exits_profitable: number;
    long_hit_rate_pct: number;
    long_avg_win_pct: number;
    long_avg_loss_pct: number;
  };
  long_short_pnl: {
    long_realized_pnl: number;
    short_realized_pnl: number;
    long_trade_count: number;
    short_trade_count: number;
    long_avg_pnl: number;
    short_avg_pnl: number;
    long_unrealized_pnl?: number;
    short_unrealized_pnl?: number;
    long_total_pnl?: number;
    short_total_pnl?: number;
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
  ls_alpha?: {
    cumulative_spread_pct: number;
    information_ratio: number;
    down_day_capture_pct: number;
    tracking_error_ann: number;
    long_max_dd_pct: number;
    short_max_dd_pct: number;
    trading_days: number;
    profit_factor: number;
    hedge_ratio_pct: number;
  };
  top_pnl?: {
    long_winners: CombinedPnlEntry[];
    long_losers: CombinedPnlEntry[];
    short_winners: CombinedPnlEntry[];
    short_losers: CombinedPnlEntry[];
  };
  regime_returns?: Array<{
    regime: string;
    days: number;
    total_return_pct: number;
    ann_sharpe: number;
    max_dd_pct: number;
    win_rate_pct: number;
    avg_daily_return_pct: number;
  }>;
  capture_ratios?: {
    up_capture_pct: number;
    down_capture_pct: number;
    capture_ratio: number;
    btc_up_days: number;
    btc_down_days: number;
    rolling_capture_ratio: Array<{ date: string; capture_ratio: number }>;
    ex_outliers?: {
      label: string;
      symbols: string[];
      total_pnl_removed: number;
      up_capture_pct: number;
      down_capture_pct: number;
      capture_ratio: number;
      btc_up_days: number;
      btc_down_days: number;
      rolling_capture_ratio: Array<{ date: string; capture_ratio: number }>;
    };
  };
  conditional_beta?: {
    up_beta: number;
    down_beta: number;
    convexity: number;
    convexity_label: string;
    up_alpha: number;
    down_alpha: number;
    up_r_squared: number;
    down_r_squared: number;
    up_days: number;
    down_days: number;
    ex_outliers?: {
      label: string;
      symbols: string[];
      total_pnl_removed: number;
      up_beta: number;
      down_beta: number;
      convexity: number;
      convexity_label: string;
      up_alpha: number;
      down_alpha: number;
      up_r_squared: number;
      down_r_squared: number;
      up_days: number;
      down_days: number;
    };
  };
  quality_spread?: {
    daily: Array<{ date: string; spread_ret_pct: number; cum_spread_pct: number; cum_portfolio_pct: number }>;
    total_spread_return_pct: number;
    spread_ann_sharpe: number;
    spread_portfolio_corr: number;
    rolling_corr_30d: Array<{ date: string; corr: number }>;
  };
  sector_hedge?: Array<{
    sector: string;
    n_shorts: number;
    avg_beta: number;
    avg_correlation: number;
    avg_hedge_score: number;
    total_unrealized_pnl: number;
  }>;
}

interface CombinedPnlEntry {
  symbol: string;
  realized: number;
  unrealized: number;
  total: number;
}

interface ShortRotationResponse {
  summary: {
    total_rotations: number;
    rotation_hit_rate_pct: number;
    avg_rotation_pnl: number;
    total_rotation_pnl: number;
    avg_turnover_pct: number;
    avg_hold_hours: number;
    est_rotation_cost_usd: number;
    est_slippage_bps: number;
  };
  counterfactual: {
    correct_exits: number;
    premature_exits: number;
    neutral_exits: number;
    total_evaluated: number;
    avg_post_exit_move_pct: number;
    verdict: string;
  };
  per_cycle: Array<{
    cycle: number;
    date: string;
    turnover_pct: number;
    names_in: string[];
    names_out: string[];
    n_rotated: number;
    rotation_pnl: number;
    cycle_pnl: number;
  }>;
  recent_rotations: Array<{
    symbol: string;
    exit_date: string;
    exit_pnl: number;
    post_3d_pct: number | null;
    post_7d_pct: number | null;
    post_14d_pct: number | null;
    verdict: string;
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
  const { data: rotation } = useQuery<ShortRotationResponse>({
    queryKey: ["short-rotation", engine.id],
    queryFn: () => client.get("/api/performance/short-rotation"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  const { data: dashboard } = useDashboard();
  const [exOutliers, setExOutliers] = useState(false);

  // L/S Spread data from dashboard (shared with OverviewTab)
  const ls = dashboard?.portfolio?.ls_spread;
  const _nav = dashboard?.risk?.nav || 1;
  const _gross = (dashboard?.risk?.gross_long ?? 0) + (dashboard?.risk?.gross_short ?? 0);
  const _leverageRatio = _gross > 0 && _nav > 0 ? _gross / _nav : 1;

  // Resolve capture/beta values based on toggle
  const exCap = data?.capture_ratios?.ex_outliers;
  const exBeta = data?.conditional_beta?.ex_outliers;
  const cap = exOutliers && exCap ? exCap : data?.capture_ratios;
  const beta = exOutliers && exBeta ? exBeta : data?.conditional_beta;

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
      {/* Ratio KPIs — snapshot (Nickel's view) + live */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <RatioCard label="Sharpe (4w)" value={data.sharpe_30d} />
        <RatioCard label="Sharpe (4w live)" value={(data as any).sharpe_30d_live || data.sharpe_30d} />
        <RatioCard label="Sharpe (12w)" value={data.sharpe_90d} />
        <RatioCard label="Sortino (4w)" value={data.sortino_30d} />
        <RatioCard label="Sortino (4w live)" value={(data as any).sortino_30d_live || data.sortino_30d} />
        <RatioCard label="Sortino (12w)" value={data.sortino_90d} />
      </div>

      {/* Rolling Sharpe Chart */}
      {(data.rolling_sharpe_30d.length > 0 || data.rolling_sortino_30d.length > 0) && (
        <RollingChart
          title="Rolling Sharpe Ratio"
          data30={data.rolling_sharpe_30d}
          data90={data.rolling_sharpe_90d}
          label30="4w"
          label90="12w"
        />
      )}

      {/* Rolling Sortino Chart */}
      {(data.rolling_sortino_30d.length > 0) && (
        <RollingChart
          title="Rolling Sortino Ratio"
          data30={data.rolling_sortino_30d}
          data90={data.rolling_sortino_90d}
          label30="4w"
          label90="12w"
        />
      )}

      {/* Drawdown Duration */}
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

      {/* Hit Rates: Long + Short side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Long Hit Rate */}
        {data.long_hit_rate && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Long Hit Rate</CardTitle>
                <span className="text-lg font-bold text-gray-100">
                  {data.long_hit_rate.long_hit_rate_pct.toFixed(1)}%
                </span>
              </div>
            </CardHeader>
            <div className="space-y-2 text-xs">
              <StatRow label="Total Exits" value={String(data.long_hit_rate.long_exits_total)} />
              <StatRow label="Profitable" value={String(data.long_hit_rate.long_exits_profitable)} />
              <StatRow label="Avg Win" value={`+${data.long_hit_rate.long_avg_win_pct.toFixed(2)}%`} color="text-green-400" />
              <StatRow label="Avg Loss" value={`${data.long_hit_rate.long_avg_loss_pct.toFixed(2)}%`} color="text-red-400" />
              <StatRow
                label="Win/Loss Ratio"
                value={
                  data.long_hit_rate.long_avg_loss_pct !== 0
                    ? (Math.abs(data.long_hit_rate.long_avg_win_pct) / Math.abs(data.long_hit_rate.long_avg_loss_pct)).toFixed(2)
                    : "—"
                }
              />
            </div>
          </Card>
        )}

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
            <StatRow label="Total Exits" value={String(data.short_hit_rate.short_exits_total)} />
            <StatRow label="Profitable" value={String(data.short_hit_rate.short_exits_profitable)} />
            <StatRow label="Avg Win" value={`+${data.short_hit_rate.short_avg_win_pct.toFixed(2)}%`} color="text-green-400" />
            <StatRow label="Avg Loss" value={`${data.short_hit_rate.short_avg_loss_pct.toFixed(2)}%`} color="text-red-400" />
            <StatRow
              label="Win/Loss Ratio"
              value={
                data.short_hit_rate.short_avg_loss_pct !== 0
                  ? (Math.abs(data.short_hit_rate.short_avg_win_pct) / Math.abs(data.short_hit_rate.short_avg_loss_pct)).toFixed(2)
                  : "—"
              }
            />
          </div>
        </Card>
      </div>

      {/* Long vs Short P&L */}
      <Card>
        <CardHeader>
          <CardTitle>Long vs Short P&L</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-green-400 font-medium mb-2">Longs</div>
            <div className="space-y-1 text-xs">
              <StatRow label="Realized" value={formatUSD(data.long_short_pnl.long_realized_pnl)} color={data.long_short_pnl.long_realized_pnl >= 0 ? "text-green-400" : "text-red-400"} />
              {data.long_short_pnl.long_unrealized_pnl != null && (
                <StatRow label="Unrealized" value={formatUSD(data.long_short_pnl.long_unrealized_pnl)} color={data.long_short_pnl.long_unrealized_pnl >= 0 ? "text-green-400" : "text-red-400"} />
              )}
              {data.long_short_pnl.long_total_pnl != null && (
                <StatRow label="Total" value={formatUSD(data.long_short_pnl.long_total_pnl)} color={data.long_short_pnl.long_total_pnl >= 0 ? "text-green-400" : "text-red-400"} />
              )}
              <div className="border-t border-[var(--border)] pt-1 mt-1">
                <StatRow label="Closed Trades" value={String(data.long_short_pnl.long_trade_count)} />
                <StatRow label="Avg P&L/Trade" value={formatUSD(data.long_short_pnl.long_avg_pnl)} />
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-red-400 font-medium mb-2">Shorts</div>
            <div className="space-y-1 text-xs">
              <StatRow label="Realized" value={formatUSD(data.long_short_pnl.short_realized_pnl)} color={data.long_short_pnl.short_realized_pnl >= 0 ? "text-green-400" : "text-red-400"} />
              {data.long_short_pnl.short_unrealized_pnl != null && (
                <StatRow label="Unrealized" value={formatUSD(data.long_short_pnl.short_unrealized_pnl)} color={data.long_short_pnl.short_unrealized_pnl >= 0 ? "text-green-400" : "text-red-400"} />
              )}
              {data.long_short_pnl.short_total_pnl != null && (
                <StatRow label="Total" value={formatUSD(data.long_short_pnl.short_total_pnl)} color={data.long_short_pnl.short_total_pnl >= 0 ? "text-green-400" : "text-red-400"} />
              )}
              <div className="border-t border-[var(--border)] pt-1 mt-1">
                <StatRow label="Closed Trades" value={String(data.long_short_pnl.short_trade_count)} />
                <StatRow label="Avg P&L/Trade" value={formatUSD(data.long_short_pnl.short_avg_pnl)} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* L/S Alpha */}
      {data.ls_alpha && (
        <Card>
          <CardHeader>
            <CardTitle>L/S Alpha</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500">Cumulative Return</div>
              <div className={`text-lg font-bold ${data.ls_alpha.cumulative_spread_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                {data.ls_alpha.cumulative_spread_pct >= 0 ? "+" : ""}{data.ls_alpha.cumulative_spread_pct.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Sharpe (ann.)</div>
              <div className={`text-lg font-bold ${data.ls_alpha.information_ratio > 1 ? "text-green-400" : data.ls_alpha.information_ratio > 0 ? "text-yellow-400" : "text-red-400"}`}>
                {data.ls_alpha.information_ratio.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Profit Factor</div>
              <div className={`text-lg font-bold ${data.ls_alpha.profit_factor > 1.5 ? "text-green-400" : data.ls_alpha.profit_factor > 1 ? "text-yellow-400" : "text-red-400"}`}>
                {data.ls_alpha.profit_factor.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500" title="% of long-down days where shorts were profitable">Shorts Hedged %</div>
              <div className={`text-lg font-bold ${data.ls_alpha.down_day_capture_pct >= 50 ? "text-green-400" : "text-yellow-400"}`}>
                {data.ls_alpha.down_day_capture_pct.toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3 pt-3 border-t border-[var(--border)]">
            <div>
              <div className="text-xs text-gray-500" title="Annualized portfolio volatility on gross basis (no benchmark subtracted)">Portfolio Vol (ann.)</div>
              <div className="text-sm text-gray-300">{data.ls_alpha.tracking_error_ann.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Hedge Ratio</div>
              <div className={`text-sm ${data.ls_alpha.hedge_ratio_pct >= 50 ? "text-green-400" : "text-yellow-400"}`}>
                {data.ls_alpha.hedge_ratio_pct.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Long Max DD</div>
              <div className="text-sm text-red-400">{data.ls_alpha.long_max_dd_pct.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Short Max DD</div>
              <div className="text-sm text-red-400">{data.ls_alpha.short_max_dd_pct.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Trading Days</div>
              <div className="text-sm text-gray-300">{data.ls_alpha.trading_days}</div>
            </div>
          </div>
        </Card>
      )}

      {/* L/S Spread Table */}
      {ls && (
        <SpreadTable
          horizons={ls.horizons}
          periods={ls.periods}
          exOutliers={ls.ex_outliers}
          informationRatio={ls.information_ratio}
          downDayCapture={ls.down_day_capture_pct}
          cumulativeSpread={ls.cumulative_spread_pct}
          leverageRatio={_leverageRatio}
          netBetaPct={ls.net_beta_pct}
        />
      )}

      {/* Top 10 Combined PnL (Realized + Unrealized) */}
      {data.top_pnl && (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 P&L (Realized + Unrealized)</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Longs */}
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Long Winners</div>
              <PnlTable entries={data.top_pnl.long_winners} prefix="lw" winnerSide />
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 mt-4">Long Losers</div>
              <PnlTable entries={data.top_pnl.long_losers} prefix="ll" />
            </div>
            {/* Shorts */}
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Short Winners</div>
              <PnlTable entries={data.top_pnl.short_winners} prefix="sw" winnerSide />
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 mt-4">Short Losers</div>
              <PnlTable entries={data.top_pnl.short_losers} prefix="sl" />
            </div>
          </div>
        </Card>
      )}

      {/* Hedge Effectiveness */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Hedge Effectiveness</CardTitle>
            <Badge
              variant={
                data.hedge_effectiveness.hedge_quality === "EXCELLENT" ||
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

      {/* Sector-Level Hedge Effectiveness */}
      {data.sector_hedge && data.sector_hedge.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sector Hedge Effectiveness ({data.sector_hedge.length} sectors)</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
                <tr>
                  <th className="px-2 py-1.5 text-left text-gray-500">Sector</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Shorts</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Avg Beta</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Avg Corr</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Avg Hedge</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Unreal. P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.sector_hedge
                  .sort((a, b) => b.avg_hedge_score - a.avg_hedge_score)
                  .map((s) => (
                    <tr key={s.sector} className="hover:bg-[var(--bg-card-hover)]">
                      <td className="px-2 py-1.5 text-gray-200 font-medium capitalize">
                        {s.sector.replace(/_/g, " ")}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-400">{s.n_shorts}</td>
                      <td className="px-2 py-1.5 text-right text-gray-400">{s.avg_beta.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-400">{s.avg_correlation.toFixed(3)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <span className={s.avg_hedge_score > 0.8 ? "text-green-400" : s.avg_hedge_score > 0.5 ? "text-yellow-400" : "text-red-400"}>
                          {s.avg_hedge_score.toFixed(3)}
                        </span>
                      </td>
                      <td className={`px-2 py-1.5 text-right ${s.total_unrealized_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {s.total_unrealized_pnl >= 0 ? "+" : ""}
                        {formatUSD(s.total_unrealized_pnl)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Short Rotation Analytics */}
      {rotation && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Short Rotation Analysis</CardTitle>
                <Badge
                  variant={
                    rotation.counterfactual.verdict === "ROTATION_HELPING"
                      ? "success"
                      : rotation.counterfactual.verdict === "ROTATION_HURTING"
                        ? "danger"
                        : rotation.counterfactual.verdict === "INSUFFICIENT_DATA"
                          ? "default"
                          : "warning"
                  }
                >
                  {rotation.counterfactual.verdict.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500">Avg Turnover/Cycle</div>
                <div className="text-lg font-bold text-gray-200">
                  {rotation.summary.avg_turnover_pct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Rotations</div>
                <div className="text-lg font-bold text-gray-200">
                  {rotation.summary.total_rotations}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Rotation Hit Rate</div>
                <div className={`text-lg font-bold ${rotation.summary.rotation_hit_rate_pct >= 50 ? "text-green-400" : "text-red-400"}`}>
                  {rotation.summary.rotation_hit_rate_pct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Rotation P&L</div>
                <div className={`text-lg font-bold ${rotation.summary.total_rotation_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {rotation.summary.total_rotation_pnl >= 0 ? "+" : ""}${rotation.summary.total_rotation_pnl.toFixed(0)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-[var(--border)]">
              <div>
                <div className="text-xs text-gray-500">Avg Hold (hours)</div>
                <div className="text-sm text-gray-300">{rotation.summary.avg_hold_hours.toFixed(0)}h</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Avg P&L/Rotation</div>
                <div className={`text-sm ${rotation.summary.avg_rotation_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {rotation.summary.avg_rotation_pnl >= 0 ? "+" : ""}${rotation.summary.avg_rotation_pnl.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Est. Rotation Cost</div>
                <div className="text-sm text-yellow-400">${rotation.summary.est_rotation_cost_usd.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Slippage Assumption</div>
                <div className="text-sm text-gray-400">{rotation.summary.est_slippage_bps}bps RT</div>
              </div>
            </div>
          </Card>

          {/* Counterfactual Verdict */}
          {rotation.counterfactual.total_evaluated > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Post-Exit Counterfactual</CardTitle>
              </CardHeader>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-green-900/20 rounded p-2 text-center">
                    <div className="text-green-400 text-lg font-bold">{rotation.counterfactual.correct_exits}</div>
                    <div className="text-xs text-gray-500">Correct Exits</div>
                    <div className="text-[10px] text-gray-600">Price recovered after exit</div>
                  </div>
                  <div className="flex-1 bg-red-900/20 rounded p-2 text-center">
                    <div className="text-red-400 text-lg font-bold">{rotation.counterfactual.premature_exits}</div>
                    <div className="text-xs text-gray-500">Premature Exits</div>
                    <div className="text-[10px] text-gray-600">Kept falling after exit</div>
                  </div>
                  <div className="flex-1 bg-gray-800/50 rounded p-2 text-center">
                    <div className="text-gray-400 text-lg font-bold">{rotation.counterfactual.neutral_exits}</div>
                    <div className="text-xs text-gray-500">Neutral</div>
                    <div className="text-[10px] text-gray-600">{"<"}2% move either way</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  Avg post-exit move:{" "}
                  <span className={rotation.counterfactual.avg_post_exit_move_pct > 0 ? "text-green-400" : "text-red-400"}>
                    {rotation.counterfactual.avg_post_exit_move_pct > 0 ? "+" : ""}
                    {rotation.counterfactual.avg_post_exit_move_pct.toFixed(2)}%
                  </span>
                  {" "}(positive = price recovered = correct to exit)
                </div>
              </div>
            </Card>
          )}

          {/* Per-Cycle Rotation Table */}
          {rotation.per_cycle.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rotation by Rebalance Cycle</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-gray-500">Cycle</th>
                      <th className="px-2 py-1.5 text-left text-gray-500">Date</th>
                      <th className="px-2 py-1.5 text-right text-gray-500">Turnover</th>
                      <th className="px-2 py-1.5 text-left text-gray-500">In</th>
                      <th className="px-2 py-1.5 text-left text-gray-500">Out</th>
                      <th className="px-2 py-1.5 text-right text-gray-500">Rot. P&L</th>
                      <th className="px-2 py-1.5 text-right text-gray-500">Cycle P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rotation.per_cycle.map((c) => (
                      <tr key={c.cycle} className="hover:bg-[var(--bg-card-hover)]">
                        <td className="px-2 py-1.5 text-gray-300 font-mono">#{c.cycle}</td>
                        <td className="px-2 py-1.5 text-gray-400">{c.date}</td>
                        <td className="px-2 py-1.5 text-right text-gray-300">{c.turnover_pct}%</td>
                        <td className="px-2 py-1.5 text-green-400 text-[10px]">{c.names_in.join(", ") || "-"}</td>
                        <td className="px-2 py-1.5 text-red-400 text-[10px]">{c.names_out.join(", ") || "-"}</td>
                        <td className={`px-2 py-1.5 text-right ${c.rotation_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {c.rotation_pnl >= 0 ? "+" : ""}${c.rotation_pnl.toFixed(0)}
                        </td>
                        <td className={`px-2 py-1.5 text-right ${c.cycle_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {c.cycle_pnl >= 0 ? "+" : ""}${c.cycle_pnl.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Recent Rotations Detail */}
          {rotation.recent_rotations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Rotated-Out Shorts ({rotation.recent_rotations.length})</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-gray-500">Symbol</th>
                      <th className="px-2 py-1.5 text-left text-gray-500">Exit Date</th>
                      <th className="px-2 py-1.5 text-right text-gray-500">Exit P&L</th>
                      <th className="px-2 py-1.5 text-right text-gray-500">Post-3d</th>
                      <th className="px-2 py-1.5 text-right text-gray-500">Post-7d</th>
                      <th className="px-2 py-1.5 text-right text-gray-500">Post-14d</th>
                      <th className="px-2 py-1.5 text-center text-gray-500">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rotation.recent_rotations.map((r, i) => (
                      <tr key={`${r.symbol}-${i}`} className="hover:bg-[var(--bg-card-hover)]">
                        <td className="px-2 py-1.5 text-gray-200 font-medium">{r.symbol}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.exit_date}</td>
                        <td className={`px-2 py-1.5 text-right ${r.exit_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {r.exit_pnl >= 0 ? "+" : ""}${r.exit_pnl.toFixed(2)}
                        </td>
                        <td className={`px-2 py-1.5 text-right ${r.post_3d_pct != null ? (r.post_3d_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                          {r.post_3d_pct != null ? `${r.post_3d_pct > 0 ? "+" : ""}${r.post_3d_pct.toFixed(1)}%` : "-"}
                        </td>
                        <td className={`px-2 py-1.5 text-right ${r.post_7d_pct != null ? (r.post_7d_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                          {r.post_7d_pct != null ? `${r.post_7d_pct > 0 ? "+" : ""}${r.post_7d_pct.toFixed(1)}%` : "-"}
                        </td>
                        <td className={`px-2 py-1.5 text-right ${r.post_14d_pct != null ? (r.post_14d_pct > 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                          {r.post_14d_pct != null ? `${r.post_14d_pct > 0 ? "+" : ""}${r.post_14d_pct.toFixed(1)}%` : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge
                            variant={
                              r.verdict === "CORRECT" ? "success" : r.verdict === "PREMATURE" ? "danger" : "default"
                            }
                          >
                            {r.verdict}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Regime-Conditional Analytics ── */}

      {/* Regime Returns Table */}
      {data.regime_returns && data.regime_returns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Returns by Regime</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">Regime</th>
                  <th className="px-3 py-2 text-right text-gray-500">Days</th>
                  <th className="px-3 py-2 text-right text-gray-500">Return</th>
                  <th className="px-3 py-2 text-right text-gray-500">Sharpe</th>
                  <th className="px-3 py-2 text-right text-gray-500">Max DD</th>
                  <th className="px-3 py-2 text-right text-gray-500">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.regime_returns.map((r) => {
                  const regimeColors: Record<string, string> = {
                    full_bull: "#16A34A", early_bull: "#22C55E",
                    transition: "#EAB308", late_bear: "#F97316", deep_bear: "#DC2626",
                  };
                  const color = regimeColors[r.regime] || "#6b7280";
                  return (
                    <tr key={r.regime} className="hover:bg-[var(--bg-card-hover)]">
                      <td className="px-3 py-2">
                        <Badge variant="default" style={{ backgroundColor: color + "22", color, borderColor: color + "44" }}>
                          {r.regime.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">{r.days}</td>
                      <td className={`px-3 py-2 text-right font-mono ${r.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {r.total_return_pct >= 0 ? "+" : ""}{r.total_return_pct.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${r.ann_sharpe >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {r.ann_sharpe.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-red-400">
                        {r.max_dd_pct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">
                        {r.win_rate_pct.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Capture Ratio */}
      {cap && (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-300">Capture Ratios</div>
            {exCap && (
              <button
                onClick={() => setExOutliers(!exOutliers)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  exOutliers
                    ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                    : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
                }`}
                title={`Strip ${exCap.symbols.join(", ")} (${exCap.total_pnl_removed >= 0 ? "+" : ""}$${exCap.total_pnl_removed.toFixed(0)})`}
              >
                {exCap.label}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <div className="text-xs text-gray-500">Up Capture</div>
              <div className={`text-lg font-bold ${cap.up_capture_pct > 0 ? "text-green-400" : "text-red-400"}`}>{cap.up_capture_pct.toFixed(1)}%</div>
              <div className="text-xs text-gray-600">{cap.btc_up_days} days</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xs text-gray-500">Down Capture</div>
              <div className="text-lg font-bold text-red-400">{cap.down_capture_pct.toFixed(1)}%</div>
              <div className="text-xs text-gray-600">{cap.btc_down_days} days</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xs text-gray-500">Capture Ratio</div>
              <div className={`text-lg font-bold ${cap.capture_ratio >= 1 ? "text-green-400" : "text-red-400"}`}>
                {cap.capture_ratio.toFixed(2)}
              </div>
              <div className="text-xs text-gray-600">{cap.capture_ratio >= 1 ? "Asymmetric alpha" : "Negative asymmetry"}</div>
            </Card>
          </div>

          {cap.rolling_capture_ratio && cap.rolling_capture_ratio.length > 0 && (
            <ChartContainer title="Rolling 30d Capture Ratio" height={200}>
              <LineChart data={cap.rolling_capture_ratio.map((d) => ({ ...d, date: d.date.slice(5) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <ReferenceLine y={1} stroke="#6b7280" strokeDasharray="3 3" label={{ value: "1.0", fill: "#6b7280", fontSize: 10 }} />
                <Line type="monotone" dataKey="capture_ratio" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          )}
        </>
      )}

      {/* Conditional Beta */}
      {beta && beta.convexity_label !== "UNKNOWN" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conditional Beta</CardTitle>
              <div className="flex items-center gap-2">
                {exBeta && (
                  <button
                    onClick={() => setExOutliers(!exOutliers)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      exOutliers
                        ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                        : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
                    }`}
                    title={`Strip ${exBeta.symbols.join(", ")} (${exBeta.total_pnl_removed >= 0 ? "+" : ""}$${exBeta.total_pnl_removed.toFixed(0)})`}
                  >
                    {exBeta.label}
                  </button>
                )}
                <Badge
                  variant={beta.convexity_label === "CONVEX" ? "success" : beta.convexity_label === "CONCAVE" ? "danger" : "default"}
                >
                  {beta.convexity_label}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-gray-500">Up-Day Beta</div>
              <div className="text-gray-200 font-mono">{beta.up_beta.toFixed(4)}</div>
              <div className="text-gray-600">{beta.up_days} days, R²={beta.up_r_squared.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500">Down-Day Beta</div>
              <div className="text-gray-200 font-mono">{beta.down_beta.toFixed(4)}</div>
              <div className="text-gray-600">{beta.down_days} days, R²={beta.down_r_squared.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500">Convexity</div>
              <div className={`font-mono ${beta.convexity > 0 ? "text-green-400" : beta.convexity < 0 ? "text-red-400" : "text-gray-300"}`}>
                {beta.convexity > 0 ? "+" : ""}{beta.convexity.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Interpretation</div>
              <div className="text-gray-300 text-xs">
                {beta.convexity > 0.05
                  ? "Captures more upside than downside"
                  : beta.convexity < -0.05
                  ? "Loses more in downturns than gains in rallies"
                  : "Symmetric exposure to up/down moves"}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quality Spread */}
      {data.quality_spread && data.quality_spread.daily.length > 0 && (
        <>
          <ChartContainer title="Quality Spread vs Portfolio" height={250}>
            <LineChart data={data.quality_spread.daily.map((d) => ({ ...d, date: d.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#9ca3af" }}
                formatter={(v: any) => `${Number(v).toFixed(2)}%`}
              />
              <Legend />
              <Line type="monotone" dataKey="cum_spread_pct" name="Quality Spread" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cum_portfolio_pct" name="Portfolio" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
          <Card>
            <div className="px-4 py-3 grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-gray-500">Spread Return</div>
                <div className={`font-mono ${data.quality_spread.total_spread_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {data.quality_spread.total_spread_return_pct >= 0 ? "+" : ""}{data.quality_spread.total_spread_return_pct.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-gray-500">Spread Sharpe</div>
                <div className="text-gray-200 font-mono">{data.quality_spread.spread_ann_sharpe.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Spread-Portfolio Corr</div>
                <div className="text-gray-200 font-mono">{data.quality_spread.spread_portfolio_corr.toFixed(2)}</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Helper components ──

function PnlTable({ entries, prefix, winnerSide }: { entries: CombinedPnlEntry[]; prefix: string; winnerSide?: boolean }) {
  if (entries.length === 0) return <div className="text-xs text-gray-500">None</div>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-500">
          <th className="text-left pb-1">Symbol</th>
          <th className="text-right pb-1">Realized</th>
          <th className="text-right pb-1">Unreal.</th>
          <th className="text-right pb-1">Total</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((t, i) => (
          <tr key={`${prefix}-${i}`}>
            <td className="text-gray-300 py-0.5">{t.symbol.replace("USDT", "")}</td>
            <td className={`text-right font-mono py-0.5 ${t.realized >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
              {formatUSD(t.realized)}
            </td>
            <td className={`text-right font-mono py-0.5 ${t.unrealized >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
              {formatUSD(t.unrealized)}
            </td>
            <td className={`text-right font-mono font-medium py-0.5 ${winnerSide ? "text-green-400" : "text-red-400"}`}>
              {formatUSD(t.total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
