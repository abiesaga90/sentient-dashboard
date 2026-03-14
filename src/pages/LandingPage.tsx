import { Link } from "react-router-dom";
import { BarChart3, Shield, Zap, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/Button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-lg font-semibold text-gray-100">
          Sentient Advisory
        </h1>
        <Link to="/live">
          <Button variant="outline" size="sm">
            Live Dashboard <ArrowRight size={14} className="ml-1" />
          </Button>
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-100 mb-4 leading-tight">
          Long/Short Relative Value
        </h2>
        <p className="text-lg text-gray-400 max-w-xl mb-8">
          Market-neutral crypto strategy. Systematic short selection,
          risk-managed execution, real-time monitoring.
        </p>

        <Link to="/live">
          <Button>
            Open Dashboard <ArrowRight size={16} className="ml-2" />
          </Button>
        </Link>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-3xl">
          <FeatureCard
            icon={<BarChart3 size={24} />}
            title="Real-Time Monitoring"
            description="Live NAV, positions, exposure, and P&L with 30-second auto-refresh"
          />
          <FeatureCard
            icon={<Shield size={24} />}
            title="Risk Management"
            description="Drawdown scaling, vol-adjusted exits, compliance monitoring"
          />
          <FeatureCard
            icon={<Zap size={24} />}
            title="Systematic Selection"
            description="Multi-signal short scoring with fundamental & technical overlays"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-gray-600">
        Sentient Advisory LLC
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 text-left">
      <div className="text-blue-400 mb-3">{icon}</div>
      <h3 className="text-sm font-medium text-gray-200 mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
