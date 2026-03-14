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
