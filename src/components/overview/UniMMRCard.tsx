import { useState } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { usePmRisk } from "../../hooks/useDashboardQuery";
import { cn, formatUSD } from "../../lib/utils";

/**
 * uniMMR = Uniform Maintenance Margin Ratio (Binance Portfolio Margin).
 *   uniMMR = Account Equity / Maintenance Margin Requirement
 *
 * Technically the ratio that triggers PM liquidation at < 1.0, but on our
 * beta-neutral L/S book it sits at 50+ because the PM engine nets longs
 * and shorts in its stress scenarios. Liquidation is not a realistic
 * concern — the 10% PTT-DD stop trips ~15x before uniMMR could approach
 * 1.0. We use uniMMR as a HEDGE QUALITY gauge instead.
 *
 * Thresholds (strategy-calibrated, NOT Binance's liquidation bands):
 *   >= 50  healthy — hedge working normally
 *   20-50  degraded — watch
 *    5-20  poor — hedge materially broken
 *    < 5   critical — DD stop should have fired long before this
 */
export function UniMMRCard({
  onNavigate,
}: {
  onNavigate?: (tabId: string) => void;
}) {
  const { data } = usePmRisk();
  const [showInfo, setShowInfo] = useState(false);

  // Handle loading / error / missing state
  const error = data && "error" in data ? (data as { error: string }).error : null;
  const snap = data && !error && "unimmr" in data ? data : null;
  const unimmr = snap?.unimmr ?? null;
  const status = snap?.status ?? null;

  // Variant + text color — hedge-quality framing (NOT liquidation).
  let badgeVariant: "success" | "warning" | "danger" | "default" = "default";
  let valueColor = "text-gray-400";
  let label = "—";
  if (status === "HEALTHY") {
    badgeVariant = "success";
    valueColor = "text-green-400";
    label = "Hedge Healthy";
  } else if (status === "DEGRADED") {
    badgeVariant = "warning";
    valueColor = "text-yellow-400";
    label = "Hedge Degraded";
  } else if (status === "POOR") {
    badgeVariant = "warning";
    valueColor = "text-orange-400";
    label = "Hedge Poor";
  } else if (status === "CRITICAL") {
    badgeVariant = "danger";
    valueColor = "text-red-400";
    label = "Hedge Critical";
  }

  const displayUnimmr =
    unimmr === null
      ? "—"
      : unimmr >= 100
      ? `${unimmr.toFixed(0)}`
      : unimmr >= 10
      ? `${unimmr.toFixed(1)}`
      : `${unimmr.toFixed(2)}`;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:border-blue-600/40 relative",
        onNavigate && "cursor-pointer"
      )}
      onClick={() => onNavigate?.("risk-stress")}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>uniMMR (PM)</CardTitle>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo((v) => !v);
              }}
              className="text-gray-500 hover:text-gray-300 text-xs leading-none border border-gray-700 rounded-full w-4 h-4 flex items-center justify-center"
              title="What is uniMMR?"
              aria-label="What is uniMMR?"
            >
              i
            </button>
          </div>
          <Badge variant={badgeVariant}>{label}</Badge>
        </div>
      </CardHeader>

      {/* Always-visible one-line explainer — hedge-quality framing */}
      <div className="text-[11px] text-gray-500 -mt-1 mb-2">
        Hedge quality gauge — on a beta-neutral book uniMMR sits at 50+.
        Falling values flag the L/S correlation structure breaking down.
      </div>

      <div className={cn("text-2xl font-bold font-mono", valueColor)}>
        {displayUnimmr}
        <span className="text-xs font-normal text-gray-500 ml-2">
          equity / MM
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
        <div>
          <div className="text-gray-500">Equity</div>
          <div className="text-gray-300 font-mono">
            {snap?.account_equity != null
              ? formatUSD(snap.account_equity, 0)
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Maint. Margin</div>
          <div className="text-gray-300 font-mono">
            {snap?.account_maint_margin != null
              ? formatUSD(snap.account_maint_margin, 0)
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-gray-500">MM %</div>
          <div className="text-gray-300 font-mono">
            {snap?.mm_pct != null ? `${snap.mm_pct.toFixed(2)}%` : "—"}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-[11px] text-gray-500 italic">
          No PM data yet — balance proxy needs ~1 min after deploy to warm up.
        </div>
      )}

      {showInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 p-3 bg-gray-900/60 border border-gray-800 rounded text-[11px] text-gray-300 space-y-2"
        >
          <div>
            <span className="text-gray-100 font-semibold">
              uniMMR = Uniform Maintenance Margin Ratio.
            </span>{" "}
            <span className="font-mono">Account Equity / Maintenance Margin Requirement</span>.
            Technically the ratio that triggers PM liquidation at &lt; 1.0,
            but on our beta-neutral L/S book it sits at 50+ because the PM
            engine nets longs and shorts in its stress scenarios.
          </div>
          <div>
            <span className="text-gray-100 font-semibold">Why we watch it (not for liquidation):</span>{" "}
            the 10% PTT-DD stop would trip ~15× before uniMMR could approach
            1.0 — liquidation is not a realistic concern. Instead, uniMMR is a
            leading indicator of <em>hedge quality</em>. A trend from 150 →
            50 → 20 over a week means longs and shorts are no longer offsetting
            in stress, often <em>before</em> spread PnL shows the damage.
          </div>
          <div>
            <div className="text-gray-100 font-semibold">Thresholds (strategy-calibrated):</div>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><span className="text-green-400">&ge; 50</span> — Healthy (hedge working normally)</li>
              <li><span className="text-yellow-400">20 – 50</span> — Degraded (watch)</li>
              <li><span className="text-orange-400">5 – 20</span> — Poor (hedge materially broken)</li>
              <li><span className="text-red-400">&lt; 5</span> — Critical (DD stop should have fired)</li>
            </ul>
            <div className="text-gray-500 mt-1">
              Binance's own liquidation bands are 2.0 / 1.3 / 1.1 / 1.0 — we
              sit ~70× above the first band, so those are not actionable here.
            </div>
          </div>
          <div className="text-gray-400">
            Click the card for the 7-day sparkline and full breakdown.
          </div>
        </div>
      )}
    </Card>
  );
}
