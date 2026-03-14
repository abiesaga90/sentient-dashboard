import { Card, CardHeader, CardTitle } from "../ui/Card";
import { cn } from "../../lib/utils";
import type { MonthlyPnl } from "../../types/api";

interface MonthlyReturnsProps {
  monthly: MonthlyPnl[];
}

export function MonthlyReturns({ monthly }: MonthlyReturnsProps) {
  if (!monthly.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Returns</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
        {monthly.map((m) => (
          <div
            key={m.month}
            className={cn(
              "rounded-md p-2 text-center text-xs",
              m.pnl_pct >= 0
                ? "bg-green-900/20 text-green-400"
                : "bg-red-900/20 text-red-400"
            )}
          >
            <div className="text-gray-500 mb-1">{m.month}</div>
            <div className="font-medium">
              {m.pnl_pct >= 0 ? "+" : ""}
              {m.pnl_pct.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
