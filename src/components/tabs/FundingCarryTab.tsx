import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";

interface CarryRow {
  symbol: string;
  side: "LONG" | "SHORT";
  notional_usd: number;
  funding_rate_ann: number | null;
  funding_7d_ann: number | null;
  funding_30d_ann: number | null;
  carry_ann: number | null;
  carry_usd_yr: number;
  fund_mult: number;
  corr: number | null;
  wrong_side: boolean;
}

interface CarryPayload {
  available: boolean;
  enabled: boolean;
  reason?: string;
  computed_at?: string;
  summary?: {
    net_carry_usd_yr: number;
    net_carry_pct_notional: number;
    collected_all_time_usd: number;
    n_wrong_side: number;
    wrong_side_drag_usd_yr: number;
    coverage_pct: number;
    spreadvol_guard_pct: number;
    spreadvol_worst_delta_pct: number;
    spreadvol_breach: boolean;
    strength: number;
    lookback_days: number;
  };
  positions?: CarryRow[];
  wrong_side?: CarryRow[];
  long_basket_revisit?: CarryRow[];
  diagnostics?: {
    double_count?: string[];
    corr_aware?: boolean;
    clamp_ann_pct?: number;
    long_deadband?: number;
    short_deadband?: number;
  };
}

interface HistoryResp {
  history: {
    ts: string;
    net_carry_usd_yr: number;
    wrong_side_drag_usd_yr: number;
    spreadvol_worst_delta_pct: number;
  }[];
}

const tone = (v: number) =>
  Math.abs(v) < 0.01 ? "text-gray-300" : v > 0 ? "text-green-400" : "text-red-400";
const usd = (v: number | null | undefined) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}$${Math.round(v).toLocaleString()}`;
const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

function Kpi({ label, value, sub, klass }: { label: string; value: string; sub?: string; klass?: string }) {
  return (
    <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className={`text-lg font-mono font-semibold ${klass ?? "text-gray-200"}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export function FundingCarryTab() {
  const { client, engine } = useEngine();
  const { data } = useQuery<CarryPayload>({
    queryKey: ["funding-carry", engine.id],
    queryFn: () => client.get("/api/funding-carry/latest"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const { data: hist } = useQuery<HistoryResp>({
    queryKey: ["funding-carry-history", engine.id],
    queryFn: () => client.get("/api/funding-carry/history", { hours: 720 }),
    refetchInterval: 60_000,
  });

  if (!data) return <div className="text-gray-500 text-sm p-4">Loading funding carry…</div>;
  if (!data.available) {
    return (
      <div className="text-gray-500 text-sm p-4">
        Funding carry not available yet. {data.reason ?? ""}
      </div>
    );
  }

  const s = data.summary!;
  const diag = data.diagnostics ?? {};
  const rows = data.positions ?? [];
  const chartData = (hist?.history ?? []).map((h) => ({
    label: h.ts?.slice(5, 16)?.replace("T", " ") ?? "",
    carry: h.net_carry_usd_yr,
    drag: h.wrong_side_drag_usd_yr,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Funding Carry{" "}
            <span className="text-[10px] text-gray-500">
              (carry-aware sizing + selection · {data.enabled ? "LIVE" : "shadow"} ·
              strength {s.strength} · trailing {s.lookback_days}d)
            </span>
          </CardTitle>
        </CardHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs mb-3">
          <Kpi label="Net Carry / yr" value={usd(s.net_carry_usd_yr)}
               sub={`${pct(s.net_carry_pct_notional)} of notional`}
               klass={tone(s.net_carry_usd_yr)} />
          <Kpi label="Collected (all-time)" value={usd(s.collected_all_time_usd)}
               klass={tone(s.collected_all_time_usd)} />
          <Kpi label="Wrong-side drag / yr" value={usd(-Math.abs(s.wrong_side_drag_usd_yr))}
               sub={`${s.n_wrong_side} positions`} klass="text-red-400" />
          <Kpi label="Coverage" value={`${s.coverage_pct.toFixed(0)}%`} />
          <Kpi label="Spread-vol Δ" value={`${s.spreadvol_worst_delta_pct.toFixed(1)}%`}
               sub={`guard ${s.spreadvol_guard_pct}%`}
               klass={s.spreadvol_breach ? "text-red-400" : "text-green-400"} />
          <Kpi label="Double-count" value={`${(diag.double_count ?? []).length}`}
               sub={(diag.double_count ?? []).length === 0 ? "clean" : "review"}
               klass={(diag.double_count ?? []).length === 0 ? "text-green-400" : "text-red-400"} />
        </div>

        {chartData.length > 1 && (
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9 }} minTickGap={40} />
                <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                <Tooltip contentStyle={{ background: "#111118", border: "1px solid #1e1e2e", fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#334155" />
                <Line type="monotone" dataKey="carry" name="Net carry $/yr" stroke="#22c55e" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="drag" name="Wrong-side drag $/yr" stroke="#ef4444" strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle>Positions by carry</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr className="text-right">
                <th className="text-left py-1 px-2">Symbol</th>
                <th className="py-1 px-2">Side</th>
                <th className="py-1 px-2">Notional</th>
                <th className="py-1 px-2">Spot %</th>
                <th className="py-1 px-2">7d</th>
                <th className="py-1 px-2">30d</th>
                <th className="py-1 px-2">Carry $/yr</th>
                <th className="py-1 px-2">Corr</th>
                <th className="py-1 px-2">Tilt×</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}
                    className={`text-right border-t border-[var(--border)] ${r.wrong_side ? "bg-red-500/5" : ""}`}>
                  <td className="text-left py-1 px-2 font-medium">{r.symbol.replace("USDT", "")}</td>
                  <td className="py-1 px-2 text-gray-400">{r.side}</td>
                  <td className="py-1 px-2 font-mono">${Math.round(r.notional_usd).toLocaleString()}</td>
                  <td className="py-1 px-2 font-mono text-gray-400">{r.funding_rate_ann == null ? "—" : pct(r.funding_rate_ann)}</td>
                  <td className="py-1 px-2 font-mono text-gray-400">{pct(r.funding_7d_ann)}</td>
                  <td className="py-1 px-2 font-mono text-gray-300">{pct(r.funding_30d_ann)}</td>
                  <td className={`py-1 px-2 font-mono ${tone(r.carry_usd_yr)}`}>{usd(r.carry_usd_yr)}</td>
                  <td className="py-1 px-2 font-mono text-gray-400">{r.corr == null ? "—" : r.corr.toFixed(2)}</td>
                  <td className={`py-1 px-2 font-mono ${r.fund_mult > 1.001 ? "text-green-400" : r.fund_mult < 0.999 ? "text-red-400" : "text-gray-500"}`}>
                    {r.fund_mult.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Wrong-side drags (de-emphasized)</CardTitle></CardHeader>
          <table className="w-full text-xs">
            <tbody>
              {(data.wrong_side ?? []).map((r) => (
                <tr key={r.symbol} className="border-t border-[var(--border)]">
                  <td className="py-1 px-2 font-medium">{r.symbol.replace("USDT", "")}</td>
                  <td className="py-1 px-2 text-gray-400">{r.side}</td>
                  <td className="py-1 px-2 font-mono text-right text-gray-400">{pct(r.carry_ann)} ann</td>
                  <td className="py-1 px-2 font-mono text-right text-red-400">{usd(r.carry_usd_yr)}</td>
                  <td className="py-1 px-2 font-mono text-right text-gray-500">×{r.fund_mult.toFixed(2)}</td>
                </tr>
              ))}
              {(data.wrong_side ?? []).length === 0 && (
                <tr><td className="py-2 px-2 text-gray-600">No wrong-side positions</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader><CardTitle>Long-basket carry revisit</CardTitle></CardHeader>
          <table className="w-full text-xs">
            <tbody>
              {(data.long_basket_revisit ?? []).map((r) => (
                <tr key={r.symbol} className="border-t border-[var(--border)]">
                  <td className="py-1 px-2 font-medium">{r.symbol.replace("USDT", "")}</td>
                  <td className="py-1 px-2 font-mono text-right text-gray-400">{pct(r.carry_ann)} ann</td>
                  <td className={`py-1 px-2 font-mono text-right ${tone(r.carry_usd_yr)}`}>{usd(r.carry_usd_yr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-gray-600 px-2 py-1">
            Static conviction longs ranked by carry. Bleeders (negative carry/yr) are
            candidates to resize or drop — discretionary, not auto-acted.
          </div>
        </Card>
      </div>

      <div className="text-[10px] text-gray-600">
        Diagnostics: corr-aware {String(diag.corr_aware)} · clamp {diag.clamp_ann_pct}% ·
        long deadband {diag.long_deadband}% · short deadband {diag.short_deadband}% ·
        computed {data.computed_at?.slice(0, 19).replace("T", " ")}
      </div>
    </div>
  );
}
