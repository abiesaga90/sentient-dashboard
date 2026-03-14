import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { useStatus, useRiskHistory } from "../../hooks/useDashboardQuery";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { PnlText } from "../shared/PnlText";
import { ExposureCharts } from "../overview/ExposureCharts";
import { formatUSD, formatPct } from "../../lib/utils";
import type { Position } from "../../types/api";

type SideFilter = "all" | "LONG" | "SHORT";

export function PositionsTab() {
  const { client, engine } = useEngine();
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const { data: status } = useStatus();
  const { data: riskHistory } = useRiskHistory();

  const { data, isLoading } = useQuery({
    queryKey: ["positions", engine.id],
    queryFn: () =>
      client.get<{
        positions: Position[];
        count: number;
        winners_total_pnl: number;
        losers_total_pnl: number;
      }>("/api/positions"),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading positions...
      </div>
    );
  }

  const positions = data?.positions ?? [];
  const longs = positions.filter((p) => p.side === "LONG");
  const shorts = positions.filter((p) => p.side === "SHORT");

  // Compute beta-adjusted exposure
  const longBetaAdj = longs.reduce((s, p) => s + p.notional * (p.daily_vol_pct != null ? computeBeta(p) : 1), 0);
  const shortBetaAdj = shorts.reduce((s, p) => s + p.notional * (p.daily_vol_pct != null ? computeBeta(p) : 1), 0);
  const longTotal = longs.reduce((s, p) => s + p.notional, 0);
  const shortTotal = shorts.reduce((s, p) => s + p.notional, 0);
  const longAvgBeta = longTotal > 0 ? longBetaAdj / longTotal : 0;
  const shortAvgBeta = shortTotal > 0 ? shortBetaAdj / shortTotal : 0;

  // Vol SL cooldowns from status
  const cooldowns = status?.vol_sl_cooldowns ?? {};

  const filtered =
    sideFilter === "all"
      ? positions
      : positions.filter((p) => p.side === sideFilter);

  const totalPnl = positions.reduce((s, p) => s + p.pnl_usd, 0);
  const totalPnlPct = longTotal + shortTotal > 0 ? (totalPnl / (longTotal + shortTotal)) * 100 : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Long Basket */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Long Basket (Fixed Quality)</CardTitle>
          </div>
        </CardHeader>
        <BasketTable positions={longs} side="LONG" />
        <div className="px-3 py-2 border-t border-[var(--border)] flex justify-between text-xs font-medium">
          <span className="text-gray-400">Total</span>
          <div className="flex gap-6">
            <span className="text-gray-300">{formatUSD(longTotal)}</span>
            <span className="text-gray-300">100.0%</span>
            <span className="text-gray-300">{longAvgBeta.toFixed(2)}</span>
            <span className="text-gray-300">{formatUSD(longBetaAdj)}</span>
          </div>
        </div>
      </Card>

      {/* Short Basket */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Short Basket (Dynamic Hedge)</CardTitle>
          </div>
        </CardHeader>
        <BasketTable positions={shorts} side="SHORT" />
        <div className="px-3 py-2 border-t border-[var(--border)] flex justify-between text-xs font-medium">
          <span className="text-gray-400">Total</span>
          <div className="flex gap-6">
            <span className="text-gray-300">{formatUSD(shortTotal)}</span>
            <span className="text-gray-300">100.0%</span>
            <span className="text-gray-300">{shortAvgBeta.toFixed(2)}</span>
            <span className="text-gray-300">{formatUSD(shortBetaAdj)}</span>
          </div>
        </div>
      </Card>

      {/* Beta-adjusted summary */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
        <span>Long β-Adj: <span className="text-gray-300">{formatUSD(longBetaAdj)}</span></span>
        <span>|</span>
        <span>Short β-Adj: <span className="text-gray-300">{formatUSD(shortBetaAdj)}</span></span>
        <span>|</span>
        <span>
          Net β-Adj:{" "}
          <span className="text-gray-300">
            {formatUSD(longBetaAdj - shortBetaAdj)} ({((longBetaAdj - shortBetaAdj) / (longTotal + shortTotal) * 100 || 0).toFixed(1)}% of NAV)
          </span>
        </span>
      </div>

      {/* Exposure History */}
      {riskHistory?.history && riskHistory.history.length > 0 && (
        <ExposureCharts history={riskHistory.history} />
      )}

      {/* Positions with filter + exit range */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Positions</CardTitle>
            <div className="flex gap-1">
              {(["all", "LONG", "SHORT"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSideFilter(f)}
                  className={`px-2 py-0.5 text-xs rounded ${
                    sideFilter === f
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {f === "all" ? `All (${positions.length})` : f === "LONG" ? "Longs" : "Shorts"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Symbol</th>
                <th className="px-3 py-2 text-left text-gray-500">Side</th>
                <th className="px-3 py-2 text-right text-gray-500">P&L %</th>
                <th className="px-3 py-2 text-right text-gray-500">P&L $</th>
                <th className="px-3 py-2 text-left text-gray-500" style={{ minWidth: 180 }}>
                  Exit Range
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((p) => (
                <tr key={`${p.symbol}-${p.side}`} className="hover:bg-[var(--bg-card-hover)]">
                  <td className="px-3 py-2 font-medium text-gray-200">
                    {p.symbol.replace("USDT", "")}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={p.side === "LONG" ? "success" : "danger"} className="text-[10px]">
                      {p.side}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PnlText value={p.pnl_pct} format="pct" className="text-xs" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PnlText value={p.pnl_usd} className="text-xs" />
                  </td>
                  <td className="px-3 py-2">
                    <ExitRangeBar position={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Total row */}
        <div className="px-3 py-2 border-t border-[var(--border)] flex justify-between text-xs font-medium">
          <span className="text-gray-400">Total</span>
          <div className="flex gap-4">
            <PnlText value={totalPnlPct} format="pct" className="text-xs" />
            <PnlText value={totalPnl} className="text-xs" />
          </div>
        </div>
      </Card>

      {/* Short Cooldowns */}
      {Object.keys(cooldowns).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Short Cooldowns</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {Object.entries(cooldowns).map(([sym, expires]) => {
              const remaining = Math.max(0, new Date(expires).getTime() - Date.now());
              const hours = Math.floor(remaining / 3600000);
              const mins = Math.floor((remaining % 3600000) / 60000);
              return (
                <Badge key={sym} variant="warning">
                  {sym.replace("USDT", "")} — {hours}h {mins}m remaining
                </Badge>
              );
            })}
          </div>
        </Card>
      )}

      {/* Exit Methodology */}
      <ExitMethodology />
    </div>
  );
}

// ── Basket Table ──

function BasketTable({ positions, side }: { positions: Position[]; side: "LONG" | "SHORT" }) {
  const total = positions.reduce((s, p) => s + p.notional, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-[var(--border)]">
          <tr>
            <th className="px-3 py-1.5 text-left text-gray-500">Token</th>
            {side === "LONG" && <th className="px-3 py-1.5 text-left text-gray-500">Tag</th>}
            <th className="px-3 py-1.5 text-right text-gray-500">Notional</th>
            <th className="px-3 py-1.5 text-right text-gray-500">Weight</th>
            <th className="px-3 py-1.5 text-right text-gray-500">Vol</th>
            <th className="px-3 py-1.5 text-right text-gray-500">Beta</th>
            {side === "SHORT" && (
              <>
                <th className="px-3 py-1.5 text-right text-gray-500">Corr</th>
                <th className="px-3 py-1.5 text-right text-gray-500">Score</th>
              </>
            )}
            {side === "SHORT" && <th className="px-3 py-1.5 text-left text-gray-500">Tag</th>}
            <th className="px-3 py-1.5 text-right text-gray-500">β-Adj Exp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {positions.map((p) => {
            const weight = total > 0 ? (p.notional / total) * 100 : 0;
            const vol = p.daily_vol_pct != null ? p.daily_vol_pct * 100 : null;
            const beta = computeBeta(p);
            const betaAdj = p.notional * beta;

            return (
              <tr key={p.symbol} className="hover:bg-[var(--bg-card-hover)]">
                <td className="px-3 py-1.5 font-medium text-gray-200">
                  {p.symbol.replace("USDT", "")}
                </td>
                {side === "LONG" && (
                  <td className="px-3 py-1.5">
                    <TagBadges tags={p.tags} />
                  </td>
                )}
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {formatUSD(p.notional)}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {weight.toFixed(1)}%
                </td>
                <td className="px-3 py-1.5 text-right text-gray-400">
                  {vol != null ? `${vol.toFixed(0)}%` : "—"}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-400">
                  {beta.toFixed(2)}
                </td>
                {side === "SHORT" && (
                  <>
                    <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                    <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                  </>
                )}
                {side === "SHORT" && (
                  <td className="px-3 py-1.5">
                    <TagBadges tags={p.tags} />
                  </td>
                )}
                <td className="px-3 py-1.5 text-right text-gray-300">
                  {formatUSD(betaAdj)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TagBadges({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return <span className="text-gray-600">—</span>;
  return (
    <div className="flex gap-1">
      {tags.map((t) => (
        <Badge key={t} variant="default" className="text-[10px] px-1 py-0">
          {t}
        </Badge>
      ))}
    </div>
  );
}

// ── Exit Range Bar ──

function ExitRangeBar({ position: p }: { position: Position }) {
  const hasSl = p.sl_pct != null;
  const hasTp = p.tp_pct != null;

  if (!hasSl && !hasTp) {
    // Long with no SL — just show TP and current
    if (p.tp_pct != null) {
      return <SimpleBar pnl={p.pnl_pct} tp={p.tp_pct} sl={null} />;
    }
    return <span className="text-gray-600 text-[10px]">—</span>;
  }

  return <SimpleBar pnl={p.pnl_pct} tp={p.tp_pct} sl={p.sl_pct} />;
}

function SimpleBar({
  pnl,
  tp,
  sl,
}: {
  pnl: number;
  tp: number | null;
  sl: number | null;
}) {
  // Determine range
  const lo = sl != null ? Math.min(sl, pnl, -1) : Math.min(pnl, -1);
  const hi = tp != null ? Math.max(tp, pnl, 1) : Math.max(pnl, 1);
  const range = hi - lo || 1;

  const pnlPos = ((pnl - lo) / range) * 100;
  const tpPos = tp != null ? ((tp - lo) / range) * 100 : null;
  const slPos = sl != null ? ((sl - lo) / range) * 100 : null;
  const zeroPos = ((0 - lo) / range) * 100;

  return (
    <div className="relative h-4 w-full">
      {/* Background bar */}
      <div className="absolute inset-0 bg-gray-800 rounded-sm" />

      {/* Zero line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-gray-600"
        style={{ left: `${clamp(zeroPos)}%` }}
      />

      {/* SL marker */}
      {slPos != null && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
          style={{ left: `${clamp(slPos)}%` }}
          title={`SL: ${sl!.toFixed(1)}%`}
        />
      )}

      {/* TP marker */}
      {tpPos != null && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-green-500"
          style={{ left: `${clamp(tpPos)}%` }}
          title={`TP: ${tp!.toFixed(1)}%`}
        />
      )}

      {/* Current P&L dot */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
          pnl >= 0 ? "bg-green-400" : "bg-red-400"
        }`}
        style={{ left: `${clamp(pnlPos)}%` }}
      />

      {/* Labels */}
      <div className="absolute -bottom-3 left-0 right-0 flex justify-between text-[8px]">
        {sl != null && (
          <span className="text-red-400" style={{ position: "absolute", left: `${clamp(slPos!)}%`, transform: "translateX(-50%)" }}>
            {formatPct(sl)}
          </span>
        )}
        {tp != null && (
          <span className="text-green-400" style={{ position: "absolute", left: `${clamp(tpPos!)}%`, transform: "translateX(-50%)" }}>
            {formatPct(tp)}
          </span>
        )}
        <span
          className={pnl >= 0 ? "text-green-400" : "text-red-400"}
          style={{ position: "absolute", left: `${clamp(pnlPos)}%`, transform: "translateX(-50%)", top: "-10px" }}
        >
          {formatPct(pnl)}
        </span>
      </div>
    </div>
  );
}

function clamp(v: number) {
  return Math.max(2, Math.min(98, v));
}

function computeBeta(_p: Position): number {
  // Beta comes from signals/rankings, not the positions endpoint.
  // Default to 1.0 for display; basket tables show this as a placeholder.
  return 1.0;
}

// ── Exit Methodology ──

function ExitMethodology() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between"
        >
          <CardTitle>Exit Methodology — Asymmetric Vol-Adjusted TP/SL</CardTitle>
          <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
        </button>
      </CardHeader>

      {/* Always show summary */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-2">
        <span>Long TP: <span className="text-gray-300">0.75× vol</span></span>
        <span>Short TP: <span className="text-gray-300">0.75× vol</span></span>
        <span>Short SL: <span className="text-gray-300">2.5× vol</span></span>
        <span>Rebalance: <span className="text-gray-300">72h</span></span>
      </div>

      {expanded && (
        <div className="text-xs text-gray-400 space-y-3 mt-3 border-t border-[var(--border)] pt-3">
          <div>
            <div className="text-gray-300 font-medium mb-1">How TP/SL Levels Are Calculated</div>
            <p>
              Each position's Take Profit and Stop Loss thresholds are dynamically scaled to its own realized volatility.
              Longs use a tighter TP (harvest and re-enter) while shorts use a wider TP (capture hedge decay).
            </p>
          </div>

          <div className="bg-gray-900/50 rounded p-2 font-mono text-[10px] text-gray-500">
            Daily Vol = σ(hourly log returns) × √24 [168h lookback]<br />
            Long TP = clamp(0.75 × Vol × Regime, 0%, 20%)<br />
            Short TP = clamp(0.75 × Vol × Regime, 3%, 20%)<br />
            SL = clamp(2.5 × Vol × √days × Regime, 3%, 15%)<br />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ParamItem label="Long TP Multiple" value="0.75×" />
            <ParamItem label="Short TP Multiple" value="0.75×" />
            <ParamItem label="SL Multiple (K)" value="2.5× √t" />
            <ParamItem label="Regime Width" value="1.3×" />
            <ParamItem label="Long TP Floor" value="0%" />
            <ParamItem label="Short TP Floor" value="3%" />
            <ParamItem label="TP Ceiling" value="20%" />
            <ParamItem label="SL Floor / Ceiling" value="3% / 15%" />
            <ParamItem label="Vol Lookback" value="168h (7d)" />
            <ParamItem label="Rebalance" value="72h" />
            <ParamItem label="Short Max Hold" value="30d" />
            <ParamItem label="Emergency SL" value="25%" />
          </div>

          <div>
            <div className="text-gray-300 font-medium mb-1">Key Design Decisions</div>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li><span className="text-gray-400">No SL on longs</span> — portfolio DD scaling handles long-side risk</li>
              <li><span className="text-gray-400">Tight long TP</span> — harvest and re-enter (gap fill within 60s)</li>
              <li><span className="text-gray-400">Short SL widens with √t</span> — Day 1 = 2.5σ, Day 4 = 5σ, capped at 15%</li>
              <li><span className="text-gray-400">Regime scaling</span> — calm = wider bands, volatile = tighter</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function ParamItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <div className="text-gray-600">{label}</div>
      <div className="text-gray-300 font-medium">{value}</div>
    </div>
  );
}
