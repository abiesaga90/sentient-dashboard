import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortfolioConstruction } from "../../hooks/useDashboardQuery";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import type { Column } from "../shared/DataTable";
import { formatUSD, formatPct } from "../../lib/utils";

// ── Types ──

interface LongToken {
  symbol: string;
  side?: string;
  va_profile?: string;
  sector?: string;
  token_type?: string;
  va_score: number;
  sm_score: number;
  p3_score: number;
  raw_score: number;
  confidence: number;
  adjusted_score: number;
  n_va: number;
  n_sm: number;
  n_p3: number;
  sm_weight: number;
  p3_weight: number;
  tilt_pre_alpha: number;
  tilt: number;
  annualized_vol: number;
  residual_vol?: number;      // vol after regressing on short basket (residual-vol sizing)
  vol_saved_pct?: number;     // 1 - residual/standalone, in percent
  sizing_vol_used?: string;   // "residual" | "standalone" — which vol the weight used
  weight_pct: number;
  beta: number;
  alpha_roi: number;
  alpha_pct?: number | null;
  target_notional: number;
  current_notional: number;
  drift_pct: number;
  mindshare_mult?: number;
  sentiment_score?: number | null;
  cg_trending_attention?: number | null;
  raw_weight: number;
}

interface ShortToken {
  symbol: string;
  side?: string;
  va_profile?: string;
  sector?: string;
  token_type?: string;
  va_score: number;
  sm_score: number;
  p3_score: number;
  raw_score: number;
  confidence: number;
  adjusted_score: number;
  n_va: number;
  n_sm: number;
  n_p3: number;
  sm_weight: number;
  p3_weight: number;
  tilt_pre_alpha: number;
  tilt: number;
  score: number;
  beta: number;
  correlation: number;
  hedge_weight: number;
  weight_pct: number;
  alpha_roi: number;
  alpha_pct?: number | null;
  target_notional: number;
  current_notional: number;
  drift_pct: number;
  mindshare_mult?: number;
  sentiment_score?: number | null;
  cg_trending_attention?: number | null;
  mcap_rank?: number | null;
  rank_source?: string;
  raw_weight?: number;
  annualized_vol?: number;
}

// ── Profile labels & colors ──

const PROFILE_LABELS: Record<string, string> = {
  l1_platform: "L1",
  l1: "L1",
  defi: "DeFi",
  ai_compute: "AI",
  ai: "AI",
  pow_monetary: "PoW",
  privacy: "PoW",
  l2: "L2",
  meme: "Meme",
  infra: "Infra",
  gaming: "Gaming",
  oracle: "Oracle",
  social: "Social",
  storage: "Storage",
  _default: "Other",
};

const PROFILE_COLORS: Record<string, string> = {
  l1_platform: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  l1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  defi: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ai_compute: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  ai: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pow_monetary: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  privacy: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  l2: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  meme: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  infra: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  gaming: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  oracle: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  social: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  storage: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  _default: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function ProfileBadge({ profile }: { profile?: string }) {
  const key = profile || "_default";
  const label = PROFILE_LABELS[key] || key;
  const color = PROFILE_COLORS[key] || PROFILE_COLORS._default;
  return (
    <span className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded border ${color}`}>
      {label}
    </span>
  );
}

const TOKEN_TYPE_LABELS: Record<string, string> = {
  gas: "Gas",
  governance: "Gov",
  utility: "Utility",
  store_of_value: "SoV",
  meme: "Meme",
};
const TOKEN_TYPE_COLORS: Record<string, string> = {
  gas: "text-blue-400/60 border-blue-500/20",
  governance: "text-yellow-400/60 border-yellow-500/20",
  utility: "text-green-400/60 border-green-500/20",
  store_of_value: "text-amber-400/60 border-amber-500/20",
  meme: "text-pink-400/60 border-pink-500/20",
};
function TokenTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const label = TOKEN_TYPE_LABELS[type] || type;
  const color = TOKEN_TYPE_COLORS[type] || "text-gray-400/60 border-gray-500/20";
  return (
    <span className={`inline-block text-[8px] font-medium px-1 py-0 rounded border ${color}`}>
      {label}
    </span>
  );
}

// ── Sector Breakdown Summary ──

function SectorBreakdown({ tokens }: { tokens: { va_profile?: string; sector?: string; weight_pct: number; target_notional: number }[] }) {
  const groups: Record<string, { count: number; weight: number; notional: number }> = {};
  for (const t of tokens) {
    const key = (t as { sector?: string }).sector || t.va_profile || "_default";
    if (!groups[key]) groups[key] = { count: 0, weight: 0, notional: 0 };
    groups[key].count += 1;
    groups[key].weight += t.weight_pct;
    groups[key].notional += t.target_notional;
  }
  const sorted = Object.entries(groups).sort((a, b) => b[1].weight - a[1].weight);
  if (sorted.length === 0) return null;

  return (
    <div className="flex gap-3 flex-wrap mb-2">
      {sorted.map(([key, g]) => (
        <div key={key} className="flex items-center gap-1.5 text-[11px]">
          <ProfileBadge profile={key} />
          <span className="text-gray-400">
            {g.count} tokens / {g.weight.toFixed(1)}% / {formatUSD(g.notional)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Budget Waterfall ──

function BudgetWaterfall({ budget }: { budget: any }) {
  const sizingBase = budget.notional_capital || budget.nav;
  const steps = [
    { label: "Notional", value: sizingBase, mult: null },
    { label: "Leverage", value: null, mult: `\u00d7${budget.max_leverage}` },
    { label: "DD Scale", value: null, mult: `\u00d7${budget.dd_scale.toFixed(3)}` },
    { label: "Vol Scale", value: null, mult: `\u00d7${budget.vol_scale.toFixed(3)}` },
    { label: "Recovery", value: null, mult: `\u00d7${budget.recovery_scale.toFixed(3)}` },
    { label: "Gross Target", value: budget.gross_target, mult: null },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Waterfall</CardTitle>
      </CardHeader>
      <div className="p-4 pt-0">
        {/* Waterfall chain */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-600">{"\u2192"}</span>}
              <div className="bg-gray-800/50 rounded px-3 py-1.5 text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
                <div className="text-sm font-medium text-gray-200">
                  {s.value != null ? formatUSD(s.value) : s.mult}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Budget split */}
        <div className="grid grid-cols-4 gap-3">
          <KpiBox label="Long Budget" value={formatUSD(budget.long_budget)} />
          <KpiBox label="Short Budget" value={formatUSD(budget.short_budget)} />
          <KpiBox label="Net Exposure" value={formatPct(budget.net_exposure_pct)} color={Math.abs(budget.net_exposure_pct) > 20 ? "amber" : "green"} />
          <KpiBox label="Effective Scale" value={budget.effective_scale.toFixed(3)} />
        </div>

        {/* Beta info */}
        <div className="mt-3 flex gap-6 text-[11px] text-gray-500">
          <span>Avg Long {"\u03b2"}: {budget.avg_long_beta.toFixed(3)}</span>
          <span>Avg Short {"\u03b2"}: {budget.avg_short_beta.toFixed(3)}</span>
          <span>Beta Tilt: {budget.target_beta_tilt_pct}%</span>
          {budget.net_cap_binding && (
            <span className="text-amber-400 font-medium">Net cap binding</span>
          )}
        </div>
      </div>
    </Card>
  );
}

function KpiBox({ label, value, color }: { label: string; value: string; color?: string }) {
  const textColor = color === "amber" ? "text-amber-400" : color === "red" ? "text-red-400" : "text-gray-200";
  return (
    <div className="bg-gray-800/30 rounded px-3 py-2 text-center">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-semibold ${textColor}`}>{value}</div>
    </div>
  );
}

// ── Constraints Panel ──

function ConstraintsPanel({ constraints }: { constraints: any }) {
  const items = [
    { label: "Drawdown", current: constraints.dd_pct, limit: constraints.dd_stop_pct, unit: "%" },
    { label: "Gross Exposure", current: constraints.gross_pct, limit: constraints.gross_cap_pct, unit: "%" },
    { label: "Net Exposure", current: Math.abs(constraints.net_pct), limit: constraints.net_cap_pct, unit: "%", signed: constraints.net_pct },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Constraints</CardTitle>
      </CardHeader>
      <div className="p-4 pt-0 grid grid-cols-3 gap-4">
        {items.map((item) => {
          const pct = (item.current / item.limit) * 100;
          const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
          return (
            <div key={item.label}>
              <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                <span>{item.label}</span>
                <span>
                  {item.signed != null ? formatPct(item.signed) : `${item.current.toFixed(1)}${item.unit}`}
                  {" / "}
                  {item.label === "Net Exposure" ? `\u00b1${item.limit}${item.unit}` : `${item.limit}${item.unit}`}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Score Cell ──

function ScoreCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-700">0</span>;
  const color = value > 0 ? "text-emerald-400" : "text-red-400";
  return <span className={`${color} text-[12px]`}>{value > 0 ? "+" : ""}{value.toFixed(3)}</span>;
}

// ── Long Side Table ──

const longColumns: Column<LongToken>[] = [
  {
    key: "symbol", header: "Symbol",
    render: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-gray-200">{r.symbol.replace("USDT", "")}</span>
        <ProfileBadge profile={r.sector || r.va_profile} />
        <TokenTypeBadge type={r.token_type} />
      </div>
    ),
    sortKey: (r) => r.symbol,
  },
  { key: "va", header: "VA", render: (r) => <ScoreCell value={r.va_score} />, sortKey: (r) => r.va_score, align: "right" },
  { key: "sm", header: "SM", render: (r) => <ScoreCell value={r.sm_score} />, sortKey: (r) => r.sm_score, align: "right" },
  { key: "p3", header: "OP", render: (r) => <ScoreCell value={r.p3_score} />, sortKey: (r) => r.p3_score, align: "right" },
  { key: "score", header: "Score", render: (r) => <ScoreCell value={r.adjusted_score} />, sortKey: (r) => r.adjusted_score, align: "right" },
  {
    key: "tilt", header: "Tilt",
    render: (r) => {
      const color = r.tilt > 1.005 ? "text-emerald-400" : r.tilt < 0.995 ? "text-red-400" : "text-gray-400";
      return <span className={`${color} text-[12px]`}>{r.tilt.toFixed(3)}</span>;
    },
    sortKey: (r) => r.tilt, align: "right",
  },
  {
    key: "ms", header: "MS",
    render: (r) => {
      const m = (r as LongToken).mindshare_mult;
      const sent = (r as LongToken).sentiment_score;
      if (!m || m === 1.0) return <span className="text-gray-700 text-[11px]">&mdash;</span>;
      const pct = ((m - 1) * 100).toFixed(0);
      return (
        <div className="text-right">
          <span className={m > 1 ? "text-green-400" : "text-red-400"} style={{fontSize: "11px"}}>
            {m > 1 ? "+" : ""}{pct}%
          </span>
          {sent != null && (
            <div className={`text-[10px] ${sent > 0.2 ? "text-green-600" : sent < -0.2 ? "text-red-600" : "text-gray-600"}`}>
              S:{sent > 0 ? "+" : ""}{sent.toFixed(2)}
            </div>
          )}
        </div>
      );
    },
    sortKey: (r) => (r as LongToken).mindshare_mult ?? 1.0, align: "right",
  },
  {
    key: "cg", header: "CG",
    render: (r) => {
      const v = (r as LongToken).cg_trending_attention;
      if (v == null) return <span className="text-gray-700 text-[11px]">&mdash;</span>;
      const color = v > 0.5 ? "text-green-400" : v >= 0.3 ? "text-yellow-400" : "text-gray-500";
      return <span className={`${color} text-[11px]`}>{(v * 100).toFixed(0)}%</span>;
    },
    sortKey: (r) => (r as LongToken).cg_trending_attention ?? 0, align: "right",
  },
  {
    key: "vol", header: "Vol",
    render: (r) => {
      const isResidualMode = r.sizing_vol_used === "residual";
      const standaloneStr = `${(r.annualized_vol * 100).toFixed(1)}%`;
      if (!isResidualMode) {
        return <span className="text-gray-400 text-[12px]">{standaloneStr}</span>;
      }
      // In residual mode, gray out the standalone and emphasize nothing — the next column shows residual
      return <span className="text-gray-600 text-[12px] line-through decoration-gray-700">{standaloneStr}</span>;
    },
    sortKey: (r) => r.annualized_vol, align: "right",
  },
  {
    key: "resid_vol", header: "Resid Vol",
    render: (r) => {
      const rv = r.residual_vol;
      if (rv == null) return <span className="text-gray-700 text-[11px]">&mdash;</span>;
      const saved = r.vol_saved_pct ?? 0;
      const isResidualMode = r.sizing_vol_used === "residual";
      // Color by how much vol was "saved" by the hedge (higher saved = more hedged = bigger concentration bonus)
      const savedColor = saved > 30 ? "text-emerald-400" : saved > 15 ? "text-emerald-500" : saved > 5 ? "text-gray-300" : "text-gray-500";
      const primaryColor = isResidualMode ? "text-gray-200 font-medium" : "text-gray-400";
      return (
        <div className="flex flex-col items-end leading-tight">
          <span className={`${primaryColor} text-[12px]`}>{(rv * 100).toFixed(1)}%</span>
          <span className={`${savedColor} text-[9px]`}>-{saved.toFixed(0)}% hedged</span>
        </div>
      );
    },
    sortKey: (r) => r.residual_vol ?? 0, align: "right",
  },
  {
    key: "beta", header: "\u03b2",
    render: (r) => <span className="text-gray-400 text-[12px]">{r.beta.toFixed(2)}</span>,
    sortKey: (r) => r.beta, align: "right",
  },
  {
    key: "weight", header: "Weight",
    render: (r) => <span className="text-gray-200 font-medium text-[12px]">{r.weight_pct.toFixed(1)}%</span>,
    sortKey: (r) => r.weight_pct, align: "right",
  },
  {
    key: "pnl", header: "PnL%",
    render: (r) => {
      const color = r.alpha_roi > 1 ? "text-emerald-400" : r.alpha_roi < -1 ? "text-red-400" : "text-gray-500";
      return <span className={`${color} text-[12px]`}>{r.alpha_roi > 0 ? "+" : ""}{r.alpha_roi.toFixed(1)}%</span>;
    },
    sortKey: (r) => r.alpha_roi, align: "right",
  },
  {
    key: "alpha", header: "Alpha",
    render: (r) => {
      const a = r.alpha_pct;
      if (a == null) return <span className="text-gray-600 text-[12px]">—</span>;
      const good = (r.side === "LONG" && a > 2) || (r.side === "SHORT" && a < -2);
      const bad = (r.side === "LONG" && a < -2) || (r.side === "SHORT" && a > 2);
      const color = good ? "text-emerald-400" : bad ? "text-red-400" : "text-gray-500";
      return <span className={`${color} text-[12px]`}>{a > 0 ? "+" : ""}{a.toFixed(1)}%</span>;
    },
    sortKey: (r) => r.alpha_pct ?? 0, align: "right",
  },
  {
    key: "target", header: "Target",
    render: (r) => <span className="text-gray-300 text-[12px]">{formatUSD(r.target_notional)}</span>,
    sortKey: (r) => r.target_notional, align: "right",
  },
  {
    key: "current", header: "Current",
    render: (r) => <span className="text-gray-400 text-[12px]">{formatUSD(r.current_notional)}</span>,
    sortKey: (r) => r.current_notional, align: "right",
  },
  {
    key: "drift", header: "Drift",
    render: (r) => {
      const color = Math.abs(r.drift_pct) > 20 ? "text-amber-400" : "text-gray-500";
      return <span className={`${color} text-[12px]`}>{formatPct(r.drift_pct, 1)}</span>;
    },
    sortKey: (r) => Math.abs(r.drift_pct), align: "right",
  },
];

// ── Short Side Table ──

const shortColumns: Column<ShortToken>[] = [
  {
    key: "symbol", header: "Symbol",
    render: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-gray-200">{r.symbol.replace("USDT", "")}</span>
        <ProfileBadge profile={r.sector || r.va_profile} />
        <TokenTypeBadge type={r.token_type} />
      </div>
    ),
    sortKey: (r) => r.symbol,
  },
  {
    key: "mcap_rank", header: "Rank",
    render: (r) => {
      const rank = r.mcap_rank;
      if (rank == null) return <span className="text-gray-600 text-[11px]">&mdash;</span>;
      const color = rank <= 100 ? "text-emerald-400" : rank <= 200 ? "text-yellow-400" : "text-red-400";
      return <span className={`${color} text-[11px]`}>#{rank}</span>;
    },
    sortKey: (r) => r.mcap_rank ?? 999, align: "right",
  },
  { key: "va", header: "VA", render: (r) => <ScoreCell value={r.va_score} />, sortKey: (r) => r.va_score, align: "right" },
  { key: "sm", header: "SM", render: (r) => <ScoreCell value={r.sm_score} />, sortKey: (r) => r.sm_score, align: "right" },
  { key: "p3", header: "OP", render: (r) => <ScoreCell value={r.p3_score} />, sortKey: (r) => r.p3_score, align: "right" },
  { key: "score", header: "Inv. Score", render: (r) => <ScoreCell value={r.score} />, sortKey: (r) => r.score, align: "right" },
  {
    key: "beta", header: "\u03b2",
    render: (r) => <span className="text-gray-400 text-[12px]">{r.beta.toFixed(2)}</span>,
    sortKey: (r) => r.beta, align: "right",
  },
  {
    key: "corr", header: "Corr",
    render: (r) => <span className="text-gray-400 text-[12px]">{r.correlation.toFixed(2)}</span>,
    sortKey: (r) => r.correlation, align: "right",
  },
  {
    key: "hedge", header: "\u03b2\u00d7Corr",
    render: (r) => <span className="text-gray-300 text-[12px]">{r.hedge_weight.toFixed(3)}</span>,
    sortKey: (r) => r.hedge_weight, align: "right",
  },
  {
    key: "ms", header: "MS",
    render: (r) => {
      const m = (r as ShortToken).mindshare_mult;
      const sent = (r as ShortToken).sentiment_score;
      if (!m || m === 1.0) return <span className="text-gray-700 text-[11px]">&mdash;</span>;
      const pct = ((m - 1) * 100).toFixed(0);
      return (
        <div className="text-right">
          <span className={m < 1 ? "text-red-400" : "text-green-400"} style={{fontSize: "11px"}}>
            {m < 1 ? "" : "+"}{pct}%
          </span>
          {sent != null && (
            <div className={`text-[10px] ${sent > 0.2 ? "text-green-600" : sent < -0.2 ? "text-red-600" : "text-gray-600"}`}>
              S:{sent > 0 ? "+" : ""}{sent.toFixed(2)}
            </div>
          )}
        </div>
      );
    },
    sortKey: (r) => (r as ShortToken).mindshare_mult ?? 1.0, align: "right",
  },
  {
    key: "cg", header: "CG",
    render: (r) => {
      const v = (r as ShortToken).cg_trending_attention;
      if (v == null) return <span className="text-gray-700 text-[11px]">&mdash;</span>;
      const color = v > 0.5 ? "text-green-400" : v >= 0.3 ? "text-yellow-400" : "text-gray-500";
      return <span className={`${color} text-[11px]`}>{(v * 100).toFixed(0)}%</span>;
    },
    sortKey: (r) => (r as ShortToken).cg_trending_attention ?? 0, align: "right",
  },
  {
    key: "weight", header: "Weight",
    render: (r) => <span className="text-gray-200 font-medium text-[12px]">{r.weight_pct.toFixed(1)}%</span>,
    sortKey: (r) => r.weight_pct, align: "right",
  },
  {
    key: "pnl", header: "PnL%",
    render: (r) => {
      const color = r.alpha_roi > 1 ? "text-emerald-400" : r.alpha_roi < -1 ? "text-red-400" : "text-gray-500";
      return <span className={`${color} text-[12px]`}>{r.alpha_roi > 0 ? "+" : ""}{r.alpha_roi.toFixed(1)}%</span>;
    },
    sortKey: (r) => r.alpha_roi, align: "right",
  },
  {
    key: "alpha", header: "Alpha",
    render: (r) => {
      const a = r.alpha_pct;
      if (a == null) return <span className="text-gray-600 text-[12px]">—</span>;
      const good = (r.side === "LONG" && a > 2) || (r.side === "SHORT" && a < -2);
      const bad = (r.side === "LONG" && a < -2) || (r.side === "SHORT" && a > 2);
      const color = good ? "text-emerald-400" : bad ? "text-red-400" : "text-gray-500";
      return <span className={`${color} text-[12px]`}>{a > 0 ? "+" : ""}{a.toFixed(1)}%</span>;
    },
    sortKey: (r) => r.alpha_pct ?? 0, align: "right",
  },
  {
    key: "target", header: "Target",
    render: (r) => <span className="text-gray-300 text-[12px]">{formatUSD(r.target_notional)}</span>,
    sortKey: (r) => r.target_notional, align: "right",
  },
  {
    key: "current", header: "Current",
    render: (r) => <span className="text-gray-400 text-[12px]">{formatUSD(r.current_notional)}</span>,
    sortKey: (r) => r.current_notional, align: "right",
  },
  {
    key: "drift", header: "Drift",
    render: (r) => {
      const color = Math.abs(r.drift_pct) > 20 ? "text-amber-400" : "text-gray-500";
      return <span className={`${color} text-[12px]`}>{formatPct(r.drift_pct, 1)}</span>;
    },
    sortKey: (r) => Math.abs(r.drift_pct), align: "right",
  },
];

// ── Tilt Waterfall (expandable per-token breakdown) ──

function TiltWaterfall({ token, side }: { token: LongToken | ShortToken; side: "LONG" | "SHORT" }) {
  const smW = token.sm_weight ?? 0.5;
  const p3W = token.p3_weight ?? 0.3;
  const smContrib = token.sm_score * smW;
  const p3Contrib = token.p3_score * p3W;
  const ms = (token as LongToken).mindshare_mult;
  const msAdj = ms != null && ms !== 1.0 ? ms : null;
  const preAlpha = token.tilt_pre_alpha ?? token.tilt;
  const alphaBoostPct = preAlpha > 0 ? ((token.tilt / preAlpha) - 1) * 100 : 0;
  const vol = (token as LongToken).annualized_vol;

  const row = (label: string, value: string, detail: string, positive?: boolean | null) => {
    const color = positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-gray-400";
    return (
      <div className="flex items-center justify-between py-0.5">
        <span className="text-gray-500 text-[11px] w-48">{label}</span>
        <span className={`${color} text-[12px] font-mono w-24 text-right`}>{value}</span>
        <span className="text-gray-600 text-[10px] w-64 text-right">{detail}</span>
      </div>
    );
  };

  const sc = (v: number) => v > 0.005 ? true : v < -0.005 ? false : null;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 mx-2 mb-2">
      <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Tilt Waterfall — {token.symbol.replace("USDT", "")}</div>
      {row("VA: Value Accrual", `${token.va_score > 0 ? "+" : ""}${token.va_score.toFixed(3)}`, `${token.n_va}/8 signals  (wt: 100%)`, sc(token.va_score))}
      {row(`SM: Smart Money ×${smW.toFixed(2)}`, `${smContrib > 0 ? "+" : ""}${smContrib.toFixed(3)}`, `${token.n_sm}/10 signals`, sc(smContrib))}
      {row(`OP Token Signal ×${p3W.toFixed(2)}`, `${p3Contrib > 0 ? "+" : ""}${p3Contrib.toFixed(3)}`, `${token.n_p3} signals`, sc(p3Contrib))}
      {(() => { const mmW = (token as any).mm_weight ?? 0.09; const mmS = (token as any).mm_score ?? 0; const mmC = mmW * mmS; return mmC !== 0 ? row(`MM Microstructure ×${mmW.toFixed(2)}`, `${mmC > 0 ? "+" : ""}${mmC.toFixed(3)}`, `${(token as any).n_mm ?? 0} signals`, sc(mmC)) : null; })()}
      <div className="border-t border-gray-800 my-1" />
      {row("Raw Score", `${token.raw_score > 0 ? "+" : ""}${token.raw_score.toFixed(4)}`, "VA×w + SM×w + OP×w + MM×w", sc(token.raw_score))}
      {row("× Confidence", `${(token.confidence * 100).toFixed(0)}%`, `${token.n_va} VA + ${smW}×${token.n_sm} SM + ${p3W}×${token.n_p3} OP`, null)}
      {row("= Adjusted Score", `${token.adjusted_score > 0 ? "+" : ""}${token.adjusted_score.toFixed(4)}`, "", sc(token.adjusted_score))}
      {msAdj != null && row("× Mindshare", `×${msAdj.toFixed(3)}`, msAdj > 1 ? "gainer boost" : "loser penalty", msAdj > 1 ? true : false)}
      {side === "LONG" && row("→ 2^score", `${preAlpha.toFixed(4)}`, `max(0.25, base^${token.adjusted_score.toFixed(3)})`, sc(preAlpha - 1))}
      {Math.abs(alphaBoostPct) > 0.1 && row("× Alpha ROI", `${alphaBoostPct > 0 ? "+" : ""}${alphaBoostPct.toFixed(1)}%`, `realized + unrealized PnL`, sc(alphaBoostPct))}
      <div className="border-t border-gray-800 my-1" />
      {row("= Final Tilt", `${token.tilt.toFixed(4)}×`, "", sc(token.tilt - 1))}
      {side === "LONG" && vol != null && vol > 0 && (() => {
        const longTok = token as LongToken;
        const residVol = longTok.residual_vol;
        const isResidMode = longTok.sizing_vol_used === "residual";
        if (isResidMode && residVol != null && residVol > 0) {
          const saved = longTok.vol_saved_pct ?? 0;
          return row(
            `÷ Residual Vol (${(residVol * 100).toFixed(1)}% ann)`,
            `→ raw wt ${(token.raw_weight ?? 0).toFixed(3)}`,
            `standalone ${(vol * 100).toFixed(1)}% → -${saved.toFixed(0)}% hedged by shorts`,
            null,
          );
        }
        return row(`÷ Vol (${(vol * 100).toFixed(1)}% ann)`, `→ raw wt ${(token.raw_weight ?? 0).toFixed(3)}`, "", null);
      })()}
      {row("Normalized", `→ ${token.weight_pct.toFixed(1)}%`, side === "LONG" ? "of long budget" : "of short budget", null)}
    </div>
  );
}

// ── Expandable Table (DataTable with click-to-expand waterfall) ──

function ExpandableTable<T extends { symbol: string }>({
  columns,
  data,
  expandedSymbol,
  onToggle,
  renderExpanded,
  defaultSort,
  defaultDir = "desc",
}: {
  columns: Column<T>[];
  data: T[];
  expandedSymbol: string | null;
  onToggle: (sym: string) => void;
  renderExpanded: (row: T) => React.ReactNode;
  defaultSort?: string;
  defaultDir?: "asc" | "desc";
}) {
  const [sortCol, setSortCol] = useState(defaultSort || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultDir);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortCol);
    if (!col?.sortKey) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const va = col.sortKey!(a);
      const vb = col.sortKey!(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [data, sortCol, sortDir, columns]);

  function handleSort(key: string) {
    if (sortCol === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(key); setSortDir("asc"); }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800">
          {columns.map((col) => (
            <th
              key={col.key}
              className={`py-1.5 px-2 text-[11px] text-gray-500 font-medium cursor-pointer select-none ${col.align === "right" ? "text-right" : "text-left"}`}
              onClick={() => col.sortKey && handleSort(col.key)}
            >
              {col.header}
              {sortCol === col.key && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <Fragment key={row.symbol}>
            <tr
              className={`border-b border-gray-800/50 cursor-pointer transition-colors ${expandedSymbol === row.symbol ? "bg-gray-800/30" : "hover:bg-gray-800/20"}`}
              onClick={() => onToggle(row.symbol)}
            >
              {columns.map((col) => (
                <td key={col.key} className={`py-1.5 px-2 ${col.align === "right" ? "text-right" : ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
            {expandedSymbol === row.symbol && (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {renderExpanded(row)}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

// ── Tilt Health Summary ──

function TiltHealthSummary({ longs, shorts }: { longs: LongToken[]; shorts: ShortToken[] }) {
  const stat = (tokens: (LongToken | ShortToken)[]) => {
    if (!tokens.length) return null;
    const tilts = tokens.map(t => t.tilt);
    const confs = tokens.map(t => t.confidence ?? 1);
    const min = Math.min(...tilts);
    const max = Math.max(...tilts);
    const avg = tilts.reduce((a, b) => a + b, 0) / tilts.length;
    const avgConf = confs.reduce((a, b) => a + b, 0) / confs.length;
    const minSym = tokens[tilts.indexOf(min)]?.symbol.replace("USDT", "");
    const maxSym = tokens[tilts.indexOf(max)]?.symbol.replace("USDT", "");
    const scored = tokens.filter(t => (t.n_va ?? 0) > 0).length;
    return { min, max, avg, avgConf, minSym, maxSym, scored, total: tokens.length };
  };

  const ls = stat(longs);
  const ss = stat(shorts);
  if (!ls && !ss) return null;

  const line = (label: string, s: NonNullable<ReturnType<typeof stat>>) => (
    <div className="flex items-center gap-4 text-[11px]">
      <span className="text-gray-500 w-12 font-medium">{label}</span>
      <span className="text-gray-400">
        min <span className="text-red-400 font-medium">{s.min.toFixed(2)}×</span> ({s.minSym})
        → max <span className="text-emerald-400 font-medium">{s.max.toFixed(2)}×</span> ({s.maxSym})
      </span>
      <span className="text-gray-600">|</span>
      <span className="text-gray-400">avg <span className="text-gray-200 font-medium">{s.avg.toFixed(2)}×</span></span>
      <span className="text-gray-600">|</span>
      <span className="text-gray-400">{s.scored}/{s.total} scored</span>
      <span className="text-gray-600">|</span>
      <span className="text-gray-400">avg conf <span className="text-gray-200 font-medium">{(s.avgConf * 100).toFixed(0)}%</span></span>
    </div>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Alpha Tilt Health</CardTitle></CardHeader>
      <div className="px-4 pb-3 space-y-1">
        {ls && line("Longs", ls)}
        {ss && line("Shorts", ss)}
      </div>
    </Card>
  );
}

// ── Residual Vol Explainer (shown when signal_proportional_residual mode is active) ──

type ResidSortKey = "hedged" | "standalone" | "residual" | "target" | "weight";

function ResidualVolExplainer({ longs, sizingMode }: { longs: LongToken[]; sizingMode: string }) {
  const [sortKey, setSortKey] = useState<ResidSortKey>("hedged");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (sizingMode !== "signal_proportional_residual") return null;

  const withResid = longs.filter(l => l.residual_vol != null && l.annualized_vol > 0);
  const avgSaved = withResid.length > 0
    ? withResid.reduce((acc, l) => acc + (l.vol_saved_pct ?? 0), 0) / withResid.length
    : 0;
  const maxSavedToken = withResid.reduce<LongToken | null>(
    (best, l) => (best == null || (l.vol_saved_pct ?? 0) > (best.vol_saved_pct ?? 0)) ? l : best,
    null,
  );
  const minSavedToken = withResid.reduce<LongToken | null>(
    (worst, l) => (worst == null || (l.vol_saved_pct ?? 0) < (worst.vol_saved_pct ?? 0)) ? l : worst,
    null,
  );

  // Implied weight uplift from residual sizing: (standalone_vol/residual_vol)^0.5 − 1
  // Represents "how much bigger did this name get because residual sizing measured
  // its risk more accurately than standalone vol." Normalization across the basket
  // cancels any common shift.
  const uplift = (l: LongToken) => {
    const rv = l.residual_vol ?? l.annualized_vol;
    if (rv <= 0 || l.annualized_vol <= 0) return 0;
    return Math.sqrt(l.annualized_vol / rv) - 1;
  };

  const sortFn = (a: LongToken, b: LongToken) => {
    const getVal = (t: LongToken) => {
      switch (sortKey) {
        case "standalone": return t.annualized_vol;
        case "residual":   return t.residual_vol ?? 0;
        case "target":     return t.target_notional;
        case "weight":     return t.weight_pct;
        case "hedged":
        default:           return t.vol_saved_pct ?? 0;
      }
    };
    const va = getVal(a);
    const vb = getVal(b);
    return sortDir === "desc" ? vb - va : va - vb;
  };

  const handleSort = (key: ResidSortKey) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = [...withResid].sort(sortFn);

  const headerCell = (key: ResidSortKey, label: string, align: "left" | "right" = "right") => (
    <th
      className={`py-1.5 px-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider cursor-pointer select-none hover:text-gray-300 ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => handleSort(key)}
    >
      {label}
      {sortKey === key && <span className="ml-1">{sortDir === "desc" ? "▼" : "▲"}</span>}
    </th>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            Long Sizing: Residual-Vol (hedge-aware)
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              ACTIVE
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <div className="px-4 pb-4 space-y-3">
        <p className="text-[12px] text-gray-400 leading-relaxed">
          Long weights are computed as <span className="font-mono text-gray-200">tilt / residual_vol<sup>0.5</sup></span>,
          where <span className="text-gray-200">residual_vol</span> is each long's vol <em>after</em> regressing its log returns on the equal-weighted short-basket return.
          This measures the vol that <em>survives the hedge</em> — i.e. each long's true marginal contribution to spread P&L variance under the beta-neutral budget split.
          Fundamental tilts (VA, SM, OP, MM) are fully preserved — only the vol denominator changes from standalone to hedge-adjusted.
        </p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          A long whose returns are largely explained by the short basket (high "hedged" %) contributes little net spread risk and <em>earns a concentration bonus</em>.
          A long that moves independently of the shorts keeps its full risk weight.
          Floored at 20% of standalone vol to cap concentration at max 5× the standalone-sizing equivalent.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <KpiBox label="Avg Vol Hedged" value={`${avgSaved.toFixed(0)}%`} />
          <KpiBox
            label="Most Hedged"
            value={maxSavedToken ? `${maxSavedToken.symbol.replace("USDT", "")} ${(maxSavedToken.vol_saved_pct ?? 0).toFixed(0)}%` : "—"}
          />
          <KpiBox
            label="Least Hedged"
            value={minSavedToken ? `${minSavedToken.symbol.replace("USDT", "")} ${(minSavedToken.vol_saved_pct ?? 0).toFixed(0)}%` : "—"}
          />
        </div>

        {/* Full per-long breakdown: standalone vs residual vs hedged % with notionals */}
        <div className="pt-2">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">Per-Long Breakdown</span>
            <span className="text-[10px] text-gray-600">click column header to sort</span>
          </div>
          <div className="overflow-hidden rounded border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/40">
                <tr className="border-b border-gray-800">
                  {headerCell("hedged" as ResidSortKey, "Symbol", "left")}
                  {headerCell("standalone", "Standalone")}
                  {headerCell("residual", "Residual")}
                  {headerCell("hedged", "Hedged")}
                  <th className="py-1.5 px-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider text-right">Uplift</th>
                  {headerCell("target", "Target $")}
                  <th className="py-1.5 px-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider text-right">Current $</th>
                  {headerCell("weight", "Weight")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const saved = t.vol_saved_pct ?? 0;
                  const up = uplift(t) * 100;
                  const savedColor =
                    saved > 30 ? "text-emerald-400" :
                    saved > 15 ? "text-emerald-500" :
                    saved > 5  ? "text-gray-300" : "text-gray-500";
                  const upliftColor =
                    up > 15 ? "text-emerald-400" :
                    up > 5  ? "text-emerald-500" :
                    up < -1 ? "text-red-400" : "text-gray-500";
                  return (
                    <tr key={t.symbol} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                      <td className="py-1 px-2">
                        <span className="font-medium text-gray-200 text-[12px]">
                          {t.symbol.replace("USDT", "")}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right text-gray-500 text-[12px]">
                        {(t.annualized_vol * 100).toFixed(1)}%
                      </td>
                      <td className="py-1 px-2 text-right text-gray-200 text-[12px] font-medium">
                        {((t.residual_vol ?? 0) * 100).toFixed(1)}%
                      </td>
                      <td className={`py-1 px-2 text-right text-[12px] font-medium ${savedColor}`}>
                        {saved > 0 ? "-" : ""}{saved.toFixed(0)}%
                      </td>
                      <td className={`py-1 px-2 text-right text-[12px] ${upliftColor}`}>
                        {up >= 0 ? "+" : ""}{up.toFixed(0)}%
                      </td>
                      <td className="py-1 px-2 text-right text-gray-300 text-[12px]">
                        {formatUSD(t.target_notional)}
                      </td>
                      <td className="py-1 px-2 text-right text-gray-500 text-[12px]">
                        {formatUSD(t.current_notional)}
                      </td>
                      <td className="py-1 px-2 text-right text-gray-200 text-[12px] font-semibold">
                        {t.weight_pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
            <span className="text-gray-500">Uplift</span> = implied per-name weight change from residual sizing,
            (standalone/residual)<sup>0.5</sup> − 1, before basket renormalization.
            Positive → this long is more concentrated than it would be under standalone-vol sizing.
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Main Tab ──

export function PortfolioConstructionTab() {
  const { data, isLoading, error } = usePortfolioConstruction() as { data: any; isLoading: boolean; error: any };
  const [expandedLong, setExpandedLong] = useState<string | null>(null);
  const [expandedShort, setExpandedShort] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500 text-sm">Loading portfolio construction...</div>;
  }
  if (error || !data) {
    return <div className="flex items-center justify-center h-64 text-red-400 text-sm">Failed to load portfolio construction data</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Budget + Constraints side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BudgetWaterfall budget={data.budget} />
        </div>
        <ConstraintsPanel constraints={data.constraints} />
      </div>

      {/* Tilt Health Summary */}
      <TiltHealthSummary longs={data.long_side.tokens} shorts={data.short_side.tokens} />

      {/* Residual-Vol Sizing Explainer (only shown in residual mode) */}
      <ResidualVolExplainer longs={data.long_side.tokens} sizingMode={data.long_side.sizing_mode} />

      {/* Long Side */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Long Side — {data.long_side.n_tokens} tokens
            </CardTitle>
            <span className="text-[11px] text-gray-500">
              mode: {data.long_side.sizing_mode} | vol_power: {data.long_side.vol_power} | tilt_base: {data.long_side.sm_tilt_weight}
              {data.alpha_tilt?.enabled && ` | alpha: x${data.alpha_tilt.amplifier || 5} cap ${((data.alpha_tilt.max_tilt || 0.4) * 100).toFixed(0)}% ${data.alpha_tilt.lookback_days}d`}
            </span>
          </div>
        </CardHeader>
        <div className="px-4 pb-4">
          <SectorBreakdown tokens={data.long_side.tokens} />
          <div className="text-[11px] text-gray-500 mb-2">
            {data.long_side.sizing_mode === "signal_proportional_residual" ? (
              <>weight = tilt / residual_vol<sup>{data.long_side.vol_power}</sup> (normalized) — residual vol = std of returns after regressing on short basket — click row for tilt waterfall</>
            ) : (
              <>weight = tilt / vol<sup>{data.long_side.vol_power}</sup> (normalized) — click row for tilt waterfall</>
            )}
          </div>
          <ExpandableTable
            columns={longColumns}
            data={data.long_side.tokens}
            expandedSymbol={expandedLong}
            onToggle={(sym) => setExpandedLong(expandedLong === sym ? null : sym)}
            renderExpanded={(token) => <TiltWaterfall token={token} side="LONG" />}
            defaultSort="weight"
            defaultDir="desc"
          />
        </div>
      </Card>

      {/* Short Side */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Short Side — {data.short_side.n_tokens} tokens
            </CardTitle>
            <span className="text-[11px] text-gray-500">
              weighting: {data.short_side.weighting}
            </span>
          </div>
        </CardHeader>
        <div className="px-4 pb-4">
          <SectorBreakdown tokens={data.short_side.tokens} />
          <div className="text-[11px] text-gray-500 mb-2">
            weight = {"\u03b2"} {"\u00d7"} correlation to long basket (normalized) — click row for tilt waterfall
          </div>
          <ExpandableTable
            columns={shortColumns}
            data={data.short_side.tokens}
            expandedSymbol={expandedShort}
            onToggle={(sym) => setExpandedShort(expandedShort === sym ? null : sym)}
            renderExpanded={(token) => <TiltWaterfall token={token} side="SHORT" />}
            defaultSort="weight"
            defaultDir="desc"
          />
        </div>
      </Card>

      {/* ── Spread Vol Contribution (MCTR) ── */}
      <SpreadVolContribution />
    </div>
  );
}

// ── Spread Vol Contribution Table ──

interface MctrEntry {
  symbol: string;
  side: string;
  weight: number;
  beta: number;
  corr_to_spread: number;
  corr_to_basket: number;
  vol_daily_pct: number;
  return_30d_pct: number;
  return_1y_pct: number;
  mctr_daily_pct: number;
  mctr_pct_of_total: number;
}

interface SpreadVolDecompResponse {
  decomposition: {
    total_spread_vol_daily_pct: number;
    total_spread_vol_annual_pct: number;
    beta_mismatch: { vol_daily_pct: number; pct_of_total: number; beta_gap: number };
    sector_mismatch: { vol_daily_pct: number; pct_of_total: number };
    idiosyncratic: { vol_daily_pct: number; pct_of_total: number };
    per_position_mctr: MctrEntry[];
  };
  n_longs: number;
  n_shorts: number;
}

function SpreadVolContribution() {
  const { client, engine } = useEngine();
  const { data } = useQuery<SpreadVolDecompResponse>({
    queryKey: ["spread-vol-decomposition", engine.id],
    queryFn: () => client.get("/api/spread-vol-decomposition"),
    refetchInterval: 3600_000,
    staleTime: 1800_000,
    retry: false,
  });

  const [showSide, setShowSide] = useState<"LONG" | "SHORT" | "ALL">("LONG");
  const [sortBy, setSortBy] = useState<"mctr" | "corr" | "vol" | "ret">("mctr");

  if (!data?.decomposition?.per_position_mctr) return null;

  const entries = data.decomposition.per_position_mctr
    .filter((e) => showSide === "ALL" || e.side === showSide)
    .sort((a, b) => {
      switch (sortBy) {
        case "mctr": return a.mctr_pct_of_total - b.mctr_pct_of_total; // most negative first (best hedgers)
        case "corr": return b.corr_to_basket - a.corr_to_basket;
        case "vol": return a.vol_daily_pct - b.vol_daily_pct;
        case "ret": return b.return_1y_pct - a.return_1y_pct;
        default: return 0;
      }
    });

  const decomp = data.decomposition;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardHeader>
          <CardTitle>Spread Vol Contribution (MCTR)</CardTitle>
        </CardHeader>
        <div className="flex gap-2 mr-4">
          {(["LONG", "SHORT", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setShowSide(s)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                showSide === s
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                  : "bg-gray-800 border-gray-700 text-gray-600 hover:text-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Decomposition summary */}
      <div className="flex gap-6 px-3 pb-2 text-[10px] text-gray-500">
        <span>Daily Spread Vol: <span className="text-gray-300 font-medium">{decomp.total_spread_vol_daily_pct.toFixed(2)}%</span></span>
        <span>Beta Mismatch: <span className="text-gray-400">{decomp.beta_mismatch.pct_of_total.toFixed(0)}%</span></span>
        <span>Sector Mismatch: <span className="text-gray-400">{decomp.sector_mismatch.pct_of_total.toFixed(0)}%</span></span>
        <span>Idiosyncratic: <span className="text-gray-400">{decomp.idiosyncratic.pct_of_total.toFixed(0)}%</span></span>
        <span>Beta Gap: <span className="text-gray-400">{decomp.beta_mismatch.beta_gap.toFixed(3)}</span></span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500">Symbol</th>
              <th className="px-3 py-2 text-left text-gray-500">Side</th>
              <th
                className={`px-3 py-2 text-right cursor-pointer hover:text-gray-300 ${sortBy === "mctr" ? "text-blue-400" : "text-gray-500"}`}
                onClick={() => setSortBy("mctr")}
              >MCTR%</th>
              <th
                className={`px-3 py-2 text-right cursor-pointer hover:text-gray-300 ${sortBy === "corr" ? "text-blue-400" : "text-gray-500"}`}
                onClick={() => setSortBy("corr")}
              >Corr</th>
              <th
                className={`px-3 py-2 text-right cursor-pointer hover:text-gray-300 ${sortBy === "vol" ? "text-blue-400" : "text-gray-500"}`}
                onClick={() => setSortBy("vol")}
              >Daily Vol</th>
              <th className="px-3 py-2 text-right text-gray-500">Beta</th>
              <th
                className={`px-3 py-2 text-right cursor-pointer hover:text-gray-300 ${sortBy === "ret" ? "text-blue-400" : "text-gray-500"}`}
                onClick={() => setSortBy("ret")}
              >30d Ret</th>
              <th className="px-3 py-2 text-right text-gray-500">1Y Ret</th>
              <th className="px-3 py-2 text-left text-gray-500 w-32">Contribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {entries.map((e) => {
              const barWidth = Math.min(Math.abs(e.mctr_pct_of_total) * 3, 100);
              const isHedger = e.mctr_pct_of_total < 0;
              return (
                <tr key={`${e.symbol}-${e.side}`} className="hover:bg-gray-800/30">
                  <td className="px-3 py-1.5 font-mono text-gray-200">{e.symbol.replace("USDT", "")}</td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      e.side === "LONG" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                    }`}>{e.side}</span>
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono font-bold ${
                    isHedger ? "text-green-400" : "text-red-400"
                  }`}>
                    {e.mctr_pct_of_total >= 0 ? "+" : ""}{e.mctr_pct_of_total.toFixed(1)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${
                    e.corr_to_basket >= 0.8 ? "text-green-400" : e.corr_to_basket >= 0.6 ? "text-gray-300" : "text-red-400"
                  }`}>
                    {e.corr_to_basket.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-400">
                    {e.vol_daily_pct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-400">
                    {e.beta.toFixed(2)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${
                    e.return_30d_pct >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {e.return_30d_pct >= 0 ? "+" : ""}{e.return_30d_pct.toFixed(1)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${
                    e.return_1y_pct >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {e.return_1y_pct >= 0 ? "+" : ""}{e.return_1y_pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <div className="w-24 h-2 bg-gray-800 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${isHedger ? "bg-green-500/60" : "bg-red-500/60"}`}
                          style={{ width: `${barWidth}%`, marginLeft: isHedger ? `${100 - barWidth}%` : "0" }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-gray-600 px-3 py-2">
        MCTR = marginal contribution to spread vol. Green (negative) = reduces spread vol (good hedge). Red (positive) = adds to spread vol.
        Corr = correlation to equal-weighted long basket. Click column headers to sort.
      </div>
    </Card>
  );
}
