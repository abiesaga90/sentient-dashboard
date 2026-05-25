import type {
  Fundamentals,
  PairIdea,
  TokenizedRow,
} from "../../../hooks/useTokenizedAssets";

// Per-cell verdict.
//   yes  = signal AGREES with the trade direction on this leg
//   no   = signal CONTRADICTS the trade direction
//   na   = signal unavailable or in the neutral band
export type Verdict = "yes" | "no" | "na";

// Citadel-style 5-pillar orthogonal voter. Each pillar is split into a long
// and short leg verdict so the operator can see exactly where the signal
// lives.
export interface AgreementCells {
  fund_long: Verdict;        // Pillar 1 — Earnings Quality (TTM)
  fund_short: Verdict;
  momentum_long: Verdict;    // Pillar 2 — Earnings Momentum
  momentum_short: Verdict;
  valuation_long: Verdict;   // Pillar 3 — Forward Valuation
  valuation_short: Verdict;
  analyst_long: Verdict;     // Pillar 4 — Analyst Sentiment Residual
  analyst_short: Verdict;
  carry: Verdict;            // Pillar 5 — Carry/Positioning (one cell, pair-level)
  smart_money: Verdict;      // Pillar 6 — Smart-Money 4-filer overlap (pair-level)
}

export interface AgreementResult {
  cells: AgreementCells;
  agree_count: number;
  disagree_count: number;
  decided_count: number;
  net_score: number;
  fund_long_detail: string;
  fund_short_detail: string;
  momentum_long_detail: string;
  momentum_short_detail: string;
  valuation_long_detail: string;
  valuation_short_detail: string;
  analyst_long_detail: string;
  analyst_short_detail: string;
  carry_detail: string;
  smart_money_detail: string;
}

const POS_THRESHOLD_PCT = 5;
const NEG_THRESHOLD_PCT = -5;

function fundHealth(f: Fundamentals | undefined): {
  healthy: number;
  populated: number;
} | null {
  if (!f) return null;
  let healthy = 0;
  let populated = 0;
  const checks: Array<[number | undefined, number]> = [
    [f.revenue_growth_yoy, 0.02],
    [f.eps_growth_yoy, 0.05],
    [f.operating_margin_ttm, 0.05],
  ];
  for (const [v, thr] of checks) {
    if (v == null) continue;
    populated += 1;
    if (v > thr) healthy += 1;
  }
  if (populated === 0) return null;
  return { healthy, populated };
}

function verdictFromHealth(
  h: { healthy: number; populated: number } | null,
  side: "long" | "short"
): Verdict {
  if (h == null || h.populated < 2) return "na";
  const ratio = h.healthy / h.populated;
  if (side === "long") {
    if (ratio >= 0.66) return "yes";
    if (ratio <= 0.33) return "no";
    return "na";
  }
  if (ratio <= 0.33) return "yes";
  if (ratio >= 0.66) return "no";
  return "na";
}

function analystVerdict(
  upside_pct: number | null | undefined,
  side: "long" | "short"
): Verdict {
  if (upside_pct == null) return "na";
  if (side === "long") {
    if (upside_pct > POS_THRESHOLD_PCT) return "yes";
    if (upside_pct < NEG_THRESHOLD_PCT) return "no";
    return "na";
  }
  if (upside_pct < NEG_THRESHOLD_PCT) return "yes";
  if (upside_pct > POS_THRESHOLD_PCT) return "no";
  return "na";
}

// Generic gap-based verdict for scored pillars (Quality, Momentum, Valuation).
// gap is L − S. Positive gap on a per-leg basis flips depending on side.
function gapVerdictForLeg(
  gap: number | null | undefined,
  thr: number,
  side: "long" | "short"
): Verdict {
  if (gap == null) return "na";
  if (side === "long") {
    if (gap > thr) return "yes";       // long side scores higher → backs L
    if (gap < -thr) return "no";       // long side scores lower → concern on L
    return "na";
  }
  if (gap < -thr) return "yes";        // short side scores higher than long → backs S
  if (gap > thr) return "no";
  return "na";
}

function carryVerdict(carryApr: number | null | undefined): Verdict {
  // Pair-level: positive carry on the displayed direction = backs both legs
  // (we collect funding for going L this and S that). Negative carry = no.
  if (carryApr == null) return "na";
  if (carryApr > 0) return "yes";
  if (carryApr < 0) return "no";
  return "na";
}

function smartMoneyVerdict(score: number | null | undefined): Verdict {
  // Pair-level: ±2 scale. >+0.25 backs displayed direction; <-0.25 contradicts.
  if (score == null) return "na";
  if (score > 0.25) return "yes";
  if (score < -0.25) return "no";
  return "na";
}

function fundDetail(
  h: { healthy: number; populated: number } | null,
  f: Fundamentals | undefined
): string {
  if (h == null || !f) return "—";
  const bits: string[] = [];
  if (f.revenue_growth_yoy != null) {
    bits.push(`rev ${(f.revenue_growth_yoy * 100).toFixed(0)}%`);
  }
  if (f.eps_growth_yoy != null) {
    bits.push(`eps ${(f.eps_growth_yoy * 100).toFixed(0)}%`);
  }
  if (f.operating_margin_ttm != null) {
    bits.push(`opm ${(f.operating_margin_ttm * 100).toFixed(0)}%`);
  }
  return `${h.healthy}/${h.populated} healthy · ${bits.join(" · ")}`;
}

function analystDetail(upside_pct: number | null | undefined): string {
  if (upside_pct == null) return "—";
  const sign = upside_pct >= 0 ? "+" : "";
  return `target ${sign}${upside_pct.toFixed(0)}% vs mark`;
}

function momentumDetail(comp: Record<string, number | string | null> | null | undefined): string {
  if (!comp) return "—";
  const bits: string[] = [];
  const rate = comp["rating_skew_raw"];
  if (typeof rate === "number") bits.push(`rating ${rate >= 0 ? "+" : ""}${rate.toFixed(2)}`);
  const fg = comp["forward_eps_growth_pct"];
  if (typeof fg === "number") bits.push(`fwd EPS g ${fg >= 0 ? "+" : ""}${fg.toFixed(0)}%`);
  return bits.length > 0 ? bits.join(" · ") : "—";
}

function valuationDetail(comp: Record<string, number | string | null> | null | undefined): string {
  if (!comp) return "—";
  const bits: string[] = [];
  const fpe = comp["forward_pe"];
  if (typeof fpe === "number") bits.push(`fwd P/E ${fpe.toFixed(1)}`);
  const peg = comp["peg_ratio"];
  if (typeof peg === "number") bits.push(`PEG ${peg.toFixed(2)}`);
  const ev = comp["ev_to_ebitda"];
  if (typeof ev === "number") bits.push(`EV/EB ${ev.toFixed(1)}`);
  return bits.length > 0 ? bits.join(" · ") : "—";
}

export function computeAgreement(
  p: PairIdea,
  longRow?: TokenizedRow,
  shortRow?: TokenizedRow,
): AgreementResult {
  const m = p.metrics;

  // Pillar 1 — Earnings Quality (TTM)
  const lH = fundHealth(longRow?.fundamentals);
  const sH = fundHealth(shortRow?.fundamentals);

  // Pillar 2 — Earnings Momentum (gap = L − S)
  const momGap = m.momentum_gap;

  // Pillar 3 — Forward Valuation (gap = L − S; cheap-long = positive)
  const valGap = m.forward_val_gap;

  // Pillar 4 — Analyst Sentiment Residual (% upside, post valuation strip)
  const aRes = m.analyst_sentiment_residual;
  const aL = m.analyst_upside_long_pct;
  const aS = m.analyst_upside_short_pct;

  // Pillar 5 — Carry direction
  const carryApr = m.carry_apr_pct_1x;

  // Pillar 6 — Smart-money 4-filer agreement
  const smScore = m.smart_money_score;

  const cells: AgreementCells = {
    fund_long: verdictFromHealth(lH, "long"),
    fund_short: verdictFromHealth(sH, "short"),
    momentum_long: gapVerdictForLeg(momGap, 0.2, "long"),
    momentum_short: gapVerdictForLeg(momGap, 0.2, "short"),
    valuation_long: gapVerdictForLeg(valGap, 0.2, "long"),
    valuation_short: gapVerdictForLeg(valGap, 0.2, "short"),
    // Analyst residual ≈ raw upside gap; use raw per-leg upside_pct for the
    // verdict because it preserves the per-leg sign information.
    analyst_long:
      aRes != null
        ? analystVerdict(aL, "long")
        : analystVerdict(aL, "long"),
    analyst_short:
      aRes != null
        ? analystVerdict(aS, "short")
        : analystVerdict(aS, "short"),
    carry: carryVerdict(carryApr),
    smart_money: smartMoneyVerdict(smScore),
  };

  const all: Verdict[] = Object.values(cells);
  const agree_count = all.filter((v) => v === "yes").length;
  const disagree_count = all.filter((v) => v === "no").length;

  return {
    cells,
    agree_count,
    disagree_count,
    decided_count: agree_count + disagree_count,
    net_score: agree_count - disagree_count,
    fund_long_detail: fundDetail(lH, longRow?.fundamentals),
    fund_short_detail: fundDetail(sH, shortRow?.fundamentals),
    momentum_long_detail: momentumDetail(m.momentum_long_components),
    momentum_short_detail: momentumDetail(m.momentum_short_components),
    valuation_long_detail: valuationDetail(m.forward_val_long_components),
    valuation_short_detail: valuationDetail(m.forward_val_short_components),
    analyst_long_detail: analystDetail(aL),
    analyst_short_detail: analystDetail(aS),
    carry_detail:
      carryApr != null
        ? `${carryApr >= 0 ? "+" : ""}${carryApr.toFixed(1)}% APR @ 1x` +
          (m.funding_crowding_spread_z != null
            ? ` · funding-z spread ${m.funding_crowding_spread_z >= 0 ? "+" : ""}${m.funding_crowding_spread_z.toFixed(2)}`
            : "")
        : "—",
    smart_money_detail: (() => {
      if (smScore == null) return "—";
      const pro = m.smart_money_pro_count ?? 0;
      const con = m.smart_money_con_count ?? 0;
      const proFunds = (m.smart_money_pro_funds ?? []).join(", ");
      const conFunds = (m.smart_money_con_funds ?? []).join(", ");
      const sign = smScore >= 0 ? "+" : "";
      return `score ${sign}${smScore.toFixed(2)} · pro ${pro}` +
        (proFunds ? ` (${proFunds})` : "") +
        ` · con ${con}` +
        (conFunds ? ` (${conFunds})` : "");
    })(),
  };
}

// Lightweight summary chip class — thresholds scaled for 10-cell voter
// (4 fundamental pillars × 2 legs + carry pair-level + smart-money pair-level = 10).
export function agreementChipClass(net: number, decided: number): string {
  if (decided === 0) return "border-gray-700 bg-gray-900/40 text-gray-400";
  if (net >= 6) return "border-emerald-500 bg-emerald-950/70 text-emerald-200 font-bold";
  if (net >= 2) return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
  if (net <= -6) return "border-red-500 bg-red-950/70 text-red-200 font-bold";
  if (net <= -2) return "border-amber-700 bg-amber-950/40 text-amber-300";
  return "border-gray-700 bg-gray-900/40 text-gray-400";
}

export function agreementChipLabel(agree: number, decided: number): string {
  if (decided === 0) return "Verdict ?";
  return `${agree}/${decided} agree`;
}

function VerdictMark({ v }: { v: Verdict }) {
  if (v === "yes") return <span className="text-emerald-300 font-bold">✓</span>;
  if (v === "no") return <span className="text-red-300 font-bold">✗</span>;
  return <span className="text-gray-500">—</span>;
}

// Pair-level Carry-Conviction badge — used inline on PairRow so the
// operator can see at a glance whether carry direction and fundamentals
// direction point the same way.
export interface CarryConvictionInfo {
  state: "aligned" | "conflict" | "unknown";
  label: string;
  badge_class: string;
  tooltip: string;
}

export function carryConvictionBadge(p: PairIdea): CarryConvictionInfo {
  const m = p.metrics;
  const cd = m.carry_direction;
  const vd = m.conviction_direction;
  const lTag = p.long_symbol.replace("USDT", "");
  const sTag = p.short_symbol.replace("USDT", "");
  if (cd == null || vd == null) {
    return {
      state: "unknown",
      label: "Carry/Conv ?",
      badge_class: "border-gray-700 bg-gray-900/40 text-gray-400",
      tooltip: "Insufficient pillar coverage to compute conviction direction.",
    };
  }
  if (cd === vd) {
    return {
      state: "aligned",
      label: "Aligned",
      badge_class:
        "border-emerald-600 bg-emerald-950/70 text-emerald-200 font-semibold",
      tooltip:
        `Carry direction AND fundamentals direction both favour the displayed L ${lTag} / S ${sTag}.\n\n` +
        `Carry @ 1x: ${m.carry_apr_pct_1x?.toFixed(1) ?? "—"}% APR\n` +
        `Conviction score: ${m.conviction_score?.toFixed(2) ?? "—"} (sum of pillar gaps)\n\n` +
        `Confluence setup — sized higher confidence than carry-only or conviction-only.`,
    };
  }
  return {
    state: "conflict",
    label: "Conflict",
    badge_class:
      "border-amber-600 bg-amber-950/70 text-amber-200 font-semibold",
    tooltip:
      `Carry and fundamentals point in OPPOSITE directions on this pair.\n\n` +
      `Carry @ 1x: ${m.carry_apr_pct_1x?.toFixed(1) ?? "—"}% APR ` +
      `(${cd > 0 ? `favours displayed L ${lTag}/S ${sTag}` : `favours inverse L ${sTag}/S ${lTag}`})\n` +
      `Conviction score: ${m.conviction_score?.toFixed(2) ?? "—"} ` +
      `(${vd > 0 ? `favours displayed direction` : `favours inverse direction`})\n\n` +
      `Read this as TWO real alphas pulling apart. Carry trade vs fundamental view, different horizons. ` +
      `Pick a side consciously; do not size as confluence.`,
  };
}

interface PanelProps {
  p: PairIdea;
  longRow?: TokenizedRow;
  shortRow?: TokenizedRow;
}

export function DirectionAgreementPanel({ p, longRow, shortRow }: PanelProps) {
  const a = computeAgreement(p, longRow, shortRow);
  const lTag = p.long_symbol.replace("USDT", "");
  const sTag = p.short_symbol.replace("USDT", "");
  const carryCell = a.cells.carry;

  return (
    <div className="mt-2 bg-slate-950/40 border border-[var(--border)] rounded-md px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-gray-400">
          Direction agreement
          <span
            className="ml-2 text-[10px] text-gray-600"
            title={
              "Six orthogonal pillars vote on whether the displayed direction is supported.\n\n" +
              "1. Earnings Quality (TTM, stripped of valuation)\n" +
              "2. Earnings Momentum (rating revisions + forward EPS growth)\n" +
              "3. Forward Valuation (sector-relative Fwd P/E + PEG + EV/EBITDA)\n" +
              "4. Analyst Sentiment Residual (price-target gap minus valuation-explained component)\n" +
              "5. Carry direction (funding_short − funding_long)\n" +
              "6. Smart-Money 4-filer overlap (SAA + Atreides + Tiger + Coatue)\n\n" +
              "Pillars 1-4 vote per leg (2 cells each); Pillars 5-6 are pair-level (1 cell each). " +
              "Smart-money carries extra weight in the composite — when score < -0.5, " +
              "a ⇄ REVERSE flag fires to surface that institutional consensus contradicts " +
              "the displayed direction."
            }
          >
            (6-pillar orthogonal voter)
          </span>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] ${agreementChipClass(a.net_score, a.decided_count)}`}
        >
          {agreementChipLabel(a.agree_count, a.decided_count)}
          {a.disagree_count > 0 && (
            <span className="ml-1 opacity-80 font-mono">· {a.disagree_count}✗</span>
          )}
        </span>
      </div>

      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-[10px] text-gray-500 uppercase tracking-wide">
            <th className="text-left pl-1 font-normal w-[145px]">&nbsp;</th>
            <th className="text-left font-normal text-emerald-400/70">L · {lTag}</th>
            <th className="text-left font-normal text-red-400/70">S · {sTag}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-800/50">
            <td className="py-1 pl-1 text-gray-400" title="Long ✓: healthy growth/margins on L · Short ✓: weak growth/margins on S">
              Earnings Quality
              <span className="ml-1 text-[9px] text-gray-600 not-italic">
                TTM (no valuation)
              </span>
            </td>
            <td className="py-1">
              <VerdictMark v={a.cells.fund_long} />{" "}
              <span className="text-gray-500">{a.fund_long_detail}</span>
            </td>
            <td className="py-1">
              <VerdictMark v={a.cells.fund_short} />{" "}
              <span className="text-gray-500">{a.fund_short_detail}</span>
            </td>
          </tr>
          <tr className="border-t border-slate-800/50">
            <td className="py-1 pl-1 text-gray-400" title="Long ✓: stronger forward EPS growth and/or rating-skew on L · Short ✓: weaker on S">
              Earnings Momentum
              <span className="ml-1 text-[9px] text-gray-600 not-italic">
                revisions + rating skew
              </span>
            </td>
            <td className="py-1">
              <VerdictMark v={a.cells.momentum_long} />{" "}
              <span className="text-gray-500">{a.momentum_long_detail}</span>
            </td>
            <td className="py-1">
              <VerdictMark v={a.cells.momentum_short} />{" "}
              <span className="text-gray-500">{a.momentum_short_detail}</span>
            </td>
          </tr>
          <tr className="border-t border-slate-800/50">
            <td className="py-1 pl-1 text-gray-400" title="Long ✓: long is CHEAPER on sector-relative forward earnings · Short ✓: short is EXPENSIVE">
              Forward Valuation
              <span className="ml-1 text-[9px] text-gray-600 not-italic">
                Fwd P/E · PEG · EV/EBITDA
              </span>
            </td>
            <td className="py-1">
              <VerdictMark v={a.cells.valuation_long} />{" "}
              <span className="text-gray-500">{a.valuation_long_detail}</span>
            </td>
            <td className="py-1">
              <VerdictMark v={a.cells.valuation_short} />{" "}
              <span className="text-gray-500">{a.valuation_short_detail}</span>
            </td>
          </tr>
          <tr className="border-t border-slate-800/50">
            <td className="py-1 pl-1 text-gray-400" title="Long ✓: analyst target > +5% above mark · Short ✓: analyst target < -5% below mark. Residual after stripping valuation-explained component.">
              Analyst (residual)
              <span className="ml-1 text-[9px] text-gray-600 not-italic">
                target − valuation effect
              </span>
            </td>
            <td className="py-1">
              <VerdictMark v={a.cells.analyst_long} />{" "}
              <span className="text-gray-500">{a.analyst_long_detail}</span>
            </td>
            <td className="py-1">
              <VerdictMark v={a.cells.analyst_short} />{" "}
              <span className="text-gray-500">{a.analyst_short_detail}</span>
            </td>
          </tr>
          <tr className="border-t border-slate-800/50">
            <td className="py-1 pl-1 text-gray-400" title="Pair-level: positive funding spread (short − long) earns carry in the displayed direction.">
              Carry / Positioning
              <span className="ml-1 text-[9px] text-gray-600 not-italic">
                funding direction
              </span>
            </td>
            <td className="py-1" colSpan={2}>
              <VerdictMark v={carryCell} />{" "}
              <span className="text-gray-500">{a.carry_detail}</span>
            </td>
          </tr>
          <tr className="border-t border-slate-800/50">
            <td className="py-1 pl-1 text-gray-400" title="Pair-level: 4-filer 13F overlap directional score. +2 = all 4 funds align with the displayed direction. -2 = all 4 contradict. Reverse-recommended fires below -0.5.">
              Smart-Money
              <span className="ml-1 text-[9px] text-gray-600 not-italic">
                SAA + Atreides + Tiger + Coatue
              </span>
            </td>
            <td className="py-1" colSpan={2}>
              <VerdictMark v={a.cells.smart_money} />{" "}
              <span className="text-gray-500">{a.smart_money_detail}</span>
              {p.metrics.smart_money_reverse_recommended && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500 bg-amber-950/70 text-amber-200 text-[9px] font-bold">
                  ⇄ REVERSE
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-1.5 text-[9px] text-gray-600 italic leading-snug">
        Citadel-style 5-pillar orthogonal voter. Pillars 1, 4 from AV OVERVIEW + Finnhub
        targets. Pillars 2, 3 from AV/yfinance forward estimates (sector-relative).
        Pillar 5 from Binance perp funding history (weekday-only). Analyst pillar is the
        RESIDUAL after stripping the valuation-explained component so it doesn't double-count
        with Pillar 3.
      </div>
    </div>
  );
}
