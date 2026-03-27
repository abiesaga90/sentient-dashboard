import { useState } from "react";
import { Header } from "../components/layout/Header";
import { StatusBar } from "../components/layout/StatusBar";
import { TabBar } from "../components/layout/TabBar";
import { OverviewTab } from "../components/tabs/OverviewTab";
import { PositionsTab } from "../components/tabs/PositionsTab";
import { ShortSelectionTab } from "../components/tabs/ShortSelectionTab";
import { NextRebalanceTab } from "../components/tabs/NextRebalanceTab";
import { PumpExhaustionTab } from "../components/tabs/PumpExhaustionTab";
import { ExecutionTab } from "../components/tabs/ExecutionTab";
import { LongSignalsTab } from "../components/tabs/LongSignalsTab";
import { FundamentalsTab } from "../components/tabs/FundamentalsTab";
import { PerformanceTab } from "../components/tabs/PerformanceTab";
import { AttributionTab } from "../components/tabs/AttributionTab";
import { ThesisTab } from "../components/tabs/ThesisTab";
import { PairsTab } from "../components/tabs/PairsTab";
import { RiskStressTab } from "../components/tabs/RiskStressTab";
import { MarketContextTab } from "../components/tabs/MarketContextTab";
import { PortfolioConstructionTab } from "../components/tabs/PortfolioConstructionTab";
import { TokenDeepDiveTab } from "../components/tabs/TokenDeepDiveTab";
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
    case "construction":
      return <PortfolioConstructionTab />;
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
      return <ThesisTab />;
    case "pairs":
      return <PairsTab />;
    case "risk-stress":
      return <RiskStressTab />;
    case "market-context":
      return <MarketContextTab />;
    case "execution":
      return <ExecutionTab />;
    case "pump-exhaustion":
      return <PumpExhaustionTab />;
    case "aethir":
      return <TokenDeepDiveTab symbol="aethir" displayName="Aethir" />;
    case "peaq":
      return <TokenDeepDiveTab symbol="peaq" displayName="PEAQ" />;
    default:
      return (
        <div className="p-4">
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            Unknown tab
          </div>
        </div>
      );
  }
}
