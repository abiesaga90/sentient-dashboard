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
  eps_ttm?: number;
  beta?: number;
  "52w_high"?: number;
  "52w_low"?: number;
  dividend_yield?: number;
  analyst_rating?: string;
  next_earnings?: string;
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

export interface PairMetrics {
  spread_vol_daily_pct_1x: number | null;
  spread_vol_daily_pct_2x: number | null;
  spread_vol_ann_pct_1x: number | null;
  spread_vol_ann_pct_2x: number | null;
  correlation_weekday: number | null;
  drift_30d_pct: number | null;
  funding_long_apr_pct: number | null;
  funding_short_apr_pct: number | null;
  carry_apr_pct_1x: number | null;
  carry_apr_pct_2x: number | null;
  sharpe: number | null;
  valuation_gap_pct: number | null;
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

export interface PairsPayload {
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
