import { useState } from "react";
import { Card, CardTitle } from "../ui/Card";

interface SpreadData {
  spread_pct: number | null;
  long_pct: number | null;
  short_pct: number | null;
  alpha_pct?: number | null;
  beta_drag_pct?: number | null;
  btc_return_pct?: number | null;
  ew_spread_pct?: number | null;
  ew_long_pct?: number | null;
  ew_short_pct?: number | null;
  sizing_lift_pct?: number | null;
  pw_vol_pct?: number | null;
  ew_vol_pct?: number | null;
  pw_vol_adj?: number | null;
  ew_vol_adj?: number | null;
  vol_adj_lift?: number | null;
  ic?: number | null;
  insufficient_history?: boolean;
  [key: string]: number | boolean | null | undefined;
}

interface ExOutlierData {
  label: string;
  symbols: string[];
  total_pnl_removed: number;
  periods: Record<string, SpreadData>;
  cumulative_spread_pct: number;
  information_ratio: number;
  down_day_capture_pct: number;
}

interface SpreadTableProps {
  horizons?: Record<string, SpreadData>;
  periods?: Record<string, SpreadData>;
  exOutliers?: ExOutlierData;
  informationRatio?: number;
  downDayCapture?: number;
  cumulativeSpread?: number;
  leverageRatio: number;
  netBetaPct?: number;
}

function SpreadRow({
  label, field, horizons, periods, bold, format = "pct",
}: {
  label: string;
  field: string;
  horizons?: Record<string, SpreadData>;
  periods?: Record<string, SpreadData>;
  bold?: boolean;
  format?: "pct" | "ratio";
}) {
  const cls = bold ? "text-gray-400 font-medium" : "text-gray-500";
  const valCls = (v: number) =>
    `text-right py-1.5 px-2 ${bold ? "font-bold" : ""} ${v >= 0 ? "text-green-400" : "text-red-400"}${bold ? "" : "/70"}`;
  const nullCls = `text-right py-1.5 px-2 ${bold ? "font-bold" : ""} text-gray-600`;

  const renderCell = (key: string, v: SpreadData, withBorder: boolean) => {
    const raw = v[field as keyof SpreadData];
    // Null/undefined → dash (insufficient history or field not populated)
    if (raw == null || typeof raw !== "number") {
      return (
        <td key={key} className={`${nullCls}${withBorder ? " border-l border-gray-800" : ""}`}>
          —
        </td>
      );
    }
    const display = format === "ratio"
      ? `${raw >= 0 ? "+" : ""}${raw.toFixed(2)}`
      : `${raw >= 0 ? "+" : ""}${raw.toFixed(2)}%`;
    return (
      <td key={key} className={`${valCls(raw)}${withBorder ? " border-l border-gray-800" : ""}`}>
        {display}
      </td>
    );
  };

  return (
    <tr className="border-b border-gray-800/50">
      <td className={`py-1.5 pr-4 ${cls}`}>{label}</td>
      {horizons && Object.entries(horizons).map(([h, v]) => renderCell(h, v, false))}
      {periods && Object.entries(periods).map(([p, v]) => renderCell(p, v, true))}
    </tr>
  );
}

export function SpreadTable({
  horizons, periods, exOutliers, informationRatio, downDayCapture,
  cumulativeSpread, leverageRatio, netBetaPct,
}: SpreadTableProps) {
  const [levered, setLevered] = useState(false);
  // Default to Ex-outliers ON when ex_outliers data is available. The
  // unfiltered view is wildly distorted by names like LAB / SIREN that
  // pumped 25×+ in our lookback windows — the "honest" spread strips them.
  const [exOuts, setExOuts] = useState(Boolean(exOutliers));
  const [attribution, setAttribution] = useState(false);
  const [ewCompare, setEwCompare] = useState(false);

  const lm = levered ? leverageRatio : 1;
  const exo = exOutliers;

  const activePeriods = exOuts && exo ? exo.periods : periods;
  const activeIR = exOuts && exo ? exo.information_ratio : informationRatio;
  const activeCapture = exOuts && exo ? exo.down_day_capture_pct : downDayCapture;
  const activeCumulative = exOuts && exo ? exo.cumulative_spread_pct : cumulativeSpread;

  const scaleNum = (n: number | null | undefined): number | null =>
    n == null ? null : Math.round(n * lm * 100) / 100;

  const scaleSpread = (d: Record<string, SpreadData> | undefined): Record<string, SpreadData> | undefined => {
    if (!d || lm === 1) return d;
    const out: Record<string, SpreadData> = {};
    for (const [k, v] of Object.entries(d)) {
      out[k] = {
        spread_pct: scaleNum(v.spread_pct),
        long_pct: scaleNum(v.long_pct),
        short_pct: scaleNum(v.short_pct),
        alpha_pct: scaleNum(v.alpha_pct),
        beta_drag_pct: scaleNum(v.beta_drag_pct),
        btc_return_pct: v.btc_return_pct,
        ew_spread_pct: scaleNum(v.ew_spread_pct),
        ew_long_pct: scaleNum(v.ew_long_pct),
        ew_short_pct: scaleNum(v.ew_short_pct),
        sizing_lift_pct: scaleNum(v.sizing_lift_pct),
        // Vol-adj is a unitless ratio (return / vol). Numerator and
        // denominator scale identically under leverage, so the ratio
        // is leverage-invariant — pass through unscaled.
        pw_vol_pct: v.pw_vol_pct,
        ew_vol_pct: v.ew_vol_pct,
        pw_vol_adj: v.pw_vol_adj,
        ew_vol_adj: v.ew_vol_adj,
        vol_adj_lift: v.vol_adj_lift,
        // IC is a Spearman rank correlation — unitless and leverage-invariant.
        ic: v.ic,
        insufficient_history: v.insufficient_history,
      };
    }
    return out;
  };

  const displayHorizons = scaleSpread(horizons);
  const displayPeriods = scaleSpread(activePeriods);

  // Check if attribution data is available
  const hasAttribution = Object.values(horizons ?? {}).some(v => v.alpha_pct != null);

  const toggleCls = (active: boolean) =>
    `text-xs px-2 py-0.5 rounded border transition-colors ${
      active
        ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
        : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
    }`;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>L/S Spread</CardTitle>
        <div className="flex gap-1.5">
          <button onClick={() => setLevered(!levered)} className={toggleCls(levered)}
            title={`Apply ${leverageRatio.toFixed(1)}x leverage to spread`}>
            {levered ? `${leverageRatio.toFixed(1)}x` : "Levered"}
          </button>
          {exo && (
            <button onClick={() => setExOuts(!exOuts)} className={toggleCls(exOuts)}
              title={`Strip ${exo.symbols.join(", ")} (${exo.total_pnl_removed >= 0 ? "+" : ""}$${exo.total_pnl_removed.toFixed(0)})`}>
              {exo.label}
            </button>
          )}
          {hasAttribution && (
            <button onClick={() => setAttribution(!attribution)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                attribution
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                  : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
              }`}
              title="Decompose spread into alpha (selection) and beta drag (market exposure)">
              Attribution
            </button>
          )}
          <button onClick={() => setEwCompare(!ewCompare)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              ewCompare
                ? "bg-teal-500/20 border-teal-500/50 text-teal-400"
                : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400"
            }`}
            title="Compare portfolio-weighted vs equal-weighted spread to see sizing impact">
            EW vs PW
          </button>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="text-left py-1 pr-4"></th>
              {displayHorizons && Object.keys(displayHorizons).map((h) => (
                <th key={h} className="text-right py-1 px-2 font-medium">{h}</th>
              ))}
              {displayPeriods && Object.keys(displayPeriods).map((p) => (
                <th key={p} className="text-right py-1 px-2 font-medium border-l border-gray-800">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attribution ? (
              <>
                <SpreadRow label="Total" field="spread_pct" horizons={displayHorizons} periods={displayPeriods} bold />
                <SpreadRow label="Alpha" field="alpha_pct" horizons={displayHorizons} periods={displayPeriods} />
                <SpreadRow label="Beta Drag" field="beta_drag_pct" horizons={displayHorizons} periods={displayPeriods} />
              </>
            ) : ewCompare ? (
              <>
                <SpreadRow label="PW Spread" field="spread_pct" horizons={displayHorizons} periods={displayPeriods} bold />
                <SpreadRow label="EW Spread" field="ew_spread_pct" horizons={displayHorizons} periods={displayPeriods} />
                <SpreadRow label="Sizing Lift" field="sizing_lift_pct" horizons={displayHorizons} periods={displayPeriods} />
                <SpreadRow label="Vol-Adj Lift" field="vol_adj_lift" horizons={displayHorizons} periods={displayPeriods} format="ratio" />
                <SpreadRow label="IC (rank)" field="ic" horizons={displayHorizons} periods={displayPeriods} format="ratio" />
              </>
            ) : (
              <>
                <SpreadRow label="Spread" field="spread_pct" horizons={displayHorizons} periods={displayPeriods} bold />
                <SpreadRow label="Longs" field="long_pct" horizons={displayHorizons} periods={displayPeriods} />
                <SpreadRow label="Shorts" field="short_pct" horizons={displayHorizons} periods={displayPeriods} />
              </>
            )}
          </tbody>
        </table>
        <div className="flex gap-6 mt-3 text-xs text-gray-500 border-t border-gray-800 pt-2">
          {activeIR != null && (
            <span>IR: <span className="text-gray-300 font-medium">{activeIR.toFixed(2)}</span></span>
          )}
          {activeCapture != null && (
            <span>Down-day capture: <span className="text-gray-300 font-medium">{activeCapture.toFixed(0)}%</span></span>
          )}
          {activeCumulative != null && (
            <span>Spread return (price): <span className={`font-medium ${activeCumulative * lm >= 0 ? "text-green-400" : "text-red-400"}`}>
              {activeCumulative * lm >= 0 ? "+" : ""}{(activeCumulative * lm).toFixed(2)}%
            </span></span>
          )}
          {attribution && netBetaPct != null && (
            <span>Net β: <span className="text-purple-400 font-medium">{netBetaPct >= 0 ? "+" : ""}{netBetaPct.toFixed(1)}%</span></span>
          )}
          {exOuts && exo && (
            <span className="text-yellow-500/70">
              Excluding: {exo.symbols.map((s: string) => s.replace("USDT", "")).join(", ")} ({exo.total_pnl_removed >= 0 ? "+" : ""}${exo.total_pnl_removed.toFixed(0)})
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
