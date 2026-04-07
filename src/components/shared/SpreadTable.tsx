import { useState } from "react";
import { Card, CardTitle } from "../ui/Card";

interface SpreadData {
  spread_pct: number;
  long_pct: number;
  short_pct: number;
  alpha_pct?: number;
  beta_drag_pct?: number;
  btc_return_pct?: number;
  [key: string]: number | undefined;
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
  label, field, horizons, periods, bold,
}: {
  label: string;
  field: string;
  horizons?: Record<string, SpreadData>;
  periods?: Record<string, SpreadData>;
  bold?: boolean;
}) {
  const cls = bold ? "text-gray-400 font-medium" : "text-gray-500";
  const valCls = (v: number) =>
    `text-right py-1.5 px-2 ${bold ? "font-bold" : ""} ${v >= 0 ? "text-green-400" : "text-red-400"}${bold ? "" : "/70"}`;

  return (
    <tr className="border-b border-gray-800/50">
      <td className={`py-1.5 pr-4 ${cls}`}>{label}</td>
      {horizons && Object.entries(horizons).map(([h, v]) => {
        const val = (v[field as keyof SpreadData] as number) ?? 0;
        return (
          <td key={h} className={valCls(val)}>
            {val >= 0 ? "+" : ""}{val.toFixed(2)}%
          </td>
        );
      })}
      {periods && Object.entries(periods).map(([p, v]) => {
        const val = (v[field as keyof SpreadData] as number) ?? 0;
        return (
          <td key={p} className={`${valCls(val)} border-l border-gray-800`}>
            {val >= 0 ? "+" : ""}{val.toFixed(2)}%
          </td>
        );
      })}
    </tr>
  );
}

export function SpreadTable({
  horizons, periods, exOutliers, informationRatio, downDayCapture,
  cumulativeSpread, leverageRatio, netBetaPct,
}: SpreadTableProps) {
  const [levered, setLevered] = useState(false);
  const [exOuts, setExOuts] = useState(false);
  const [attribution, setAttribution] = useState(false);
  const [ewCompare, setEwCompare] = useState(false);

  const lm = levered ? leverageRatio : 1;
  const exo = exOutliers;

  const activePeriods = exOuts && exo ? exo.periods : periods;
  const activeIR = exOuts && exo ? exo.information_ratio : informationRatio;
  const activeCapture = exOuts && exo ? exo.down_day_capture_pct : downDayCapture;
  const activeCumulative = exOuts && exo ? exo.cumulative_spread_pct : cumulativeSpread;

  const scaleSpread = (d: Record<string, SpreadData> | undefined): Record<string, SpreadData> | undefined => {
    if (!d || lm === 1) return d;
    const out: Record<string, SpreadData> = {};
    for (const [k, v] of Object.entries(d)) {
      out[k] = {
        spread_pct: Math.round(v.spread_pct * lm * 100) / 100,
        long_pct: Math.round(v.long_pct * lm * 100) / 100,
        short_pct: Math.round(v.short_pct * lm * 100) / 100,
        alpha_pct: v.alpha_pct != null ? Math.round(v.alpha_pct * lm * 100) / 100 : undefined,
        beta_drag_pct: v.beta_drag_pct != null ? Math.round(v.beta_drag_pct * lm * 100) / 100 : undefined,
        btc_return_pct: v.btc_return_pct,
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
            <span>Cumulative: <span className={`font-medium ${activeCumulative * lm >= 0 ? "text-green-400" : "text-red-400"}`}>
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
