import { useState } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { usePmRisk } from "../../hooks/useDashboardQuery";
import { cn, formatUSD } from "../../lib/utils";

/**
 * uniMMR = Uniform Maintenance Margin Ratio.
 * Governs liquidation on a Binance Portfolio Margin account:
 *   uniMMR = Account Equity / Maintenance Margin Requirement
 *
 * Thresholds (Binance defaults):
 *   > 2.0   healthy
 *   1.3-2.0 warning (margin-call zone)
 *   1.1-1.3 reduction (auto-reduce may trigger)
 *   < 1.0   liquidation
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

  // Variant + text color
  let badgeVariant: "success" | "warning" | "danger" | "default" = "default";
  let valueColor = "text-gray-400";
  let label = "—";
  if (status === "HEALTHY") {
    badgeVariant = "success";
    valueColor = "text-green-400";
    label = "Healthy";
  } else if (status === "WARNING") {
    badgeVariant = "warning";
    valueColor = "text-yellow-400";
    label = "Warning";
  } else if (status === "REDUCTION") {
    badgeVariant = "warning";
    valueColor = "text-orange-400";
    label = "Reduction";
  } else if (status === "LIQUIDATION") {
    badgeVariant = "danger";
    valueColor = "text-red-400";
    label = "Liquidation";
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

      {/* Always-visible one-line explainer */}
      <div className="text-[11px] text-gray-500 -mt-1 mb-2">
        Uniform Maintenance Margin Ratio — the single number that governs
        Portfolio Margin liquidation on Binance. Higher = safer.
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
            The single number that governs liquidation on a Binance Portfolio
            Margin account. Formula: <span className="font-mono">Account Equity / Maintenance Margin Requirement</span>.
          </div>
          <div>
            <span className="text-gray-100 font-semibold">Why it matters more than per-symbol leverage:</span>{" "}
            on PM the whole book is one risk pool. A beta-neutral L/S basket
            needs far less margin than the sum of legs because the PM engine
            nets stress across positions. Only uniMMR can liquidate you —
            individual "5x / 75x" leverage labels on the symbol UI are purely
            cosmetic on PM.
          </div>
          <div>
            <div className="text-gray-100 font-semibold">Thresholds:</div>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><span className="text-green-400">&gt; 2.0</span> — Healthy</li>
              <li><span className="text-yellow-400">1.3 – 2.0</span> — Warning (margin-call zone)</li>
              <li><span className="text-orange-400">1.1 – 1.3</span> — Reduction (auto-reduce may trigger)</li>
              <li><span className="text-red-400">&lt; 1.0</span> — Liquidation</li>
            </ul>
          </div>
          <div className="text-gray-400">
            Watch it trend — uniMMR falling from 4 → 2 signals the L/S hedge
            is degrading before our 9.5% DD stop trips. Click the card for
            the full sparkline and breakdown.
          </div>
        </div>
      )}
    </Card>
  );
}
