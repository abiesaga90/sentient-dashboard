import { useQuery } from "@tanstack/react-query";
import { useEngine } from "./useEngine";
import type {
  MacroHorizonsResponse,
  MacroWeightsResponse,
  MacroBasketsResponse,
  MacroICRollingResponse,
} from "../types/api";

/**
 * Three-horizon (7/30/90d) shadow composite + combined tilt.
 * Refetches every 120s (matches macro_regime tick cadence).
 */
export function useMacroHorizons(days: number = 30) {
  const { client, engine } = useEngine();
  return useQuery<MacroHorizonsResponse>({
    queryKey: ["macro-horizons", engine.id, days],
    queryFn: () => client.get("/api/macro_regime/horizons", { days }),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

/**
 * IC-calibrated weight history per (indicator, horizon, dependent).
 * Slow-moving (daily compute) — 5min refetch is plenty.
 */
export function useMacroWeightHistory(days: number = 30, indicator?: string) {
  const { client, engine } = useEngine();
  return useQuery<MacroWeightsResponse>({
    queryKey: ["macro-weights", engine.id, days, indicator],
    queryFn: () =>
      client.get("/api/macro_regime/weights", { days, ...(indicator ? { indicator } : {}) }),
    refetchInterval: 300_000,
    staleTime: 180_000,
  });
}

/**
 * Per-basket leg history + per-leg IC. Powers the BasketDrilldown sub-tab.
 */
export function useMacroBaskets(days: number = 30) {
  const { client, engine } = useEngine();
  return useQuery<MacroBasketsResponse>({
    queryKey: ["macro-baskets", engine.id, days],
    queryFn: () => client.get("/api/macro_regime/baskets", { days }),
    refetchInterval: 300_000,
    staleTime: 180_000,
  });
}

/**
 * Rolling IC for one (indicator, dependent, horizon). Heavy compute — only
 * fire when the IndicatorDrilldown sub-tab requests it (enabled gate).
 */
export function useMacroICRolling(
  key: string | undefined,
  dependent: string = "nav_sortino",
  horizon: number = 30,
  lookbackDays: number = 180,
  enabled: boolean = true,
) {
  const { client, engine } = useEngine();
  return useQuery<MacroICRollingResponse>({
    queryKey: ["macro-ic-rolling", engine.id, key, dependent, horizon, lookbackDays],
    queryFn: () =>
      client.get("/api/macro_regime/ic-rolling", {
        key: key!,
        dependent,
        horizon,
        lookback_days: lookbackDays,
      }),
    enabled: Boolean(key) && enabled,
    staleTime: 5 * 60_000,
  });
}
