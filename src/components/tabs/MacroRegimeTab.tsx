import { useEffect, useState } from "react";
import { OverviewSubTab } from "./macro-regime/OverviewSubTab";
import { HorizonCompositesSubTab } from "./macro-regime/HorizonCompositesSubTab";
import { ICHeatmapSubTab } from "./macro-regime/ICHeatmapSubTab";
import { IndicatorDrilldownSubTab } from "./macro-regime/IndicatorDrilldownSubTab";
import { CycleSubTab } from "./macro-regime/CycleSubTab";
import { BasketDrilldownSubTab } from "./macro-regime/BasketDrilldownSubTab";
import { WeightAuditSubTab } from "./macro-regime/WeightAuditSubTab";

/**
 * Macro Regime — seven-pane router.
 *
 *   Overview          single-horizon composite + 28-indicator table + Axis B
 *                     + quadrant + per-indicator confidence badge.
 *   Horizons          7d / 30d / 90d composites + combined shadow tilt.
 *   IC Heatmap        indicator × dependent × horizon Spearman IC, click any
 *                     cell to drill into its rolling history.
 *   Drilldown         per-indicator rolling IC + score history + sign-stability
 *                     + graduation checklist (added 2026-05-31).
 *   Cycle             BTC cycle KPIs + market notes (absorbed Market Context).
 *   Baskets           Polymarket + Kalshi per-basket drill-down + crypto-
 *                     specific Polymarket panel.
 *   Weights           IC-calibrated weight history + sign-flip review banner.
 */

const SUB_TABS = [
  { id: "overview", label: "Overview" },
  { id: "horizons", label: "Horizons" },
  { id: "ic", label: "IC Heatmap" },
  { id: "drilldown", label: "Drilldown" },
  { id: "cycle", label: "Cycle" },
  { id: "baskets", label: "Baskets" },
  { id: "weights", label: "Weights" },
] as const;
type SubTabId = typeof SUB_TABS[number]["id"];

export interface MacroRegimeTabProps {
  /** Pending Macro Regime → Drilldown payload from a cross-tab navigation
   *  (e.g. Risk & Stress → drift factor row click). Consumed once on mount
   *  via useEffect, then cleared. */
  pendingDrilldown?: { key: string; dependent: string; horizon: 7 | 30 | 90 } | null;
  clearPendingDrilldown?: () => void;
}

export function MacroRegimeTab(
  { pendingDrilldown, clearPendingDrilldown }: MacroRegimeTabProps = {},
) {
  const [active, setActive] = useState<SubTabId>("overview");
  // Click-through state from IC Heatmap → Drilldown OR cross-tab incoming.
  const [drilldown, setDrilldown] = useState<{
    key: string;
    dependent: string;
    horizon: 7 | 30 | 90;
  } | null>(null);

  const handleDrillDown = (
    key: string, dependent: string, horizon: 7 | 30 | 90,
  ) => {
    setDrilldown({ key, dependent, horizon });
    setActive("drilldown");
  };

  // Consume any pending cross-tab drilldown (set by LiveDashboard's
  // navigateToMacroDrilldown callback). Runs once when the payload changes
  // and then clears so a manual sub-tab switch isn't overridden.
  useEffect(() => {
    if (pendingDrilldown) {
      setDrilldown(pendingDrilldown);
      setActive("drilldown");
      clearPendingDrilldown?.();
    }
  }, [pendingDrilldown, clearPendingDrilldown]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-3 py-1.5 text-xs rounded-t border-b-2 transition-colors ${
              active === t.id
                ? "border-purple-500 text-purple-300 bg-purple-500/10"
                : "border-transparent text-gray-400 hover:text-purple-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === "overview" && <OverviewSubTab />}
      {active === "horizons" && <HorizonCompositesSubTab />}
      {active === "ic" && <ICHeatmapSubTab onDrillDown={handleDrillDown} />}
      {active === "drilldown" && (
        <IndicatorDrilldownSubTab
          initialKey={drilldown?.key}
          initialDependent={drilldown?.dependent}
          initialHorizon={drilldown?.horizon}
          onClear={() => setDrilldown(null)}
        />
      )}
      {active === "cycle" && <CycleSubTab />}
      {active === "baskets" && <BasketDrilldownSubTab />}
      {active === "weights" && <WeightAuditSubTab />}
    </div>
  );
}
