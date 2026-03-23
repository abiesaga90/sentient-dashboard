import { formatUSD, formatPct, timeAgo } from "../../lib/utils";
import { Badge } from "../ui/Badge";
import type { DashboardResponse, StatusResponse } from "../../types/api";

interface StatusBarProps {
  dashboard?: DashboardResponse;
  status?: StatusResponse;
}

export function StatusBar({ dashboard, status }: StatusBarProps) {
  if (!dashboard) return null;
  const { portfolio, risk } = dashboard;

  const nextRebalance = status?.feature_health?.next_rebalance_at;
  const countdown = nextRebalance ? getCountdown(nextRebalance) : null;

  return (
    <div className="flex items-center gap-4 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs">
      <StatusItem label="NAV" value={formatUSD(portfolio.nav)} />
      <StatusItem
        label="DD"
        value={formatPct(-((risk as any).nt_dd_pct ?? risk.dd_pct))}
        color={((risk as any).nt_dd_pct ?? risk.dd_pct) > 5 ? "text-red-400" : ((risk as any).nt_dd_pct ?? risk.dd_pct) > 3 ? "text-yellow-400" : "text-gray-300"}
      />
      <StatusItem label="Gross" value={formatPct(risk.gross_pct)} />
      <StatusItem label="Net" value={formatPct(risk.net_pct)} />
      <StatusItem
        label="Positions"
        value={`${portfolio.n_longs}L / ${portfolio.n_shorts}S`}
      />

      <div className="ml-auto flex items-center gap-3">
        {risk.compliance && (
          <>
            <ComplianceDot ok={risk.compliance.max_dd_ok} label={`DD < ${risk.limits.dd_stop_pct}%`} />
            <ComplianceDot ok={risk.compliance.gross_ok} label={`Gross < ${risk.limits.max_leverage_pct}%`} />
            <ComplianceDot ok={risk.compliance.net_ok} label={`|Net| < ${risk.limits.max_net_pct}%`} />
          </>
        )}
        {countdown && (
          <Badge variant="info">Next rebal: {countdown}</Badge>
        )}
        <span className="text-gray-600">
          {timeAgo(dashboard.status.timestamp)}
        </span>
      </div>
    </div>
  );
}

function StatusItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-gray-500">{label}</span>
      <span className={color || "text-gray-200 font-medium"}>{value}</span>
    </div>
  );
}

function ComplianceDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1" title={label}>
      <div
        className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
      />
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

function getCountdown(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "imminent";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${mins}m`;
}
