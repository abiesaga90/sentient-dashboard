import type {
  Fundamentals,
  PairIdea,
  TokenizedRow,
} from "../../../hooks/useTokenizedAssets";

// Per-cell verdict.
//   yes  = signal AGREES with the trade direction on this leg
//   no   = signal CONTRADICTS the trade direction (directional concern)
//   na   = signal unavailable or in the neutral band
export type Verdict = "yes" | "no" | "na";

export interface AgreementCells {
  fund_long: Verdict;
  fund_short: Verdict;
  analyst_long: Verdict;
  analyst_short: Verdict;
}

export interface AgreementResult {
  cells: AgreementCells;
  agree_count: number;     // # of "yes" across all 4 cells
  disagree_count: number;  // # of "no"
  decided_count: number;   // agree + disagree (i.e. populated cells)
  net_score: number;       // agree - disagree, range [-4, +4]
  // Per-cell display strings (small fundamentals/analyst snippets)
  fund_long_detail: string;
  fund_short_detail: string;
  analyst_long_detail: string;
  analyst_short_detail: string;
}

const POS_THRESHOLD_PCT = 5;   // analyst-upside band: > +5% counts as "yes" on long
const NEG_THRESHOLD_PCT = -5;  // analyst-upside band: < -5% counts as "yes" on short

// Compute per-leg fundamental health score: counts how many of
// revenue_growth_yoy / eps_growth_yoy / operating_margin_ttm are clearly positive.
// Returns null if no inputs are populated.
function fundHealth(f: Fundamentals | undefined): {
  healthy: number;
  populated: number;
} | null {
  if (!f) return null;
  let healthy = 0;
  let populated = 0;
  const checks: Array<[number | undefined, number]> = [
    [f.revenue_growth_yoy, 0.02],     // >2% YoY revenue growth
    [f.eps_growth_yoy, 0.05],         // >5% YoY EPS growth
    [f.operating_margin_ttm, 0.05],   // >5% op margin
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
    if (ratio >= 0.66) return "yes";   // healthy business -> backs the long
    if (ratio <= 0.33) return "no";    // shrinking / losing money -> directional concern
    return "na";
  }
  // side === "short"
  if (ratio <= 0.33) return "yes";     // weak business -> backs the short
  if (ratio >= 0.66) return "no";      // strong business shorted -> squeeze risk
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

export function computeAgreement(
  p: PairIdea,
  longRow?: TokenizedRow,
  shortRow?: TokenizedRow,
): AgreementResult {
  const lH = fundHealth(longRow?.fundamentals);
  const sH = fundHealth(shortRow?.fundamentals);
  const aL = p.metrics.analyst_upside_long_pct;
  const aS = p.metrics.analyst_upside_short_pct;

  const cells: AgreementCells = {
    fund_long: verdictFromHealth(lH, "long"),
    fund_short: verdictFromHealth(sH, "short"),
    analyst_long: analystVerdict(aL, "long"),
    analyst_short: analystVerdict(aS, "short"),
  };

  const all: Verdict[] = [
    cells.fund_long,
    cells.fund_short,
    cells.analyst_long,
    cells.analyst_short,
  ];
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
    analyst_long_detail: analystDetail(aL),
    analyst_short_detail: analystDetail(aS),
  };
}

// Lightweight summary chip class for header use
export function agreementChipClass(net: number, decided: number): string {
  if (decided === 0) return "border-gray-700 bg-gray-900/40 text-gray-400";
  if (net >= 3) return "border-emerald-500 bg-emerald-950/70 text-emerald-200 font-bold";
  if (net >= 1) return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
  if (net <= -3) return "border-red-500 bg-red-950/70 text-red-200 font-bold";
  if (net <= -1) return "border-amber-700 bg-amber-950/40 text-amber-300";
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

interface PanelProps {
  p: PairIdea;
  longRow?: TokenizedRow;
  shortRow?: TokenizedRow;
}

export function DirectionAgreementPanel({ p, longRow, shortRow }: PanelProps) {
  const a = computeAgreement(p, longRow, shortRow);
  const lTag = p.long_symbol.replace("USDT", "");
  const sTag = p.short_symbol.replace("USDT", "");

  return (
    <div className="mt-2 bg-slate-950/40 border border-[var(--border)] rounded-md px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-gray-400">
          Direction agreement
          <span
            className="ml-2 text-[10px] text-gray-600"
            title={
              "External validators: do fundamentals and the analyst street view " +
              "confirm the trade direction on each leg?\n\n" +
              "Long leg ✓: business is healthy AND/OR analysts see upside.\n" +
              "Short leg ✓: business is shrinking/unprofitable AND/OR analysts see downside.\n" +
              "An ✗ flags a directional concern (squeeze risk on the short, or stale long thesis)."
            }
          >
            (ext. validators)
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
            <th className="text-left pl-1 font-normal w-[120px]">&nbsp;</th>
            <th className="text-left font-normal text-emerald-400/70">L · {lTag}</th>
            <th className="text-left font-normal text-red-400/70">S · {sTag}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-800/50">
            <td className="py-1 pl-1 text-gray-400" title="Long ✓: healthy growth/margins on L · Short ✓: weak growth/margins on S (consistent with shorting it)">
              Fundamentals
              <span className="ml-1 text-[9px] text-gray-600 not-italic">
                AV OVERVIEW · TTM
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
            <td className="py-1 pl-1 text-gray-400" title="Long ✓: analyst mean target > +5% above mark · Short ✓: analyst mean target < -5% below mark">
              Analysts
              <span className="ml-1 text-[9px] text-gray-600 not-italic">
                Finnhub · mean target
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
        </tbody>
      </table>

      <div className="mt-1.5 text-[9px] text-gray-600 italic leading-snug">
        Sources: Alpha Vantage OVERVIEW (revenue / EPS growth YoY, operating margin TTM ·
        24h refresh) · Finnhub /stock/price-target (mean analyst target vs current mark ·
        coverage varies, often empty for non-US tickers and commodities/ETFs).
      </div>
    </div>
  );
}
