import type {
  AiCapabilityBasketSummary,
  CryptoPriceBasketSummary,
  SpacexIpoBasketSummary,
  TariffIntensityBasketSummary,
} from "../../../hooks/useTokenizedAssets";
import { Card } from "../../ui/Card";

interface Props {
  cryptoBasket?: CryptoPriceBasketSummary;
  aiBasket?: AiCapabilityBasketSummary;
  tariffBasket?: TariffIntensityBasketSummary;
  spacexBasket?: SpacexIpoBasketSummary;
}

// Score → colour. Mirrors the macro-composite chip pattern elsewhere in the
// dashboard: green when score >65 (bullish for "long" sleeve of that basket),
// red when <35 (bearish), amber in between. Specific basket semantics noted
// per-card via the `direction` tooltip.
function scoreColor(v: number | null | undefined): string {
  if (v == null) return "text-gray-500";
  if (v >= 65) return "text-emerald-300";
  if (v >= 55) return "text-emerald-400";
  if (v <= 35) return "text-red-300";
  if (v <= 45) return "text-amber-300";
  return "text-gray-300";
}

function scoreBg(v: number | null | undefined): string {
  if (v == null) return "bg-gray-900/30 border-gray-800/50";
  if (v >= 65) return "bg-emerald-950/40 border-emerald-900/40";
  if (v >= 55) return "bg-emerald-950/20 border-emerald-900/30";
  if (v <= 35) return "bg-red-950/40 border-red-900/40";
  if (v <= 45) return "bg-amber-950/30 border-amber-900/40";
  return "bg-gray-900/30 border-gray-800/50";
}

function fmtScore(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(0);
}

function fmtUsdT(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  return `$${(v / 1e9).toFixed(0)}B`;
}

function fmtPct(v: number | null | undefined, digits = 1): string {
  return v == null ? "—" : `${v.toFixed(digits)}%`;
}

interface BasketCardProps {
  title: string;
  score: number | null | undefined;
  scoreLabel: string;
  direction: string;
  details: Array<{ label: string; value: string }>;
}

function BasketCard({ title, score, scoreLabel, direction, details }: BasketCardProps) {
  return (
    <div
      className={`rounded-md border p-3 ${scoreBg(score)}`}
      title={direction}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase text-gray-400 tracking-wider">
          {title}
        </span>
        <span className={`font-mono text-2xl font-semibold ${scoreColor(score)}`}>
          {fmtScore(score)}
        </span>
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{scoreLabel}</div>
      <div className="mt-2 space-y-0.5 text-[11px]">
        {details.map(({ label, value }) => (
          <div key={label} className="flex justify-between font-mono text-gray-400">
            <span className="text-gray-500">{label}</span>
            <span className="text-gray-300">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MacroPanel({ cryptoBasket, aiBasket, tariffBasket, spacexBasket }: Props) {
  // No baskets at all → render nothing (loading states are handled by the parent).
  if (!cryptoBasket && !aiBasket && !tariffBasket && !spacexBasket) {
    return null;
  }

  // Crypto: derived score = average of BTC year-end + dip risk scores.
  // The individual basket exposes per-component scores; we compose a single
  // headline that mirrors the equity overlay used for COIN/CRCL/MSTR/HOOD.
  const cryptoInd = cryptoBasket?.indicators;
  let cryptoHeadline: number | null | undefined = null;
  if (cryptoInd) {
    const parts: number[] = [];
    if (cryptoInd.btc_year_end_score != null)
      parts.push(0.6 * cryptoInd.btc_year_end_score);
    if (cryptoInd.btc_dip_risk_score != null)
      parts.push(0.3 * cryptoInd.btc_dip_risk_score);
    if (cryptoInd.eth_year_end_score != null)
      parts.push(0.1 * cryptoInd.eth_year_end_score);
    const wSum = (cryptoInd.btc_year_end_score != null ? 0.6 : 0) +
                 (cryptoInd.btc_dip_risk_score != null ? 0.3 : 0) +
                 (cryptoInd.eth_year_end_score != null ? 0.1 : 0);
    cryptoHeadline = wSum > 0
      ? parts.reduce((s, p) => s + p, 0) / wSum
      : null;
  }

  return (
    <Card className="p-3 bg-slate-950/40 border-slate-800/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-300">
          Prediction-Market Macro Panel
        </span>
        <span className="text-[10px] text-gray-500">
          Free Polymarket + Kalshi feeds · refreshed every 10 min · 0–100 scale, 50 = neutral
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BasketCard
          title="Crypto Path"
          score={cryptoHeadline}
          scoreLabel="Composite BTC + dip + ETH"
          direction={
            "Bullish (>65) for COIN / CRCL / MSTR / HOOD long sleeve.\n" +
            "Bearish (<35) for the gold-token tickers (PAXG / XAUT) which run inverse."
          }
          details={[
            {
              label: "BTC YE",
              value: cryptoInd?.btc_year_end_centroid != null
                ? `$${Math.round(cryptoInd.btc_year_end_centroid / 1000)}k`
                : "—",
            },
            {
              label: "BTC YE return",
              value: cryptoInd?.btc_year_end_implied_return_pct != null
                ? `${cryptoInd.btc_year_end_implied_return_pct >= 0 ? "+" : ""}${cryptoInd.btc_year_end_implied_return_pct.toFixed(1)}%`
                : "—",
            },
            {
              label: "BTC dip <$50k",
              value: cryptoInd?.btc_dip_below_50k_prob != null
                ? `${(cryptoInd.btc_dip_below_50k_prob * 100).toFixed(0)}%`
                : "—",
            },
            {
              label: "BTC > gold",
              value: cryptoInd?.btc_outperforms_gold_prob != null
                ? `${(cryptoInd.btc_outperforms_gold_prob * 100).toFixed(0)}%`
                : "—",
            },
            {
              label: "MSTR sells BTC",
              value: cryptoInd?.mstr_sells_btc_prob != null
                ? `${(cryptoInd.mstr_sells_btc_prob * 100).toFixed(0)}%`
                : "—",
            },
          ]}
        />
        <BasketCard
          title="AI Capex"
          score={aiBasket?.indicators.capex_momentum_score}
          scoreLabel="Compute build-out momentum"
          direction={
            "Bullish (>65) for the GPU / memory / hyperscaler longs (NVDA, AVGO, CRWV, MU, SNDK).\n" +
            "Bearish for INTC (inverted beta). Hyperscaler hyperweight rotates with frontier-model leadership."
          }
          details={[
            {
              label: "Top lab",
              value: (() => {
                const shares = aiBasket?.indicators.lab_leadership_shares;
                if (!shares || Object.keys(shares).length === 0) return "—";
                const top = Object.entries(shares).sort((a, b) => b[1] - a[1])[0];
                return `${top[0]} ${(top[1] * 100).toFixed(0)}%`;
              })(),
            },
            {
              label: "Concentration",
              value: aiBasket?.indicators.leadership_concentration != null
                ? aiBasket.indicators.leadership_concentration.toFixed(2)
                : "—",
            },
            {
              label: "OpenAI IPO EOY",
              value: aiBasket?.indicators.openai_ipo_prob_by_year_end != null
                ? `${(aiBasket.indicators.openai_ipo_prob_by_year_end * 100).toFixed(0)}%`
                : "—",
            },
            {
              label: "Anthropic val",
              value: fmtUsdT(aiBasket?.indicators.anthropic_val_centroid_usd),
            },
            {
              label: "AGI by 2027",
              value: aiBasket?.indicators.agi_by_2027_prob != null
                ? `${(aiBasket.indicators.agi_by_2027_prob * 100).toFixed(0)}%`
                : "—",
            },
          ]}
        />
        <BasketCard
          title="Tariff Intensity"
          score={tariffBasket?.indicators.tariff_intensity_score}
          scoreLabel="2026 enforcement pace"
          direction={
            "Bearish (>65 intensity) for China-exposed (BABA, AAPL, TSM, TSLA) and Asia-fab semis (AVGO, QCOM, MU, SNDK).\n" +
            "Bullish for INTC (US foundry) and USAR (rare-earth domestic moat).\n" +
            "Decoupling sub-score amplifies INTC / USAR tailwind when high."
          }
          details={[
            {
              label: "Revenue",
              value: fmtUsdT(tariffBasket?.indicators.tariff_revenue_centroid_usd),
            },
            {
              label: "Eff. rate",
              value: fmtPct(tariffBasket?.indicators.effective_tariff_rate_centroid_pct, 1),
            },
            {
              label: "China imports",
              value: fmtUsdT(tariffBasket?.indicators.china_imports_centroid_usd),
            },
            {
              label: "Decoupling",
              value: tariffBasket?.indicators.china_decoupling_score != null
                ? tariffBasket.indicators.china_decoupling_score.toFixed(0)
                : "—",
            },
            {
              label: "SCOTUS hear",
              value: tariffBasket?.indicators.scotus_tariff_hear_prob != null
                ? `${(tariffBasket.indicators.scotus_tariff_hear_prob * 100).toFixed(0)}%`
                : "—",
            },
          ]}
        />
        <BasketCard
          title="SpaceX / SPCX"
          score={null /* SPCX score is per-row, not a headline */}
          scoreLabel="Implied private valuation"
          direction={
            "PM cap-above ladder centroid gives implied SpaceX valuation. Compare to the SPCX perp mark to detect over/under-priced regime.\n" +
            "The SPCX row score (in the Single Stocks tab) measures perp-vs-PM divergence relative to the 7d EWMA shares-outstanding anchor."
          }
          details={[
            {
              label: "Implied val",
              value: spacexBasket?.indicators.spacex_implied_valuation_centroid_t != null
                ? `$${spacexBasket.indicators.spacex_implied_valuation_centroid_t.toFixed(2)}T`
                : "—",
            },
            {
              label: "SPCX mark",
              value: spacexBasket?.indicators.spcx_perp_mark_usd != null
                ? `$${spacexBasket.indicators.spcx_perp_mark_usd.toFixed(2)}`
                : "—",
            },
            {
              label: "Impl. shares",
              value: spacexBasket?.indicators.spcx_implied_shares_outstanding != null
                ? `${(spacexBasket.indicators.spcx_implied_shares_outstanding / 1e9).toFixed(2)}B`
                : "—",
            },
            {
              label: "IPO EOY",
              value: spacexBasket?.indicators.spacex_ipo_prob_by_year_end != null
                ? `${(spacexBasket.indicators.spacex_ipo_prob_by_year_end * 100).toFixed(0)}%`
                : "—",
            },
            {
              label: "Time to IPO",
              value: spacexBasket?.indicators.spacex_ipo_centroid_years != null
                ? `${(spacexBasket.indicators.spacex_ipo_centroid_years * 12).toFixed(1)}mo`
                : "—",
            },
          ]}
        />
      </div>
    </Card>
  );
}
