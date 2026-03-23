import { useQuery } from "@tanstack/react-query";
import { useEngine } from "./useEngine";
import type { DashboardResponse, StatusResponse, PnlResponse, RiskHistoryPoint } from "../types/api";

export function useDashboard() {
  const { client, engine } = useEngine();
  return useQuery<DashboardResponse>({
    queryKey: ["dashboard", engine.id],
    queryFn: () => client.get("/api/dashboard"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useStatus() {
  const { client, engine } = useEngine();
  return useQuery<StatusResponse>({
    queryKey: ["status", engine.id],
    queryFn: () => client.get("/api/status"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function usePnl(period: string = "all") {
  const { client, engine } = useEngine();
  return useQuery<PnlResponse>({
    queryKey: ["pnl", engine.id, period],
    queryFn: () => client.get("/api/pnl", { period }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function usePortfolioConstruction() {
  const { client, engine } = useEngine();
  return useQuery({
    queryKey: ["portfolio-construction", engine.id],
    queryFn: () => client.get("/api/portfolio-construction"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

export function useRiskHistory(hours: number = 168) {
  const { client, engine } = useEngine();
  return useQuery<{ history: RiskHistoryPoint[] }>({
    queryKey: ["risk-history", engine.id, hours],
    queryFn: () => client.get("/api/risk/history", { hours }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
