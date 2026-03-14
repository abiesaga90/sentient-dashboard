import { Card, CardTitle } from "../ui/Card";
import { formatUSD, formatPct, cn } from "../../lib/utils";
import type { Portfolio, RiskData } from "../../types/api";

interface KpiRowProps {
  portfolio: Portfolio;
  risk: RiskData;
  ntRisk?: Record<string, unknown>;
}

export function KpiRow({ portfolio, risk, ntRisk }: KpiRowProps) {
  return (
    <div className="space-y-3">
      {/* Main KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

        {/* Drawdown */}
        <Card>
          <CardTitle>Drawdown</CardTitle>
          <div className={cn(
            "text-xl font-bold mt-1",
            risk.dd_pct > 5 ? "text-red-400" : risk.dd_pct > 3 ? "text-yellow-400" : "text-green-400"
          )}>
            {risk.dd_pct.toFixed(2)}% ({formatUSD(risk.hwm - portfolio.nav)})
          </div>
          <div className="text-[10px] text-gray-600 mt-1 space-y-0.5">
            <div>HWM: {formatUSD(risk.hwm)}</div>
            <div>Stop: {risk.limits.dd_stop_pct}% ({formatUSD(portfolio.starting_capital * risk.limits.dd_stop_pct / 100)})</div>
            <div>Scale: {(risk.effective_scale * 100).toFixed(1)}%</div>
          </div>
        </Card>

        {/* Exposure */}
        <Card>
          <CardTitle>Exposure</CardTitle>
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
          </div>
          <div className="text-[10px] text-gray-600 mt-1">
            Target: {formatPct(risk.target_beta_tilt_pct)}
          </div>
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
                <DualRow label="Gross Exposure" value={formatPct(Number(ntRisk.gross_pct_equity ?? 0))} />
                <DualRow label="Net Exposure" value={formatPct(Number(ntRisk.net_pct_equity ?? 0))} />
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
              current={`${risk.dd_pct.toFixed(2)}% (${formatUSD(risk.hwm - portfolio.nav)})`}
              limit={`${risk.limits.dd_stop_pct}% (${formatUSD(portfolio.starting_capital * risk.limits.dd_stop_pct / 100)})`}
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
