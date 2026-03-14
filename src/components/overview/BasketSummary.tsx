import { Card, CardHeader, CardTitle } from "../ui/Card";
import { PnlText } from "../shared/PnlText";
import { formatUSD, formatPct } from "../../lib/utils";
import type { BasketComparison } from "../../types/api";

interface BasketSummaryProps {
  basket: BasketComparison;
}

export function BasketSummary({ basket }: BasketSummaryProps) {
  const { long_basket, short_basket, comparison } = basket;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basket Comparison</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-2 gap-4">
        <BasketSide title="Longs" data={long_basket} color="text-green-400" />
        <BasketSide title="Shorts" data={short_basket} color="text-red-400" />
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-gray-500">Hedge Ratio</span>
          <div className="text-gray-200 font-medium">
            {formatPct(comparison.hedge_ratio_pct)}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Net Exposure</span>
          <div className="text-gray-200 font-medium">
            {formatUSD(comparison.net_exposure)}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Net Unreal. P&L</span>
          <PnlText value={comparison.net_unrealized_pnl} className="font-medium text-sm" />
        </div>
      </div>
    </Card>
  );
}

function BasketSide({
  title,
  data,
  color,
}: {
  title: string;
  data: BasketComparison["long_basket"];
  color: string;
}) {
  return (
    <div>
      <div className={`text-sm font-medium ${color} mb-2`}>{title}</div>
      <div className="space-y-1 text-xs">
        <Row label="Count" value={String(data.count)} />
        <Row label="Notional" value={formatUSD(data.total_notional)} />
        <Row label="Unreal. P&L">
          <PnlText value={data.unrealized_pnl} className="text-xs" />
        </Row>
        <Row label="Win Rate" value={formatPct(data.win_rate)} />
        <Row label="Avg Hold" value={`${data.weighted_avg_hold_hours.toFixed(0)}h`} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      {children || <span className="text-gray-300">{value}</span>}
    </div>
  );
}
