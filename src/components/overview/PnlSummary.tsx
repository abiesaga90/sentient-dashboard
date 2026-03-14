import { Card, CardTitle } from "../ui/Card";
import { PnlText } from "../shared/PnlText";
import { formatUSD } from "../../lib/utils";
import type { PnlResponse } from "../../types/api";

interface PnlSummaryProps {
  pnl: PnlResponse;
}

export function PnlSummary({ pnl }: PnlSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <PnlCard
        title="All-Time P&L"
        pnl={pnl.all_time.total_return}
        pct={pnl.all_time.total_return_pct}
        sub={`Since ${formatUSD(pnl.starting_capital)}`}
      />
      <PnlCard
        title="WTD P&L"
        pnl={pnl.wtd.pnl}
        pct={pnl.wtd.pnl_pct}
        sub="Week-to-Date"
      />
      <PnlCard
        title="MTD P&L"
        pnl={pnl.mtd.pnl}
        pct={pnl.mtd.pnl_pct}
        sub={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      />
      <PnlCard
        title="QTD P&L"
        pnl={pnl.qtd.pnl}
        pct={pnl.qtd.pnl_pct}
        sub={`Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`}
      />
      <PnlCard
        title="YTD P&L"
        pnl={pnl.ytd.pnl}
        pct={pnl.ytd.pnl_pct}
        sub={`Since Jan 1 (${formatUSD(pnl.ytd.start_nav)})`}
      />
    </div>
  );
}

function PnlCard({
  title,
  pnl,
  pct,
  sub,
}: {
  title: string;
  pnl: number;
  pct: number;
  sub?: string;
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-1">
        <PnlText value={pnl} className="text-sm font-medium" />
      </div>
      <div className="text-xs mt-0.5">
        <PnlText value={pct} format="pct" className="text-xs" />
      </div>
      {sub && <div className="text-[10px] text-gray-600 mt-1">{sub}</div>}
    </Card>
  );
}
