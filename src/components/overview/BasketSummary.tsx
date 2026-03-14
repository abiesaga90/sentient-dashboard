import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { PnlText } from "../shared/PnlText";
import { formatUSD, formatPct } from "../../lib/utils";
import type { BasketComparison } from "../../types/api";

const PERIODS = ["daily", "weekly", "mtd", "qtd", "ytd", "all"] as const;
type Period = (typeof PERIODS)[number];

interface BasketSummaryProps {
  basket: BasketComparison;
}

export function BasketSummary({ basket: defaultBasket }: BasketSummaryProps) {
  const [period, setPeriod] = useState<Period>("all");
  const { client, engine } = useEngine();

  const { data: periodBasket } = useQuery<BasketComparison>({
    queryKey: ["basket-comparison", engine.id, period],
    queryFn: () => client.get("/api/basket_comparison", { period }),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: period !== "all",
  });

  const basket = period === "all" ? defaultBasket : (periodBasket ?? defaultBasket);
  const { long_basket, short_basket, comparison } = basket;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Basket Comparison</CardTitle>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wider transition-colors ${
                  period === p
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-500 hover:text-gray-300 border border-transparent"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
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
      {/* Period summary */}
      {basket.period_summary && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-gray-500">Beta Gap</span>
            <div className="text-gray-200 font-medium">{comparison.beta_gap.toFixed(3)}</div>
          </div>
          <div>
            <span className="text-gray-500">Long Realized P&L</span>
            <PnlText value={basket.period_summary.long_realized_pnl} className="text-xs" />
          </div>
          <div>
            <span className="text-gray-500">Short Realized P&L</span>
            <PnlText value={basket.period_summary.short_realized_pnl} className="text-xs" />
          </div>
          <div>
            <span className="text-gray-500">Net Realized P&L</span>
            <PnlText value={basket.period_summary.net_realized_pnl} className="text-xs" />
          </div>
        </div>
      )}
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
