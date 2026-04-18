import { Tabs } from "../ui/Tabs";
import {
  LayoutDashboard,
  List,
  ArrowDownUp,
  BookOpen,
  TrendingUp,
  BarChart3,
  Link2,
  ShieldAlert,
  Globe,
  Clock,
  Zap,
  Gauge,
  Layers,
  Scale,
  Target,
  Activity,
  Brain,
  GitBranch,
  SlidersHorizontal,
} from "lucide-react";

export const DASHBOARD_TABS = [
  { id: "thesis", label: "Thesis", icon: <Target size={14} /> },
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={14} /> },
  { id: "alpha-model", label: "Alpha Model", icon: <Brain size={14} /> },
  { id: "risk-model", label: "Risk Model", icon: <BarChart3 size={14} /> },
  { id: "optimizer", label: "Optimizer", icon: <GitBranch size={14} /> },
  { id: "sizing-shadow", label: "Sizing Shadow", icon: <SlidersHorizontal size={14} /> },
  { id: "construction", label: "Construction", icon: <Layers size={14} /> },
  { id: "risk-stress", label: "Risk & Stress", icon: <ShieldAlert size={14} /> },
  { id: "positions", label: "Positions", icon: <List size={14} /> },
  { id: "long-signals", label: "Long Signals", icon: <Activity size={14} /> },
  { id: "long-selection", label: "Long Selection", icon: <Zap size={14} /> },
  { id: "short-selection", label: "Short Selection", icon: <ArrowDownUp size={14} /> },
  { id: "fundamentals", label: "Fundamentals", icon: <BookOpen size={14} /> },
  { id: "performance", label: "Performance", icon: <TrendingUp size={14} /> },
  { id: "attribution", label: "Attribution", icon: <BarChart3 size={14} /> },
  { id: "pairs", label: "Hedging", icon: <Link2 size={14} /> },
  { id: "market-context", label: "Market Context", icon: <Globe size={14} /> },
  { id: "execution", label: "Execution", icon: <Gauge size={14} /> },
  { id: "scaling", label: "Scaling & Capacity", icon: <Scale size={14} /> },
  { id: "pump-exhaustion", label: "Pump Scanner", icon: <Zap size={14} /> },
  { id: "next-rebalance", label: "Rotation", icon: <Clock size={14} /> },
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
