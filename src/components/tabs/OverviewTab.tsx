import { useState } from "react";
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
  const [exOutliers, setExOutliers] = useState(false);
  const [levered, setLevered] = useState(false);

  const ls = data.portfolio.ls_spread;
  const exo = ls?.ex_outliers;
  const activePeriods = exOutliers && exo ? exo.periods : ls?.periods;
  const activeIR = exOutliers && exo ? exo.information_ratio : ls?.information_ratio;
  const activeCapture = exOutliers && exo ? exo.down_day_capture_pct : ls?.down_day_capture_pct;
  const activeCumulative = exOutliers && exo ? exo.cumulative_spread_pct : ls?.cumulative_spread_pct;

  // Leverage multiplier for levered view (avg side notional / NAV)
  // Spread = long_ret - short_ret (per-side %). To get NAV impact,
  // multiply by avg single-side exposure / NAV.
  const nav = data.risk?.nav || 1;
  const grossLong = data.risk?.gross_long ?? 0;
  const grossShort = data.risk?.gross_short ?? 0;
  const avgSide = (grossLong + grossShort) / 2;
  const leverageRatio = avgSide > 0 && nav > 0 ? avgSide / nav : 1;
  const lm = levered ? leverageRatio : 1;

  // Apply leverage multiplier to spread data
  const scaleSpread = (d: Record<string, SpreadData> | undefined): Record<string, SpreadData> | undefined => {
    if (!d || lm === 1) return d;
    const out: Record<string, SpreadData> = {};
    for (const [k, v] of Object.entries(d)) {
      out[k] = {
        spread_pct: Math.round(v.spread_pct * lm * 100) / 100,
        long_pct: Math.round(v.long_pct * lm * 100) / 100,
        short_pct: Math.round(v.short_pct * lm * 100) / 100,
      };
    }
    return out;
  };
  const displayHorizons = scaleSpread(ls?.horizons);
  const displayPeriods = scaleSpread(activePeriods);

  return (
    <div className="space-y-4 p-4">
      {/* L/S Spread */}
      {ls && (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>L/S Spread</CardTitle>
            <div className="flex gap-1.5">
              <button
                onClick={() => setLevered(!levered)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  levered
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                    : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
                }`}
                title={`Apply ${leverageRatio.toFixed(1)}x leverage to spread`}
              >
                {levered ? `${leverageRatio.toFixed(1)}x` : "Levered"}
              </button>
              {exo && (
                <button
                  onClick={() => setExOutliers(!exOutliers)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    exOutliers
                      ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                      : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
                  }`}
                  title={`Strip ${exo.symbols.join(", ")} (${exo.total_pnl_removed >= 0 ? "+" : ""}$${exo.total_pnl_removed.toFixed(0)})`}
                >
                  {exo.label}
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-1 pr-4"></th>
                  {/* Intraday horizons */}
                  {ls.horizons && Object.keys(ls.horizons).map((h) => (
                    <th key={h} className="text-right py-1 px-2 font-medium">{h}</th>
                  ))}
                  {/* Period-based */}
                  {activePeriods && Object.keys(activePeriods).map((p) => (
                    <th key={p} className="text-right py-1 px-2 font-medium border-l border-gray-800">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SpreadRow
                  label="Spread"
                  field="spread_pct"
                  horizons={displayHorizons}
                  periods={displayPeriods}
                  bold
                />
                <SpreadRow
                  label="Longs"
                  field="long_pct"
                  horizons={displayHorizons}
                  periods={displayPeriods}
                />
                <SpreadRow
                  label="Shorts"
                  field="short_pct"
                  horizons={displayHorizons}
                  periods={displayPeriods}
                />
              </tbody>
            </table>
            {/* Summary metrics */}
            <div className="flex gap-6 mt-3 text-xs text-gray-500 border-t border-gray-800 pt-2">
              {activeIR != null && (
                <span>IR: <span className="text-gray-300 font-medium">{activeIR.toFixed(2)}</span></span>
              )}
              {activeCapture != null && (
                <span>Down-day capture: <span className="text-gray-300 font-medium">{activeCapture.toFixed(0)}%</span></span>
              )}
              {activeCumulative != null && (
                <span>Cumulative: <span className={`font-medium ${activeCumulative * lm >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {activeCumulative * lm >= 0 ? "+" : ""}{(activeCumulative * lm).toFixed(2)}%
                </span></span>
              )}
              {exOutliers && exo && (
                <span className="text-yellow-500/70">
                  Excluding: {exo.symbols.map(s => s.replace("USDT", "")).join(", ")} ({exo.total_pnl_removed >= 0 ? "+" : ""}${exo.total_pnl_removed.toFixed(0)})
                </span>
              )}
            </div>
          </div>
        </Card>
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

interface SpreadData {
  spread_pct: number;
  long_pct: number;
  short_pct: number;
  [key: string]: number;
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

function SpreadRow({
  label, field, horizons, periods, bold,
}: {
  label: string;
  field: string;
  horizons?: Record<string, SpreadData>;
  periods?: Record<string, SpreadData>;
  bold?: boolean;
}) {
  const cls = bold ? "text-gray-400 font-medium" : "text-gray-500";
  const valCls = (v: number) =>
    `text-right py-1.5 px-2 ${bold ? "font-bold" : ""} ${v >= 0 ? "text-green-400" : "text-red-400"}${bold ? "" : "/70"}`;

  return (
    <tr className="border-b border-gray-800/50">
      <td className={`py-1.5 pr-4 ${cls}`}>{label}</td>
      {horizons && Object.entries(horizons).map(([h, v]) => (
        <td key={h} className={valCls(v[field as keyof SpreadData] as number)}>
          {(v[field as keyof SpreadData] as number) >= 0 ? "+" : ""}
          {(v[field as keyof SpreadData] as number).toFixed(2)}%
        </td>
      ))}
      {periods && Object.entries(periods).map(([p, v]) => (
        <td key={p} className={`${valCls(v[field as keyof SpreadData] as number)} border-l border-gray-800`}>
          {(v[field as keyof SpreadData] as number) >= 0 ? "+" : ""}
          {(v[field as keyof SpreadData] as number).toFixed(2)}%
        </td>
      ))}
    </tr>
  );
}
