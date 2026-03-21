import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatUSD, formatPct } from "../../lib/utils";
import type { ExecutionQualityResponse } from "../../types/api";

interface RiskExitMethodology {
  tp_pct: number;
  sl_pct: number;
  fee_bps: number;
  spread_bps: number;
  round_trip_bps: number;
  min_drift_threshold: number;
  min_alpha_hurdle_bps: number;
}

interface RiskCostModel {
  exit_methodology?: RiskExitMethodology;
}

interface TpCycle {
  symbol: string;
  side: string;
  exit_price: number;
  reentry_price: number;
  spread_pct: number;
  exit_ts: string;
  reentry_ts: string;
  hours_to_reentry: number;
  volume_tier: string;
}

interface TpCyclesResponse {
  cycles: TpCycle[];
  by_symbol: Record<string, { count: number; avg_spread_pct: number; spreads: number[] }>;
  by_tier: Record<string, { count: number; avg_spread_pct: number }>;
  summary: {
    total_cycles: number;
    avg_spread_pct: number;
    avg_hours_to_reentry: number;
    profitable_reentries: number;
    costly_reentries: number;
  };
}

export function ExecutionTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery({
    queryKey: ["execution-quality", engine.id],
    queryFn: () =>
      client.get<ExecutionQualityResponse>("/api/execution_quality"),
    refetchInterval: 60_000,
  });

  const { data: riskData } = useQuery<RiskCostModel>({
    queryKey: ["risk-cost-model", engine.id],
    queryFn: () => client.get("/api/risk"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: tpCycles } = useQuery<TpCyclesResponse>({
    queryKey: ["tp-cycles", engine.id],
    queryFn: () => client.get("/api/tp_cycles?days=30"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading execution data...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Avg Slippage" value={`${data.summary.avg_slippage_bps.toFixed(1)} bps`} />
        <MetricCard label="Median Slippage" value={`${data.summary.median_slippage_bps.toFixed(1)} bps`} />
        <MetricCard label="Total Cost" value={formatUSD(data.summary.total_cost_usd)} />
        <MetricCard label="Worst Symbol" value={data.summary.worst_slippage_symbol?.replace("USDT", "") || "—"} />
        <MetricCard label="Trades" value={String(data.summary.n_trades)} />
      </div>

      {/* Recent Execution Reports */}
      {data.recent_reports.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Executions ({data.recent_reports.length})</CardTitle>
              <span className="text-xs text-gray-500">Last 30 days</span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
                <tr>
                  <th className="px-2 py-1.5 text-left text-gray-500">Time</th>
                  <th className="px-2 py-1.5 text-left text-gray-500">Symbol</th>
                  <th className="px-2 py-1.5 text-left text-gray-500">Side</th>
                  <th className="px-2 py-1.5 text-left text-gray-500">Action</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Arrival</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Fill</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Slip (bps)</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">Time (s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.recent_reports.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--bg-card-hover)]">
                    <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-2 py-1.5 text-gray-200 font-medium">
                      {r.symbol.replace("USDT", "")}
                    </td>
                    <td className="px-2 py-1.5">
                      <Badge
                        variant={r.side === "LONG" ? "success" : "danger"}
                        className="text-[10px]"
                      >
                        {r.side}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={r.action === "OPEN" ? "text-blue-400" : "text-gray-400"}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-300 font-mono">
                      {formatPrice(r.arrival_price)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-300 font-mono">
                      {formatPrice(r.fill_price)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-mono ${
                        r.slippage_bps > 50
                          ? "text-red-400"
                          : r.slippage_bps < -50
                            ? "text-green-400"
                            : "text-gray-300"
                      }`}
                    >
                      {r.slippage_bps.toFixed(1)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-400">
                      {r.execution_time_secs.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TP Cycle Analysis */}
      {tpCycles && tpCycles.summary.total_cycles > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="TP Cycles" value={String(tpCycles.summary.total_cycles)} />
            <MetricCard
              label="Avg Spread"
              value={`${tpCycles.summary.avg_spread_pct > 0 ? "+" : ""}${tpCycles.summary.avg_spread_pct.toFixed(2)}%`}
            />
            <MetricCard label="Avg Re-entry" value={`${tpCycles.summary.avg_hours_to_reentry.toFixed(0)}h`} />
            <MetricCard label="Profitable" value={String(tpCycles.summary.profitable_reentries)} />
            <MetricCard label="Costly" value={String(tpCycles.summary.costly_reentries)} />
          </div>

          {/* By Volume Tier */}
          <Card>
            <CardHeader>
              <CardTitle>TP Cycle Cost by Volume Tier</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-3 gap-4 p-3 text-xs">
              {(["HIGH", "MED", "LOW"] as const).map((tier) => {
                const d = tpCycles.by_tier[tier];
                if (!d) return (
                  <div key={tier} className="text-center text-gray-600">
                    <div className="text-gray-500 font-medium">{tier}</div>
                    <div>No data</div>
                  </div>
                );
                const color = d.avg_spread_pct >= 0 ? "text-green-400" : "text-red-400";
                return (
                  <div key={tier} className="text-center">
                    <div className="text-gray-500 font-medium">{tier}</div>
                    <div className={`text-lg font-semibold ${color}`}>
                      {d.avg_spread_pct > 0 ? "+" : ""}{d.avg_spread_pct.toFixed(2)}%
                    </div>
                    <div className="text-gray-500">{d.count} cycles</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* By Symbol */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>TP Cycle Cost by Symbol</CardTitle>
                <span className="text-xs text-gray-500">Last 30 days</span>
              </div>
            </CardHeader>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-gray-500">Symbol</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Cycles</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Avg Spread</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Min</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {Object.entries(tpCycles.by_symbol)
                    .sort(([, a], [, b]) => a.avg_spread_pct - b.avg_spread_pct)
                    .map(([sym, d]) => (
                      <tr key={sym} className="hover:bg-[var(--bg-card-hover)]">
                        <td className="px-2 py-1.5 text-gray-200 font-medium">
                          {sym.replace("USDT", "")}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-400">{d.count}</td>
                        <td className={`px-2 py-1.5 text-right font-mono ${
                          d.avg_spread_pct >= 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {d.avg_spread_pct > 0 ? "+" : ""}{d.avg_spread_pct.toFixed(2)}%
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-400">
                          {d.spreads.length > 0 ? `${Math.min(...d.spreads).toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-400">
                          {d.spreads.length > 0 ? `${Math.max(...d.spreads).toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent Cycles */}
          <Card>
            <CardHeader>
              <CardTitle>Recent TP Cycles</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-gray-500">Symbol</th>
                    <th className="px-2 py-1.5 text-left text-gray-500">Side</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Exit</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Re-entry</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Spread</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Gap</th>
                    <th className="px-2 py-1.5 text-left text-gray-500">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {tpCycles.cycles.slice().reverse().map((c, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)]">
                      <td className="px-2 py-1.5 text-gray-200 font-medium">
                        {c.symbol.replace("USDT", "")}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={c.side === "LONG" ? "success" : "danger"} className="text-[10px]">
                          {c.side}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-gray-300">
                        {formatPrice(c.exit_price)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-gray-300">
                        {formatPrice(c.reentry_price)}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono ${
                        c.spread_pct >= 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {c.spread_pct > 0 ? "+" : ""}{c.spread_pct.toFixed(2)}%
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-400">
                        {c.hours_to_reentry.toFixed(0)}h
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={c.volume_tier === "HIGH" ? "success" : c.volume_tier === "LOW" ? "danger" : "default"} className="text-[10px]">
                          {c.volume_tier}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tpCycles && tpCycles.summary.total_cycles === 0 && (
        <Card>
          <div className="p-6 text-center text-gray-500 text-sm">
            No TP cycles recorded yet. Data will appear after positions hit take-profit and re-enter.
          </div>
        </Card>
      )}

      {/* Cost Model */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Model Insights</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <div className="text-gray-500">Fee</div>
            <div className="text-gray-200 font-medium">
              {riskData?.exit_methodology?.fee_bps != null
                ? `${riskData.exit_methodology.fee_bps.toFixed(1)} bps`
                : "2.0 bps"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Spread</div>
            <div className="text-gray-200 font-medium">
              {riskData?.exit_methodology?.spread_bps != null
                ? `${riskData.exit_methodology.spread_bps.toFixed(1)} bps`
                : "2.0 bps"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Round-trip Cost</div>
            <div className="text-gray-200 font-medium">
              {riskData?.exit_methodology?.round_trip_bps != null
                ? `${riskData.exit_methodology.round_trip_bps.toFixed(1)} bps`
                : "4.0 bps"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Min Drift Threshold</div>
            <div className="text-gray-200 font-medium">
              {riskData?.exit_methodology?.min_drift_threshold != null
                ? formatPct(riskData.exit_methodology.min_drift_threshold * 100)
                : "0.05%"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Min Alpha Hurdle</div>
            <div className="text-gray-200 font-medium">
              {riskData?.exit_methodology?.min_alpha_hurdle_bps != null
                ? `${riskData.exit_methodology.min_alpha_hurdle_bps.toFixed(1)} bps`
                : "5.0 bps"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-100 mt-1">{value}</div>
    </Card>
  );
}

function formatPrice(price: number): string {
  if (price < 0.01) return price.toFixed(4);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toFixed(2);
}
