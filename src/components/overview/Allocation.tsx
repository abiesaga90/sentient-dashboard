import { PieChart, Pie, Cell } from "recharts";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { formatUSD } from "../../lib/utils";
import type { RiskData } from "../../types/api";

interface AllocationProps {
  risk: RiskData;
}

export function Allocation({ risk }: AllocationProps) {
  const longPct = risk.gross_pct > 0
    ? Math.round((risk.gross_long / (risk.gross_long + risk.gross_short)) * 100)
    : 50;
  const shortPct = 100 - longPct;

  const data = [
    { name: "Long", value: longPct },
    { name: "Short", value: shortPct },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation</CardTitle>
      </CardHeader>
      <div className="flex items-center gap-6">
        <div className="w-24 h-24">
          <PieChart width={96} height={96}>
            <Pie
              data={data}
              cx={44}
              cy={44}
              innerRadius={28}
              outerRadius={42}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              <Cell fill="#22c55e" />
              <Cell fill="#ef4444" />
            </Pie>
          </PieChart>
        </div>
        <div className="flex-1 space-y-2 text-xs">
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
              <span className="text-gray-400">Long</span>
            </div>
            <span className="text-gray-200 font-medium">{longPct}%</span>
          </div>
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span className="text-gray-400">Short</span>
            </div>
            <span className="text-gray-200 font-medium">{shortPct}%</span>
          </div>
          <div className="border-t border-[var(--border)] pt-2 space-y-1">
            <Row label="Long Exposure" value={formatUSD(risk.gross_long)} />
            <Row label="Short Exposure" value={formatUSD(risk.gross_short)} />
            <Row label="Net Exposure" value={`${risk.net_pct >= 0 ? "+" : ""}${formatUSD(risk.gross_long - risk.gross_short)}`} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
