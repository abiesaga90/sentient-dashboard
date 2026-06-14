import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

type Pos = {
  symbol: string; side: string; qty: number | null; entry: number | null; mark: number | null;
  notional: number; pct: number; upnl: number; upnl_pct: number; funding_apr: number | null;
  held_days: number | null;
};
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

function PositionsTab({ p }: { p: Paper }) {
  const named = p.book.filter((b) => b.side !== "hedge");
  const W = named.filter((b) => b.upnl > 0), L = named.filter((b) => b.upnl < 0);
  const totUpnl = p.book.reduce((a, b) => a + b.upnl, 0);
  const sum = (xs: Pos[]) => xs.reduce((a, b) => a + b.upnl, 0);
  return (
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
            <th className="text-left py-2 pr-4">Symbol</th><th className="text-left pr-4">Side</th>
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
              <td className="py-2 pr-4 text-gray-200 font-medium">{b.symbol}</td>
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

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
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
        <p className="font-mono text-cyan-400 text-xs bg-[var(--bg-primary)] rounded p-2">score = 1.0 × z(EPS&nbsp;surprise) + 0.5 × z(price&nbsp;momentum) → long the top names</p>
        <p>The surprise is <span className="text-gray-200">new information at each quarterly report</span>, so it complements price momentum rather than duplicating it. In our factor research it was the only fundamental that added alpha on top of momentum — every other (value, growth, margins) was redundant or noise.</p>
      </Sec>

      <Sec title="How the book is built">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Long the top ~10 names by score. <span className="text-gray-200">No single-name shorts</span> — they squeeze in an AI bull and carry no measured edge.</li>
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
  const [tab, setTab] = useState<"overview" | "positions" | "risk" | "process">("overview");
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
              {([["overview", "Overview"], ["positions", "Positions"], ["risk", "Risk"], ["process", "Investment Process"]] as const).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${tab === t ? "border-cyan-500 text-cyan-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "overview" && <OverviewTab p={p} />}
            {tab === "positions" && <PositionsTab p={p} />}
            {tab === "risk" && <RiskTab p={p} />}
            {tab === "process" && <ProcessTab />}
            <p className="text-xs text-gray-600 mt-6">{p.note}</p>
          </>
        )}
      </main>
    </div>
  );
}
