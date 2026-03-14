import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { PnlText } from "../shared/PnlText";
import { Badge } from "../ui/Badge";
import { formatUSD, formatPct } from "../../lib/utils";
import type { Position } from "../../types/api";

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
      <Badge variant={r.side === "LONG" ? "success" : "danger"}>{r.side}</Badge>
    ),
    sortKey: (r) => r.side,
  },
  {
    key: "entry_price",
    header: "Entry",
    render: (r) => `$${r.entry_price.toFixed(r.entry_price < 1 ? 6 : 2)}`,
    sortKey: (r) => r.entry_price,
    align: "right",
  },
  {
    key: "current_price",
    header: "Mark",
    render: (r) => `$${r.current_price.toFixed(r.current_price < 1 ? 6 : 2)}`,
    sortKey: (r) => r.current_price,
    align: "right",
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
    header: "Hold",
    render: (r) => `${r.hours_held.toFixed(0)}h`,
    sortKey: (r) => r.hours_held,
    align: "right",
  },
  {
    key: "tp_pct",
    header: "TP",
    render: (r) => (r.tp_pct != null ? formatPct(r.tp_pct) : "—"),
    align: "right",
  },
  {
    key: "sl_pct",
    header: "SL",
    render: (r) => (r.sl_pct != null ? formatPct(r.sl_pct) : "—"),
    align: "right",
  },
  {
    key: "daily_vol",
    header: "Vol",
    render: (r) =>
      r.daily_vol_pct != null ? `${(r.daily_vol_pct * 100).toFixed(1)}%` : "—",
    sortKey: (r) => r.daily_vol_pct ?? 0,
    align: "right",
  },
  {
    key: "volume_rank",
    header: "Vol Rank",
    render: (r) => (r.volume_rank != null ? `#${r.volume_rank}` : "—"),
    sortKey: (r) => r.volume_rank ?? 999,
    align: "right",
  },
];

export function PositionsTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery({
    queryKey: ["positions", engine.id],
    queryFn: () =>
      client.get<{ positions: Position[]; count: number }>("/api/positions"),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Loading />;

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Positions ({data?.count ?? 0})</CardTitle>
          </div>
        </CardHeader>
        <DataTable
          columns={columns}
          data={data?.positions ?? []}
          defaultSort="pnl_usd"
          defaultDir="desc"
        />
      </Card>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
      Loading positions...
    </div>
  );
}
