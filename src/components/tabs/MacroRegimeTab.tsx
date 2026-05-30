import { useState } from "react";
import { OverviewSubTab } from "./macro-regime/OverviewSubTab";
import { HorizonCompositesSubTab } from "./macro-regime/HorizonCompositesSubTab";
import { ICHeatmapSubTab } from "./macro-regime/ICHeatmapSubTab";
import { CycleSubTab } from "./macro-regime/CycleSubTab";
import { BasketDrilldownSubTab } from "./macro-regime/BasketDrilldownSubTab";
import { WeightAuditSubTab } from "./macro-regime/WeightAuditSubTab";

/**
 * Macro Regime — six-pane router (Phase 3, 2026-05-30).
 *
 *   Overview          single-horizon composite + 28-indicator table + Axis B
 *                     + quadrant + per-indicator confidence badge.
 *   Horizons          7d / 30d / 90d composites + combined shadow tilt
 *                     (Phase 1).
 *   IC Heatmap        indicator × dependent × horizon Spearman IC, color-coded.
 *   Cycle             BTC cycle KPIs (MVRV / 200 WMA / Mayer / drawdown) +
 *                     PM Market Notes + cycle zone thresholds. Absorbed from
 *                     the retired Market Context tab.
 *   Baskets           Polymarket + Kalshi per-basket drill-down with per-leg
 *                     IC vs nav_sortino_30d + the Polymarket-Macro
 *                     crypto-specific panel (Phase 4).
 *   Weights           IC-calibrated weight history + recent sign-flip / pause /
 *                     shift events (Phase 2).
 */

const SUB_TABS = [
  { id: "overview", label: "Overview" },
  { id: "horizons", label: "Horizons" },
  { id: "ic", label: "IC Heatmap" },
  { id: "cycle", label: "Cycle" },
  { id: "baskets", label: "Baskets" },
  { id: "weights", label: "Weights" },
] as const;
type SubTabId = typeof SUB_TABS[number]["id"];

export function MacroRegimeTab() {
  const [active, setActive] = useState<SubTabId>("overview");

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
      {active === "ic" && <ICHeatmapSubTab />}
      {active === "cycle" && <CycleSubTab />}
      {active === "baskets" && <BasketDrilldownSubTab />}
      {active === "weights" && <WeightAuditSubTab />}
    </div>
  );
}
