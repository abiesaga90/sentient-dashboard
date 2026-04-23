import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import {
  usePmRisk,
  usePmRiskHistory,
} from "../../hooks/useDashboardQuery";
import { formatUSD, cn } from "../../lib/utils";

/**
 * uniMMR detail for Risk & Stress — HEDGE QUALITY framing.
 *
 * uniMMR technically governs PM liquidation at < 1.0, but on a beta-neutral
 * L/S book it sits at 50+ because the PM engine nets longs and shorts in
 * stress. Liquidation is never a realistic concern — the 9.5% PTT-DD stop
 * would trip ~15× before uniMMR could reach 1.0. We use uniMMR instead as
 * a leading indicator of hedge quality: falling values flag that the L/S
 * stress offset is breaking down.
 */
export function UniMMRDetail() {
  const { data: latest } = usePmRisk();
  const { data: hist } = usePmRiskHistory(168); // 7d

  const error = latest && "error" in latest ? (latest as { error: string }).error : null;
  const snap = latest && !error && "unimmr" in latest ? latest : null;

  const unimmr = snap?.unimmr ?? null;
  const status = snap?.status ?? null;

  // Badge — hedge-quality framing (not liquidation).
  let badgeVariant: "success" | "warning" | "danger" | "default" = "default";
  let statusLabel = "—";
  if (status === "HEALTHY") { badgeVariant = "success"; statusLabel = "Hedge Healthy"; }
  else if (status === "DEGRADED") { badgeVariant = "warning"; statusLabel = "Hedge Degraded"; }
  else if (status === "POOR") { badgeVariant = "warning"; statusLabel = "Hedge Poor"; }
  else if (status === "CRITICAL") { badgeVariant = "danger"; statusLabel = "Hedge Critical"; }

  const displayUnimmr =
    unimmr === null ? "—"
      : unimmr >= 100 ? unimmr.toFixed(0)
      : unimmr >= 10 ? unimmr.toFixed(1)
      : unimmr.toFixed(2);

  // Sparkline capped at 200 so meaningful range (5-100) has vertical
  // resolution; hedged-book uniMMR can spike much higher but those peaks
  // carry no actionable info.
  const CHART_CAP = 200;
  const chartData = (hist?.history ?? [])
    .filter((r) => r.unimmr != null)
    .map((r) => {
      const raw = Number(r.unimmr);
      return {
        t: new Date(r.timestamp).getTime(),
        unimmr_raw: raw,
        unimmr_clipped: Math.min(raw, CHART_CAP),
        equity: r.account_equity ?? null,
        mm: r.account_maint_margin ?? null,
      };
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Hedge Quality — uniMMR</CardTitle>
          <Badge variant={badgeVariant}>{statusLabel}</Badge>
        </div>
      </CardHeader>

      {/* ── Headline number + breakdown ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
        <div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wide">uniMMR</div>
          <div className={cn(
            "text-3xl font-bold font-mono",
            status === "HEALTHY" ? "text-green-400"
              : status === "DEGRADED" ? "text-yellow-400"
              : status === "POOR" ? "text-orange-400"
              : status === "CRITICAL" ? "text-red-400"
              : "text-gray-400"
          )}>
            {displayUnimmr}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            = equity / maint. margin
          </div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wide">Account Equity</div>
          <div className="text-xl font-mono text-gray-200">
            {snap?.account_equity != null ? formatUSD(snap.account_equity, 0) : "—"}
          </div>
          {snap?.actual_equity != null && snap.account_equity != null &&
           Math.abs(snap.actual_equity - snap.account_equity) > 0.5 && (
            <div className="text-[11px] text-gray-500 mt-0.5">
              actual: {formatUSD(snap.actual_equity, 0)}
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wide">Maint. Margin</div>
          <div className="text-xl font-mono text-gray-200">
            {snap?.account_maint_margin != null ? formatUSD(snap.account_maint_margin, 0) : "—"}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {snap?.mm_pct != null ? `${snap.mm_pct.toFixed(2)}% of equity` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wide">Initial Margin</div>
          <div className="text-xl font-mono text-gray-200">
            {snap?.account_initial_margin != null ? formatUSD(snap.account_initial_margin, 0) : "—"}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            required to open
          </div>
        </div>
      </div>

      {/* ── Sparkline (7d) ── */}
      {chartData.length > 1 && (
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-1">uniMMR — 7 day (hedge-quality bands)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                stroke="#6b7280"
                fontSize={10}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={10}
                domain={[0, CHART_CAP]}
                ticks={[0, 5, 20, 50, 100, 200]}
              />
              {/* Hedge-quality bands (strategy-calibrated, NOT Binance liquidation) */}
              <ReferenceArea y1={0} y2={5} fill="#7f1d1d" fillOpacity={0.2} />
              <ReferenceArea y1={5} y2={20} fill="#9a3412" fillOpacity={0.2} />
              <ReferenceArea y1={20} y2={50} fill="#92400e" fillOpacity={0.2} />
              <ReferenceArea y1={50} y2={CHART_CAP} fill="#14532d" fillOpacity={0.12} />
              <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="4 4" />
              <ReferenceLine y={20} stroke="#f97316" strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke="#eab308" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", fontSize: 11 }}
                labelFormatter={(v) => new Date(v as number).toLocaleString()}
                formatter={(value, name, item) => {
                  const nm = String(name ?? "");
                  if (nm === "unimmr_clipped") {
                    const raw = (item as { payload?: { unimmr_raw?: number } })?.payload?.unimmr_raw;
                    const display = raw != null
                      ? (raw >= 100 ? raw.toFixed(0) : raw >= 10 ? raw.toFixed(1) : raw.toFixed(2))
                      : "—";
                    return [display, "uniMMR"];
                  }
                  return [String(value), nm];
                }}
              />
              <Line
                type="monotone"
                dataKey="unimmr_clipped"
                stroke="#60a5fa"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-[10px] text-gray-600 mt-1">
            Chart capped at {CHART_CAP} for readability — actual values can be much higher when the hedge is strong.
            Bands: <span className="text-red-400">&lt; 5 critical</span> · <span className="text-orange-400">5–20 poor</span> · <span className="text-yellow-400">20–50 degraded</span> · <span className="text-green-400">&ge; 50 healthy</span>.
          </div>
        </div>
      )}

      {/* ── Explainer ── */}
      <div className="mt-4 p-3 bg-gray-900/40 border border-gray-800 rounded text-[12px] text-gray-300 space-y-2">
        <div>
          <span className="text-gray-100 font-semibold">What is uniMMR?</span>{" "}
          The <em>Uniform Maintenance Margin Ratio</em> — the ratio Binance
          uses to trigger liquidation on a Portfolio Margin account when it
          falls below 1.0.
          <div className="mt-1 font-mono text-gray-400 ml-3">
            uniMMR = Account Equity / Maintenance Margin Requirement
          </div>
        </div>
        <div>
          <span className="text-gray-100 font-semibold">Why liquidation is not a real concern for us.</span>{" "}
          On a beta-neutral L/S book the PM engine nets longs and shorts in
          its stress scenarios, so MM requirement stays tiny (typically &lt;1%
          of equity) and uniMMR sits at 50+. For uniMMR to hit Binance's
          liquidation threshold of 1.0 we'd need to lose ~99% of account
          equity — but the <span className="font-mono">9.5%</span> PTT-DD
          stop would cut positions ~15× earlier.
        </div>
        <div>
          <span className="text-gray-100 font-semibold">What we actually watch it for: hedge quality.</span>{" "}
          uniMMR is the cleanest real-time readout of whether the L/S
          correlation structure is still working. When longs dump <em>and</em>
          shorts rally (hedge breakdown), the PM stress offset collapses,
          MM requirement rises, and uniMMR falls. A 7-day trend from
          150 → 50 → 20 tells us the basket is no longer behaving like a
          spread — often <em>before</em> PnL shows the full damage.
        </div>
        <div>
          <span className="text-gray-100 font-semibold">Thresholds</span>{" "}
          <span className="text-gray-500">(strategy-calibrated, not Binance's liquidation bands)</span>:
          <ul className="ml-5 list-disc mt-1 space-y-0.5">
            <li><span className="text-green-400 font-mono">&ge; 50</span> — healthy, hedge working normally</li>
            <li><span className="text-yellow-400 font-mono">20 – 50</span> — degraded, watch closely</li>
            <li><span className="text-orange-400 font-mono">5 – 20</span> — poor, hedge materially broken</li>
            <li><span className="text-red-400 font-mono">&lt; 5</span> — critical, DD stop should have fired</li>
          </ul>
          <div className="text-[11px] text-gray-500 mt-1">
            For reference, Binance's own bands are 2.0 / 1.3 / 1.1 / 1.0 — we
            operate ~70× above the first one, so they are not actionable here.
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-[11px] text-yellow-400/80">
          Balance proxy hasn't returned PM data yet — the engine pulls every 60s from the VPS.
        </div>
      )}
    </Card>
  );
}
