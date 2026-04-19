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

function corrBand(c: number | null): Band {
  if (c == null) return "green";
  if (c >= 0.95) return "amber"; // dispersion collapse risk
  if (c <= 0.50) return "amber"; // decorrelation = basis risk
  return "green";
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
  const psBand = pStopBand(data.p_stop_30d_pct);
  const ps = BAND_COLORS[psBand];
  const cBand = corrBand(data.ls_correlation_30d);
  const cCol = BAND_COLORS[cBand];
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
        value={data.p_stop_30d_pct != null ? `${data.p_stop_30d_pct.toFixed(1)}%` : "—"}
        sub={data.p_stop_7d_pct != null ? `7d: ${data.p_stop_7d_pct.toFixed(1)}%` : undefined}
        valueClass={ps.text}
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
        label="L/S corr 30d"
        value={data.ls_correlation_30d != null ? data.ls_correlation_30d.toFixed(3) : "—"}
        sub={data.ls_correlation_30d != null && data.ls_correlation_30d >= 0.95
          ? "dispersion tight"
          : data.ls_correlation_30d != null && data.ls_correlation_30d <= 0.50
          ? "basis risk"
          : "healthy"}
        valueClass={cCol.text}
      />

      <div className="ml-auto text-[10px] text-gray-600">
        MC elastic-trim aware · refreshed 60s
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
  value: string;
  sub?: string;
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
