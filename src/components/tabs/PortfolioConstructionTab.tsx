import { usePortfolioConstruction } from "../../hooks/useDashboardQuery";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
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
  adjusted_score: number;
  tilt: number;
  annualized_vol: number;
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
  adjusted_score: number;
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
  { key: "p3", header: "P3", render: (r) => <ScoreCell value={r.p3_score} />, sortKey: (r) => r.p3_score, align: "right" },
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
    render: (r) => <span className="text-gray-400 text-[12px]">{(r.annualized_vol * 100).toFixed(1)}%</span>,
    sortKey: (r) => r.annualized_vol, align: "right",
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
  { key: "p3", header: "P3", render: (r) => <ScoreCell value={r.p3_score} />, sortKey: (r) => r.p3_score, align: "right" },
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

// ── Main Tab ──

export function PortfolioConstructionTab() {
  const { data, isLoading, error } = usePortfolioConstruction() as { data: any; isLoading: boolean; error: any };

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
            weight = tilt / vol<sup>{data.long_side.vol_power}</sup> (normalized)
          </div>
          <DataTable columns={longColumns} data={data.long_side.tokens} defaultSort="weight" defaultDir="desc" />
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
            weight = {"\u03b2"} {"\u00d7"} correlation to long basket (normalized)
          </div>
          <DataTable columns={shortColumns} data={data.short_side.tokens} defaultSort="weight" defaultDir="desc" />
        </div>
      </Card>
    </div>
  );
}
