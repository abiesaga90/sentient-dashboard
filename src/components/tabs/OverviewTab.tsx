import { KpiRow } from "../overview/KpiRow";
import { EquityCurve } from "../overview/EquityCurve";
import { PnlSummary } from "../overview/PnlSummary";
import { ExposureCharts } from "../overview/ExposureCharts";
import { PositionsTable } from "../overview/PositionsTable";
import { MonthlyReturns } from "../overview/MonthlyReturns";
import { DailyPnlChart } from "../overview/DailyPnlChart";
import { BasketSummary } from "../overview/BasketSummary";
import { AdlMonitor } from "../overview/AdlMonitor";
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
      {/* KPI Cards */}
      <KpiRow portfolio={data.portfolio} risk={data.risk} />

      {/* Equity Curve */}
      <EquityCurve
        data={data.equity.equity}
        startingCapital={data.portfolio.starting_capital}
      />

      {/* P&L Summary */}
      {pnl && <PnlSummary pnl={pnl} />}

      {/* Exposure History */}
      {riskHistory?.history && riskHistory.history.length > 0 && (
        <ExposureCharts history={riskHistory.history} />
      )}

      {/* Basket Comparison */}
      <BasketSummary basket={data.basket_comparison} />

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Positions ({data.positions.count})
            </CardTitle>
            <div className="flex gap-3 text-xs">
              <span className="text-green-400">
                W: {data.positions.winners_count} (${data.positions.winners_total_pnl.toFixed(2)})
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

      {/* Daily P&L */}
      {pnl && pnl.daily.length > 0 && <DailyPnlChart daily={pnl.daily} />}

      {/* P&L Decomposition */}
      {pnl && pnl.decomposition.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>P&L Decomposition</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {pnl.decomposition.map((d) => (
              <div
                key={d.reason}
                className="flex items-center justify-between text-xs py-1"
              >
                <span className="text-gray-400 capitalize">
                  {d.reason.replace(/_/g, " ")}
                </span>
                <div className="flex gap-4">
                  <span className="text-gray-500">
                    {d.trade_count} trades
                  </span>
                  <span
                    className={d.pnl >= 0 ? "text-green-400" : "text-red-400"}
                  >
                    {d.pnl >= 0 ? "+" : ""}${d.pnl.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ADL Risk */}
      <AdlMonitor adl={data.adl} />
    </div>
  );
}
