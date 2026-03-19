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
import { usePnl, useRiskHistory } from "../../hooks/useDashboardQuery";
import type { DashboardResponse } from "../../types/api";

interface OverviewTabProps {
  data: DashboardResponse;
}

export function OverviewTab({ data }: OverviewTabProps) {
  const { data: pnl } = usePnl();
  const { data: riskHistory } = useRiskHistory();

  return (
    <div className="space-y-4 p-4">
      {/* L/S Spread — Multi-Horizon */}
      {data.portfolio.ls_spread && data.portfolio.ls_spread.horizons && (
        <Card>
          <CardTitle>L/S Spread (notional-weighted)</CardTitle>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-1 pr-4"></th>
                  {Object.keys(data.portfolio.ls_spread.horizons).map((h) => (
                    <th key={h} className="text-right py-1 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="text-gray-400 py-1.5 pr-4 font-medium">Spread</td>
                  {Object.entries(data.portfolio.ls_spread.horizons).map(([h, v]) => (
                    <td key={h} className={`text-right py-1.5 px-2 font-bold ${
                      v.spread_pct >= 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {v.spread_pct >= 0 ? "+" : ""}{v.spread_pct.toFixed(2)}%
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="text-gray-500 py-1.5 pr-4">Longs</td>
                  {Object.entries(data.portfolio.ls_spread.horizons).map(([h, v]) => (
                    <td key={h} className={`text-right py-1.5 px-2 ${
                      v.long_pct >= 0 ? "text-green-400/70" : "text-red-400/70"
                    }`}>
                      {v.long_pct >= 0 ? "+" : ""}{v.long_pct.toFixed(2)}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="text-gray-500 py-1.5 pr-4">Shorts</td>
                  {Object.entries(data.portfolio.ls_spread.horizons).map(([h, v]) => (
                    <td key={h} className={`text-right py-1.5 px-2 ${
                      v.short_pct >= 0 ? "text-green-400/70" : "text-red-400/70"
                    }`}>
                      {v.short_pct >= 0 ? "+" : ""}{v.short_pct.toFixed(2)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* KPI Cards + Compliance + NT dual view */}
      <KpiRow
        portfolio={data.portfolio}
        risk={data.risk}
        ntRisk={data.nt_risk as Record<string, unknown> | undefined}
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
