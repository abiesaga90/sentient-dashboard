import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import type { RankingCandidate } from "../../types/api";

interface UnlockEvent {
  date: string;
  pct_of_max: number;
  amount_tokens: number;
  categories: string[];
}

interface UnlockSchedule {
  next_events: UnlockEvent[];
  days_until_next: number | null;
  unlock_pressure_30d: number;
  total_events: number;
}

interface ShortThesisData {
  name: string;
  thesis: string;
  bull_case: string[];
  bear_case: string[];
  key_metrics: Record<string, string>;
  category: string;
}

function SignalRow({
  name,
  value,
  signal,
  zScore,
  weight,
}: {
  name: string;
  value: number | null | undefined;
  signal: number | null | undefined;
  zScore?: number | null;
  weight: number;
}) {
  const hasData = signal != null;
  const sigColor =
    signal != null
      ? signal > 0
        ? "text-green-400"
        : signal < 0
          ? "text-red-400"
          : "text-gray-600"
      : "text-gray-700";
  return (
    <div className="grid grid-cols-[1fr_50px_60px_60px] gap-2 font-mono px-2 py-1 bg-[var(--bg-secondary)] rounded items-center text-[11px]">
      <span className={hasData ? "text-gray-400" : "text-gray-700"}>
        {name}
      </span>
      <span className="text-gray-600 text-right">{(weight * 100).toFixed(0)}%</span>
      <span className={`text-right ${sigColor}`}>
        {hasData ? `${signal! > 0 ? "+" : ""}${signal!.toFixed(3)}` : "—"}
      </span>
      <span className="text-right text-gray-600">
        {zScore != null ? `z${zScore > 0 ? "+" : ""}${zScore.toFixed(1)}` : ""}
      </span>
    </div>
  );
}

function UnlockBadge({ days }: { days: number | null }) {
  if (days == null) return null;
  const color =
    days <= 14
      ? "bg-red-900/50 text-red-300 border-red-700"
      : days <= 30
        ? "bg-yellow-900/50 text-yellow-300 border-yellow-700"
        : "bg-green-900/50 text-green-300 border-green-700";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color}`}>
      {days}d
    </span>
  );
}

export function ShortDetailView({
  candidate,
  onClose,
}: {
  candidate: RankingCandidate;
  onClose: () => void;
}) {
  const c = candidate;
  const thesis = c.short_thesis as ShortThesisData | undefined;
  const unlock = c.unlock_schedule as UnlockSchedule | undefined;
  const va = c.va_signals || {};
  const sm = c.sm_signals || {};

  const isDilution = (c.fdv_mcap_ratio ?? 0) >= 5.0;
  const categoryBadge = isDilution ? "DILUTION OVERRIDE" : thesis?.category === "pump_exhaustion" ? "PUMP EXHAUSTION" : "CORRELATED";
  const categoryColor = isDilution ? "bg-orange-900/50 text-orange-300 border-orange-700" : thesis?.category === "pump_exhaustion" ? "bg-purple-900/50 text-purple-300 border-purple-700" : "bg-blue-900/50 text-blue-300 border-blue-700";

  return (
    <Card className="border-l-2 border-l-orange-500">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-100">
              {c.symbol.replace("USDT", "")}
            </span>
            {thesis && (
              <span className="text-sm text-gray-500">{thesis.name}</span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded border ${categoryColor}`}>
              {categoryBadge}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            Close
          </button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Score", value: c.score.toFixed(4) },
            {
              label: "FDV/MCap",
              value: c.fdv_mcap_ratio ? `${c.fdv_mcap_ratio.toFixed(1)}x` : "—",
            },
            { label: "Confidence", value: `${(c.fund_confidence * 100).toFixed(0)}%` },
            { label: "Corr", value: c.corr.toFixed(3) },
            { label: "Beta", value: c.beta.toFixed(3) },
            {
              label: "Volume",
              value: `$${(c.volume_24h / 1e6).toFixed(1)}M`,
            },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-[10px] text-gray-600 uppercase">{label}</div>
              <div className="text-sm font-medium text-gray-200">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Three-Pillar Breakdown */}
        <div className="space-y-3">
          {/* P1: Value Accrual (inverted) */}
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
              P1: Value Accrual (inverted — higher = weaker = better short)
            </div>
            <div className="space-y-1">
              {[
                { name: "Dilution (FDV/MCap)", key: "dilution" },
                { name: "Supply Momentum", key: "supply_delta" },
                { name: "Buyback Intensity", key: "buyback" },
                { name: "Revenue Capture", key: "rev_capture" },
                { name: "Fee Momentum", key: "fee_momentum" },
                { name: "Unlock Pressure", key: "unlock" },
              ].map(({ name, key }) => {
                const sig = va[key];
                return (
                  <SignalRow
                    key={key}
                    name={name}
                    value={sig?.value}
                    signal={sig?.signal}
                    zScore={sig?.z_score}
                    weight={sig?.weight ?? 0}
                  />
                );
              })}
            </div>
            <div className="flex justify-between font-mono px-2 pt-1 text-gray-300 text-[11px]">
              <span>Fund Score ({c.n_fund_signals} signals)</span>
              <span
                className={
                  c.fund_score > 0
                    ? "text-red-400"
                    : c.fund_score < 0
                      ? "text-green-400"
                      : "text-gray-400"
                }
              >
                {c.fund_score > 0 ? "+" : ""}
                {c.fund_score.toFixed(4)}
              </span>
            </div>
          </div>

          {/* P2: Smart Money */}
          {sm && Object.keys(sm).length > 0 && (
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                P2: Smart Money
              </div>
              <div className="space-y-1">
                {Object.entries(sm).map(([key, sig]) => (
                  <div
                    key={key}
                    className="grid grid-cols-[1fr_60px] gap-2 font-mono px-2 py-1 bg-[var(--bg-secondary)] rounded items-center text-[11px]"
                  >
                    <span className="text-gray-400">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`text-right ${
                        (sig as any)?.signal > 0
                          ? "text-green-400"
                          : (sig as any)?.signal < 0
                            ? "text-red-400"
                            : "text-gray-600"
                      }`}
                    >
                      {(sig as any)?.signal != null
                        ? ((sig as any).signal as number).toFixed(3)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Thesis + Unlock */}
        <div className="space-y-3">
          {/* Short Thesis */}
          {thesis && (
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                Short Thesis
              </div>
              <div className="bg-[var(--bg-secondary)] rounded p-3 text-[12px] text-gray-300 mb-3">
                {thesis.thesis}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-red-400 uppercase mb-1">
                    Bear Case
                  </div>
                  <ul className="text-[11px] text-gray-400 space-y-0.5">
                    {thesis.bear_case.map((b, i) => (
                      <li key={i}>
                        <span className="text-red-500 mr-1">-</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] text-yellow-400 uppercase mb-1">
                    Bull Case (Risks)
                  </div>
                  <ul className="text-[11px] text-gray-400 space-y-0.5">
                    {thesis.bull_case.map((b, i) => (
                      <li key={i}>
                        <span className="text-yellow-500 mr-1">+</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* Key Metrics */}
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(thesis.key_metrics).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between bg-gray-900/50 rounded px-2 py-1"
                  >
                    <span className="text-[10px] text-gray-600">{k}</span>
                    <span className="text-[11px] text-gray-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unlock Schedule */}
          {unlock && unlock.next_events.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                Unlock Schedule
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-2 mb-2">
                <div className="text-[10px] text-gray-500">30d pressure:</div>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{
                      width: `${Math.min(100, unlock.unlock_pressure_30d * 20)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-gray-400">
                  {unlock.unlock_pressure_30d}%
                </span>
              </div>
              {/* Events */}
              <div className="space-y-1">
                {unlock.next_events.map((evt, i) => {
                  const days = Math.max(
                    0,
                    Math.floor(
                      (new Date(evt.date).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                  );
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[80px_50px_1fr_40px] gap-2 font-mono px-2 py-1.5 bg-[var(--bg-secondary)] rounded items-center text-[11px]"
                    >
                      <span className="text-gray-300">{evt.date.slice(5)}</span>
                      <span className="text-red-400">
                        {evt.pct_of_max.toFixed(2)}%
                      </span>
                      <span className="text-gray-500">
                        {(evt.amount_tokens / 1e6).toFixed(0)}M tokens
                      </span>
                      <UnlockBadge days={days} />
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-gray-600 mt-1">
                {unlock.total_events} total events
              </div>
            </div>
          )}

          {/* No thesis fallback */}
          {!thesis && !unlock && (
            <div className="text-gray-600 text-sm text-center py-8">
              No deep dive data available for this token
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
