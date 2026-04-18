import { useSizingShadow } from "../../hooks/useDashboardQuery";

/**
 * Global kill-switch banner for Option 2 sizing shadow.
 *
 * Renders a persistent, high-visibility strip at the top of the dashboard
 * when the shadow run has breached its warn/crit thresholds. Does nothing
 * (returns null) when healthy or when the shadow is unavailable — pure
 * additive surface. Click routes users to the Sizing Shadow tab for detail.
 *
 * Phase D guardrail: a silent kill-switch is worse than none.
 */
export function SizingShadowAlert({
  onNavigate,
}: {
  onNavigate?: (tabId: string) => void;
}) {
  const { data } = useSizingShadow();

  if (!data?.available || !data.thresholds || !data.totals) return null;

  const maxDelta = data.totals.max_abs_delta_share_pct;
  const betaErr = data.beta_neutrality_err_pct?.shadow ?? 0;
  const warn = data.thresholds.delta_share_warn_pct;
  const crit = data.thresholds.delta_share_crit_pct;
  const betaCrit = data.thresholds.beta_neutrality_crit_pct;

  const tripped = maxDelta >= crit || betaErr >= betaCrit;
  const warning =
    !tripped && (maxDelta >= warn || betaErr >= betaCrit * 0.6);

  if (!tripped && !warning) return null;

  const bg = tripped
    ? "bg-red-500/15 border-red-500/60"
    : "bg-orange-500/15 border-orange-500/40";
  const color = tripped ? "text-red-300" : "text-orange-300";
  const label = tripped ? "SIZING KILL-SWITCH" : "SIZING DIVERGENCE";

  return (
    <button
      type="button"
      onClick={() => onNavigate?.("sizing-shadow")}
      className={`w-full border-b ${bg} px-4 py-2 text-left text-xs transition-opacity hover:opacity-90`}
    >
      <span className={`font-semibold ${color}`}>{label}</span>
      <span className="text-gray-400 ml-2">
        max |Δshare|={maxDelta.toFixed(2)}% (warn≥{warn}% crit≥{crit}%) · β-err shadow=
        {betaErr.toFixed(2)}% (crit≥{betaCrit}%) · live={data.live_mode} shadow=
        {data.shadow_mode}
      </span>
      <span className="text-gray-500 ml-2">→ Sizing Shadow tab</span>
    </button>
  );
}
