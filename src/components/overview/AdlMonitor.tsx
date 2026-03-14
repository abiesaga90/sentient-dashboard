import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { AdlData } from "../../types/api";

interface AdlMonitorProps {
  adl: AdlData;
}

export function AdlMonitor({ adl }: AdlMonitorProps) {
  if (!adl.positions.length) return null;

  const atRisk = adl.positions.filter(
    (p) => p.risk_level === "CRITICAL" || p.risk_level === "HIGH"
  );

  if (!atRisk.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>ADL Risk Monitor</CardTitle>
            <Badge variant="success">All Clear</Badge>
          </div>
        </CardHeader>
        <div className="text-xs text-gray-500">
          {adl.total_positions} positions monitored — no elevated ADL risk
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>ADL Risk Monitor</CardTitle>
          <div className="flex gap-2">
            {adl.critical_count > 0 && (
              <Badge variant="danger">{adl.critical_count} Critical</Badge>
            )}
            {adl.high_count > 0 && (
              <Badge variant="warning">{adl.high_count} High</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <div className="space-y-1">
        {atRisk.map((p) => (
          <div
            key={`${p.symbol}-${p.side}`}
            className="flex items-center justify-between text-xs py-1"
          >
            <span className="text-gray-300">{p.symbol.replace("USDT", "")}</span>
            <span className="text-gray-500">{p.side}</span>
            <Badge
              variant={p.risk_level === "CRITICAL" ? "danger" : "warning"}
            >
              Q{p.adl_quantile}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
