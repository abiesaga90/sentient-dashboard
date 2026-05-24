import type { TripleIdea } from "../../../hooks/useTokenizedAssets";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { fmtPct, fmtNum } from "./format";

interface Props {
  triples: TripleIdea[];
  stagedIndices: Set<number>;
  onClear: () => void;
  portfolioVolDailyPct?: number | null;
}

/**
 * Aggregate metrics across staged triples. All numbers per "1 unit of long
 * notional" within each triple — staging two triples means doubling the
 * aggregate notional. Consolidates per-stock weights across triples so a
 * stock that appears in multiple staged triples is correctly summed.
 */
interface Aggregate {
  n_triples: number;
  longs: Record<string, number>;     // symbol → total long weight
  shorts: Record<string, number>;    // symbol → total short weight
  gross_long: number;                // Σ all long weights
  gross_short: number;               // Σ all short weights
  net: number;                       // long − short
  net_carry_apr_pct: number;         // weighted net funding carry
  net_beta_spy: number;              // ~0 if all constituents are β-neutral triples
  net_beta_basket: number | null;
  quality_diff_avg: number;          // average Q diff across staged triples
  spread_vol_aggregate_daily_pct: number | null;  // sqrt(Σ vol²) approximation
  sharpe_estimate: number | null;
}

function aggregate(triples: TripleIdea[], stagedIndices: Set<number>): Aggregate {
  const longs: Record<string, number> = {};
  const shorts: Record<string, number> = {};
  let gross_long = 0;
  let gross_short = 0;
  let net_carry = 0;
  let net_beta_spy = 0;
  let net_beta_basket: number | null = 0;
  let beta_basket_coverage = 0;
  let q_diff_sum = 0;
  let vol_sq_sum = 0;
  let vol_coverage = 0;

  triples.forEach((t, idx) => {
    if (!stagedIndices.has(idx)) return;
    const m = t.metrics;
    const w_L = t.weights[t.long_symbol] ?? 1.0;
    const w_S1 = t.weights[t.short_symbols[0]] ?? 0;
    const w_S2 = t.weights[t.short_symbols[1]] ?? 0;

    longs[t.long_symbol] = (longs[t.long_symbol] ?? 0) + w_L;
    shorts[t.short_symbols[0]] = (shorts[t.short_symbols[0]] ?? 0) + w_S1;
    shorts[t.short_symbols[1]] = (shorts[t.short_symbols[1]] ?? 0) + w_S2;

    gross_long += w_L;
    gross_short += w_S1 + w_S2;

    // Net carry: collect from shorts, pay on long
    // Per-unit-long values already in metrics; sum over triples
    net_carry += m.net_funding_carry_apr_pct;

    // Beta: each triple is internally β-neutral vs SPY by construction;
    // summing should give ~0. Aggregate exactly for sanity.
    net_beta_spy += (
      m.beta_L_spy * w_L
      - m.beta_S1_spy * w_S1
      - m.beta_S2_spy * w_S2
    );

    if (m.beta_L_basket != null && m.beta_S1_basket != null && m.beta_S2_basket != null) {
      net_beta_basket = (net_beta_basket ?? 0) + (
        m.beta_L_basket * w_L
        - m.beta_S1_basket * w_S1
        - m.beta_S2_basket * w_S2
      );
      beta_basket_coverage++;
    }

    q_diff_sum += m.quality_diff;

    if (m.spread_vol_daily_pct != null) {
      vol_sq_sum += m.spread_vol_daily_pct ** 2;
      vol_coverage++;
    }
  });

  if (beta_basket_coverage === 0) net_beta_basket = null;

  const n = stagedIndices.size || 1;
  // Aggregate spread vol: sqrt(Σ vol²) assumes orthogonal triples (lower bound).
  // True portfolio vol depends on inter-triple correlations which we don't have
  // client-side. This is a defensible upper-confidence lower-bound estimate.
  const spread_vol_aggregate = vol_coverage > 0 ? Math.sqrt(vol_sq_sum) : null;
  const annualized = spread_vol_aggregate != null ? spread_vol_aggregate * Math.sqrt(252) : null;
  const sharpe_estimate = (annualized != null && annualized > 0)
    ? net_carry / annualized
    : null;

  return {
    n_triples: stagedIndices.size,
    longs,
    shorts,
    gross_long,
    gross_short,
    net: gross_long - gross_short,
    net_carry_apr_pct: net_carry,
    net_beta_spy,
    net_beta_basket,
    quality_diff_avg: q_diff_sum / n,
    spread_vol_aggregate_daily_pct: spread_vol_aggregate,
    sharpe_estimate,
  };
}

export function BasketBuilderPanel({ triples, stagedIndices, onClear, portfolioVolDailyPct }: Props) {
  const agg = aggregate(triples, stagedIndices);
  if (agg.n_triples === 0) return null;

  // Consolidated stock-level rows, sorted by absolute weight
  const longRows = Object.entries(agg.longs)
    .map(([sym, w]) => ({ sym, w }))
    .sort((a, b) => b.w - a.w);
  const shortRows = Object.entries(agg.shorts)
    .map(([sym, w]) => ({ sym, w }))
    .sort((a, b) => b.w - a.w);

  return (
    <Card className="border-blue-700/50 bg-blue-950/20 sticky top-2 z-10">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-blue-200">
            Basket builder · {agg.n_triples} triple{agg.n_triples === 1 ? "" : "s"} staged
          </CardTitle>
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-gray-400 hover:text-gray-200 underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      </CardHeader>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
        <div>
          <div className="text-[10px] text-gray-500">Gross long / short</div>
          <div className="font-mono text-gray-200">
            {agg.gross_long.toFixed(2)}× / {agg.gross_short.toFixed(2)}×
          </div>
          <div className="text-[10px] text-gray-600">
            ratio {(agg.gross_short / Math.max(agg.gross_long, 0.001)).toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500">Net notional</div>
          <div className={`font-mono ${Math.abs(agg.net) < 0.1 ? "text-emerald-300" : "text-amber-300"}`}>
            {agg.net >= 0 ? "+" : ""}{agg.net.toFixed(2)}×
          </div>
          <div className="text-[10px] text-gray-600">
            {Math.abs(agg.net) < 0.1 ? "approximately neutral" : "directional bias"}
          </div>
        </div>
        <div title="Sum of per-triple net funding carry. Per unit of long notional within each triple.">
          <div className="text-[10px] text-gray-500">Net carry APR</div>
          <div className={`font-mono ${agg.net_carry_apr_pct > 0 ? "text-emerald-300" : "text-red-300"}`}>
            {fmtPct(agg.net_carry_apr_pct, 1)}
          </div>
          <div className="text-[10px] text-gray-600">aggregated</div>
        </div>
        <div title="Σ over staged triples. Should be ~0 since each triple is internally β-neutral vs SPY by construction. Small residuals from rounding.">
          <div className="text-[10px] text-gray-500">Net β vs SPY</div>
          <div className={`font-mono ${Math.abs(agg.net_beta_spy) < 0.1 ? "text-emerald-300" : "text-amber-300"}`}>
            {agg.net_beta_spy >= 0 ? "+" : ""}{agg.net_beta_spy.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-600">
            {Math.abs(agg.net_beta_spy) < 0.1 ? "market-neutral" : "residual"}
          </div>
        </div>
        <div title="Pan-portfolio β: how much net β this staged basket adds to Nickel's existing β_net when entered into the book. Computed against the live crypto long basket.">
          <div className="text-[10px] text-gray-500">Net β vs crypto book</div>
          <div className={`font-mono ${agg.net_beta_basket != null && Math.abs(agg.net_beta_basket) < 0.1 ? "text-emerald-300" : "text-gray-300"}`}>
            {agg.net_beta_basket != null
              ? `${agg.net_beta_basket >= 0 ? "+" : ""}${agg.net_beta_basket.toFixed(2)}`
              : "—"}
          </div>
          <div className="text-[10px] text-gray-600">pan-portfolio</div>
        </div>
        <div title="Estimated daily spread vol of the aggregated staged basket. Assumes orthogonal triples — actual portfolio vol depends on inter-triple correlations which require pan-basket return series.">
          <div className="text-[10px] text-gray-500">Estimated vol</div>
          <div className="font-mono">
            {agg.spread_vol_aggregate_daily_pct != null
              ? `${agg.spread_vol_aggregate_daily_pct.toFixed(2)}%/d`
              : "—"}
          </div>
          <div className="text-[10px] text-gray-600">
            {portfolioVolDailyPct != null && agg.spread_vol_aggregate_daily_pct != null
              ? `${(agg.spread_vol_aggregate_daily_pct / portfolioVolDailyPct).toFixed(1)}× book`
              : agg.sharpe_estimate != null
              ? `Sharpe ${fmtNum(agg.sharpe_estimate, 2)}`
              : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
        <div>
          <div className="text-[10px] text-gray-500 mb-1">
            Consolidated longs ({longRows.length})
          </div>
          <div className="space-y-1">
            {longRows.map(({ sym, w }) => (
              <div key={sym} className="flex justify-between font-mono">
                <span className="text-emerald-400">{sym.replace("USDT", "")}</span>
                <span className="text-gray-400">{w.toFixed(2)}×</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1">
            Consolidated shorts ({shortRows.length})
          </div>
          <div className="space-y-1">
            {shortRows.map(({ sym, w }) => (
              <div key={sym} className="flex justify-between font-mono">
                <span className="text-red-400">{sym.replace("USDT", "")}</span>
                <span className="text-gray-400">{w.toFixed(2)}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 text-[10px] text-gray-500 italic leading-snug">
        Aggregated metrics across {agg.n_triples} staged triple{agg.n_triples === 1 ? "" : "s"}.
        Quality Δ avg {agg.quality_diff_avg >= 0 ? "+" : ""}{agg.quality_diff_avg.toFixed(2)}.
        Per-stock weights consolidated: a stock appearing in multiple staged triples is summed
        (e.g. INTC short in two triples → 2× short position).
      </div>
    </Card>
  );
}
