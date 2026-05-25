import { useQuery } from "@tanstack/react-query";
import { useEngine } from "./useEngine";

export type AssetClass = "stock" | "etf" | "metal" | "commodity";

export interface BinanceLive {
  mark_price: number | null;
  index_price: number | null;
  basis_bps: number | null;
  change_24h_pct: number | null;
  vol_24h_usd: number | null;
  high_24h: number | null;
  low_24h: number | null;
  funding_8h: number | null;
  funding_7d_apr_pct: number | null;
  open_interest_usd: number | null;
  max_leverage: number | null;
}

export interface Fundamentals {
  name?: string;
  sector?: string;
  industry?: string;
  market_cap_usd?: number;
  trailing_pe?: number;
  forward_pe?: number;
  price_to_sales?: number;
  ev_to_revenue?: number;
  ev_to_ebitda?: number;
  eps_ttm?: number;
  beta?: number;
  // Per-stock betas (Workstream G2) — our OLS estimates over the 2y window
  beta_vs_spy?: number;            // Traditional market β vs SPY daily returns
  alpha_vs_spy?: number;
  r2_vs_spy?: number;              // % of stock variance explained by SPY
  beta_sample_size_spy?: number;
  beta_vs_long_basket?: number;    // Pan-portfolio β vs the live crypto long basket
  alpha_vs_long_basket?: number;
  r2_vs_long_basket?: number;
  beta_sample_size_basket?: number;
  // Per-stock absolute Quality Score (Workstream G1)
  quality_score_absolute?: number | null;
  quality_factor_coverage?: number;
  quality_factor_contributions?: Record<string, number>;
  quality_rank?: number;
  quality_rank_total?: number;
  // Quality / growth / margin fields (D1 — extracted from AV OVERVIEW)
  profit_margin?: number;
  operating_margin_ttm?: number;
  roa_ttm?: number;
  roe_ttm?: number;
  revenue_ttm?: number;
  gross_profit_ttm?: number;
  gross_margin_ttm?: number;
  eps_diluted_ttm?: number;
  eps_growth_yoy?: number;
  revenue_growth_yoy?: number;
  eps_estimate_cy?: number;
  eps_estimate_ny?: number;
  revenue_estimate_cy?: number;
  revenue_estimate_ny?: number;
  "52w_high"?: number;
  "52w_low"?: number;
  dividend_yield?: number;
  analyst_rating?: string;
  next_earnings?: string;
  // Finnhub news-sentiment (Workstream F3) — catalyst-awareness layer
  sentiment_company_news_score?: number;     // [0, 1], 0.5 = neutral
  sentiment_sector_avg_news_score?: number;
  sentiment_score_vs_sector?: number;        // company − sector_avg
  sentiment_buzz_articles_week?: number;
  sentiment_buzz_weekly_avg?: number;
  sentiment_buzz_ratio?: number;             // week / avg, >1.5 = heightened attention
  sentiment_bullish_pct?: number;
  sentiment_bearish_pct?: number;
  // Finnhub analyst overlay
  analyst_target_mean?: number;
  analyst_target_high?: number;
  analyst_target_low?: number;
  analyst_target_median?: number;
  analyst_target_last_updated?: string;
  analyst_recommend?: {
    period?: string;
    strong_buy?: number;
    buy?: number;
    hold?: number;
    sell?: number;
    strong_sell?: number;
  };
  // ETF
  total_assets_usd?: number;
  expense_ratio?: number;
  nav_price?: number;
  fund_family?: string;
  // Metals
  spot_ref_usd?: number;
  premium_to_spot_pct?: number | null;
  // Commodities
  front_month_usd?: number;
}

export interface SaaPosition {
  ticker: string;
  type: "long" | "put" | "call";
  value_usd: number;
  shares: number;
  pct_of_aum: number;
  cusip?: string;
  filing_period?: string;
  filing_url?: string;
  put_value_usd?: number;
  put_shares?: number;
}

export interface SaaSummary {
  filer?: string;
  cik?: string;
  period?: string;
  filing_url?: string;
  total_value_usd?: number;
  n_positions?: number;
  n_unmapped_cusips?: number;
}

// Multi-13F crowdedness (Workstream F1)
export interface FundHolder {
  label: string;
  category: string;
  pct_aum: number;
}

export interface MultiThirteenF {
  n_funds_long: number;
  n_funds_put: number;
  n_funds_total_holders: number;
  n_funds_tracked: number;
  crowdedness_long_pct: number;
  crowdedness_put_pct: number;
  avg_pct_aum_long: number | null;
  avg_pct_aum_put: number | null;
  holders_long: FundHolder[];
  holders_put: FundHolder[];
  hedge_fund_hotel: boolean;
  squeeze_risk: boolean;
}

export interface AiCapabilityOverlay {
  // 0-100 capability score for AI compute / hyperscaler / semis cluster
  ai_capability_score?: number | null;
  // Capex sensitivity sleeve weight (negative for INTC, etc.)
  capex_beta?: number | null;
  // For hyperscalers: which lab "their" partner is
  aligned_lab?: string | null;
  aligned_lab_share?: number | null;
  lab_bonus_pp?: number | null;
  components?: {
    capex_momentum_score?: number | null;
    lab_leadership_shares?: Record<string, number>;
  };
}

export interface TariffOverlay {
  // 0-100 tariff-adjusted sentiment for tariff-exposed tickers
  tariff_score?: number | null;
  // Per-ticker sleeve weight: negative for China-exposed, positive for
  // domestic-moat (INTC, USAR), zero if no exposure
  tariff_beta?: number | null;
  // Sectors flagged hot in the Kalshi sectoral multi-outcome (≥50% YES)
  hot_sectors?: string[];
  components?: {
    tariff_intensity_score?: number | null;
    china_decoupling_score?: number | null;
    beta?: number | null;
    decoupling_bonus_pp?: number | null;
  };
}

export interface SpacexIpoOverlay {
  // Implied SpaceX private valuation from Polymarket cap-above ladder (USD)
  spacex_implied_valuation_usd?: number | null;
  // Current SPCX perp mark (Binance fapi premiumIndex)
  spcx_perp_mark_usd?: number | null;
  // Empirical share count: valuation / mark
  spcx_implied_shares_outstanding?: number | null;
  // 7d EWMA anchor for the implied share count (becomes available after warmup)
  prior_implied_shares_anchor?: number | null;
  // Score 0-100 — >50 = perp cheap vs PM, <50 = perp rich vs PM (relative to anchor)
  spcx_pm_valuation_score?: number | null;
  // Positive = perp trading at a premium to PM-implied, negative = at a discount
  spcx_perp_premium_pct?: number | null;
}

export interface PredictionMarketOverlay {
  // Composite crypto-equity sentiment (COIN / CRCL / HOOD / MSTR)
  crypto_sentiment?: number | null;
  // For MSTR: explicit pp penalty to the base equity score from treasury risk
  treasury_risk_pp_penalty?: number | null;
  // For PAXG / XAUT (gold tokens)
  gold_relative_sentiment?: number | null;
  // Per-component breakdown for tooltip / debugging on the dashboard
  components?: Record<string, number | null>;
  // AI capability basket overlay — populated for ~17 AI/semis/hyperscaler tickers
  ai_capability?: AiCapabilityOverlay;
  // Tariff intensity basket overlay — populated for ~15 tariff-exposed tickers
  tariff?: TariffOverlay;
  // SpaceX IPO basket overlay — populated for SPCXUSDT only
  spacex_ipo?: SpacexIpoOverlay;
}

export interface SpacexIpoBasketSummary {
  updated_at: string | null;
  indicators: {
    spacex_implied_valuation_usd?: number | null;
    spacex_implied_valuation_centroid_t?: number | null;
    spacex_ipo_centroid_years?: number | null;
    spacex_ipo_prob_by_year_end?: number | null;
    spcx_perp_mark_usd?: number | null;
    spcx_implied_shares_outstanding?: number | null;
    spcx_perp_premium_pct?: number | null;
  };
}

export interface AiCapabilityBasketSummary {
  updated_at: string | null;
  indicators: {
    capex_momentum_score?: number | null;
    frontier_event_slug?: string | null;
    lab_leadership_shares?: Record<string, number>;
    leadership_concentration?: number | null;
    openai_ipo_prob_by_year_end?: number | null;
    openai_ipo_centroid_years?: number | null;
    anthropic_val_centroid_usd?: number | null;
    openai_val_centroid_usd?: number | null;
    agi_by_2027_prob?: number | null;
    claude_5_release_prob_by_year_end?: number | null;
    claude_5_release_centroid_years?: number | null;
    avgo_q2_ai_revenue_centroid_usd?: number | null;
    kalshi_agi_path_longest_date?: string | null;
    kalshi_agi_path_longest_prob?: number | null;
    kalshi_openai_ipo_first_prob?: number | null;
    kalshi_anthropic_ipo_first_prob?: number | null;
  };
}

export interface TariffIntensityBasketSummary {
  updated_at: string | null;
  indicators: {
    tariff_revenue_centroid_usd?: number | null;
    tariff_revenue_score?: number | null;
    effective_tariff_rate_centroid_pct?: number | null;
    effective_tariff_rate_score?: number | null;
    china_imports_centroid_usd?: number | null;
    sector_tariff_shares?: Record<string, number>;
    iran_imports_breach_prob?: number | null;
    scotus_tariff_hear_prob?: number | null;
    tariff_intensity_score?: number | null;
    china_decoupling_score?: number | null;
  };
}

export interface CryptoPriceBasketSummary {
  updated_at: string | null;
  indicators: {
    btc_year_end_centroid?: number | null;
    btc_year_end_implied_return_pct?: number | null;
    btc_year_end_score?: number | null;
    eth_year_end_centroid?: number | null;
    eth_year_end_implied_return_pct?: number | null;
    eth_year_end_score?: number | null;
    btc_dip_below_50k_prob?: number | null;
    btc_dip_risk_score?: number | null;
    btc_outperforms_gold_prob?: number | null;
    mstr_sells_btc_market_slug?: string | null;
    mstr_sells_btc_end_date?: string | null;
    mstr_sells_btc_prob?: number | null;
  };
  spot: {
    BTCUSDT?: number | null;
    ETHUSDT?: number | null;
  };
}

export interface TokenizedRow {
  symbol: string;
  label: string;
  asset_class: AssetClass;
  sector?: string | null;
  subsector?: string | null;
  crypto_adjacent: boolean;
  crypto_native: boolean;
  binance: BinanceLive;
  fundamentals: Fundamentals;
  saa_position?: SaaPosition;
  multi_13f?: MultiThirteenF;
  prediction_market_overlay?: PredictionMarketOverlay;
}

export type MarginalVolClassification = "diversifier" | "neutral" | "additive";

export interface PairMetrics {
  spread_vol_daily_pct_1x: number | null;
  spread_vol_daily_pct_2x: number | null;
  spread_vol_ann_pct_1x: number | null;
  spread_vol_ann_pct_2x: number | null;
  // Beta-hedged variant (Workstream C1): position 1 unit L / h* units S
  spread_vol_daily_pct_beta_neutral?: number | null;
  spread_vol_ann_pct_beta_neutral?: number | null;
  beta_hedge_ratio?: number | null;
  carry_apr_pct_beta_neutral?: number | null;
  sharpe_beta_neutral?: number | null;
  // Marginal portfolio vol impact (the PM-view, primary metric)
  marginal_vol_daily_pct?: number | null;
  marginal_vol_classification?: MarginalVolClassification | null;
  corr_to_portfolio?: number | null;
  // Cointegration / mean-reversion diagnostics (Workstream C2)
  adf_pvalue?: number | null;
  cointegration_pvalue?: number | null;
  half_life_days?: number | null;
  hurst_exponent?: number | null;
  is_cointegrating?: boolean;
  // Z-score timing signal (Workstream C3)
  spread_zscore_today?: number | null;
  spread_mean_logprice?: number | null;
  spread_std_logprice?: number | null;
  signal_zone?: "enter" | "near_enter" | "neutral" | "near_avoid" | "avoid" | null;
  // Fundamental Quality Differential (Workstream D, alpha layer).
  // After Citadel-style pillar restructure: Pillar 1 = Earnings Quality
  // (TTM only, stripped of valuation premium AND forward EPS growth).
  // Those moved to Pillars 2 + 3 below for orthogonality.
  quality_score?: number | null;
  quality_score_legacy?: number | null;        // pre-restructure 6-factor composite
  quality_score_coverage?: number;
  revenue_growth_diff_pp?: number | null;
  eps_growth_diff_pp?: number | null;
  operating_margin_diff_pp?: number | null;
  gross_margin_diff_pp?: number | null;
  roe_diff_pp?: number | null;
  eps_estimate_growth_diff_pp?: number | null;
  valuation_premium_pp?: number | null;
  // Pillar 2: Earnings Momentum (revisions + analyst rating trend)
  momentum_long_score?: number | null;
  momentum_short_score?: number | null;
  momentum_gap?: number | null;
  momentum_long_components?: Record<string, number | string | null> | null;
  momentum_short_components?: Record<string, number | string | null> | null;
  // Pillar 3: Forward Valuation (sector-relative Fwd P/E + PEG + EV/EBITDA)
  forward_val_long_score?: number | null;
  forward_val_short_score?: number | null;
  forward_val_gap?: number | null;
  forward_val_long_components?: Record<string, number | string | null> | null;
  forward_val_short_components?: Record<string, number | string | null> | null;
  // Pillar 4: Analyst Sentiment Residual (orthogonal to Pillar 3)
  analyst_sentiment_residual?: number | null;
  // Pillar 5: Carry/Positioning — funding z-scores per leg
  funding_z_long?: number | null;
  funding_z_short?: number | null;
  funding_crowding_spread_z?: number | null;
  // Sharpe split: carry = today's Sharpe; spread = mean-reversion alpha at 0 funding
  carry_sharpe?: number | null;
  spread_sharpe?: number | null;
  // Carry-Conviction direction & alignment
  carry_direction?: 1 | -1 | null;
  conviction_direction?: 1 | -1 | null;
  conviction_score?: number | null;
  carry_conviction_aligned?: boolean | null;
  // Catalyst horizon (D7)
  days_to_earnings_long?: number | null;
  days_to_earnings_short?: number | null;
  next_earnings_long?: string | null;
  next_earnings_short?: string | null;
  earnings_imminent?: boolean;
  correlation_weekday: number | null;
  correlation_ewma: number | null;
  correlation_spearman: number | null;
  correlation_residual_spy: number | null;
  drift_30d_pct: number | null;
  funding_long_apr_pct: number | null;
  funding_short_apr_pct: number | null;
  carry_apr_pct_1x: number | null;
  carry_apr_pct_2x: number | null;
  sharpe: number | null;
  // Liquidity-adjusted Sharpe (Workstream F4)
  deployable_notional_usd?: number | null;
  liquidity_weight?: number | null;
  sharpe_liq_adjusted?: number | null;
  valuation_gap_pct: number | null;
  valuation_gap_basis?: "forward_pe" | "price_to_sales" | "premium_to_spot" | null;
  analyst_upside_long_pct?: number | null;
  analyst_upside_short_pct?: number | null;
  analyst_upside_gap_pct?: number | null;
  // PM-thesis edge — L − S deltas across each basket. Populated by
  // tokenized_pairs.enrich_pairs_with_pm_edge after overlays merge.
  pm_thesis_edge?: PmThesisEdge;
}

export interface PmThesisEdge {
  ai_capability_edge_pp?: number;
  tariff_edge_pp?: number;
  crypto_edge_pp?: number;
  gold_relative_edge_pp?: number;
  spacex_edge_pp?: number;
  // List of edges with |edge_pp| >= 5, sorted by magnitude desc
  thesis_aligned_edges: Array<{ label: string; edge_pp: number }>;
  max_edge_magnitude_pp: number;
  dominant_basket: string | null;
}

export interface BasketMetrics {
  name: string;
  longs: Record<string, number>;
  shorts: Record<string, number>;
  long_funding_apr_pct: number | null;
  short_funding_apr_pct: number | null;
  long_coverage: number;
  short_coverage: number;
  carry_apr_pct_1x: number | null;
  carry_apr_pct_2x: number | null;
  spread_vol_daily_pct_1x: number | null;
  spread_vol_daily_pct_2x: number | null;
  spread_vol_ann_pct_1x: number | null;
  spread_vol_ann_pct_2x: number | null;
  vol_coverage: number;
  sharpe: number | null;
}

export type SectorMatch = "same_subsector" | "same_sector" | "cross_sector";

export interface PairIdea {
  long_symbol: string;
  long_label: string;
  long_sector?: string | null;
  long_subsector?: string | null;
  short_symbol: string;
  short_label: string;
  short_sector?: string | null;
  short_subsector?: string | null;
  sector_match?: SectorMatch;
  asset_class: AssetClass | "cross";
  category: "saa_anchored" | "stock" | "etf" | "metal" | "commodity" | "cross";
  metrics: PairMetrics;
  score: number;
  rationale: string;
  // Daily spread return series (basket-builder mode). Aligned with the
  // top-level portfolio_returns in PairsPayload. Roughly 130-500 daily obs.
  spread_returns?: number[];
  saa?: {
    long_ticker?: string;
    long_value_usd?: number;
    long_pct_aum?: number;
    filing_url?: string;
    short_validation?: {
      ticker?: string;
      value_usd?: number;
      filing_url?: string;
    };
  };
}

export interface PortfolioContext {
  portfolio_vol_daily_pct?: number | null;
  portfolio_returns_sample_size?: number;
  // Live-portfolio daily returns (aligned with each pair's spread_returns).
  // Used by basket-builder mode to recompute marginal vol against
  // simulated portfolio = live + staged pairs at user-set weights.
  portfolio_returns?: number[] | null;
}

// 1L:2S triple (Workstream G3)
export interface TripleMetrics {
  quality_long: number;
  quality_short_1: number;
  quality_short_2: number;
  quality_shorts_avg: number;
  quality_diff: number;
  beta_L_spy: number;
  beta_S1_spy: number;
  beta_S2_spy: number;
  net_beta_spy: number;
  beta_L_basket: number | null;
  beta_S1_basket: number | null;
  beta_S2_basket: number | null;
  net_beta_basket: number | null;
  funding_long_apr_pct: number;
  funding_short_1_apr_pct: number;
  funding_short_2_apr_pct: number;
  net_funding_carry_apr_pct: number;
  intra_short_correlation: number | null;
  spread_vol_daily_pct: number | null;
  sharpe: number | null;
}

export interface TripleIdea {
  long_symbol: string;
  short_symbols: [string, string];
  weights: Record<string, number>;
  metrics: TripleMetrics;
  score: number;
  rationale: string;
}

export interface PairsPayload extends PortfolioContext {
  triples?: TripleIdea[];
  updated_at?: string;
  n_klines_pulled?: number;
  metrics_note?: string;
  funding_days_by_symbol?: Record<string, number>;
  saa_anchored: PairIdea[];
  generic: PairIdea[];
  baskets?: {
    saa_faithful?: BasketMetrics;
    carry_optimized?: BasketMetrics;
    reverse_tilted?: BasketMetrics;
    valuation_tilted?: BasketMetrics;
  };
  error?: string;
}

export interface TokenizedSnapshot {
  live_updated_at: string | null;
  fundamentals_updated_at: string | null;
  asset_class: AssetClass | null;
  count: number;
  rows: TokenizedRow[];
  universe_size: number;
  saa_summary: SaaSummary;
  pairs?: PairsPayload;
  crypto_price_basket?: CryptoPriceBasketSummary;
  ai_capability_basket?: AiCapabilityBasketSummary;
  tariff_intensity_basket?: TariffIntensityBasketSummary;
  spacex_ipo_basket?: SpacexIpoBasketSummary;
}

export function useTokenizedAssets(asset_class?: AssetClass) {
  const { client, engine } = useEngine();
  return useQuery<TokenizedSnapshot>({
    queryKey: ["tokenized-assets", engine.id, asset_class ?? "all"],
    queryFn: () =>
      client.get("/api/tokenized-assets", asset_class ? { asset_class } : undefined),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
