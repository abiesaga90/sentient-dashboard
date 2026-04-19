import { useState } from "react";
import { Header } from "../components/layout/Header";
import { StatusBar } from "../components/layout/StatusBar";
import { TabBar } from "../components/layout/TabBar";
import { RiskPostureBanner } from "../components/layout/RiskPostureBanner";
import { SizingShadowAlert } from "../components/layout/SizingShadowAlert";
import { OverviewTab } from "../components/tabs/OverviewTab";
import { PositionsTab } from "../components/tabs/PositionsTab";
import { ShortSelectionTab } from "../components/tabs/ShortSelectionTab";
import { NextRebalanceTab } from "../components/tabs/NextRebalanceTab";
import { PumpExhaustionTab } from "../components/tabs/PumpExhaustionTab";
import { ExecutionTab } from "../components/tabs/ExecutionTab";
import { LongSignalsTab } from "../components/tabs/LongSignalsTab";
import { LongSelectionTab } from "../components/tabs/LongSelectionTab";
import { FundamentalsTab } from "../components/tabs/FundamentalsTab";
import { PerformanceTab } from "../components/tabs/PerformanceTab";
import { AttributionTab } from "../components/tabs/AttributionTab";
import { ThesisTab } from "../components/tabs/ThesisTab";
import { PairsTab } from "../components/tabs/PairsTab";
import { RiskStressTab } from "../components/tabs/RiskStressTab";
import { MarketContextTab } from "../components/tabs/MarketContextTab";
import { PortfolioConstructionTab } from "../components/tabs/PortfolioConstructionTab";
import { ScalingCapacityTab } from "../components/tabs/ScalingCapacityTab";
import { RiskModelTab } from "../components/tabs/RiskModelTab";
import { AlphaModelTab } from "../components/tabs/AlphaModelTab";
import { OptimizerTab } from "../components/tabs/OptimizerTab";
import { SizingShadowTab } from "../components/tabs/SizingShadowTab";
import { LeverageCalibrationTab } from "../components/tabs/LeverageCalibrationTab";
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
      <RiskPostureBanner />
      <SizingShadowAlert onNavigate={setActiveTab} />
      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        features={status?.features}
      />

      <main className="flex-1">
        {isLoading && !dashboard ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-gray-700" />
              <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
            </div>
            <div className="text-gray-400 text-sm">Connecting to engine...</div>
          </div>
        ) : dashboard ? (
          <TabContent
            activeTab={activeTab}
            dashboard={dashboard}
            onNavigate={setActiveTab}
          />
        ) : null}
      </main>
    </div>
  );
}

function TabContent({
  activeTab,
  dashboard,
  onNavigate,
}: {
  activeTab: string;
  dashboard: NonNullable<ReturnType<typeof useDashboard>["data"]>;
  onNavigate: (tabId: string) => void;
}) {
  switch (activeTab) {
    case "overview":
      return <OverviewTab data={dashboard} onNavigate={onNavigate} />;
    case "construction":
      return <PortfolioConstructionTab />;
    case "alpha-model":
      return <AlphaModelTab />;
    case "risk-model":
      return <RiskModelTab />;
    case "optimizer":
      return <OptimizerTab />;
    case "sizing-shadow":
      return <SizingShadowTab />;
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
    case "long-selection":
      return <LongSelectionTab />;
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
    case "leverage-calibration":
      return <LeverageCalibrationTab />;
    case "market-context":
      return <MarketContextTab />;
    case "execution":
      return <ExecutionTab />;
    case "scaling":
      return <ScalingCapacityTab />;
    case "pump-exhaustion":
      return <PumpExhaustionTab />;
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
