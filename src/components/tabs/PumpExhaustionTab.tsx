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

interface UniversePump {
  symbol: string;
  ret_7d_pct: number;
  exhaustion_score: number;
  state: string;
  source: string;
  current_price: number | null;
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
  universe_pumps: UniversePump[];
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
      const dd = (r.current_price / r.peak_price - 1) * 100;
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

const pumpColumns: Column<UniversePump>[] = [
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-200">
          {r.symbol.replace("USDT", "")}
        </span>
        {r.exhaustion_score >= 0.35 && stateBadge(r.state)}
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
    render: (r) => (
      <span className="text-red-400 font-mono">+{r.ret_7d_pct.toFixed(1)}%</span>
    ),
    sortKey: (r) => r.ret_7d_pct,
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
    key: "current_price",
    header: "Price",
    render: (r) =>
      r.current_price ? `$${r.current_price.toFixed(4)}` : "-",
    sortKey: (r) => r.current_price ?? 0,
    align: "right",
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

  const aboveThreshold = data.universe_pumps.filter(
    (p) => p.exhaustion_score >= data.config.threshold
  );

  return (
    <div className="space-y-4 p-4">
      {/* Config Cards */}
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
          label="Pumping"
          value={`${data.universe_pumps.length} tokens`}
          color={data.universe_pumps.length > 0 ? "text-yellow-400" : "text-gray-500"}
        />
      </div>

      {/* Sleeve-ready candidates */}
      {aboveThreshold.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Sleeve Candidates ({aboveThreshold.length} above {data.config.threshold} threshold, {data.config.max_included} slots)
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <div className="flex gap-3 flex-wrap">
              {aboveThreshold.slice(0, data.config.max_included).map((p) => (
                <div
                  key={p.symbol}
                  className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 min-w-[180px]"
                >
                  <div className="text-green-400 font-medium">
                    {p.symbol.replace("USDT", "")}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Score: {p.exhaustion_score.toFixed(3)} | 7d: +{p.ret_7d_pct.toFixed(1)}% | {p.source}
                  </div>
                </div>
              ))}
            </div>
            {aboveThreshold.length > data.config.max_included && (
              <div className="text-xs text-gray-500 mt-2">
                +{aboveThreshold.length - data.config.max_included} more above threshold (capped at {data.config.max_included})
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Active Scanner States */}
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

      {/* All Pumping Tokens */}
      {data.universe_pumps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              All Pumping Tokens ({data.universe_pumps.length} with 7d return &gt;{data.config.detect_threshold_pct}%)
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <DataTable
              columns={pumpColumns}
              data={data.universe_pumps}
              defaultSort="ret_7d_pct"
              maxHeight="480px"
            />
          </div>
        </Card>
      )}

      {/* Empty state */}
      {data.candidates.length === 0 && data.universe_pumps.length === 0 && (
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
