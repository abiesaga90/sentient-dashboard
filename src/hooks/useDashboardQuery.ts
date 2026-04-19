import { useQuery } from "@tanstack/react-query";
import { useEngine } from "./useEngine";
import type { DashboardResponse, StatusResponse, PnlResponse, RiskHistoryPoint } from "../types/api";

export function useDashboard() {
  const { client, engine } = useEngine();
  return useQuery<DashboardResponse>({
    queryKey: ["dashboard", engine.id],
    queryFn: () => client.get("/api/dashboard"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useStatus() {
  const { client, engine } = useEngine();
  return useQuery<StatusResponse>({
    queryKey: ["status", engine.id],
    queryFn: () => client.get("/api/status"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function usePnl(period: string = "all") {
  const { client, engine } = useEngine();
  return useQuery<PnlResponse>({
    queryKey: ["pnl", engine.id, period],
    queryFn: () => client.get("/api/pnl", { period }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function usePortfolioConstruction() {
  const { client, engine } = useEngine();
  return useQuery({
    queryKey: ["portfolio-construction", engine.id],
    queryFn: () => client.get("/api/portfolio-construction"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

export function useRiskHistory(hours: number = 168) {
  const { client, engine } = useEngine();
  return useQuery<{ history: RiskHistoryPoint[] }>({
    queryKey: ["risk-history", engine.id, hours],
    queryFn: () => client.get("/api/risk/history", { hours }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// ── Phase 4: three-layer architecture tabs ──

export interface RiskModelTokenMetrics {
  beta: number;
  downside_beta: number;
  vol: number;
  correlation: number;
  /** Vol after hedging vs opposite basket — longs: vs shorts, shorts: vs longs. */
  residual_vol?: number;
  /** residual_vol / vol. 1.0 = un-hedged idio, 0.2 = hit floor (perfectly hedged). */
  residual_vol_ratio?: number;
}

export interface RiskModelResponse {
  available: boolean;
  reason?: string;
  token_metrics: Record<string, RiskModelTokenMetrics>;
  active_longs: string[];
  short_basket: string[];
  avg_long_beta: number;
  avg_short_beta: number;
  vol_lookback_hours: number;
  computed_at: string;
  n_symbols: number;
}

export function useRiskModel() {
  const { client, engine } = useEngine();
  return useQuery<RiskModelResponse>({
    queryKey: ["risk-model", engine.id],
    queryFn: () => client.get("/api/risk-model"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

export interface PerPillarConfidence {
  va: number;
  sm: number;
  p3: number;
  mm: number;
}

export interface AlphaModelToken {
  adjusted_score: number | null;
  raw_score: number | null;
  confidence: number | null;
  per_pillar_confidence: PerPillarConfidence;
  va_prior_applied: boolean;
  va_score: number | null;
  sm_score: number | null;
  p3_score: number | null;
  mm_score: number | null;
  n_va: number;
  n_sm: number;
  n_p3: number;
  n_mm: number;
  va_weight: number | null;
  sm_weight: number | null;
  p3_weight: number | null;
  mm_weight: number | null;
  va_profile: string | null;
  is_extractive: boolean;
}

export interface AlphaModelResponse {
  available: boolean;
  reason?: string;
  tokens: Record<string, AlphaModelToken>;
  universe_stats: {
    n_scored: number;
    va_coverage_pct: number;
    median_confidence: number;
    n_va_prior_applied: number;
  };
  feature_flags: {
    per_pillar_confidence: boolean;
    va_skeptical_prior_enabled: boolean;
  };
}

export function useAlphaModel() {
  const { client, engine } = useEngine();
  return useQuery<AlphaModelResponse>({
    queryKey: ["alpha-model", engine.id],
    queryFn: () => client.get("/api/alpha-model"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

export interface OptimizerConstraint {
  name: string;
  limit: number;
  actual: number;
  binding: boolean;
  slack_pct: number;
}

export interface OptimizerWeightCompare {
  symbol: string;
  side: "LONG" | "SHORT";
  target_notional: number;
  current_notional: number;
  target_pct: number;
  current_pct: number;
  drift_pct: number;
}

export interface OptimizerResponse {
  available: boolean;
  reason?: string;
  targets?: Record<string, { side: string; notional: number }>;
  active_longs?: string[];
  short_basket?: string[];
  gross_long?: number;
  gross_short?: number;
  gross_total?: number;
  net_exposure?: number;
  gross_pct?: number;
  net_exposure_pct?: number;
  avg_long_beta?: number;
  avg_short_beta?: number;
  beta_symmetry_delta?: number;
  constraints?: OptimizerConstraint[];
  binding_constraints?: string[];
  weight_comparison?: OptimizerWeightCompare[];
  sizing_base?: number;
  nav?: number;
  dd_scale?: number;
  effective_scale?: number;
  n_longs?: number;
  n_shorts?: number;
  computed_at?: string;
  notes?: string[];
}

export function useOptimizer() {
  const { client, engine } = useEngine();
  return useQuery<OptimizerResponse>({
    queryKey: ["optimizer", engine.id],
    queryFn: () => client.get("/api/optimizer"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// ── Option 2 sizing-mode + shadow run ──
// See nickel-ls-rv tasks/option2_symmetric_residual_vol.md for context.

export interface SizingModeSideConfig {
  mode: string;
  formula: string;
  vol_power: number;
  residual_vol_floor_ratio: number;
  blend_alpha?: number;
}

export interface SizingModeResponse {
  longs: SizingModeSideConfig;
  shorts: SizingModeSideConfig;
  symmetric: boolean;
  vol_lookback_hours: number;
  hedge_basket_for_longs: string;
  hedge_basket_for_shorts: string;
}

export function useSizingMode() {
  const { client, engine } = useEngine();
  return useQuery<SizingModeResponse>({
    queryKey: ["sizing-mode", engine.id],
    queryFn: () => client.get("/api/sizing/mode"),
    refetchInterval: 300_000,
    staleTime: 60_000,
  });
}

export interface SizingShadowPerShort {
  symbol: string;
  live_notional: number;
  shadow_notional: number;
  live_share_pct: number;
  shadow_share_pct: number;
  delta_share_pct: number;
  beta: number | null;
  correlation: number | null;
  vol: number | null;
  residual_vol: number | null;
  residual_vol_ratio: number | null;
}

export interface SizingShadowResponse {
  available: boolean;
  reason?: string;
  served_from?: string;
  computed_at?: string;
  live_mode?: string;
  shadow_mode?: string;
  nav?: number;
  sizing_base?: number;
  totals?: {
    live_short_gross: number;
    shadow_short_gross: number;
    live_long_gross: number;
    shadow_long_gross: number;
    max_abs_delta_share_pct: number;
    n_shorts_live: number;
    n_shorts_shadow: number;
  };
  beta_neutrality_err_pct?: {
    live: number | null;
    shadow: number | null;
  };
  per_short?: SizingShadowPerShort[];
  thresholds?: {
    delta_share_warn_pct: number;
    delta_share_crit_pct: number;
    beta_neutrality_crit_pct: number;
  };
}

export function useSizingShadow() {
  const { client, engine } = useEngine();
  return useQuery<SizingShadowResponse>({
    queryKey: ["sizing-shadow", engine.id],
    queryFn: () => client.get("/api/sizing/shadow/latest"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export interface SizingShadowHistoryPoint {
  ts: string;
  cum_pnl_live_usd: number;
  cum_pnl_shadow_usd: number;
  segment_pnl_live_usd: number;
  segment_pnl_shadow_usd: number;
  max_abs_delta_share_pct: number | null;
  beta_err_live_pct: number | null;
  beta_err_shadow_pct: number | null;
}

export interface SizingShadowHistoryResponse {
  available: boolean;
  reason?: string;
  n_points?: number;
  start_ts?: string;
  end_ts?: string;
  cumulative_live_usd?: number;
  cumulative_shadow_usd?: number;
  cumulative_delta_usd?: number;
  points: SizingShadowHistoryPoint[];
  note?: string;
}

// ── Unified Risk Posture (banner, single source of truth) ──

export interface RiskPostureResponse {
  timestamp: string;
  sigma_daily_pct: number | null;
  sigma_annual_pct: number | null;
  vol_regime: string | null;
  p_stop_7d_pct: number | null;
  p_stop_30d_pct: number | null;
  p_stop_365d_pct: number | null;
  dd_current_pct: number;
  dd_stop_pct: number;
  dd_budget_used_pct: number;
  dd_band: "green" | "amber" | "red";
  gross_current_pct: number;
  safe_gross_pct: number | null;
  safe_lev_actual: number | null;
  gross_budget_used_pct: number | null;
  gross_band: "green" | "amber" | "red";
  ls_correlation_30d: number | null;
  daily_drift_pct: number | null;
  dd_budget_sigma: number | null;
  dd_budget_dollars: number | null;
  nav: number;
  hwm: number;
}

export function useRiskPosture() {
  const { client, engine } = useEngine();
  return useQuery<RiskPostureResponse>({
    queryKey: ["risk-posture", engine.id],
    queryFn: () => client.get("/api/risk-posture"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useSizingShadowHistory(limit: number = 500) {
  const { client, engine } = useEngine();
  return useQuery<SizingShadowHistoryResponse>({
    queryKey: ["sizing-shadow-history", engine.id, limit],
    queryFn: () => client.get("/api/sizing/shadow/history", { limit }),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}
