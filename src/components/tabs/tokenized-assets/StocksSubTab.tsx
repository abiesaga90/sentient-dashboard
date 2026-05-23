import type { TokenizedRow } from "../../../hooks/useTokenizedAssets";
import { DataTable, type Column } from "../../shared/DataTable";
import { Badge } from "../../ui/Badge";
import { SaaBadge } from "./SaaBadge";
import { fmtUsd, fmtPrice, fmtPct, fmtNum, pctColor, fundingColor } from "./format";

interface Props {
  rows: TokenizedRow[];
}

export function StocksSubTab({ rows }: Props) {
  const cols: Column<TokenizedRow>[] = [
    {
      key: "symbol",
      header: "Symbol",
      align: "left",
      sortKey: (r) => r.symbol,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-200">{r.symbol.replace("USDT", "")}</span>
          {r.crypto_adjacent && (
            <Badge variant="info" className="text-[10px]">crypto</Badge>
          )}
        </div>
      ),
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
      key: "sector",
      header: "Sector",
      align: "left",
      sortKey: (r) => r.fundamentals.sector ?? "",
      render: (r) => (
        <span className="text-xs text-gray-400">{r.fundamentals.sector ?? "—"}</span>
      ),
    },
    {
      key: "mcap",
      header: "Mcap",
      align: "right",
      sortKey: (r) => r.fundamentals.market_cap_usd ?? 0,
      render: (r) => <span className="font-mono text-xs">{fmtUsd(r.fundamentals.market_cap_usd)}</span>,
    },
    {
      key: "pe",
      header: "P/E (T·F)",
      align: "right",
      sortKey: (r) => r.fundamentals.trailing_pe ?? Infinity,
      render: (r) => (
        <span className="font-mono text-xs text-gray-300">
          {fmtNum(r.fundamentals.trailing_pe, 1)} · {fmtNum(r.fundamentals.forward_pe, 1)}
        </span>
      ),
    },
    {
      key: "eps",
      header: "EPS",
      align: "right",
      sortKey: (r) => r.fundamentals.eps_ttm ?? -Infinity,
      render: (r) => <span className="font-mono text-xs">{fmtNum(r.fundamentals.eps_ttm, 2)}</span>,
    },
    {
      key: "beta",
      header: "β",
      align: "right",
      sortKey: (r) => r.fundamentals.beta ?? -Infinity,
      render: (r) => <span className="font-mono text-xs">{fmtNum(r.fundamentals.beta, 2)}</span>,
    },
    {
      key: "earnings",
      header: "Next Earn.",
      align: "right",
      sortKey: (r) => r.fundamentals.next_earnings ?? "",
      render: (r) => (
        <span className="text-xs text-gray-400">{r.fundamentals.next_earnings ?? "—"}</span>
      ),
    },
    {
      key: "rating",
      header: "Analyst",
      align: "left",
      sortKey: (r) => r.fundamentals.analyst_rating ?? "",
      render: (r) => (
        <span className="text-xs text-gray-400 capitalize">
          {r.fundamentals.analyst_rating ?? "—"}
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
