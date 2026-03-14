import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { PnlText } from "../shared/PnlText";
import { formatUSD, timeAgo } from "../../lib/utils";
import type { Trade } from "../../types/api";

interface RecentTradesProps {
  trades: Trade[];
}

export function RecentTrades({ trades }: RecentTradesProps) {
  const recent = trades.slice(0, 10);
  if (!recent.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Trades</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="px-2 py-1 text-left text-gray-500">Time</th>
              <th className="px-2 py-1 text-left text-gray-500">Symbol</th>
              <th className="px-2 py-1 text-left text-gray-500">Action</th>
              <th className="px-2 py-1 text-left text-gray-500">Side</th>
              <th className="px-2 py-1 text-left text-gray-500">Reason</th>
              <th className="px-2 py-1 text-right text-gray-500">Notional</th>
              <th className="px-2 py-1 text-right text-gray-500">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {recent.map((t) => (
              <tr key={t.id} className="hover:bg-[var(--bg-card-hover)]">
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">
                  {timeAgo(t.timestamp)}
                </td>
                <td className="px-2 py-1.5 text-gray-200 font-medium">
                  {t.symbol.replace("USDT", "")}
                </td>
                <td className="px-2 py-1.5">
                  <span className={t.action === "OPEN" ? "text-blue-400" : "text-gray-400"}>
                    {t.action}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <Badge
                    variant={t.side === "LONG" ? "success" : "danger"}
                    className="text-[10px]"
                  >
                    {t.side}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 text-gray-500 text-[10px]">
                  {t.reason?.replace(/_/g, " ") || "—"}
                </td>
                <td className="px-2 py-1.5 text-right text-gray-300">
                  {formatUSD(t.notional)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {t.pnl !== 0 ? <PnlText value={t.pnl} className="text-xs" /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
