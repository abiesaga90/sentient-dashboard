import { useState } from "react";
import type {
  TripleIdea,
  PairsPayload,
  CryptoPriceBasketSummary,
  AiCapabilityBasketSummary,
  TariffIntensityBasketSummary,
} from "../../../hooks/useTokenizedAssets";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { fmtPct, fmtNum } from "./format";
import { BasketBuilderPanel } from "./BasketBuilderPanel";

interface Props {
  pairs?: PairsPayload;
  cryptoBasket?: CryptoPriceBasketSummary;
  aiBasket?: AiCapabilityBasketSummary;
  tariffBasket?: TariffIntensityBasketSummary;
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

function TripleCard({ t, idx, staged, onToggle }: { t: TripleIdea; idx: number; staged: boolean; onToggle: () => void }) {
  const m = t.metrics;
  const L = t.long_symbol.replace("USDT", "");
  const S1 = t.short_symbols[0].replace("USDT", "");
  const S2 = t.short_symbols[1].replace("USDT", "");
  const w_L = t.weights[t.long_symbol] ?? 1.0;
  const w_S1 = t.weights[t.short_symbols[0]] ?? 0;
  const w_S2 = t.weights[t.short_symbols[1]] ?? 0;
  const total_short = w_S1 + w_S2;

  return (
    <div className={`border-b border-[var(--border)] last:border-b-0 py-3 px-2 ${staged ? "bg-blue-950/20 border-l-2 border-l-blue-500" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="cursor-pointer flex items-center" title={staged ? "Click to unstage" : "Click to stage in basket builder"}>
            <input
              type="checkbox"
              checked={staged}
              onChange={onToggle}
              className="accent-blue-500"
            />
          </label>
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

function scoreChipColor(v: number | null | undefined): string {
  if (v == null) return "bg-slate-900/40 border-slate-700/50 text-gray-400";
  if (v >= 65) return "bg-emerald-950/40 border-emerald-700/50 text-emerald-300";
  if (v >= 55) return "bg-emerald-950/20 border-emerald-800/40 text-emerald-400/80";
  if (v <= 35) return "bg-red-950/40 border-red-700/50 text-red-300";
  if (v <= 45) return "bg-red-950/20 border-red-800/40 text-red-400/80";
  return "bg-slate-900/40 border-slate-700/50 text-gray-300";
}

function CryptoBasketMacroPanel({ basket }: { basket: CryptoPriceBasketSummary }) {
  const ind = basket.indicators ?? {};
  const btcSpot = basket.spot?.BTCUSDT;
  const ethSpot = basket.spot?.ETHUSDT;
  const fmtPctSafe = (v: number | null | undefined) =>
    v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  const fmtProbPct = (v: number | null | undefined) =>
    v == null ? "—" : `${(v * 100).toFixed(0)}%`;
  const fmtUsd = (v: number | null | undefined) =>
    v == null ? "—" : v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;
  const updatedShort = basket.updated_at
    ? new Date(basket.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className="bg-blue-950/20 border border-blue-900/40 rounded-md px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-blue-300/80 font-semibold">
          Crypto BTC/ETH prediction-market consensus
        </div>
        <div className="text-[10px] text-gray-500">
          Polymarket + Kalshi · feeds COIN / CRCL / MSTR / HOOD / PAXG / XAUT overlays
          {updatedShort && <span className="ml-2 text-gray-600">· {updatedShort}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <div
          className={`px-2 py-1.5 border rounded-md ${scoreChipColor(ind.btc_year_end_score ?? null)}`}
          title="Kalshi KXBTCY-27JAN0100 ladder centroid. Score 50 = centroid matches spot; >65 = implied return strongly positive; <35 = implied return strongly negative. Saturation at ±50% annual."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">BTC year-end</div>
          <div className="font-mono text-sm">
            {fmtUsd(ind.btc_year_end_centroid)}{" "}
            <span className="text-[10px] opacity-80">({fmtPctSafe(ind.btc_year_end_implied_return_pct)})</span>
          </div>
          <div className="text-[10px] opacity-60">
            spot {fmtUsd(btcSpot)} · score {ind.btc_year_end_score ?? "—"}
          </div>
        </div>
        <div
          className={`px-2 py-1.5 border rounded-md ${scoreChipColor(ind.eth_year_end_score ?? null)}`}
          title="Kalshi KXETHY-27JAN0100 ladder centroid. Same scoring shape as BTC."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">ETH year-end</div>
          <div className="font-mono text-sm">
            {fmtUsd(ind.eth_year_end_centroid)}{" "}
            <span className="text-[10px] opacity-80">({fmtPctSafe(ind.eth_year_end_implied_return_pct)})</span>
          </div>
          <div className="text-[10px] opacity-60">
            spot {fmtUsd(ethSpot)} · score {ind.eth_year_end_score ?? "—"}
          </div>
        </div>
        <div
          className={`px-2 py-1.5 border rounded-md ${scoreChipColor(ind.btc_dip_risk_score ?? null)}`}
          title="Kalshi KXBTCMINY-27JAN01 CDF interpolated at $50k. Score = 100·(1 - P(min<$50k)). Higher = downside priced light."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">BTC dip {"<"}$50k</div>
          <div className="font-mono text-sm">
            {fmtProbPct(ind.btc_dip_below_50k_prob)} prob
          </div>
          <div className="text-[10px] opacity-60">
            score {ind.btc_dip_risk_score ?? "—"}
          </div>
        </div>
        <div
          className={`px-2 py-1.5 border rounded-md ${scoreChipColor(
            ind.btc_outperforms_gold_prob != null ? 100 * (1 - ind.btc_outperforms_gold_prob) : null
          )}`}
          title="Kalshi KXBTCVSGOLD-26. Direct probability BTC outperforms gold in 2026. Color = gold-relative read (high P(BTC>gold) → bearish for PAXG/XAUT)."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">BTC {">"} gold (2026)</div>
          <div className="font-mono text-sm">
            {fmtProbPct(ind.btc_outperforms_gold_prob)} prob
          </div>
          <div className="text-[10px] opacity-60">
            {ind.btc_outperforms_gold_prob != null && ind.btc_outperforms_gold_prob >= 0.5
              ? "bullish BTC, bearish PAXG"
              : ind.btc_outperforms_gold_prob != null
                ? "bullish gold, bearish BTC rel."
                : "—"}
          </div>
        </div>
        <div
          className={`px-2 py-1.5 border rounded-md ${
            ind.mstr_sells_btc_prob == null
              ? "bg-slate-900/40 border-slate-700/50 text-gray-400"
              : ind.mstr_sells_btc_prob >= 0.5
                ? "bg-red-950/40 border-red-700/50 text-red-300"
                : ind.mstr_sells_btc_prob >= 0.25
                  ? "bg-amber-950/40 border-amber-700/50 text-amber-300"
                  : "bg-emerald-950/40 border-emerald-700/50 text-emerald-300"
          }`}
          title="Polymarket: MSTR sells any BTC by year-end. High probability = treasury credibility risk; penalises MSTR's PM-consensus score by up to 25pp."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">MSTR sells BTC</div>
          <div className="font-mono text-sm">{fmtProbPct(ind.mstr_sells_btc_prob)} prob</div>
          <div className="text-[10px] opacity-60">
            by {ind.mstr_sells_btc_end_date ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function AiCapabilityMacroPanel({ basket }: { basket: AiCapabilityBasketSummary }) {
  const ind = basket.indicators ?? {};
  const shares = ind.lab_leadership_shares ?? {};
  const sortedShares = Object.entries(shares)
    .filter(([, v]) => (v ?? 0) >= 0.005)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 4);
  const top = sortedShares[0];
  const fmtProbPct = (v: number | null | undefined) =>
    v == null ? "—" : `${(v * 100).toFixed(0)}%`;
  const fmtUsd = (v: number | null | undefined) =>
    v == null ? "—" : v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${v.toFixed(0)}`;
  const updatedShort = basket.updated_at
    ? new Date(basket.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-md px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-indigo-300/80 font-semibold">
          AI capability prediction-market consensus
        </div>
        <div className="text-[10px] text-gray-500">
          Polymarket + Kalshi · feeds NVDA / AMD / AVGO / CRWV / TSM / INTC / hyperscalers
          {updatedShort && <span className="ml-2 text-gray-600">· {updatedShort}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <div
          className={`px-2 py-1.5 border rounded-md ${scoreChipColor(ind.capex_momentum_score ?? null)}`}
          title="Composite 0-100. Weighted blend of OpenAI year-end valuation centroid (Polymarket), Anthropic valuation, OpenAI IPO probability by year-end, Claude 5 release timing, AGI by 2027, and AVGO Q2 AI revenue. 50 = neutral; >65 strongly bullish AI capex; <35 strongly bearish."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">AI capex score</div>
          <div className="font-mono text-sm">{ind.capex_momentum_score ?? "—"}</div>
          <div className="text-[10px] opacity-60">
            6-component composite
          </div>
        </div>
        <div
          className="px-2 py-1.5 border rounded-md bg-slate-900/40 border-slate-700/50 text-gray-300"
          title="From the 'best AI model end of <month>' Polymarket event. Top labs by current YES probability. Hyperscalers MSFT/AMZN/GOOGL/META get partner-leadership bonuses on their AI overlay scores when their aligned lab leads."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">Frontier leader</div>
          <div className="font-mono text-sm capitalize">
            {top ? `${top[0]} ${(top[1] * 100).toFixed(0)}%` : "—"}
          </div>
          <div className="text-[10px] opacity-60">
            HHI {ind.leadership_concentration?.toFixed(2) ?? "—"} (concentration)
          </div>
        </div>
        <div
          className="px-2 py-1.5 border rounded-md bg-slate-900/40 border-slate-700/50 text-gray-300"
          title="Polymarket year-end valuation ladder centroids (HIGH-strike sub-markets). Higher centroids = market expects more capex flowing into AI supply chain. Reference baselines: OpenAI $1.5T, Anthropic $1.5T as of basket creation."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">OpenAI / Anthropic val</div>
          <div className="font-mono text-sm">
            {fmtUsd(ind.openai_val_centroid_usd)} / {fmtUsd(ind.anthropic_val_centroid_usd)}
          </div>
          <div className="text-[10px] opacity-60">implied YE centroids</div>
        </div>
        <div
          className={`px-2 py-1.5 border rounded-md ${
            ind.openai_ipo_prob_by_year_end == null
              ? "bg-slate-900/40 border-slate-700/50 text-gray-400"
              : ind.openai_ipo_prob_by_year_end >= 0.6
                ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-300"
                : ind.openai_ipo_prob_by_year_end <= 0.3
                  ? "bg-red-950/40 border-red-700/50 text-red-300"
                  : "bg-slate-900/40 border-slate-700/50 text-gray-300"
          }`}
          title="Polymarket P(OpenAI IPO by Dec 31). Wall Street consensus baseline ~50%. High probability = capex thesis validated by liquidity event."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">OpenAI IPO YE</div>
          <div className="font-mono text-sm">{fmtProbPct(ind.openai_ipo_prob_by_year_end)}</div>
          <div className="text-[10px] opacity-60">
            centroid {ind.openai_ipo_centroid_years?.toFixed(2) ?? "—"}y
          </div>
        </div>
        <div
          className={`px-2 py-1.5 border rounded-md ${
            ind.avgo_q2_ai_revenue_centroid_usd == null
              ? "bg-slate-900/40 border-slate-700/50 text-gray-400"
              : ind.avgo_q2_ai_revenue_centroid_usd >= 11.5e9
                ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-300"
                : ind.avgo_q2_ai_revenue_centroid_usd <= 10.5e9
                  ? "bg-red-950/40 border-red-700/50 text-red-300"
                  : "bg-slate-900/40 border-slate-700/50 text-gray-300"
          }`}
          title="Polymarket P(AVGO Q2 AI revenue ≥ $X) ladder centroid. Consensus is $11.0B; centroid above = market expects beat. Single-name AVGO overlay gets +30% extra weight from this signal."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">AVGO Q2 AI rev</div>
          <div className="font-mono text-sm">{fmtUsd(ind.avgo_q2_ai_revenue_centroid_usd)}</div>
          <div className="text-[10px] opacity-60">vs $11B consensus</div>
        </div>
      </div>
    </div>
  );
}

function TariffMacroPanel({ basket }: { basket: TariffIntensityBasketSummary }) {
  const ind = basket.indicators ?? {};
  const sectors = ind.sector_tariff_shares ?? {};
  const hotSectors = Object.entries(sectors)
    .filter(([, p]) => (p ?? 0) >= 0.30)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3);
  const fmtProbPct = (v: number | null | undefined) =>
    v == null ? "—" : `${(v * 100).toFixed(0)}%`;
  const fmtUsd = (v: number | null | undefined) =>
    v == null ? "—" : v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(0)}B` : `$${v.toFixed(0)}`;
  const updatedShort = basket.updated_at
    ? new Date(basket.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className="bg-amber-950/20 border border-amber-900/40 rounded-md px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-amber-300/80 font-semibold">
          Tariff intensity prediction-market consensus
        </div>
        <div className="text-[10px] text-gray-500">
          Kalshi · feeds BABA / AAPL / TSM / TSLA / semis / HD / COPPER / INTC / USAR overlays
          {updatedShort && <span className="ml-2 text-gray-600">· {updatedShort}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <div
          className={`px-2 py-1.5 border rounded-md ${scoreChipColor(ind.tariff_intensity_score ?? null)}`}
          title="Composite of Kalshi tariff revenue + effective rate ladders. 50 = neutral baseline; >65 = aggressive tariff regime priced (bearish China-exposed); <35 = de-escalation priced (bullish China-exposed)."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">Tariff intensity</div>
          <div className="font-mono text-sm">{ind.tariff_intensity_score ?? "—"}</div>
          <div className="text-[10px] opacity-60">2-component blend</div>
        </div>
        <div
          className={`px-2 py-1.5 border rounded-md ${scoreChipColor(ind.china_decoupling_score ?? null)}`}
          title="Kalshi KXCNIMPORT-27FEB04 CDF centroid. 50 = current $260B baseline of US imports from China; 100 = aggressive decoupling (centroid < $200B). High = bullish USAR/INTC, bearish BABA."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">China decoupling</div>
          <div className="font-mono text-sm">{ind.china_decoupling_score ?? "—"}</div>
          <div className="text-[10px] opacity-60">
            imports {fmtUsd(ind.china_imports_centroid_usd)}
          </div>
        </div>
        <div
          className="px-2 py-1.5 border rounded-md bg-slate-900/40 border-slate-700/50 text-gray-300"
          title="Kalshi KXTARIFFREVENUE-26DEC31 survival ladder centroid. Implied 2026 US tariff revenue. >$180B = above neutral baseline."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">Tariff revenue / rate</div>
          <div className="font-mono text-sm">
            {fmtUsd(ind.tariff_revenue_centroid_usd)} · {ind.effective_tariff_rate_centroid_pct?.toFixed(1) ?? "—"}%
          </div>
          <div className="text-[10px] opacity-60">2026 revenue · Q2 effective rate</div>
        </div>
        <div
          className="px-2 py-1.5 border rounded-md bg-slate-900/40 border-slate-700/50 text-gray-300"
          title="Kalshi KXTARIFFSECTOR-27JAN01 multi-outcome. P(YES) per sector ≥30%. Hot sectors get name-level callouts on the per-pair overlay."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">Hot sectors (≥30%)</div>
          <div className="font-mono text-xs leading-tight">
            {hotSectors.length === 0
              ? "—"
              : hotSectors.map(([s, p]) => `${s} ${(p * 100).toFixed(0)}%`).join(" · ")}
          </div>
          <div className="text-[10px] opacity-60">tariff target probabilities</div>
        </div>
        <div
          className={`px-2 py-1.5 border rounded-md ${
            ind.scotus_tariff_hear_prob == null
              ? "bg-slate-900/40 border-slate-700/50 text-gray-400"
              : ind.scotus_tariff_hear_prob >= 0.5
                ? "bg-amber-950/40 border-amber-700/50 text-amber-300"
                : "bg-slate-900/40 border-slate-700/50 text-gray-300"
          }`}
          title="Kalshi tail markets: SCOTUS hears Trump tariff case (legal uncertainty) and Iran sanctions breach indicator."
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">Legal / sanctions tails</div>
          <div className="font-mono text-sm">
            SCOTUS {fmtProbPct(ind.scotus_tariff_hear_prob)}
          </div>
          <div className="text-[10px] opacity-60">
            Iran imports breach {fmtProbPct(ind.iran_imports_breach_prob)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TriplesSubTab({ pairs, cryptoBasket, aiBasket, tariffBasket }: Props) {
  const triples = pairs?.triples ?? [];
  const [staged, setStaged] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setStaged((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

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
      {cryptoBasket && <CryptoBasketMacroPanel basket={cryptoBasket} />}
      {aiBasket && <AiCapabilityMacroPanel basket={aiBasket} />}
      {tariffBasket && <TariffMacroPanel basket={tariffBasket} />}

      <div className="text-[11px] text-blue-300/80 bg-blue-950/30 border border-blue-900/40 rounded-md px-3 py-2">
        <span className="font-semibold">1L : 2S Triple Suggester.</span>{" "}
        Mirrors the live crypto book's 1:2 long:short overhedge structure to reduce
        short-squeeze concentration risk. For each high-quality long candidate, two
        low-quality shorts are sized so the triple is{" "}
        <span className="text-emerald-300">internally β-neutral vs SPY</span> by
        construction. Ranked by composite of quality differential × net carry × intra-short
        diversification × pan-portfolio β impact.{" "}
        <span className="text-gray-400">
          Stage triples (☐) to build a basket — aggregate metrics appear above.
        </span>
      </div>

      <BasketBuilderPanel
        triples={triples}
        stagedIndices={staged}
        onClear={() => setStaged(new Set())}
        portfolioVolDailyPct={pairs?.portfolio_vol_daily_pct}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>
              1L : 2S triple recommendations{" "}
              <span className="text-[11px] font-normal text-gray-500">
                ({triples.length})
                {staged.size > 0 && (
                  <span className="text-blue-300 ml-2">· {staged.size} staged</span>
                )}
              </span>
            </CardTitle>
            <span className="text-[10px] text-gray-500">
              ranked by composite alpha + carry + diversification score
            </span>
          </div>
        </CardHeader>
        <div className="-mx-2">
          {triples.map((t, i) => (
            <TripleCard
              key={`triple-${i}-${t.long_symbol}-${t.short_symbols[0]}-${t.short_symbols[1]}`}
              t={t}
              idx={i}
              staged={staged.has(i)}
              onToggle={() => toggle(i)}
            />
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
