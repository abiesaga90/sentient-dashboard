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
 * Full uniMMR detail section for the Risk & Stress tab.
 *
 * Shows current value, breakdown (equity / MM / MM%), 7d sparkline with
 * threshold reference lines, and an explainer block that defines what
 * uniMMR is and why it governs PM liquidation.
 */
export function UniMMRDetail() {
  const { data: latest } = usePmRisk();
  const { data: hist } = usePmRiskHistory(168); // 7d

  const error = latest && "error" in latest ? (latest as { error: string }).error : null;
  const snap = latest && !error && "unimmr" in latest ? latest : null;

  const unimmr = snap?.unimmr ?? null;
  const status = snap?.status ?? null;

  // Badge
  let badgeVariant: "success" | "warning" | "danger" | "default" = "default";
  let statusLabel = "—";
  if (status === "HEALTHY") { badgeVariant = "success"; statusLabel = "Healthy"; }
  else if (status === "WARNING") { badgeVariant = "warning"; statusLabel = "Warning"; }
  else if (status === "REDUCTION") { badgeVariant = "warning"; statusLabel = "Reduction"; }
  else if (status === "LIQUIDATION") { badgeVariant = "danger"; statusLabel = "Liquidation"; }

  const displayUnimmr =
    unimmr === null ? "—"
      : unimmr >= 100 ? unimmr.toFixed(0)
      : unimmr >= 10 ? unimmr.toFixed(1)
      : unimmr.toFixed(2);

  // Chart data: cap display at 10 so the detail of low values is visible.
  // Store the raw value too for the tooltip.
  const chartData = (hist?.history ?? [])
    .filter((r) => r.unimmr != null)
    .map((r) => {
      const raw = Number(r.unimmr);
      return {
        t: new Date(r.timestamp).getTime(),
        unimmr_raw: raw,
        unimmr_clipped: Math.min(raw, 10),
        equity: r.account_equity ?? null,
        mm: r.account_maint_margin ?? null,
      };
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Portfolio Margin — uniMMR</CardTitle>
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
              : status === "WARNING" ? "text-yellow-400"
              : status === "REDUCTION" ? "text-orange-400"
              : status === "LIQUIDATION" ? "text-red-400"
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
          <div className="text-xs text-gray-500 mb-1">uniMMR — 7 day</div>
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
                domain={[0, 10]}
                ticks={[0, 1, 1.3, 2, 5, 10]}
              />
              {/* Threshold bands */}
              <ReferenceArea y1={0} y2={1} fill="#7f1d1d" fillOpacity={0.2} />
              <ReferenceArea y1={1} y2={1.3} fill="#9a3412" fillOpacity={0.2} />
              <ReferenceArea y1={1.3} y2={2} fill="#92400e" fillOpacity={0.2} />
              <ReferenceArea y1={2} y2={10} fill="#14532d" fillOpacity={0.12} />
              <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="4 4" />
              <ReferenceLine y={1.3} stroke="#f97316" strokeDasharray="4 4" />
              <ReferenceLine y={2} stroke="#eab308" strokeDasharray="4 4" />
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
            Chart capped at 10 for readability — actual values often much higher on a hedged book.
            Bands: red &lt; 1.0 liquidation · orange 1.0–1.3 reduction · yellow 1.3–2.0 warning · green &gt; 2.0 healthy.
          </div>
        </div>
      )}

      {/* ── Explainer ── */}
      <div className="mt-4 p-3 bg-gray-900/40 border border-gray-800 rounded text-[12px] text-gray-300 space-y-2">
        <div>
          <span className="text-gray-100 font-semibold">What is uniMMR?</span>{" "}
          The <em>Uniform Maintenance Margin Ratio</em> — the single number that
          governs liquidation on a Binance Portfolio Margin account.
          <div className="mt-1 font-mono text-gray-400 ml-3">
            uniMMR = Account Equity / Maintenance Margin Requirement
          </div>
        </div>
        <div>
          <span className="text-gray-100 font-semibold">Why it replaces per-symbol leverage on PM.</span>{" "}
          On Portfolio Margin, the whole book is one risk pool. The PM engine runs stress
          scenarios across every position and nets offsets — a long BTC hedged by a short
          basket requires far less margin than the sum of the legs. Individual symbol
          leverage fields (5x, 10x, 75x) still appear in the Binance UI but are
          cosmetic: they don't drive the margin calc or liquidation threshold.
          Only uniMMR does.
        </div>
        <div>
          <span className="text-gray-100 font-semibold">Thresholds</span>{" "}
          <span className="text-gray-500">(Binance defaults)</span>:
          <ul className="ml-5 list-disc mt-1 space-y-0.5">
            <li><span className="text-green-400 font-mono">&gt; 2.0</span> — healthy</li>
            <li><span className="text-yellow-400 font-mono">1.3 – 2.0</span> — warning, margin-call zone</li>
            <li><span className="text-orange-400 font-mono">1.1 – 1.3</span> — reduction, auto-reduce may trigger, position-opening blocked</li>
            <li><span className="text-red-400 font-mono">&lt; 1.0</span> — liquidation, PM engine liquidates across the book</li>
          </ul>
        </div>
        <div>
          <span className="text-gray-100 font-semibold">Why we watch the trend.</span>{" "}
          A beta-neutral L/S book sits at very high uniMMR (100+) under normal conditions
          because long and short legs offset in stress scenarios. When the hedge quality
          degrades — shorts rally while longs dump — the stress offset breaks down,
          the MM requirement spikes, and uniMMR falls. A trend from 100 → 10 → 3 is an
          early warning that the basket is no longer behaving as a spread, often
          <em> before</em> the 9.5% PTT-DD stop is triggered.
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
