import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { ChartContainer } from "../../shared/ChartContainer";
import { useMacroBaskets } from "../../../hooks/useMacroRegime";
import { useEngine } from "../../../hooks/useEngine";

interface PMMacroMarket {
  slug: string;
  question: string;
  yes: number | null;
  delta_24h: number | null;
  delta_7d: number | null;
  volume_24h: number | null;
  volume_total: number | null;
  end_date: string | null;
  ts: string | null;
}

interface PMMacroResponse {
  markets: PMMacroMarket[];
  count: number;
  configured_slugs: string[];
  refresh_minutes: number;
  enabled: boolean;
}

/**
 * Generic per-basket drill-down. Today the four prediction-market baskets
 * (geopol / fed / political / recession) populate, plus the new
 * crypto_specific / tariff / fx_dxy when those graduate from weight 0.
 *
 * For each basket:
 *   • leg-level table with latest probability, volume, IC vs NAV-Sortino-30d
 *   • mean side-adjusted probability time-series
 */
const BASKET_LABELS: Record<string, string> = {
  geopol: "Geopol De-Escalation",
  fed: "Fed Dovishness",
  political: "Political Stability",
  recession: "Recession Risk",
  crypto_specific: "Crypto-Specific",
  tariff: "Tariff Intensity",
  fx_dxy: "FX / DXY",
};

export function BasketDrilldownSubTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useMacroBaskets(30);
  const { data: pmData } = useQuery<PMMacroResponse>({
    queryKey: ["pm-macro", engine.id],
    queryFn: () => client.get("/api/polymarket_macro"),
    refetchInterval: 300_000,
    staleTime: 120_000,
  });
  const [basketKey, setBasketKey] = useState<string>("geopol");

  const basket = data?.[basketKey];

  // Build the per-leg latest probabilities + time series.
  const { latestByMarket, timeseriesData, legIcByMarket } = useMemo(() => {
    if (!basket) {
      return { latestByMarket: {} as Record<string, any>, timeseriesData: [] as any[], legIcByMarket: {} as Record<string, any> };
    }
    const byMarket: Record<string, any[]> = {};
    for (const leg of basket.legs) {
      if (!leg.market_slug) continue;
      (byMarket[leg.market_slug] = byMarket[leg.market_slug] || []).push(leg);
    }
    const latest: Record<string, any> = {};
    for (const [slug, rows] of Object.entries(byMarket)) {
      const sorted = rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      latest[slug] = sorted[sorted.length - 1];
    }
    // mean side-adjusted prob per timestamp (used to chart basket trend)
    const tsBuckets: Record<string, { date: string; ts: string; sum: number; n: number }> = {};
    for (const leg of basket.legs) {
      if (leg.side_adjusted_prob == null) continue;
      const ts = leg.timestamp;
      if (!tsBuckets[ts]) tsBuckets[ts] = { date: ts.slice(5, 10), ts, sum: 0, n: 0 };
      tsBuckets[ts].sum += leg.side_adjusted_prob;
      tsBuckets[ts].n += 1;
    }
    const series = Object.values(tsBuckets)
      .filter((b) => b.n > 0)
      .map((b) => ({ date: b.date, ts: b.ts, mean_prob: (b.sum / b.n) * 100 }))
      .sort((a, b) => a.ts.localeCompare(b.ts));

    const ic: Record<string, any> = {};
    for (const row of basket.leg_ic || []) {
      ic[row.market_slug] = row;
    }
    return { latestByMarket: latest, timeseriesData: series, legIcByMarket: ic };
  }, [basket]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Loading basket drill-down...
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Basket drill-down</CardTitle>
            <div className="flex flex-wrap gap-1 text-xs">
              {Object.keys(BASKET_LABELS).map((k) => {
                const has = (data[k]?.legs?.length ?? 0) > 0;
                return (
                  <button
                    key={k}
                    disabled={!has}
                    onClick={() => setBasketKey(k)}
                    className={`px-2 py-1 rounded border ${
                      basketKey === k
                        ? "bg-purple-500/20 border-purple-500 text-purple-300"
                        : has
                        ? "border-[var(--border)] text-gray-300 hover:text-purple-300"
                        : "border-[var(--border)] text-gray-600 cursor-not-allowed"
                    }`}
                  >
                    {BASKET_LABELS[k]}
                    {has ? "" : " (∅)"}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Source</th>
                <th className="px-3 py-2 text-left text-gray-500">Market</th>
                <th className="px-3 py-2 text-center text-gray-500">Side</th>
                <th className="px-3 py-2 text-right text-gray-500">YES</th>
                <th className="px-3 py-2 text-right text-gray-500">Side-adj</th>
                <th className="px-3 py-2 text-right text-gray-500">Vol 24h</th>
                <th className="px-3 py-2 text-right text-gray-500">IC NAV-Sort 30d</th>
                <th className="px-3 py-2 text-left text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {Object.values(latestByMarket)
                .sort((a: any, b: any) =>
                  (b.volume_24h_usd ?? 0) - (a.volume_24h_usd ?? 0),
                )
                .map((leg: any) => {
                  const ic = legIcByMarket[leg.market_slug];
                  return (
                    <tr key={leg.market_slug ?? leg.event_slug} className={
                      leg.used ? "" : "opacity-50"
                    }>
                      <td className="px-3 py-2">
                        <Badge variant={leg.source === "kalshi" ? "info" : "default"}>
                          {leg.source}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-200 max-w-md truncate" title={leg.market_slug ?? leg.event_slug}>
                        {leg.market_slug ?? leg.event_slug}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-400">{leg.side}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">
                        {leg.prob_yes != null ? `${(leg.prob_yes * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">
                        {leg.side_adjusted_prob != null
                          ? `${(leg.side_adjusted_prob * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">
                        ${(leg.volume_24h_usd ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">
                        {ic?.ic_value != null ? (
                          <span className={ic.ic_value > 0 ? "text-green-400" : "text-red-400"}>
                            {ic.ic_value >= 0 ? "+" : ""}{ic.ic_value.toFixed(3)} (n={ic.n_observations ?? 0})
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {leg.used ? "active" : (
                          <span title={leg.skip_reason ?? ""}>skip</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {Object.keys(latestByMarket).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    No legs available for this basket yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {timeseriesData.length > 0 && (
        <ChartContainer
          title={`${BASKET_LABELS[basketKey]} · mean side-adjusted probability (last 30d)`}
          height={260}
        >
          <LineChart data={timeseriesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="mean_prob"
              name="mean prob (%)"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      )}

      {/* Polymarket Macro — crypto-specific markets (BTC ETF, halving, etc).
          Migrated from MarketContextTab on 2026-05-30; observational only. */}
      {pmData && pmData.markets.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Polymarket Macro · crypto-specific</CardTitle>
              <div className="text-[11px] text-gray-500">
                {pmData.count} markets · refresh {pmData.refresh_minutes}m · display only
              </div>
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
            {pmData.markets.map((m) => {
              const yes = m.yes != null ? m.yes : 0;
              const yesPct = (yes * 100).toFixed(yes < 0.05 || yes > 0.95 ? 2 : 1);
              const d24 = m.delta_24h;
              const d7 = m.delta_7d;
              const fmtDelta = (d: number | null) => {
                if (d == null) return "—";
                const pp = d * 100;
                const sign = pp >= 0 ? "+" : "";
                return `${sign}${pp.toFixed(1)}pp`;
              };
              const deltaColor = (d: number | null) => {
                if (d == null) return "text-gray-500";
                if (Math.abs(d) < 0.01) return "text-gray-400";
                return d > 0 ? "text-green-400" : "text-red-400";
              };
              return (
                <div
                  key={m.slug}
                  className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3 hover:bg-[var(--bg-card-hover)] transition"
                  title={m.slug}
                >
                  <div className="text-xs text-gray-300 leading-snug min-h-[2.5rem]">
                    {m.question}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-mono text-lg text-gray-100">{yesPct}%</span>
                    <span className="text-[10px] text-gray-500">YES</span>
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] font-mono">
                    <span className={deltaColor(d24)} title="24h change in YES probability">
                      24h {fmtDelta(d24)}
                    </span>
                    <span className={deltaColor(d7)} title="7d change in YES probability">
                      7d {fmtDelta(d7)}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                    <span>vol24h ${(m.volume_24h ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span>{m.end_date?.slice(0, 10) || ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-3 pb-3 text-[10px] text-gray-500">
            Source: Polymarket Gamma API · curated macro panel · Δ in absolute YES probability points (pp).
            Display only; not yet plumbed into composite or sizing.
          </div>
        </Card>
      )}
    </div>
  );
}
