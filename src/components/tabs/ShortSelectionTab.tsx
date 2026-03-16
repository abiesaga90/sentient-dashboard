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
} from "../../types/api";

// ── Signal bar — inline sparkline for 0-1 signals ──
function SignalBar({ value, label }: { value: number | null; label?: string }) {
  if (value == null) return <span className="text-gray-700 text-[10px]">—</span>;
  const pct = Math.max(0, Math.min(100, value * 100));
  const color =
    pct > 60 ? "bg-red-500" : pct > 30 ? "bg-yellow-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-1.5 min-w-[60px]">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-7 text-right">
        {label ?? value.toFixed(2)}
      </span>
    </div>
  );
}

// ── Shared column builder ──
function buildColumns(opts: {
  showStatus: boolean;
  fundFirst: boolean;
}): Column<RankingCandidate>[] {
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

  if (opts.fundFirst) {
    // Fundamentals-first columns: Fund Score is primary, then signals, then corr/beta as context
    cols.push(
      {
        key: "fund_score",
        header: "Fund Score",
        render: (r) => (
          <span
            className={`font-semibold ${r.fund_score > 0.4 ? "text-red-400" : r.fund_score > 0.2 ? "text-yellow-400" : "text-gray-400"}`}
          >
            {r.fund_score.toFixed(3)}
          </span>
        ),
        sortKey: (r) => r.fund_score,
        align: "right",
      },
      {
        key: "confidence",
        header: "Conf",
        render: (r) => (
          <span className="text-gray-400 text-xs">
            {r.n_fund_signals}/6
          </span>
        ),
        sortKey: (r) => r.n_fund_signals,
        align: "right",
      },
      {
        key: "score",
        header: "Final",
        render: (r) => (
          <span className="text-gray-300 text-xs">
            {r.score.toFixed(3)}
          </span>
        ),
        sortKey: (r) => r.score,
        align: "right",
      },
      {
        key: "dilution",
        header: "Dilution",
        render: (r) => <SignalBar value={r.va_signals.dilution.signal} label={r.fdv_mcap_ratio != null ? `${r.fdv_mcap_ratio.toFixed(1)}x` : undefined} />,
        sortKey: (r) => r.va_signals.dilution.signal ?? -1,
        align: "right",
      },
      {
        key: "fee_mom",
        header: "Fee Mom",
        render: (r) => <SignalBar value={r.va_signals.fee_momentum.signal} />,
        sortKey: (r) => r.va_signals.fee_momentum.signal ?? -1,
        align: "right",
      },
      {
        key: "unlock",
        header: "Unlock",
        render: (r) => <SignalBar value={r.va_signals.unlock_pressure.signal} />,
        sortKey: (r) => r.va_signals.unlock_pressure.signal ?? -1,
        align: "right",
      },
      {
        key: "supply_mom",
        header: "Supply",
        render: (r) => <SignalBar value={r.va_signals.supply_momentum.signal} />,
        sortKey: (r) => r.va_signals.supply_momentum.signal ?? -1,
        align: "right",
      },
      {
        key: "rev_cap",
        header: "Rev Cap",
        render: (r) => <SignalBar value={r.va_signals.revenue_capture.signal} />,
        sortKey: (r) => r.va_signals.revenue_capture.signal ?? -1,
        align: "right",
      },
      {
        key: "buyback",
        header: "Buyback",
        render: (r) => <SignalBar value={r.va_signals.buyback_intensity.signal} />,
        sortKey: (r) => r.va_signals.buyback_intensity.signal ?? -1,
        align: "right",
      },
      {
        key: "corr",
        header: "Corr",
        render: (r) => <span className="text-gray-500">{r.corr.toFixed(2)}</span>,
        sortKey: (r) => r.corr,
        align: "right",
      },
      {
        key: "beta",
        header: "Beta",
        render: (r) => <span className="text-gray-500">{r.beta.toFixed(2)}</span>,
        sortKey: (r) => r.beta,
        align: "right",
      },
      {
        key: "volume",
        header: "Volume",
        render: (r) => <span className="text-gray-500">{formatUSD(r.volume_24h, 0)}</span>,
        sortKey: (r) => r.volume_24h,
        align: "right",
      }
    );
  } else {
    // Legacy correlation-first columns
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
  }

  return cols;
}

// Render helper for column that takes index
function buildColumnsWithIndex(opts: {
  showStatus: boolean;
  fundFirst: boolean;
}): Column<RankingCandidate & { _idx: number }>[] {
  const base = buildColumns(opts);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading rankings...
      </div>
    );
  }

  if (!data) return null;

  const fundFirst = data.fund_first_shorts ?? false;

  const basketColumns = buildColumnsWithIndex({ showStatus: false, fundFirst });
  const candidateColumns = buildColumnsWithIndex({ showStatus: true, fundFirst });

  // Split candidates into basket (in_targets) and full list
  const basket = data.candidates
    .filter((c) => (c.status || []).includes("in_targets"))
    .map((c, i) => ({ ...c, _idx: i + 1 }));

  const allCandidates = data.candidates.map((c, i) => ({
    ...c,
    _idx: i + 1,
  }));

  return (
    <div className="p-4 space-y-4">
      {/* Selection Mode Banner */}
      <div className={`rounded-lg border px-4 py-3 ${fundFirst ? "border-red-900/50 bg-red-950/30" : "border-gray-800 bg-gray-900/50"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold uppercase tracking-wider ${fundFirst ? "text-red-400" : "text-gray-400"}`}>
              {fundFirst ? "Fundamentals-First" : "Correlation-First"}
            </span>
            <Badge variant={fundFirst ? "danger" : "default"} className="text-[10px]">
              {fundFirst ? "ALPHA MODE" : "HEDGE MODE"}
            </Badge>
          </div>
          <div className="flex gap-4 text-[11px] text-gray-500">
            <span>Corr: <span className="text-gray-300">{data.correlation_method}</span></span>
            <span>Data Quality: <span className="text-gray-300">{data.data_quality_enabled ? "ON" : "OFF"}</span></span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-1.5">
          {fundFirst
            ? "Shorts ranked by fundamental weakness (dilution, fee decay, unlocks). Correlation is a floor filter only. Beta neutrality enforced at portfolio level via sizing."
            : "Shorts ranked by correlation to the long basket. VA signals added as small boosts. Beta neutrality through selection."}
        </p>
      </div>

      {/* Scoring Architecture — only in fund-first mode */}
      {fundFirst && (
        <Card>
          <CardHeader>
            <CardTitle>Scoring Architecture</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {/* Formula */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-md px-3 py-2">
              <div className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Score Formula</div>
              <code className="text-xs text-gray-300">
                score = weighted_avg(6 VA signals) × confidence(n/6) × liquidity_gate × momentum
              </code>
            </div>

            {/* Floors */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-[10px] text-gray-600 uppercase">Corr Floor</div>
                <div className="text-sm font-medium text-gray-300">{data.short_corr_floor?.toFixed(2) ?? "0.40"}</div>
                <div className="text-[10px] text-gray-600">hard filter</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-600 uppercase">Min Beta</div>
                <div className="text-sm font-medium text-gray-300">{data.min_beta.toFixed(2)}</div>
                <div className="text-[10px] text-gray-600">hard filter</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-600 uppercase">Confidence Floor</div>
                <div className="text-sm font-medium text-gray-300">{data.short_fund_confidence_floor?.toFixed(2) ?? "0.30"}</div>
                <div className="text-[10px] text-gray-600">min {Math.round((data.short_fund_confidence_floor ?? 0.3) * 6)} of 6 signals</div>
              </div>
            </div>

            {/* Signal Weights */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Fundamental Signal Weights</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {data.fund_weights && Object.entries({
                  "Dilution (FDV/MCap)": data.fund_weights.dilution,
                  "Fee Momentum": data.fund_weights.fee_mom,
                  "Unlock Pressure": data.fund_weights.unlock,
                  "Supply Momentum": data.fund_weights.supply_mom,
                  "Revenue Capture": data.fund_weights.rev_cap,
                  "Buyback Intensity": data.fund_weights.buyback,
                }).map(([label, weight]) => (
                  <div key={label} className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                    <span className="text-[11px] text-gray-400">{label}</span>
                    <span className="text-xs font-medium text-gray-200">{(weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modifiers */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Score Modifiers</div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Liquidity</span>
                  <span className="text-gray-300 float-right">min(1, vol/${formatUSD(data.min_volume, 0)})</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Momentum</span>
                  <span className="text-gray-300 float-right">{data.momentum_weight.toFixed(2)}</span>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">Diversity</span>
                  <span className="text-gray-300 float-right">-{data.diversity_penalty.toFixed(2)}×corr</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

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
            {fundFirst
              ? "Active shorts selected by fundamental weakness. Corr/Beta shown as context (floor filters only)."
              : "Active hedge positions from ranked candidate universe. Scores match Candidate Rankings below."}
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
            {fundFirst
              ? "Full universe scored by fundamental weakness. Signal bars show individual VA signal strength (higher = weaker fundamentals = better short)."
              : "Full ranked universe — all eligible short candidates scored against the long basket. Updated live."}
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

      {/* VA Signal Weights — legacy mode only */}
      {!fundFirst && (
        <Card>
          <CardHeader>
            <CardTitle>VA Signal Weights (Additive Boosts)</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: "Dilution", weight: data.va_short_dilution_weight },
              { label: "Supply Mom.", weight: data.va_short_supply_momentum_weight },
              { label: "Buyback", weight: data.va_short_buyback_weight },
              { label: "Rev Capture", weight: data.va_short_revenue_capture_weight },
              { label: "Fee Mom.", weight: data.va_short_fee_momentum_weight },
              { label: "Unlock", weight: data.va_short_unlock_weight },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className="text-sm font-medium text-gray-200">
                  {s.weight.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Total VA envelope: {[data.va_short_dilution_weight, data.va_short_supply_momentum_weight, data.va_short_buyback_weight, data.va_short_revenue_capture_weight, data.va_short_fee_momentum_weight, data.va_short_unlock_weight].reduce((s, v) => s + v, 0).toFixed(2)}
          </div>
        </Card>
      )}

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

      {/* Key Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Key Parameters</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <ParamRow label="Selection mode" value={fundFirst ? "Fundamentals-First" : "Correlation-First"} />
          <ParamRow label="Basket size" value={`${data.n_shorts} shorts`} />
          <ParamRow label="Lookback window" value={`${data.lookback_hours}h (${Math.round(data.lookback_hours / 24)}d)`} />
          <ParamRow label="Correlation" value={fundFirst ? `floor ${data.short_corr_floor?.toFixed(2) ?? "0.40"}` : `method: ${data.correlation_method}`} />
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
            ? "Low corr"
            : r === "low_beta"
              ? "Low beta"
              : r === "low_volume"
                ? "Low vol"
                : r === "high_beta"
                  ? "High beta"
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


function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-[var(--border)]">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
