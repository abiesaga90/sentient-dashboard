import { useQuery } from "@tanstack/react-query";
import { useEngine } from "./useEngine";

/** One paper carry position valued against its inception snapshot. */
export interface CarryShadowPair {
  short: string;
  long: string;
  label: string;
  opened_at_ms: number;
  days_held: number;
  beta: number;
  short_notional: number;
  long_notional: number;
  modeled_spread_ann_pct: number | null;
  realized_short_ann_pct: number | null;
  realized_long_ann_pct: number | null;
  realized_spread_ann_pct: number | null;
  carry_usd: number;
  drift_usd: number;
  total_usd: number;
  carry_ann_pct: number | null;
  drift_ann_pct: number | null;
  total_ann_pct: number | null;
  n_funding_settles_short: number;
  n_funding_settles_long: number;
}

export interface CarryShadowPayload {
  available?: boolean;
  pairs: CarryShadowPair[];
  notional_per_short?: number;
  computed_at?: string;
  weekly_alert_sent?: boolean;
}

export function useFundingCarryShadow() {
  const { client, engine } = useEngine();
  return useQuery<CarryShadowPayload>({
    queryKey: ["funding-carry-shadow", engine.id],
    queryFn: () => client.get("/api/funding-carry-shadow"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
