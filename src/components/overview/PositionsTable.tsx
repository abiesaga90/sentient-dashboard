import { DataTable, type Column } from "../shared/DataTable";
import { PnlText } from "../shared/PnlText";
import { Badge } from "../ui/Badge";
import { formatUSD } from "../../lib/utils";
import type { Position } from "../../types/api";

interface PositionsTableProps {
  positions: Position[];
}

const columns: Column<Position>[] = [
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => (
      <span className="font-medium text-gray-200">
        {r.symbol.replace("USDT", "")}
      </span>
    ),
    sortKey: (r) => r.symbol,
  },
  {
    key: "side",
    header: "Side",
    render: (r) => (
      <Badge variant={r.side === "LONG" ? "success" : "danger"}>
        {r.side}
      </Badge>
    ),
    sortKey: (r) => r.side,
  },
  {
    key: "notional",
    header: "Notional",
    render: (r) => formatUSD(r.notional),
    sortKey: (r) => r.notional,
    align: "right",
  },
  {
    key: "pnl_pct",
    header: "P&L %",
    render: (r) => <PnlText value={r.pnl_pct} format="pct" />,
    sortKey: (r) => r.pnl_pct,
    align: "right",
  },
  {
    key: "pnl_usd",
    header: "P&L $",
    render: (r) => <PnlText value={r.pnl_usd} />,
    sortKey: (r) => r.pnl_usd,
    align: "right",
  },
  {
    key: "hours_held",
    header: "Hours",
    render: (r) => `${r.hours_held.toFixed(0)}h`,
    sortKey: (r) => r.hours_held,
    align: "right",
  },
  {
    key: "rsi_daily",
    header: "RSI 1D",
    render: (r) => {
      if (r.rsi_daily == null) return <span className="text-gray-500">—</span>;
      const color =
        r.rsi_daily <= 30
          ? "text-green-400"
          : r.rsi_daily >= 70
            ? "text-red-400"
            : "text-gray-300";
      return <span className={color}>{r.rsi_daily.toFixed(1)}</span>;
    },
    sortKey: (r) => r.rsi_daily ?? 50,
    align: "right",
  },
  {
    key: "rsi_weekly",
    header: "RSI 1W",
    render: (r) => {
      if (r.rsi_weekly == null) return <span className="text-gray-500">—</span>;
      const color =
        r.rsi_weekly <= 30
          ? "text-green-400"
          : r.rsi_weekly >= 70
            ? "text-red-400"
            : "text-gray-300";
      return <span className={color}>{r.rsi_weekly.toFixed(1)}</span>;
    },
    sortKey: (r) => r.rsi_weekly ?? 50,
    align: "right",
  },
];

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={positions}
      defaultSort="pnl_usd"
      defaultDir="desc"
      maxHeight="max-h-[500px]"
    />
  );
}
