import { useState } from "react";
import type {
  PairIdea,
  PairsPayload,
  BasketMetrics,
} from "../../../hooks/useTokenizedAssets";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { fmtUsd, fmtPct, fmtNum } from "./format";
import { SaaRiskPanel } from "./SaaRiskPanel";

interface Props {
  pairs?: PairsPayload;
}

const categoryColor: Record<string, string> = {
  saa_anchored: "bg-amber-900/40 text-amber-300 border-amber-800/50",
  stock: "bg-slate-800/60 text-slate-300 border-slate-700/50",
  etf: "bg-indigo-900/40 text-indigo-300 border-indigo-800/50",
  metal: "bg-yellow-900/40 text-yellow-300 border-yellow-800/50",
  commodity: "bg-orange-900/40 text-orange-300 border-orange-800/50",
  cross: "bg-purple-900/40 text-purple-300 border-purple-800/50",
};

function carryColor(v: number | null): string {
  if (v === null) return "text-gray-400";
  if (v > 10) return "text-emerald-400";
  if (v > 0) return "text-emerald-500";
  if (v < -10) return "text-red-400";
  return "text-gray-300";
}

function sharpeColor(v: number | null): string {
  if (v === null) return "text-gray-500";
  if (v > 1.0) return "text-emerald-400";
  if (v > 0.5) return "text-emerald-500";
  if (v > 0.2) return "text-amber-400";
  if (v < 0) return "text-red-400";
  return "text-gray-300";
}

function corrColor(v: number | null): string {
  if (v === null) return "text-gray-500";
  if (v > 0.7) return "text-emerald-400";
  if (v > 0.4) return "text-amber-400";
  return "text-gray-300";
}

const BASKET_LABELS: Record<string, string> = {
  saa_faithful: "SAA-faithful",
  carry_optimized: "Carry-optimized",
  reverse_tilted: "Reverse-tilted (CRWV-heavy)",
};

const BASKET_DESCRIPTIONS: Record<string, string> = {
  saa_faithful:
    "SAA's conviction-weighted: 56% SNDK / 43% CRWV long; shorts weighted by SAA put $ notional across NVDA/ORCL/AVGO/AMD/MU/TSM/INTC",
  carry_optimized:
    "Same longs; shorts filtered to symbols with weekday funding ≥8% (drops INTC). Renormalized SAA weights",
  reverse_tilted:
    "70% CRWV / 30% SNDK long (overweights the cheaper-to-carry leg); shorts same as carry-optimized",
};

function BasketCard({ b }: { b: BasketMetrics }) {
  const sortedLongs = Object.entries(b.longs).sort((a, c) => c[1] - a[1]);
  const sortedShorts = Object.entries(b.shorts).sort((a, c) => c[1] - a[1]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>{BASKET_LABELS[b.name] ?? b.name}</CardTitle>
          <Badge variant="warning" className="text-[10px]">basket</Badge>
        </div>
        <div className="text-[10px] text-gray-500 mt-1 leading-snug">
          {BASKET_DESCRIPTIONS[b.name] ?? ""}
        </div>
      </CardHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-[10px] text-gray-500">Carry APR @ 2x lev</div>
          <div className={`font-mono text-base ${carryColor(b.carry_apr_pct_2x)}`}>
            {fmtPct(b.carry_apr_pct_2x, 1)}
          </div>
          <div className="text-[10px] text-gray-600">
            1x: {fmtPct(b.carry_apr_pct_1x, 1)}
          </div>
        </div>
        <div title={`@2x lev: ${b.spread_vol_daily_pct_2x?.toFixed(2) ?? "—"}%/d · ${b.spread_vol_ann_pct_2x?.toFixed(0) ?? "—"}%/y`}>
          <div className="text-[10px] text-gray-500">Spread vol (1x)</div>
          <div className="font-mono text-base text-gray-200">
            {b.spread_vol_daily_pct_1x != null ? `${b.spread_vol_daily_pct_1x.toFixed(2)}%/d` : "—"}
          </div>
          <div className="text-[10px] text-gray-600">
            {b.spread_vol_ann_pct_1x != null ? `${b.spread_vol_ann_pct_1x.toFixed(0)}%/y` : "—"}
            {" · cov "}{Math.round((b.vol_coverage ?? 0) * 100)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500">Sharpe (leverage-invariant)</div>
          <div className={`font-mono text-base ${sharpeColor(b.sharpe)}`}>
            {fmtNum(b.sharpe, 2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500">Funding (cost / income)</div>
          <div className="font-mono text-xs text-red-300">
            L: {fmtPct(b.long_funding_apr_pct, 1)}
          </div>
          <div className="font-mono text-xs text-emerald-300">
            S: {fmtPct(b.short_funding_apr_pct, 1)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Longs ({sortedLongs.length})</div>
          <div className="space-y-1">
            {sortedLongs.map(([sym, w]) => (
              <div key={sym} className="flex justify-between font-mono">
                <span className="text-emerald-400">{sym.replace("USDT", "")}</span>
                <span className="text-gray-400">{(w * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Shorts ({sortedShorts.length})</div>
          <div className="space-y-1">
            {sortedShorts.map(([sym, w]) => (
              <div key={sym} className="flex justify-between font-mono">
                <span className="text-red-400">{sym.replace("USDT", "")}</span>
                <span className="text-gray-400">{(w * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

const sectorMatchColor: Record<string, string> = {
  same_subsector: "border-emerald-700 bg-emerald-950/50 text-emerald-300",
  same_sector: "border-amber-700 bg-amber-950/50 text-amber-300",
  cross_sector: "border-gray-700 bg-gray-900/50 text-gray-400",
};

const sectorMatchLabel: Record<string, string> = {
  same_subsector: "Same subsector",
  same_sector: "Same sector",
  cross_sector: "Cross sector",
};

// Marginal vol impact: the single most important PM metric.
//   "diversifier" = adding this pair REDUCES total portfolio vol (gold)
//   "neutral"     = negligible effect (gray)
//   "additive"    = adding this pair INCREASES total portfolio vol (red)
const marginalVolBadge: Record<string, string> = {
  diversifier: "border-emerald-700 bg-emerald-950/50 text-emerald-300",
  neutral: "border-gray-700 bg-gray-900/50 text-gray-400",
  additive: "border-red-700 bg-red-950/50 text-red-300",
};

const marginalVolLabel: Record<string, string> = {
  diversifier: "Diversifier",
  neutral: "Neutral",
  additive: "Additive",
};

function PairRow({ p }: { p: PairIdea }) {
  const m = p.metrics;
  const sm = p.sector_match ?? "cross_sector";
  const matchTooltip =
    p.long_sector && p.short_sector
      ? `L: ${p.long_sector} / ${p.long_subsector ?? "—"}  ·  S: ${p.short_sector} / ${p.short_subsector ?? "—"}`
      : undefined;
  const mvc = m.marginal_vol_classification;
  const mvDaily = m.marginal_vol_daily_pct;
  const corrPort = m.corr_to_portfolio;

  return (
    <div className="border-b border-[var(--border)] last:border-b-0 py-3 px-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] uppercase font-medium ${categoryColor[p.category] ?? categoryColor.stock}`}
          >
            {p.category.replace("_", " ")}
          </span>
          <span
            title={matchTooltip}
            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium ${sectorMatchColor[sm]}`}
          >
            {sectorMatchLabel[sm]}
          </span>
          {mvc && (
            <span
              title={
                `Marginal portfolio vol impact when this pair is added at small notional.\n` +
                `Computed as cov(pair_spread, portfolio_returns) / σ_portfolio.\n` +
                `Negative ⇒ diversifier (reduces total portfolio vol).\n` +
                `Positive ⇒ additive (increases total portfolio vol).`
              }
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${marginalVolBadge[mvc]}`}
            >
              {marginalVolLabel[mvc]} {mvDaily != null ? (mvDaily >= 0 ? "+" : "") + mvDaily.toFixed(3) + "%/d" : ""}
            </span>
          )}
          <span className="text-sm font-medium">
            <span className="text-emerald-400">L</span>{" "}
            <span className="font-mono text-gray-100">
              {p.long_symbol.replace("USDT", "")}
            </span>{" "}
            <span className="text-gray-500">({p.long_label})</span>{" "}
            <span className="text-gray-600">vs</span>{" "}
            <span className="text-red-400">S</span>{" "}
            <span className="font-mono text-gray-100">
              {p.short_symbol.replace("USDT", "")}
            </span>{" "}
            <span className="text-gray-500">({p.short_label})</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className={sharpeColor(m.sharpe)}>
            Sharpe {fmtNum(m.sharpe, 2)}
          </span>
          {m.sharpe_beta_neutral != null && (
            <span
              className={`${sharpeColor(m.sharpe_beta_neutral)} text-[11px]`}
              title="β-hedged Sharpe: position L 1 unit / S h* units (OLS hedge ratio). Net market beta = 0."
            >
              β-Sharpe {m.sharpe_beta_neutral.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      {p.long_subsector && p.short_subsector && (
        <div className="text-[10px] text-gray-500 mt-1 font-mono flex items-center gap-3">
          <span>{p.long_subsector} ↔ {p.short_subsector}</span>
          {corrPort != null && (
            <span className="text-gray-600">
              · corr-to-portfolio {corrPort >= 0 ? "+" : ""}{corrPort.toFixed(2)}
            </span>
          )}
          {m.beta_hedge_ratio != null && (
            <span className="text-gray-600">
              · h* {m.beta_hedge_ratio.toFixed(2)} (β-hedge ratio)
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2 text-xs">
        <div>
          <div className="text-[10px] text-gray-500">Carry @ 2x lev</div>
          <div className={`font-mono ${carryColor(m.carry_apr_pct_2x)}`}>
            {fmtPct(m.carry_apr_pct_2x, 1)}
          </div>
          <div className="text-[10px] text-gray-600">1x: {fmtPct(m.carry_apr_pct_1x, 1)}</div>
        </div>
        <div title={`@2x lev: ${m.spread_vol_daily_pct_2x?.toFixed(2) ?? "—"}%/d · ${m.spread_vol_ann_pct_2x?.toFixed(1) ?? "—"}%/y`}>
          <div className="text-[10px] text-gray-500">Spread vol (1x)</div>
          <div className="font-mono">
            {m.spread_vol_daily_pct_1x != null ? `${m.spread_vol_daily_pct_1x.toFixed(2)}%/d` : "—"}
          </div>
          <div className="text-[10px] text-gray-600">
            {m.spread_vol_ann_pct_1x != null ? `${m.spread_vol_ann_pct_1x.toFixed(0)}%/y` : "—"}
          </div>
        </div>
        <div
          title={
            `Raw 6m Pearson: ${m.correlation_weekday?.toFixed(2) ?? "—"}\n` +
            `EWMA 60d half-life:    ${m.correlation_ewma?.toFixed(2) ?? "—"}\n` +
            `Spearman (rank):       ${m.correlation_spearman?.toFixed(2) ?? "—"}\n` +
            `Residual vs SPY beta:  ${m.correlation_residual_spy?.toFixed(2) ?? "—"}`
          }
        >
          <div className="text-[10px] text-gray-500">Idiosync. corr</div>
          <div className={`font-mono ${corrColor(m.correlation_residual_spy ?? m.correlation_weekday)}`}>
            {(m.correlation_residual_spy ?? m.correlation_weekday)?.toFixed(2) ?? "—"}
          </div>
          <div className="text-[10px] text-gray-600">
            raw {m.correlation_weekday?.toFixed(2) ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500">Funding L / S</div>
          <div className="font-mono text-[10px] text-red-300">
            L: {fmtPct(m.funding_long_apr_pct, 1)}
          </div>
          <div className="font-mono text-[10px] text-emerald-300">
            S: {fmtPct(m.funding_short_apr_pct, 1)}
          </div>
        </div>
        <div title={m.valuation_gap_basis ? `Basis: ${m.valuation_gap_basis}` : undefined}>
          <div className="text-[10px] text-gray-500">
            Val. gap {m.valuation_gap_basis === "price_to_sales" ? "(P/S)" : m.valuation_gap_basis === "premium_to_spot" ? "(prem)" : "(P/E)"}
          </div>
          <div className="font-mono text-gray-300">
            {m.valuation_gap_pct != null ? fmtPct(m.valuation_gap_pct, 1) : "—"}
          </div>
          <div className="text-[10px] text-gray-600">30d drift {fmtPct(m.drift_30d_pct, 1)}</div>
        </div>
        <div title="Analyst price-target upside (Finnhub mean target / current mark)">
          <div className="text-[10px] text-gray-500">Analyst upside L − S</div>
          <div className={`font-mono ${m.analyst_upside_gap_pct != null && m.analyst_upside_gap_pct > 0 ? "text-emerald-300" : m.analyst_upside_gap_pct != null && m.analyst_upside_gap_pct < 0 ? "text-red-300" : "text-gray-500"}`}>
            {m.analyst_upside_gap_pct != null ? fmtPct(m.analyst_upside_gap_pct, 1) : "—"}
          </div>
          <div className="text-[10px] text-gray-600">
            L {m.analyst_upside_long_pct != null ? `${m.analyst_upside_long_pct.toFixed(0)}%` : "—"}
            {" / S "}
            {m.analyst_upside_short_pct != null ? `${m.analyst_upside_short_pct.toFixed(0)}%` : "—"}
          </div>
        </div>
      </div>

      {p.saa && (p.saa.long_ticker || p.saa.short_validation?.ticker) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-amber-200/80">
          <Badge variant="warning" className="text-[10px]">SAA</Badge>
          {p.saa.long_ticker && (
            <a
              href={p.saa.filing_url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-offset-2 hover:underline"
            >
              L {p.saa.long_ticker} {fmtUsd(p.saa.long_value_usd)} ({p.saa.long_pct_aum?.toFixed(1)}% AUM)
            </a>
          )}
          {p.saa.short_validation?.ticker && (
            <span className="text-red-300/80">
              {" ↔ "}S puts {p.saa.short_validation.ticker} {fmtUsd(p.saa.short_validation.value_usd)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PairIdeasSubTab({ pairs }: Props) {
  const [minSharpe, setMinSharpe] = useState(0.15);
  const [showInverse, setShowInverse] = useState(false);

  const saa = pairs?.saa_anchored ?? [];
  const generic = pairs?.generic ?? [];
  const baskets = pairs?.baskets ?? {};
  const basketList = (
    ["saa_faithful", "carry_optimized", "reverse_tilted"] as const
  )
    .map((k) => baskets[k])
    .filter((b): b is BasketMetrics => !!b);

  // Filter: keep pairs whose Sharpe (in either direction if showInverse) clears the threshold.
  // Null Sharpe falls through — usually means too-short history; keep visible.
  const passes = (p: PairIdea) => {
    const s = p.metrics.sharpe;
    if (s == null) return true;
    if (showInverse) return Math.abs(s) >= minSharpe;
    return s >= minSharpe;
  };

  const saaShown = saa.filter(passes);
  const genericShown = generic.filter(passes);
  const saaHidden = saa.length - saaShown.length;
  const genericHidden = generic.length - genericShown.length;

  if (!pairs || (saa.length === 0 && generic.length === 0 && basketList.length === 0)) {
    return (
      <div className="p-6 text-center text-xs text-gray-500">
        Pair engine has no data yet. Refresh runs every 24h and fetches full Binance funding
        history + 180d klines per contract. Newly-listed contracts (≤15 weekday returns)
        are excluded from spread vol but kept in funding aggregates.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pairs.metrics_note && (
        <div className="text-[10px] text-gray-500 italic px-1">
          {pairs.metrics_note} · Sharpe is leverage-invariant.
        </div>
      )}

      <div className="text-[11px] text-emerald-300/80 bg-emerald-950/30 border border-emerald-900/40 rounded-md px-3 py-2">
        <span className="font-semibold">Edge note:</span> our pair Sharpe = mean-reversion alpha + funding carry.
        Citadel / Point 72 / Cubist run the same statistical methodology but trade equity markets — they
        structurally cannot harvest crypto perp funding. The carry term is alpha they cannot replicate.
      </div>

      {(pairs.portfolio_vol_daily_pct != null) && (
        <div className="text-[11px] text-gray-300 bg-slate-900/50 border border-slate-700/50 rounded-md px-3 py-2">
          <span className="font-semibold text-gray-200">PM-view headline metric:</span>{" "}
          <span className="text-gray-400">
            each pair shows its <span className="text-emerald-300">marginal vol impact</span> when added
            to the live Nickel book. This is the singular most important quantity for portfolio construction —
            covariance with the existing book, not standalone pair vol, determines whether a position
            increases or reduces total portfolio risk.
          </span>
          <span className="block mt-1 text-gray-500 font-mono">
            Live portfolio σ:{" "}
            <span className="text-gray-200">{pairs.portfolio_vol_daily_pct.toFixed(3)}%/d</span>
            {" · "}
            {pairs.portfolio_returns_sample_size ?? 0} daily samples.
          </span>
        </div>
      )}

      {basketList.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-300 mb-2 px-1">Baskets</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {basketList.map((b) => (
              <BasketCard key={b.name} b={b} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 text-[11px] text-gray-400 px-1 py-2 border-y border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="text-gray-500">Min Sharpe:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minSharpe}
            onChange={(e) => setMinSharpe(parseFloat(e.target.value))}
            className="w-32 accent-emerald-500"
          />
          <span className="font-mono text-gray-200 w-10">{minSharpe.toFixed(2)}</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-500 hover:text-gray-300">
            <input
              type="checkbox"
              checked={showInverse}
              onChange={(e) => setShowInverse(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>also show inverse (negative Sharpe)</span>
          </label>
        </div>
        <div className="text-gray-500">
          Showing {saaShown.length + genericShown.length} of {saa.length + generic.length} pairs
          {saaHidden + genericHidden > 0 && (
            <span className="text-gray-600"> · {saaHidden + genericHidden} hidden by filter</span>
          )}
        </div>
      </div>

      {saa.length > 0 && <SaaRiskPanel />}

      {saa.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>
                SAA-anchored pair ideas{" "}
                <span className="text-[11px] font-normal text-gray-500">
                  ({saaShown.length}{saaHidden > 0 ? ` of ${saa.length}` : ""})
                </span>
              </CardTitle>
              <span className="text-[10px] text-gray-500">
                long Aschenbrenner conviction, hedge with a correlated short
              </span>
            </div>
          </CardHeader>
          <div className="divide-y divide-[var(--border)] -mx-2">
            {saaShown.map((p, i) => (
              <PairRow key={`saa-${i}-${p.long_symbol}-${p.short_symbol}`} p={p} />
            ))}
            {saaShown.length === 0 && (
              <div className="text-[11px] text-gray-500 italic px-3 py-4 text-center">
                No SAA pairs clear the Sharpe filter. Lower the threshold to see more.
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>
              Top L/S RV ideas across the universe{" "}
              <span className="text-[11px] font-normal text-gray-500">
                ({genericShown.length}{genericHidden > 0 ? ` of ${generic.length}` : ""})
              </span>
            </CardTitle>
            <span className="text-[10px] text-gray-500">
              sector-grouped, ranked by Sharpe (weekday spread vol vs full-history weekday funding carry)
            </span>
          </div>
        </CardHeader>
        <div className="-mx-2">
          {genericShown.map((p, i) => (
            <PairRow key={`gen-${i}-${p.long_symbol}-${p.short_symbol}`} p={p} />
          ))}
          {genericShown.length === 0 && (
            <div className="text-[11px] text-gray-500 italic px-3 py-4 text-center">
              No generic pairs clear the Sharpe filter.
            </div>
          )}
        </div>
      </Card>

      <div className="text-[10px] text-gray-600 italic px-2 space-y-1">
        <div>
          Research-only. 1:1 dollar-neutral; not beta-hedged (coming in workstream C1). 2x leverage
          values shown in tooltips on the spread vol cells. Funding uses full available per-contract
          history, weekday-only (Mon–Fri UTC). Spread vol from underlying stock daily log returns
          (yfinance, NYSE close-to-close, 6-month sample). Idiosync. corr = Pearson on residuals
          after SPY beta is stripped (raw / EWMA / Spearman shown on hover).
        </div>
      </div>
    </div>
  );
}
