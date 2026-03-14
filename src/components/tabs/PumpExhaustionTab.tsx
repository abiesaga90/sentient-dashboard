import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { Badge } from "../ui/Badge";

interface PumpCandidate {
  symbol: string;
  state: string;
  exhaustion_score: number;
  pump_detected_at: string | null;
  peak_price: number;
  inclusion_price: number | null;
  stalk_cycles: number;
  inclusion_cycles: number;
  current_price: number | null;
  last_updated: string;
}

interface PumpDetail {
  current_state: string;
  simulated_state: string;
  ret_7d_pct: number | null;
  exhaustion_score: number;
  threshold: number;
  source: string;
  in_sleeve?: boolean;
}

interface PumpExhaustionResponse {
  enabled: boolean;
  config: {
    threshold: number;
    detect_threshold_pct: number;
    max_included: number;
    max_stalk_cycles: number;
    weight_pct: number;
  };
  candidates: PumpCandidate[];
  sleeve: string[];
  detail: Record<string, PumpDetail>;
}

const stateBadge = (state: string) => {
  switch (state) {
    case "INCLUDED":
      return <Badge variant="success">INCLUDED</Badge>;
    case "STALKING":
      return <Badge variant="warning">STALKING</Badge>;
    default:
      return <Badge variant="default">EXCLUDED</Badge>;
  }
};

const candidateColumns: Column<PumpCandidate>[] = [
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => (
      <span className="font-medium text-gray-200">
        {r.symbol.replace("USDT", "")}
      </span>
    ),
    sortKey: (r) => r.symbol,
  },
  {
    key: "state",
    header: "State",
    render: (r) => stateBadge(r.state),
    sortKey: (r) => r.state,
  },
  {
    key: "exhaustion_score",
    header: "Exhaustion",
    render: (r) => (
      <span
        className={`font-mono ${
          r.exhaustion_score >= 0.5
            ? "text-green-400"
            : r.exhaustion_score >= 0.35
              ? "text-yellow-400"
              : "text-gray-400"
        }`}
      >
        {r.exhaustion_score.toFixed(3)}
      </span>
    ),
    sortKey: (r) => r.exhaustion_score,
    align: "right",
  },
  {
    key: "current_price",
    header: "Price",
    render: (r) =>
      r.current_price ? `$${r.current_price.toFixed(4)}` : "-",
    sortKey: (r) => r.current_price ?? 0,
    align: "right",
  },
  {
    key: "peak_price",
    header: "Peak",
    render: (r) => (r.peak_price > 0 ? `$${r.peak_price.toFixed(4)}` : "-"),
    sortKey: (r) => r.peak_price,
    align: "right",
  },
  {
    key: "drawdown",
    header: "From Peak",
    render: (r) => {
      if (!r.current_price || r.peak_price <= 0) return "-";
      const dd = ((r.current_price / r.peak_price - 1) * 100);
      return (
        <span className={dd < 0 ? "text-green-400" : "text-red-400"}>
          {dd.toFixed(1)}%
        </span>
      );
    },
    sortKey: (r) =>
      r.current_price && r.peak_price > 0
        ? r.current_price / r.peak_price - 1
        : 0,
    align: "right",
  },
  {
    key: "cycles",
    header: "Cycles",
    render: (r) => (
      <span className="text-gray-400 text-xs">
        {r.state === "STALKING"
          ? `${r.stalk_cycles} stalk`
          : r.state === "INCLUDED"
            ? `${r.inclusion_cycles} incl`
            : "-"}
      </span>
    ),
    sortKey: (r) => r.stalk_cycles + r.inclusion_cycles,
    align: "right",
  },
  {
    key: "detected",
    header: "Detected",
    render: (r) => {
      if (!r.pump_detected_at) return "-";
      const d = new Date(r.pump_detected_at);
      const ago = Math.round((Date.now() - d.getTime()) / 3600000);
      return <span className="text-gray-500 text-xs">{ago}h ago</span>;
    },
    sortKey: (r) =>
      r.pump_detected_at ? new Date(r.pump_detected_at).getTime() : 0,
    align: "right",
  },
];

interface DetailRow {
  symbol: string;
  source: string;
  ret_7d_pct: number | null;
  exhaustion_score: number;
  simulated_state: string;
  in_sleeve: boolean;
}

const detailColumns: Column<DetailRow>[] = [
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-200">
          {r.symbol.replace("USDT", "")}
        </span>
        {r.in_sleeve && <Badge variant="success">Sleeve</Badge>}
      </div>
    ),
    sortKey: (r) => r.symbol,
  },
  {
    key: "source",
    header: "Source",
    render: (r) => (
      <Badge variant={r.source === "excluded" ? "warning" : "info"}>
        {r.source}
      </Badge>
    ),
    sortKey: (r) => r.source,
  },
  {
    key: "ret_7d_pct",
    header: "7d Return",
    render: (r) =>
      r.ret_7d_pct !== null ? (
        <span className="text-red-400">+{r.ret_7d_pct.toFixed(1)}%</span>
      ) : (
        "-"
      ),
    sortKey: (r) => r.ret_7d_pct ?? 0,
    align: "right",
  },
  {
    key: "exhaustion_score",
    header: "Exhaustion",
    render: (r) => (
      <span
        className={`font-mono ${
          r.exhaustion_score >= 0.5
            ? "text-green-400"
            : r.exhaustion_score >= 0.35
              ? "text-yellow-400"
              : "text-gray-400"
        }`}
      >
        {r.exhaustion_score.toFixed(3)}
      </span>
    ),
    sortKey: (r) => r.exhaustion_score,
    align: "right",
  },
  {
    key: "simulated_state",
    header: "Simulated",
    render: (r) => (
      <span className="text-gray-400 text-xs">{r.simulated_state}</span>
    ),
    sortKey: (r) => r.simulated_state,
  },
];

export function PumpExhaustionTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<PumpExhaustionResponse>({
    queryKey: ["pump-exhaustion", engine.id],
    queryFn: () => client.get("/api/pump-exhaustion"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading pump exhaustion data...
      </div>
    );
  }

  if (!data) return null;

  const detailRows: DetailRow[] = Object.entries(data.detail)
    .map(([sym, d]) => ({
      symbol: sym,
      source: d.source,
      ret_7d_pct: d.ret_7d_pct,
      exhaustion_score: d.exhaustion_score,
      simulated_state: d.simulated_state,
      in_sleeve: d.in_sleeve ?? false,
    }))
    .sort((a, b) => b.exhaustion_score - a.exhaustion_score);

  return (
    <div className="space-y-4 p-4">
      {/* Status & Config */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <ConfigCard
          label="Scanner"
          value={data.enabled ? "ENABLED" : "DISABLED"}
          color={data.enabled ? "text-green-400" : "text-gray-500"}
        />
        <ConfigCard
          label="Threshold"
          value={data.config.threshold.toFixed(2)}
        />
        <ConfigCard
          label="Detect"
          value={`>${data.config.detect_threshold_pct}%`}
        />
        <ConfigCard
          label="Max Slots"
          value={String(data.config.max_included)}
        />
        <ConfigCard
          label="Weight"
          value={`${data.config.weight_pct}% NAV`}
        />
        <ConfigCard
          label="Sleeve"
          value={data.sleeve.length > 0 ? data.sleeve.map(s => s.replace("USDT","")).join(", ") : "Empty"}
          color={data.sleeve.length > 0 ? "text-green-400" : "text-gray-500"}
        />
      </div>

      {/* Tactical Sleeve */}
      {data.sleeve.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tactical Sleeve ({data.sleeve.length}/{data.config.max_included})</CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <div className="flex gap-3">
              {data.sleeve.map((sym) => {
                const d = data.detail[sym];
                return (
                  <div
                    key={sym}
                    className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex-1"
                  >
                    <div className="text-green-400 font-medium">
                      {sym.replace("USDT", "")}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Score: {d?.exhaustion_score.toFixed(3) ?? "?"} | 7d:{" "}
                      {d?.ret_7d_pct ? `+${d.ret_7d_pct.toFixed(1)}%` : "?"} |{" "}
                      {d?.source ?? "?"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Persisted States */}
      {data.candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Active Scanner States ({data.candidates.length})
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <DataTable
              columns={candidateColumns}
              data={data.candidates}
              defaultSort="exhaustion_score"
                            maxHeight="320px"
            />
          </div>
        </Card>
      )}

      {/* Dry-Run Detail */}
      {detailRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Pump Candidates — Dry Run ({detailRows.length} tokens)
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <DataTable
              columns={detailColumns}
              data={detailRows}
              defaultSort="exhaustion_score"
                            maxHeight="480px"
            />
          </div>
        </Card>
      )}

      {/* Empty state */}
      {data.candidates.length === 0 && detailRows.length === 0 && (
        <Card>
          <div className="p-8 text-center text-gray-500">
            No pump candidates detected. Scanner monitors excluded tokens and
            the universe for 7d returns &gt;{data.config.detect_threshold_pct}%.
          </div>
        </Card>
      )}
    </div>
  );
}

function ConfigCard({
  label,
  value,
  color = "text-gray-200",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}
