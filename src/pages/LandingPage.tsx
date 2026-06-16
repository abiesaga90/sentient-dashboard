import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, Coins, LineChart } from "lucide-react";
import { Button } from "../components/ui/Button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-lg font-semibold text-gray-100">
          Sentient Advisory
        </h1>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-purple-400 mb-6">
          Sentient Advisory LLC
        </p>
        <h2 className="text-4xl md:text-5xl font-bold text-gray-100 mb-4 leading-tight">
          Systematic Strategies for Tokenized &amp; Digital Markets
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-16">
          Fundamental and quantitative strategies across tokenized equities and
          crypto. Institutional-grade risk controls, hard drawdown caps,
          transparent infrastructure.
        </p>

        {/* Strategy cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
          <StrategyCard
            icon={<LineChart size={28} />}
            title="Tokenized Equity L/S"
            description="Systematic, beta-neutral long/short across all tradeable tokenized US-equity perps. Owns the AI supply chain that's beating-and-raising earnings (EPS surprise + estimate revisions + momentum), QQQ+SOXL-hedged, regime-monitored, inside a hard drawdown cap."
            linkTo="/equity-rv/dashboard"
            linkLabel="Live Dashboard"
            tags={["AI Supply Chain", "Beat-and-Raise", "Beta-Neutral"]}
            featured
          />
          <StrategyCard
            icon={<TrendingUp size={28} />}
            title="L/S Relative Value"
            description="Market-neutral crypto strategy. Systematic short selection via multi-signal scoring, risk-managed execution with drawdown controls and vol-adjusted exits."
            linkTo="/live"
            linkLabel="Live Dashboard"
            tags={["Market-Neutral", "Perpetual Futures", "72h Rebalance"]}
          />
          <StrategyCard
            icon={<Coins size={28} />}
            title="DeFi Yield Management"
            description="Autonomous agent deploys capital into risk-scored DeFi protocols. 7-pillar risk framework, same-asset yield, risk-triggered reallocation."
            linkTo="/defi-yield"
            linkLabel="Strategy Details"
            tags={["Stablecoin Yield", "Agentic", "On-Chain"]}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-gray-600">
        Sentient Advisory LLC &nbsp;&middot;&nbsp; sentientadvisory.llc
      </footer>
    </div>
  );
}

function StrategyCard({
  icon,
  title,
  description,
  linkTo,
  linkLabel,
  tags,
  featured = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkTo: string;
  linkLabel: string;
  tags: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border bg-[var(--bg-card)] p-6 text-left flex flex-col transition-colors ${
        featured
          ? "border-cyan-500/60 ring-1 ring-cyan-500/30 hover:border-cyan-400"
          : "border-[var(--border)] hover:border-gray-600"
      }`}
    >
      {featured && (
        <span className="absolute -top-2.5 left-4 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500 text-gray-900">
          Flagship
        </span>
      )}
      <div className={featured ? "text-cyan-400 mb-4" : "text-purple-400 mb-4"}>{icon}</div>
      <h3 className="text-lg font-semibold text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-400 mb-4 flex-1">{description}</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] text-gray-500"
          >
            {tag}
          </span>
        ))}
      </div>
      <Link to={linkTo}>
        <Button variant="outline" size="sm" className="w-full justify-center">
          {linkLabel} <ArrowRight size={14} className="ml-1" />
        </Button>
      </Link>
    </div>
  );
}
