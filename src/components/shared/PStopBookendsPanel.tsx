import { useRiskPosture } from "../../hooks/useDashboardQuery";
import { Card, CardHeader, CardTitle } from "../ui/Card";

// P(stop) is a Monte Carlo first-passage probability — the chance the book
// hits the DD stop within the horizon. The engine returns three model
// variants ("bookends") plus a σ-fan; this panel surfaces all of them so the
// engine-response assumption is explicit instead of hidden in one number.

type Band = "green" | "amber" | "red";

const BAND_TEXT: Record<Band, string> = {
  green: "text-green-400",
  amber: "text-yellow-400",
  red: "text-red-400",
};

// Same thresholds as the Risk Posture banner: <5% green, 5–15% amber, ≥15% red.
function band(p: number | null): Band {
  if (p == null) return "green";
  if (p >= 15) return "red";
  if (p >= 5) return "amber";
  return "green";
}

function fmt(p: number | null): string {
  return p == null ? "—" : `${p.toFixed(1)}%`;
}

function Cell({ value }: { value: number | null }) {
  return (
    <td className={`px-3 py-2 text-right font-medium tabular-nums ${BAND_TEXT[band(value)]}`}>
      {fmt(value)}
    </td>
  );
}

// σ-fan cell: a low–high range, coloured by the high (worst) end.
function RangeCell({ lo, hi }: { lo: number | null; hi: number | null }) {
  const text = lo == null && hi == null ? "—" : `${fmt(lo)} – ${fmt(hi)}`;
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${BAND_TEXT[band(hi)]}`}>
      {text}
    </td>
  );
}

export function PStopBookendsPanel() {
  const { data, isLoading } = useRiskPosture();

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>P(stop) Bookends</CardTitle>
        </CardHeader>
        <div className="text-sm text-gray-500">Loading…</div>
      </Card>
    );
  }

  const sigmaFan =
    data.sigma_low_pct != null && data.sigma_high_pct != null
      ? `σ ${data.sigma_low_pct.toFixed(2)}–${data.sigma_high_pct.toFixed(2)}%/d`
      : "p5–p95 vol";

  return (
    <Card>
      <CardHeader>
        <CardTitle>P(stop) Bookends</CardTitle>
      </CardHeader>

      <div className="pb-3 text-xs text-gray-400 leading-relaxed space-y-1.5">
        <p>
          <strong className="text-gray-300">What you&rsquo;re looking at.</strong>{" "}
          Monte-Carlo probability of hitting the drawdown stop within each
          horizon. The three rows differ only in how the engine&rsquo;s
          de-risking is modelled — reality sits between them.
        </p>
        <p>
          <strong className="text-green-400">Elastic</strong> models the engine
          de-levering continuously as DD deepens (
          <code>risk.compute_dd_scale</code>) — the realistic, de-risk-aware
          number, and what the Risk Posture banner headlines.{" "}
          <strong className="text-gray-300">Bootstrap</strong> resamples actual
          historical returns (fat tails, skew) under the conservative engine
          assumption.{" "}
          <strong className="text-gray-300">Conservative</strong> assumes the
          engine never de-risks further — the pessimistic upper bound.
        </p>
        <p className="text-[11px] text-gray-500">
          σ-fan = conservative P(stop) at the 5th / 95th percentile of
          rolling-30d realized vol ({sigmaFan}), i.e. the regime-uncertainty
          band around the point estimate.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">Variant</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">7d</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">30d</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">365d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            <tr>
              <td className="px-3 py-2 text-gray-300">
                Elastic <span className="text-gray-500">(de-risk aware)</span>
              </td>
              <Cell value={data.p_stop_7d_pct_elastic} />
              <Cell value={data.p_stop_30d_pct_elastic} />
              <Cell value={data.p_stop_365d_pct_elastic} />
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-300">
                Bootstrap <span className="text-gray-500">(hist. tails)</span>
              </td>
              <Cell value={data.p_stop_7d_pct_bootstrap} />
              <Cell value={data.p_stop_30d_pct_bootstrap} />
              <Cell value={data.p_stop_365d_pct_bootstrap} />
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-300">
                Conservative <span className="text-gray-500">(no de-risk)</span>
              </td>
              <Cell value={data.p_stop_7d_pct} />
              <Cell value={data.p_stop_30d_pct} />
              <Cell value={data.p_stop_365d_pct} />
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-500">σ-fan (p5–p95 vol)</td>
              <RangeCell lo={data.p_stop_7d_pct_low_vol} hi={data.p_stop_7d_pct_high_vol} />
              <RangeCell lo={data.p_stop_30d_pct_low_vol} hi={data.p_stop_30d_pct_high_vol} />
              <RangeCell lo={data.p_stop_365d_pct_low_vol} hi={data.p_stop_365d_pct_high_vol} />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
