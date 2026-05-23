import type { TokenizedRow } from "../../../hooks/useTokenizedAssets";
import { DataTable, type Column } from "../../shared/DataTable";
import { SaaBadge } from "./SaaBadge";
import { fmtUsd, fmtPrice, fmtPct, fmtNum, pctColor, fundingColor } from "./format";

interface Props {
  rows: TokenizedRow[];
}

export function EtfsSubTab({ rows }: Props) {
  const cols: Column<TokenizedRow>[] = [
    {
      key: "symbol",
      header: "Symbol",
      align: "left",
      sortKey: (r) => r.symbol,
      render: (r) => <span className="font-mono text-xs text-gray-200">{r.symbol.replace("USDT", "")}</span>,
    },
    {
      key: "label",
      header: "Name",
      align: "left",
      sortKey: (r) => r.label,
      render: (r) => <span className="text-xs text-gray-400">{r.label}</span>,
    },
    {
      key: "mark",
      header: "Mark",
      align: "right",
      sortKey: (r) => r.binance.mark_price ?? -Infinity,
      render: (r) => <span className="font-mono text-xs">{fmtPrice(r.binance.mark_price)}</span>,
    },
    {
      key: "24h",
      header: "24h Δ",
      align: "right",
      sortKey: (r) => r.binance.change_24h_pct ?? -Infinity,
      render: (r) => (
        <span className={`font-mono text-xs ${pctColor(r.binance.change_24h_pct)}`}>
          {fmtPct(r.binance.change_24h_pct, 2)}
        </span>
      ),
    },
    {
      key: "funding",
      header: "Funding APR (7d)",
      align: "right",
      sortKey: (r) => r.binance.funding_7d_apr_pct ?? -Infinity,
      render: (r) => (
        <span className={`font-mono text-xs ${fundingColor(r.binance.funding_7d_apr_pct)}`}>
          {fmtPct(r.binance.funding_7d_apr_pct, 2)}
        </span>
      ),
    },
    {
      key: "oi",
      header: "OI",
      align: "right",
      sortKey: (r) => r.binance.open_interest_usd ?? 0,
      render: (r) => <span className="font-mono text-xs">{fmtUsd(r.binance.open_interest_usd)}</span>,
    },
    {
      key: "vol",
      header: "Vol 24h",
      align: "right",
      sortKey: (r) => r.binance.vol_24h_usd ?? 0,
      render: (r) => <span className="font-mono text-xs">{fmtUsd(r.binance.vol_24h_usd)}</span>,
    },
    {
      key: "aum",
      header: "AUM",
      align: "right",
      sortKey: (r) => r.fundamentals.total_assets_usd ?? 0,
      render: (r) => <span className="font-mono text-xs">{fmtUsd(r.fundamentals.total_assets_usd)}</span>,
    },
    {
      key: "expense",
      header: "Expense",
      align: "right",
      sortKey: (r) => r.fundamentals.expense_ratio ?? Infinity,
      render: (r) => (
        <span className="font-mono text-xs">
          {r.fundamentals.expense_ratio != null
            ? `${(r.fundamentals.expense_ratio * 100).toFixed(2)}%`
            : "—"}
        </span>
      ),
    },
    {
      key: "nav",
      header: "NAV",
      align: "right",
      sortKey: (r) => r.fundamentals.nav_price ?? -Infinity,
      render: (r) => <span className="font-mono text-xs">{fmtPrice(r.fundamentals.nav_price)}</span>,
    },
    {
      key: "52w",
      header: "52w Range",
      align: "right",
      sortKey: (r) => r.fundamentals["52w_low"] ?? -Infinity,
      render: (r) => (
        <span className="font-mono text-xs text-gray-400">
          {fmtNum(r.fundamentals["52w_low"], 0)} – {fmtNum(r.fundamentals["52w_high"], 0)}
        </span>
      ),
    },
    {
      key: "lev",
      header: "Max Lev",
      align: "right",
      sortKey: (r) => r.binance.max_leverage ?? 0,
      render: (r) => (
        <span className="font-mono text-xs text-gray-400">
          {r.binance.max_leverage ? `${r.binance.max_leverage}×` : "—"}
        </span>
      ),
    },
    {
      key: "saa",
      header: "SAA 13F",
      align: "left",
      sortKey: (r) => r.saa_position?.value_usd ?? 0,
      render: (r) => <SaaBadge position={r.saa_position} />,
    },
  ];

  return <DataTable columns={cols} data={rows} defaultSort="oi" defaultDir="desc" />;
}
