import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

type Paper = {
  mode: string; venue: string; inception: string; as_of: string; days: number;
  nav_index: number; cum_return_nav_pct: number; dd_nav_pct: number;
  gross_pct: number; net_pct: number; net_beta: number; n_longs: number;
  last_rebalance: string; rebalance_days: number;
  gates: { roll4wk_sortino: number; scaling_ok: boolean; dd_gross_mult: number; hard_stop_breached: boolean };
  limits: { gross_cap_pct: number; net_cap_pct: number; dd_hard_nav_pct: number; dd_pause_nav_pct: number };
  book: { symbol: string; notional: number; pct: number; leg: string }[];
  nav_curve: { date: string; nav: number; dd: number }[];
  note: string;
};

function Kpi({ label, value, sub, tone = "cyan" }: { label: string; value: string; sub?: string; tone?: string }) {
  const c = tone === "red" ? "text-red-400" : tone === "amber" ? "text-amber-400" : tone === "green" ? "text-emerald-400" : "text-cyan-400";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${c}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function ExposureBar({ label, value, cap, capLabel }: { label: string; value: number; cap: number; capLabel: string }) {
  const pct = Math.min(100, Math.abs(value) / cap * 100);
  const over = Math.abs(value) > cap;
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={over ? "text-red-400" : "text-gray-200"}>{value}% <span className="text-gray-600">/ {capLabel}</span></span>
      </div>
      <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
        <div className={`h-full ${over ? "bg-red-500" : "bg-cyan-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EquityPmsDashboard() {
  const [p, setP] = useState<Paper | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch("/equity-rv/paper_state.json").then((r) => (r.ok ? r.json() : Promise.reject())).then(setP).catch(() => setErr(true));
  }, []);

  if (err) return <Shell><p className="text-gray-400">Paper state unavailable.</p></Shell>;
  if (!p) return <Shell><p className="text-gray-500">Loading…</p></Shell>;

  const ddTone = Math.abs(p.dd_nav_pct) >= p.limits.dd_hard_nav_pct ? "red" : Math.abs(p.dd_nav_pct) >= p.limits.dd_pause_nav_pct ? "amber" : "green";
  const sortino = p.gates.roll4wk_sortino;

  return (
    <Shell badge={`${p.mode} · ${p.venue} · as of ${p.as_of}`}>
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Kpi label="NAV (index 100)" value={p.nav_index.toFixed(1)} sub={`since ${p.inception}`} />
        <Kpi label="Cum return (NAV)" value={`${p.cum_return_nav_pct >= 0 ? "+" : ""}${p.cum_return_nav_pct.toFixed(1)}%`} sub={`${p.days} days`} tone={p.cum_return_nav_pct >= 0 ? "green" : "red"} />
        <Kpi label="Drawdown (NAV)" value={`${p.dd_nav_pct.toFixed(1)}%`} sub={`hard stop −${p.limits.dd_hard_nav_pct}%`} tone={ddTone} />
        <Kpi label="Net beta" value={`+${p.net_beta.toFixed(2)}`} sub="market sensitivity" />
        <Kpi label="Rolling-4wk Sortino" value={sortino.toFixed(2)} sub={`scale gate > 1.5`} tone={sortino > 1.5 ? "green" : "amber"} />
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {/* NAV curve */}
        <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-sm font-medium text-gray-200 mb-3">Paper NAV (index 100 at inception)</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={p.nav_curve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="nav" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} minTickGap={40} />
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 10, fill: "#64748b" }} width={42} />
              <RTooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
              <ReferenceLine y={100} stroke="#475569" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="nav" stroke="#22d3ee" strokeWidth={2} fill="url(#nav)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Exposure + gates */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-sm font-medium text-gray-200 mb-4">Exposure vs Nickel limits</div>
          <ExposureBar label="Gross" value={p.gross_pct} cap={p.limits.gross_cap_pct} capLabel={`${p.limits.gross_cap_pct}% cap`} />
          <ExposureBar label="Net (long)" value={p.net_pct} cap={p.limits.net_cap_pct} capLabel={`±${p.limits.net_cap_pct}% cap`} />
          <ExposureBar label="Drawdown" value={Math.abs(p.dd_nav_pct)} cap={p.limits.dd_hard_nav_pct} capLabel={`${p.limits.dd_hard_nav_pct}% stop`} />
          <div className="mt-4 pt-3 border-t border-[var(--border)] text-sm space-y-1.5">
            <Row k="Scaling gate" v={p.gates.scaling_ok ? "PASS" : "pause"} ok={p.gates.scaling_ok} />
            <Row k="De-risk gross mult" v={`${p.gates.dd_gross_mult}×`} ok={p.gates.dd_gross_mult >= 1} />
            <Row k="Hard stop" v={p.gates.hard_stop_breached ? "BREACHED" : "clear"} ok={!p.gates.hard_stop_breached} />
            <Row k="Last rebalance" v={p.last_rebalance ?? "—"} ok />
            <Row k="Cadence" v={`${p.rebalance_days}d`} ok />
          </div>
        </div>
      </div>

      {/* Positions */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="text-sm font-medium text-gray-200 mb-3">Current book — {p.n_longs} longs + hedge</div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-[var(--border)]">
            <tr><th className="text-left py-2">Symbol</th><th className="text-left">Leg</th><th className="text-right">Notional</th><th className="text-right">% notional</th></tr>
          </thead>
          <tbody>
            {p.book.map((b) => (
              <tr key={b.symbol} className="border-b border-[var(--border)]/40">
                <td className="py-2 text-gray-200 font-medium">{b.symbol}</td>
                <td className={b.leg === "hedge" ? "text-gray-500" : "text-cyan-400"}>{b.leg}</td>
                <td className="text-right text-gray-300">${b.notional.toLocaleString()}</td>
                <td className={`text-right ${b.pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{b.pct >= 0 ? "+" : ""}{b.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600 mt-4">{p.note}</p>
    </Shell>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{k}</span>
      <span className={ok ? "text-emerald-400" : "text-amber-400"}>{v}</span>
    </div>
  );
}

function Shell({ children, badge }: { children: React.ReactNode; badge?: string }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-gray-300">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <Link to="/equity-rv" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft size={16} /> Tokenized Equity L/S
        </Link>
        {badge && <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full border border-cyan-500/40 text-cyan-400">{badge}</span>}
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">Equity PMS — Operational Dashboard</h1>
        <p className="text-sm text-gray-500 mb-6">Paper-trade book, exposures, and risk gates. Research / pre-launch.</p>
        {children}
      </main>
    </div>
  );
}
