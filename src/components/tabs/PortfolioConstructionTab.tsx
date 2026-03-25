import { usePortfolioConstruction } from "../../hooks/useDashboardQuery";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { formatUSD, formatPct } from "../../lib/utils";

// ── Types ──

interface LongToken {
  symbol: string;
  va_score: number;
  sm_score: number;
  p3_score: number;
  adjusted_score: number;
  tilt: number;
  annualized_vol: number;
  weight_pct: number;
  beta: number;
  alpha_roi: number;
  target_notional: number;
  current_notional: number;
  drift_pct: number;
}

interface ShortToken {
  symbol: string;
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
  target_notional: number;
  current_notional: number;
  drift_pct: number;
}

// ── Budget Waterfall ──

function BudgetWaterfall({ budget }: { budget: any }) {
  const steps = [
    { label: "NAV", value: budget.nav, mult: null },
    { label: "Leverage", value: null, mult: `×${budget.max_leverage}` },
    { label: "DD Scale", value: null, mult: `×${budget.dd_scale.toFixed(3)}` },
    { label: "Vol Scale", value: null, mult: `×${budget.vol_scale.toFixed(3)}` },
    { label: "Recovery", value: null, mult: `×${budget.recovery_scale.toFixed(3)}` },
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
              {i > 0 && <span className="text-gray-600">→</span>}
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
          <span>Avg Long β: {budget.avg_long_beta.toFixed(3)}</span>
          <span>Avg Short β: {budget.avg_short_beta.toFixed(3)}</span>
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
                  {item.label === "Net Exposure" ? `±${item.limit}${item.unit}` : `${item.limit}${item.unit}`}
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
    render: (r) => <span className="font-medium text-gray-200">{r.symbol.replace("USDT", "")}</span>,
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
    key: "vol", header: "Vol",
    render: (r) => <span className="text-gray-400 text-[12px]">{(r.annualized_vol * 100).toFixed(1)}%</span>,
    sortKey: (r) => r.annualized_vol, align: "right",
  },
  {
    key: "beta", header: "β",
    render: (r) => <span className="text-gray-400 text-[12px]">{r.beta.toFixed(2)}</span>,
    sortKey: (r) => r.beta, align: "right",
  },
  {
    key: "weight", header: "Weight",
    render: (r) => <span className="text-gray-200 font-medium text-[12px]">{r.weight_pct.toFixed(1)}%</span>,
    sortKey: (r) => r.weight_pct, align: "right",
  },
  {
    key: "alpha", header: "PnL%",
    render: (r) => {
      const color = r.alpha_roi > 1 ? "text-emerald-400" : r.alpha_roi < -1 ? "text-red-400" : "text-gray-500";
      return <span className={`${color} text-[12px]`}>{r.alpha_roi > 0 ? "+" : ""}{r.alpha_roi.toFixed(1)}%</span>;
    },
    sortKey: (r) => r.alpha_roi, align: "right",
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
    render: (r) => <span className="font-medium text-gray-200">{r.symbol.replace("USDT", "")}</span>,
    sortKey: (r) => r.symbol,
  },
  { key: "va", header: "VA", render: (r) => <ScoreCell value={r.va_score} />, sortKey: (r) => r.va_score, align: "right" },
  { key: "sm", header: "SM", render: (r) => <ScoreCell value={r.sm_score} />, sortKey: (r) => r.sm_score, align: "right" },
  { key: "p3", header: "P3", render: (r) => <ScoreCell value={r.p3_score} />, sortKey: (r) => r.p3_score, align: "right" },
  { key: "score", header: "Inv. Score", render: (r) => <ScoreCell value={r.score} />, sortKey: (r) => r.score, align: "right" },
  {
    key: "beta", header: "β",
    render: (r) => <span className="text-gray-400 text-[12px]">{r.beta.toFixed(2)}</span>,
    sortKey: (r) => r.beta, align: "right",
  },
  {
    key: "corr", header: "Corr",
    render: (r) => <span className="text-gray-400 text-[12px]">{r.correlation.toFixed(2)}</span>,
    sortKey: (r) => r.correlation, align: "right",
  },
  {
    key: "hedge", header: "β×Corr",
    render: (r) => <span className="text-gray-300 text-[12px]">{r.hedge_weight.toFixed(3)}</span>,
    sortKey: (r) => r.hedge_weight, align: "right",
  },
  {
    key: "weight", header: "Weight",
    render: (r) => <span className="text-gray-200 font-medium text-[12px]">{r.weight_pct.toFixed(1)}%</span>,
    sortKey: (r) => r.weight_pct, align: "right",
  },
  {
    key: "alpha", header: "PnL%",
    render: (r) => {
      const color = r.alpha_roi > 1 ? "text-emerald-400" : r.alpha_roi < -1 ? "text-red-400" : "text-gray-500";
      return <span className={`${color} text-[12px]`}>{r.alpha_roi > 0 ? "+" : ""}{r.alpha_roi.toFixed(1)}%</span>;
    },
    sortKey: (r) => r.alpha_roi, align: "right",
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
          <div className="text-[11px] text-gray-500 mb-2">
            weight = β × correlation to long basket (normalized)
          </div>
          <DataTable columns={shortColumns} data={data.short_side.tokens} defaultSort="weight" defaultDir="desc" />
        </div>
      </Card>
    </div>
  );
}
