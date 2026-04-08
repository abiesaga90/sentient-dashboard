import { KpiRow } from "../overview/KpiRow";
import { EquityCurve } from "../overview/EquityCurve";
import { PnlSummary } from "../overview/PnlSummary";
import { Movers } from "../overview/Movers";
import { Allocation } from "../overview/Allocation";
import { ExposureCharts } from "../overview/ExposureCharts";
import { PositionsTable } from "../overview/PositionsTable";
import { BasketSummary } from "../overview/BasketSummary";
import { PnlReconciliation } from "../overview/PnlReconciliation";
import { RecentTrades } from "../overview/RecentTrades";
import { MonthlyReturns } from "../overview/MonthlyReturns";
import { DailyPnlChart } from "../overview/DailyPnlChart";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { SpreadTable } from "../shared/SpreadTable";
import { usePnl, useRiskHistory } from "../../hooks/useDashboardQuery";
import type { DashboardResponse } from "../../types/api";

interface OverviewTabProps {
  data: DashboardResponse;
}

export function OverviewTab({ data }: OverviewTabProps) {
  const { data: pnl } = usePnl();
  const { data: riskHistory } = useRiskHistory();

  const ls = data.portfolio.ls_spread;

  // Leverage multiplier for levered view: gross / NAV (spreads amplified by true leverage)
  const nav = data.risk?.nav || 1;
  const gross = (data.risk?.gross_long ?? 0) + (data.risk?.gross_short ?? 0);
  const leverageRatio = gross > 0 && nav > 0 ? gross / nav : 1;

  return (
    <div className="space-y-4 p-4">
      {/* L/S Spread */}
      {ls && (
        <SpreadTable
          horizons={ls.horizons}
          periods={ls.periods}
          exOutliers={ls.ex_outliers}
          informationRatio={ls.information_ratio}
          downDayCapture={ls.down_day_capture_pct}
          cumulativeSpread={ls.cumulative_spread_pct}
          leverageRatio={leverageRatio}
          netBetaPct={ls.net_beta_pct}
        />
      )}

      {/* Daily P&L Attribution */}
      {data.portfolio.daily_attribution && data.portfolio.daily_attribution.nav_change != null && (
        <DailyAttribution attr={data.portfolio.daily_attribution} />
      )}

      {/* KPI Cards + Compliance + NT dual view */}
      <KpiRow
        portfolio={data.portfolio}
        risk={data.risk}
        ntRisk={data.nt_risk as Record<string, unknown> | undefined}
        positions={data.positions?.positions}
      />

      {/* Equity Curve */}
      <EquityCurve
        data={data.equity.equity}
        startingCapital={data.portfolio.starting_capital}
      />

      {/* Movers */}
      <Movers
        positions={data.positions.positions}
        bySymbol={pnl?.by_symbol}
      />

      {/* P&L Summary (All-Time, WTD, MTD, QTD, YTD) */}
      {pnl && <PnlSummary pnl={pnl} />}

      {/* Allocation + P&L Reconciliation side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Allocation risk={data.risk} />
        {pnl && (
          <PnlReconciliation pnl={pnl} />
        )}
      </div>

      {/* Basket Comparison */}
      <BasketSummary basket={data.basket_comparison} />

      {/* Exposure History */}
      {riskHistory?.history && riskHistory.history.length > 0 && (
        <ExposureCharts history={riskHistory.history} />
      )}

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Positions ({data.positions.count})
            </CardTitle>
            <div className="flex gap-3 text-xs">
              <span className="text-green-400">
                W: {data.positions.winners_count} (+${data.positions.winners_total_pnl.toFixed(2)})
              </span>
              <span className="text-red-400">
                L: {data.positions.losers_count} (${data.positions.losers_total_pnl.toFixed(2)})
              </span>
            </div>
          </div>
        </CardHeader>
        <PositionsTable positions={data.positions.positions} />
      </Card>

      {/* Monthly Returns */}
      {pnl && <MonthlyReturns monthly={pnl.monthly} />}

      {/* Recent Trades */}
      <RecentTrades trades={data.trades.trades} />

      {/* Daily P&L */}
      {pnl && pnl.daily.length > 0 && <DailyPnlChart daily={pnl.daily} />}

    </div>
  );
}


function DailyAttribution({ attr }: { attr: NonNullable<DashboardResponse["portfolio"]["daily_attribution"]> }) {
  const c = attr.components;
  const pnlColor = (v: number) => v >= 0 ? "text-green-400" : "text-red-400";
  const fmt = (v: number) => `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(0)}`;
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  return (
    <Card>
      <CardTitle>Daily P&L Attribution</CardTitle>
      <div className="text-xs text-gray-500 mb-3">{attr.period}</div>

      {/* NAV Change header */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className={`text-2xl font-bold ${pnlColor(attr.nav_change)}`}>
          {fmt(attr.nav_change)}
        </span>
        <span className={`text-sm ${pnlColor(attr.nav_change_pct)}`}>
          {fmtPct(attr.nav_change_pct)} on notional
        </span>
        <span className="text-xs text-gray-600">
          ${attr.prev_nav.toLocaleString()} → ${attr.curr_nav.toLocaleString()}
        </span>
      </div>

      {/* Component breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "MTM (held)", value: c.mtm_held },
          { label: "Turnover P&L", value: c.turnover_pnl },
          { label: "Funding", value: c.funding },
          { label: "Fees", value: c.fees },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 rounded p-2">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-sm font-medium ${pnlColor(value)}`}>{fmt(value)}</div>
          </div>
        ))}
      </div>

      {/* Turnover by reason */}
      {Object.keys(attr.turnover_by_reason).length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Turnover by Reason</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600 border-b border-gray-800">
                <th className="text-left py-1">Reason</th>
                <th className="text-right py-1">Trades</th>
                <th className="text-right py-1">P&L</th>
                <th className="text-right py-1">Notional</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(attr.turnover_by_reason).map(([reason, d]) => (
                <tr key={reason} className="border-b border-gray-800/30">
                  <td className="py-1 text-gray-400 font-mono">{reason}</td>
                  <td className="text-right text-gray-500">{d.count}</td>
                  <td className={`text-right font-medium ${pnlColor(d.pnl)}`}>{fmt(d.pnl)}</td>
                  <td className="text-right text-gray-600">${d.notional.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-4 mt-2 text-xs text-gray-600 border-t border-gray-800 pt-2">
            <span>Trades: {attr.total_trades}</span>
            <span>Turnover: ${attr.total_turnover_notional.toLocaleString()}</span>
            <span>Turnover/NAV: {attr.turnover_pct_of_nav.toFixed(0)}%</span>
          </div>
        </div>
      )}
    </Card>
  );
}

