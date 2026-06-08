import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, ComposedChart, Line, Scatter, ZAxis,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { PnlText } from "../shared/PnlText";
import { Badge } from "../ui/Badge";
import { formatUSD } from "../../lib/utils";
import type { Position, BetaAggregate, RiskData } from "../../types/api";
import { BasketPnlChart, type BasketPnlPoint } from "../positions/BasketPnlChart";
import { BasisSleeveSection } from "../positions/BasisSleeveSection";
import { ExposurePanel } from "../shared/ExposurePanel";

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
        <div className="flex gap-1 flex-wrap">
          {r.tags.map((t) => {
            const isPinned = t === "PINNED";
            const isFrozen = t === "FROZEN";
            const variant = isFrozen ? "info" : isPinned ? "warning" : "default";
            const title = isFrozen
              ? "Frozen sleeve (REBALANCE_FROZEN_SYMBOLS): held untouched by the rebalance engine — no target, resize, trim, or rotation-close. Only the hard DD_STOP can exit it. Change size only via manual-twap. (This is why it can show as 'rotated OUT' in alerts despite never being closed.)"
              : isPinned
                ? "Force-pinned via ALWAYS_INCLUDE_SHORTS (discretionary conviction short)"
                : undefined;
            return (
              <Badge
                key={t}
                variant={variant}
                className={`text-[10px] px-1 py-0 ${
                  isPinned || isFrozen ? "font-semibold tracking-wide" : ""
                }`}
                title={title}
              >
                {isFrozen ? "🧊 FROZEN" : t}
              </Badge>
            );
          })}
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
      const isTokenized = !!r.tokenized_pair_id;
      const entryTilt = r.entry_signals?.long_tilt;
      const adj = r.current_adjusted_score;
      const tip = isTokenized
        ? [
            `pm_conviction_mult: ${t.toFixed(2)}× (pair: ${r.tokenized_pair_id})`,
            "Applied after residual-vol share allocation, so it scales pair_gross",
            "directly without redistributing across other tokenized pairs.",
          ].join("\n")
        : [
            `Current resize tilt: ${t.toFixed(3)}`,
            r.side === "LONG"
              ? (entryTilt != null ? `Entry tilt: ${entryTilt.toFixed(3)}` : "Entry tilt: — (stale)")
              : null,
            adj != null ? `adj_score: ${adj >= 0 ? "+" : ""}${adj.toFixed(3)}` : null,
            "weight ∝ tilt / residual_vol^0.5",
          ].filter(Boolean).join("\n");
      return (
        <span className={`font-mono text-[11px] ${color}`} title={tip}>
          {t.toFixed(2)}×
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
      // Basis-sleeve spot legs have no funding but cost USDT borrow — show it.
      if ((r as any).is_basis_spot) {
        const b = (r as any).usdt_borrow_ann_pct;
        return b ? (
          <span className="font-mono text-[11px] text-red-400" title="USDT borrow cost on the spot leg (financing)">
            -{b.toFixed(1)}% borrow
          </span>
        ) : <span className="text-gray-700">—</span>;
      }
      const ann = (r as any).funding_rate_ann;
      if (ann == null || ann === 0) return <span className="text-gray-700">—</span>;
      // For shorts, positive funding = we receive; for longs, positive = we pay
      const effective = r.side === "SHORT" ? ann : -ann;
      const color = effective > 0 ? "text-green-400" : effective < -10 ? "text-red-400" : "text-amber-400";
      const ivl = (r as any).funding_interval_h;
      const ivlNote = ivl && ivl !== 8 ? ` [${ivl}h settle]` : "";
      return (
        <span className={`font-mono text-[11px] ${color}`} title={`${ann > 0 ? "+" : ""}${ann.toFixed(1)}% ann. (${r.side === "SHORT" ? "receiving" : "paying"})${ivlNote}`}>
          {effective > 0 ? "+" : ""}{effective.toFixed(1)}%
        </span>
      );
    },
    // Sort by *effective* funding (sign-adjusted by side) so the order
    // matches the displayed value: positive = we receive, negative = we pay.
    sortKey: (r) => {
      const ann = (r as any).funding_rate_ann ?? 0;
      return r.side === "SHORT" ? ann : -ann;
    },
    align: "right",
  },
  {
    // Funding $ accrued on the CURRENT open trade (since this position's entry).
    // Sign: positive = we received funding, negative = we paid.
    key: "funding_paid",
    header: "Fund $ (trade)",
    render: (r) => {
      const v = (r as any).funding_paid;
      if (v == null || v === 0) return <span className="text-gray-700">—</span>;
      return <PnlText value={v} title="Funding accrued on the current open trade (since entry)" />;
    },
    sortKey: (r) => (r as any).funding_paid ?? 0,
    align: "right",
  },
  {
    // Funding $ accrued on this symbol across ALL trades since strategy inception.
    key: "funding_paid_all_time",
    header: "Fund $ (all)",
    render: (r) => {
      const v = (r as any).funding_paid_all_time;
      if (v == null || v === 0) return <span className="text-gray-700">—</span>;
      return <PnlText value={v} title="Total funding on this symbol across all trades since inception" />;
    },
    sortKey: (r) => (r as any).funding_paid_all_time ?? 0,
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
  {
    key: "fdv_mcap_ratio",
    header: "FDV/MC",
    render: (r) => {
      const v = r.fdv_mcap_ratio;
      if (v == null) return <span className="text-gray-600">—</span>;
      const color = v >= 3.0 ? "text-red-400" : v >= 1.5 ? "text-yellow-400" : "text-emerald-400";
      return <span className={color} title={`FDV/Market Cap: ${v.toFixed(2)}x`}>{v.toFixed(2)}x</span>;
    },
    sortKey: (r) => r.fdv_mcap_ratio ?? 0,
    align: "right",
  },
];

interface FundingEarned {
  today: number; d7: number; d30: number; all_time: number;
  since_anchor: number | null; anchor_ts: string | null;
  segments?: {
    core_realized: number; sleeve_funding: number;
    sleeve_borrow: number; sleeve_realized_net: number;
  } | null;
}

interface FundingEvent {
  ts: string; binance_ts: number; type: "funding" | "borrow";
  symbol: string; amount: number; cumulative_net: number;
}
interface FundingEventsResp {
  anchor_ts: string | null; since: string; events: FundingEvent[];
  summary: { funding_total: number; borrow_total: number; net_total: number; n_funding: number; n_borrow: number };
}

function FundingSummary({
  positions, risk, earned, series, events, carry, sleeve,
}: {
  positions: Position[];
  risk: RiskData | undefined;
  earned: FundingEarned | undefined;
  series: { series: { date: string; funding: number }[]; anchor_ts: string | null } | undefined;
  events: FundingEventsResp | undefined;
  carry: { positions?: { symbol: string; carry_ann: number | null; funding_30d_ann: number | null; funding_7d_ann: number | null }[]; summary?: { net_carry_usd_yr?: number; net_carry_pct_notional?: number } } | undefined;
  sleeve: { summary?: { net_carry_ann_usd?: number; net_carry_ann_pct_nav?: number; net_carry_ann_pct_gross?: number; gross_usd?: number } } | undefined;
}) {
  // Sign convention: SHORT positive funding = we RECEIVE (good); LONG positive = we PAY.
  // Rate basis: prefer TRAILING REALIZED settled funding (30d, else 7d) over the
  // instantaneous premiumIndex tick — actual settlements, not a spike-prone live
  // estimate. carryBySym carries the durable rate per name from /funding-carry.
  const carryBySym = new Map<string, number>();
  for (const r of carry?.positions ?? []) {
    const rate = r.carry_ann ?? r.funding_30d_ann ?? r.funding_7d_ann;
    if (rate != null) carryBySym.set(r.symbol, rate);
  }
  const rateOf = (p: Position): number | null => {
    const tr = carryBySym.get((p as any).symbol);
    if (tr != null) return tr;
    const live = (p as any).funding_rate_ann;
    return live != null ? live : null;
  };
  const withFunding = positions.filter(
    (p) => rateOf(p) != null && p.notional > 0
  );
  const nTrailing = withFunding.filter((p) => carryBySym.has((p as any).symbol)).length;
  const [chartMode, setChartMode] = useState<"events" | "daily">("events");
  if (withFunding.length === 0) return null;
  const totalNotional = withFunding.reduce((a, p) => a + p.notional, 0);
  const longs = withFunding.filter((p) => p.side === "LONG");
  const shorts = withFunding.filter((p) => p.side === "SHORT");
  const longNotional = longs.reduce((a, p) => a + p.notional, 0);
  const shortNotional = shorts.reduce((a, p) => a + p.notional, 0);
  const sideSign = (side: string) => (side === "SHORT" ? 1 : -1);
  const weightedAnn =
    withFunding.reduce((a, p) => a + (rateOf(p) as number) * sideSign(p.side) * p.notional, 0) /
    totalNotional;
  const avgAnnLong = longNotional > 0
    ? longs.reduce((a, p) => a + (rateOf(p) as number) * p.notional, 0) / longNotional : 0;
  const avgAnnShort = shortNotional > 0
    ? shorts.reduce((a, p) => a + (rateOf(p) as number) * p.notional, 0) / shortNotional : 0;
  const dailyUsd = withFunding.reduce(
    (a, p) => a + ((rateOf(p) as number) / 100 / 365) * p.notional * sideSign(p.side), 0);
  const dailyLong = longs.reduce((a, p) => a + ((rateOf(p) as number) / 100 / 365) * p.notional * -1, 0);
  const dailyShort = shorts.reduce((a, p) => a + ((rateOf(p) as number) / 100 / 365) * p.notional * 1, 0);
  const t = (v: number, eps = 1) => Math.abs(v) < eps ? "text-gray-300" : v > 0 ? "text-green-400" : "text-red-400";
  const nav = (risk as any)?.nav ?? 0;
  const annUsd = dailyUsd * 365;
  const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  const usd = (v: number) => `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`;
  // Compact dollars: $27.5k / $1.2M for large figures, plain $ below 1k.
  const usdK = (v: number) => {
    const a = Math.abs(v), s = v >= 0 ? "+" : "-";
    if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `${s}$${(a / 1_000).toFixed(1)}k`;
    return `${s}$${a.toFixed(0)}`;
  };
  // Since-pivot (anchor) go-forward tracking — the scorecard for the carry pivot.
  const anchor = earned?.anchor_ts || series?.anchor_ts || null;
  const sincePivot = earned?.since_anchor ?? 0;
  const pivotDays = anchor ? Math.max((Date.now() - new Date(anchor).getTime()) / 86400000, 0) : 0;
  // Realized daily average from actual settlements since the pivot. Guard only
  // against a near-zero denominator (first hour) to avoid a wild extrapolation.
  const pivotDailyAvg = pivotDays > 0.04 ? sincePivot / pivotDays : 0;
  const pivotAnnPace = pivotDailyAvg * 365;
  const anchorDate = anchor ? anchor.slice(0, 10) : null;
  const cumChart: { d: string; cum: number }[] = [];
  {
    let cum = 0;
    for (const pt of series?.series ?? []) {
      if (anchorDate && pt.date < anchorDate) continue;
      cum += pt.funding;
      cumChart.push({ d: pt.date.slice(5), cum: +cum.toFixed(2) });
    }
  }
  // Granular per-payment series: every funding settlement + USDT borrow charge,
  // with cumulative_net pre-summed server-side. Markers split by type.
  const evAll = (events?.events ?? []).map((e) => ({ ...e, absAmount: Math.abs(e.amount) }));
  const fundingPts = evAll.filter((e) => e.type === "funding");
  const borrowPts = evAll.filter((e) => e.type === "borrow");
  const haveEvents = evAll.length > 1;
  const evSum = events?.summary;
  return (
    <Card>
      <CardHeader><CardTitle>Funding Summary</CardTitle></CardHeader>

      {/* SINCE PIVOT — go-forward scorecard for the carry pivot (history de-emphasized below) */}
      <div className="text-[10px] text-gray-500 uppercase mb-1">
        Since pivot to carry{anchorDate ? ` (${anchorDate})` : ""}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Earned since pivot</div>
          <div className={`text-xl font-mono font-bold ${t(sincePivot, 0.01)}`}>{usd(sincePivot)}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">{pivotDays.toFixed(1)}d elapsed</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Daily avg (realized)</div>
          <div className={`text-lg font-mono font-semibold ${t(pivotDailyAvg, 0.01)}`}>{usd(pivotDailyAvg)}/d</div>
          <div className="text-[10px] text-gray-600 mt-0.5">since pivot</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Annualized pace</div>
          <div className={`text-lg font-mono font-semibold ${t(pivotAnnPace, 1)}`}>{usdK(pivotAnnPace)}/yr</div>
          <div className="text-[10px] text-gray-600 mt-0.5">{nav > 0 ? fmt(pivotAnnPace / nav * 100) : "—"} of NAV</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Today (realized)</div>
          <div className={`text-lg font-mono font-semibold ${t(earned?.today ?? 0, 0.01)}`}>{usd(earned?.today ?? 0)}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">since 00:00 UTC</div>
        </div>
      </div>
      {/* Cumulative carry chart — per-payment (granular) or daily, toggleable */}
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[10px] text-gray-500 uppercase">
          Cumulative carry — {chartMode === "events" ? "every payment" : "daily"}
        </div>
        <div className="ml-auto flex rounded border border-[var(--border)] overflow-hidden text-[10px]">
          {(["events", "daily"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setChartMode(m)}
              className={`px-2 py-0.5 ${chartMode === m ? "bg-[var(--bg-secondary)] text-gray-200" : "text-gray-500"}`}
            >
              {m === "events" ? "Per-payment" : "Daily"}
            </button>
          ))}
        </div>
      </div>
      {chartMode === "events" && haveEvents ? (
        <div className="h-44 mb-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={evAll} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis
                dataKey="binance_ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "#64748b", fontSize: 9 }}
                minTickGap={45}
                tickFormatter={(v: number) =>
                  new Date(v).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit" })}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <ZAxis dataKey="absAmount" range={[18, 140]} />
              <Tooltip
                contentStyle={{ background: "#111118", border: "1px solid #1e1e2e", fontSize: 11 }}
                labelFormatter={(v: any) => new Date(v as number).toUTCString().slice(5, 22) + " UTC"}
                formatter={(val: any, name: any, p: any) => {
                  const e = p?.payload;
                  if (name === "Cumulative net") return [`$${Number(val).toFixed(2)}`, "Cumulative net"];
                  const sign = e?.amount >= 0 ? "+" : "";
                  return [`${sign}$${Number(e?.amount).toFixed(4)} · ${e?.symbol}`,
                    e?.type === "borrow" ? "USDT borrow" : "Funding settle"];
                }}
              />
              <ReferenceLine y={0} stroke="#334155" />
              <Line type="stepAfter" dataKey="cumulative_net" name="Cumulative net" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Scatter data={fundingPts} dataKey="cumulative_net" name="Funding" fill="#22c55e" isAnimationActive={false} />
              <Scatter data={borrowPts} dataKey="cumulative_net" name="USDT borrow" fill="#ef4444" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : chartMode === "daily" && cumChart.length > 1 ? (
        <div className="h-40 mb-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="d" tick={{ fill: "#64748b", fontSize: 9 }} minTickGap={30} />
              <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
              <Tooltip contentStyle={{ background: "#111118", border: "1px solid #1e1e2e", fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#334155" />
              <Area type="monotone" dataKey="cum" name="Cumulative funding $" stroke="#22c55e" fill="#22c55e22" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-[10px] text-gray-600 mb-3">
          {chartMode === "events"
            ? "Per-payment chart populates as settlements accrue since the pivot."
            : "Cumulative chart populates as settlements accrue since the pivot."}
        </div>
      )}
      {chartMode === "events" && haveEvents && evSum && (
        <div className="flex gap-3 text-[10px] text-gray-500 mb-3">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
            {evSum.n_funding} funding · +${evSum.funding_total.toFixed(2)}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
            {evSum.n_borrow} borrow · ${evSum.borrow_total.toFixed(2)}</span>
          <span className="ml-auto text-gray-400">net ${evSum.net_total.toFixed(2)}</span>
        </div>
      )}

      {/* Current run-rate */}
      <div className="text-[10px] text-gray-500 uppercase mb-1">Current run-rate</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Net Ann % (weighted)</div>
          <div className={`text-lg font-mono font-semibold ${t(weightedAnn)}`}>{fmt(weightedAnn)}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">net of side sign</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Daily $</div>
          <div className={`text-lg font-mono font-semibold ${t(dailyUsd)}`}>{usd(dailyUsd)}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">{dailyUsd >= 0 ? "we receive" : "we pay"}</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Long side</div>
          <div className={`text-sm font-mono ${dailyLong >= 0 ? "text-green-400" : "text-red-400"}`}>{usd(dailyLong)}/d</div>
          <div className="text-[10px] text-gray-600 mt-0.5">pays {avgAnnLong.toFixed(1)}% ann avg</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Short side</div>
          <div className={`text-sm font-mono ${dailyShort >= 0 ? "text-green-400" : "text-red-400"}`}>{usd(dailyShort)}/d</div>
          <div className="text-[10px] text-gray-600 mt-0.5">receives {avgAnnShort.toFixed(1)}% ann avg</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-gray-500">
        <div>Daily: <span className="font-mono text-gray-300">{fmt(nav > 0 ? (dailyUsd / nav) * 100 : 0)}</span> of NAV · <span className="font-mono text-gray-300">{fmt(totalNotional > 0 ? (dailyUsd / totalNotional) * 100 : 0)}</span> of gross</div>
        <div>Annualized: <span className="font-mono text-gray-300">{fmt(nav > 0 ? (annUsd / nav) * 100 : 0)}</span> of NAV · <span className="font-mono text-gray-300">{fmt(totalNotional > 0 ? (annUsd / totalNotional) * 100 : 0)}</span> of gross</div>
      </div>
      {(() => {
        const coreYr = carry?.summary?.net_carry_usd_yr;
        const coreGross = carry?.summary?.net_carry_pct_notional;
        const slvYr = sleeve?.summary?.net_carry_ann_usd;
        const slvNav = sleeve?.summary?.net_carry_ann_pct_nav;
        const slvGross = sleeve?.summary?.net_carry_ann_pct_gross;
        if (coreYr == null && slvYr == null) return null;
        const coreNav = coreYr != null && nav > 0 ? (coreYr / nav) * 100 : null;
        const totYr = (coreYr ?? 0) + (slvYr ?? 0);
        const totNav = (coreNav ?? 0) + (slvNav ?? 0);
        const seg = earned?.segments;
        const coreReal = seg?.core_realized;
        const slvReal = seg?.sleeve_realized_net;
        const totReal = seg ? (coreReal ?? 0) + (slvReal ?? 0) : null;
        const cell = (v: number | null | undefined, f: (n: number) => string) =>
          v == null ? <span className="text-gray-600">—</span> : <span className={`font-mono ${t(v, 0.01)}`}>{f(v)}</span>;
        return (
          <div className="mt-3">
            <div className="text-[10px] text-gray-500 uppercase mb-1">Carry by segment — Core strategy vs Basis sleeve</div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase border-b border-[var(--border)]">
                  <th className="text-left py-1 px-2">Segment</th>
                  <th className="text-right py-1 px-2">Realized<br/>since pivot</th>
                  <th className="text-right py-1 px-2">Ann $/yr</th>
                  <th className="text-right py-1 px-2">% of NAV</th>
                  <th className="text-right py-1 px-2">% of gross</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border)]/40">
                  <td className="py-1 px-2 text-gray-300">Core strategy <span className="text-gray-600">(L/S book)</span></td>
                  <td className="py-1 px-2 text-right">{cell(coreReal, usd)}</td>
                  <td className="py-1 px-2 text-right">{cell(coreYr, usdK)}</td>
                  <td className="py-1 px-2 text-right">{cell(coreNav, fmt)}</td>
                  <td className="py-1 px-2 text-right">{cell(coreGross, fmt)}</td>
                </tr>
                <tr className="border-b border-[var(--border)]/40">
                  <td className="py-1 px-2 text-gray-300">Basis sleeve <span className="text-gray-600">(delta-neutral)</span></td>
                  <td className="py-1 px-2 text-right">{cell(slvReal, usd)}</td>
                  <td className="py-1 px-2 text-right">{cell(slvYr, usdK)}</td>
                  <td className="py-1 px-2 text-right">{cell(slvNav, fmt)}</td>
                  <td className="py-1 px-2 text-right">{cell(slvGross, fmt)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-1 px-2 text-gray-200">Total</td>
                  <td className="py-1 px-2 text-right">{cell(totReal, usd)}</td>
                  <td className="py-1 px-2 text-right">{cell(totYr, usdK)}</td>
                  <td className="py-1 px-2 text-right">{cell(totNav, fmt)}</td>
                  <td className="py-1 px-2 text-right text-gray-600">—</td>
                </tr>
              </tbody>
            </table>
            <div className="text-[10px] text-gray-600 mt-1">All net of funding − borrow. Realized = actual settlements since the pivot; Ann $/yr = forward run-rate (core on trailing carry ex-sleeve/ex-frozen, sleeve = funding − USDT borrow). % of gross is each segment vs its own notional.</div>
          </div>
        );
      })()}
      {earned && (
        <div className="mt-2 text-[10px] text-gray-600 opacity-70">
          Pre-pivot context (not the focus): 7d <span className="font-mono">{usd(earned.d7)}</span> · 30d <span className="font-mono">{usd(earned.d30)}</span> · inception <span className="font-mono">{usd(earned.all_time)}</span>
        </div>
      )}
      <div className="mt-1 text-[10px] text-gray-600">
        Run-rate = {nTrailing}/{withFunding.length} names on TRAILING REALIZED funding (30d/7d settled, actual), rest on live tick; annualized as a forward projection. Realized = actual settlements received/paid (sign: short receipt +, long payment −).
      </div>
    </Card>
  );
}

export function PositionsTab() {
  const { client, engine } = useEngine();
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["positions", engine.id],
    queryFn: () =>
      client.get<{ positions: Position[]; count: number; beta?: BetaAggregate }>("/api/positions"),
    refetchInterval: 30_000,
  });

  const { data: risk } = useQuery<RiskData>({
    queryKey: ["risk", engine.id],
    queryFn: () => client.get("/api/risk"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: pnlHistory } = useQuery<{ series: BasketPnlPoint[]; count: number; days: number }>({
    queryKey: ["basket-pnl-history", engine.id],
    queryFn: () => client.get("/api/basket-pnl/history", { days: 90 }),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const { data: fundingEarned } = useQuery<{
    today: number; d7: number; d30: number; all_time: number;
    since_anchor: number | null; anchor_ts: string | null;
    segments?: { core_realized: number; sleeve_funding: number; sleeve_borrow: number; sleeve_realized_net: number } | null;
  }>({
    queryKey: ["funding-earned", engine.id],
    queryFn: () => client.get("/api/funding-earned"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: fundingSeries } = useQuery<{
    series: { date: string; funding: number }[]; anchor_ts: string | null;
  }>({
    queryKey: ["funding-earned-series", engine.id],
    queryFn: () => client.get("/api/funding-earned/series", { days: 90 }),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const { data: fundingEvents } = useQuery<FundingEventsResp>({
    queryKey: ["funding-earned-events", engine.id],
    queryFn: () => client.get("/api/funding-earned/events", { days: 30 }),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  // Per-name trailing realized funding (durable signal) for the run-rate basis.
  const { data: fundingCarry } = useQuery<{
    positions?: { symbol: string; carry_ann: number | null; funding_30d_ann: number | null; funding_7d_ann: number | null }[];
    summary?: { net_carry_usd_yr?: number; net_carry_pct_notional?: number };
  }>({
    queryKey: ["funding-carry-latest", engine.id],
    queryFn: () => client.get("/api/funding-carry/latest"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Basis sleeve net-carry (for the Core vs Sleeve comparison).
  const { data: basisSleeve } = useQuery<{
    summary?: {
      net_carry_ann_usd?: number; net_carry_ann_pct_nav?: number;
      net_carry_ann_pct_gross?: number; gross_usd?: number;
    };
  }>({
    queryKey: ["basis-sleeve-fs", engine.id],
    queryFn: () => client.get("/api/basis-sleeve"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading positions...
      </div>
    );
  }

  // Basis-sleeve spot legs are now injected server-side into /api/positions
  // (tagged "BASIS SPOT"), so no client-side merge needed.
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
      {/* Funding Summary — moved to front; since-pivot tracking + run-rate */}
      <FundingSummary positions={positions} risk={risk} earned={fundingEarned} series={fundingSeries} events={fundingEvents} carry={fundingCarry} sleeve={basisSleeve} />

      {/* Basis sleeve (funding carry) — renders only when configured */}
      <BasisSleeveSection />

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

      {/* Long vs Short unrealized P&L over time */}
      {pnlHistory && pnlHistory.series.length > 1 && (
        <Card>
          <BasketPnlChart series={pnlHistory.series} />
          <div className="mt-2 text-[10px] text-gray-600">
            Green = longs unrealized P&L, red = shorts unrealized P&L (signed, losses negative). Blue dashed = spread (L + S). Spread widening (blue rising) = longs outperforming shorts; spread narrowing/falling = shorts outperforming longs. Granularity auto-adjusts to the selected period (15m for 1D, hourly for 1W, 4h for 1M, daily for ALL).
          </div>
        </Card>
      )}

      {/* Exposure & Beta Hedging — 3 denominator views (Gross / Notional [Nickel] / NAV) */}
      {beta && <ExposurePanel positions={positions} beta={beta} risk={risk} />}


      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Positions ({positions.length})</CardTitle>
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
