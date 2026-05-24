import type { PairIdea, Fundamentals, TokenizedRow } from "../../../hooks/useTokenizedAssets";

interface Props {
  p: PairIdea;
  long_row?: TokenizedRow;
  short_row?: TokenizedRow;
}

// Direction of "L favored" for each metric. For most metrics, higher L
// favors a long-L/short-S trade (more growth, more margin, more profit).
// For valuation multiples (PE / P/S / EV), LOWER L is favorable
// (long cheaper businesses, short expensive ones).
type Favor = "higher_L" | "lower_L" | "neutral";

interface Row {
  label: string;
  key: keyof Fundamentals;
  format: "pct" | "ratio" | "money" | "raw" | "growth_pct";
  favor: Favor;
  group?: string;
}

const ROWS: Row[] = [
  { label: "Market cap", key: "market_cap_usd", format: "money", favor: "neutral", group: "Identity" },
  { label: "Beta (AV, 5y monthly)", key: "beta", format: "ratio", favor: "neutral" },
  { label: "β vs SPY (our 2y daily)", key: "beta_vs_spy", format: "ratio", favor: "neutral" },
  { label: "R² vs SPY", key: "r2_vs_spy", format: "ratio", favor: "neutral" },
  { label: "β vs crypto long basket", key: "beta_vs_long_basket", format: "ratio", favor: "neutral" },
  { label: "R² vs basket", key: "r2_vs_long_basket", format: "ratio", favor: "neutral" },

  { label: "Revenue (TTM)", key: "revenue_ttm", format: "money", favor: "neutral", group: "Top line" },
  { label: "Revenue growth YoY", key: "revenue_growth_yoy", format: "growth_pct", favor: "higher_L" },

  { label: "Gross margin TTM", key: "gross_margin_ttm", format: "pct", favor: "higher_L", group: "Profitability" },
  { label: "Operating margin TTM", key: "operating_margin_ttm", format: "pct", favor: "higher_L" },
  { label: "Profit margin", key: "profit_margin", format: "pct", favor: "higher_L" },

  { label: "ROE TTM", key: "roe_ttm", format: "pct", favor: "higher_L", group: "Capital efficiency" },
  { label: "ROA TTM", key: "roa_ttm", format: "pct", favor: "higher_L" },

  { label: "EPS TTM (diluted)", key: "eps_diluted_ttm", format: "raw", favor: "higher_L", group: "Earnings" },
  { label: "EPS growth YoY", key: "eps_growth_yoy", format: "growth_pct", favor: "higher_L" },
  { label: "EPS estimate (next yr)", key: "eps_estimate_ny", format: "raw", favor: "higher_L" },

  { label: "Trailing P/E", key: "trailing_pe", format: "ratio", favor: "lower_L", group: "Valuation" },
  { label: "Forward P/E", key: "forward_pe", format: "ratio", favor: "lower_L" },
  { label: "Price / Sales TTM", key: "price_to_sales", format: "ratio", favor: "lower_L" },
  { label: "EV / Revenue", key: "ev_to_revenue", format: "ratio", favor: "lower_L" },
  { label: "EV / EBITDA", key: "ev_to_ebitda", format: "ratio", favor: "lower_L" },

  { label: "Analyst target (mean)", key: "analyst_target_mean", format: "raw", favor: "neutral", group: "Analyst view" },

  { label: "Dividend yield", key: "dividend_yield", format: "pct", favor: "neutral", group: "Other" },
];

function fmt(v: number | string | undefined | null, format: Row["format"]): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "string") return v;
  switch (format) {
    case "pct":
      // AV returns ratios as decimals (0.656 = 65.6%)
      return `${(v * 100).toFixed(1)}%`;
    case "growth_pct":
      return `${(v * 100).toFixed(1)}%`;
    case "ratio":
      return v.toFixed(2);
    case "money":
      if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
      if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
      if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
      return `$${v.toFixed(0)}`;
    case "raw":
      return v.toFixed(2);
  }
}

function favorColor(L: number | undefined, S: number | undefined, favor: Favor): string {
  if (L == null || S == null || favor === "neutral") return "text-gray-300";
  if (L === S) return "text-gray-300";
  const longBeats = favor === "higher_L" ? L > S : L < S;
  return longBeats ? "text-emerald-300" : "text-amber-300";
}

function diffString(L: number | undefined, S: number | undefined, format: Row["format"]): string {
  if (L == null || S == null) return "—";
  const d = L - S;
  if (Math.abs(d) < 1e-12) return "0";
  const prefix = d > 0 ? "+" : "";
  if (format === "pct" || format === "growth_pct") {
    return `${prefix}${(d * 100).toFixed(1)}pp`;
  }
  if (format === "ratio" || format === "raw") {
    return `${prefix}${d.toFixed(2)}`;
  }
  if (format === "money") {
    if (Math.abs(d) >= 1e12) return `${prefix}$${(d / 1e12).toFixed(2)}T`;
    if (Math.abs(d) >= 1e9) return `${prefix}$${(d / 1e9).toFixed(2)}B`;
    if (Math.abs(d) >= 1e6) return `${prefix}$${(d / 1e6).toFixed(1)}M`;
    return `${prefix}$${d.toFixed(0)}`;
  }
  return "—";
}

export function QualityCompareCard({ p, long_row, short_row }: Props) {
  const L = long_row?.fundamentals ?? ({} as Fundamentals);
  const S = short_row?.fundamentals ?? ({} as Fundamentals);
  const lTag = p.long_symbol.replace("USDT", "");
  const sTag = p.short_symbol.replace("USDT", "");

  // Group rows for visual sections
  const grouped: Array<{ group: string; rows: Row[] }> = [];
  let currentGroup: string | null = null;
  for (const r of ROWS) {
    if (r.group) {
      currentGroup = r.group;
      grouped.push({ group: currentGroup, rows: [r] });
    } else {
      if (grouped.length > 0) grouped[grouped.length - 1].rows.push(r);
    }
  }

  return (
    <div className="bg-slate-950/50 border border-[var(--border)] rounded-md p-3 mt-2 text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-gray-400">
          Fundamental side-by-side · L = <span className="text-emerald-400 font-mono">{lTag}</span> · S ={" "}
          <span className="text-red-400 font-mono">{sTag}</span>
        </div>
        {p.metrics.quality_score != null && (
          <div className="text-[11px] text-gray-400">
            Composite Quality Δ ={" "}
            <span className="font-mono text-gray-100">
              {p.metrics.quality_score >= 0 ? "+" : ""}
              {p.metrics.quality_score.toFixed(2)}
            </span>
            {" · "}
            <span className="text-gray-500">
              coverage {p.metrics.quality_score_coverage ?? 0}/6
            </span>
          </div>
        )}
      </div>

      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase tracking-wide">
            <th className="text-left py-1 pl-1 font-normal">Metric</th>
            <th className="text-right py-1 px-2 font-normal text-emerald-400/70">L · {lTag}</th>
            <th className="text-right py-1 px-2 font-normal text-red-400/70">S · {sTag}</th>
            <th className="text-right py-1 pr-1 font-normal">L − S</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((g, gi) => (
            <>
              <tr key={`g-${gi}`}>
                <td colSpan={4} className="pt-2 pb-0.5 text-[10px] text-gray-500 uppercase tracking-wide">
                  {g.group}
                </td>
              </tr>
              {g.rows.map((r) => {
                const lv = L[r.key] as number | undefined;
                const sv = S[r.key] as number | undefined;
                return (
                  <tr key={r.label} className="border-t border-slate-800/50">
                    <td className="py-1 pl-1 text-gray-400">{r.label}</td>
                    <td className={`py-1 px-2 text-right ${favorColor(lv, sv, r.favor)}`}>
                      {fmt(lv, r.format)}
                    </td>
                    <td className="py-1 px-2 text-right text-gray-300">{fmt(sv, r.format)}</td>
                    <td className={`py-1 pr-1 text-right ${favorColor(lv, sv, r.favor)}`}>
                      {diffString(lv, sv, r.format)}
                    </td>
                  </tr>
                );
              })}
            </>
          ))}

          {/* Earnings horizon row (D7) */}
          {(p.metrics.days_to_earnings_long != null || p.metrics.days_to_earnings_short != null) && (
            <>
              <tr>
                <td colSpan={4} className="pt-2 pb-0.5 text-[10px] text-gray-500 uppercase tracking-wide">
                  Catalysts
                </td>
              </tr>
              <tr className="border-t border-slate-800/50">
                <td className="py-1 pl-1 text-gray-400">Next earnings</td>
                <td className={`py-1 px-2 text-right ${p.metrics.days_to_earnings_long != null && p.metrics.days_to_earnings_long <= 7 ? "text-amber-300" : "text-gray-300"}`}>
                  {p.metrics.days_to_earnings_long != null
                    ? `${p.metrics.days_to_earnings_long}d (${p.metrics.next_earnings_long ?? "—"})`
                    : "—"}
                </td>
                <td className={`py-1 px-2 text-right ${p.metrics.days_to_earnings_short != null && p.metrics.days_to_earnings_short <= 7 ? "text-amber-300" : "text-gray-300"}`}>
                  {p.metrics.days_to_earnings_short != null
                    ? `${p.metrics.days_to_earnings_short}d (${p.metrics.next_earnings_short ?? "—"})`
                    : "—"}
                </td>
                <td className="py-1 pr-1 text-right text-gray-500">—</td>
              </tr>
            </>
          )}

          {/* Multi-13F crowdedness (F1) */}
          {(long_row?.multi_13f || short_row?.multi_13f) && (
            <>
              <tr>
                <td colSpan={4} className="pt-2 pb-0.5 text-[10px] text-gray-500 uppercase tracking-wide">
                  Multi-13F crowdedness (12 funds)
                </td>
              </tr>
              <tr className="border-t border-slate-800/50" title="Number of tracked funds holding this name LONG-dominant (vs holders with puts as net stance). High count = hedge-fund-hotel = exit liquidity risk when we are long.">
                <td className="py-1 pl-1 text-gray-400">Funds holding long</td>
                <td className={`py-1 px-2 text-right ${long_row?.multi_13f?.hedge_fund_hotel ? "text-amber-300" : "text-gray-300"}`}>
                  {long_row?.multi_13f
                    ? `${long_row.multi_13f.n_funds_long}/${long_row.multi_13f.n_funds_tracked} (${long_row.multi_13f.crowdedness_long_pct.toFixed(0)}%)`
                    : "—"}
                </td>
                <td className={`py-1 px-2 text-right ${short_row?.multi_13f?.hedge_fund_hotel ? "text-emerald-300" : "text-gray-300"}`} title="Short leg held long by many funds = squeeze risk on our short">
                  {short_row?.multi_13f
                    ? `${short_row.multi_13f.n_funds_long}/${short_row.multi_13f.n_funds_tracked} (${short_row.multi_13f.crowdedness_long_pct.toFixed(0)}%)`
                    : "—"}
                </td>
                <td className="py-1 pr-1 text-right text-gray-500">—</td>
              </tr>
              <tr className="border-t border-slate-800/50" title="Number of tracked funds holding puts as net stance (= other PMs are bearish via options).">
                <td className="py-1 pl-1 text-gray-400">Funds with puts</td>
                <td className={`py-1 px-2 text-right ${long_row?.multi_13f && long_row.multi_13f.n_funds_put > 0 ? "text-red-300" : "text-gray-300"}`} title="Our long leg with funds-bearish-via-puts = directional concern">
                  {long_row?.multi_13f
                    ? `${long_row.multi_13f.n_funds_put}/${long_row.multi_13f.n_funds_tracked} (${long_row.multi_13f.crowdedness_put_pct.toFixed(0)}%)`
                    : "—"}
                </td>
                <td className={`py-1 px-2 text-right ${short_row?.multi_13f?.squeeze_risk ? "text-amber-300" : "text-gray-300"}`} title="Our short leg with crowded put positioning = aligned with consensus but lots of cover-to-close demand">
                  {short_row?.multi_13f
                    ? `${short_row.multi_13f.n_funds_put}/${short_row.multi_13f.n_funds_tracked} (${short_row.multi_13f.crowdedness_put_pct.toFixed(0)}%)`
                    : "—"}
                </td>
                <td className="py-1 pr-1 text-right text-gray-500">—</td>
              </tr>
            </>
          )}

          {/* News sentiment (F3) */}
          {(L.sentiment_company_news_score != null || S.sentiment_company_news_score != null) && (
            <>
              <tr>
                <td colSpan={4} className="pt-2 pb-0.5 text-[10px] text-gray-500 uppercase tracking-wide">
                  News sentiment (last 7d)
                </td>
              </tr>
              <tr className="border-t border-slate-800/50" title="Finnhub company news score [0, 1]. 0.5 = neutral, >0.6 bullish, <0.4 bearish. Long leg with low score = directional concern; short leg with high score = squeeze risk.">
                <td className="py-1 pl-1 text-gray-400">News score (0-1)</td>
                <td className={`py-1 px-2 text-right ${L.sentiment_company_news_score != null && L.sentiment_company_news_score < 0.4 ? "text-red-300" : L.sentiment_company_news_score != null && L.sentiment_company_news_score > 0.6 ? "text-emerald-300" : "text-gray-300"}`}>
                  {L.sentiment_company_news_score != null ? L.sentiment_company_news_score.toFixed(2) : "—"}
                </td>
                <td className={`py-1 px-2 text-right ${S.sentiment_company_news_score != null && S.sentiment_company_news_score > 0.6 ? "text-amber-300" : S.sentiment_company_news_score != null && S.sentiment_company_news_score < 0.4 ? "text-emerald-300" : "text-gray-300"}`}>
                  {S.sentiment_company_news_score != null ? S.sentiment_company_news_score.toFixed(2) : "—"}
                </td>
                <td className="py-1 pr-1 text-right text-gray-300">
                  {L.sentiment_company_news_score != null && S.sentiment_company_news_score != null
                    ? `${(L.sentiment_company_news_score - S.sentiment_company_news_score >= 0 ? "+" : "")}${(L.sentiment_company_news_score - S.sentiment_company_news_score).toFixed(2)}`
                    : "—"}
                </td>
              </tr>
              <tr className="border-t border-slate-800/50" title="Number of news articles in the last 7 days. Sustained high buzz can indicate a developing catalyst, sentiment shift, or thesis-relevant news flow.">
                <td className="py-1 pl-1 text-gray-400">News buzz (week / avg)</td>
                <td className={`py-1 px-2 text-right ${L.sentiment_buzz_ratio != null && L.sentiment_buzz_ratio > 1.5 ? "text-amber-300" : "text-gray-300"}`}>
                  {L.sentiment_buzz_articles_week != null
                    ? `${L.sentiment_buzz_articles_week}${L.sentiment_buzz_weekly_avg ? ` / ${L.sentiment_buzz_weekly_avg.toFixed(0)}` : ""}${L.sentiment_buzz_ratio ? ` (${L.sentiment_buzz_ratio.toFixed(1)}×)` : ""}`
                    : "—"}
                </td>
                <td className={`py-1 px-2 text-right ${S.sentiment_buzz_ratio != null && S.sentiment_buzz_ratio > 1.5 ? "text-amber-300" : "text-gray-300"}`}>
                  {S.sentiment_buzz_articles_week != null
                    ? `${S.sentiment_buzz_articles_week}${S.sentiment_buzz_weekly_avg ? ` / ${S.sentiment_buzz_weekly_avg.toFixed(0)}` : ""}${S.sentiment_buzz_ratio ? ` (${S.sentiment_buzz_ratio.toFixed(1)}×)` : ""}`
                    : "—"}
                </td>
                <td className="py-1 pr-1 text-right text-gray-500">—</td>
              </tr>
              <tr className="border-t border-slate-800/50" title="Company news score minus the sector average. Positive = stock is being talked about more bullishly than its sector peers right now.">
                <td className="py-1 pl-1 text-gray-400">Score vs sector</td>
                <td className={`py-1 px-2 text-right ${L.sentiment_score_vs_sector != null && L.sentiment_score_vs_sector > 0.05 ? "text-emerald-300" : L.sentiment_score_vs_sector != null && L.sentiment_score_vs_sector < -0.05 ? "text-red-300" : "text-gray-300"}`}>
                  {L.sentiment_score_vs_sector != null
                    ? `${L.sentiment_score_vs_sector >= 0 ? "+" : ""}${L.sentiment_score_vs_sector.toFixed(2)}`
                    : "—"}
                </td>
                <td className={`py-1 px-2 text-right ${S.sentiment_score_vs_sector != null && S.sentiment_score_vs_sector < -0.05 ? "text-emerald-300" : S.sentiment_score_vs_sector != null && S.sentiment_score_vs_sector > 0.05 ? "text-amber-300" : "text-gray-300"}`}>
                  {S.sentiment_score_vs_sector != null
                    ? `${S.sentiment_score_vs_sector >= 0 ? "+" : ""}${S.sentiment_score_vs_sector.toFixed(2)}`
                    : "—"}
                </td>
                <td className="py-1 pr-1 text-right text-gray-500">—</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      <div className="mt-2 text-[10px] text-gray-500 italic">
        Emerald = the long leg has the better number on that metric (or it favors the trade direction).
        Amber = the short leg has the better number — directional concern on the long thesis.
        Valuation multiples (P/E, P/S, EV/*) favor LOWER for the long leg.
        Fundamentals are TTM (AV OVERVIEW). News sentiment is Finnhub /news-sentiment (last 7d).
      </div>
    </div>
  );
}
