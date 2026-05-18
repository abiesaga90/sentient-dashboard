import { useState } from "react";
import { Card, CardTitle } from "../ui/Card";
import { formatUSD, formatPct, cn } from "../../lib/utils";
import type { Portfolio, RiskData } from "../../types/api";

interface PositionData {
  side: string;
  pnl_usd: number;
  symbol: string;
}

interface KpiRowProps {
  portfolio: Portfolio;
  risk: RiskData;
  ntRisk?: Record<string, unknown>;
  positions?: PositionData[];
}

type ExposureView = "gross" | "notional" | "nav";

export function KpiRow({ portfolio, risk, ntRisk, positions }: KpiRowProps) {
  const [exposureView, setExposureView] = useState<ExposureView>("gross");
  const leverage = risk.gross_pct / 100;

  return (
    <div className="space-y-3">
      {/* Main KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* NAV */}
        <Card>
          <CardTitle>NAV</CardTitle>
          <div className="text-xl font-bold text-gray-100 mt-1">
            {formatUSD(portfolio.nav)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatPct(portfolio.total_return_pct)}
          </div>
          <div className="text-[10px] text-gray-600 mt-1 space-y-0.5">
            <div>Cash: {formatUSD(portfolio.nav - risk.gross_long - risk.gross_short)} | Notional: {formatUSD(portfolio.starting_capital * 2, 0)} | Leverage: {(risk.gross_pct / 100).toFixed(1)}x</div>
          </div>
        </Card>

        {/* Daily Return */}
        {(() => {
          const navPct = portfolio.daily_return_pct ?? 0;
          const notionalPct = (portfolio as any).daily_return_pct_notional ?? navPct;
          const prevNav = (portfolio as any).prev_day_nav;
          const pnlUsd = prevNav ? portfolio.nav - prevNav : 0;
          return (
            <Card>
              <CardTitle>Daily Return</CardTitle>
              <div className={cn(
                "text-xl font-bold mt-1",
                notionalPct > 0 ? "text-green-400" : notionalPct < 0 ? "text-red-400" : "text-gray-400"
              )}>
                {notionalPct > 0 ? "+" : ""}{notionalPct.toFixed(2)}%
                <span className="text-sm font-normal text-gray-500 ml-1">
                  on $100k notional
                </span>
              </div>
              <div className="text-[10px] text-gray-600 mt-1 space-y-0.5">
                <div>
                  {navPct > 0 ? "+" : ""}{navPct.toFixed(2)}% on NAV
                </div>
                <div>{formatUSD(prevNav)} → {formatUSD(portfolio.nav)} ({pnlUsd >= 0 ? "+" : ""}{formatUSD(pnlUsd)})</div>
                <div>{(portfolio as any).prev_day_date ?? ""} close → now</div>
              </div>
            </Card>
          );
        })()}

        {/* Drawdown */}
        {(() => {
          const r = risk as any;
          const ntDd = r.nt_dd_pct != null ? r.nt_dd_pct : null;
          const ddVal = ntDd ?? risk.dd_pct;
          const ddLabel = ntDd != null ? "Nickel" : "Internal";
          const ntHwm = ntRisk ? Number(ntRisk.risk_hwm ?? 0) : 0;
          const hwm = ntDd != null && ntHwm > 0 ? ntHwm : risk.hwm;
          const ddUsd = portfolio.nav < hwm ? hwm - portfolio.nav : 0;
          return (
            <Card>
              <CardTitle>Drawdown ({ddLabel})</CardTitle>
              <div className={cn(
                "text-xl font-bold mt-1",
                ddVal > 5 ? "text-red-400" : ddVal > 3 ? "text-yellow-400" : "text-green-400"
              )}>
                {ddVal.toFixed(2)}% ({formatUSD(ddUsd)})
              </div>
              <div className="text-[10px] text-gray-600 mt-1 space-y-0.5">
                {ntDd != null && <div>Internal DD: {risk.dd_pct.toFixed(2)}% (HWM: {formatUSD(risk.hwm)})</div>}
                <div>HWM: {formatUSD(hwm)}</div>
                <div>Stop: {risk.limits.dd_stop_pct}% ({formatUSD((Number(ntRisk?.notional ?? 100000)) * risk.limits.dd_stop_pct / 100)})</div>
                <div>Scale: {((risk.effective_scale ?? (risk as any).dd_scale ?? 1) * 100).toFixed(1)}%</div>
              </div>
            </Card>
          );
        })()}

        {/* Exposure */}
        <Card>
          <div className="flex items-center justify-between gap-1">
            <CardTitle>Exposure</CardTitle>
            <div className="flex gap-0.5">
              {(["gross", "notional", "nav"] as ExposureView[]).map((v) => {
                const labels: Record<ExposureView, string> = { gross: "Strategy", notional: "Nickel", nav: "Equity" };
                const active = exposureView === v;
                return (
                  <button
                    key={v}
                    onClick={() => setExposureView(v)}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                      active
                        ? v === "notional"
                          ? "bg-[#0b688c] border-[#0b688c] text-white"
                          : "bg-gray-700 border-gray-600 text-gray-200"
                        : "bg-transparent border-transparent text-gray-600 hover:text-gray-400"
                    }`}
                  >
                    {labels[v]}
                  </button>
                );
              })}
            </div>
          </div>
          {(() => {
            const grossUsd = (risk.gross_usd ?? 0);
            const netUsd = (risk.net_usd ?? 0);
            if (exposureView === "gross") {
              // Strategy view: net & net-beta as % of gross
              const netPct = risk.net_pct_gross ?? (grossUsd > 0 ? (netUsd / grossUsd) * 100 : 0);
              const netBetaPct = risk.net_beta_pct_gross ?? netPct;
              return (
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Gross</span>
                    <span className="text-gray-200 font-semibold">100%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Net</span>
                    <span className="text-gray-200 font-semibold">{formatPct(netPct)}</span>
                  </div>
                  {risk.net_beta_pct != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Beta Net</span>
                      <span className="text-gray-200 font-semibold">{formatPct(netBetaPct)}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-gray-600">Net / Gross · hedge quality · {leverage.toFixed(2)}x lev</div>
                </div>
              );
            }
            if (exposureView === "notional") {
              // Nickel view: % of notional — matches NT /v1/risk
              return (
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Gross</span>
                    <span className="text-gray-200 font-semibold">{formatPct(risk.gross_pct)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Net</span>
                    <span className="text-gray-200 font-semibold">{formatPct(risk.net_pct)}</span>
                  </div>
                  {risk.net_beta_pct != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Beta Net</span>
                      <span className="text-gray-200 font-semibold">{formatPct(risk.net_beta_pct)}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-gray-600">
                    Net / Notional · target {formatPct(risk.target_beta_tilt_pct)} · {leverage.toFixed(2)}x
                  </div>
                </div>
              );
            }
            // Equity view: % of NAV
            const navUsd = risk.nav ?? 0;
            const netPctNav = risk.net_pct_nav ?? (navUsd > 0 ? (netUsd / navUsd) * 100 : 0);
            const netBetaPctNav = risk.net_beta_pct_nav ?? netPctNav;
            const grossPctNav = risk.gross_pct_nav ?? (navUsd > 0 ? (grossUsd / navUsd) * 100 : 0);
            return (
              <div className="mt-1 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Gross</span>
                  <span className="text-gray-200 font-semibold">{formatPct(grossPctNav)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Net</span>
                  <span className="text-gray-200 font-semibold">{formatPct(netPctNav)}</span>
                </div>
                {risk.net_beta_pct != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Beta Net</span>
                    <span className="text-gray-200 font-semibold">{formatPct(netBetaPctNav)}</span>
                  </div>
                )}
                <div className="text-[10px] text-gray-600">Net / NAV · P&L sensitivity · {leverage.toFixed(2)}x</div>
              </div>
            );
          })()}
        </Card>

        {/* Positions */}
        <Card>
          <CardTitle>Positions</CardTitle>
          <div className="text-xl font-bold text-gray-100 mt-1">
            {portfolio.n_longs}L / {portfolio.n_shorts}S
          </div>
          <div className="text-[10px] text-gray-600 mt-1">
            Target: {portfolio.n_longs_target}L / {portfolio.n_shorts_target}S
          </div>
          <div className="text-[10px] text-gray-600">
            Total: {portfolio.n_positions} positions
          </div>
        </Card>
      </div>

      {/* Spread Vol Metrics */}
      {risk.spread_vol && risk.spread_vol.daily_spread_vol_pct != null && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card>
            <CardTitle>Daily Spread Vol</CardTitle>
            <div className={cn(
              "text-lg font-bold mt-1",
              (risk.spread_vol.vol_regime === "ELEVATED") ? "text-red-400" :
              (risk.spread_vol.vol_regime === "NORMAL") ? "text-yellow-400" : "text-green-400"
            )}>
              {risk.spread_vol.daily_spread_vol_pct.toFixed(2)}%
            </div>
            <div className="text-[10px] text-gray-600 mt-1">
              30d rolling | Ann: {risk.spread_vol.annual_spread_vol_pct?.toFixed(1)}%
            </div>
          </Card>

          <Card>
            <CardTitle>DD Budget Ratio</CardTitle>
            <div className={cn(
              "text-lg font-bold mt-1",
              (risk.spread_vol.dd_budget_ratio_sigma ?? 0) < 2 ? "text-red-400" :
              (risk.spread_vol.dd_budget_ratio_sigma ?? 0) < 3 ? "text-yellow-400" : "text-green-400"
            )}>
              {risk.spread_vol.dd_budget_ratio_sigma?.toFixed(1)}σ
            </div>
            <div className="text-[10px] text-gray-600 mt-1">
              {formatUSD(risk.spread_vol.dd_budget_dollars ?? 0, 0)} / {formatUSD(risk.spread_vol.daily_pnl_vol_dollars ?? 0, 0)} daily vol
            </div>
          </Card>

          <Card>
            <CardTitle>Vol Budget (MC)</CardTitle>
            {(() => {
              const sv = risk.spread_vol;
              const budgetMc = sv.spread_vol_target_pct_mc;
              const budgetClosed = sv.spread_vol_target_pct ?? 0;
              const budget = budgetMc ?? budgetClosed;
              const current = sv.daily_spread_vol_pct ?? 0;
              const pstop = sv.p_stop_current_pct;
              const drift = sv.daily_spread_drift_pct;
              // Current vol above the zero-drift ceiling = "safe only because of drift"
              const driftDependent = budgetMc != null && current > budgetClosed;
              // P(stop) primary, then drift-dependence as a yellow warning override
              const color =
                pstop == null ? "text-gray-300" :
                pstop >= 10 ? "text-red-400" :
                pstop >= 5 ? "text-yellow-400" :
                driftDependent ? "text-yellow-400" : "text-green-400";
              return (
                <>
                  <div className={cn("text-lg font-bold mt-1", color)}>
                    {budget.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Current {current.toFixed(2)}% | P(stop) {pstop != null ? `${pstop.toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    Ceiling, not a target. 1y MC @ {risk.gross_pct.toFixed(0)}% gross, drift {drift != null ? `${drift.toFixed(3)}%/d` : "—"}, elastic trim
                  </div>
                  {budgetMc != null && (
                    <div className={cn("text-[9px] mt-0.5", driftDependent ? "text-yellow-500" : "text-gray-700")}>
                      Zero-drift ref: {budgetClosed.toFixed(2)}%{driftDependent ? " — current above this, headroom relies on drift" : ""}
                    </div>
                  )}
                </>
              );
            })()}
          </Card>

          <Card>
            <CardTitle>Vol Regime</CardTitle>
            <div className={cn(
              "text-lg font-bold mt-1",
              risk.spread_vol.vol_regime === "ELEVATED" ? "text-red-400" :
              risk.spread_vol.vol_regime === "NORMAL" ? "text-yellow-400" : "text-green-400"
            )}>
              {risk.spread_vol.vol_regime}
            </div>
            <div className="text-[10px] text-gray-600 mt-1">
              &gt;3% elevated | 2-3% normal | &lt;2% low
            </div>
          </Card>

          <Card>
            <CardTitle>L/S Correlation</CardTitle>
            <div className={cn(
              "text-lg font-bold mt-1",
              (risk.spread_vol.ls_correlation_30d ?? 0) >= 0.8 ? "text-green-400" :
              (risk.spread_vol.ls_correlation_30d ?? 0) >= 0.6 ? "text-yellow-400" : "text-red-400"
            )}>
              {risk.spread_vol.ls_correlation_30d?.toFixed(3)}
            </div>
            <div className="text-[10px] text-gray-600 mt-1">
              30d rolling | Dropping = rising vol
            </div>
          </Card>

          <Card>
            <CardTitle>Spread Sharpe</CardTitle>
            {(() => {
              const vol = risk.spread_vol.annual_spread_vol_pct;
              const period30 = (portfolio.ls_spread as any)?.periods?.["30d"];
              const cum30Pct = period30?.spread_pct ?? null;
              const days30 = period30?.days ?? 30;
              const dailyMean = cum30Pct != null && days30 > 0 ? cum30Pct / days30 : 0;
              const sharpe = vol && vol > 0 ? (dailyMean * 365 / vol) : 0;
              return (
                <>
                  <div className={cn(
                    "text-lg font-bold mt-1",
                    sharpe > 1 ? "text-green-400" : sharpe > 0 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {sharpe.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1">
                    Annualized (30d rolling)
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      )}

      {/* Unrealized P&L */}
      {positions && positions.length > 0 && (() => {
        const longUpnl = positions.filter(p => p.side === "LONG").reduce((s, p) => s + (p.pnl_usd || 0), 0);
        const shortUpnl = positions.filter(p => p.side === "SHORT").reduce((s, p) => s + (p.pnl_usd || 0), 0);
        const netUpnl = longUpnl + shortUpnl;
        const longWin = positions.filter(p => p.side === "LONG" && p.pnl_usd > 0).length;
        const shortWin = positions.filter(p => p.side === "SHORT" && p.pnl_usd > 0).length;
        const nLongs = positions.filter(p => p.side === "LONG").length;
        const nShorts = positions.filter(p => p.side === "SHORT").length;
        const netColor = netUpnl >= 0 ? "text-green-400" : "text-red-400";
        const longColor = longUpnl >= 0 ? "text-green-400" : "text-red-400";
        const shortColor = shortUpnl >= 0 ? "text-green-400" : "text-red-400";
        return (
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Unrealized P&L</CardTitle>
              <span className={`text-lg font-bold ${netColor}`}>{formatUSD(netUpnl)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Longs ({longWin}/{nLongs} winning)</div>
                <div className={`text-sm font-semibold ${longColor}`}>{formatUSD(longUpnl)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Shorts ({shortWin}/{nShorts} winning)</div>
                <div className={`text-sm font-semibold ${shortColor}`}>{formatUSD(shortUpnl)}</div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* NT Dual View + Compliance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Our Calculation vs Nickel's View */}
        {ntRisk && (
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-gray-400 mb-2">Our Calculation</div>
                <DualRow label="NAV / Equity" value={formatUSD(portfolio.nav)} />
                <DualRow label="HWM" value={formatUSD(risk.hwm)} />
                <DualRow label="Drawdown" value={`${risk.dd_pct.toFixed(2)}%`} />
                <DualRow label="Gross Exposure" value={formatPct(risk.gross_pct)} />
                <DualRow label="Net Exposure" value={formatPct(risk.net_pct)} />
                <DualRow label="Total Return" value={formatPct(portfolio.total_return_pct)} />
              </div>
              <div>
                <div className="text-xs font-medium text-blue-400 mb-2">Nickel's View</div>
                <DualRow label="NAV / Equity" value={formatUSD(Number(ntRisk.equity ?? 0))} />
                <DualRow label="HWM" value={formatUSD(Number(ntRisk.risk_hwm ?? 0))} />
                <DualRow label="Drawdown" value={`${Number(ntRisk.dd_from_hwm_pct ?? 0).toFixed(2)}%`} />
                <DualRow label="Gross Exposure" value={formatPct(Number(ntRisk.gross_exposure_pct ?? 0) * 100)} />
                <DualRow label="Net Exposure" value={formatPct(Number(ntRisk.net_exposure_pct ?? 0) * 100)} />
                <DualRow label="Total Return" value={formatPct(Number(ntRisk.total_return_pct ?? 0))} />
              </div>
            </div>
          </Card>
        )}

        {/* Compliance */}
        <Card>
          <CardTitle>Compliance</CardTitle>
          <div className="mt-2 space-y-2">
            <ComplianceRow
              label="Max DD"
              current={`${((risk as any).nt_dd_pct ?? risk.dd_pct).toFixed(2)}% (${formatUSD(((risk as any).nt_dd_pct ?? risk.dd_pct) / 100 * (Number(ntRisk?.notional ?? 100000)))})`}
              limit={`${risk.limits.dd_stop_pct}% (${formatUSD((Number(ntRisk?.notional ?? 100000)) * risk.limits.dd_stop_pct / 100)})`}
              ok={risk.compliance.max_dd_ok}
            />
            <ComplianceRow
              label="Gross"
              current={formatPct(risk.gross_pct)}
              limit={`${risk.limits.max_leverage_pct}%`}
              ok={risk.compliance.gross_ok}
            />
            <ComplianceRow
              label="Net"
              current={formatPct(risk.net_pct)}
              limit={`±${risk.limits.max_net_pct}%`}
              ok={risk.compliance.net_ok}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function DualRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}

function ComplianceRow({
  label,
  current,
  limit,
  ok,
}: {
  label: string;
  current: string;
  limit: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">{label}:</span>
      <div className="flex items-center gap-2">
        <span className="text-gray-300">{current} / {limit}</span>
        <span className={ok ? "text-green-400" : "text-red-400"}>
          {ok ? "OK" : "BREACH"}
        </span>
      </div>
    </div>
  );
}
