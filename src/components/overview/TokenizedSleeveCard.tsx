import type { ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/utils";
import { useTokenizedPositions } from "../../hooks/useDashboardQuery";

/**
 * Compact tokenized-sleeve status for the Overview tab. Surfaces whether the
 * sleeve is live/shadow/off, the hedge basis, and — the key risk number — the
 * residual factor (SPY/sector) β after the overlay. Pair-β nets to ~0 by
 * construction, so the real tilt is the SPY/sector-β shown here. Full detail
 * lives on the Tokenized Positions tab (click through).
 */
export function TokenizedSleeveCard({ onNavigate }: { onNavigate?: (tabId: string) => void }) {
  const { data } = useTokenizedPositions();
  if (!data) return null;

  const enabled = data.enabled;
  const dryRun = !!data.dry_run;
  const fx = data.factor_exposure;
  const ov = fx?.overlay ?? null;

  const status = !enabled ? "off" : dryRun ? "shadow" : "live";
  const badgeVariant = status === "live" ? "success" : status === "shadow" ? "info" : "default";
  const badgeLabel = status === "live" ? "Live" : status === "shadow" ? "Shadow" : "Off";

  const flatAfter =
    !!ov?.residual_after &&
    Math.abs(ov.residual_after.market) < 1 &&
    Math.abs(ov.residual_after.semis) < 1;
  const spyPct = fx?.spy_beta_net_pct_of_nav ?? null;
  const gross = fx?.gross_actual_usd ?? 0;

  let headline: ReactNode = "—";
  let headlineColor = "text-gray-100";
  if (!enabled) {
    headline = "Off";
    headlineColor = "text-gray-500";
  } else if (gross > 0 && spyPct != null) {
    // Sleeve actually held → show the real SPY-β tilt vs NAV.
    const a = Math.abs(spyPct);
    headlineColor = a > 20 ? "text-rose-400" : a > 10 ? "text-amber-400" : "text-emerald-400";
    headline = `SPY-β ${spyPct >= 0 ? "+" : ""}${spyPct.toFixed(1)}% NAV`;
  } else if (ov && flatAfter) {
    headline = "Factor-neutral ✓";
    headlineColor = "text-emerald-400";
  } else if (ov) {
    headlineColor = "text-amber-400";
    headline = `Residual mkt ${fmtUsd0(ov.residual_before.market)} / semis ${fmtUsd0(ov.residual_before.semis)}`;
  }

  return (
    <Card
      className={cn("flex flex-col gap-1", onNavigate && "cursor-pointer")}
      onClick={onNavigate ? () => onNavigate("tokenized-positions") : undefined}
    >
      <CardHeader className="mb-1">
        <div className="flex items-center justify-between">
          <CardTitle>Tokenized Sleeve</CardTitle>
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
        </div>
      </CardHeader>

      <div className={cn("text-lg font-semibold", headlineColor)}>{headline}</div>

      <div className="text-xs text-gray-500">
        {enabled ? (
          <>
            Hedge: {fx?.hedge_mode_active ?? "—"}
            {ov ? ` · overlay ${ov.enabled ? "live" : "shadow"}` : ""}
            {data.health?.n_active != null
              ? ` · ${data.health.n_active}/${data.health.n_configured} pairs`
              : ""}
          </>
        ) : (
          "Sleeve disabled"
        )}
      </div>

      <div className="text-[11px] text-gray-600">
        {dryRun && enabled ? "Shadow — not on the book. " : ""}
        Pair-β hides the real tilt; this is SPY/sector-β.
      </div>
    </Card>
  );
}

function fmtUsd0(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString()}`;
}
