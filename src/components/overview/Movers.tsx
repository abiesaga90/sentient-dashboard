import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { PnlText } from "../shared/PnlText";
import { formatUSD } from "../../lib/utils";
import type { Position, PnlBySymbol } from "../../types/api";

interface MoversProps {
  positions: Position[];
  bySymbol?: PnlBySymbol[];
}

export function Movers({ positions, bySymbol }: MoversProps) {
  // Unrealized movers from positions
  const sortedByUnreal = [...positions].sort((a, b) => b.pnl_usd - a.pnl_usd);
  const bestUnreal = sortedByUnreal.filter((p) => p.pnl_usd > 0).slice(0, 3);
  const worstUnreal = sortedByUnreal.filter((p) => p.pnl_usd < 0).slice(-3).reverse();
  const totalWinnersUnreal = positions.filter((p) => p.pnl_usd > 0);
  const totalLosersUnreal = positions.filter((p) => p.pnl_usd < 0);

  // Realized movers from PnL by_symbol
  const realized = bySymbol?.filter((s) => s.trade_count > 0) ?? [];
  const sortedByReal = [...realized].sort((a, b) => b.realized_pnl - a.realized_pnl);
  const bestReal = sortedByReal.filter((s) => s.realized_pnl > 0).slice(0, 3);
  const worstReal = sortedByReal.filter((s) => s.realized_pnl < 0).slice(-3).reverse();
  const totalWinnersReal = realized.filter((s) => s.realized_pnl > 0);
  const totalLosersReal = realized.filter((s) => s.realized_pnl < 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Best Unrealized */}
      <MoverCard
        title="Best Movers (Unrealized)"
        items={bestUnreal.map((p) => ({
          symbol: p.symbol,
          side: p.side,
          value: p.pnl_usd,
          sub: `(${p.pnl_pct >= 0 ? "+" : ""}${p.pnl_pct.toFixed(1)}%)`,
        }))}
        totalLabel={`Total: ${formatSignedUSD(sum(totalWinnersUnreal, "pnl_usd"))}`}
        totalSub={`(${totalWinnersUnreal.length} winners)`}
        positive
      />

      {/* Best Realized */}
      <MoverCard
        title="Best Movers (Realized)"
        items={bestReal.map((s) => ({
          symbol: s.symbol,
          side: s.side,
          value: s.realized_pnl,
          sub: `${s.trade_count} trades`,
        }))}
        totalLabel={`Total: ${formatSignedUSD(sum(totalWinnersReal, "realized_pnl"))}`}
        totalSub={`(${totalWinnersReal.length} winners)`}
        positive
      />

      {/* Worst Unrealized */}
      <MoverCard
        title="Worst Movers (Unrealized)"
        items={worstUnreal.map((p) => ({
          symbol: p.symbol,
          side: p.side,
          value: p.pnl_usd,
          sub: `(${p.pnl_pct >= 0 ? "+" : ""}${p.pnl_pct.toFixed(1)}%)`,
        }))}
        totalLabel={`Total: ${formatSignedUSD(sum(totalLosersUnreal, "pnl_usd"))}`}
        totalSub={`(${totalLosersUnreal.length} losers)`}
        positive={false}
      />

      {/* Worst Realized */}
      <MoverCard
        title="Worst Movers (Realized)"
        items={worstReal.map((s) => ({
          symbol: s.symbol,
          side: s.side,
          value: s.realized_pnl,
          sub: `${s.trade_count} trades`,
        }))}
        totalLabel={`Total: ${formatSignedUSD(sum(totalLosersReal, "realized_pnl"))}`}
        totalSub={`(${totalLosersReal.length} losers)`}
        positive={false}
      />
    </div>
  );
}

interface MoverItem {
  symbol: string;
  side: string;
  value: number;
  sub: string;
}

function MoverCard({
  title,
  items,
  totalLabel,
  totalSub,
  positive,
}: {
  title: string;
  items: MoverItem[];
  totalLabel: string;
  totalSub: string;
  positive: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={`${item.symbol}-${item.side}`}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-200">
                {item.symbol.replace("USDT", "")}
              </span>
              <Badge
                variant={item.side === "LONG" ? "success" : "danger"}
                className="text-[10px]"
              >
                {item.side}
              </Badge>
            </div>
            <div className="text-right">
              <PnlText value={item.value} className="text-sm font-medium" />
              <div className="text-xs text-gray-500">{item.sub}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-xs text-gray-600">No data</div>
        )}
      </div>
      <div
        className={`mt-3 pt-2 border-t border-[var(--border)] text-xs ${
          positive ? "text-green-400" : "text-red-400"
        }`}
      >
        {totalLabel}{" "}
        <span className="text-gray-500">{totalSub}</span>
      </div>
    </Card>
  );
}

function formatSignedUSD(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatUSD(value)}`;
}

function sum<T>(arr: T[], key: keyof T): number {
  return arr.reduce((s, item) => s + (Number(item[key]) || 0), 0);
}
