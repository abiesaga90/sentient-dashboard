import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { ChartContainer } from "../shared/ChartContainer";
import { DataTable, type Column } from "../shared/DataTable";
import { formatUSD } from "../../lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────

interface SortinoPoint {
  date: string;
  value: number;
}

interface TokenCapacity {
  symbol: string;
  side: string;
  current_notional: number;
  adv_usd: number | null;
  pct_adv_current: number | null;
  constrained_at: string | null;
  [key: string]: unknown; // dynamic pct_adv_$Xk / pct_adv_$XM keys
}

interface FillQualityTier {
  avg_slippage_bps: number;
  fill_ratio_pct: number;
  n_trades: number;
}

interface ConstrainedSummary {
  tier: number;
  label: string;
  n_constrained: number;
  pct_constrained: number;
}

interface ScalingScenario {
  tier: number;
  label: string;
  is_current: boolean;
  nickel_capital?: number;
  gross_exposure?: number;
  max_position_usd: number;
  n_constrained: number;
  pct_constrained: number;
  est_slippage_bps: number;
  feasibility: "GREEN" | "YELLOW" | "RED";
}

interface ScalingResponse {
  scaling_tracker: {
    current_notional: number;
    current_tier_index: number;
    tiers: number[];
    tier_labels: string[];
    next_tier: number | null;
    next_tier_label: string | null;
    days_at_current_tier: number | null;
    tier_start_date: string | null;
    sortino_4w: number | null;
    sortino_gate_ok: boolean;
    sortino_trend: SortinoPoint[];
    ptt_dd_pct: number;
    dd_gate_ok: boolean;
    avg_slippage_bps: number;
    fill_ratio_pct: number;
    n_trades_30d: number;
    infra_gate_ok: boolean;
    scaling_ready: boolean;
  };
  capacity_analysis: {
    tokens: TokenCapacity[];
    projection_labels: string[];
    constrained_summary: ConstrainedSummary[];
    fill_quality_by_tier: Record<string, FillQualityTier>;
    funding_drag: {
      total_funding_30d: number;
      annualized_pct: number;
      long_funding_30d: number;
      short_funding_30d: number;
    };
    adv_constraint_pct: number;
  };
  scaling_scenarios: ScalingScenario[];
  capacity_ceiling: {
    ceiling_notional: number;
    ceiling_nickel_capital?: number;
    ceiling_gross?: number;
    ceiling_label: string;
    n_constrained: number;
    pct_constrained: number;
    reason: string;
  } | null;
}

// ── Helpers ────────────────────────────────────────────────────

function gateColor(ok: boolean) {
  return ok ? "text-green-400" : "text-red-400";
}

function formatCompact(n: number | null | undefined): string {
  if (n == null) return "--";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function advPctColor(pct: number | null | undefined): string {
  if (pct == null) return "text-gray-500";
  if (pct > 2) return "text-red-400";
  if (pct > 1) return "text-yellow-400";
  return "text-gray-300";
}

// ── Component ──────────────────────────────────────────────────

export function ScalingCapacityTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<ScalingResponse>({
    queryKey: ["scaling", engine.id],
    queryFn: () => client.get("/api/scaling"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading scaling data...
      </div>
    );
  }

  const { scaling_tracker: st, capacity_analysis: ca, scaling_scenarios, capacity_ceiling } = data;

  return (
    <div className="p-4 space-y-6">
      {/* ── Section 1: Scaling Tracker ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Scaling Readiness
        </h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <KpiCard
            label="Current Tier"
            value={st.tier_labels[st.current_tier_index]}
            sub={`Tier ${st.current_tier_index + 1} of ${st.tiers.length}${
              st.days_at_current_tier != null ? ` \u00B7 ${st.days_at_current_tier}d` : ""
            }`}
          />
          <KpiCard
            label="Rolling 4w Sortino"
            value={st.sortino_4w != null ? st.sortino_4w.toFixed(2) : "N/A"}
            valueColor={st.sortino_4w != null ? gateColor(st.sortino_gate_ok) : "text-gray-500"}
            sub="Gate: \u2265 1.5"
          />
          <KpiCard
            label="PTT Drawdown"
            value={`${st.ptt_dd_pct.toFixed(2)}%`}
            valueColor={gateColor(st.dd_gate_ok)}
            sub="Gate: < 5%"
          />
          <Card className="flex flex-col gap-1 min-w-[140px]">
            <div className="text-xs text-gray-500">Scaling Status</div>
            <div className="mt-1">
              {st.scaling_ready ? (
                <Badge variant="success">READY TO SCALE</Badge>
              ) : (
                <Badge variant="danger">
                  PAUSED
                  {!st.sortino_gate_ok ? " \u00B7 Sortino" : ""}
                  {!st.dd_gate_ok ? " \u00B7 DD" : ""}
                  {!st.infra_gate_ok ? " \u00B7 Infra" : ""}
                </Badge>
              )}
            </div>
            {st.next_tier_label && (
              <div className="text-xs text-gray-500">
                Next: {st.next_tier_label}
              </div>
            )}
          </Card>
        </div>

        {/* Tier Ladder */}
        <Card>
          <CardHeader>
            <CardTitle>Scaling Ladder</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between gap-1">
              {st.tier_labels.map((label, i) => {
                const isCurrent = i === st.current_tier_index;
                const isPast = i < st.current_tier_index;
                return (
                  <div key={label} className="flex flex-col items-center flex-1">
                    {/* Connector line + node */}
                    <div className="flex items-center w-full">
                      {i > 0 && (
                        <div
                          className={`flex-1 h-0.5 ${
                            isPast ? "bg-green-500/50" : "bg-gray-700"
                          }`}
                        />
                      )}
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                          isCurrent
                            ? "bg-green-500 border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                            : isPast
                              ? "bg-green-800 border-green-600"
                              : "bg-gray-800 border-gray-600"
                        }`}
                      />
                      {i < st.tier_labels.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 ${
                            isPast ? "bg-green-500/50" : "bg-gray-700"
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`mt-1.5 text-[10px] ${
                        isCurrent
                          ? "text-green-400 font-semibold"
                          : isPast
                            ? "text-green-600"
                            : "text-gray-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Sortino Trend Chart */}
        {st.sortino_trend.length > 0 && (
          <ChartContainer title="Rolling 28-Day Sortino" height={240}>
            <LineChart data={st.sortino_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)} // MM-DD
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#111118",
                  border: "1px solid #1e1e2e",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v) => [Number(v).toFixed(2), "Sortino"]}
              />
              <ReferenceLine
                y={1.5}
                stroke="#ef4444"
                strokeDasharray="6 3"
                label={{
                  value: "1.5 Gate",
                  fill: "#ef4444",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}

        {/* Infrastructure Gate KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="Avg Slippage (30d)"
            value={`${st.avg_slippage_bps.toFixed(1)} bps`}
            valueColor={gateColor(st.avg_slippage_bps < 10)}
            sub={`${st.n_trades_30d} trades`}
          />
          <KpiCard
            label="Fill Ratio (30d)"
            value={`${st.fill_ratio_pct.toFixed(1)}%`}
            valueColor={gateColor(st.fill_ratio_pct >= 95)}
            sub="Gate: \u2265 95%"
          />
          <KpiCard
            label="Funding Drag (ann.)"
            value={`${ca.funding_drag.annualized_pct >= 0 ? "+" : ""}${ca.funding_drag.annualized_pct.toFixed(2)}%`}
            valueColor={ca.funding_drag.annualized_pct >= 0 ? "text-green-400" : "text-yellow-400"}
            sub={`30d: ${formatUSD(ca.funding_drag.total_funding_30d, 2)}`}
          />
        </div>
      </div>

      {/* ── Section 2: Capacity Analysis ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Capacity Analysis
        </h2>

        {/* Constrained summary */}
        {ca.constrained_summary.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ca.constrained_summary.map((cs) => (
              <KpiCard
                key={cs.label}
                label={`Constrained @ ${cs.label}`}
                value={`${cs.n_constrained} tokens`}
                valueColor={
                  cs.pct_constrained >= 30
                    ? "text-red-400"
                    : cs.pct_constrained >= 10
                      ? "text-yellow-400"
                      : "text-green-400"
                }
                sub={`${cs.pct_constrained}% of positions > ${ca.adv_constraint_pct}% ADV`}
              />
            ))}
          </div>
        )}

        {/* Per-Token Capacity Table */}
        <Card>
          <CardHeader>
            <CardTitle>Per-Token Capacity ({ca.adv_constraint_pct}% ADV Threshold)</CardTitle>
          </CardHeader>
          <DataTable<TokenCapacity>
            columns={buildCapacityColumns(ca.projection_labels)}
            data={ca.tokens}
            defaultSort="pct_adv"
            defaultDir="desc"
            maxHeight="max-h-[480px]"
          />
        </Card>

        {/* Fill Quality by Volume Tier */}
        <Card>
          <CardHeader>
            <CardTitle>Fill Quality by Volume Tier</CardTitle>
          </CardHeader>
          <DataTable<{ tier: string } & FillQualityTier>
            columns={fillQualityColumns}
            data={Object.entries(ca.fill_quality_by_tier).map(([tier, d]) => ({
              tier,
              ...d,
            }))}
          />
        </Card>
      </div>

      {/* ── Section 3: Scaling Scenarios ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Scaling Scenarios
        </h2>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Analysis</CardTitle>
          </CardHeader>
          <DataTable<ScalingScenario>
            columns={scenarioColumns}
            data={scaling_scenarios}
          />
        </Card>

        {/* Capacity Ceiling */}
        {capacity_ceiling && (
          <Card className="border-yellow-800/40">
            <div className="p-4 flex items-start gap-3">
              <div className="text-yellow-400 text-lg mt-0.5">&#9888;</div>
              <div>
                <div className="text-sm font-semibold text-yellow-400">
                  Strategy Capacity Ceiling: {capacity_ceiling.ceiling_label}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {capacity_ceiling.reason} ({capacity_ceiling.n_constrained} positions).
                  Beyond this notional, basket composition changes or liquidity upgrades
                  are needed.
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Column Definitions ─────────────────────────────────────────

function buildCapacityColumns(projLabels: string[]): Column<TokenCapacity>[] {
  const cols: Column<TokenCapacity>[] = [
    {
      key: "symbol",
      header: "Symbol",
      render: (r) => (
        <span className="font-mono text-xs">{r.symbol.replace("USDT", "")}</span>
      ),
      sortKey: (r) => r.symbol,
    },
    {
      key: "side",
      header: "Side",
      render: (r) => (
        <Badge variant={r.side === "LONG" ? "info" : "warning"}>
          {r.side}
        </Badge>
      ),
      sortKey: (r) => r.side,
    },
    {
      key: "notional",
      header: "Notional",
      align: "right",
      render: (r) => <span className="text-xs">{formatUSD(r.current_notional)}</span>,
      sortKey: (r) => r.current_notional,
    },
    {
      key: "adv",
      header: "ADV",
      align: "right",
      render: (r) => <span className="text-xs">{formatCompact(r.adv_usd)}</span>,
      sortKey: (r) => r.adv_usd ?? 0,
    },
    {
      key: "pct_adv",
      header: "% ADV Now",
      align: "right",
      render: (r) => (
        <span className={`text-xs ${advPctColor(r.pct_adv_current)}`}>
          {r.pct_adv_current != null ? `${r.pct_adv_current.toFixed(4)}%` : "--"}
        </span>
      ),
      sortKey: (r) => r.pct_adv_current ?? 0,
    },
  ];

  // Dynamic projection columns
  for (const label of projLabels) {
    const key = `pct_adv_${label}`;
    cols.push({
      key,
      header: `% @${label}`,
      align: "right",
      render: (r) => {
        const v = r[key] as number | null;
        return (
          <span className={`text-xs ${advPctColor(v)}`}>
            {v != null ? `${v.toFixed(3)}%` : "--"}
          </span>
        );
      },
      sortKey: (r) => (r[key] as number) ?? 0,
    });
  }

  cols.push({
    key: "constrained",
    header: "Constrained At",
    align: "right",
    render: (r) =>
      r.constrained_at ? (
        <Badge variant="danger">{r.constrained_at}</Badge>
      ) : (
        <span className="text-xs text-gray-600">--</span>
      ),
    sortKey: (r) => r.constrained_at ?? "zzz",
  });

  return cols;
}

const fillQualityColumns: Column<{ tier: string } & FillQualityTier>[] = [
  {
    key: "tier",
    header: "Volume Tier",
    render: (r) => (
      <Badge
        variant={
          r.tier === "HIGH" ? "success" : r.tier === "MED" ? "warning" : "danger"
        }
      >
        {r.tier}
      </Badge>
    ),
  },
  {
    key: "slippage",
    header: "Avg Slippage",
    align: "right",
    render: (r) => <span className="text-xs">{r.avg_slippage_bps.toFixed(1)} bps</span>,
    sortKey: (r) => r.avg_slippage_bps,
  },
  {
    key: "fill",
    header: "Fill Ratio",
    align: "right",
    render: (r) => (
      <span className={`text-xs ${r.fill_ratio_pct >= 95 ? "text-green-400" : "text-yellow-400"}`}>
        {r.fill_ratio_pct.toFixed(1)}%
      </span>
    ),
    sortKey: (r) => r.fill_ratio_pct,
  },
  {
    key: "trades",
    header: "Trades",
    align: "right",
    render: (r) => <span className="text-xs">{r.n_trades}</span>,
    sortKey: (r) => r.n_trades,
  },
];

const scenarioColumns: Column<ScalingScenario>[] = [
  {
    key: "tier",
    header: "Notional",
    render: (r) => (
      <span className={`text-xs font-mono ${r.is_current ? "text-green-400 font-semibold" : ""}`}>
        {r.label}
        {r.is_current && " \u25C0"}
      </span>
    ),
  },
  {
    key: "nickel",
    header: "Nickel Capital",
    align: "right",
    render: (r) => <span className="text-xs text-gray-400">{r.nickel_capital ? formatUSD(r.nickel_capital) : "—"}</span>,
  },
  {
    key: "gross",
    header: "Gross Exposure",
    align: "right",
    render: (r) => <span className="text-xs text-gray-400">{r.gross_exposure ? formatUSD(r.gross_exposure) : "—"}</span>,
  },
  {
    key: "max_pos",
    header: "Max Position",
    align: "right",
    render: (r) => <span className="text-xs">{formatUSD(r.max_position_usd)}</span>,
    sortKey: (r) => r.max_position_usd,
  },
  {
    key: "constrained",
    header: "Constrained",
    align: "right",
    render: (r) => <span className="text-xs">{r.n_constrained}</span>,
    sortKey: (r) => r.n_constrained,
  },
  {
    key: "pct_constrained",
    header: "% Constrained",
    align: "right",
    render: (r) => (
      <span
        className={`text-xs ${
          r.pct_constrained >= 30
            ? "text-red-400"
            : r.pct_constrained >= 10
              ? "text-yellow-400"
              : "text-green-400"
        }`}
      >
        {r.pct_constrained.toFixed(1)}%
      </span>
    ),
    sortKey: (r) => r.pct_constrained,
  },
  {
    key: "slippage",
    header: "Est. Slippage",
    align: "right",
    render: (r) => <span className="text-xs">{r.est_slippage_bps.toFixed(1)} bps</span>,
    sortKey: (r) => r.est_slippage_bps,
  },
  {
    key: "feasibility",
    header: "Feasibility",
    align: "right",
    render: (r) => (
      <Badge
        variant={
          r.feasibility === "GREEN"
            ? "success"
            : r.feasibility === "YELLOW"
              ? "warning"
              : "danger"
        }
      >
        {r.feasibility === "GREEN"
          ? "FEASIBLE"
          : r.feasibility === "YELLOW"
            ? "CAUTION"
            : "CONSTRAINED"}
      </Badge>
    ),
  },
];
