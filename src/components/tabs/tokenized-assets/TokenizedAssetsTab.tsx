import { useMemo, useState } from "react";
import { useTokenizedAssets, type AssetClass } from "../../../hooks/useTokenizedAssets";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { KpiCard } from "../../shared/KpiCard";
import { StocksSubTab } from "./StocksSubTab";
import { EtfsSubTab } from "./EtfsSubTab";
import { MetalsSubTab } from "./MetalsSubTab";
import { CommoditiesSubTab } from "./CommoditiesSubTab";
import { PairIdeasSubTab } from "./PairIdeasSubTab";
import { TriplesSubTab } from "./TriplesSubTab";
import { BacktestSubTab } from "./BacktestSubTab";
import { fmtUsd, fmtPct } from "./format";

type SubTabId = AssetClass | "pairs" | "triples" | "backtest";

const SUBTABS: { id: SubTabId; label: string }[] = [
  { id: "triples", label: "1L : 2S Triples" },
  { id: "pairs", label: "Pair Ideas" },
  { id: "backtest", label: "Backtest" },
  { id: "stock", label: "Single Stocks" },
  { id: "etf", label: "ETFs" },
  { id: "metal", label: "Metals" },
  { id: "commodity", label: "Commodities" },
];

export function TokenizedAssetsTab() {
  const [active, setActive] = useState<SubTabId>("pairs");
  const { data, isLoading, error } = useTokenizedAssets();

  const rows = useMemo(() => {
    if (active === "pairs" || active === "triples" || active === "backtest") return [];
    return (data?.rows ?? []).filter((r) => r.asset_class === active);
  }, [data, active]);

  const headerKpis = useMemo(() => {
    const all = data?.rows ?? [];
    const totalOi = all.reduce((s, r) => s + (r.binance.open_interest_usd ?? 0), 0);
    const totalVol = all.reduce((s, r) => s + (r.binance.vol_24h_usd ?? 0), 0);
    const highestFunding = all.reduce(
      (best: { sym: string; apr: number } | null, r) => {
        const apr = r.binance.funding_7d_apr_pct;
        if (apr == null) return best;
        if (!best || apr > best.apr) return { sym: r.symbol.replace("USDT", ""), apr };
        return best;
      },
      null,
    );
    const biggestMover = all.reduce(
      (best: { sym: string; pct: number } | null, r) => {
        const pct = r.binance.change_24h_pct;
        if (pct == null) return best;
        if (!best || Math.abs(pct) > Math.abs(best.pct))
          return { sym: r.symbol.replace("USDT", ""), pct };
        return best;
      },
      null,
    );
    return { totalOi, totalVol, highestFunding, biggestMover };
  }, [data]);

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-sm text-red-400">
            Failed to load tokenized assets: {String((error as Error).message)}
          </div>
        </Card>
      </div>
    );
  }

  const isStale = (iso?: string | null): string => {
    if (!iso) return "never";
    const age = (Date.now() - new Date(iso).getTime()) / 1000;
    if (age < 90) return `${Math.round(age)}s ago`;
    if (age < 3600) return `${Math.round(age / 60)}m ago`;
    if (age < 86400) return `${Math.round(age / 3600)}h ago`;
    return `${Math.round(age / 86400)}d ago`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Tokenized Assets</h2>
        <p className="text-xs text-gray-500 mt-1">
          Binance USDT-M tokenized perps · {data?.universe_size ?? "—"} contracts on the Nickel PM
          sub-account · stocks/ETFs 20× max, metals/commodities 75–100×. Research-only.
        </p>
        <div className="flex gap-3 mt-2 text-[10px] text-gray-600">
          <span>Live: {isStale(data?.live_updated_at)}</span>
          <span>Fundamentals: {isStale(data?.fundamentals_updated_at)}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Open Interest" value={fmtUsd(headerKpis.totalOi)} />
        <KpiCard label="Total 24h Volume" value={fmtUsd(headerKpis.totalVol)} />
        <KpiCard
          label="Highest Funding (7d APR)"
          value={
            headerKpis.highestFunding
              ? fmtPct(headerKpis.highestFunding.apr, 1)
              : "—"
          }
          sub={headerKpis.highestFunding?.sym}
        />
        <KpiCard
          label="Biggest 24h Mover"
          value={headerKpis.biggestMover ? fmtPct(headerKpis.biggestMover.pct, 2) : "—"}
          sub={headerKpis.biggestMover?.sym}
        />
      </div>

      {/* SAA banner */}
      {data?.saa_summary && data.saa_summary.n_positions != null && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>Situational Awareness LP · 13F overlay</CardTitle>
              <Badge variant="info" className="text-[10px]">Leopold Aschenbrenner</Badge>
            </div>
          </CardHeader>
          <div className="text-xs text-gray-400 leading-relaxed">
            Filing period{" "}
            <span className="text-gray-200 font-mono">
              {data.saa_summary.period ?? "—"}
            </span>{" "}
            · {data.saa_summary.n_positions} reported positions · AUM disclosed{" "}
            <span className="text-gray-200 font-mono">
              {fmtUsd(data.saa_summary.total_value_usd)}
            </span>
            {" · "}
            <a
              href="https://unusualwhales.com/institutions/situational-awareness-lp"
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-400 hover:underline"
            >
              Unusual Whales
            </a>
            {data.saa_summary.filing_url && (
              <>
                {" · "}
                <a
                  href={data.saa_summary.filing_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-blue-400 hover:underline"
                >
                  SEC primary doc
                </a>
              </>
            )}
          </div>
          <div className="text-[10px] text-gray-500 mt-2 italic">
            13F discloses long-equity + put options only · no shorts, no commodity/metal/crypto ·
            ~45-day reporting lag. Use as a research lens, not a trading signal.
          </div>
        </Card>
      )}

      {/* Sub-tab nav */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              active === t.id
                ? "border-blue-500 text-gray-100"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] text-gray-600">
              {t.id === "backtest"
                ? ""
                : t.id === "triples"
                ? (data?.pairs?.triples?.length ?? 0)
                : t.id === "pairs"
                ? ((data?.pairs?.saa_anchored.length ?? 0) +
                    (data?.pairs?.generic.length ?? 0))
                : (data?.rows ?? []).filter((r) => r.asset_class === t.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Active sub-tab content */}
      {active === "triples" ? (
        <TriplesSubTab
          pairs={data?.pairs}
          cryptoBasket={data?.crypto_price_basket}
          aiBasket={data?.ai_capability_basket}
          tariffBasket={data?.tariff_intensity_basket}
        />
      ) : active === "pairs" ? (
        <PairIdeasSubTab pairs={data?.pairs} rows={data?.rows} />
      ) : active === "backtest" ? (
        <BacktestSubTab />
      ) : (
        <Card className="p-2">
          {isLoading ? (
            <div className="py-10 text-center text-xs text-gray-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500">No data yet.</div>
          ) : active === "stock" ? (
            <StocksSubTab rows={rows} />
          ) : active === "etf" ? (
            <EtfsSubTab rows={rows} />
          ) : active === "metal" ? (
            <MetalsSubTab rows={rows} />
          ) : (
            <CommoditiesSubTab rows={rows} />
          )}
        </Card>
      )}
    </div>
  );
}
