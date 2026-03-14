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
export interface RankingCandidate {
  rank: number;
  symbol: string;
  score: number;
  correlation: number;
  beta: number;
  daily_vol: number;
  tags: string[];
  in_basket: boolean;
  excluded: boolean;
  exclusion_reason: string | null;
  va_signals?: Record<string, number>;
  [key: string]: unknown;
}

export interface RankingsResponse {
  rankings: RankingCandidate[];
  count: number;
  n_shorts: number;
  correlation_method: string;
  signal_weights: Record<string, number>;
  signal_thresholds: Record<string, number>;
  timestamp: string;
}
