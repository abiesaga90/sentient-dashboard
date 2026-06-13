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

        {/* Performance */}
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Performance &amp; risk</h2>
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
