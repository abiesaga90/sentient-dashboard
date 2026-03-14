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
  vol_sl_cooldowns: Record<string, string>;
  features: Record<string, boolean>;
  feature_health: {
    vol_regime: string | null;
    corr_regime: string | null;
    factor_model_active: boolean;
    factor_symbols_count: number;
    last_rebalance: string | null;
    next_rebalance_at: string | null;
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
  volume_24h_usd: number | null;
  volume_rank: number | null;
  open_interest_usd: number | null;
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
  gross_pct: number;
  net_pct: number;
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
  boost: number | null;
}

export interface RankingCandidate {
  symbol: string;
  score: number;
  corr: number;
  beta: number;
  beta_penalty: number;
  volume_24h: number;
  va_signals: {
    dilution: VaSignalDetail;
    supply_momentum: VaSignalDetail;
    buyback_intensity: VaSignalDetail;
    revenue_capture: VaSignalDetail;
    fee_momentum: VaSignalDetail;
    unlock_pressure: VaSignalDetail;
  };
  va_total_boost: number | null;
  fdv_mcap_ratio: number | null;
  dilution_boost: number | null;
  unlock_pressure: number | null;
  unlock_boost: number | null;
  ath_drawdown_pct: number | null;
  ath_date: string | null;
  momentum_signal: number | null;
  eligible: boolean;
  filter_reasons: string[];
  status: string[];
  quality_tags: string[];
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

// ── Execution Quality ──
export interface ExecutionReport {
  timestamp: string;
  symbol: string;
  side: string;
  action: string;
  arrival_price: number;
  fill_price: number;
  slippage_bps: number;
  execution_time_s: number;
}

export interface ExecutionQualityResponse {
  summary: {
    avg_slippage_bps: number;
    median_slippage_bps: number;
    total_cost_usd: number;
    worst_symbol: string;
    count: number;
  };
  recent_reports: ExecutionReport[];
}
