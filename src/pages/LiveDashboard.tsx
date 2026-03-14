import { useState } from "react";
import { Header } from "../components/layout/Header";
import { StatusBar } from "../components/layout/StatusBar";
import { TabBar } from "../components/layout/TabBar";
import { OverviewTab } from "../components/tabs/OverviewTab";
import { PositionsTab } from "../components/tabs/PositionsTab";
import { ShortSelectionTab } from "../components/tabs/ShortSelectionTab";
import { NextRebalanceTab } from "../components/tabs/NextRebalanceTab";
import { PlaceholderTab } from "../components/tabs/PlaceholderTab";
import { PumpExhaustionTab } from "../components/tabs/PumpExhaustionTab";
import { ExecutionTab } from "../components/tabs/ExecutionTab";
import { LongSignalsTab } from "../components/tabs/LongSignalsTab";
import { FundamentalsTab } from "../components/tabs/FundamentalsTab";
import { PerformanceTab } from "../components/tabs/PerformanceTab";
import { AttributionTab } from "../components/tabs/AttributionTab";
import { useDashboard, useStatus } from "../hooks/useDashboardQuery";

export function LiveDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: dashboard, isLoading, error } = useDashboard();
  const { data: status } = useStatus();

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-red-400 text-sm text-center">
          <div className="text-lg mb-2">Connection Error</div>
          <div className="text-gray-500">
            Could not reach the engine. Check if the service is running.
          </div>
          <div className="text-gray-600 mt-2 text-xs font-mono">
            {String(error)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <Header status={status} />
      <StatusBar dashboard={dashboard} status={status} />
      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        features={status?.features}
      />

      <main className="flex-1">
        {isLoading && !dashboard ? (
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
            Connecting to engine...
          </div>
        ) : dashboard ? (
          <TabContent activeTab={activeTab} dashboard={dashboard} />
        ) : null}
      </main>
    </div>
  );
}

function TabContent({
  activeTab,
  dashboard,
}: {
  activeTab: string;
  dashboard: NonNullable<ReturnType<typeof useDashboard>["data"]>;
}) {
  switch (activeTab) {
    case "overview":
      return <OverviewTab data={dashboard} />;
    case "positions":
      return <PositionsTab />;
    case "short-selection":
      return <ShortSelectionTab />;
    case "next-rebalance":
      return <NextRebalanceTab />;
    case "fundamentals":
      return <FundamentalsTab />;
    case "long-signals":
      return <LongSignalsTab />;
    case "performance":
      return <PerformanceTab />;
    case "attribution":
      return <AttributionTab />;
    case "thesis":
      return <PlaceholderTab name="Thesis" description="Phase 3: Return comparison bars" />;
    case "pairs":
      return <PlaceholderTab name="Pairs" description="Phase 3: Pair mapping with correlation scores" />;
    case "risk-stress":
      return <PlaceholderTab name="Risk & Stress" description="Phase 4: DD gauge, stress scenarios, VaR" />;
    case "macro":
      return <PlaceholderTab name="Macro Regime" description="Phase 4: 14-indicator composite" />;
    case "cycle":
      return <PlaceholderTab name="Cycle Awareness" description="Phase 4: MVRV, 200 WMA, Mayer Multiple" />;
    case "execution":
      return <ExecutionTab />;
    case "pump-exhaustion":
      return <PumpExhaustionTab />;
    default:
      return <PlaceholderTab name="Unknown Tab" />;
  }
}
