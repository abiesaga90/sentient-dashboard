import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { PnlText } from "../shared/PnlText";
import { KpiCard } from "../shared/KpiCard";
import { useEngine } from "../../hooks/useEngine";
import { useStatus, useDashboard } from "../../hooks/useDashboardQuery";
import { formatUSD, formatPct, timeAgo, pnlColor, cn } from "../../lib/utils";

/* ── Dry-run response types ── */

interface ResizeDetail {
  symbol: string;
  side: "LONG" | "SHORT";
  current_notional: number;
  target_notional: number;
  drift_pct: number;
  resize_usd: number;
  would_resize: boolean;
}

interface ExitDetail {
  symbol: string;
  side: "LONG" | "SHORT";
  entry_price: number;
  exit_price: number;
  notional: number;
  return_pct: number;
  realized_pnl: number;
}

interface DryRunResponse {
  nav: number;
  dd_scale: number;
  vol_scale: number;
  targets: { longs: number; shorts: number };
  basket_changes: {
    shorts_entering: string[];
    shorts_exiting: string[];
    shorts_staying: number;
    longs_entering: string[];
    longs_exiting: string[];
    longs_staying: number;
  };
  resizes: {
    tolerance_pct: number;
    total_triggered: number;
    total_positions: number;
    net_resize_usd: number;
    detail: ResizeDetail[];
  };
  realized_pnl: {
    from_exits: number;
    from_trims: number;
    total: number;
    exits: ExitDetail[];
    trims: ExitDetail[];
  };
  new_short_basket: string[];
  pump_exhaustion: {
    tactical_sleeve: string[];
    detail: Record<string, unknown>;
  };
}

/* ── Helpers ── */

function SideBadge({ side }: { side: string }) {
  return (
    <Badge variant={side === "LONG" ? "success" : "danger"}>
      {side === "LONG" ? "L" : "S"}
    </Badge>
  );
}

function ChangeTag({ label, variant }: { label: string; variant: "success" | "danger" | "info" | "warning" }) {
  return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{label}</Badge>;
}

/* ── Main component ── */

export function NextRebalanceTab() {
  const { client, engine } = useEngine();
  const { data: status } = useStatus();
  const { data: dashboard } = useDashboard();
  const nextRebalance = status?.feature_health?.next_rebalance_at;
  const lastRebalance = status?.feature_health?.last_rebalance;

  // Dry-run query (admin-protected, 5 min refetch)
  const {
    data: dryRun,
    isLoading: dryRunLoading,
    error: dryRunError,
    refetch: refetchDryRun,
  } = useQuery<DryRunResponse>({
    queryKey: ["dry-run", engine.id],
    queryFn: () =>
      client.getWithHeaders("/api/rebalance/dry-run", {
        "X-Admin-Secret": engine.adminSecret,
      }),
    refetchInterval: 300_000,
    staleTime: 120_000,
    retry: 1,
  });

  // Countdown timer
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!nextRebalance) return;
    function update() {
      const diff = new Date(nextRebalance!).getTime() - Date.now();
      if (diff <= 0) { setCountdown("Rebalance imminent!"); return; }
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

  // Current positions map for context
  const currentPositions = useMemo(() => {
    const map = new Map<string, { side: string; notional: number; pnl_pct: number; pnl_usd: number }>();
    dashboard?.positions?.positions?.forEach((p) => {
      map.set(p.symbol, { side: p.side, notional: p.notional, pnl_pct: p.pnl_pct, pnl_usd: p.pnl_usd });
    });
    return map;
  }, [dashboard]);

  // Merge resizes into a unified table: current vs target
  const positionChanges = useMemo(() => {
    if (!dryRun) return [];
    const bc = dryRun.basket_changes;
    const resizeMap = new Map(dryRun.resizes.detail.map((r) => [r.symbol, r]));
    const exitMap = new Map(dryRun.realized_pnl.exits.map((e) => [e.symbol, e]));

    type Row = {
      symbol: string;
      side: "LONG" | "SHORT";
      action: "ENTER" | "EXIT" | "RESIZE" | "HOLD";
      currentNotional: number;
      targetNotional: number;
      changeUsd: number;
      changePct: number;
      realizedPnl: number | null;
    };

    const rows: Row[] = [];

    // Entering positions
    for (const sym of [...bc.longs_entering, ...bc.shorts_entering]) {
      const side = bc.longs_entering.includes(sym) ? "LONG" as const : "SHORT" as const;
      const resize = resizeMap.get(sym);
      rows.push({
        symbol: sym,
        side,
        action: "ENTER",
        currentNotional: 0,
        targetNotional: resize?.target_notional ?? 0,
        changeUsd: resize?.target_notional ?? 0,
        changePct: 100,
        realizedPnl: null,
      });
    }

    // Exiting positions
    for (const sym of [...bc.shorts_exiting, ...bc.longs_exiting]) {
      const cur = currentPositions.get(sym);
      const exit = exitMap.get(sym);
      rows.push({
        symbol: sym,
        side: (cur?.side ?? (bc.longs_exiting.includes(sym) ? "LONG" : "SHORT")) as "LONG" | "SHORT",
        action: "EXIT",
        currentNotional: cur?.notional ?? exit?.notional ?? 0,
        targetNotional: 0,
        changeUsd: -(cur?.notional ?? exit?.notional ?? 0),
        changePct: -100,
        realizedPnl: exit?.realized_pnl ?? null,
      });
    }

    // Staying positions (resizes + holds)
    for (const r of dryRun.resizes.detail) {
      if (
        bc.longs_entering.includes(r.symbol) ||
        bc.shorts_entering.includes(r.symbol) ||
        bc.longs_exiting.includes(r.symbol) ||
        bc.shorts_exiting.includes(r.symbol)
      )
        continue;
      rows.push({
        symbol: r.symbol,
        side: r.side,
        action: r.would_resize ? "RESIZE" : "HOLD",
        currentNotional: r.current_notional,
        targetNotional: r.target_notional,
        changeUsd: r.resize_usd,
        changePct: r.drift_pct,
        realizedPnl: null,
      });
    }

    // Sort: ENTER first, then EXIT, then RESIZE by |change|, then HOLD
    const order = { ENTER: 0, EXIT: 1, RESIZE: 2, HOLD: 3 };
    rows.sort((a, b) => {
      if (order[a.action] !== order[b.action]) return order[a.action] - order[b.action];
      return Math.abs(b.changeUsd) - Math.abs(a.changeUsd);
    });

    return rows;
  }, [dryRun, currentPositions]);

  // Split into longs and shorts
  const longChanges = positionChanges.filter((r) => r.side === "LONG");
  const shortChanges = positionChanges.filter((r) => r.side === "SHORT");

  const bc = dryRun?.basket_changes;

  return (
    <div className="p-4 space-y-4">
      {/* ── Row 1: Countdown + Basket Summary KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Countdown — larger, spans 1 col */}
        <Card className="flex flex-col items-center justify-center py-6">
          <div className="text-xs text-gray-500 mb-1">Next Rebalance</div>
          <div className="text-3xl font-bold text-blue-400">{countdown || "—"}</div>
          <div className="text-[10px] text-gray-600 mt-2 space-y-0.5 text-center">
            {nextRebalance && <div>{new Date(nextRebalance).toLocaleString()}</div>}
            {lastRebalance && <div>Last: {timeAgo(lastRebalance)}</div>}
          </div>
        </Card>

        {/* Summary KPIs from dry-run */}
        {dryRun && bc && (
          <>
            <KpiCard
              label="Basket Changes"
              value={`${bc.longs_entering.length + bc.shorts_entering.length} in / ${bc.longs_exiting.length + bc.shorts_exiting.length} out`}
              sub={`${bc.longs_staying + bc.shorts_staying} staying`}
              valueColor="text-blue-400"
            />
            <KpiCard
              label="Resizes Triggered"
              value={`${dryRun.resizes.total_triggered} / ${dryRun.resizes.total_positions}`}
              sub={`Net ${formatUSD(dryRun.resizes.net_resize_usd)} (±${dryRun.resizes.tolerance_pct}% tol)`}
              valueColor="text-yellow-400"
            />
            <KpiCard
              label="Est. Realized P&L"
              value={`${dryRun.realized_pnl.total >= 0 ? "+" : ""}$${Math.abs(dryRun.realized_pnl.total).toFixed(2)}`}
              sub={`Exits $${dryRun.realized_pnl.from_exits.toFixed(2)} | Trims $${dryRun.realized_pnl.from_trims.toFixed(2)}`}
              valueColor={pnlColor(dryRun.realized_pnl.total)}
            />
          </>
        )}
        {!dryRun && !dryRunLoading && (
          <Card className="col-span-3 flex items-center justify-center text-sm text-gray-500">
            {dryRunError ? "Dry-run unavailable" : "Loading preview…"}
          </Card>
        )}
        {dryRunLoading && (
          <Card className="col-span-3 flex items-center justify-center text-sm text-gray-500">
            <div className="animate-pulse">Computing rebalance preview…</div>
          </Card>
        )}
      </div>

      {/* ── Row 2: Entering / Exiting badges ── */}
      {dryRun && bc && (bc.shorts_entering.length > 0 || bc.shorts_exiting.length > 0 || bc.longs_entering.length > 0 || bc.longs_exiting.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Entering */}
          {(bc.longs_entering.length > 0 || bc.shorts_entering.length > 0) && (
            <Card>
              <CardHeader><CardTitle className="text-green-400">Entering</CardTitle></CardHeader>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                {bc.longs_entering.map((s) => (
                  <Badge key={s} variant="success" className="text-xs">
                    {s.replace("USDT", "")} <span className="text-green-300 ml-1">L</span>
                  </Badge>
                ))}
                {bc.shorts_entering.map((s) => (
                  <Badge key={s} variant="info" className="text-xs">
                    {s.replace("USDT", "")} <span className="text-blue-300 ml-1">S</span>
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Exiting */}
          {(bc.longs_exiting.length > 0 || bc.shorts_exiting.length > 0) && (
            <Card>
              <CardHeader><CardTitle className="text-red-400">Exiting</CardTitle></CardHeader>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                {bc.longs_exiting.map((s) => {
                  const exit = dryRun.realized_pnl.exits.find((e) => e.symbol === s);
                  return (
                    <Badge key={s} variant="danger" className="text-xs">
                      {s.replace("USDT", "")} L
                      {exit && <span className={cn("ml-1", pnlColor(exit.realized_pnl))}>{exit.return_pct >= 0 ? "+" : ""}{exit.return_pct.toFixed(1)}%</span>}
                    </Badge>
                  );
                })}
                {bc.shorts_exiting.map((s) => {
                  const exit = dryRun.realized_pnl.exits.find((e) => e.symbol === s);
                  return (
                    <Badge key={s} variant="danger" className="text-xs">
                      {s.replace("USDT", "")} S
                      {exit && <span className={cn("ml-1", pnlColor(exit.realized_pnl))}>{exit.return_pct >= 0 ? "+" : ""}{exit.return_pct.toFixed(1)}%</span>}
                    </Badge>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Row 3: Position changes table (Longs | Shorts side by side) ── */}
      {dryRun && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Longs */}
          <Card>
            <CardHeader>
              <CardTitle>
                Longs ({dryRun.targets.longs})
                {bc && bc.longs_entering.length > 0 && (
                  <span className="text-green-400 text-xs ml-2">+{bc.longs_entering.length} new</span>
                )}
                {bc && bc.longs_exiting.length > 0 && (
                  <span className="text-red-400 text-xs ml-2">-{bc.longs_exiting.length} exit</span>
                )}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto px-2 pb-3">
              <PositionTable rows={longChanges} />
            </div>
          </Card>

          {/* Shorts */}
          <Card>
            <CardHeader>
              <CardTitle>
                Shorts ({dryRun.targets.shorts})
                {bc && bc.shorts_entering.length > 0 && (
                  <span className="text-green-400 text-xs ml-2">+{bc.shorts_entering.length} new</span>
                )}
                {bc && bc.shorts_exiting.length > 0 && (
                  <span className="text-red-400 text-xs ml-2">-{bc.shorts_exiting.length} exit</span>
                )}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto px-2 pb-3">
              <PositionTable rows={shortChanges} />
            </div>
          </Card>
        </div>
      )}

      {/* ── Row 4: Realized P&L Detail ── */}
      {dryRun && (dryRun.realized_pnl.exits.length > 0 || dryRun.realized_pnl.trims.length > 0) && (
        <Card>
          <CardHeader><CardTitle>Estimated Realized P&L at Rebalance</CardTitle></CardHeader>
          <div className="overflow-x-auto px-2 pb-3">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr className="text-gray-500">
                  <th className="text-left py-2 pr-3">Symbol</th>
                  <th className="text-center py-2 pr-3">Side</th>
                  <th className="text-center py-2 pr-3">Type</th>
                  <th className="text-right py-2 pr-3">Entry</th>
                  <th className="text-right py-2 pr-3">Exit/Current</th>
                  <th className="text-right py-2 pr-3">Return</th>
                  <th className="text-right py-2">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {dryRun.realized_pnl.exits.map((e) => (
                  <tr key={`exit-${e.symbol}`} className="hover:bg-[var(--bg-card-hover)]">
                    <td className="py-1.5 pr-3 font-medium text-gray-200">{e.symbol.replace("USDT", "")}</td>
                    <td className="py-1.5 pr-3 text-center"><SideBadge side={e.side} /></td>
                    <td className="py-1.5 pr-3 text-center"><ChangeTag label="EXIT" variant="danger" /></td>
                    <td className="py-1.5 pr-3 text-right text-gray-400">${e.entry_price.toFixed(4)}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-300">${e.exit_price.toFixed(4)}</td>
                    <td className={cn("py-1.5 pr-3 text-right", pnlColor(e.return_pct))}>{formatPct(e.return_pct)}</td>
                    <td className="py-1.5 text-right"><PnlText value={e.realized_pnl} /></td>
                  </tr>
                ))}
                {dryRun.realized_pnl.trims.map((e) => (
                  <tr key={`trim-${e.symbol}`} className="hover:bg-[var(--bg-card-hover)]">
                    <td className="py-1.5 pr-3 font-medium text-gray-200">{e.symbol.replace("USDT", "")}</td>
                    <td className="py-1.5 pr-3 text-center"><SideBadge side={e.side} /></td>
                    <td className="py-1.5 pr-3 text-center"><ChangeTag label="TRIM" variant="warning" /></td>
                    <td className="py-1.5 pr-3 text-right text-gray-400">${e.entry_price.toFixed(4)}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-300">${e.exit_price ?? (e as any).current_price ? `$${((e as any).current_price ?? e.exit_price).toFixed(4)}` : "—"}</td>
                    <td className={cn("py-1.5 pr-3 text-right", pnlColor(e.return_pct))}>{formatPct(e.return_pct)}</td>
                    <td className="py-1.5 text-right"><PnlText value={e.realized_pnl} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-[var(--border)]">
                <tr className="font-medium">
                  <td colSpan={6} className="py-2 text-right text-gray-400">Total Estimated</td>
                  <td className="py-2 text-right"><PnlText value={dryRun.realized_pnl.total} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ── Row 5: Scaling context ── */}
      {dryRun && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="NAV" value={formatUSD(dryRun.nav)} />
          <KpiCard label="DD Scale" value={`${(dryRun.dd_scale * 100).toFixed(1)}%`} valueColor={dryRun.dd_scale < 0.8 ? "text-yellow-400" : "text-gray-100"} />
          <KpiCard label="Vol Scale" value={`${(dryRun.vol_scale * 100).toFixed(1)}%`} valueColor={dryRun.vol_scale < 0.8 ? "text-yellow-400" : "text-gray-100"} />
          <KpiCard
            label="Pump Sleeve"
            value={dryRun.pump_exhaustion.tactical_sleeve.length > 0 ? dryRun.pump_exhaustion.tactical_sleeve.map((s) => s.replace("USDT", "")).join(", ") : "None"}
            valueColor={dryRun.pump_exhaustion.tactical_sleeve.length > 0 ? "text-yellow-400" : "text-gray-500"}
          />
        </div>
      )}

      {/* Refresh button */}
      {dryRun && (
        <div className="flex justify-center">
          <button
            onClick={() => refetchDryRun()}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--border-hover)]"
          >
            Refresh Preview
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Position change sub-table ── */

function PositionTable({
  rows,
}: {
  rows: {
    symbol: string;
    side: "LONG" | "SHORT";
    action: "ENTER" | "EXIT" | "RESIZE" | "HOLD";
    currentNotional: number;
    targetNotional: number;
    changeUsd: number;
    changePct: number;
    realizedPnl: number | null;
  }[];
}) {
  if (rows.length === 0) return <div className="text-xs text-gray-600 p-2">No positions</div>;

  const actionVariant = (a: string) => {
    if (a === "ENTER") return "success" as const;
    if (a === "EXIT") return "danger" as const;
    if (a === "RESIZE") return "warning" as const;
    return "default" as const;
  };

  return (
    <table className="w-full text-xs">
      <thead className="border-b border-[var(--border)]">
        <tr className="text-gray-500">
          <th className="text-left py-1.5 pr-2">Symbol</th>
          <th className="text-center py-1.5 pr-2">Action</th>
          <th className="text-right py-1.5 pr-2">Current</th>
          <th className="text-right py-1.5 pr-2">Target</th>
          <th className="text-right py-1.5">Change</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <tr key={r.symbol} className={cn(
            "hover:bg-[var(--bg-card-hover)] transition-colors",
            r.action === "HOLD" && "opacity-50",
          )}>
            <td className="py-1.5 pr-2 font-medium text-gray-200">{r.symbol.replace("USDT", "")}</td>
            <td className="py-1.5 pr-2 text-center">
              <Badge variant={actionVariant(r.action)} className="text-[10px] px-1.5 py-0">
                {r.action}
              </Badge>
            </td>
            <td className="py-1.5 pr-2 text-right text-gray-400">
              {r.currentNotional > 0 ? formatUSD(r.currentNotional) : "—"}
            </td>
            <td className="py-1.5 pr-2 text-right text-gray-200">
              {r.targetNotional > 0 ? formatUSD(r.targetNotional) : "—"}
            </td>
            <td className={cn("py-1.5 text-right font-medium", pnlColor(r.changeUsd))}>
              {r.action === "HOLD" ? (
                <span className="text-gray-600">—</span>
              ) : (
                <>
                  {r.changeUsd >= 0 ? "+" : "-"}${Math.abs(r.changeUsd).toFixed(0)}
                  <span className="text-gray-500 ml-1 font-normal">
                    ({r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(0)}%)
                  </span>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
