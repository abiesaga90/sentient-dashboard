import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import { ChartContainer } from "../shared/ChartContainer";
import { formatPct } from "../../lib/utils";

// ── Types ──

interface Indicator {
  key: string;
  label: string;
  category: string;
  type: string;
  weight: number;
  description: string;
  score: number | null;
  raw_value: number | string | null;
}

interface ChartPoint {
  timestamp: string;
  composite_score: number;
  regime: string;
}

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

interface MarketContextResponse {
  composite_score: number;
  regime: string;
  regime_label: string;
  regime_color: string;
  indicators: Indicator[];
  chart: ChartPoint[];
  regime_thresholds: Record<string, [number, number]>;
  sources_available: number;
  sources_total: number;
  cycle: CycleData | null;
  error?: string;
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

// ── Helpers ──

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

// ── Component ──

export function MarketContextTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<MarketContextResponse>({
    queryKey: ["market-context", engine.id],
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
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading market context...
      </div>
    );
  }

  if (!data) return null;

  if (data.error === "pending") {
    return (
      <div className="p-4">
        <Card className="flex flex-col items-center justify-center h-64">
          <div className="text-lg font-medium text-yellow-400">Market Data Pending</div>
          <div className="text-sm text-gray-500 mt-2">
            Indicators are still being fetched. Check back shortly.
          </div>
        </Card>
      </div>
    );
  }

  const regimeColor = data.regime_color || "#6b7280";
  const chartData = (data.chart || []).map((p) => ({
    ...p,
    date: p.timestamp?.slice(5, 10) || "",
  }));
  const cycle = data.cycle?.current;

  return (
    <div className="space-y-4 p-4">
      {/* Section 1: Regime Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Macro Regime</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {data.sources_available}/{data.sources_total} sources
              </span>
              <Badge
                variant="default"
                className="text-sm px-3 py-1"
                style={{ backgroundColor: regimeColor + "22", color: regimeColor, borderColor: regimeColor + "44" }}
              >
                {data.regime_label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold" style={{ color: regimeColor }}>
              {data.composite_score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              {Object.entries(data.regime_thresholds || {}).map(([name, [lo, hi]]) => (
                <div key={name}>{name}: {lo}–{hi}</div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Section 2: BTC Cycle Context */}
      {cycle && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>BTC Cycle</CardTitle>
                <span className="text-xs text-gray-500">
                  Updated: {data.cycle?.updated_at?.slice(0, 16).replace("T", " ")}
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
                <div className={`font-medium ${(cycle.drawdown_pct ?? 0) < -20 ? "text-red-400" : (cycle.drawdown_pct ?? 0) < -10 ? "text-yellow-400" : "text-green-400"}`}>
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
                    ? cycle.mvrv > 3 ? "text-red-400" : cycle.mvrv < 1 ? "text-green-400" : "text-gray-100"
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
                    ? cycle.wma200_ratio < 1 ? "text-green-400" : cycle.wma200_ratio > 3 ? "text-red-400" : "text-gray-100"
                    : "text-gray-500"
                }
              />
              <div className="mt-1 px-2">{zoneBadge(cycle.wma200_zone)}</div>
            </div>
            <div>
              <KpiCard
                label="Mayer Multiple"
                value={cycle.mayer_multiple != null ? cycle.mayer_multiple.toFixed(3) : "—"}
                valueColor={
                  cycle.mayer_multiple != null
                    ? cycle.mayer_multiple < 0.8 ? "text-green-400" : cycle.mayer_multiple > 2.4 ? "text-red-400" : "text-gray-100"
                    : "text-gray-500"
                }
              />
              <div className="mt-1 px-2">{zoneBadge(cycle.mayer_zone)}</div>
            </div>
            <div>
              <KpiCard
                label="200 WMA"
                value={cycle.wma200 != null ? `$${cycle.wma200.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
              />
              <KpiCard
                label="200 SMA"
                value={cycle.sma200 != null ? `$${cycle.sma200.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
              />
            </div>
          </div>
        </>
      )}

      {/* Section 3: Indicators Table */}
      <Card>
        <CardHeader>
          <CardTitle>Indicators ({data.indicators?.length || 0})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Indicator</th>
                <th className="px-3 py-2 text-left text-gray-500">Category</th>
                <th className="px-3 py-2 text-right text-gray-500">Raw</th>
                <th className="px-3 py-2 text-right text-gray-500">Score</th>
                <th className="px-3 py-2 text-right text-gray-500">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {(data.indicators || []).map((ind) => (
                <tr key={ind.key} className="hover:bg-[var(--bg-card-hover)]">
                  <td className="px-3 py-2 text-gray-200">{ind.label}</td>
                  <td className="px-3 py-2 text-gray-500">{ind.category}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300">
                    {ind.raw_value != null ? String(ind.raw_value) : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${
                    ind.score != null
                      ? ind.score >= 60 ? "text-green-400" : ind.score <= 40 ? "text-red-400" : "text-yellow-400"
                      : "text-gray-600"
                  }`}>
                    {ind.score != null ? ind.score.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">{ind.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 4: Composite Score Chart */}
      {chartData.length > 0 && (
        <ChartContainer title="Composite Score (30d)" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 10 }}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 10 }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <ReferenceLine y={55} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Bull", fill: "#22c55e", fontSize: 10 }} />
            <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Bear", fill: "#ef4444", fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="composite_score"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}

      {/* Section 5: PM Market Notes */}
      {notesData?.notes && notesData.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>PM Market Notes</CardTitle>
          </CardHeader>
          <div className="divide-y divide-[var(--border)]">
            {notesData.notes.map((note) => {
              const dirColor =
                note.direction === "bullish" ? "#22c55e" :
                note.direction === "bearish" ? "#ef4444" :
                "#6b7280";
              const magLabel =
                note.magnitude === "high" ? "HIGH" :
                note.magnitude === "medium" ? "MED" :
                "LOW";
              return (
                <div key={note.id} className="px-4 py-3 flex items-start gap-3">
                  <Badge
                    variant={note.direction === "bullish" ? "success" : note.direction === "bearish" ? "danger" : "default"}
                    style={{ backgroundColor: dirColor + "22", color: dirColor, borderColor: dirColor + "44", flexShrink: 0 }}
                  >
                    {note.direction}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">{note.title}</span>
                      <span className="text-[10px] font-mono text-gray-500 uppercase">{magLabel}</span>
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

      {/* Section 6: Zone Thresholds */}
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
