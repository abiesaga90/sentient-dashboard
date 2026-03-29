import { Tabs } from "../ui/Tabs";
import {
  LayoutDashboard,
  List,
  ArrowDownUp,
  BookOpen,
  TrendingUp,
  BarChart3,
  Target,
  Link2,
  ShieldAlert,
  Globe,
  Clock,
  Zap,
  Gauge,
  Layers,
  Crosshair,
  Scale,
} from "lucide-react";

export const DASHBOARD_TABS = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={14} /> },
  { id: "construction", label: "Construction", icon: <Layers size={14} /> },
  { id: "risk-stress", label: "Risk & Stress", icon: <ShieldAlert size={14} /> },
  { id: "positions", label: "Positions", icon: <List size={14} /> },
  { id: "long-signals", label: "Long Signals", icon: <Zap size={14} /> },
  { id: "short-selection", label: "Short Selection", icon: <ArrowDownUp size={14} /> },
  { id: "conviction-shorts", label: "Conviction Shorts", icon: <Crosshair size={14} /> },
  { id: "fundamentals", label: "Fundamentals", icon: <BookOpen size={14} /> },
  { id: "performance", label: "Performance", icon: <TrendingUp size={14} /> },
  { id: "attribution", label: "Attribution", icon: <BarChart3 size={14} /> },
  { id: "thesis", label: "Thesis", icon: <Target size={14} /> },
  { id: "pairs", label: "Pairs", icon: <Link2 size={14} /> },
  { id: "market-context", label: "Market Context", icon: <Globe size={14} /> },
  { id: "execution", label: "Execution", icon: <Gauge size={14} /> },
  { id: "scaling", label: "Scaling & Capacity", icon: <Scale size={14} /> },
  { id: "pump-exhaustion", label: "Pump Scanner", icon: <Zap size={14} /> },
  { id: "next-rebalance", label: "Next Rebalance", icon: <Clock size={14} /> },
] as const;

interface TabBarProps {
  activeTab: string;
  onChange: (id: string) => void;
  features?: Record<string, boolean>;
}

export function TabBar({ activeTab, onChange, features }: TabBarProps) {
  // Filter tabs by feature flags
  const lpTabs = ["performance", "attribution", "risk-stress"];
  const visibleTabs = DASHBOARD_TABS.filter((tab) => {
    if (lpTabs.includes(tab.id) && features && !features.lp_reporting) {
      return false;
    }
    return true;
  });

  return <Tabs tabs={visibleTabs} activeTab={activeTab} onChange={onChange} />;
}
