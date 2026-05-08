import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { PnlText } from "../shared/PnlText";
import { Badge } from "../ui/Badge";
import { formatUSD } from "../../lib/utils";
import type { Position, BetaAggregate } from "../../types/api";

type SideFilter = "all" | "LONG" | "SHORT";

const columns: Column<Position>[] = [
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => (
      <span className="font-medium text-gray-200">
        {r.symbol.replace("USDT", "")}
      </span>
    ),
    sortKey: (r) => r.symbol,
  },
  {
    key: "side",
    header: "Side",
    render: (r) => (
      <Badge variant={r.side === "LONG" ? "success" : "danger"}>{r.side}</Badge>
    ),
    sortKey: (r) => r.side,
  },
  {
    key: "tags",
    header: "Tags",
    render: (r) =>
      r.tags && r.tags.length > 0 ? (
        <div className="flex gap-1">
          {r.tags.map((t) => (
            <Badge key={t} variant="default" className="text-[10px] px-1 py-0">
              {t}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-gray-600">—</span>
      ),
  },
  {
    key: "mcap_rank",
    header: "Rank",
    render: (r) => {
      const rank = r.mcap_rank;
      if (rank == null) return <span className="text-gray-600">—</span>;
      const color = rank <= 100 ? "text-emerald-400" : rank <= 200 ? "text-yellow-400" : "text-red-400";
      const src = r.rank_source ? ` (${r.rank_source})` : "";
      return <span className={`${color} text-[11px]`}>#{rank}{src}</span>;
    },
    sortKey: (r) => r.mcap_rank ?? 999,
    align: "right",
  },
  {
    key: "entry_price",
    header: "Entry",
    render: (r) => `$${r.entry_price.toFixed(r.entry_price < 1 ? 6 : 2)}`,
    sortKey: (r) => r.entry_price,
    align: "right",
  },
  {
    key: "current_price",
    header: "Mark",
    render: (r) => `$${r.current_price.toFixed(r.current_price < 1 ? 6 : 2)}`,
    sortKey: (r) => r.current_price,
    align: "right",
  },
  {
    key: "notional",
    header: "Notional",
    render: (r) => formatUSD(r.notional),
    sortKey: (r) => r.notional,
    align: "right",
  },
  {
    key: "current_tilt",
    header: "Tilt",
    render: (r) => {
      const t = r.current_tilt;
      if (t == null) return <span className="text-gray-600">—</span>;
      // >1.10 = overweight conviction, 0.90–1.10 = neutral, <0.90 = underweight
      const color =
        t > 1.10 ? "text-green-400" :
        t < 0.90 ? "text-red-400" : "text-gray-300";
      const entryTilt = r.entry_signals?.long_tilt;
      const adj = r.current_adjusted_score;
      const tip = [
        `Current resize tilt: ${t.toFixed(3)}`,
        r.side === "LONG"
          ? (entryTilt != null ? `Entry tilt: ${entryTilt.toFixed(3)}` : "Entry tilt: — (stale)")
          : null,
        adj != null ? `adj_score: ${adj >= 0 ? "+" : ""}${adj.toFixed(3)}` : null,
        "weight ∝ tilt / residual_vol^0.5",
      ].filter(Boolean).join("\n");
      return (
        <span className={`font-mono text-[11px] ${color}`} title={tip}>
          {t.toFixed(2)}
        </span>
      );
    },
    sortKey: (r) => r.current_tilt ?? 0,
    align: "right",
  },
  {
    key: "pnl_pct",
    header: "P&L %",
    render: (r) => <PnlText value={r.pnl_pct} format="pct" />,
    sortKey: (r) => r.pnl_pct,
    align: "right",
  },
  {
    key: "pnl_usd",
    header: "P&L $",
    render: (r) => <PnlText value={r.pnl_usd} />,
    sortKey: (r) => r.pnl_usd,
    align: "right",
  },
  {
    key: "funding_rate_ann",
    header: "Fund%",
    render: (r) => {
      const ann = (r as any).funding_rate_ann;
      if (ann == null || ann === 0) return <span className="text-gray-700">—</span>;
      // For shorts, positive funding = we receive; for longs, positive = we pay
      const effective = r.side === "SHORT" ? ann : -ann;
      const color = effective > 0 ? "text-green-400" : effective < -10 ? "text-red-400" : "text-amber-400";
      return (
        <span className={`font-mono text-[11px] ${color}`} title={`${ann > 0 ? "+" : ""}${ann.toFixed(1)}% ann. (${r.side === "SHORT" ? "receiving" : "paying"})`}>
          {effective > 0 ? "+" : ""}{effective.toFixed(1)}%
        </span>
      );
    },
    sortKey: (r) => (r as any).funding_rate_ann ?? 0,
    align: "right",
  },
  {
    key: "hours_held",
    header: "Hold",
    render: (r) => `${r.hours_held.toFixed(0)}h`,
    sortKey: (r) => r.hours_held,
    align: "right",
  },
  {
    key: "annualized_vol",
    header: "Vol (ann)",
    render: (r) => {
      if (r.annualized_vol != null) {
        const annPct = r.annualized_vol * 100;
        const dailyPct = annPct / Math.sqrt(365);
        return (
          <span
            className="font-mono text-[11px] text-gray-300"
            title={`Annualized vol: ${annPct.toFixed(1)}%\nDaily vol: ${dailyPct.toFixed(2)}%`}
          >
            {annPct.toFixed(0)}%
          </span>
        );
      }
      return r.daily_vol_pct != null ? `${r.daily_vol_pct.toFixed(1)}%` : "—";
    },
    sortKey: (r) => r.annualized_vol ?? r.daily_vol_pct ?? 0,
    align: "right",
  },
  {
    key: "volume_rank",
    header: "Vol Rank",
    render: (r) => (r.volume_rank != null ? `#${r.volume_rank}` : "—"),
    sortKey: (r) => r.volume_rank ?? 999,
    align: "right",
  },
  {
    key: "beta",
    header: "Beta",
    render: (r) => (
      <span className={r.beta != null && r.beta > 1.2 ? "text-red-400" : r.beta != null && r.beta < 0.8 ? "text-blue-400" : "text-gray-300"}>
        {r.beta != null ? r.beta.toFixed(2) : "—"}
      </span>
    ),
    sortKey: (r) => r.beta ?? 0,
    align: "right",
  },
  {
    key: "correlation",
    header: "Corr",
    render: (r) => (
      <span className={r.correlation != null && r.correlation > 0.8 ? "text-green-400" : r.correlation != null && r.correlation < 0.5 ? "text-yellow-400" : "text-gray-300"}>
        {r.correlation != null ? r.correlation.toFixed(2) : "—"}
      </span>
    ),
    sortKey: (r) => r.correlation ?? 0,
    align: "right",
  },
];

export function PositionsTab() {
  const { client, engine } = useEngine();
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["positions", engine.id],
    queryFn: () =>
      client.get<{ positions: Position[]; count: number; beta?: BetaAggregate }>("/api/positions"),
    refetchInterval: 30_000,
  });

  const { data: risk } = useQuery<{
    gross_pct: number;
    net_pct: number;
    net_beta_pct: number;
    gross_long: number;
    gross_short: number;
    target_beta_tilt_pct?: number;
  }>({
    queryKey: ["risk", engine.id],
    queryFn: () => client.get("/api/risk"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading positions...
      </div>
    );
  }

  const positions = data?.positions ?? [];
  const beta = data?.beta;
  const filtered =
    sideFilter === "all"
      ? positions
      : positions.filter((p) => p.side === sideFilter);

  // Unrealized P&L aggregates across all open positions
  const longPositions = positions.filter((p) => p.side === "LONG");
  const shortPositions = positions.filter((p) => p.side === "SHORT");
  const sumPnl = (arr: Position[]) => arr.reduce((a, p) => a + (p.pnl_usd ?? 0), 0);
  const sumNotional = (arr: Position[]) => arr.reduce((a, p) => a + (p.notional ?? 0), 0);
  const totalPnl = sumPnl(positions);
  const longPnl = sumPnl(longPositions);
  const shortPnl = sumPnl(shortPositions);
  const totalNotional = sumNotional(positions);
  const longNotional = sumNotional(longPositions);
  const shortNotional = sumNotional(shortPositions);
  const totalPnlPct = totalNotional > 0 ? (totalPnl / totalNotional) * 100 : 0;
  const longPnlPct = longNotional > 0 ? (longPnl / longNotional) * 100 : 0;
  const shortPnlPct = shortNotional > 0 ? (shortPnl / shortNotional) * 100 : 0;
  const winners = positions.filter((p) => (p.pnl_usd ?? 0) > 0).length;
  const losers = positions.filter((p) => (p.pnl_usd ?? 0) < 0).length;
  const tone = (v: number) =>
    Math.abs(v) < 0.01 ? "text-gray-300" : v > 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="p-4 space-y-4">
      {/* Unrealized P&L Summary */}
      {positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unrealized P&L (open positions)</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Total Unrealized</div>
              <div className={`text-lg font-mono font-semibold ${tone(totalPnl)}`}>
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </div>
              <div className={`text-[10px] mt-0.5 ${tone(totalPnlPct)}`}>
                {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}% on ${totalNotional.toFixed(0)} gross
              </div>
            </div>
            <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Longs ({longPositions.length})</div>
              <div className={`text-lg font-mono font-semibold ${tone(longPnl)}`}>
                {longPnl >= 0 ? "+" : ""}${longPnl.toFixed(2)}
              </div>
              <div className={`text-[10px] mt-0.5 ${tone(longPnlPct)}`}>
                {longPnlPct >= 0 ? "+" : ""}{longPnlPct.toFixed(2)}% on ${longNotional.toFixed(0)}
              </div>
            </div>
            <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Shorts ({shortPositions.length})</div>
              <div className={`text-lg font-mono font-semibold ${tone(shortPnl)}`}>
                {shortPnl >= 0 ? "+" : ""}${shortPnl.toFixed(2)}
              </div>
              <div className={`text-[10px] mt-0.5 ${tone(shortPnlPct)}`}>
                {shortPnlPct >= 0 ? "+" : ""}{shortPnlPct.toFixed(2)}% on ${shortNotional.toFixed(0)}
              </div>
            </div>
            <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Winners / Losers</div>
              <div className="text-lg font-mono font-semibold text-gray-200">
                <span className="text-green-400">{winners}</span>
                <span className="text-gray-500"> / </span>
                <span className="text-red-400">{losers}</span>
              </div>
              <div className="text-[10px] text-gray-600 mt-0.5">
                {positions.length > 0 ? `${((winners / positions.length) * 100).toFixed(0)}% green` : "—"}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-gray-600">
            Mark-to-market on open positions only. Realized P&L (closed trades) is shown on the Performance tab.
          </div>
        </Card>
      )}

      {/* Exposure & Beta Hedging — Levered (/notional) */}
      {beta && (() => {
        // Notional capital derived from /api/risk: gross_$ / gross_pct * 100
        const grossUsd = risk ? risk.gross_long + risk.gross_short : longNotional + shortNotional;
        const notionalCapital = risk && risk.gross_pct > 0
          ? (grossUsd / risk.gross_pct) * 100
          : 100_000;
        const leverageX = grossUsd / notionalCapital;
        const netNotionalUsd = longNotional - shortNotional;
        // Prefer authoritative risk values; fall back to local compute if /api/risk unavailable
        const grossPct = risk?.gross_pct ?? (grossUsd / notionalCapital) * 100;
        const netPct = risk?.net_pct ?? (netNotionalUsd / notionalCapital) * 100;
        const netBetaPct = risk?.net_beta_pct ?? (beta.net_beta_usd / notionalCapital) * 100;
        const targetBetaPct = risk?.target_beta_tilt_pct;
        return (
          <Card>
            <CardHeader>
              <CardTitle>Exposure & Beta Hedging</CardTitle>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Levered (% of notional ${(notionalCapital / 1000).toFixed(0)}k) — leverage {leverageX.toFixed(2)}x
              </div>
            </CardHeader>

            {/* Notional row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Long Notional</div>
                <div className="text-lg font-mono font-semibold text-green-400">{formatUSD(longNotional)}</div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Short Notional</div>
                <div className="text-lg font-mono font-semibold text-red-400">{formatUSD(shortNotional)}</div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Gross %</div>
                <div className="text-lg font-mono font-semibold text-gray-200">
                  {grossPct.toFixed(2)}%
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Net Notional $</div>
                <div className={`text-lg font-mono font-semibold ${Math.abs(netNotionalUsd) < 500 ? "text-green-400" : "text-yellow-400"}`}>
                  {netNotionalUsd >= 0 ? "+" : ""}{formatUSD(netNotionalUsd)}
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Net Notional %</div>
                <div className={`text-lg font-mono font-semibold ${Math.abs(netPct) < 2 ? "text-green-400" : "text-yellow-400"}`}>
                  {netPct > 0 ? "+" : ""}{netPct.toFixed(2)}%
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Leverage</div>
                <div className="text-lg font-mono font-semibold text-gray-200">{leverageX.toFixed(2)}x</div>
              </div>
            </div>

            {/* Beta row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs mt-3">
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Long Basket β</div>
                <div className="text-lg font-mono font-semibold text-green-400">
                  {beta.long_basket_beta?.toFixed(3) ?? "—"}
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Short Basket β</div>
                <div className="text-lg font-mono font-semibold text-red-400">
                  {beta.short_basket_beta?.toFixed(3) ?? "—"}
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Beta Ratio</div>
                <div className="text-lg font-mono font-semibold text-gray-200">
                  {beta.beta_ratio?.toFixed(3) ?? "—"}
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Net Beta $</div>
                <div className={`text-lg font-mono font-semibold ${Math.abs(beta.net_beta_usd) < 500 ? "text-green-400" : "text-yellow-400"}`}>
                  {beta.net_beta_usd >= 0 ? "+" : ""}{formatUSD(beta.net_beta_usd)}
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Net Beta %</div>
                <div className={`text-lg font-mono font-semibold ${Math.abs(netBetaPct) < 5 ? "text-green-400" : Math.abs(netBetaPct) < 10 ? "text-yellow-400" : "text-red-400"}`}>
                  {netBetaPct > 0 ? "+" : ""}{netBetaPct.toFixed(2)}%
                </div>
                {targetBetaPct != null && (
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    target {targetBetaPct >= 0 ? "+" : ""}{targetBetaPct.toFixed(2)}%
                  </div>
                )}
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Short Avg Corr</div>
                <div className="text-lg font-mono font-semibold text-gray-200">
                  {beta.short_basket_avg_corr?.toFixed(3) ?? "—"}
                </div>
              </div>
            </div>

            <div className="mt-2 text-[10px] text-gray-600">
              Long β×notional = {formatUSD(beta.long_beta_notional)} | Short β×notional = {formatUSD(beta.short_beta_notional)} | Net β = {beta.net_beta_usd >= 0 ? "+" : ""}{formatUSD(beta.net_beta_usd)} ({netBetaPct >= 0 ? "+" : ""}{netBetaPct.toFixed(2)}% of notional). All percentages are levered (/notional capital).
            </div>
          </Card>
        );
      })()}

      {/* Funding Summary — weighted across all positions, sign-aware */}
      {(() => {
        // Sign convention: SHORT positive funding = we RECEIVE (good).
        // LONG positive funding = we PAY (bad). So effective_ann_per_position
        // = funding_rate_ann * (side === "SHORT" ? +1 : -1).
        const withFunding = positions.filter(
          (p) => (p as any).funding_rate_ann != null && p.notional > 0
        );
        if (withFunding.length === 0) return null;
        const totalNotional = withFunding.reduce((a, p) => a + p.notional, 0);
        const longs = withFunding.filter((p) => p.side === "LONG");
        const shorts = withFunding.filter((p) => p.side === "SHORT");
        const longNotional = longs.reduce((a, p) => a + p.notional, 0);
        const shortNotional = shorts.reduce((a, p) => a + p.notional, 0);
        const sideSign = (side: string) => (side === "SHORT" ? 1 : -1);
        // weighted avg ann %, signed (positive = net funding income)
        const weightedAnn =
          withFunding.reduce(
            (a, p) => a + (p as any).funding_rate_ann * sideSign(p.side) * p.notional,
            0
          ) / totalNotional;
        const avgAnnLong =
          longNotional > 0
            ? longs.reduce((a, p) => a + (p as any).funding_rate_ann * p.notional, 0) /
              longNotional
            : 0;
        const avgAnnShort =
          shortNotional > 0
            ? shorts.reduce((a, p) => a + (p as any).funding_rate_ann * p.notional, 0) /
              shortNotional
            : 0;
        // daily $: (ann% / 100) / 365 × notional × sideSign
        const dailyUsd = withFunding.reduce(
          (a, p) =>
            a +
            ((p as any).funding_rate_ann / 100 / 365) * p.notional * sideSign(p.side),
          0
        );
        const dailyLong = longs.reduce(
          (a, p) => a + ((p as any).funding_rate_ann / 100 / 365) * p.notional * -1,
          0
        );
        const dailyShort = shorts.reduce(
          (a, p) => a + ((p as any).funding_rate_ann / 100 / 365) * p.notional * 1,
          0
        );
        const dailyTone =
          Math.abs(dailyUsd) < 1
            ? "text-gray-300"
            : dailyUsd > 0
              ? "text-green-400"
              : "text-red-400";
        const annTone =
          Math.abs(weightedAnn) < 1
            ? "text-gray-300"
            : weightedAnn > 0
              ? "text-green-400"
              : "text-red-400";
        return (
          <Card>
            <CardHeader>
              <CardTitle>Funding Summary</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Net Ann % (weighted)</div>
                <div className={`text-lg font-mono font-semibold ${annTone}`}>
                  {weightedAnn >= 0 ? "+" : ""}
                  {weightedAnn.toFixed(2)}%
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">net of side sign</div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Daily $</div>
                <div className={`text-lg font-mono font-semibold ${dailyTone}`}>
                  {dailyUsd >= 0 ? "+" : ""}${dailyUsd.toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  {dailyUsd >= 0 ? "we receive" : "we pay"}
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Long side</div>
                <div
                  className={`text-sm font-mono ${dailyLong >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {dailyLong >= 0 ? "+" : ""}${dailyLong.toFixed(2)}/d
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  pays {avgAnnLong.toFixed(1)}% ann avg
                </div>
              </div>
              <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
                <div className="text-[10px] text-gray-500 uppercase">Short side</div>
                <div
                  className={`text-sm font-mono ${dailyShort >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {dailyShort >= 0 ? "+" : ""}${dailyShort.toFixed(2)}/d
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  receives {avgAnnShort.toFixed(1)}% ann avg
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-gray-600">
              Sign convention: short funding receipt is positive, long funding payment
              is negative. {withFunding.length}/{positions.length} positions have live
              funding rate.
            </div>
          </Card>
        );
      })()}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Positions ({data?.count ?? 0})</CardTitle>
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
                  {f === "all"
                    ? `All (${positions.length})`
                    : f === "LONG"
                      ? `Longs (${positions.filter((p) => p.side === "LONG").length})`
                      : `Shorts (${positions.filter((p) => p.side === "SHORT").length})`}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <DataTable
          columns={columns}
          data={filtered}
          defaultSort="pnl_usd"
          defaultDir="desc"
        />
      </Card>
    </div>
  );
}
