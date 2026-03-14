import { KpiCard } from "../shared/KpiCard";
import { formatUSD, formatPct } from "../../lib/utils";
import { DollarSign, TrendingDown, BarChart2, Users } from "lucide-react";
import type { Portfolio, RiskData } from "../../types/api";

interface KpiRowProps {
  portfolio: Portfolio;
  risk: RiskData;
}

export function KpiRow({ portfolio, risk }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        label="NAV"
        value={formatUSD(portfolio.nav)}
        sub={`Return: ${formatPct(portfolio.total_return_pct)}`}
        icon={<DollarSign size={12} />}
      />
      <KpiCard
        label="Drawdown"
        value={formatPct(-risk.dd_pct)}
        sub={`Distance to SL: ${formatPct(risk.distance_to_sl_pct)}`}
        valueColor={risk.dd_pct > 5 ? "text-red-400" : risk.dd_pct > 3 ? "text-yellow-400" : "text-green-400"}
        icon={<TrendingDown size={12} />}
      />
      <KpiCard
        label="Exposure"
        value={`${formatPct(risk.gross_pct)} gross`}
        sub={`Net: ${formatPct(risk.net_pct)}`}
        icon={<BarChart2 size={12} />}
      />
      <KpiCard
        label="Positions"
        value={`${portfolio.n_longs}L / ${portfolio.n_shorts}S`}
        sub={`Target: ${portfolio.n_longs_target}L / ${portfolio.n_shorts_target}S`}
        icon={<Users size={12} />}
      />
    </div>
  );
}
