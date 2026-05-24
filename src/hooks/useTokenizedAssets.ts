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
  // Fundamental Quality Differential (Workstream D, alpha layer)
  quality_score?: number | null;
  quality_score_coverage?: number;
  revenue_growth_diff_pp?: number | null;
  eps_growth_diff_pp?: number | null;
  operating_margin_diff_pp?: number | null;
  gross_margin_diff_pp?: number | null;
  roe_diff_pp?: number | null;
  eps_estimate_growth_diff_pp?: number | null;
  valuation_premium_pp?: number | null;
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
  valuation_gap_pct: number | null;
  valuation_gap_basis?: "forward_pe" | "price_to_sales" | "premium_to_spot" | null;
  analyst_upside_long_pct?: number | null;
  analyst_upside_short_pct?: number | null;
  analyst_upside_gap_pct?: number | null;
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

export interface PairsPayload extends PortfolioContext {
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
