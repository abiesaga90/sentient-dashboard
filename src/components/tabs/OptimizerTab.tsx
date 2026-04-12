import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import {
  useOptimizer,
  type OptimizerConstraint,
  type OptimizerWeightCompare,
} from "../../hooks/useDashboardQuery";

/* ──────────────────────── Types ──────────────────────── */

type SortKey = "symbol" | "side" | "target_pct" | "current_pct" | "drift_pct";

/* ──────────────────────── Helpers ──────────────────────── */

const fmtPct = (n: number | undefined | null, digits = 2): string =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

const fmtUsd = (n: number | undefined | null): string => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtTimestamp = (iso?: string): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const constraintLabel = (name: string): string => {
  switch (name) {
    case "gross_leverage":
      return "Gross Leverage";
    case "net_exposure":
      return "Net Exposure";
    case "dd_scale":
      return "DD Scale";
    case "effective_scale":
      return "Effective Scale";
    default:
      return name;
  }
};

const driftColor = (pct: number): string => {
  const abs = Math.abs(pct);
  if (abs < 0.5) return "text-gray-400";
  if (abs < 1.5) return "text-yellow-400";
  if (abs < 3.0) return "text-orange-400";
  return "text-red-400";
};

/* ──────────────────────── Constraint card ──────────────────────── */

function ConstraintRow({ c }: { c: OptimizerConstraint }) {
  // Traffic light: green=plenty of slack, yellow=approaching, red=binding
  let dotClass: string;
  let label: string;
  if (c.binding) {
    dotClass = "bg-red-500";
    label = "binding";
  } else if (c.slack_pct < 25 && c.name !== "dd_scale" && c.name !== "effective_scale") {
    dotClass = "bg-yellow-500";
    label = "tight";
  } else {
    dotClass = "bg-green-500";
    label = "ok";
  }

  // Display % differently for budget multipliers vs exposure caps
  const isMultiplier = c.name === "dd_scale" || c.name === "effective_scale";
  const actualDisplay = isMultiplier
    ? `${(c.actual * 100).toFixed(0)}%`
    : `${c.actual.toFixed(1)}%`;
  const limitDisplay = isMultiplier
    ? "100%"
    : `${c.limit.toFixed(1)}%`;

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-900 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <span className="text-sm text-gray-300">{constraintLabel(c.name)}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-600">{label}</span>
      </div>
      <div className="text-xs text-gray-500 font-mono">
        <span className="text-gray-300">{actualDisplay}</span>
        <span className="mx-1.5 text-gray-600">/</span>
        <span>{limitDisplay}</span>
      </div>
    </div>
  );
}

/* ──────────────────────── Component ──────────────────────── */

export function OptimizerTab() {
  const { data, isLoading, error } = useOptimizer();
  const [sortKey, setSortKey] = useState<SortKey>("drift_pct");
  const [sortDesc, setSortDesc] = useState(true);

  const sortedRows = useMemo<OptimizerWeightCompare[]>(() => {
    if (!data?.weight_comparison) return [];
    const arr = [...data.weight_comparison];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      const na = Number(va);
      const nb = Number(vb);
      if (sortKey === "drift_pct") {
        // Sort by absolute drift
        return sortDesc ? Math.abs(nb) - Math.abs(na) : Math.abs(na) - Math.abs(nb);
      }
      return sortDesc ? nb - na : na - nb;
    });
    return arr;
  }, [data, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-red-400 text-sm">Failed to load optimizer: {String(error)}</div>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-gray-400 text-sm">Loading optimizer…</div>
        </Card>
      </div>
    );
  }

  if (!data.available) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Optimizer</CardTitle>
          </CardHeader>
          <div className="text-sm text-gray-400">
            {data.reason || "No optimizer result yet — wait for the first rebalance."}
          </div>
        </Card>
      </div>
    );
  }

  const headerCell = (label: string, key: SortKey, align: "left" | "right" = "right") => (
    <th
      className={`px-2 py-2 text-xs uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-300 ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => handleSort(key)}
    >
      {label}
      {sortKey === key && <span className="ml-1 text-gray-400">{sortDesc ? "↓" : "↑"}</span>}
    </th>
  );

  return (
    <div className="p-4 space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Gross"
          value={fmtPct(data.gross_pct)}
          sub={`${fmtUsd(data.gross_total)} (cap ${(data.dd_scale ?? 1) * 200}%)`}
        />
        <KpiCard
          label="Net"
          value={fmtPct(data.net_exposure_pct)}
          sub={`${fmtUsd(data.net_exposure)} (cap ±30%)`}
          valueColor={
            Math.abs(data.net_exposure_pct ?? 0) > 25 ? "text-yellow-400" : "text-gray-200"
          }
        />
        <KpiCard
          label="L/S β symmetry"
          value={(data.beta_symmetry_delta ?? 0).toFixed(3)}
          sub={`L β ${(data.avg_long_beta ?? 0).toFixed(2)} · S β ${(data.avg_short_beta ?? 0).toFixed(2)}`}
          valueColor={
            (data.beta_symmetry_delta ?? 0) < 0.1
              ? "text-green-400"
              : (data.beta_symmetry_delta ?? 0) < 0.25
              ? "text-yellow-400"
              : "text-red-400"
          }
        />
        <KpiCard
          label="Basket"
          value={`${data.n_longs ?? 0}L / ${data.n_shorts ?? 0}S`}
          sub={`from ${fmtUsd(data.sizing_base)} sizing base`}
        />
        <KpiCard
          label="Computed"
          value={fmtTimestamp(data.computed_at)}
          sub="last rebalance snapshot"
        />
      </div>

      {/* Layer note */}
      <Card>
        <div className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Layer 3 — Portfolio Optimizer (v1).</strong>{" "}
          Observability layer over the existing rank_longs / rank_shorts /
          compute_target_portfolio chain. The selection and sizing logic is
          unchanged; this view surfaces aggregate exposures, constraint binding,
          and per-symbol drift from target. Phase 3 v2 will add marginal position
          value sweeps and optimal-N analysis.
        </div>
      </Card>

      {/* Constraint binding */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Constraint Binding</CardTitle>
            {data.binding_constraints && data.binding_constraints.length > 0 ? (
              <Badge variant="warning">
                {data.binding_constraints.length} binding
              </Badge>
            ) : (
              <Badge variant="success">all clear</Badge>
            )}
          </div>
        </CardHeader>
        <div>
          {(data.constraints || []).map((c) => (
            <ConstraintRow key={c.name} c={c} />
          ))}
        </div>
        <div className="mt-3 text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-500">Binding</strong> = utilization within 5% of
          the limit. Net exposure cap is the most likely binder during normal operation;
          DD scale dropping below 50% indicates a meaningful drawdown reduction.
        </div>
      </Card>

      {/* Weight comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Target vs Current Positions</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr>
                {headerCell("Symbol", "symbol", "left")}
                {headerCell("Side", "side", "left")}
                {headerCell("Target %", "target_pct")}
                {headerCell("Current %", "current_pct")}
                {headerCell("Drift", "drift_pct")}
                <th className="px-2 py-2 text-xs uppercase tracking-wider text-gray-500 text-right">
                  Target $
                </th>
                <th className="px-2 py-2 text-xs uppercase tracking-wider text-gray-500 text-right">
                  Current $
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((w) => (
                <tr key={w.symbol} className="border-b border-gray-900 hover:bg-gray-900/40">
                  <td className="px-2 py-1.5 text-gray-200 font-mono">
                    {w.symbol.replace("USDT", "")}
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant={w.side === "LONG" ? "success" : "danger"}>
                      {w.side}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-gray-300">
                    {fmtPct(w.target_pct)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-gray-300">
                    {fmtPct(w.current_pct)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-mono font-medium ${driftColor(
                      w.drift_pct
                    )}`}
                  >
                    {fmtPct(w.drift_pct)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-500">
                    {fmtUsd(w.target_notional)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-500">
                    {fmtUsd(w.current_notional)}
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                    No positions to compare
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[11px] text-gray-600 leading-relaxed">
          Drift = current minus target. Sign convention: longs report{" "}
          <span className="text-green-400">positive</span> %, shorts report{" "}
          <span className="text-red-400">negative</span> %. A short with current
          position less negative than target shows positive drift (under-shorted).
          Sorted by absolute drift magnitude.
        </div>
      </Card>
    </div>
  );
}
