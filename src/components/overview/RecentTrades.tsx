import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { PnlText } from "../shared/PnlText";
import { formatUSD, timeAgo } from "../../lib/utils";
import type { Trade } from "../../types/api";

type SortKey = "timestamp" | "symbol" | "action" | "side" | "reason" | "notional" | "pnl";
type SortDir = "asc" | "desc";

interface RecentTradesProps {
  trades: Trade[];
}

const DEFAULT_ROWS = 10;
const EXPANDED_ROWS = 50;

export function RecentTrades({ trades }: RecentTradesProps) {
  const [expanded, setExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir(key === "timestamp" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...trades];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "timestamp":
          cmp = a.timestamp.localeCompare(b.timestamp);
          break;
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "action":
          cmp = a.action.localeCompare(b.action);
          break;
        case "side":
          cmp = a.side.localeCompare(b.side);
          break;
        case "reason":
          cmp = (a.reason || "").localeCompare(b.reason || "");
          break;
        case "notional":
          cmp = (a.notional || 0) - (b.notional || 0);
          break;
        case "pnl":
          cmp = (a.pnl || 0) - (b.pnl || 0);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [trades, sortKey, sortDir]);

  const limit = expanded ? EXPANDED_ROWS : DEFAULT_ROWS;
  const visible = sorted.slice(0, limit);

  if (!trades.length) return null;

  const SortHeader = ({ label, field, align = "left" }: { label: string; field: SortKey; align?: "left" | "right" }) => (
    <th
      className={`px-2 py-1 text-gray-500 cursor-pointer hover:text-gray-300 select-none ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => handleSort(field)}
    >
      {label}
      {sortKey === field && (
        <span className="ml-0.5 text-[10px]">{sortDir === "desc" ? "\u25BC" : "\u25B2"}</span>
      )}
    </th>
  );

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Recent Trades</CardTitle>
        <span className="text-[10px] text-gray-500">{trades.length} total</span>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <SortHeader label="Time" field="timestamp" />
              <SortHeader label="Symbol" field="symbol" />
              <SortHeader label="Action" field="action" />
              <SortHeader label="Side" field="side" />
              <SortHeader label="Reason" field="reason" />
              <SortHeader label="Notional" field="notional" align="right" />
              <SortHeader label="P&L" field="pnl" align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {visible.map((t, i) => (
              <tr key={`${t.timestamp}-${t.symbol}-${i}`} className="hover:bg-[var(--bg-card-hover)]">
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">
                  {timeAgo(t.timestamp)}
                </td>
                <td className="px-2 py-1.5 text-gray-200 font-medium">
                  {t.symbol.replace("USDT", "")}
                </td>
                <td className="px-2 py-1.5">
                  <span className={
                    t.action === "OPEN" ? "text-blue-400" :
                    t.action === "CLOSE" ? "text-orange-400" :
                    t.action === "TRIM" ? "text-yellow-400" :
                    t.action === "EXPAND" ? "text-cyan-400" :
                    "text-gray-400"
                  }>
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
                  {t.reason?.replace(/_/g, " ") || "\u2014"}
                </td>
                <td className="px-2 py-1.5 text-right text-gray-300">
                  {formatUSD(t.notional)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {t.action === "OPEN" || t.action === "EXPAND" ? "\u2014" : <PnlText value={t.pnl} className="text-xs" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trades.length > DEFAULT_ROWS && (
        <div className="px-2 py-1.5 text-center border-t border-[var(--border)]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-blue-400 hover:text-blue-300"
          >
            {expanded ? `Show less` : `Show more (${Math.min(trades.length, EXPANDED_ROWS)} of ${trades.length})`}
          </button>
        </div>
      )}
    </Card>
  );
}
