import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import {
  useSizingMode,
  useSizingShadow,
} from "../../hooks/useDashboardQuery";

/**
 * One-row sizing-status card for the Overview tab.
 *
 * Surfaces mode, max |Δshare|, β-neutrality err, and health pill in a single
 * line so the user can sanity-check sizing without opening a second tab.
 * Clicking elsewhere (dedicated tab) gives the full per-short breakdown.
 */
export function SizingStatusCard({
  onNavigate,
}: {
  onNavigate?: (tabId: string) => void;
}) {
  const { data: mode } = useSizingMode();
  const { data: shadow } = useSizingShadow();

  if (!mode) return null;

  const maxDelta = shadow?.totals?.max_abs_delta_share_pct ?? null;
  const betaErrShadow = shadow?.beta_neutrality_err_pct?.shadow ?? null;
  const warn = shadow?.thresholds?.delta_share_warn_pct ?? 10;
  const crit = shadow?.thresholds?.delta_share_crit_pct ?? 15;
  const betaCrit = shadow?.thresholds?.beta_neutrality_crit_pct ?? 5;

  const healthy =
    maxDelta !== null &&
    maxDelta < warn &&
    (betaErrShadow ?? 0) < betaCrit * 0.6;
  const warning =
    !healthy &&
    maxDelta !== null &&
    ((maxDelta >= warn && maxDelta < crit) ||
      ((betaErrShadow ?? 0) >= betaCrit * 0.6 &&
        (betaErrShadow ?? 0) < betaCrit));
  const tripped =
    maxDelta !== null &&
    (maxDelta >= crit || (betaErrShadow ?? 0) >= betaCrit);

  const status = tripped
    ? { label: "CRIT", variant: "danger" as const }
    : warning
    ? { label: "WARN", variant: "warning" as const }
    : healthy
    ? { label: "OK", variant: "success" as const }
    : { label: "—", variant: "default" as const };

  return (
    <Card
      className="cursor-pointer hover:border-blue-600/40"
      onClick={() => onNavigate?.("sizing-shadow")}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Sizing</CardTitle>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div>
          <div className="text-gray-500">Longs</div>
          <div className="text-gray-200 font-mono">{mode.longs.mode}</div>
        </div>
        <div>
          <div className="text-gray-500">Shorts</div>
          <div className="text-gray-200 font-mono">{mode.shorts.mode}</div>
        </div>
        <div>
          <div className="text-gray-500">Max |Δshare|</div>
          <div
            className={
              tripped
                ? "text-red-400 font-mono"
                : warning
                ? "text-orange-400 font-mono"
                : "text-gray-200 font-mono"
            }
          >
            {maxDelta !== null ? `${maxDelta.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div>
          <div className="text-gray-500">β-err (L / S)</div>
          <div className="text-gray-200 font-mono">
            {shadow?.beta_neutrality_err_pct?.live !== undefined &&
            shadow?.beta_neutrality_err_pct?.live !== null
              ? `${shadow.beta_neutrality_err_pct.live.toFixed(2)}%`
              : "—"}
            {" / "}
            {betaErrShadow !== null ? `${betaErrShadow.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Thresholds</div>
          <div className="text-gray-400 font-mono">
            Δ≥{warn}%/{crit}% · βe≥{betaCrit}%
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-gray-500">
        {mode.symmetric
          ? "symmetric residual-vol both sides"
          : `asymmetric: longs ${mode.longs.mode}, shorts ${mode.shorts.mode}`}
        {" · click for per-short breakdown"}
      </div>
    </Card>
  );
}
