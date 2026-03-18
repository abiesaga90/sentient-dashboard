import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { formatPct } from "../../lib/utils";

interface ZoneInfo {
  zone: string;
  label: string;
  color: string;
}

interface CycleCurrent {
  mvrv: number | null;
  mvrv_date: string | null;
  mvrv_zone: ZoneInfo | null;
  btc_price: number | null;
  wma200: number | null;
  wma200_ratio: number | null;
  wma200_zone: ZoneInfo | null;
  sma200: number | null;
  mayer_multiple: number | null;
  mayer_zone: ZoneInfo | null;
  drawdown_pct: number | null;
  drawdown_zone: ZoneInfo | null;
  peak_price: number | null;
  price_date: string | null;
}

interface ZoneThreshold {
  max: number;
  label: string;
  color: string;
}

interface CycleResponse {
  updated_at: string;
  current: CycleCurrent;
  zone_thresholds?: Record<string, Record<string, ZoneThreshold>>;
  cycle_peaks?: Record<string, unknown>;
  error?: string;
}

const zoneBadge = (zone: ZoneInfo | null) => {
  if (!zone) return <Badge variant="default">—</Badge>;
  const variant =
    zone.zone === "undervalued" || zone.zone === "accumulation" ? "success" :
    zone.zone === "overheated" || zone.zone === "extreme_greed" ? "danger" :
    zone.zone === "fair_value" ? "success" :
    "warning";
  return (
    <Badge variant={variant} style={{ backgroundColor: zone.color + "22", color: zone.color, borderColor: zone.color + "44" }}>
      {zone.label}
    </Badge>
  );
};

export function CycleTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<CycleResponse>({
    queryKey: ["cycle", engine.id],
    queryFn: () => client.get("/api/cycle"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading cycle data...
      </div>
    );
  }

  if (!data) return null;

  if (data.error === "pending") {
    return (
      <div className="p-4">
        <Card className="flex flex-col items-center justify-center h-64">
          <div className="text-lg font-medium text-yellow-400">Cycle Data Pending</div>
          <div className="text-sm text-gray-500 mt-2">
            On-chain metrics are still being fetched. Check back shortly.
          </div>
        </Card>
      </div>
    );
  }

  const c = data.current;

  return (
    <div className="space-y-4 p-4">
      {/* BTC Price Context */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cycle Awareness</CardTitle>
            <span className="text-xs text-gray-500">
              Updated: {data.updated_at?.slice(0, 16).replace("T", " ")}
            </span>
          </div>
        </CardHeader>
        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-gray-500">BTC Price</div>
            <div className="text-gray-200 font-medium text-lg">
              ${c.btc_price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">ATH Peak</div>
            <div className="text-gray-200 font-medium">
              ${c.peak_price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">From Peak</div>
            <div className={`font-medium ${(c.drawdown_pct ?? 0) < -20 ? "text-red-400" : (c.drawdown_pct ?? 0) < -10 ? "text-yellow-400" : "text-green-400"}`}>
              {c.drawdown_pct != null ? formatPct(c.drawdown_pct) : "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Drawdown Zone</div>
            {zoneBadge(c.drawdown_zone)}
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <KpiCard
            label="MVRV Z-Score"
            value={c.mvrv != null ? c.mvrv.toFixed(2) : "—"}
            valueColor={
              c.mvrv != null
                ? c.mvrv > 3 ? "text-red-400" : c.mvrv < 1 ? "text-green-400" : "text-gray-100"
                : "text-gray-500"
            }
          />
          <div className="mt-1 px-2">{zoneBadge(c.mvrv_zone)}</div>
        </div>
        <div>
          <KpiCard
            label="200 WMA Ratio"
            value={c.wma200_ratio != null ? c.wma200_ratio.toFixed(3) : "—"}
            valueColor={
              c.wma200_ratio != null
                ? c.wma200_ratio < 1 ? "text-green-400" : c.wma200_ratio > 3 ? "text-red-400" : "text-gray-100"
                : "text-gray-500"
            }
          />
          <div className="mt-1 px-2">{zoneBadge(c.wma200_zone)}</div>
        </div>
        <div>
          <KpiCard
            label="Mayer Multiple"
            value={c.mayer_multiple != null ? c.mayer_multiple.toFixed(3) : "—"}
            valueColor={
              c.mayer_multiple != null
                ? c.mayer_multiple < 0.8 ? "text-green-400" : c.mayer_multiple > 2.4 ? "text-red-400" : "text-gray-100"
                : "text-gray-500"
            }
          />
          <div className="mt-1 px-2">{zoneBadge(c.mayer_zone)}</div>
        </div>
        <div>
          <KpiCard
            label="200 WMA"
            value={c.wma200 != null ? `$${c.wma200.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
          />
          <KpiCard
            label="200 SMA"
            value={c.sma200 != null ? `$${c.sma200.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
          />
        </div>
      </div>

      {/* Zone Thresholds */}
      {data.zone_thresholds && (
        <Card>
          <CardHeader>
            <CardTitle>Zone Thresholds</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">Metric</th>
                  <th className="px-3 py-2 text-left text-gray-500">Zone</th>
                  <th className="px-3 py-2 text-right text-gray-500">Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {Object.entries(data.zone_thresholds).map(([metric, zones]) =>
                  Object.entries(zones).map(([zone, info]) => (
                    <tr key={`${metric}-${zone}`} className="hover:bg-[var(--bg-card-hover)]">
                      <td className="px-3 py-1.5 text-gray-300">{metric}</td>
                      <td className="px-3 py-1.5">
                        <span style={{ color: info.color }}>{info.label}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-300">
                        ≤ {info.max}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
