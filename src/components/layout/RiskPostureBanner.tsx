import type { ReactNode } from "react";
import { useRiskPosture } from "../../hooks/useDashboardQuery";

type Band = "green" | "amber" | "red";

const BAND_COLORS: Record<Band, { text: string; bg: string; dot: string }> = {
  green: { text: "text-green-400", bg: "bg-green-500/5", dot: "bg-green-500" },
  amber: { text: "text-yellow-400", bg: "bg-yellow-500/5", dot: "bg-yellow-500" },
  red: { text: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500" },
};

const REGIME_COLOR: Record<string, string> = {
  LOW: "text-green-400",
  NORMAL: "text-gray-300",
  ELEVATED: "text-[#d06643] font-semibold",
  UNKNOWN: "text-gray-500",
};

function pStopBand(p: number | null): Band {
  if (p == null) return "green";
  if (p >= 15) return "red";
  if (p >= 5) return "amber";
  return "green";
}

// A stop probability is never exactly zero. The reporting MC runs 2000 paths,
// so it cannot resolve below ~0.05%; anything that rounds to 0.0 is a
// resolution floor, not a true zero. Show "<0.1%" rather than a false "0.0%".
function fmtPstop(p: number | null): string {
  if (p == null) return "—";
  if (p < 0.1) return "<0.1%";
  return `${p.toFixed(1)}%`;
}

function volBudgetBand(r: number | null): Band {
  // realized_spread_vol / target_spread_vol at current gross.
  // Target = the vol at which P(stop) = 5%/yr at current gross.
  // < 0.5: alpha compressed — realized dispersion half of budgeted,
  //   strategy is under-utilizing its risk budget (Qube framing).
  // > 1.0: realized vol exceeds the vol that the DD budget assumes —
  //   over-risked, drawdown plan is under-reserved.
  if (r == null) return "green";
  if (r >= 1.0) return "red";
  if (r < 0.5) return "amber";
  return "green";
}

function volBudgetLabel(r: number | null): string {
  if (r == null) return "";
  if (r >= 1.0) return "over budget";
  if (r < 0.5) return "alpha compressed";
  if (r < 0.75) return "under-levered";
  return "calibrated";
}

export function RiskPostureBanner() {
  const { data, isLoading } = useRiskPosture();

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-1.5 text-xs text-gray-600">
        <span className="opacity-50">Loading risk posture…</span>
      </div>
    );
  }

  const dd = BAND_COLORS[data.dd_band];
  const gr = BAND_COLORS[data.gross_band];
  // Headline = elastic bookend: de-risk-aware, models the engine de-levering
  // as DD deepens (risk.compute_dd_scale). The conservative bookend
  // (no further de-risk) is kept visible in the sub-line.
  const psBand = pStopBand(data.p_stop_30d_pct_elastic);
  const ps = BAND_COLORS[psBand];
  // Headline shows both 30d bookends: elastic (de-risk aware) as the primary
  // figure, no-derisk (conservative) alongside it, each coloured by its own
  // band so a benign elastic number can't mask a hot conservative one.
  const ndBand = pStopBand(data.p_stop_30d_pct);
  const nd = BAND_COLORS[ndBand];
  const pstopValue = (
    <span className="flex items-baseline gap-1">
      <span className={ps.text}>{fmtPstop(data.p_stop_30d_pct_elastic)}</span>
      {data.p_stop_30d_pct != null && (
        <span className="text-[11px] font-normal text-gray-500">
          /{" "}
          <span className={nd.text}>{fmtPstop(data.p_stop_30d_pct)}</span>
        </span>
      )}
    </span>
  );
  const pstopSub =
    data.p_stop_7d_pct_elastic != null
      ? `elastic / no-derisk · 7d ${fmtPstop(data.p_stop_7d_pct_elastic)}`
      : "elastic / no-derisk";
  const vbBand = volBudgetBand(data.vol_budget_ratio);
  const vb = BAND_COLORS[vbBand];
  const regimeCol = REGIME_COLOR[data.vol_regime ?? "UNKNOWN"];

  return (
    <div className="flex items-center gap-5 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2 text-xs">
      <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Risk</span>

      <Metric
        label="σ EWMA"
        value={data.sigma_daily_pct != null ? `${data.sigma_daily_pct.toFixed(2)}%/d` : "—"}
        sub={data.sigma_annual_pct != null ? `${data.sigma_annual_pct.toFixed(1)}%/y` : undefined}
        valueClass={regimeCol}
        regime={data.vol_regime}
      />

      <Divider />

      <Metric
        label="P(stop) 30d"
        value={pstopValue}
        sub={pstopSub}
        dot={ps.dot}
      />

      <Divider />

      <Metric
        label="DD budget"
        value={`${data.dd_budget_used_pct.toFixed(0)}% used`}
        sub={`${data.dd_current_pct.toFixed(2)}% / ${data.dd_stop_pct.toFixed(1)}%`}
        valueClass={dd.text}
        dot={dd.dot}
      />

      <Divider />

      <Metric
        label="Gross budget"
        value={data.gross_budget_used_pct != null ? `${data.gross_budget_used_pct.toFixed(0)}% used` : "—"}
        sub={data.safe_gross_pct != null
          ? `${data.gross_current_pct.toFixed(0)}% / ${data.safe_gross_pct.toFixed(0)}% safe`
          : `${data.gross_current_pct.toFixed(0)}% current`}
        valueClass={gr.text}
        dot={gr.dot}
      />

      <Divider />

      <Metric
        label={`Vol budget${data.vol_budget_source === "mc" ? " (MC)" : data.vol_budget_source === "closed_form" ? " (CF)" : ""}`}
        value={data.vol_budget_ratio != null
          ? `${data.vol_budget_ratio.toFixed(2)}×`
          : "—"}
        sub={data.sigma_daily_pct != null && data.target_spread_vol_pct != null
          ? `${data.sigma_daily_pct.toFixed(2)}% / ${data.target_spread_vol_pct.toFixed(2)}% · ${volBudgetLabel(data.vol_budget_ratio)}`
          : volBudgetLabel(data.vol_budget_ratio)}
        valueClass={vb.text}
        dot={vb.dot}
      />

      <div className="ml-auto text-[10px] text-gray-600">
        Vol budget = realized / target (5% P(stop)/yr at current gross{data.vol_budget_source === "mc" ? ", MC w/ drift + elastic trim" : data.vol_budget_source === "closed_form" ? ", closed-form fallback" : ""}) · refreshed 60s
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  valueClass,
  dot,
  regime,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClass?: string;
  dot?: string;
  regime?: string | null;
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase text-gray-600 tracking-wide">{label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className={`font-semibold ${valueClass ?? "text-gray-200"}`}>{value}</span>
          {regime && <span className="text-[9px] text-gray-500 uppercase">{regime}</span>}
        </div>
      </div>
      {sub && <span className="text-[10px] text-gray-600">{sub}</span>}
    </div>
  );
}

function Divider() {
  return <span className="h-6 w-px bg-[var(--border)]" />;
}
