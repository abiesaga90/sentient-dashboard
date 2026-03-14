import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import type { RankingCandidate, RankingsResponse } from "../../types/api";

const columns: Column<RankingCandidate>[] = [
  {
    key: "rank",
    header: "#",
    render: (r) => <span className="text-gray-500">{r.rank}</span>,
    sortKey: (r) => r.rank,
  },
  {
    key: "symbol",
    header: "Symbol",
    render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-200">
          {r.symbol.replace("USDT", "")}
        </span>
        {r.in_basket && <Badge variant="info">Active</Badge>}
        {r.excluded && (
          <Badge variant="warning" title={r.exclusion_reason || "Excluded"}>
            Excl
          </Badge>
        )}
      </div>
    ),
    sortKey: (r) => r.symbol,
  },
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
    key: "correlation",
    header: "Corr",
    render: (r) => r.correlation.toFixed(3),
    sortKey: (r) => r.correlation,
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
    key: "daily_vol",
    header: "Vol",
    render: (r) => `${(r.daily_vol * 100).toFixed(1)}%`,
    sortKey: (r) => r.daily_vol,
    align: "right",
  },
];

export function ShortSelectionTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery({
    queryKey: ["rankings", engine.id],
    queryFn: () =>
      client.get<RankingsResponse>("/api/rankings", { limit: 200 }),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading rankings...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {data && (
        <div className="flex gap-3 text-xs text-gray-500">
          <span>N_SHORTS: {data.n_shorts}</span>
          <span>Corr Method: {data.correlation_method}</span>
          <span>Candidates: {data.count}</span>
        </div>
      )}

      {data?.signal_weights && Object.keys(data.signal_weights).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Signal Weights</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.signal_weights).map(([k, v]) => (
              <Badge key={k} variant="default">
                {k}: {(v as number).toFixed(2)}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Short Rankings</CardTitle>
        </CardHeader>
        <DataTable
          columns={columns}
          data={data?.rankings ?? []}
          defaultSort="score"
          defaultDir="desc"
          maxHeight="max-h-[600px]"
        />
      </Card>
    </div>
  );
}
