// ── Status ──
export interface StatusResponse {
  service: string;
  status: string;
  version: string;
  strategy_name: string;
  execution_mode: string;
  paper_trading: boolean;
  timestamp: string;
  conviction_shorts: string[];
  conviction_short_weight_pct: number;
  use_conviction_watchlist: boolean;
  max_conviction_shorts: number;
  features: Record<string, boolean>;
  feature_health: {
    vol_regime: string | null;
    corr_regime: string | null;
    factor_model_active: boolean;
    factor_symbols_count: number;
    last_rebalance: string | null;
    next_rebalance_at: string | null;  // backward compat → points to rotation
    next_rotation_at: string | null;
    last_resize_at: string | null;
    drift_action: string;
    drift_urgency: string;
    drift_zone: string;
  };
}

// ── Position ──
export interface Position {
  symbol: string;
  side: "LONG" | "SHORT";
  tags?: string[];
  entry_price: number;
  current_price: number;
  quantity: number;
  notional: number;
  entry_notional: number;
  pnl_pct: number;
  pnl_usd: number;
  hours_held: number;
  entry_time: string;
  exchanges: string[];
  tp_pct: number | null;
  sl_pct: number | null;
  daily_vol_pct: number | null;
  market_cap: number | null;
  mcap_rank: number | null;
  rank_source?: string;
  volume_24h_usd: number | null;
  volume_rank: number | null;
  open_interest_usd: number | null;
  beta: number | null;
  correlation: number | null;
  annualized_vol: number | null;
  inv_vol_weight: number | null;
  rsi_daily: number | null;
  rsi_weekly: number | null;
  fdv_mcap_ratio?: number | null;
  current_tilt?: number | null;
  current_adjusted_score?: number | null;
  entry_signals?: {
    va_score?: number | null;
    sm_score?: number | null;
    p3_score?: number | null;
    adjusted_score?: number | null;
    long_tilt?: number | null;
    short_correlation?: number | null;
    short_beta?: number | null;
    short_momentum_7d?: number | null;
  };
}

export interface BetaAggregate {
  long_basket_beta: number | null;
  short_basket_beta: number | null;
  long_beta_notional: number;
  short_beta_notional: number;
  net_beta_usd: number;
  // Canonical (legacy: NAV-denominated in /api/positions; notional in /api/risk)
  net_beta_pct: number;
  // Three-denominator breakouts
  net_beta_pct_notional?: number;
  net_beta_pct_nav?: number;
  net_beta_pct_gross?: number;
  denom_notional?: number;
  denom_nav?: number;
  denom_gross?: number;
  avg_long_beta: number | null;
  avg_short_beta: number | null;
  beta_ratio: number | null;
  short_basket_avg_corr: number | null;
}

// ── Portfolio ──
export interface Portfolio {
  nav: number;
  hwm: number;
  dd_pct: number;
  dd_scale: number;
  total_fees: number;
  n_positions: number;
  n_longs: number;
  n_shorts: number;
  n_longs_target: number;
  n_shorts_target: number;
  gross_pct: number;
  net_pct: number;
  recovery_scale: number;
  paper_trading: boolean;
  starting_capital: number;
  total_return_pct: number;
  daily_return_pct?: number;
  ls_spread?: {
    spread_24h_pct: number;
    long_24h_pct: number;
    short_24h_pct: number;
    ew_spread_24h_pct?: number | null;
    ew_long_24h_pct?: number | null;
    ew_short_24h_pct?: number | null;
    sizing_lift_24h_pct?: number | null;
    cumulative_spread_pct: number;
    information_ratio: number;
    down_day_capture_pct: number;
    net_beta_pct?: number;
    horizons?: Record<string, {
      spread_pct: number;
      long_pct: number;
      short_pct: number;
      alpha_pct?: number;
      beta_drag_pct?: number;
      btc_return_pct?: number;
      ew_spread_pct?: number | null;
      ew_long_pct?: number | null;
      ew_short_pct?: number | null;
      sizing_lift_pct?: number | null;
    }>;
    periods?: Record<string, {
      spread_pct: number;
      long_pct: number;
      short_pct: number;
      days: number;
      alpha_pct?: number;
      beta_drag_pct?: number;
      btc_return_pct?: number;
      ew_spread_pct?: number | null;
      ew_long_pct?: number | null;
      ew_short_pct?: number | null;
      sizing_lift_pct?: number | null;
      pw_vol_pct?: number | null;
      ew_vol_pct?: number | null;
      pw_vol_adj?: number | null;
      ew_vol_adj?: number | null;
      vol_adj_lift?: number | null;
      ic?: number | null;
    }>;
    ex_outliers?: {
      label: string;
      symbols: string[];
      total_pnl_removed: number;
      periods: Record<string, {
        spread_pct: number;
        long_pct: number;
        short_pct: number;
        days: number;
        alpha_pct?: number;
        beta_drag_pct?: number;
        btc_return_pct?: number;
        ew_spread_pct?: number | null;
        ew_long_pct?: number | null;
        ew_short_pct?: number | null;
        sizing_lift_pct?: number | null;
        pw_vol_pct?: number | null;
        ew_vol_pct?: number | null;
        pw_vol_adj?: number | null;
        ew_vol_adj?: number | null;
        vol_adj_lift?: number | null;
        ic?: number | null;
      }>;
      cumulative_spread_pct: number;
      information_ratio: number;
      down_day_capture_pct: number;
    };
  };
  daily_attribution?: {
    period: string;
    prev_nav: number;
    curr_nav: number;
    nav_change: number;
    nav_change_pct: number;
    components: {
      mtm_held: number;
      turnover_pnl: number;
      funding: number;
      fees: number;
    };
    turnover_by_reason: Record<string, { count: number; pnl: number; notional: number; fees: number }>;
    total_trades: number;
    total_turnover_notional: number;
    turnover_pct_of_nav: number;
  };
}

// ── Risk ──
export interface RiskData {
  dd_scale: number;
  dd_pct: number;
  distance_to_sl_pct: number;
  max_drawdown_pct: number;
  nav: number;
  hwm: number;
  gross_long: number;
  gross_short: number;
  gross_usd?: number;
  net_usd?: number;
  net_beta_usd?: number;
  gross_pct: number;
  net_pct: number;
  // Three-denominator breakouts (added 2026-05-11; populated live from
  // engine cache in /api/risk so the dashboard can show all three views).
  gross_pct_notional?: number;
  gross_pct_nav?: number;
  net_pct_notional?: number;
  net_pct_nav?: number;
  net_pct_gross?: number;
  net_beta_pct_notional?: number;
  net_beta_pct_nav?: number;
  net_beta_pct_gross?: number;
  denom_notional?: number;
  denom_nav?: number;
  denom_gross?: number;
  n_longs: number;
  n_shorts: number;
  vol_scale: number;
  btc_fast_vol: number | null;
  btc_slow_vol: number | null;
  vol_ratio: number | null;
  combined_vol_scale: number;
  effective_scale: number;
  effective_max_gross_pct: number;
  portfolio_vol_scale: number | null;
  realized_port_vol: number | null;
  target_port_vol: number | null;
  timestamp: string;
  compliance: {
    max_dd_ok: boolean;
    gross_ok: boolean;
    net_ok: boolean;
  };
  limits: {
    dd_stop_pct: number;
    max_leverage_pct: number;
    max_net_pct: number;
  };
  cooldown_until: string;
  recovery_stage: string;
  net_beta_pct: number | null;
  target_beta_tilt_pct: number;
  spread_vol?: {
    daily_spread_vol_pct: number | null;
    annual_spread_vol_pct: number | null;
    dd_budget_ratio_sigma: number | null;
    spread_vol_target_pct: number | null;
    vol_regime: string;
    ls_correlation_30d: number | null;
    dd_budget_dollars: number | null;
    daily_pnl_vol_dollars: number | null;
    // MC-based P(stop) fields (drift + elastic DD scaling, 1y horizon)
    daily_spread_drift_pct?: number | null;
    spread_vol_target_pct_mc?: number | null;
    p_stop_current_pct?: number | null;
    p_stop_horizon_days?: number | null;
  };
}

// ── Equity ──
export interface EquityPoint {
  date: string;
  nav: number;
}

// ── Trade ──
export interface Trade {
  id: number;
  symbol: string;
  side: string;
  action: string;
  quantity: number;
  price: number;
  notional: number;
  pnl: number;
  fees: number;
  reason: string;
  timestamp: string;
}

// ── Target ──
export interface Target {
  symbol: string;
  side: string;
  target_notional: number;
  tags?: string[];
}

// ── ADL ──
export interface AdlPosition {
  symbol: string;
  side: string;
  adl_quantile: number;
  risk_level: string;
  notional: number;
}

export interface AdlData {
  positions: AdlPosition[];
  critical_count: number;
  high_count: number;
  total_positions: number;
  timestamp: string;
}

// ── Basket Comparison ──
export interface BasketSide {
  count: number;
  total_notional: number;
  total_entry_notional: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  weighted_avg_hold_hours: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
}

export interface BasketComparison {
  long_basket: BasketSide;
  short_basket: BasketSide;
  comparison: {
    beta_gap: number;
    hedge_ratio_pct: number;
    net_unrealized_pnl: number;
    net_exposure: number;
    net_exposure_pct: number;
    gross_exposure: number;
  };
  period_summary: {
    period: string;
    since_date: string | null;
    trading_days: number;
    long_realized_pnl: number;
    short_realized_pnl: number;
    net_realized_pnl: number;
    long_total_return_pct: number;
    short_total_return_pct: number;
  };
  hedge_metrics: {
    down_day_capture_rate: number;
    tracking_error_ann: number;
    information_ratio: number;
    cumulative_spread_return_pct: number;
    long_max_dd_pct: number;
    short_max_dd_pct: number;
    rolling_hedge_ratio: Array<{ date: string; ratio: number }>;
    trading_days: number;
  };
  daily_series: Array<{
    date: string;
    long_return: number;
    short_return: number;
    spread_return: number;
  }>;
}

// ── Dashboard Composite ──
export interface DashboardResponse {
  portfolio: Portfolio;
  risk: RiskData;
  positions: {
    positions: Position[];
    count: number;
    winners_total_pnl: number;
    losers_total_pnl: number;
    winners_count: number;
    losers_count: number;
    beta?: BetaAggregate;
  };
  equity: {
    equity: EquityPoint[];
    count: number;
  };
  trades: {
    trades: Trade[];
    count: number;
  };
  targets: {
    targets: Target[];
    count: number;
  };
  adl: AdlData;
  basket_comparison: BasketComparison;
  status: {
    service: string;
    status: string;
    version: string;
    strategy_name: string;
    execution_mode: string;
    paper_trading: boolean;
    timestamp: string;
    position_source: string;
    nav_source: string;
  };
  nt_risk?: Record<string, unknown>;
}

// ── PnL ──
export interface PnlDecomposition {
  reason: string;
  pnl: number;
  fees: number;
  notional: number;
  trade_count: number;
  long_pnl: number;
  short_pnl: number;
}

export interface PnlBySymbol {
  symbol: string;
  side: string;
  realized_pnl: number;
  fees: number;
  trade_count: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  has_open_position: boolean;
}

export interface MonthlyPnl {
  month: string;
  start_nav: number;
  end_nav: number;
  pnl: number;
  pnl_pct: number;
}

export interface DailyPnl {
  date: string;
  nav: number;
  pnl: number;
  pnl_pct: number;
}

export interface PnlResponse {
  nav: number;
  starting_capital: number;
  all_time: {
    total_return: number;
    total_return_pct: number;
    realized_pnl: number;
    unrealized_pnl: number;
    funding_pnl: number;
    total_fees: number;
    exchange_income: Record<string, number>;
  };
  mtd: { start_nav: number; pnl: number; pnl_pct: number };
  wtd: { pnl: number; pnl_pct: number };
  qtd: { start_nav: number; pnl: number; pnl_pct: number };
  ytd: { start_nav: number; pnl: number; pnl_pct: number };
  monthly: MonthlyPnl[];
  weekly: Array<{ week: string; start_nav: number; end_nav: number; pnl: number; pnl_pct: number }>;
  daily: DailyPnl[];
  total_trades: number;
  decomposition: PnlDecomposition[];
  by_symbol: PnlBySymbol[];
  period: string;
}

// ── Risk History ──
export interface RiskHistoryPoint {
  timestamp: string;
  gross_pct: number;
  net_pct: number;
  nav: number;
  n_longs: number;
  n_shorts: number;
}

// ── Rankings ──
export interface VaSignalDetail {
  value: number | null;
  signal: number | null;
  weight: number;
  boost?: number | null;
  z_score?: number | null;
  freshness?: number | null;
}

export interface SmSignalDetail {
  value: number | null;
  signal: number | null;
  z_score?: number | null;
  freshness?: number | null;
}

export interface P3SignalDetail {
  value: number | null;
  signal: number | null;
  z_score?: number | null;
  freshness?: number | null;
}

export interface RankingCandidate {
  symbol: string;
  score: number;
  corr: number;
  beta: number;
  beta_penalty: number;
  volume_24h: number;
  fund_score: number;
  fund_score_raw: number;
  n_fund_signals: number;
  fund_confidence: number;
  va_score?: number | null;
  sm_score?: number | null;
  op_score?: number | null;
  mm_score?: number | null;
  adjusted_score?: number | null;
  sector?: string | null;
  gate_failure?: string | null;
  in_basket?: boolean;
  current_notional?: number | null;
  current_pnl_pct?: number | null;
  va_signals: Record<string, VaSignalDetail>;
  sm_signals?: {
    netflow_30d?: SmSignalDetail;
    holders_relative?: SmSignalDetail;
    perp_pressure?: SmSignalDetail;
    perp_funding?: SmSignalDetail;
    dex_net_volume?: SmSignalDetail;
    dat_accumulation?: SmSignalDetail;
    arkham_exchange_flow?: SmSignalDetail;
    arkham_fund_flow?: SmSignalDetail;
    arkham_concentration?: SmSignalDetail;
    arkham_whale_direction?: SmSignalDetail;
  } | null;
  p3_signals?: Record<string, P3SignalDetail> | null;
  supply_health_composite?: number | null;
  va_weights_effective?: Record<string, number> | null;
  inversion_applied?: boolean;
  long_raw_score?: number | null;
  va_total_boost: number | null;
  fdv_mcap_ratio: number | null;
  unlock_pressure: number | null;
  ath_drawdown_pct: number | null;
  ath_date: string | null;
  momentum_signal: number | null;
  momentum_veto_pct: number | null;
  momentum_veto_7d_pct: number | null;
  eligible: boolean;
  filter_reasons: string[];
  status: string[];
  quality_tags: string[];
  nansen_signals?: {
    sm_netflow: number | null;
    perp_funding_rate: number | null;
  };
  nansen_stale?: boolean;
  unlock_schedule?: {
    next_events: Array<{
      date: string;
      pct_of_max: number;
      amount_tokens: number;
      categories: string[];
    }>;
    days_until_next: number | null;
    unlock_pressure_30d: number;
    total_events: number;
  } | null;
  short_thesis?: {
    name: string;
    thesis: string;
    bull_case: string[];
    bear_case: string[];
    key_metrics: Record<string, string>;
    category: string;
  } | null;
  mindshare_gainer: number | null;
  mindshare_loser: number | null;
  mindshare_delta: number | null;
  mindshare_mult: number | null;
  cg_trending_attention?: number | null;
  mcap_rank?: number | null;
}

export interface FundWeights {
  dilution: number;
  fee_mom: number;
  unlock: number;
  supply_mom: number;
  rev_cap: number;
  buyback: number;
}

export interface RankingsResponse {
  candidates: RankingCandidate[];
  count: number;
  universe_size: number;
  excluded_count: number;
  n_shorts: number;
  diversity_cap: number;
  diversity_penalty: number;
  min_beta: number;
  min_volume: number;
  lookback_hours: number;
  momentum_weight: number;
  momentum_lookback_hours: number;
  momentum_veto_enabled: boolean;
  momentum_veto_lookback_hours: number;
  momentum_veto_threshold_pct: number;
  momentum_veto_confirm_lookback_hours: number;
  momentum_veto_count: number;
  fund_first_shorts: boolean;
  short_corr_floor: number;
  short_fund_confidence_floor: number;
  fund_weights: FundWeights;
  va_short_dilution_weight: number;
  va_short_dilution_threshold: number;
  va_short_supply_momentum_weight: number;
  va_short_buyback_weight: number;
  va_short_revenue_capture_weight: number;
  va_short_fee_momentum_weight: number;
  va_short_unlock_weight: number;
  correlation_method: string;
  data_quality_enabled: boolean;
  shrunk_diversity_enabled: boolean;
  stale_symbols_filtered: string[];
  nansen_status?: {
    fresh_count: number;
    stale_count: number;
    oldest_update: string | null;
  };
  unmapped_top_coins?: Array<{
    symbol: string;
    name: string;
    global_rank: number;
    market_cap: number | null;
  }>;
  timestamp: string;
}

// ── Signal Inventory ──
export interface SignalInfo {
  name: string;
  type: string;
  description: string;
  weight?: number;
  threshold?: number;
  status: string;
  category: string;
  sources?: string[];
}

export interface SignalInventoryResponse {
  short_signals: SignalInfo[];
  long_signals: SignalInfo[];
  active_count: number;
  planned_count: number;
  total_short_signals: number;
  total_long_signals: number;
  data_sources: string[];
}

// ── Hedge Quality ──

export interface HedgeQualityKpis {
  down_day_capture_rate: number;
  beta_hedge_ratio_pct: number;
  net_beta_usd: number;
  net_beta_pct: number;
  tracking_error_ann: number;
  information_ratio: number;
  downside_beta_ratio: number;
}

export interface RollingHedgeRatioPoint {
  date: string;
  hedge_ratio_pct: number;
}

export interface PerShortHedge {
  symbol: string;
  beta: number;
  downside_beta: number;
  correlation: number;
  notional: number;
  hedge_score: number;
  unrealized_pnl: number;
}

export interface CorrelationHeatmap {
  symbols: string[];
  sides: string[];
  matrix: number[][];
}

export interface LsCorrelationPoint {
  date: string;
  corr_7d: number | null;
  corr_30d: number | null;
}

export interface HedgeQualityResponse {
  kpis: HedgeQualityKpis;
  rolling_hedge_ratio: RollingHedgeRatioPoint[];
  per_short_hedge: PerShortHedge[];
  correlation_heatmap: CorrelationHeatmap;
  ls_correlation_trend: {
    corr_7d: number | null;
    corr_30d: number | null;
    series: LsCorrelationPoint[];
  };
}

// ── Execution Quality ──
export interface ExecutionReport {
  id: number;
  timestamp: string;
  symbol: string;
  side: string;
  action: string;
  arrival_price: number;
  fill_price: number;
  slippage_bps: number;
  intended_notional: number;
  actual_notional: number;
  execution_time_secs: number;
}

export interface ExecutionQualityResponse {
  summary: {
    avg_slippage_bps: number;
    median_slippage_bps: number;
    total_cost_usd: number;
    worst_slippage_symbol: string;
    n_trades: number;
    avg_execution_time_secs: number;
  };
  recent_reports: ExecutionReport[];
}

// ─────────────────────────────────────────────────────────────────────
// Daily PnL & Positions View (Phase 2, 2026-05-24)
// ─────────────────────────────────────────────────────────────────────

export interface DailyPnlPerSymbolRow {
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  notional: number;
  open_px: number | null;
  close_px: number | null;
  pct_move: number;
  carry_pnl: number;
  realized_pnl: number;
  funding_pnl: number;
  fees: number;
  /** day_pnl = carry + funding + fees. Realized is shown for transparency
   *  but excluded from day_pnl to avoid the rebalance double-count. */
  day_pnl: number;
}

export interface DailyPnlPerSymbolTotals {
  carry: number;
  realized: number;
  funding: number;
  fees: number;
  day_pnl: number;
  long_basket: number;
  short_basket: number;
  /** Engine NAV delta = NAV(date) - NAV(date-1). Source of truth. */
  engine_net_pnl: number | null;
  engine_nav: number | null;
  engine_nav_prev: number | null;
}

export interface DailyPnlPerSymbolResponse {
  date: string;
  is_today: boolean;
  /** "live_cache" (today) or "snapshot" (past dates) */
  source: string;
  rows: DailyPnlPerSymbolRow[];
  totals: DailyPnlPerSymbolTotals;
  stats: {
    n_positions: number;
    n_priced: number;
    n_winners: number;
    n_losers: number;
    hit_rate_pct: number;
  };
  note?: string;
  error?: string;
}

export interface DailyPnlHistoryDay {
  date: string;
  long_pnl: number;
  short_pnl: number;
  carry: number;
  realized: number;
  funding: number;
  fees: number;
  /** Engine NAV delta when available, else net_pnl_carry. */
  net_pnl: number;
  net_pnl_carry: number;
  net_pnl_engine: number | null;
  nav: number | null;
  n_positions: number;
  cum_long: number;
  cum_short: number;
  cum_net: number;
  cum_net_carry: number;
  cum_net_engine: number;
}

export interface DailyPnlHistoryResponse {
  days: number;
  n_symbols: number;
  n_priced: number;
  daily: DailyPnlHistoryDay[];
  cumulative: {
    long_carry: number;
    short_carry: number;
    net_carry: number;
    net_engine: number;
    net: number;
  };
  note?: string;
}

// ─── Tokenized Positions (permanent index/ETF pairs sleeve, 2026-05-24) ──

export interface TokenizedFundingWindows {
  apr_24h_756: number | null;
  apr_7d_756: number | null;
  apr_all_756: number | null;
  apr_all_1095: number | null;
  n_weekday_24h: number | null;
  n_weekday_7d: number | null;
  n_weekday_all: number | null;
  first_event_iso: string | null;
  last_event_iso: string | null;
  span_days: number | null;
}

export interface TokenizedPairTargetBlock {
  long_notional: number;
  short_notional: number;
  pair_gross: number;
  h_star: number;
  pair_weight: number;
  natural_share_pct: number;
  cap_binding: boolean;
  cap_pct_of_notional: number;
  expected_carry_apr_2x: number;
  pair_residual_vol_daily_pct: number;
  long_received_funding_apr_pct: number | null;
  short_received_funding_apr_pct: number | null;
  long_expected_funding_per_settle_usd: number | null;
  short_expected_funding_per_settle_usd: number | null;
  long_funding_windows: TokenizedFundingWindows | null;
  short_funding_windows: TokenizedFundingWindows | null;
}

export interface TokenizedPairActualBlock {
  long_notional: number;
  short_notional: number;
  // Per-leg pair-relative beta. Long leg carries h_star (OLS slope of L on S);
  // short leg is the reference at 1.0. β-adjusted notionals should match
  // within ~1% inside each pair when h* sizing is doing its job.
  long_pair_beta: number | null;
  short_pair_beta: number | null;
  long_beta_adj_notional: number | null;
  short_beta_adj_notional: number | null;
  long_qty: number | null;
  short_qty: number | null;
  long_entry_price: number | null;
  long_mark_price: number | null;
  short_entry_price: number | null;
  short_mark_price: number | null;
  long_entry_time: string | null;
  short_entry_time: string | null;
  long_pnl_pct: number | null;
  short_pnl_pct: number | null;
  long_vol_24h_usd: number | null;
  short_vol_24h_usd: number | null;
  long_open_interest_usd: number | null;
  short_open_interest_usd: number | null;
  days_held: number;
  long_pnl_usd: number;
  short_pnl_usd: number;
  spread_pnl_usd: number;
  long_funding_accrued_usd: number;
  short_funding_accrued_usd: number;
  total_funding_accrued_usd: number;
  total_pnl_with_funding_usd: number;
  // Live current funding APR per leg, position-relative sign, 756-base for
  // tokenized (weekday-only). Distinct from the trailing-window means in
  // long_funding_windows / short_funding_windows.
  long_funding_rate_ann_now_pct: number | null;
  short_funding_rate_ann_now_pct: number | null;
}

export interface TokenizedPairFundingProjection {
  long_received_funding_apr_pct: number | null;
  short_received_funding_apr_pct: number | null;
  long_expected_funding_per_settle_usd: number | null;
  short_expected_funding_per_settle_usd: number | null;
}

export interface TokenizedFundingInfo {
  next_settle_utc: string;
  hours_to_next_settle: number;
  is_weekend: boolean;
  settles_per_year: number;
  weekday_only_note: string;
}

export interface TokenizedFundingAprMethodology {
  base: number;
  base_label: string;
  rationale: string;
  window_definitions: Record<string, string>;
  regime_hint: string;
}

export interface TokenizedPairCarryBlock {
  now_apr_2x: number | null;
  rolling_mean_apr_2x: number | null;
  threshold_apr_2x: number;
  n_snapshots: number;
  window_days: number;
  decision_reason: string;
  should_close: boolean;
  distance_to_threshold_pct_pts: number | null;
}

export interface TokenizedPairUnderlyingLeg {
  label: string | null;
  asset_class: string | null;
  sector: string | null;
  subsector: string | null;
  yahoo_ticker: string | null;
}

export interface TokenizedPairUnderlying {
  long: TokenizedPairUnderlyingLeg;
  short: TokenizedPairUnderlyingLeg;
  thesis: string | null;
}

export interface TokenizedPairRow {
  id: string;
  long_symbol: string;
  short_symbol: string;
  status: "dry_run" | "active" | "ready" | "exit_fired" | "cold";
  exit_carry_threshold_apr_2x: number;
  underlying?: TokenizedPairUnderlying;
  target: TokenizedPairTargetBlock | null;
  actual: TokenizedPairActualBlock | null;
  carry: TokenizedPairCarryBlock;
  carry_series_30d: { ts: number; carry_apr_2x: number }[];
}

export interface TokenizedPositionsResponse {
  updated_at: string;
  enabled: boolean;
  dry_run: boolean | null;
  config?: {
    carry_eval_window_days: number;
    max_gross_pct_of_notional: number;
    notional_capital: number;
  };
  funding_info?: TokenizedFundingInfo;
  funding_apr_methodology?: TokenizedFundingAprMethodology;
  health: {
    n_configured: number;
    n_active: number;
    n_pending_close: number;
    total_gross_target: number;
    total_gross_actual: number;
    total_gross_target_pct_of_notional?: number;
    weighted_avg_carry_apr_2x?: number | null;
    total_unrealized_pnl_usd?: number;
    total_funding_accrued_usd?: number;
    oldest_position_days_held?: number | null;
  };
  pairs: TokenizedPairRow[];
}

// ── Macro Regime: multi-horizon, IC weights, baskets (Phases 1-5, 2026-05-30) ──

export interface MacroHorizonBlock {
  horizon_days: number;
  composite_score: number | null;
  regime: string;
  sources_available: number;
  sources_total: number;
  confidence: "high" | "low";
  payload?: {
    weights?: Record<string, { weight: number; source: string; conf?: string }>;
    indicator_contributions?: Record<string, number>;
  };
}

export interface MacroHorizonsPreview {
  updated_at: string;
  horizons: Record<string, {
    composite_score: number | null;
    regime: string;
    confidence: "high" | "low";
    sources_available: number;
    sources_total: number;
  }>;
  combined: {
    combined_score: number;
    combined_tilt_pct: number;
    horizon_contributions: Record<string, { weight: number; score: number; regime: string }>;
    confidence: "high" | "low";
  };
}

export interface MacroHorizonsResponse {
  horizon_days: number[];
  horizon_weights: Record<string, number>;
  tilt_source: "single" | "multi";
  confidence_floor: number;
  latest: MacroHorizonBlock[];
  timeseries: (MacroHorizonBlock & { timestamp: string })[];
  preview: MacroHorizonsPreview | null;
}

export interface MacroWeightHistoryRow {
  computed_at: string;
  indicator_key: string;
  horizon_days: number;
  dependent: string;
  prior_weight: number | null;
  ic_value: number | null;
  ic_n_obs: number | null;
  effective_weight: number;
  sign_flipped: number;     // 0|1
  soft_paused: number;      // 0|1
  audit_note: string | null;
}

export interface MacroWeightsResponse {
  history: MacroWeightHistoryRow[];
  latest_nav_sortino: Record<string, MacroWeightHistoryRow[]>;  // keyed by horizon_days
}

export interface MacroBasketLegHistory {
  id: number;
  timestamp: string;
  basket_key: string;
  source: string | null;
  event_slug: string | null;
  market_slug: string | null;
  side: string | null;
  prob_yes: number | null;
  side_adjusted_prob: number | null;
  volume_24h_usd: number | null;
  liquidity_usd: number | null;
  used: number;             // 0|1
  skip_reason: string | null;
}

export interface MacroBasketLegIC {
  id: number;
  computed_at: string;
  basket_key: string;
  market_slug: string;
  dependent: string;
  horizon_days: number;
  ic_value: number | null;
  hit_rate: number | null;
  n_observations: number | null;
  lookback_days: number | null;
}

export type MacroBasketsResponse = Record<string, {
  legs: MacroBasketLegHistory[];
  leg_ic: MacroBasketLegIC[];
}>;

export interface MacroICRollingResponse {
  indicator_key: string;
  dependent: string;
  horizon_days: number;
  lookback_days: number;
  ic_history: {
    computed_at: string;
    ic_value: number | null;
    hit_rate: number | null;
    n_observations: number | null;
    lookback_days: number | null;
  }[];
  score_history: { date: string; score: number }[];
}
