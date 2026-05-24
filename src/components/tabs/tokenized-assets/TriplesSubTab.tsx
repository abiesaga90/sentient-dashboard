import type { TripleIdea, PairsPayload } from "../../../hooks/useTokenizedAssets";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { fmtPct, fmtNum } from "./format";

interface Props {
  pairs?: PairsPayload;
}

function carryColor(v: number): string {
  if (v > 20) return "text-emerald-400";
  if (v > 0) return "text-emerald-500";
  if (v < -10) return "text-red-400";
  return "text-gray-300";
}

function corrColor(v: number | null): string {
  if (v === null) return "text-gray-500";
  // For intra-short correlation in a triple, LOWER is better (diversification)
  if (v < 0.2) return "text-emerald-400";
  if (v < 0.5) return "text-amber-300";
  return "text-red-400";
}

function qualityChip(q: number): string {
  if (q >= 1.0) return "border-emerald-500 bg-emerald-950/70 text-emerald-200 font-bold";
  if (q >= 0.3) return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
  if (q > -0.3) return "border-gray-700 bg-gray-900/40 text-gray-400";
  if (q >= -1.0) return "border-amber-700 bg-amber-950/40 text-amber-300";
  return "border-red-500 bg-red-950/70 text-red-200 font-bold";
}

function TripleCard({ t, idx }: { t: TripleIdea; idx: number }) {
  const m = t.metrics;
  const L = t.long_symbol.replace("USDT", "");
  const S1 = t.short_symbols[0].replace("USDT", "");
  const S2 = t.short_symbols[1].replace("USDT", "");
  const w_L = t.weights[t.long_symbol] ?? 1.0;
  const w_S1 = t.weights[t.short_symbols[0]] ?? 0;
  const w_S2 = t.weights[t.short_symbols[1]] ?? 0;
  const total_short = w_S1 + w_S2;

  return (
    <div className="border-b border-[var(--border)] last:border-b-0 py-3 px-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold border-blue-700 bg-blue-950/40 text-blue-300">
            #{idx + 1}
          </span>
          <span className="text-sm font-medium">
            <span className="text-emerald-400">L</span>{" "}
            <span className="font-mono text-gray-100">{L}</span>
            <span className="text-gray-500 mx-1">({w_L.toFixed(2)}×)</span>
            <span className="text-gray-600">+</span>{" "}
            <span className="text-red-400">S</span>{" "}
            <span className="font-mono text-gray-100">{S1}</span>
            <span className="text-gray-500 mx-1">({w_S1.toFixed(2)}×)</span>
            <span className="text-gray-600">+</span>{" "}
            <span className="text-red-400">S</span>{" "}
            <span className="font-mono text-gray-100">{S2}</span>
            <span className="text-gray-500 mx-1">({w_S2.toFixed(2)}×)</span>
          </span>
          <span
            title={`Composite ranking score combining quality differential, net funding carry, intra-short diversification, and pan-portfolio β contribution.`}
            className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] border-purple-700 bg-purple-950/40 text-purple-300"
          >
            score {t.score.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span
            title={`Quality differential: long_score − avg(short_scores)\nLong: ${m.quality_long.toFixed(2)}\nShorts avg: ${m.quality_shorts_avg.toFixed(2)}`}
            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] ${qualityChip(m.quality_diff)}`}
          >
            Q diff {m.quality_diff >= 0 ? "+" : ""}{m.quality_diff.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2 text-xs">
        <div title={`L pays funding_L = ${m.funding_long_apr_pct.toFixed(1)}%\nS1 collects ${(w_S1*m.funding_short_1_apr_pct).toFixed(1)}% (= ${w_S1.toFixed(2)} × ${m.funding_short_1_apr_pct.toFixed(1)})\nS2 collects ${(w_S2*m.funding_short_2_apr_pct).toFixed(1)}%\nNet = sum`}>
          <div className="text-[10px] text-gray-500">Net carry (APR)</div>
          <div className={`font-mono ${carryColor(m.net_funding_carry_apr_pct)}`}>
            {fmtPct(m.net_funding_carry_apr_pct, 1)}
          </div>
          <div className="text-[10px] text-gray-600">
            per unit long
          </div>
        </div>
        <div title={`Spread vol per unit long notional. Computed on r_L − w_S1·r_S1 − w_S2·r_S2 daily series.`}>
          <div className="text-[10px] text-gray-500">Spread vol</div>
          <div className="font-mono">
            {m.spread_vol_daily_pct != null ? `${m.spread_vol_daily_pct.toFixed(2)}%/d` : "—"}
          </div>
          <div className="text-[10px] text-gray-600">
            {m.sharpe != null ? `Sharpe ${m.sharpe.toFixed(2)}` : ""}
          </div>
        </div>
        <div title={`β-neutral vs SPY by construction.\nL β: ${m.beta_L_spy.toFixed(2)}\nS1 β: ${m.beta_S1_spy.toFixed(2)} × ${w_S1.toFixed(2)} = ${(w_S1*m.beta_S1_spy).toFixed(2)}\nS2 β: ${m.beta_S2_spy.toFixed(2)} × ${w_S2.toFixed(2)} = ${(w_S2*m.beta_S2_spy).toFixed(2)}\nNet β: 0.00`}>
          <div className="text-[10px] text-gray-500">Net β vs SPY</div>
          <div className="font-mono text-emerald-300">
            {m.net_beta_spy.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-600">by construction</div>
        </div>
        <div title={`Pan-portfolio β: contribution to engine's β_net when this triple is added to the live crypto book. Computed against the live long basket daily returns (G2).`}>
          <div className="text-[10px] text-gray-500">Net β vs crypto book</div>
          <div className={`font-mono ${m.net_beta_basket != null && Math.abs(m.net_beta_basket) < 0.1 ? "text-emerald-300" : "text-gray-300"}`}>
            {m.net_beta_basket != null ? m.net_beta_basket.toFixed(2) : "—"}
          </div>
          <div className="text-[10px] text-gray-600">pan-portfolio</div>
        </div>
        <div title={`Pearson correlation between the two shorts (S1, S2) over the 2y daily underlying-return window. Lower = better diversification, less squeeze risk concentration.`}>
          <div className="text-[10px] text-gray-500">Intra-short corr</div>
          <div className={`font-mono ${corrColor(m.intra_short_correlation)}`}>
            {m.intra_short_correlation != null ? m.intra_short_correlation.toFixed(2) : "—"}
          </div>
          <div className="text-[10px] text-gray-600">diversification</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500">Notional ratio</div>
          <div className="font-mono text-gray-200">
            1L : {total_short.toFixed(1)}S
          </div>
          <div className="text-[10px] text-gray-600">
            {fmtNum(w_S1 / total_short * 100, 0)}% / {fmtNum(w_S2 / total_short * 100, 0)}%
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-gray-500 italic leading-snug">
        {t.rationale}
      </div>
    </div>
  );
}

export function TriplesSubTab({ pairs }: Props) {
  const triples = pairs?.triples ?? [];

  if (triples.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-gray-500">
        Triple engine has no candidates yet. Requires per-stock Quality Scores (G1) and
        per-stock β vs SPY (G2) to be populated — refreshes every 24h with the
        fundamentals cycle.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] text-blue-300/80 bg-blue-950/30 border border-blue-900/40 rounded-md px-3 py-2">
        <span className="font-semibold">1L : 2S Triple Suggester.</span>{" "}
        Mirrors the live crypto book's 1:2 long:short overhedge structure to reduce
        short-squeeze concentration risk. For each high-quality long candidate, two
        low-quality shorts are sized so the triple is{" "}
        <span className="text-emerald-300">internally β-neutral vs SPY</span> by
        construction. Ranked by composite of quality differential × net carry × intra-short
        diversification × pan-portfolio β impact.
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>
              1L : 2S triple recommendations{" "}
              <span className="text-[11px] font-normal text-gray-500">
                ({triples.length})
              </span>
            </CardTitle>
            <span className="text-[10px] text-gray-500">
              ranked by composite alpha + carry + diversification score
            </span>
          </div>
        </CardHeader>
        <div className="-mx-2">
          {triples.map((t, i) => (
            <TripleCard key={`triple-${i}-${t.long_symbol}-${t.short_symbols[0]}-${t.short_symbols[1]}`} t={t} idx={i} />
          ))}
        </div>
      </Card>

      <div className="text-[10px] text-gray-600 italic px-2">
        Weights are normalized to 1.0 unit long notional. "1.65×" on a short means
        sized 65% larger than the long. Total short notional always sums to 2.0
        (the "1L:2S" ratio). Net β vs SPY is 0.00 by construction; net β vs the
        crypto book is the pan-portfolio impact when this triple is added to
        Nickel's existing positions — near zero means a clean diversifier addition.
      </div>
    </div>
  );
}
