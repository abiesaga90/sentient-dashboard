import { useState } from "react";
import type {
  PairIdea,
  PairsPayload,
  BasketMetrics,
  TokenizedRow,
} from "../../../hooks/useTokenizedAssets";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { fmtUsd, fmtPct, fmtNum } from "./format";
import { SaaRiskPanel } from "./SaaRiskPanel";
import { QualityCompareCard } from "./QualityCompareCard";
import {
  DirectionAgreementPanel,
  computeAgreement,
  agreementChipClass,
  agreementChipLabel,
  carryConvictionBadge,
} from "./DirectionAgreementPanel";

interface Props {
  pairs?: PairsPayload;
  rows?: TokenizedRow[];
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

// Trade-type classification — the headline distinction between mean-reversion
// alpha and pure funding carry. Driven by two thresholds:
//   • idio_corr  (correlation after SPY beta is stripped — how much the short
//                 actually hedges the long)
//   • c/σ        (daily carry / daily spread vol — how much funding income
//                 offsets a 1σ adverse spread move on a 1-day horizon)
type TradeType = "rv" | "rv_carry" | "carry" | "hybrid";

interface TradeTypeInfo {
  kind: TradeType;
  label: string;
  short_label: string;
  badge_class: string;
  c_over_sigma: number | null;     // unitless ratio, daily-carry / daily-vol
  t_star_days: number | null;       // (σ/c)² — days for carry to cover a 1σ adverse move
  idio_corr: number | null;
  is_cointegrating: boolean;
}

// Trading days/yr — funding APR is annualized on a weekday basis (Mon-Fri UTC)
// to match how spread vol is computed.
const TRADING_DAYS_PER_YEAR = 252;

function classifyTradeType(m: {
  correlation_residual_spy?: number | null;
  correlation_weekday?: number | null;
  is_cointegrating?: boolean;
  carry_apr_pct_1x?: number | null;
  spread_vol_daily_pct_1x?: number | null;
}): TradeTypeInfo {
  const idio = m.correlation_residual_spy ?? m.correlation_weekday ?? null;
  const carryApr = m.carry_apr_pct_1x;
  const volDaily = m.spread_vol_daily_pct_1x;
  const coint = m.is_cointegrating === true;

  const dailyCarry =
    carryApr != null ? carryApr / TRADING_DAYS_PER_YEAR : null;
  const cOverSigma =
    dailyCarry != null && volDaily != null && volDaily > 0
      ? dailyCarry / volDaily
      : null;
  const tStar =
    dailyCarry != null && volDaily != null && dailyCarry > 0
      ? Math.pow(volDaily / dailyCarry, 2)
      : null;

  let kind: TradeType = "hybrid";
  if (idio != null && idio >= 0.5 && coint) {
    kind = cOverSigma != null && cOverSigma >= 0.05 ? "rv_carry" : "rv";
  } else if (
    idio != null &&
    idio < 0.3 &&
    carryApr != null &&
    carryApr >= 30
  ) {
    kind = "carry";
  }

  const label =
    kind === "rv"
      ? "RV (mean reversion)"
      : kind === "rv_carry"
      ? "RV + Carry"
      : kind === "carry"
      ? "Carry harvest"
      : "Hybrid";
  const short_label =
    kind === "rv"
      ? "RV"
      : kind === "rv_carry"
      ? "RV + Carry"
      : kind === "carry"
      ? "Carry"
      : "Hybrid";

  const badge_class =
    kind === "rv"
      ? "border-emerald-500 bg-emerald-950/70 text-emerald-200 font-bold"
      : kind === "rv_carry"
      ? "border-cyan-400 bg-cyan-950/70 text-cyan-100 font-bold"
      : kind === "carry"
      ? "border-amber-600 bg-amber-950/40 text-amber-300"
      : "border-gray-700 bg-gray-900/40 text-gray-400";

  return {
    kind,
    label,
    short_label,
    badge_class,
    c_over_sigma: cOverSigma,
    t_star_days: tStar,
    idio_corr: idio,
    is_cointegrating: coint,
  };
}

// Correlation-adjusted Sharpe — implements user preference for high-corr pairs
// (saved as feedback_pairs_prefer_high_corr). Maps idio_corr through a weight
// curve: ≤0.2 ⇒ 0, 0.5 ⇒ 1.0, ≥0.65 ⇒ 1.5 (capped). Negative corr ⇒ 0.
function rvQualityScore(
  sharpe: number | null,
  idio_corr: number | null
): number | null {
  if (sharpe == null || idio_corr == null) return null;
  const raw = (idio_corr - 0.2) / 0.3; // 0.2→0, 0.5→1.0, 0.65→1.5
  const w = Math.max(0, Math.min(1.5, raw));
  return sharpe * w;
}

const BASKET_LABELS: Record<string, string> = {
  saa_faithful: "SAA-faithful",
  carry_optimized: "Carry-optimized",
  reverse_tilted: "Reverse-tilted (CRWV-heavy)",
  valuation_tilted: "Valuation-tilted (Fwd earnings)",
};

const BASKET_DESCRIPTIONS: Record<string, string> = {
  saa_faithful:
    "SAA's conviction-weighted: 56% SNDK / 43% CRWV long; shorts weighted by SAA put $ notional across NVDA/ORCL/AVGO/AMD/MU/TSM/INTC",
  carry_optimized:
    "Same longs; shorts filtered to symbols with weekday funding ≥8% (drops INTC). Renormalized SAA weights",
  reverse_tilted:
    "70% CRWV / 30% SNDK long (overweights the cheaper-to-carry leg); shorts same as carry-optimized",
  valuation_tilted:
    "Long 3 cheapest-on-forward-earnings SAA names · short 5 most-expensive in universe with funding ≥ 8%. Major-driver expression of Pillar 3 (Forward Valuation).",
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

// Z-score timing signal: when to enter the trade.
//   "enter"        z <= -2   spread depressed, mean-reversion in our favor
//   "near_enter"   -2 < z <= -1
//   "neutral"      |z| < 1   close to mean, no signal
//   "near_avoid"   1 <= z < 2
//   "avoid"        z >= 2    spread elevated, mean-reversion would hurt us
const signalZoneBadge: Record<string, string> = {
  enter: "border-emerald-600 bg-emerald-950/70 text-emerald-200 font-bold",
  near_enter: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
  neutral: "border-gray-700 bg-gray-900/40 text-gray-400",
  near_avoid: "border-amber-800 bg-amber-950/40 text-amber-300",
  avoid: "border-red-600 bg-red-950/70 text-red-200 font-bold",
};

// Reframed for a 3-6mo holding-period book (Workstream D6). Less timing-trader,
// more entry-quality. Only the |z|>2 extremes get a visual edge.
const signalZoneLabel: Record<string, string> = {
  enter: "Entry attractive",
  near_enter: "Building entry",
  neutral: "Neutral",
  near_avoid: "Stretched",
  avoid: "Entry unattractive",
};

// Thin left-edge only at the extremes (|z| > 2). Building zones get nothing.
const cardBorderByZone: Record<string, string> = {
  enter: "border-l-2 border-l-emerald-600",
  near_enter: "",
  neutral: "",
  near_avoid: "",
  avoid: "border-l-2 border-l-red-600",
};

// Quality Δ chip (Workstream D4) — the headline alpha-layer indicator.
//   |Q| ≥ 1.0     strong signal (long is clearly better / worse)
//   0.3 ≤ |Q| < 1 edge
//   |Q| < 0.3     quality matched
function qualityChipClass(q: number | null | undefined): string {
  if (q == null) return "border-gray-700 bg-gray-900/40 text-gray-400";
  if (q >= 1.0) return "border-emerald-500 bg-emerald-950/70 text-emerald-200 font-bold";
  if (q >= 0.3) return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
  if (q > -0.3) return "border-gray-700 bg-gray-900/40 text-gray-400";
  if (q >= -1.0) return "border-amber-700 bg-amber-950/40 text-amber-300";
  return "border-red-500 bg-red-950/70 text-red-200 font-bold";
}
function qualityChipLabel(q: number | null | undefined): string {
  if (q == null) return "Quality ?";
  if (q >= 1.0) return "Quality ++";
  if (q >= 0.3) return "Quality +";
  if (q > -0.3) return "Quality ≈";
  if (q >= -1.0) return "Quality −";
  return "Quality −−";
}

function PairRow({
  p,
  portfolioVol,
  longRow,
  shortRow,
}: {
  p: PairIdea;
  portfolioVol?: number | null;
  longRow?: TokenizedRow;
  shortRow?: TokenizedRow;
}) {
  const [expanded, setExpanded] = useState(false);
  const m = p.metrics;
  const sm = p.sector_match ?? "cross_sector";
  const matchTooltip =
    p.long_sector && p.short_sector
      ? `L: ${p.long_sector} / ${p.long_subsector ?? "—"}  ·  S: ${p.short_sector} / ${p.short_subsector ?? "—"}`
      : undefined;
  const mvc = m.marginal_vol_classification;
  const mvDaily = m.marginal_vol_daily_pct;
  const corrPort = m.corr_to_portfolio;
  const zone = m.signal_zone ?? null;
  const zonePill = zone ? cardBorderByZone[zone] : "";

  const agreement = computeAgreement(p, longRow, shortRow);

  return (
    <div className={`border-b border-[var(--border)] last:border-b-0 py-3 px-2 ${zonePill}`}>
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
          {(() => {
            const tt = classifyTradeType(m);
            const cOverSigmaPct =
              tt.c_over_sigma != null ? (tt.c_over_sigma * 100).toFixed(1) : "—";
            const tStarStr =
              tt.t_star_days != null && isFinite(tt.t_star_days)
                ? tt.t_star_days >= 1000
                  ? `${(tt.t_star_days / 365).toFixed(1)}yr`
                  : `${tt.t_star_days.toFixed(0)}d`
                : "—";
            const tooltip =
              `Trade type: ${tt.label}\n\n` +
              `Hedge effectiveness\n` +
              `  idiosyncratic corr  = ${tt.idio_corr?.toFixed(2) ?? "—"}` +
              `  (≥ 0.5 = hedge works; < 0.3 = short barely offsets long)\n` +
              `  cointegrates        = ${tt.is_cointegrating ? "yes" : "no"}\n\n` +
              `Carry vs price-loss math (1x leverage)\n` +
              `  daily carry         = ${
                m.carry_apr_pct_1x != null
                  ? (m.carry_apr_pct_1x / TRADING_DAYS_PER_YEAR).toFixed(3) + "%"
                  : "—"
              }   (${m.carry_apr_pct_1x?.toFixed(1) ?? "—"}% APR / 252 weekday)\n` +
              `  daily spread vol    = ${m.spread_vol_daily_pct_1x?.toFixed(2) ?? "—"}%\n` +
              `  c/σ (carry / 1σ)    = ${cOverSigmaPct}%   ` +
              `(fraction of a daily 1σ adverse move that carry offsets)\n` +
              `  break-even T*       = ${tStarStr}   ` +
              `((σ/c)² days for carry to cover a 1σ adverse spread drift)\n\n` +
              `Cointegration screen\n` +
              `  ADF p-value         = ${m.adf_pvalue?.toFixed(3) ?? "—"}   (< 0.05 = stationary)\n` +
              `  EG p-value          = ${m.cointegration_pvalue?.toFixed(3) ?? "—"}\n` +
              `  half-life           = ${m.half_life_days?.toFixed(1) ?? "—"} days\n` +
              `  Hurst               = ${m.hurst_exponent?.toFixed(2) ?? "—"}     (< 0.55 required)\n\n` +
              (tt.kind === "rv_carry"
                ? "Best of both: real hedge + carry boost. Mean reversion is the primary alpha source, carry is a tailwind."
                : tt.kind === "rv"
                ? "Pure mean-reversion play. Carry is small relative to spread vol — alpha comes from the spread reverting."
                : tt.kind === "carry"
                ? "Funding-carry trade, NOT a hedge. Low correlation means the short does not offset the long's market exposure. Treat the spread as a random walk paid a coupon — hold to T* or longer."
                : "Partial hedge / modest carry. Neither alpha source dominates.");
            return (
              <span
                title={tooltip}
                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] ${tt.badge_class}`}
              >
                {tt.short_label}
                {tt.c_over_sigma != null && (
                  <span className="ml-1 opacity-80 font-mono">
                    c/σ {cOverSigmaPct}%
                  </span>
                )}
                {tt.is_cointegrating && m.half_life_days != null && (
                  <span className="ml-1 opacity-70 font-mono">
                    · HL {m.half_life_days.toFixed(0)}d
                  </span>
                )}
                {!tt.is_cointegrating && tt.t_star_days != null && isFinite(tt.t_star_days) && (
                  <span className="ml-1 opacity-70 font-mono">
                    · T* {tStarStr}
                  </span>
                )}
              </span>
            );
          })()}
          {m.quality_score != null && (
            <span
              title={
                `Fundamental quality differential (L − S).\n\n` +
                `Composite = weighted normalized diffs on:\n` +
                `  Revenue growth YoY:  ${m.revenue_growth_diff_pp?.toFixed(1) ?? "—"}pp  (w +20%)\n` +
                `  EPS growth YoY:      ${m.eps_growth_diff_pp?.toFixed(1) ?? "—"}pp  (w +20%)\n` +
                `  Operating margin:    ${m.operating_margin_diff_pp?.toFixed(1) ?? "—"}pp  (w +20%)\n` +
                `  ROE TTM:             ${m.roe_diff_pp?.toFixed(1) ?? "—"}pp  (w +15%)\n` +
                `  Forward EPS growth:  ${m.eps_estimate_growth_diff_pp?.toFixed(1) ?? "—"}pp  (w +15%)\n` +
                `  Valuation premium:   ${m.valuation_premium_pp?.toFixed(1) ?? "—"}pp  (w −10% — cheap is good)\n\n` +
                `Composite Q = ${m.quality_score.toFixed(2)}  ∈ [-2, +2]\n` +
                `Coverage: ${m.quality_score_coverage ?? 0}/6 factors populated.\n\n` +
                (m.quality_score >= 1
                  ? "Long is materially better-quality than short."
                  : m.quality_score >= 0.3
                  ? "Long has a quality edge."
                  : m.quality_score > -0.3
                  ? "Quality matched — pair is carry + RV, not a quality trade."
                  : m.quality_score >= -1
                  ? "Short is higher-quality. Directional risk on the long leg."
                  : "Short business is materially better. Re-examine thesis.")
              }
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] ${qualityChipClass(m.quality_score)}`}
            >
              {qualityChipLabel(m.quality_score)}
              <span className="ml-1 font-mono opacity-90">
                {m.quality_score >= 0 ? "+" : ""}{m.quality_score.toFixed(2)}
              </span>
            </span>
          )}
          {agreement.decided_count > 0 && (
            <span
              title={
                `5-pillar orthogonal voter (Earnings Quality · Momentum · Forward Valuation · Analyst Residual · Carry).\n\n` +
                `Score = agree − disagree = ${agreement.net_score} over ${agreement.decided_count} decided cell${agreement.decided_count === 1 ? "" : "s"}.`
              }
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] ${agreementChipClass(agreement.net_score, agreement.decided_count)}`}
            >
              {agreementChipLabel(agreement.agree_count, agreement.decided_count)}
              {agreement.disagree_count > 0 && (
                <span className="ml-1 opacity-80 font-mono">· {agreement.disagree_count}✗</span>
              )}
            </span>
          )}
          {(() => {
            const ccb = carryConvictionBadge(p);
            if (ccb.state === "unknown") return null;
            return (
              <span
                title={ccb.tooltip}
                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] ${ccb.badge_class}`}
              >
                {ccb.label === "Conflict" ? "⚠ Conflict" : "✓ Aligned"}
                <span className="ml-1 font-mono opacity-90">
                  C{m.carry_direction != null ? (m.carry_direction > 0 ? "↑" : "↓") : "?"}
                  {" "}V{m.conviction_direction != null ? (m.conviction_direction > 0 ? "↑" : "↓") : "?"}
                </span>
              </span>
            );
          })()}
          {m.pm_thesis_edge && m.pm_thesis_edge.max_edge_magnitude_pp >= 5 && (() => {
            const e = m.pm_thesis_edge;
            const dominant = e.dominant_basket ?? "";
            // Shorter human label per basket
            const niceLabel: Record<string, string> = {
              ai_capability_edge_pp: "AI capex",
              tariff_edge_pp: "Tariff",
              crypto_edge_pp: "Crypto",
              gold_relative_edge_pp: "Gold-rel.",
              spacex_edge_pp: "SpaceX",
            };
            const label = niceLabel[dominant] ?? dominant.replace("_edge_pp", "");
            const magnitude = e.max_edge_magnitude_pp;
            // Sign: which leg wins this thesis. Look up the underlying edge value.
            const edgeVal = (e as unknown as Record<string, number>)[dominant] ?? 0;
            const cls =
              magnitude >= 15
                ? "border-violet-500 bg-violet-950/70 text-violet-200 font-bold"
                : magnitude >= 10
                ? "border-violet-700 bg-violet-950/50 text-violet-300"
                : "border-violet-800 bg-violet-950/30 text-violet-300/80";
            const tooltip =
              `Prediction-market thesis edge (L − S overlay scores).\n` +
              `Dominant: ${label}  ·  ${edgeVal >= 0 ? "+" : ""}${edgeVal.toFixed(1)}pp\n\n` +
              (e.thesis_aligned_edges ?? [])
                .map((row) => `  ${niceLabel[row.label] ?? row.label}: ${row.edge_pp >= 0 ? "+" : ""}${row.edge_pp.toFixed(1)}pp`)
                .join("\n") +
              `\n\nPositive edge = PM thesis favours the LONG leg.\n` +
              `Negative = thesis favours the SHORT (i.e. would weaken our trade direction).\n` +
              `Composite is per-basket: AI capex / Tariff intensity / Crypto sentiment / SpaceX premium.`;
            return (
              <span
                title={tooltip}
                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] ${cls}`}
              >
                PM {label} {edgeVal >= 0 ? "+" : ""}
                {edgeVal.toFixed(1)}pp
              </span>
            );
          })()}
          {zone && (
            <span
              title={
                `Spread z-score = (current spread − sample mean) / sample std\n` +
                `on the β-hedged log-price spread over the 2y window.\n\n` +
                `z = ${m.spread_zscore_today?.toFixed(2) ?? "—"}\n` +
                `μ = ${m.spread_mean_logprice?.toFixed(4) ?? "—"}\n` +
                `σ = ${m.spread_std_logprice?.toFixed(4) ?? "—"}\n\n` +
                `For a 3-6mo holding-period book: z is an entry-quality signal,\n` +
                `not a tactical timing trigger. Extreme z (|z|>2) means the\n` +
                `spread is at a multi-year extreme — favorable starting basis.`
              }
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] ${signalZoneBadge[zone]}`}
            >
              {signalZoneLabel[zone]}
              {m.spread_zscore_today != null && (
                <span className="ml-1 font-mono opacity-90">
                  z {m.spread_zscore_today >= 0 ? "+" : ""}{m.spread_zscore_today.toFixed(1)}
                </span>
              )}
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
          {(m.carry_sharpe != null || m.spread_sharpe != null) && (() => {
            const cs = m.carry_sharpe ?? null;
            const ss = m.spread_sharpe ?? null;
            // Highlight conflict in red when the two have opposite signs
            const conflict =
              cs != null && ss != null && cs !== 0 && ss !== 0 && Math.sign(cs) !== Math.sign(ss);
            const cls = conflict
              ? "text-red-300"
              : "text-gray-500";
            return (
              <span
                className={`text-[10px] ${cls}`}
                title={
                  `Sharpe split (Citadel decomposition):\n` +
                  `  carry-Sharpe  = ${cs?.toFixed(2) ?? "—"} (funding APR / spread vol — sign of displayed direction)\n` +
                  `  spread-Sharpe = ${ss?.toFixed(2) ?? "—"} (mean-reversion alpha at zero funding, from z/HL × √252)\n\n` +
                  (conflict
                    ? "⚠ Carry and mean-reversion alphas point in OPPOSITE directions. " +
                      "Carry wants you to hold the displayed direction; spread wants the inverse."
                    : "Both alpha sources point in the same direction (or one is null).")
                }
              >
                (c {cs != null ? `${cs >= 0 ? "+" : ""}${cs.toFixed(2)}` : "—"}
                {" + s "}
                {ss != null ? `${ss >= 0 ? "+" : ""}${ss.toFixed(2)}` : "—"})
              </span>
            );
          })()}
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

      <div className="grid grid-cols-2 md:grid-cols-8 gap-2 mt-2 text-xs">
        <div>
          <div className="text-[10px] text-gray-500">Carry @ 2x lev</div>
          <div className={`font-mono ${carryColor(m.carry_apr_pct_2x)}`}>
            {fmtPct(m.carry_apr_pct_2x, 1)}
          </div>
          <div className="text-[10px] text-gray-600">1x: {fmtPct(m.carry_apr_pct_1x, 1)}</div>
        </div>
        <div title={`@2x lev: ${m.spread_vol_daily_pct_2x?.toFixed(2) ?? "—"}%/d · ${m.spread_vol_ann_pct_2x?.toFixed(1) ?? "—"}%/y\n\nvs-book ratio = pair daily vol / live portfolio daily vol. Higher = pair would dominate book vol at full notional; lower = quiet addition.`}>
          <div className="text-[10px] text-gray-500">Spread vol (1x)</div>
          <div className="font-mono">
            {m.spread_vol_daily_pct_1x != null ? `${m.spread_vol_daily_pct_1x.toFixed(2)}%/d` : "—"}
          </div>
          <div className="text-[10px] text-gray-600">
            {m.spread_vol_ann_pct_1x != null ? `${m.spread_vol_ann_pct_1x.toFixed(0)}%/y` : "—"}
            {portfolioVol != null && portfolioVol > 0 && m.spread_vol_daily_pct_1x != null && (
              <>
                {" · "}
                <span className="text-gray-500">
                  {(m.spread_vol_daily_pct_1x / portfolioVol).toFixed(1)}× book
                </span>
              </>
            )}
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
            {m.analyst_sentiment_residual != null
              ? `residual ${m.analyst_sentiment_residual >= 0 ? "+" : ""}${m.analyst_sentiment_residual.toFixed(1)}%`
              : `L ${m.analyst_upside_long_pct != null ? `${m.analyst_upside_long_pct.toFixed(0)}%` : "—"} / S ${m.analyst_upside_short_pct != null ? `${m.analyst_upside_short_pct.toFixed(0)}%` : "—"}`}
          </div>
        </div>
        <div
          title={(() => {
            const lc = m.forward_val_long_components ?? null;
            const sc = m.forward_val_short_components ?? null;
            const lFpe = lc && typeof lc["forward_pe"] === "number" ? (lc["forward_pe"] as number).toFixed(1) : "—";
            const sFpe = sc && typeof sc["forward_pe"] === "number" ? (sc["forward_pe"] as number).toFixed(1) : "—";
            const lPeg = lc && typeof lc["peg_ratio"] === "number" ? (lc["peg_ratio"] as number).toFixed(2) : "—";
            const sPeg = sc && typeof sc["peg_ratio"] === "number" ? (sc["peg_ratio"] as number).toFixed(2) : "—";
            const lEv = lc && typeof lc["ev_to_ebitda"] === "number" ? (lc["ev_to_ebitda"] as number).toFixed(1) : "—";
            const sEv = sc && typeof sc["ev_to_ebitda"] === "number" ? (sc["ev_to_ebitda"] as number).toFixed(1) : "—";
            return (
              `Forward Valuation Gap (Pillar 3) = score(L) − score(S).\n` +
              `Positive ⇒ long is CHEAPER than short on forward earnings.\n\n` +
              `                Long          Short\n` +
              `  Fwd P/E       ${lFpe.padStart(6)}        ${sFpe}\n` +
              `  PEG           ${lPeg.padStart(6)}        ${sPeg}\n` +
              `  EV/EBITDA     ${lEv.padStart(6)}        ${sEv}\n` +
              `  Score         ${m.forward_val_long_score?.toFixed(2) ?? "—"}          ${m.forward_val_short_score?.toFixed(2) ?? "—"}\n\n` +
              `Major positioning driver — sector-relative z-scores on Fwd P/E (50%) + PEG (30%) + EV/EBITDA (20%).`
            );
          })()}
        >
          <div className="text-[10px] text-gray-500">Fwd Val gap (L − S)</div>
          <div className={`font-mono ${m.forward_val_gap != null && m.forward_val_gap > 0.15 ? "text-emerald-300" : m.forward_val_gap != null && m.forward_val_gap < -0.15 ? "text-red-300" : "text-gray-400"}`}>
            {m.forward_val_gap != null ? `${m.forward_val_gap >= 0 ? "+" : ""}${m.forward_val_gap.toFixed(2)}` : "—"}
          </div>
          <div className="text-[10px] text-gray-600">
            {m.forward_val_long_score != null && m.forward_val_short_score != null
              ? `L ${m.forward_val_long_score.toFixed(1)} / S ${m.forward_val_short_score.toFixed(1)}`
              : "Pillar 3"}
          </div>
        </div>
        <div
          title={(() => {
            const lc = m.momentum_long_components ?? null;
            const sc = m.momentum_short_components ?? null;
            const lRate = lc && typeof lc["rating_skew_raw"] === "number" ? (lc["rating_skew_raw"] as number).toFixed(2) : "—";
            const sRate = sc && typeof sc["rating_skew_raw"] === "number" ? (sc["rating_skew_raw"] as number).toFixed(2) : "—";
            const lG = lc && typeof lc["forward_eps_growth_pct"] === "number" ? `${(lc["forward_eps_growth_pct"] as number).toFixed(0)}%` : "—";
            const sG = sc && typeof sc["forward_eps_growth_pct"] === "number" ? `${(sc["forward_eps_growth_pct"] as number).toFixed(0)}%` : "—";
            return (
              `Earnings Momentum Gap (Pillar 2) = score(L) − score(S).\n` +
              `Positive ⇒ long has stronger forward-earnings momentum.\n\n` +
              `                Long          Short\n` +
              `  Rating skew   ${lRate.padStart(6)}        ${sRate}\n` +
              `  Fwd EPS g     ${lG.padStart(6)}        ${sG}\n` +
              `  Score         ${m.momentum_long_score?.toFixed(2) ?? "—"}          ${m.momentum_short_score?.toFixed(2) ?? "—"}\n\n` +
              `Sector-relative z-scores on rating skew (60%) + forward EPS growth (40%).`
            );
          })()}
        >
          <div className="text-[10px] text-gray-500">Momentum gap</div>
          <div className={`font-mono ${m.momentum_gap != null && m.momentum_gap > 0.15 ? "text-emerald-300" : m.momentum_gap != null && m.momentum_gap < -0.15 ? "text-red-300" : "text-gray-400"}`}>
            {m.momentum_gap != null ? `${m.momentum_gap >= 0 ? "+" : ""}${m.momentum_gap.toFixed(2)}` : "—"}
          </div>
          <div className="text-[10px] text-gray-600">Pillar 2</div>
        </div>
      </div>

      {agreement.decided_count > 0 && (
        <DirectionAgreementPanel p={p} longRow={longRow} shortRow={shortRow} />
      )}

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

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-gray-500 hover:text-gray-300 underline-offset-2 hover:underline"
        >
          {expanded ? "▾ Hide L vs S fundamentals" : "▸ Show L vs S fundamentals (Quality Δ breakdown)"}
        </button>
      </div>
      {expanded && (
        <QualityCompareCard p={p} long_row={longRow} short_row={shortRow} />
      )}
    </div>
  );
}

type SortKey =
  | "five_pillar"
  | "rv_quality"
  | "sharpe"
  | "carry"
  | "zscore"
  | "marginal_vol"
  | "quality"
  | "quality_x_carry"
  | "vol_vs_book"
  | "sharpe_liq"
  | "c_over_sigma"
  | "agreement"
  | "pm_thesis_alignment"
  | "forward_val_gap"
  | "momentum_gap"
  | "confluence"
  | "carry_sharpe_only"
  | "spread_sharpe_only";

export function PairIdeasSubTab({ pairs, rows }: Props) {
  const [minSharpe, setMinSharpe] = useState(0.15);
  const [minCorr, setMinCorr] = useState(0.30);
  const [showInverse, setShowInverse] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("five_pillar");
  const [onlyCointegrating, setOnlyCointegrating] = useState(false);
  const [hideDisagreements, setHideDisagreements] = useState(false);
  const [onlyAligned, setOnlyAligned] = useState(false);
  const [hideExpensiveLongs, setHideExpensiveLongs] = useState(false);

  const saa = pairs?.saa_anchored ?? [];
  const generic = pairs?.generic ?? [];
  const baskets = pairs?.baskets ?? {};
  const basketList = (
    ["valuation_tilted", "saa_faithful", "carry_optimized", "reverse_tilted"] as const
  )
    .map((k) => baskets[k])
    .filter((b): b is BasketMetrics => !!b);

  const portfolioVol = pairs?.portfolio_vol_daily_pct ?? null;

  // Build a symbol-keyed lookup so PairRow can access full row fundamentals
  // for the expandable Quality Compare card AND so the agreement filter/sort
  // can compute external-validator verdicts per pair.
  const rowsBySym: Record<string, TokenizedRow> = {};
  for (const r of rows ?? []) {
    rowsBySym[r.symbol] = r;
  }

  // Filter: keep pairs whose Sharpe (in either direction if showInverse) clears the threshold,
  // AND whose idiosyncratic correlation clears the min-corr threshold (user preference for
  // high-corr pairs — see feedback_pairs_prefer_high_corr).
  // Null Sharpe falls through — usually means too-short history; keep visible.
  // hideDisagreements drops pairs where >=1 external validator (Fund/Analyst × L/S) is "no";
  // pairs with no validator data populated stay visible.
  const passes = (p: PairIdea) => {
    const m = p.metrics;
    if (onlyCointegrating && m.is_cointegrating !== true) return false;
    const idio = m.correlation_residual_spy ?? m.correlation_weekday;
    if (minCorr > 0 && idio != null && idio < minCorr) return false;
    if (hideDisagreements) {
      const a = computeAgreement(p, rowsBySym[p.long_symbol], rowsBySym[p.short_symbol]);
      if (a.disagree_count > 0) return false;
    }
    if (onlyAligned && m.carry_conviction_aligned !== true) return false;
    if (hideExpensiveLongs) {
      // Drop pairs whose long leg is expensive on forward earnings
      // (Forward Valuation Score < -0.5). Pairs with no valuation data stay.
      const lv = m.forward_val_long_score;
      if (lv != null && lv < -0.5) return false;
    }
    const s = m.sharpe;
    if (s == null) return true;
    if (showInverse) return Math.abs(s) >= minSharpe;
    return s >= minSharpe;
  };

  // Sort key extractors
  const sortVal = (p: PairIdea): number => {
    const m = p.metrics;
    if (sortBy === "five_pillar") {
      // Citadel-style 5-pillar composite. Equal-weight prior 1/5 each on
      // quality_score, momentum_gap, forward_val_gap, analyst residual/10,
      // and carry_sharpe. Higher = stronger confluence in the displayed
      // direction. Missing pillars contribute 0 — pairs with more populated
      // pillars naturally rank higher.
      const q = m.quality_score ?? 0;
      const mg = m.momentum_gap ?? 0;
      const fvg = m.forward_val_gap ?? 0;
      const ar = (m.analyst_sentiment_residual ?? 0) / 10;
      const cs = m.carry_sharpe ?? 0;
      // Scale carry_sharpe up to match the [-2, +2] range of the other pillars
      const csScaled = Math.max(-2, Math.min(2, cs * 2));
      return q * 0.2 + mg * 0.2 + fvg * 0.2 + ar * 0.2 + csScaled * 0.2;
    }
    if (sortBy === "forward_val_gap") {
      // Cheap-long first
      return m.forward_val_gap ?? -1e9;
    }
    if (sortBy === "momentum_gap") {
      return m.momentum_gap ?? -1e9;
    }
    if (sortBy === "confluence") {
      // Product of pillar votes — rewards pairs where all 5 pillars agree.
      // We approximate "vote signs" by the signs of the pillar gaps. Pairs
      // with a missing pillar get a 0.5 multiplier on that term (mild penalty,
      // not exclusion) so partially-covered pairs still rank.
      const sign = (x: number | null | undefined) => (x == null ? 0.5 : Math.sign(x) || 0.5);
      const qs = sign(m.quality_score);
      const ms = sign(m.momentum_gap);
      const fs = sign(m.forward_val_gap);
      const as_ = sign(m.analyst_sentiment_residual);
      const cs = sign(m.carry_apr_pct_1x);
      const total = qs * ms * fs * as_ * cs;
      // Tie-break by magnitude of fwd val gap (forward valuation dominates)
      const mag = Math.abs(m.forward_val_gap ?? 0);
      return total * 10 + mag;
    }
    if (sortBy === "carry_sharpe_only") {
      return m.carry_sharpe ?? -1e9;
    }
    if (sortBy === "spread_sharpe_only") {
      return m.spread_sharpe ?? -1e9;
    }
    if (sortBy === "rv_quality") {
      // Correlation-adjusted Sharpe — penalises low-corr pairs.
      // See rvQualityScore() above. Default sort.
      const idio = m.correlation_residual_spy ?? m.correlation_weekday;
      return rvQualityScore(m.sharpe, idio) ?? -1e9;
    }
    if (sortBy === "c_over_sigma") {
      // Carry / spread vol — pure carry-harvest ranking
      const c = m.carry_apr_pct_1x;
      const s = m.spread_vol_daily_pct_1x;
      if (c == null || s == null || s <= 0) return -1e9;
      return (c / TRADING_DAYS_PER_YEAR) / s;
    }
    if (sortBy === "carry") return m.carry_apr_pct_1x ?? -1e9;
    if (sortBy === "zscore") {
      // Lower (more negative) z = better entry, so sort ascending by z
      return -(m.spread_zscore_today ?? 1e9);
    }
    if (sortBy === "marginal_vol") {
      // More negative marginal_vol = better diversifier, so sort ascending
      return -(m.marginal_vol_daily_pct ?? 1e9);
    }
    if (sortBy === "quality") return m.quality_score ?? -1e9;
    if (sortBy === "quality_x_carry") {
      // Composite alpha+carry score: signed quality × Sharpe.
      // Both positive ⇒ strong; one negative ⇒ neutralizing.
      const q = m.quality_score ?? 0;
      const s = m.sharpe ?? 0;
      return q * s;
    }
    if (sortBy === "vol_vs_book") {
      // Lower pair-vol/book-vol = calmest addition, sort ascending
      if (portfolioVol == null || portfolioVol <= 0) return -1e9;
      const pv = m.spread_vol_daily_pct_1x;
      return pv != null ? -(pv / portfolioVol) : -1e9;
    }
    if (sortBy === "sharpe_liq") {
      // Liquidity-adjusted Sharpe — penalizes thin pairs even when Sharpe is high
      return m.sharpe_liq_adjusted ?? -1e9;
    }
    if (sortBy === "agreement") {
      // External-validator agreement: net_score (∈ [-4, +4]) is the primary key,
      // corr-adjusted Sharpe is the tie-breaker so two equally-confirmed pairs
      // still rank by trade quality. Pairs with no validator data fall to the
      // bottom of the tied band rather than getting penalised.
      const a = computeAgreement(p, rowsBySym[p.long_symbol], rowsBySym[p.short_symbol]);
      const idio = m.correlation_residual_spy ?? m.correlation_weekday;
      const tieBreak = (rvQualityScore(m.sharpe, idio) ?? 0) / 100; // small relative weight
      return a.net_score + tieBreak;
    }
    if (sortBy === "pm_thesis_alignment") {
      // Prediction-market thesis edge × corr-adjusted Sharpe. Pairs where
      // PM markets create directional alpha AND the legs actually hedge each
      // other rank top. Pairs with no PM-edge data fall to bottom but don't
      // get penalised below pairs with explicit zero edge.
      const edge = m.pm_thesis_edge?.max_edge_magnitude_pp ?? 0;
      const idio = m.correlation_residual_spy ?? m.correlation_weekday;
      const rv = rvQualityScore(m.sharpe, idio) ?? 0;
      return edge * Math.max(0.1, rv);  // floor on rv so a strong PM-edge still ranks
    }
    return m.sharpe ?? -1e9;
  };

  const sortDesc = (a: PairIdea, b: PairIdea) => sortVal(b) - sortVal(a);

  const saaShown = saa.filter(passes).slice().sort(sortDesc);
  const genericShown = generic.filter(passes).slice().sort(sortDesc);
  const saaHidden = saa.length - saaShown.length;
  const genericHidden = generic.length - genericShown.length;

  if (!pairs || (saa.length === 0 && generic.length === 0 && basketList.length === 0)) {
    return (
      <div className="p-6 text-center text-xs text-gray-500">
        Pair engine has no data yet. Refresh runs every 24h and fetches full Binance funding
        history + 2y daily underlying returns per contract. Newly-listed contracts (≤15 weekday
        returns) are excluded from spread vol but kept in funding aggregates.
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
        <div className="flex items-center gap-3 flex-wrap">
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
          <span
            className="text-gray-500 ml-2"
            title="Filter out pairs whose legs don't actually hedge each other. Idiosyncratic corr is Pearson on returns after SPY beta is stripped. < 0.3 = carry-only trade dressed as a pair."
          >
            Min idio corr:
          </span>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            value={minCorr}
            onChange={(e) => setMinCorr(parseFloat(e.target.value))}
            className="w-28 accent-cyan-500"
          />
          <span className={`font-mono w-10 ${corrColor(minCorr)}`}>
            {minCorr.toFixed(2)}
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-500 hover:text-gray-300">
            <input
              type="checkbox"
              checked={showInverse}
              onChange={(e) => setShowInverse(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>show inverse</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-500 hover:text-gray-300">
            <input
              type="checkbox"
              checked={onlyCointegrating}
              onChange={(e) => setOnlyCointegrating(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>cointegrating only</span>
          </label>
          <label
            className="flex items-center gap-1.5 cursor-pointer text-gray-500 hover:text-gray-300"
            title="Drop any pair where any of the 5 pillars contradict the trade direction. Pairs with no validator data populated stay visible."
          >
            <input
              type="checkbox"
              checked={hideDisagreements}
              onChange={(e) => setHideDisagreements(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>hide pillar disagreements</span>
          </label>
          <label
            className="flex items-center gap-1.5 cursor-pointer text-gray-500 hover:text-gray-300"
            title="Show only pairs where carry direction AND conviction direction (sum of fundamental pillars) point the same way. These are confluence setups."
          >
            <input
              type="checkbox"
              checked={onlyAligned}
              onChange={(e) => setOnlyAligned(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>carry-conviction aligned only</span>
          </label>
          <label
            className="flex items-center gap-1.5 cursor-pointer text-gray-500 hover:text-gray-300"
            title="Drop pairs whose long leg has Forward Valuation Score < -0.5 (expensive on forward earnings)."
          >
            <input
              type="checkbox"
              checked={hideExpensiveLongs}
              onChange={(e) => setHideExpensiveLongs(e.target.checked)}
              className="accent-amber-500"
            />
            <span>hide expensive longs (Fwd Val &lt; -0.5)</span>
          </label>
          <span className="text-gray-500 ml-2">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-gray-200"
          >
            <option value="five_pillar">5-pillar composite ★</option>
            <option value="forward_val_gap">Forward Val gap (cheap-long ranked)</option>
            <option value="momentum_gap">Momentum gap</option>
            <option value="confluence">Confluence (5/5 pillar agreement)</option>
            <option value="carry_sharpe_only">Carry-Sharpe only</option>
            <option value="spread_sharpe_only">Spread-Sharpe only</option>
            <option value="rv_quality">RV quality (corr-adjusted Sharpe)</option>
            <option value="pm_thesis_alignment">PM-thesis edge × RV quality</option>
            <option value="agreement">Most pillar agreement</option>
            <option value="c_over_sigma">Carry / vol (carry harvest)</option>
            <option value="quality_x_carry">Quality × Carry (alpha + carry)</option>
            <option value="quality">Quality Δ (Pillar 1)</option>
            <option value="sharpe_liq">Sharpe (liquidity-adjusted)</option>
            <option value="sharpe">Sharpe (1:1, raw)</option>
            <option value="carry">Carry APR</option>
            <option value="marginal_vol">Marginal vol (diversifiers first)</option>
            <option value="vol_vs_book">Vol vs book (calmest first)</option>
            <option value="zscore">z-score (entry quality)</option>
          </select>
        </div>
        <div className="text-gray-500">
          {saaShown.length + genericShown.length} of {saa.length + generic.length}
          {saaHidden + genericHidden > 0 && (
            <span className="text-gray-600"> · {saaHidden + genericHidden} hidden</span>
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
              <PairRow
                key={`saa-${i}-${p.long_symbol}-${p.short_symbol}`}
                p={p}
                portfolioVol={portfolioVol}
                longRow={rowsBySym[p.long_symbol]}
                shortRow={rowsBySym[p.short_symbol]}
              />
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
            <PairRow
              key={`gen-${i}-${p.long_symbol}-${p.short_symbol}`}
              p={p}
              portfolioVol={portfolioVol}
              longRow={rowsBySym[p.long_symbol]}
              shortRow={rowsBySym[p.short_symbol]}
            />
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
          <span className="text-gray-500 font-semibold not-italic">Methodology summary.</span>{" "}
          Research-only. Each pair card shows three layers:
        </div>
        <div>
          <span className="text-gray-400">Risk layer:</span> 1:1 dollar-neutral primary; β-Sharpe
          shown alongside with the OLS hedge ratio h*. Marginal-vol-vs-live-portfolio classification
          (Diversifier / Neutral / Additive) is the headline PM metric for portfolio construction.
          Cointegration screen (ADF / EG / half-life / Hurst on the β-hedged log-price spread)
          feeds the trade-type badge. Idiosyncratic correlation = Pearson on returns after SPY beta
          is stripped (raw / EWMA / Spearman on hover).
        </div>
        <div>
          <span className="text-gray-400">Trade-type badge:</span> distinguishes alpha sources so
          z-score timing / cointegration math aren't applied to pairs that don't mean-revert.
          {" "}
          <span className="text-emerald-300">RV</span> = idio corr ≥ 0.5 AND cointegrates (pure
          mean-reversion).{" "}
          <span className="text-cyan-200">RV + Carry</span> = RV plus c/σ ≥ 0.05 (best-of-both
          — real hedge with funding boost).{" "}
          <span className="text-amber-300">Carry</span> = idio corr &lt; 0.3 AND carry APR ≥ 30%
          (funding harvest, NOT a hedge — short barely offsets long).{" "}
          <span className="text-gray-400">Hybrid</span> = everything else.
          {" "}
          c/σ = daily carry / daily spread vol (what fraction of a daily 1σ adverse spread move the
          carry offsets). T* = (σ/c)² days, the horizon at which cumulative carry covers a 1σ
          random-walk drift — useful for carry-only trades to anchor minimum holding period.
        </div>
        <div>
          <span className="text-gray-400">Default sort = RV quality (corr-adjusted Sharpe):</span>
          {" "}
          weights raw Sharpe by max(0, min(1.5, (idio_corr − 0.2)/0.3)). Corr 0.5 → weight 1.0,
          corr ≥ 0.65 → weight 1.5 (cap), corr ≤ 0.2 → weight 0. Reflects the policy bias toward
          pairs whose short leg actually hedges the long leg, even at the cost of giving up some
          headline carry-driven Sharpe.
        </div>
        <div>
          <span className="text-gray-400">Alpha layer:</span> Quality Δ composite ∈ [-2, +2] from
          (revenue + EPS growth) × 40% + operating margin × 20% + ROE × 15% + forward EPS growth ×
          15% − valuation premium × 10%. Sourced from Alpha Vantage OVERVIEW (24h refresh).
          Click "Show L vs S fundamentals" on any pair for the full side-by-side comparison table.
        </div>
        <div>
          <span className="text-gray-400">Carry edge:</span> Funding uses full per-contract history,
          weekday-only (Mon–Fri UTC). Spread vol from 2y yfinance underlying daily log returns
          (NYSE close-to-close). 2x leverage values in tooltips. Sharpe is leverage-invariant.
        </div>
      </div>
    </div>
  );
}
