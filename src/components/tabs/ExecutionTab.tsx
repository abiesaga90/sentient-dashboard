import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatUSD } from "../../lib/utils";
import type { ExecutionQualityResponse } from "../../types/api";

export function ExecutionTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery({
    queryKey: ["execution-quality", engine.id],
    queryFn: () =>
      client.get<ExecutionQualityResponse>("/api/execution_quality"),
    refetchInterval: 60_000,
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

      {/* Cost Model */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Model Insights</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <div className="text-gray-500">Fee</div>
            <div className="text-gray-200 font-medium">2.0 bps</div>
          </div>
          <div>
            <div className="text-gray-500">Spread</div>
            <div className="text-gray-200 font-medium">2.0 bps</div>
          </div>
          <div>
            <div className="text-gray-500">Round-trip Cost</div>
            <div className="text-gray-200 font-medium">4.0 bps</div>
          </div>
          <div>
            <div className="text-gray-500">Min Drift Threshold</div>
            <div className="text-gray-200 font-medium">0.05%</div>
          </div>
          <div>
            <div className="text-gray-500">Min Alpha Hurdle</div>
            <div className="text-gray-200 font-medium">5.0 bps</div>
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
