import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-cyan-400">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Exhibit({ src, title, note }: { src: string; title: string; note?: string }) {
  return (
    <figure className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <figcaption className="text-sm font-medium text-gray-200 mb-3">{title}</figcaption>
      <img src={src} alt={title} className="w-full rounded-lg bg-white" />
      {note && <p className="text-xs text-gray-500 mt-3">{note}</p>}
    </figure>
  );
}

type PaperState = {
  mode: string; venue: string; inception: string; as_of: string; days: number;
  nav_index: number; cum_return_nav_pct: number; dd_nav_pct: number;
  gross_pct: number; net_pct: number; n_longs: number;
  gates: { roll4wk_sortino: number; scaling_ok: boolean };
  book: { symbol: string; pct: number; side: string }[];
  nav_curve: { date: string; nav: number }[];
  note: string;
};

function NavSparkline({ curve }: { curve: { date: string; nav: number }[] }) {
  if (!curve?.length) return null;
  const w = 600, h = 150, pad = 10;
  const navs = curve.map((c) => c.nav);
  const min = Math.min(...navs, 100), max = Math.max(...navs);
  const x = (i: number) => pad + (i / (curve.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
  const d = curve.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(c.nav).toFixed(1)}`).join(" ");
  const up = navs[navs.length - 1] >= 100;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 150 }}>
      <line x1={pad} y1={y(100)} x2={w - pad} y2={y(100)} stroke="#475569" strokeDasharray="3 3" strokeWidth="1" />
      <path d={d} fill="none" stroke={up ? "#22d3ee" : "#f87171"} strokeWidth="2" />
    </svg>
  );
}

function PaperTradeSection() {
  const [ps, setPs] = useState<PaperState | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch("/equity-rv/paper_state.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPs)
      .catch(() => setErr(true));
  }, []);
  if (err || !ps) return null;
  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-100">Live paper trade</h2>
        <div className="flex items-center gap-3">
          <Link to="/equity-rv/dashboard" className="text-sm text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 rounded-lg px-3 py-1.5">
            Open PMS dashboard →
          </Link>
          <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full border border-cyan-500/40 text-cyan-400">
            {ps.mode} · {ps.venue} · as of {ps.as_of}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <Metric label="NAV (index 100)" value={ps.nav_index.toFixed(1)} sub={`since ${ps.inception}`} />
        <Metric label="Cum. return (NAV)" value={`${ps.cum_return_nav_pct >= 0 ? "+" : ""}${ps.cum_return_nav_pct.toFixed(1)}%`} sub={`${ps.days} trading days`} />
        <Metric label="Drawdown (NAV)" value={`${ps.dd_nav_pct.toFixed(1)}%`} sub="peak-to-trough" />
        <Metric label="Net / Gross" value={`${ps.net_pct}% / ${ps.gross_pct}%`} sub={`${ps.n_longs} longs + hedge`} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 mb-5">
        <div className="text-sm font-medium text-gray-200 mb-2">Paper NAV (index 100 at inception)</div>
        <NavSparkline curve={ps.nav_curve} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="text-sm font-medium text-gray-200 mb-3">Current book</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          {ps.book.map((b) => (
            <div key={b.symbol} className="flex justify-between">
              <span className={b.side === "hedge" ? "text-gray-500" : "text-gray-300"}>{b.symbol}</span>
              <span className={b.pct >= 0 ? "text-cyan-400" : "text-red-400"}>{b.pct >= 0 ? "+" : ""}{b.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-3">{ps.note}</p>
    </section>
  );
}

export function EquityRvPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-gray-300">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft size={16} /> Sentient Advisory
        </Link>
        <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full border border-cyan-500/40 text-cyan-400">
          Research · Pre-launch
        </span>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-400 mb-4">Flagship Strategy</p>
        <h1 className="text-4xl font-bold text-gray-100 mb-4 leading-tight">
          Tokenized Equity Long/Short — Fundamental Relative Value
        </h1>
        <p className="text-lg text-gray-400 max-w-3xl mb-10">
          A market-neutral way to own the AI/tech compounders, inside a hard drawdown cap.
          We systematically hold the tokenized US-equity perps that beat earnings (analyst
          EPS surprise), confirmed by price momentum, and hedge the market and AI-compute
          factor with QQQ + SOXL.
        </p>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Metric label="Backtest Sharpe" value="1.7–2.4" sub="robustness median → tuned ceiling" />
          <Metric label="Target return" value="~20% NAV" sub="bull-regime up to ~31%" />
          <Metric label="Drawdown cap" value="20% NAV" sub="hard stop; backtest peak −12%" />
          <Metric label="Net beta" value="+0.10–0.15" sub="dynamic, ±30% notional cap" />
        </div>
        <p className="text-xs text-gray-600 mb-12">
          Figures from a research backtest over a single ~3-year AI-bull regime, NAV basis,
          maker-cost. Illustrative, not out-of-sample validated, and not an offer or
          performance representation.
        </p>

        {/* Live paper trade (fetched from the PMS paper_state.json) */}
        <PaperTradeSection />

        {/* Performance */}
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Backtest performance &amp; risk</h2>
        <div className="grid md:grid-cols-2 gap-5 mb-12">
          <Exhibit src="/equity-rv/equity_curve.png" title="Growth of 100 (NAV basis)" />
          <Exhibit src="/equity-rv/drawdown.png" title="Drawdown vs Nickel risk limits" />
        </div>

        {/* How it works */}
        <h2 className="text-xl font-semibold text-gray-100 mb-4">How the signal works</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 mb-6">
          <code className="text-cyan-400 text-sm">
            score = 1.0 × z(EPS surprise) + 0.5 × z(price momentum) → long the top 8
          </code>
        </div>
        <ul className="space-y-2 text-sm text-gray-400 mb-12 list-disc pl-5">
          <li>EPS surprise = actual vs analyst-consensus earnings — new information at each quarterly report, so it complements momentum rather than duplicating it.</li>
          <li>Monthly rebalance + earnings-event-driven rotation into fresh beaters, out of misses.</li>
          <li>QQQ + SOXL min-variance hedge neutralizes the market and AI-compute factor; a small +10–15% net-long tilt is a deliberate, bounded beta bet.</li>
          <li>Maker-TWAP execution, ~1.1× annual turnover, low cost.</li>
          <li>Momentum is the steady driver; earnings-surprise adds alpha on average (regime-dependent).</li>
        </ul>

        {/* Research exhibits */}
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Research</h2>
        <div className="grid md:grid-cols-2 gap-5 mb-12">
          <Exhibit src="/equity-rv/signal_subset.png" title="Signal selection — analyst EPS surprise is the edge" />
          <Exhibit src="/equity-rv/hedge.png" title="Hedge selection — QQQ + SOXL" />
          <Exhibit src="/equity-rv/netbeta.png" title="Net-beta policy" />
          <Exhibit src="/equity-rv/robustness.png" title="Robustness — sub-period & parameter stability" />
        </div>

        {/* Deck link */}
        <a
          href="/equity-rv/strategy_deck.pdf"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 rounded-lg px-4 py-2"
        >
          <FileText size={16} /> Full strategy deck (PDF)
        </a>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-gray-600 mt-12">
        Sentient Advisory LLC &nbsp;&middot;&nbsp; sentientadvisory.llc &nbsp;&middot;&nbsp; Research — not investment advice
      </footer>
    </div>
  );
}
