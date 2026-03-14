import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";

interface PairMapping {
  long: string;
  short: string;
  match_score: number;
  correlation: number;
  beta_gap: number;
}

interface PairsResponse {
  pairs: PairMapping[];
  unmatched_shorts: string[];
  avg_match_score: number;
}

const scoreColor = (score: number) => {
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-red-400";
};

const pairColumns: Column<PairMapping>[] = [
  {
    key: "long",
    header: "Long",
    render: (r) => (
      <span className="font-medium text-green-400">
        {r.long.replace("USDT", "")}
      </span>
    ),
    sortKey: (r) => r.long,
  },
  {
    key: "short",
    header: "Short",
    render: (r) => (
      <span className="font-medium text-red-400">
        {r.short.replace("USDT", "")}
      </span>
    ),
    sortKey: (r) => r.short,
  },
  {
    key: "match_score",
    header: "Match Score",
    render: (r) => (
      <span className={`font-mono ${scoreColor(r.match_score)}`}>
        {r.match_score.toFixed(3)}
      </span>
    ),
    sortKey: (r) => r.match_score,
    align: "right",
  },
  {
    key: "correlation",
    header: "Correlation",
    render: (r) => (
      <span className="font-mono text-gray-300">{r.correlation.toFixed(3)}</span>
    ),
    sortKey: (r) => r.correlation,
    align: "right",
  },
  {
    key: "beta_gap",
    header: "Beta Gap",
    render: (r) => (
      <span className="font-mono text-gray-300">{r.beta_gap.toFixed(3)}</span>
    ),
    sortKey: (r) => r.beta_gap,
    align: "right",
  },
];

export function PairsTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<PairsResponse>({
    queryKey: ["pairs", engine.id],
    queryFn: () => client.get("/api/pairs"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading pair mapping...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 p-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Avg Match Score"
          value={data.avg_match_score.toFixed(3)}
          valueColor={scoreColor(data.avg_match_score)}
        />
        <KpiCard label="Paired" value={String(data.pairs.length)} />
        <KpiCard
          label="Unmatched Shorts"
          value={String(data.unmatched_shorts.length)}
          valueColor={data.unmatched_shorts.length > 0 ? "text-yellow-400" : "text-gray-100"}
        />
        <KpiCard
          label="Total Positions"
          value={String(data.pairs.length * 2 + data.unmatched_shorts.length)}
        />
      </div>

      {/* Pair Mapping Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pair Mapping ({data.pairs.length})</CardTitle>
        </CardHeader>
        <div className="p-4 pt-0">
          <DataTable
            columns={pairColumns}
            data={data.pairs}
            defaultSort="match_score"
            maxHeight="600px"
          />
        </div>
      </Card>

      {/* Unmatched Shorts */}
      {data.unmatched_shorts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Unmatched Shorts</CardTitle>
              <Badge variant="warning">{data.unmatched_shorts.length}</Badge>
            </div>
          </CardHeader>
          <div className="p-4 pt-0 flex flex-wrap gap-2">
            {data.unmatched_shorts.map((s) => (
              <Badge key={s} variant="default">
                {s.replace("USDT", "")}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
