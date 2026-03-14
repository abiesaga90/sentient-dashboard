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
        title="All-Time"
        pnl={pnl.all_time.total_return}
        pct={pnl.all_time.total_return_pct}
      />
      <PnlCard title="MTD" pnl={pnl.mtd.pnl} pct={pnl.mtd.pnl_pct} />
      <PnlCard title="QTD" pnl={pnl.qtd.pnl} pct={pnl.qtd.pnl_pct} />
      <Card className="col-span-1">
        <CardTitle>Realized</CardTitle>
        <div className="mt-1">
          <PnlText value={pnl.all_time.realized_pnl} className="text-sm font-medium" />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Fees: {formatUSD(-pnl.all_time.total_fees)}
        </div>
      </Card>
      <Card className="col-span-1">
        <CardTitle>Unrealized</CardTitle>
        <div className="mt-1">
          <PnlText value={pnl.all_time.unrealized_pnl} className="text-sm font-medium" />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Funding: <PnlText value={pnl.all_time.funding_pnl} className="text-xs" />
        </div>
      </Card>
    </div>
  );
}

function PnlCard({
  title,
  pnl,
  pct,
}: {
  title: string;
  pnl: number;
  pct: number;
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-1">
        <PnlText value={pnl} className="text-sm font-medium" />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        <PnlText value={pct} format="pct" className="text-xs" />
      </div>
    </Card>
  );
}
