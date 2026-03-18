import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { KpiCard } from "../shared/KpiCard";
import { PnlText } from "../shared/PnlText";
import { Badge } from "../ui/Badge";
import { useEngine } from "../../hooks/useEngine";
import { useStatus } from "../../hooks/useDashboardQuery";
import { formatPct, timeAgo } from "../../lib/utils";

interface CycleData {
  cycle_number: number;
  start_time: string;
  end_time: string | null;
  start_nav: number;
  end_nav: number | null;
  cycle_pnl: number | null;
  cycle_pnl_pct: number | null;
  realized_pnl: number | null;
  n_trades: number | null;
  n_longs: number | null;
  n_shorts: number | null;
  short_basket: string | null;
  status?: string;
}

interface CyclesResponse {
  current_cycle: CycleData | null;
  completed_cycles: CycleData[];
  summary: {
    total_cycles: number;
    winning_cycles: number;
    losing_cycles: number;
    win_rate_pct: number;
    avg_cycle_pnl: number;
    avg_cycle_pnl_pct: number;
    best_cycle_pnl: number;
    worst_cycle_pnl: number;
  };
}

export function NextRebalanceTab() {
  const { client, engine } = useEngine();
  const { data: status } = useStatus();
  const nextRebalance = status?.feature_health?.next_rebalance_at;
  const lastRebalance = status?.feature_health?.last_rebalance;

  const { data: cycles } = useQuery<CyclesResponse>({
    queryKey: ["pnl-cycles", engine.id],
    queryFn: () => client.get("/api/pnl/cycles"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!nextRebalance) return;
    function update() {
      const diff = new Date(nextRebalance!).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Rebalance imminent!");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextRebalance]);

  const current = cycles?.current_cycle;
  const summary = cycles?.summary;
  const completed = cycles?.completed_cycles || [];

  return (
    <div className="p-4 space-y-4">
      {/* Countdown + Current Cycle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="text-center py-6">
          <CardHeader>
            <CardTitle>Next Rebalance</CardTitle>
          </CardHeader>
          <div className="text-4xl font-bold text-blue-400 my-4">
            {countdown || "\u2014"}
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            {nextRebalance && (
              <div>
                Scheduled: {new Date(nextRebalance).toLocaleString()}
              </div>
            )}
            {lastRebalance && (
              <div>Last rebalance: {timeAgo(lastRebalance)}</div>
            )}
          </div>
        </Card>

        {current && (
          <Card className="py-6">
            <CardHeader>
              <CardTitle>
                Current Cycle #{current.cycle_number}
              </CardTitle>
            </CardHeader>
            <div className="px-4 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-gray-500">P&L</span>
                <span className="text-2xl font-bold">
                  <PnlText value={current.cycle_pnl} format="usd" />
                </span>
                <span className="text-sm">
                  <PnlText value={current.cycle_pnl_pct} format="pct" />
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-gray-500">Start NAV</div>
                  <div className="text-gray-200">
                    ${current.start_nav?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Current NAV</div>
                  <div className="text-gray-200">
                    ${current.end_nav?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "\u2014"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Trades</div>
                  <div className="text-gray-200">{current.n_trades ?? 0}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Started: {new Date(current.start_time).toLocaleString()}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Cycle Summary KPIs */}
      {summary && summary.total_cycles > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Cycles"
            value={`${summary.total_cycles}`}
            sub={`${summary.winning_cycles}W / ${summary.losing_cycles}L`}
          />
          <KpiCard
            label="Win Rate"
            value={`${summary.win_rate_pct.toFixed(0)}%`}
            valueColor={
              summary.win_rate_pct >= 50 ? "text-green-400" : "text-red-400"
            }
          />
          <KpiCard
            label="Avg Cycle P&L"
            value={`$${summary.avg_cycle_pnl.toFixed(2)}`}
            sub={formatPct(summary.avg_cycle_pnl_pct)}
            valueColor={
              summary.avg_cycle_pnl >= 0 ? "text-green-400" : "text-red-400"
            }
          />
          <KpiCard
            label="Best Cycle"
            value={`$${summary.best_cycle_pnl.toFixed(2)}`}
            valueColor="text-green-400"
          />
          <KpiCard
            label="Worst Cycle"
            value={`$${summary.worst_cycle_pnl.toFixed(2)}`}
            valueColor="text-red-400"
          />
        </div>
      )}

      {/* Completed Cycles Table */}
      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Cycles</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr className="text-gray-500">
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Start</th>
                  <th className="text-left py-2 pr-3">End</th>
                  <th className="text-right py-2 pr-3">Start NAV</th>
                  <th className="text-right py-2 pr-3">End NAV</th>
                  <th className="text-right py-2 pr-3">P&L</th>
                  <th className="text-right py-2 pr-3">P&L %</th>
                  <th className="text-right py-2 pr-3">Realized</th>
                  <th className="text-right py-2 pr-3">Trades</th>
                  <th className="text-center py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {completed.map((c) => (
                  <tr
                    key={c.cycle_number}
                    className="hover:bg-[var(--bg-card-hover)]"
                  >
                    <td className="py-2 pr-3 text-gray-400">
                      {c.cycle_number}
                    </td>
                    <td className="py-2 pr-3 text-gray-300">
                      {c.start_time
                        ? new Date(c.start_time).toLocaleDateString()
                        : "\u2014"}
                    </td>
                    <td className="py-2 pr-3 text-gray-300">
                      {c.end_time
                        ? new Date(c.end_time).toLocaleDateString()
                        : "\u2014"}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300">
                      ${c.start_nav?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300">
                      {c.end_nav
                        ? `$${c.end_nav.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : "\u2014"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <PnlText value={c.cycle_pnl} format="usd" />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <PnlText value={c.cycle_pnl_pct} format="pct" />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <PnlText value={c.realized_pnl} format="usd" />
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300">
                      {c.n_trades ?? 0}
                    </td>
                    <td className="py-2 text-center">
                      <Badge
                        variant={
                          (c.cycle_pnl ?? 0) > 0 ? "success" : "danger"
                        }
                      >
                        {(c.cycle_pnl ?? 0) > 0 ? "WIN" : "LOSS"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty state — always show when no cycles exist */}
      {completed.length === 0 && !current && (
        <Card className="flex flex-col items-center justify-center h-48">
          <div className="text-sm text-gray-400">No cycle data yet</div>
          <div className="text-xs text-gray-600 mt-1">
            Cycle tracking starts at the next rebalance
          </div>
        </Card>
      )}
    </div>
  );
}
