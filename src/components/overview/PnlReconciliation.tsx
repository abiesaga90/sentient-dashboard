import { Card, CardHeader, CardTitle } from "../ui/Card";
import { PnlText } from "../shared/PnlText";
import type { PnlResponse } from "../../types/api";

interface PnlReconciliationProps {
  pnl: PnlResponse;
}

export function PnlReconciliation({ pnl }: PnlReconciliationProps) {
  const unrealized = pnl.all_time.unrealized_pnl;
  const realized = pnl.all_time.realized_pnl;
  const funding = pnl.all_time.funding_pnl;
  const exchange = pnl.all_time.exchange_income || {};
  const makerRebates = exchange.maker_rebates ?? 0;
  const takerFees = exchange.taker_fees ?? 0;
  const netCommission = makerRebates + takerFees;
  const totalPnl = unrealized + realized + funding + netCommission;
  const navPnl = pnl.all_time.total_return;
  const residual = navPnl - totalPnl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>P&L Reconciliation</CardTitle>
      </CardHeader>
      <div className="space-y-1 text-xs">
        <RecRow label="Unrealized P&L" value={unrealized} />
        <RecRow label="Realized P&L" value={realized} />
        <RecRow label="Funding P&L" value={funding} />
        {makerRebates !== 0 && <RecRow label="Maker Rebates" value={makerRebates} />}
        {takerFees !== 0 && <RecRow label="Taker Fees" value={takerFees} />}
        <RecRow label="Net Commission" value={netCommission} />
        <div className="border-t border-[var(--border)] pt-1 mt-1">
          <RecRow label="Total P&L" value={totalPnl} bold />
        </div>
        <RecRow label="NAV P&L" value={navPnl} bold />
        {Math.abs(residual) > 0.01 && (
          <RecRow label="Residual / Gap" value={residual} />
        )}
      </div>
    </Card>
  );
}

function RecRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? "font-medium" : ""}`}>
      <span className="text-gray-400">{label}</span>
      <PnlText value={value} className={bold ? "text-sm" : "text-xs"} />
    </div>
  );
}
