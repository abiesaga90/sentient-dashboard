import { useEffect, useState, Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

type Pos = {
  symbol: string; side: string; qty: number | null; entry: number | null; mark: number | null;
  notional: number; pct: number; upnl: number; upnl_pct: number; funding_apr: number | null;
  held_days: number | null; name: string | null; sector: string | null; market_cap: number | null;
  beta: number | null; beta_contrib: number | null;
};
const mcap = (n: number | null) => (n == null ? "—" : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(0)}B` : `$${(n / 1e6).toFixed(0)}M`);
type Paper = {
  mode: string; venue: string; inception: string; as_of: string; days: number;
  nav_index: number; cum_return_nav_pct: number; dd_nav_pct: number; max_dd_nav_pct: number;
  sharpe: number; sortino: number; gross_pct: number; net_pct: number; net_beta: number; n_longs: number;
  gross_pct_nav: number; net_pct_nav: number; unimmr: number | null; unimmr_est: boolean;
  pnl_periods: { wtd: number; mtd: number; qtd: number; ytd: number; all_time: number };
  last_rebalance: string; rebalance_days: number;
  gates: { roll4wk_sortino: number; scaling_ok: boolean; dd_gross_mult: number; hard_stop_breached: boolean };
  limits: { gross_cap_pct: number; net_cap_pct: number; dd_hard_nav_pct: number; dd_pause_nav_pct: number };
  book: Pos[];
  nav_curve: { date: string; nav: number }[];
  note: string;
};

const f1 = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1);
const usd = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

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
  const pct = Math.min(100, (Math.abs(value) / cap) * 100);
  const over = Math.abs(value) > cap;
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={over ? "text-red-400" : "text-gray-200"}>{value.toFixed(1)}% <span className="text-gray-600">/ {capLabel}</span></span>
      </div>
      <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
        <div className={`h-full ${over ? "bg-red-500" : "bg-cyan-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok: boolean }) {
  return (
    <div className="flex justify-between"><span className="text-gray-400">{k}</span>
      <span className={ok ? "text-emerald-400" : "text-amber-400"}>{v}</span></div>
  );
}

function NavChart({ curve }: { curve: { date: string; nav: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={curve} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="nav" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} minTickGap={50} />
        <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 10, fill: "#64748b" }} width={42} />
        <RTooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
        <ReferenceLine y={100} stroke="#475569" strokeDasharray="3 3" />
        <Area type="monotone" dataKey="nav" stroke="#22d3ee" strokeWidth={2} fill="url(#nav)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PnlPeriods({ p }: { p: Paper }) {
  const items: [string, number][] = [["WTD", p.pnl_periods.wtd], ["MTD", p.pnl_periods.mtd],
    ["QTD", p.pnl_periods.qtd], ["YTD", p.pnl_periods.ytd], ["All-time", p.pnl_periods.all_time]];
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 mb-6">
      <div className="text-sm font-medium text-gray-200 mb-3">P&amp;L (NAV basis)</div>
      <div className="grid grid-cols-5 gap-3">
        {items.map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] uppercase tracking-wider text-gray-500">{k}</div>
            <div className={`text-lg font-semibold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>{f1(v)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Movers({ book }: { book: Pos[] }) {
  const named = book.filter((b) => b.side !== "hedge");
  const win = [...named].sort((a, b) => b.upnl - a.upnl).slice(0, 3);
  const los = [...named].sort((a, b) => a.upnl - b.upnl).slice(0, 3);
  const row = (b: Pos) => (
    <div key={b.symbol} className="flex justify-between text-sm">
      <span className="text-gray-300">{b.symbol}</span>
      <span className={b.upnl >= 0 ? "text-emerald-400" : "text-red-400"}>{usd(b.upnl)} ({f1(b.upnl_pct)}%)</span>
    </div>
  );
  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="text-sm font-medium text-emerald-400 mb-2">Top gainers</div><div className="space-y-1">{win.map(row)}</div></div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="text-sm font-medium text-red-400 mb-2">Top losers</div><div className="space-y-1">{los.map(row)}</div></div>
    </div>
  );
}

function OverviewTab({ p }: { p: Paper }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Kpi label="NAV (index 100)" value={p.nav_index.toFixed(1)} sub={`since ${p.inception}`} />
        <Kpi label="Cum return (NAV)" value={`${f1(p.cum_return_nav_pct)}%`} sub={`${p.days} trading days`} tone={p.cum_return_nav_pct >= 0 ? "green" : "red"} />
        <Kpi label="Sharpe" value={p.sharpe.toFixed(2)} sub="since inception" />
        <Kpi label="Sortino" value={p.sortino.toFixed(2)} sub="since inception" tone="green" />
        <Kpi label="Net beta" value={`+${p.net_beta.toFixed(2)}`} sub="market sensitivity" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 mb-6">
        <div className="text-sm font-medium text-gray-200 mb-3">Paper NAV (index 100 at inception)</div>
        <NavChart curve={p.nav_curve} />
      </div>
      <PnlPeriods p={p} />
      <Movers book={p.book} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"><div className="text-gray-500 text-xs mb-1">Gross / Net</div><div className="text-gray-200">{p.gross_pct.toFixed(0)}% / {f1(p.net_pct)}%</div></div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"><div className="text-gray-500 text-xs mb-1">Max drawdown</div><div className="text-gray-200">{p.max_dd_nav_pct.toFixed(1)}%</div></div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"><div className="text-gray-500 text-xs mb-1">Last rebalance</div><div className="text-gray-200">{p.last_rebalance ?? "—"}</div></div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"><div className="text-gray-500 text-xs mb-1">Scaling gate</div><div className={p.gates.scaling_ok ? "text-emerald-400" : "text-amber-400"}>{p.gates.scaling_ok ? "PASS" : "pause"}</div></div>
      </div>
    </>
  );
}

function BuildupChart({ book }: { book: Pos[] }) {
  const [mode, setMode] = useState<"notional" | "beta">("notional");
  const val = (b: Pos) => (mode === "notional" ? b.pct : b.beta_contrib ?? 0);
  const fmt = (v: number) => (mode === "notional" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : `${v >= 0 ? "+" : ""}${v.toFixed(2)}β`);
  const items = [...book].sort((a, b) => val(b) - val(a));   // longs (desc) → hedges, then NET
  let cum = 0;
  const data = items.map((b) => {
    const start = cum; cum += val(b);
    return { name: b.symbol, base: Math.min(start, cum), bar: Math.abs(val(b)), v: val(b), kind: b.side };
  });
  data.push({ name: "NET", base: Math.min(0, cum), bar: Math.abs(cum), v: cum, kind: "net" });
  const color = (k: string) => (k === "net" ? "#22d3ee" : k === "hedge" ? "#f87171" : "#34d399");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-200">Exposure build-up
          <span className="text-gray-500 font-normal"> — how longs + hedge combine to net {mode === "notional" ? "notional" : "beta"} ({fmt(cum)})</span></div>
        <div className="flex gap-1 text-xs">
          <button onClick={() => setMode("notional")} className={`px-2.5 py-1 rounded-lg border ${mode === "notional" ? "border-cyan-500 text-cyan-400" : "border-[var(--border)] text-gray-500"}`}>Net notional</button>
          <button onClick={() => setMode("beta")} className={`px-2.5 py-1 rounded-lg border ${mode === "beta" ? "border-cyan-500 text-cyan-400" : "border-[var(--border)] text-gray-500"}`}>Net beta</button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} interval={0} />
          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} width={42} tickFormatter={(v) => (mode === "notional" ? `${v}%` : `${v}`)} />
          <RTooltip cursor={{ fill: "rgba(255,255,255,0.03)" }}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-[#0f172a] border border-[#1e293b] rounded px-2 py-1 text-xs">
                  <span className="text-gray-300">{d.name === "NET" ? "Net" : d.name}</span>{" "}
                  <span className={d.v >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(d.v)}</span>
                </div>
              );
            }} />
          <ReferenceLine y={0} stroke="#475569" />
          <Bar dataKey="base" stackId="a" fill="transparent" />
          <Bar dataKey="bar" stackId="a" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={color(d.kind)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-gray-600 mt-2">
        {mode === "notional"
          ? "Each bar = position weight on notional; longs (green) add, the QQQ/SOXL hedges (red) subtract → net notional."
          : "Each bar = beta contribution (weight × beta vs SPY). Longs add market beta; the QQQ/SOXL hedges (red) strip most of it out → a small deliberate net long-beta tilt. SOXL's pull is large for its size (3× ETF)."}
      </p>
    </div>
  );
}

function PositionsTab({ p }: { p: Paper }) {
  const named = p.book.filter((b) => b.side !== "hedge");
  const W = named.filter((b) => b.upnl > 0), L = named.filter((b) => b.upnl < 0);
  const totUpnl = p.book.reduce((a, b) => a + b.upnl, 0);
  const sum = (xs: Pos[]) => xs.reduce((a, b) => a + b.upnl, 0);
  return (
    <>
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 overflow-x-auto">
      <div className="flex justify-between items-center text-sm mb-3">
        <span className="font-medium text-gray-200">{p.n_longs} longs + hedge</span>
        <div className="flex gap-4 text-xs">
          <span className="text-emerald-400">W: {W.length} ({usd(sum(W))})</span>
          <span className="text-red-400">L: {L.length} ({usd(sum(L))})</span>
          <span className="text-gray-400">Net uPnL <span className={totUpnl >= 0 ? "text-emerald-400" : "text-red-400"}>{usd(totUpnl)}</span></span>
        </div>
      </div>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-[var(--border)]">
          <tr>
            <th className="text-left py-2 pr-4">Symbol</th><th className="text-left pr-4">Sector</th>
            <th className="text-right pr-4">Mkt cap</th><th className="text-left pr-4">Side</th>
            <th className="text-right pr-4">Held</th>
            <th className="text-right pr-4">Size</th><th className="text-right pr-4">Entry</th>
            <th className="text-right pr-4">Mark</th><th className="text-right pr-4">Notional</th>
            <th className="text-right pr-4">Weight</th><th className="text-right pr-4">uPnL</th>
            <th className="text-right pr-4">uPnL %</th><th className="text-right">Funding</th>
          </tr>
        </thead>
        <tbody>
          {p.book.map((b) => (
            <tr key={b.symbol} className="border-b border-[var(--border)]/40">
              <td className="py-2 pr-4">
                <div className="text-gray-200 font-medium">{b.symbol}</div>
                {b.name && <div className="text-[11px] text-gray-600 max-w-[150px] truncate">{b.name}</div>}
              </td>
              <td className="pr-4 text-gray-500 text-xs">{b.sector ?? "—"}</td>
              <td className="text-right pr-4 text-gray-400">{mcap(b.market_cap)}</td>
              <td className={`pr-4 ${b.side === "hedge" ? "text-gray-500" : b.side === "long" ? "text-emerald-400" : "text-red-400"}`}>{b.side}</td>
              <td className="text-right pr-4 text-gray-400">{b.held_days != null ? `${b.held_days}d` : "—"}</td>
              <td className="text-right pr-4 text-gray-300">{b.qty?.toLocaleString() ?? "—"}</td>
              <td className="text-right pr-4 text-gray-400">{b.entry != null ? `$${b.entry}` : "—"}</td>
              <td className="text-right pr-4 text-gray-300">{b.mark != null ? `$${b.mark}` : "—"}</td>
              <td className="text-right pr-4 text-gray-300">{usd(b.notional)}</td>
              <td className={`text-right pr-4 ${b.pct >= 0 ? "text-gray-300" : "text-red-400"}`}>{f1(b.pct)}%</td>
              <td className={`text-right pr-4 ${b.upnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{usd(b.upnl)}</td>
              <td className={`text-right pr-4 ${b.upnl_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{f1(b.upnl_pct)}%</td>
              <td className="text-right text-gray-500">{b.funding_apr != null ? `${b.funding_apr.toFixed(1)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-gray-600 mt-3">Held = continuous days in the book (clock resets if a name rotates out and back). uPnL is since the last monthly rebalance ({p.last_rebalance}). Funding = current perp APR. Paper book on the underlying / Binance marks.</p>
    </div>
    <BuildupChart book={p.book} />
    </>
  );
}

function RiskTab({ p }: { p: Paper }) {
  const sortino = p.gates.roll4wk_sortino;
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="text-sm font-medium text-gray-200 mb-4">Exposure vs Nickel limits</div>
        <ExposureBar label="Gross" value={p.gross_pct} cap={p.limits.gross_cap_pct} capLabel={`${p.limits.gross_cap_pct}% cap`} />
        <ExposureBar label="Net (long)" value={p.net_pct} cap={p.limits.net_cap_pct} capLabel={`±${p.limits.net_cap_pct}% cap`} />
        <ExposureBar label="Drawdown" value={Math.abs(p.dd_nav_pct)} cap={p.limits.dd_hard_nav_pct} capLabel={`${p.limits.dd_hard_nav_pct}% stop`} />
        <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-3 gap-y-1.5 text-xs">
          <div className="text-gray-600" /><div className="text-right text-gray-500">Notional</div><div className="text-right text-gray-500">NAV</div>
          <div className="text-gray-400">Gross</div><div className="text-right text-gray-300">{p.gross_pct.toFixed(0)}%</div><div className="text-right text-gray-300">{p.gross_pct_nav.toFixed(0)}%</div>
          <div className="text-gray-400">Net</div><div className="text-right text-gray-300">{f1(p.net_pct)}%</div><div className="text-right text-gray-300">{f1(p.net_pct_nav)}%</div>
          <div className="text-gray-400">Net beta</div><div className="text-right text-cyan-400">+{p.net_beta.toFixed(2)}</div><div className="text-right text-gray-600">market</div>
        </div>
        <div className="mt-2 text-[11px] text-gray-600">Nickel sizes risk on NOTIONAL (notional = 2× NAV). Gross runs far under the 200%-notional cap — drawdown binds first.</div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="text-sm font-medium text-gray-200 mb-4">Risk gates &amp; controls</div>
        <div className="space-y-2 text-sm">
          <Row k="Scaling gate (Sortino > 1.5)" v={p.gates.scaling_ok ? "PASS" : "pause"} ok={p.gates.scaling_ok} />
          <Row k="Rolling 4-wk Sortino (current)" v={sortino.toFixed(2)} ok={sortino > 1.5} />
          <Row k="Track Sortino (since inception)" v={p.sortino.toFixed(2)} ok={p.sortino > 1.5} />
          <Row k="De-risk gross multiplier" v={`${p.gates.dd_gross_mult}×`} ok={p.gates.dd_gross_mult >= 1} />
          <Row k="Hard stop (10% notl / 20% NAV)" v={p.gates.hard_stop_breached ? "BREACHED" : "clear"} ok={!p.gates.hard_stop_breached} />
          <Row k="Max drawdown (NAV)" v={`${p.max_dd_nav_pct.toFixed(1)}%`} ok={Math.abs(p.max_dd_nav_pct) < p.limits.dd_hard_nav_pct} />
          <Row k={`uniMMR — Binance PM${p.unimmr_est ? " (est)" : ""}`} v={p.unimmr != null ? `${p.unimmr}×` : "—"} ok={(p.unimmr ?? 99) > 1.3} />
          <Row k="Rebalance cadence" v={`${p.rebalance_days}d`} ok />
        </div>
        <p className="text-[11px] text-gray-600 mt-3">The rolling-4wk Sortino is the live Nickel scaling-gate input; it is noisy (20-day window) and dips below 1.5 during normal drawdowns — that correctly pauses up-scaling. The track Sortino is the through-period record.</p>
      </div>
    </div>
  );
}

type RRow = {
  symbol: string; label: string; sector: string | null; subsector: string | null;
  ai_role: "supplier" | "spender" | "neutral"; ai_subtype: string | null;
  rank: number | null; rank_exval: number | null; in_book: boolean;
  status: "in" | "enters" | "drops" | "bench" | "excluded";
  eps_surprise_pct: number | null; z_eps: number; z_mom: number; z_val: number;
  score: number; score_exval: number;
  trailing_pe: number | null; price_to_sales: number | null; ev_ebitda: number | null;
  fwd_pe: number | null; peg: number | null; target_upside: number | null;
  sm_count: number; sm_funds: string[] | null; sm_note: string | null;
  funding_apr: number | null; operating_margin: number | null; gross_margin: number | null;
  roe: number | null; revenue_ttm: number | null; eps_ttm: number | null; market_cap: number | null;
  days_since_report: number | null; last_fiscal_period: string | null;
};
type Research = {
  as_of: string; venue: string; top_k: number; n_universe: number; n_excluded: number; signal: string; mom_desc: string;
  valuation_overlay: { weight: number; metric: string; status: string; evidence: string };
  smart_money: { filing_period: string; funds: string[]; note: string };
  ai_thesis: string; ai_finding: string;
  rows: RRow[]; note: string;
};
const ROLE_CHIP: Record<string, string> = {
  supplier: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  spender: "bg-red-500/15 text-red-300 border-red-500/30",
  neutral: "bg-gray-700/30 text-gray-500 border-gray-600/30",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  in: { label: "IN BOOK", cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40" },
  enters: { label: "+VAL IN", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  drops: { label: "VAL OUT", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  bench: { label: "bench", cls: "bg-gray-700/30 text-gray-500 border-gray-600/40" },
  excluded: { label: "EXCLUDED", cls: "bg-red-500/10 text-red-400/80 border-red-500/30" },
};
const pct0 = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(0)}%`);
const bn = (n: number | null) => (n == null ? "—" : `$${(n / 1e9).toFixed(n < 1e10 ? 1 : 0)}B`);
const pe = (n: number | null) => (n == null ? "—" : n <= 0 ? "neg" : n.toFixed(0));
const zc = (z: number) => (z > 0.15 ? "text-emerald-400" : z < -0.15 ? "text-red-400" : "text-gray-400");

function ResearchTab() {
  const [r, setR] = useState<Research | null>(null);
  const [err, setErr] = useState(false);
  const [exVal, setExVal] = useState(false);
  const [roleF, setRoleF] = useState<"all" | "ex_spenders" | "suppliers">("all");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    fetch("/equity-rv/research_state.json")
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then(setR)
      .catch(() => setErr(true));
  }, []);
  if (err) return <p className="text-gray-500 text-sm">Research state unavailable — run the daily job.</p>;
  if (!r) return <p className="text-gray-500 text-sm">Loading…</p>;
  const K = r.top_k;
  const keep = (x: RRow) => roleF === "all" || (roleF === "suppliers" ? x.ai_role === "supplier" : x.ai_role !== "spender");
  const rk = (x: RRow) => (exVal ? x.rank_exval : x.rank) ?? Infinity;   // excluded names sort last
  const rows = [...r.rows].filter(keep).sort((a, b) => rk(a) - rk(b));

  return (
    <div>
      {/* what this is */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-4 text-sm text-gray-400 leading-relaxed">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold text-gray-100">Single-name selection research</h3>
          <span className="text-[11px] uppercase tracking-wider text-gray-500">{r.n_universe} names · as of {r.as_of} · {r.venue}</span>
        </div>
        <p>Every name scored by the <span className="text-gray-200">live signal</span> — <code className="text-cyan-400">{r.signal}</code> ({r.mom_desc}) — long the <span className="text-gray-200">top {K}</span> eligible names. EPS-surprise drives, momentum confirms, valuation tilts; each z-scored across the names that have it.</p>
        <p className="mt-2">
          <span className="text-amber-300">Valuation (z-val)</span> — {r.valuation_overlay.metric}, weight {r.valuation_overlay.weight}. <span className="text-gray-300">{r.valuation_overlay.status}.</span> {r.valuation_overlay.evidence} The <span className="text-gray-300">ex-valuation</span> toggle shows rank without it.
        </p>
        <p className="mt-2"><span className="text-cyan-300">Supply chain</span> / <span className="text-red-300">spender</span> — {r.ai_thesis} <span className="text-gray-500">{r.ai_finding}</span> {r.n_excluded} spenders excluded from the book (shown as EXCLUDED).</p>
        <p className="mt-2"><span className="text-gray-300">13F</span> = independent smart-money cross-check — # of {r.smart_money.funds.join(" / ")} long the name ({r.smart_money.filing_period} filings, ~45-day lag). Context, not a selection input.</p>
      </div>

      {/* lens toggle */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-gray-500">Rank by:</span>
        <button onClick={() => setExVal(false)} className={`px-3 py-1 rounded-lg border ${!exVal ? "border-cyan-500 text-cyan-400" : "border-[var(--border)] text-gray-500"}`}>Live (eps+mom+val)</button>
        <button onClick={() => setExVal(true)} className={`px-3 py-1 rounded-lg border ${exVal ? "border-amber-500 text-amber-300" : "border-[var(--border)] text-gray-500"}`}>Ex-valuation</button>
        <span className="text-gray-700 mx-1">·</span>
        <span className="text-gray-500">Universe:</span>
        {([["all", "All"], ["ex_spenders", "Ex-spenders"], ["suppliers", "Suppliers only"]] as const).map(([k, lab]) => (
          <button key={k} onClick={() => setRoleF(k)} className={`px-3 py-1 rounded-lg border ${roleF === k ? "border-cyan-500 text-cyan-400" : "border-[var(--border)] text-gray-500"}`}>{lab}</button>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-[var(--border)]">
            <tr>
              <th className="text-right py-2 pr-2">Rk</th><th className="text-right pr-3">exV</th>
              <th className="text-left pr-4">Name</th>
              <th className="text-right pr-3">zEps</th><th className="text-right pr-3">zMom</th>
              <th className="text-right pr-3">zVal</th><th className="text-right pr-4">Score</th>
              <th className="text-right pr-4 border-l border-[var(--border)] pl-3">P/E</th>
              <th className="text-right pr-4 border-l border-[var(--border)] pl-3">13F</th>
              <th className="text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const isOpen = open === b.symbol;
              const ex = b.status === "excluded";
              return (
                <Fragment key={b.symbol}>
                  <tr onClick={() => setOpen(isOpen ? null : b.symbol)}
                    className={`border-b border-[var(--border)]/40 cursor-pointer hover:bg-white/[0.02] ${b.in_book ? "" : "opacity-70"}`}>
                    <td className={`text-right py-2 pr-2 ${b.in_book ? "text-cyan-300" : ex ? "text-red-400/60" : "text-gray-400"}`}>{b.rank ?? "—"}</td>
                    <td className="text-right pr-3 text-gray-500">{b.rank_exval ?? "—"}</td>
                    <td className="pr-4">
                      <span className="text-gray-200 font-medium">{b.symbol}</span>
                      <span className={`ml-2 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded border ${ROLE_CHIP[b.ai_role]}`}>{b.ai_role === "supplier" ? "supply" : b.ai_role}</span>
                      <span className="text-gray-600 text-xs ml-1">{b.sector}</span>
                    </td>
                    <td className={`text-right pr-3 ${zc(b.z_eps)}`}>{b.z_eps.toFixed(2)}</td>
                    <td className={`text-right pr-3 ${zc(b.z_mom)}`}>{b.z_mom.toFixed(2)}</td>
                    <td className={`text-right pr-3 ${zc(b.z_val)}`}>{b.z_val.toFixed(2)}</td>
                    <td className="text-right pr-4 text-gray-200">{b.score.toFixed(2)}</td>
                    <td className="text-right pr-4 border-l border-[var(--border)] pl-3 text-gray-400">{pe(b.trailing_pe)}</td>
                    <td className="text-right pr-4 border-l border-[var(--border)] pl-3">{b.sm_count > 0 ? <span className="text-cyan-300">{b.sm_count}/4</span> : <span className="text-gray-600">—</span>}</td>
                    <td><span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span></td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-white/[0.02]">
                      <td colSpan={10} className="px-4 py-3">
                        <div className="text-xs text-gray-400 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1.5">
                          <div><span className="text-gray-600">Sector</span> · {b.sector} / {b.subsector}</div>
                          <div><span className="text-gray-600">AI role</span> · {b.ai_role}{b.ai_subtype ? ` — ${b.ai_subtype}` : ""}</div>
                          <div><span className="text-gray-600">Mkt cap</span> · {bn(b.market_cap)} · <span className="text-gray-600">Rev TTM</span> {bn(b.revenue_ttm)}</div>
                          <div><span className="text-gray-600">EPS surprise</span> · {b.eps_surprise_pct == null ? "no coverage" : `${b.eps_surprise_pct.toFixed(0)}%`}</div>
                          <div><span className="text-gray-600">Funding APR</span> · {b.funding_apr == null ? "—" : `${b.funding_apr.toFixed(1)}%`}</div>
                          <div><span className="text-gray-600">Gross / Op margin</span> · {pct0(b.gross_margin)} / {pct0(b.operating_margin)}</div>
                          <div><span className="text-gray-600">ROE</span> · {pct0(b.roe)}</div>
                          <div><span className="text-gray-600">P/S · EV/EBITDA</span> · {b.price_to_sales == null ? "—" : b.price_to_sales.toFixed(1)} · {b.ev_ebitda == null ? "—" : b.ev_ebitda.toFixed(1)}</div>
                          <div className="text-amber-200/80"><span className="text-gray-600">Fwd P/E · PEG</span> · {b.fwd_pe == null ? "—" : b.fwd_pe.toFixed(1)} · {b.peg == null ? "—" : b.peg.toFixed(2)}{b.target_upside != null ? ` · tgt ${f1(b.target_upside)}%` : ""}</div>
                          <div><span className="text-gray-600">Last report</span> · {b.last_fiscal_period ?? "—"}{b.days_since_report != null ? ` (${b.days_since_report.toFixed(0)}d ago)` : ""}</div>
                          {b.sm_count > 0 && <div className="lg:col-span-4 text-cyan-300/80">13F: {b.sm_count}/4 funds long{b.sm_funds ? ` (${b.sm_funds.join(", ")})` : ""}{b.sm_note ? ` — ${b.sm_note}` : ""}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <p className="text-[11px] text-gray-600 mt-3">
          Click a row for fundamentals. <span className="text-cyan-300">IN BOOK</span> = top-{K} eligible on the live score · <span className="text-emerald-300">+VAL IN</span> / <span className="text-amber-300">VAL OUT</span> = valuation moved it into / out of the book vs ex-valuation · <span className="text-red-400/80">EXCLUDED</span> = capex spender, screened from the book. exV = rank without the valuation leg. 13F is validation context. {r.note}
        </p>
      </div>
    </div>
  );
}

type WRow = {
  ticker: string; name: string; asset_class: string; sector: string | null; ai_role: string | null;
  venues: string[]; in_universe: boolean; in_book: boolean;
  last: number | null; chg_24h: number | null; funding_apr: number | null; vol: number | null;
  binance: { last: number; chg: number } | null; hyperliquid: { last: number; chg: number | null; dexes?: string[] } | null;
};
type Watch = {
  as_of: string;
  venues: { binance: { ok: boolean; count: number }; hyperliquid: { ok: boolean; dexs: string[]; count: number } };
  n: number; n_both: number; rows: WRow[]; note: string;
};

const px = (n: number | null) => (n == null ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: n < 10 ? 3 : 2, maximumFractionDigits: n < 10 ? 3 : 2 }));
const VBADGE: Record<string, string> = { binance: "bg-cyan-500/15 text-cyan-300", hyperliquid: "bg-violet-500/15 text-violet-300" };

function WatchlistTab() {
  const [w, setW] = useState<Watch | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const [venue, setVenue] = useState<"all" | "binance" | "hyperliquid" | "both">("all");
  const [cls, setCls] = useState("all");
  const [oursOnly, setOursOnly] = useState(false);
  const [sort, setSort] = useState<"vol" | "gain" | "lose" | "ticker">("vol");
  useEffect(() => {
    fetch("/equity-rv/watchlist_state.json")
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then(setW)
      .catch(() => setErr(true));
  }, []);
  if (err) return <p className="text-gray-500 text-sm">Watchlist unavailable — run the daily job.</p>;
  if (!w) return <p className="text-gray-500 text-sm">Loading…</p>;
  const classes = ["all", ...Array.from(new Set(w.rows.map((r) => r.asset_class)))];
  const ql = q.trim().toLowerCase();
  let rows = w.rows.filter((r) => {
    if (oursOnly && !r.in_universe) return false;
    if (venue === "both" && r.venues.length < 2) return false;
    if ((venue === "binance" || venue === "hyperliquid") && !r.venues.includes(venue)) return false;
    if (cls !== "all" && r.asset_class !== cls) return false;
    if (ql && !(r.ticker.toLowerCase().includes(ql) || r.name.toLowerCase().includes(ql) || (r.sector || "").toLowerCase().includes(ql))) return false;
    return true;
  });
  rows = [...rows].sort((a, b) =>
    sort === "ticker" ? a.ticker.localeCompare(b.ticker)
      : sort === "gain" ? (b.chg_24h ?? -1e9) - (a.chg_24h ?? -1e9)
      : sort === "lose" ? (a.chg_24h ?? 1e9) - (b.chg_24h ?? 1e9)
      : (b.vol ?? 0) - (a.vol ?? 0));
  const Btn = ({ on, set, children }: { on: boolean; set: () => void; children: ReactNode }) => (
    <button onClick={set} className={`px-2.5 py-1 rounded-lg border text-xs ${on ? "border-cyan-500 text-cyan-400" : "border-[var(--border)] text-gray-500 hover:text-gray-300"}`}>{children}</button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-100">Tokenized RWA watchlist</h3>
          <p className="text-[11px] text-gray-500">{w.n} instruments · {w.n_both} on both venues · Binance {w.venues.binance.count} · Hyperliquid {w.venues.hyperliquid.count} ({w.venues.hyperliquid.dexs.join("/")}) · {w.as_of}</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticker / name / sector…"
          className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-gray-200 w-56 focus:outline-none focus:border-cyan-500/50" />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
        <span className="text-gray-600 text-xs">Venue</span>
        <Btn on={venue === "all"} set={() => setVenue("all")}>All</Btn>
        <Btn on={venue === "binance"} set={() => setVenue("binance")}>Binance</Btn>
        <Btn on={venue === "hyperliquid"} set={() => setVenue("hyperliquid")}>Hyperliquid</Btn>
        <Btn on={venue === "both"} set={() => setVenue("both")}>Both</Btn>
        <span className="text-gray-700 mx-1">·</span>
        <select value={cls} onChange={(e) => setCls(e.target.value)} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-gray-300">
          {classes.map((c) => <option key={c} value={c}>{c === "all" ? "All classes" : c}</option>)}
        </select>
        <span className="text-gray-700 mx-1">·</span>
        <Btn on={oursOnly} set={() => setOursOnly(!oursOnly)}>Our universe</Btn>
        <span className="text-gray-700 mx-1">·</span>
        <span className="text-gray-600 text-xs">Sort</span>
        <Btn on={sort === "vol"} set={() => setSort("vol")}>Volume</Btn>
        <Btn on={sort === "gain"} set={() => setSort("gain")}>Gainers</Btn>
        <Btn on={sort === "lose"} set={() => setSort("lose")}>Losers</Btn>
        <Btn on={sort === "ticker"} set={() => setSort("ticker")}>A–Z</Btn>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-[var(--border)]">
            <tr>
              <th className="text-left py-2 pr-4">Ticker</th><th className="text-left pr-4">Name</th>
              <th className="text-left pr-4">Class</th><th className="text-left pr-4">Venues</th>
              <th className="text-right pr-4">Last</th><th className="text-right pr-4">24h</th>
              <th className="text-right pr-4">Funding</th><th className="text-left">Tag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className="border-b border-[var(--border)]/40 hover:bg-white/[0.02]">
                <td className="py-2 pr-4 text-gray-100 font-medium">{r.ticker}</td>
                <td className="pr-4 text-gray-400 max-w-[180px] truncate">{r.name}</td>
                <td className="pr-4 text-gray-500 text-xs">{r.asset_class}</td>
                <td className="pr-4">
                  {r.venues.map((v) => <span key={v} className={`mr-1 text-[9px] uppercase px-1 py-0.5 rounded ${VBADGE[v]}`}>{v[0]}</span>)}
                </td>
                <td className="text-right pr-4 text-gray-200 tabular-nums">{px(r.last)}</td>
                <td className={`text-right pr-4 tabular-nums ${r.chg_24h == null ? "text-gray-600" : r.chg_24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>{r.chg_24h == null ? "—" : `${f1(r.chg_24h)}%`}</td>
                <td className="text-right pr-4 text-gray-500 tabular-nums">{r.funding_apr == null ? "—" : `${r.funding_apr.toFixed(0)}%`}</td>
                <td>{r.in_book ? <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-cyan-500/15 text-cyan-300 border-cyan-500/40">★ book</span>
                  : r.in_universe ? <span className="text-[10px] uppercase tracking-wider text-gray-500">universe</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="text-gray-600 text-sm py-3">No instruments match.</p>}
        <p className="text-[11px] text-gray-600 mt-3">{w.note}</p>
      </div>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-5">
      <h3 className="text-base font-semibold text-gray-100 mb-3">{title}</h3>
      <div className="text-sm text-gray-400 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function ProcessTab() {
  return (
    <div className="max-w-3xl">
      <Sec title="What it is">
        <p>A systematic, market-neutral-to-lightly-net-long long/short book on <span className="text-gray-200">tokenized US-equity perpetual futures</span>. We own the AI and mega-cap-tech companies that are beating earnings expectations — the systematic version of how concentrated growth funds (Tiger Global, Altimeter, Atreides, Coatue, Situational Awareness) pick their longs — and hedge the market and the AI-compute factor so the return is driven by <span className="text-gray-200">stock selection, not beta</span>. Engineered to a hard drawdown cap.</p>
        <p className="text-xs text-gray-600">Universe ~33 tokenized US-equity perps · Binance USDT-M (Nickel account) · monthly rebalance · maker execution.</p>
      </Sec>

      <Sec title="The edge — analyst earnings surprise">
        <p>The driver is <span className="text-gray-200">analyst EPS surprise</span>: how much a company's reported earnings beat or miss the consensus estimate. Stocks that beat keep drifting up for weeks (post-earnings-announcement drift) as the market under-reacts and analysts revise estimates higher. We rank every name by its latest surprise, confirmed by price momentum:</p>
        <p className="font-mono text-cyan-400 text-xs bg-[var(--bg-primary)] rounded p-2">score = 1.0 × z(EPS&nbsp;surprise) + 0.5 × z(momentum) + 0.5 × z(cheap&nbsp;P/E) → long the top names</p>
        <p>The surprise is <span className="text-gray-200">new information at each quarterly report</span>, so it complements price momentum rather than duplicating it. A <span className="text-gray-200">relative-valuation</span> leg (cross-sectional cheapness) tilts among the already-good names toward the cheaper ones — validated to add risk-adjusted return on Binance (robust across params), held off on Hyperliquid where the all-supplier universe has little valuation spread. Growth, margins and trailing-value-as-a-screen were tested and dropped.</p>
      </Sec>

      <Sec title="How the book is built">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Long the top ~10 names by score. <span className="text-gray-200">No single-name shorts</span> — they squeeze in an AI bull and carry no measured edge.</li>
          <li><span className="text-gray-200">Own the AI supply chain, not the spenders.</span> We hold the firms that <span className="text-gray-200">sell into</span> the buildout (semis, memory, networking, foundry, optics) and exclude the hyperscalers that <span className="text-gray-200">spend</span> the capex — validated to lift Sharpe and cut drawdown on both venues.</li>
          <li>Hedge with <span className="text-gray-200">QQQ + SOXL</span> via a min-variance overlay — neutralizes both the broad market and the AI-compute / semiconductor factor (the dominant risk in this universe).</li>
          <li>Layer a deliberate, bounded <span className="text-gray-200">+10–15% net-long tilt</span> — the beta we choose to keep.</li>
          <li>Vol-target the book; size on notional within Nickel's limits; execute as a maker via TWAP.</li>
          <li>Rebalance monthly and around earnings; ~1× annual turnover, low cost.</li>
        </ul>
      </Sec>

      <Sec title="Risk management">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Sized on <span className="text-gray-200">NOTIONAL</span> (Nickel's risk denominator), not margin. Notional = 2× NAV; gross cap 200% notional; net cap ±30% notional.</li>
          <li><span className="text-gray-200">Hard drawdown stop</span> at 10% notional / 20% NAV; a de-risk ladder cuts gross before that.</li>
          <li>Capital scaling gated on rolling-4-week Sortino &gt; 1.5 and shallow drawdown.</li>
          <li>Net beta (~+0.12) is the controlled directional risk; uniMMR tracks Binance-PM liquidation safety.</li>
        </ul>
      </Sec>

      <Sec title="How we research it">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><span className="text-gray-200">Point-in-time data.</span> Every fundamental is used only as-of its real report/filing date (SEC EDGAR XBRL + analyst earnings), so the backtest never sees the future — validated with a look-ahead leak detector.</li>
          <li><span className="text-gray-200">Factor selection.</span> We evaluated each fundamental individually. Analyst earnings surprise was the only one that improved a momentum book. Trailing value <span className="text-gray-200">failed</span> — in a universe of intangible-heavy secular compounders, a cheapness screen mechanically shorts the winners.</li>
          <li><span className="text-gray-200">Robustness gate.</span> Positive in every sub-period and in 92% of rolling 6-month windows; across 72 parameter combinations every one clears Sharpe &gt; 1.0. We anchor on the <span className="text-gray-200">median (~1.7 Sharpe)</span>, not the best-fit cell.</li>
          <li><span className="text-gray-200">Hedge &amp; net-beta.</span> Chosen empirically — QQQ+SOXL gave the shallowest drawdown without over-fitting; the net-beta level was set on a return-vs-drawdown frontier.</li>
        </ul>
      </Sec>

      <Sec title="Lineage">
        <p><span className="text-gray-200">Long side:</span> mirrors how Tiger / Altimeter / Atreides / Coatue / Situational Awareness harvest beat-and-raise growth-tech compounders, systematized into rules.</p>
        <p><span className="text-gray-200">Risk side:</span> multi-manager pod discipline (Citadel / Millennium) — factor-neutralize, run a tight drawdown leash, and isolate selection alpha from market beta.</p>
      </Sec>

      <Sec title="Honest limitations">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Validated over a single ~3-year AI-bull regime; the hedge/quality overlays matter most in the correction we have not yet observed.</li>
          <li>Analyst-surprise coverage is ~23 of 33 names today; a paid estimates feed extends it to all names (incl. NVDA).</li>
          <li>Best-config metrics are optimistic out-of-sample — we report the robustness median as the expectation.</li>
        </ul>
      </Sec>
    </div>
  );
}

export function EquityPmsDashboard() {
  const [p, setP] = useState<Paper | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<"watchlist" | "overview" | "positions" | "research" | "risk" | "process">("overview");
  useEffect(() => {
    fetch("/equity-rv/paper_state.json").then((r) => (r.ok ? r.json() : Promise.reject())).then(setP).catch(() => setErr(true));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-gray-300">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft size={16} /> Sentient Advisory
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/equity-rv" className="text-sm text-cyan-400 hover:text-cyan-300">Strategy &amp; research →</Link>
          {p && <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full border border-cyan-500/40 text-cyan-400">{p.mode} · {p.venue} · {p.as_of}</span>}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">Equity PMS — Operational Dashboard</h1>
        <p className="text-sm text-gray-500 mb-5">Paper-trade book, exposures, and risk gates. Research / pre-launch.</p>
        {err && <p className="text-gray-400">Paper state unavailable.</p>}
        {!err && !p && <p className="text-gray-500">Loading…</p>}
        {p && (
          <>
            <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
              {([["watchlist", "Watchlist"], ["overview", "Overview"], ["positions", "Positions"], ["research", "Research"], ["risk", "Risk"], ["process", "Investment Process"]] as const).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${tab === t ? "border-cyan-500 text-cyan-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "watchlist" && <WatchlistTab />}
            {tab === "overview" && <OverviewTab p={p} />}
            {tab === "positions" && <PositionsTab p={p} />}
            {tab === "research" && <ResearchTab />}
            {tab === "risk" && <RiskTab p={p} />}
            {tab === "process" && <ProcessTab />}
            <p className="text-xs text-gray-600 mt-6">{p.note}</p>
          </>
        )}
      </main>
    </div>
  );
}
