import type { TokenizedRow } from "../../../hooks/useTokenizedAssets";
import { DataTable, type Column } from "../../shared/DataTable";
import { fmtUsd, fmtPrice, fmtPct, pctColor, fundingColor } from "./format";

interface Props {
  rows: TokenizedRow[];
}

export function CommoditiesSubTab({ rows }: Props) {
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
      key: "front",
      header: "Front-Month",
      align: "right",
      sortKey: (r) => r.fundamentals.front_month_usd ?? -Infinity,
      render: (r) => (
        <span className="font-mono text-xs text-gray-400">{fmtPrice(r.fundamentals.front_month_usd)}</span>
      ),
    },
    {
      key: "spread",
      header: "Mark vs Front",
      align: "right",
      sortKey: (r) => {
        const m = r.binance.mark_price;
        const f = r.fundamentals.front_month_usd;
        if (!m || !f) return 0;
        return (m / f - 1) * 100;
      },
      render: (r) => {
        const m = r.binance.mark_price;
        const f = r.fundamentals.front_month_usd;
        if (!m || !f) return <span className="text-xs text-gray-500">—</span>;
        const pct = (m / f - 1) * 100;
        return (
          <span className={`font-mono text-xs ${pctColor(pct)}`}>{fmtPct(pct, 2)}</span>
        );
      },
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
  ];

  return <DataTable columns={cols} data={rows} defaultSort="oi" defaultDir="desc" />;
}
