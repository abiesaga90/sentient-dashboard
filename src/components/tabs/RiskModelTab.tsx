import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { useRiskModel } from "../../hooks/useDashboardQuery";

/* ──────────────────────── Types ──────────────────────── */

type SortKey =
  | "symbol"
  | "side"
  | "beta"
  | "downside_beta"
  | "vol"
  | "correlation"
  | "delta"
  | "residual_vol"
  | "residual_vol_ratio";

interface TableRow {
  symbol: string;
  side: "LONG" | "SHORT";
  beta: number;
  downside_beta: number;
  vol: number;
  correlation: number;
  delta: number; // downside_beta - beta (positive = worse hedge than it looks)
  residual_vol: number | null;
  residual_vol_ratio: number | null; // residual_vol / standalone_vol
}

/* ──────────────────────── Helpers ──────────────────────── */

const fmtNum = (n: number, digits = 3): string =>
  n == null ? "—" : n.toFixed(digits);

const fmtPct = (n: number, digits = 1): string =>
  n == null ? "—" : `${(n * 100).toFixed(digits)}%`;

const colorForBeta = (beta: number): string => {
  if (beta < 0.5) return "text-blue-400";
  if (beta < 0.9) return "text-green-400";
  if (beta < 1.1) return "text-gray-300";
  if (beta < 1.5) return "text-yellow-400";
  return "text-red-400";
};

const colorForVol = (vol: number): string => {
  if (vol < 0.4) return "text-green-400";
  if (vol < 0.8) return "text-yellow-400";
  if (vol < 1.2) return "text-orange-400";
  return "text-red-400";
};

const colorForCorr = (corr: number): string => {
  if (corr > 0.8) return "text-green-400";
  if (corr > 0.5) return "text-gray-300";
  if (corr > 0.2) return "text-yellow-400";
  return "text-red-400";
};

const colorForDelta = (delta: number): string => {
  // Positive delta = downside_beta > beta = worse hedge under stress
  if (delta > 0.2) return "text-red-400";
  if (delta > 0.05) return "text-yellow-400";
  if (delta < -0.05) return "text-green-400";
  return "text-gray-400";
};

/** residual_vol / standalone_vol. Low = well-hedged, high = idio-dominant. */
const colorForResidRatio = (ratio: number | null): string => {
  if (ratio == null) return "text-gray-500";
  if (ratio < 0.3) return "text-green-400";
  if (ratio < 0.6) return "text-yellow-400";
  if (ratio < 0.85) return "text-orange-400";
  return "text-red-400";
};

const fmtTimestamp = (iso: string): string => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

/* ──────────────────────── Component ──────────────────────── */

export function RiskModelTab() {
  const { data, isLoading, error } = useRiskModel();
  const [sortKey, setSortKey] = useState<SortKey>("beta");
  const [sortDesc, setSortDesc] = useState(true);
  const [sideFilter, setSideFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");

  const rows = useMemo<TableRow[]>(() => {
    if (!data?.token_metrics) return [];
    const longSet = new Set(data.active_longs);
    const shortSet = new Set(data.short_basket);
    const out: TableRow[] = [];
    for (const [symbol, m] of Object.entries(data.token_metrics)) {
      const side: "LONG" | "SHORT" = longSet.has(symbol)
        ? "LONG"
        : shortSet.has(symbol)
        ? "SHORT"
        : "LONG"; // fallback for universe_extra
      out.push({
        symbol,
        side,
        beta: m.beta,
        downside_beta: m.downside_beta,
        vol: m.vol,
        correlation: m.correlation,
        delta: m.downside_beta - m.beta,
        residual_vol: m.residual_vol ?? null,
        residual_vol_ratio: m.residual_vol_ratio ?? null,
      });
    }
    return out;
  }, [data]);

  const filteredRows = useMemo(() => {
    return sideFilter === "ALL" ? rows : rows.filter((r) => r.side === sideFilter);
  }, [rows, sideFilter]);

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      const na = Number(va);
      const nb = Number(vb);
      return sortDesc ? nb - na : na - nb;
    });
    return arr;
  }, [filteredRows, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-red-400 text-sm">Failed to load risk model data: {String(error)}</div>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-gray-400 text-sm">Loading risk model…</div>
        </Card>
      </div>
    );
  }

  if (!data.available) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Risk Model</CardTitle>
          </CardHeader>
          <div className="text-gray-400 text-sm">
            {data.reason || "No risk snapshot available yet. Wait for the first rebalance."}
          </div>
        </Card>
      </div>
    );
  }

  const headerCell = (label: string, key: SortKey, align: "left" | "right" = "right") => (
    <th
      className={`px-3 py-2 text-xs uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-300 ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => handleSort(key)}
    >
      {label}
      {sortKey === key && (
        <span className="ml-1 text-gray-400">{sortDesc ? "↓" : "↑"}</span>
      )}
    </th>
  );

  return (
    <div className="p-4 space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Avg Long β"
          value={fmtNum(data.avg_long_beta)}
          sub="dollar-weighted vs long basket"
          valueColor={colorForBeta(data.avg_long_beta)}
        />
        <KpiCard
          label="Avg Short β"
          value={fmtNum(data.avg_short_beta)}
          sub="dollar-weighted vs long basket"
          valueColor={colorForBeta(data.avg_short_beta)}
        />
        <KpiCard
          label="Universe Size"
          value={String(data.n_symbols)}
          sub={`${data.active_longs.length}L · ${data.short_basket.length}S`}
        />
        <KpiCard
          label="Vol Lookback"
          value={`${data.vol_lookback_hours}h`}
          sub={`${(data.vol_lookback_hours / 24).toFixed(0)} days`}
        />
        <KpiCard
          label="Computed"
          value={fmtTimestamp(data.computed_at)}
          sub="last rebalance snapshot"
        />
      </div>

      {/* Source-of-truth note */}
      <Card>
        <div className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Layer 2 — Risk Model:</strong>{" "}
          single source of truth for beta, vol, and correlation. Computed once per
          rebalance from <code className="text-gray-300">RiskSnapshot</code>; consumed
          by both the portfolio optimizer and this tab. All betas measured against the
          equal-weighted long basket. Downside beta uses only hours when the basket
          returned negative — the actual hedge quality metric.
        </div>
      </Card>

      {/* Token metrics table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Token Risk Metrics</CardTitle>
            <div className="flex gap-1">
              {(["ALL", "LONG", "SHORT"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSideFilter(s)}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    sideFilter === s
                      ? "bg-blue-900/30 text-blue-300 border-blue-700/50"
                      : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr>
                {headerCell("Symbol", "symbol", "left")}
                {headerCell("Side", "side", "left")}
                {headerCell("β", "beta")}
                {headerCell("Downside β", "downside_beta")}
                {headerCell("Δ", "delta")}
                {headerCell("Vol (ann)", "vol")}
                {headerCell("Corr", "correlation")}
                {headerCell("Resid Vol", "residual_vol")}
                {headerCell("Resid/σ", "residual_vol_ratio")}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.symbol} className="border-b border-gray-900 hover:bg-gray-900/40">
                  <td className="px-3 py-1.5 text-gray-200 font-mono">
                    {r.symbol.replace("USDT", "")}
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge variant={r.side === "LONG" ? "success" : "danger"}>
                      {r.side}
                    </Badge>
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${colorForBeta(r.beta)}`}>
                    {fmtNum(r.beta)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${colorForBeta(r.downside_beta)}`}>
                    {fmtNum(r.downside_beta)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono text-xs ${colorForDelta(r.delta)}`}>
                    {r.delta >= 0 ? "+" : ""}
                    {fmtNum(r.delta)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${colorForVol(r.vol)}`}>
                    {fmtPct(r.vol)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${colorForCorr(r.correlation)}`}>
                    {fmtNum(r.correlation, 2)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${colorForVol(r.residual_vol ?? r.vol)}`}>
                    {r.residual_vol == null ? "—" : fmtPct(r.residual_vol)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${colorForResidRatio(r.residual_vol_ratio)}`}>
                    {r.residual_vol_ratio == null ? "—" : r.residual_vol_ratio.toFixed(2)}
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-gray-500">
                    No tokens to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[11px] text-gray-600 leading-relaxed space-y-1">
          <div>
            <strong className="text-gray-500">Δ column:</strong> downside β minus
            symmetric β. Positive Δ = the position is a worse hedge during
            basket drawdowns than its symmetric beta suggests.
          </div>
          <div>
            <strong className="text-gray-500">Resid Vol / Resid/σ:</strong>{" "}
            volatility that survives hedging against the opposite basket (longs
            vs shorts, shorts vs longs). The ratio is residual ÷ standalone —
            low = well-hedged, high = idio-dominant. This is the denominator
            used by the residual-vol sizing mode on both sides. Floor at 0.20
            caps any single name's weight at 5× what pure inv-vol would give.
          </div>
        </div>
      </Card>
    </div>
  );
}
