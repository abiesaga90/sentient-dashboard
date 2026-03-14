import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import { formatUSD } from "../../lib/utils";
import type {
  RankingCandidate,
  RankingsResponse,
  SignalInventoryResponse,
  ExecutionQualityResponse,
} from "../../types/api";

// ── Shared column builder — used by BOTH tables ──
function buildColumns(opts: { showStatus: boolean }): Column<RankingCandidate>[] {
  const cols: Column<RankingCandidate>[] = [
    {
      key: "rank",
      header: "#",
      render: () => <span className="text-gray-500">—</span>,
      sortKey: (r) => r.score,
    },
    {
      key: "symbol",
      header: "Symbol",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-200">
            {r.symbol.replace("USDT", "")}
          </span>
          {(r.quality_tags || [])
            .filter((t) => t.startsWith("sector:"))
            .map((t) => (
              <Badge key={t} variant="default" className="text-[10px] px-1 py-0">
                {t.replace("sector:", "")}
              </Badge>
            ))}
        </div>
      ),
      sortKey: (r) => r.symbol,
    },
  ];

  if (opts.showStatus) {
    cols.push({
      key: "status",
      header: "Status",
      render: (r) => <StatusBadges status={r.status} filter_reasons={r.filter_reasons} />,
    });
  }

  cols.push(
    {
      key: "score",
      header: "Score",
      render: (r) => (
        <span
          className={`font-medium ${r.score > 0.7 ? "text-red-400" : r.score > 0.5 ? "text-yellow-400" : "text-gray-300"}`}
        >
          {r.score.toFixed(3)}
        </span>
      ),
      sortKey: (r) => r.score,
      align: "right",
    },
    {
      key: "corr",
      header: "Corr",
      render: (r) => r.corr.toFixed(2),
      sortKey: (r) => r.corr,
      align: "right",
    },
    {
      key: "beta",
      header: "Beta",
      render: (r) => r.beta.toFixed(2),
      sortKey: (r) => r.beta,
      align: "right",
    },
    {
      key: "volume",
      header: "Volume",
      render: (r) => formatUSD(r.volume_24h, 0),
      sortKey: (r) => r.volume_24h,
      align: "right",
    },
    {
      key: "fdv_mcap",
      header: "FDV/MCap",
      render: (r) =>
        r.fdv_mcap_ratio != null ? `${r.fdv_mcap_ratio.toFixed(1)}x` : "—",
      sortKey: (r) => r.fdv_mcap_ratio ?? 0,
      align: "right",
    },
    {
      key: "va_boost",
      header: "VA Boost",
      render: (r) => {
        if (r.va_total_boost == null || r.va_total_boost === 0) return "—";
        return (
          <span
            className={
              r.va_total_boost > 0 ? "text-red-400" : "text-green-400"
            }
          >
            {r.va_total_boost > 0 ? "+" : ""}
            {r.va_total_boost.toFixed(3)}
          </span>
        );
      },
      sortKey: (r) => r.va_total_boost ?? 0,
      align: "right",
    }
  );

  return cols;
}

// Render helper for column that takes index
function buildColumnsWithIndex(opts: { showStatus: boolean }): Column<RankingCandidate & { _idx: number }>[] {
  const base = buildColumns(opts);
  // Override rank to use _idx
  return base.map((col) => {
    if (col.key === "rank") {
      return {
        ...col,
        render: (r: RankingCandidate & { _idx: number }) => (
          <span className="text-gray-500">{r._idx}</span>
        ),
      };
    }
    return col as Column<RankingCandidate & { _idx: number }>;
  });
}

const basketColumns = buildColumnsWithIndex({ showStatus: false });
const candidateColumns = buildColumnsWithIndex({ showStatus: true });

export function ShortSelectionTab() {
  const { client, engine } = useEngine();

  const { data, isLoading } = useQuery({
    queryKey: ["rankings", engine.id],
    queryFn: () =>
      client.get<RankingsResponse>("/api/rankings", { limit: 200 }),
    refetchInterval: 60_000,
  });

  const { data: signalInv } = useQuery({
    queryKey: ["signal-inventory", engine.id],
    queryFn: () =>
      client.get<SignalInventoryResponse>("/api/signal-inventory"),
    refetchInterval: 300_000,
  });

  const { data: execQuality } = useQuery({
    queryKey: ["execution-quality", engine.id],
    queryFn: () =>
      client.get<ExecutionQualityResponse>("/api/execution_quality"),
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading rankings...
      </div>
    );
  }

  if (!data) return null;

  // Split candidates into basket (in_targets) and full list
  const basket = data.candidates
    .filter((c) => (c.status || []).includes("in_targets"))
    .map((c, i) => ({ ...c, _idx: i + 1 }));

  const allCandidates = data.candidates.map((c, i) => ({
    ...c,
    _idx: i + 1,
  }));

  // VA signal weights for display
  const vaWeights = [
    { label: "Dilution", weight: data.va_short_dilution_weight },
    { label: "Supply Mom.", weight: data.va_short_supply_momentum_weight },
    { label: "Buyback", weight: data.va_short_buyback_weight },
    { label: "Rev Capture", weight: data.va_short_revenue_capture_weight },
    { label: "Fee Mom.", weight: data.va_short_fee_momentum_weight },
    { label: "Unlock", weight: data.va_short_unlock_weight },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Metadata bar */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>
          Correlation: <span className="text-gray-300">{data.correlation_method}</span>
        </span>
        <span>
          Data Quality: <span className="text-gray-300">{data.data_quality_enabled ? "ON" : "OFF"}</span>
        </span>
        <span>
          Shrunk Diversity: <span className="text-gray-300">{data.shrunk_diversity_enabled ? "ON" : "OFF"}</span>
        </span>
      </div>

      {/* Trading Basket */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Trading Basket
            </CardTitle>
            <span className="text-xs text-gray-500">
              {basket.length} shorts
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Active hedge positions from ranked candidate universe. Scores match Candidate Rankings below.
          </p>
        </CardHeader>
        <DataTable
          columns={basketColumns}
          data={basket}
          defaultSort="score"
          defaultDir="desc"
        />
      </Card>

      {/* Candidate Rankings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Candidate Rankings</CardTitle>
            <span className="text-xs text-gray-500">
              {data.count} candidates from {data.universe_size} universe
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Full ranked universe — all eligible short candidates scored against the long basket. Updated live.
          </p>
        </CardHeader>
        <DataTable
          columns={candidateColumns}
          data={allCandidates}
          defaultSort="score"
          defaultDir="desc"
          maxHeight="max-h-[600px]"
        />
      </Card>

      {/* VA Signal Weights */}
      <Card>
        <CardHeader>
          <CardTitle>VA Signal Weights</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {vaWeights.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className="text-sm font-medium text-gray-200">
                {s.weight.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-600">
          Total VA envelope: {vaWeights.reduce((s, v) => s + v.weight, 0).toFixed(2)}
        </div>
      </Card>

      {/* Signal Inventory */}
      {signalInv && (
        <Card>
          <CardHeader>
            <CardTitle>Signal Inventory</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
                Short Selection Signals
              </div>
              <div className="space-y-1">
                {signalInv.short_signals.map((s) => (
                  <SignalRow key={s.name} signal={s} />
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-3">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
                Long Basket Signals
              </div>
              <div className="space-y-1">
                {signalInv.long_signals.map((s) => (
                  <SignalRow key={s.name} signal={s} />
                ))}
              </div>
            </div>
            {signalInv.data_sources.length > 0 && (
              <div className="border-t border-[var(--border)] pt-3">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">
                  Data Sources
                </div>
                <div className="flex flex-wrap gap-2">
                  {signalInv.data_sources.map((ds) => (
                    <Badge key={ds} variant="default">
                      {ds}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Execution Quality */}
      {execQuality && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Quality</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <MetricBox
              label="Avg Slippage"
              value={`${execQuality.summary.avg_slippage_bps.toFixed(1)} bps`}
            />
            <MetricBox
              label="Median Slippage"
              value={`${execQuality.summary.median_slippage_bps.toFixed(1)} bps`}
            />
            <MetricBox
              label="Total Cost"
              value={formatUSD(execQuality.summary.total_cost_usd)}
            />
            <MetricBox
              label="Worst Symbol"
              value={execQuality.summary.worst_slippage_symbol?.replace("USDT", "") || "—"}
            />
          </div>
          {execQuality.recent_reports.length > 0 && (
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-[var(--border)]">
                  <tr>
                    <th className="px-2 py-1 text-left text-gray-500">Time</th>
                    <th className="px-2 py-1 text-left text-gray-500">Symbol</th>
                    <th className="px-2 py-1 text-left text-gray-500">Side</th>
                    <th className="px-2 py-1 text-left text-gray-500">Action</th>
                    <th className="px-2 py-1 text-right text-gray-500">Arrival</th>
                    <th className="px-2 py-1 text-right text-gray-500">Fill</th>
                    <th className="px-2 py-1 text-right text-gray-500">Slip (bps)</th>
                    <th className="px-2 py-1 text-right text-gray-500">Time (s)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {execQuality.recent_reports.map((r, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-card-hover)]">
                      <td className="px-2 py-1 text-gray-400">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-2 py-1 text-gray-200">
                        {r.symbol.replace("USDT", "")}
                      </td>
                      <td className="px-2 py-1">
                        <Badge
                          variant={r.side === "LONG" ? "success" : "danger"}
                          className="text-[10px]"
                        >
                          {r.side}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 text-gray-400">{r.action}</td>
                      <td className="px-2 py-1 text-right text-gray-300">
                        {r.arrival_price.toFixed(r.arrival_price < 1 ? 4 : 2)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-300">
                        {r.fill_price.toFixed(r.fill_price < 1 ? 4 : 2)}
                      </td>
                      <td
                        className={`px-2 py-1 text-right ${
                          r.slippage_bps > 50
                            ? "text-red-400"
                            : r.slippage_bps < -50
                              ? "text-green-400"
                              : "text-gray-300"
                        }`}
                      >
                        {r.slippage_bps.toFixed(1)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-400">
                        {r.execution_time_secs.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Key Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Key Parameters</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <ParamRow label="Basket size" value={`${data.n_shorts} shorts`} />
          <ParamRow label="Lookback window" value={`${data.lookback_hours}h (${Math.round(data.lookback_hours / 24)}d)`} />
          <ParamRow label="Correlation method" value={data.correlation_method} />
          <ParamRow label="Diversity penalty" value={data.diversity_penalty.toFixed(2)} />
          <ParamRow label="Diversity hard cap" value={data.diversity_cap.toFixed(2)} />
          <ParamRow label="Min beta" value={data.min_beta.toFixed(2)} />
          <ParamRow label="Min volume" value={formatUSD(data.min_volume, 0)} />
          <ParamRow label="Momentum weight" value={data.momentum_weight.toFixed(2)} />
          <ParamRow label="Universe size" value={String(data.universe_size)} />
        </div>
      </Card>
    </div>
  );
}

// ── Helper components ──

function StatusBadges({
  status,
  filter_reasons,
}: {
  status: string[];
  filter_reasons: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {(status || []).includes("in_basket") && (
        <Badge variant="info" className="text-[10px]">ACTIVE</Badge>
      )}
      {(status || []).includes("in_targets") && (
        <Badge variant="success" className="text-[10px]">TARGET</Badge>
      )}
      {(status || []).includes("excluded") && (
        <Badge variant="danger" className="text-[10px]">EXCLUDED</Badge>
      )}
      {(status || []).includes("vol_sl_cooldown") && (
        <Badge variant="warning" className="text-[10px]">SL COOLDOWN</Badge>
      )}
      {(status || []).includes("long_bench") && (
        <Badge variant="default" className="text-[10px]">LONG BENCH</Badge>
      )}
      {(filter_reasons || []).map((r) => (
        <span key={r} className="text-[10px] text-gray-600">
          {r === "low_corr"
            ? "Corr < 0.50"
            : r === "low_beta"
              ? "Beta < 0.70"
              : r === "low_volume"
                ? `Vol < $1.5M`
                : r}
        </span>
      ))}
    </div>
  );
}

function SignalRow({ signal }: { signal: { name: string; status: string; description: string; weight?: number } }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            signal.status === "active"
              ? "bg-green-500"
              : signal.status === "planned"
                ? "bg-yellow-500"
                : "bg-gray-600"
          }`}
        />
        <span className="text-gray-300">{signal.name}</span>
      </div>
      <span className="text-gray-600 text-[10px] max-w-[300px] truncate">
        {signal.description}
      </span>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-200">{value}</div>
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-[var(--border)]">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
