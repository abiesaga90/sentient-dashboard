import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { KpiCard } from "../../shared/KpiCard";
import { formatPct } from "../../../lib/utils";

/**
 * BTC cycle context + market notes (Phase 3, 2026-05-30).
 *
 * Absorbs the BTC Cycle KPIs, Cycle Zone Thresholds, and PM Market Notes
 * from the retired MarketContextTab. The crypto-cycle context is part of
 * "macro" understanding, so it belongs alongside the other Macro Regime
 * sub-tabs rather than in a separate sidebar entry.
 *
 * Data sources reused without changes:
 *   • /api/macro_regime → cycle block (MVRV / 200 WMA / Mayer / drawdown)
 *   • /api/market-notes?active_only=true → operator-curated notes
 */
interface ZoneInfo {
  zone: string;
  label: string;
  color: string;
}

interface ZoneThreshold {
  max: number;
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

interface CycleData {
  updated_at: string;
  current: CycleCurrent;
  zone_thresholds?: Record<string, Record<string, ZoneThreshold>>;
}

interface MacroRegimeWithCycle {
  cycle: CycleData | null;
}

interface MarketNote {
  id: number;
  title: string;
  body: string | null;
  direction: string;
  magnitude: string;
  start_date: string | null;
  end_date: string | null;
  source: string | null;
  active: number;
  created_at: string | null;
}

interface MarketNotesResponse {
  notes: MarketNote[];
}

const zoneBadge = (zone: ZoneInfo | null) => {
  if (!zone) return <Badge variant="default">—</Badge>;
  const variant =
    zone.zone === "undervalued" || zone.zone === "accumulation"
      ? "success"
      : zone.zone === "overheated" || zone.zone === "extreme_greed"
      ? "danger"
      : zone.zone === "fair_value"
      ? "success"
      : "warning";
  return (
    <Badge
      variant={variant}
      style={{
        backgroundColor: zone.color + "22",
        color: zone.color,
        borderColor: zone.color + "44",
      }}
    >
      {zone.label}
    </Badge>
  );
};

export function CycleSubTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<MacroRegimeWithCycle>({
    queryKey: ["macro-regime", engine.id],
    queryFn: () => client.get("/api/macro_regime"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const { data: notesData } = useQuery<MarketNotesResponse>({
    queryKey: ["market-notes", engine.id],
    queryFn: () => client.get("/api/market-notes?active_only=true"),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Loading cycle context...
      </div>
    );
  }
  if (!data) return null;
  const cycle = data.cycle?.current;

  return (
    <div className="space-y-4">
      {cycle && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>BTC Cycle</CardTitle>
                <span className="text-xs text-gray-500">
                  Updated:{" "}
                  {data.cycle?.updated_at?.slice(0, 16).replace("T", " ")}
                </span>
              </div>
            </CardHeader>
            <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-gray-500">BTC Price</div>
                <div className="text-gray-200 font-medium text-lg">
                  ${cycle.btc_price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-gray-500">ATH Peak</div>
                <div className="text-gray-200 font-medium">
                  ${cycle.peak_price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-gray-500">From Peak</div>
                <div
                  className={`font-medium ${
                    (cycle.drawdown_pct ?? 0) < -20
                      ? "text-red-400"
                      : (cycle.drawdown_pct ?? 0) < -10
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {cycle.drawdown_pct != null ? formatPct(cycle.drawdown_pct) : "—"}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Drawdown Zone</div>
                {zoneBadge(cycle.drawdown_zone)}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <KpiCard
                label="MVRV Z-Score"
                value={cycle.mvrv != null ? cycle.mvrv.toFixed(2) : "—"}
                valueColor={
                  cycle.mvrv != null
                    ? cycle.mvrv > 3
                      ? "text-red-400"
                      : cycle.mvrv < 1
                      ? "text-green-400"
                      : "text-gray-100"
                    : "text-gray-500"
                }
              />
              <div className="mt-1 px-2">{zoneBadge(cycle.mvrv_zone)}</div>
            </div>
            <div>
              <KpiCard
                label="200 WMA Ratio"
                value={cycle.wma200_ratio != null ? cycle.wma200_ratio.toFixed(3) : "—"}
                valueColor={
                  cycle.wma200_ratio != null
                    ? cycle.wma200_ratio < 1
                      ? "text-green-400"
                      : cycle.wma200_ratio > 3
                      ? "text-red-400"
                      : "text-gray-100"
                    : "text-gray-500"
                }
              />
              <div className="mt-1 px-2">{zoneBadge(cycle.wma200_zone)}</div>
            </div>
            <div>
              <KpiCard
                label="Mayer Multiple"
                value={
                  cycle.mayer_multiple != null
                    ? cycle.mayer_multiple.toFixed(3)
                    : "—"
                }
                valueColor={
                  cycle.mayer_multiple != null
                    ? cycle.mayer_multiple < 0.8
                      ? "text-green-400"
                      : cycle.mayer_multiple > 2.4
                      ? "text-red-400"
                      : "text-gray-100"
                    : "text-gray-500"
                }
              />
              <div className="mt-1 px-2">{zoneBadge(cycle.mayer_zone)}</div>
            </div>
            <div>
              <KpiCard
                label="200 WMA"
                value={
                  cycle.wma200 != null
                    ? `$${cycle.wma200.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : "—"
                }
              />
              <KpiCard
                label="200 SMA"
                value={
                  cycle.sma200 != null
                    ? `$${cycle.sma200.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : "—"
                }
              />
            </div>
          </div>
        </>
      )}

      {notesData?.notes && notesData.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>PM Market Notes</CardTitle>
          </CardHeader>
          <div className="divide-y divide-[var(--border)]">
            {notesData.notes.map((note) => {
              const dirColor =
                note.direction === "bullish"
                  ? "#22c55e"
                  : note.direction === "bearish"
                  ? "#ef4444"
                  : "#6b7280";
              const magLabel =
                note.magnitude === "high"
                  ? "HIGH"
                  : note.magnitude === "medium"
                  ? "MED"
                  : "LOW";
              return (
                <div
                  key={note.id}
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <Badge
                    variant={
                      note.direction === "bullish"
                        ? "success"
                        : note.direction === "bearish"
                        ? "danger"
                        : "default"
                    }
                    style={{
                      backgroundColor: dirColor + "22",
                      color: dirColor,
                      borderColor: dirColor + "44",
                      flexShrink: 0,
                    }}
                  >
                    {note.direction}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">
                        {note.title}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500 uppercase">
                        {magLabel}
                      </span>
                    </div>
                    {note.body && (
                      <p className="text-xs text-gray-400 mt-0.5">{note.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                      {note.source && <span>{note.source}</span>}
                      {note.start_date && (
                        <span>
                          {note.start_date}
                          {note.end_date ? ` - ${note.end_date}` : "+"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {data.cycle?.zone_thresholds && (
        <Card>
          <CardHeader>
            <CardTitle>Cycle Zone Thresholds</CardTitle>
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
                {Object.entries(data.cycle.zone_thresholds).map(([metric, zones]) =>
                  Object.entries(zones).map(([zone, info]) => (
                    <tr
                      key={`${metric}-${zone}`}
                      className="hover:bg-[var(--bg-card-hover)]"
                    >
                      <td className="px-3 py-1.5 text-gray-300">{metric}</td>
                      <td className="px-3 py-1.5">
                        <span style={{ color: info.color }}>{info.label}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-300">
                        ≤ {info.max}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
