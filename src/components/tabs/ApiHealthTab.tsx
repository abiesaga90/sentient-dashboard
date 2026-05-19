import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";

type Status = "ok" | "degraded" | "down" | "disabled";
type Category = "execution" | "market_data" | "signal_paid" | "signal_free";

interface HealthRow {
  name: string;
  category: Category;
  status: Status;
  latency_ms: number | null;
  reason: string | null;
  detail: Record<string, unknown>;
  last_success_at: string | null;
}

interface HealthResponse {
  fetched_at: string;
  summary: {
    ok: number;
    degraded: number;
    down: number;
    disabled: number;
    total: number;
  };
  rows: HealthRow[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  execution: "Execution Infrastructure",
  market_data: "Market Data",
  signal_paid: "Signal Feeds (Paid)",
  signal_free: "Signal Feeds (Free)",
};

const CATEGORY_ORDER: Category[] = [
  "execution",
  "market_data",
  "signal_paid",
  "signal_free",
];

function statusDot(s: Status) {
  const map = {
    ok: "bg-green-500",
    degraded: "bg-amber-500",
    down: "bg-red-500",
    disabled: "bg-gray-600",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${map[s]}`}
      aria-label={s}
    />
  );
}

function statusBadge(s: Status) {
  const variant =
    s === "ok"
      ? "success"
      : s === "degraded"
      ? "warning"
      : s === "down"
      ? "danger"
      : "default";
  return <Badge variant={variant as never}>{s.toUpperCase()}</Badge>;
}

function fmtLatency(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 100) return <span className="text-green-400">{ms.toFixed(0)}ms</span>;
  if (ms < 500) return <span className="text-gray-300">{ms.toFixed(0)}ms</span>;
  if (ms < 1500) return <span className="text-amber-400">{ms.toFixed(0)}ms</span>;
  return <span className="text-red-400">{ms.toFixed(0)}ms</span>;
}

function fmtDetail(detail: Record<string, unknown>) {
  const entries = Object.entries(detail).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
      {entries.map(([k, v]) => (
        <span key={k} className="mr-3">
          {k}={String(v)}
        </span>
      ))}
    </div>
  );
}

export function ApiHealthTab() {
  const { client, engine } = useEngine();
  const { data, isLoading, refetch, isFetching } = useQuery<HealthResponse>({
    queryKey: ["infra-health", engine.id],
    queryFn: () => client.get("/api/infra-health"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Probing upstream APIs…
      </div>
    );
  }
  if (!data) return null;

  const byCategory: Record<Category, HealthRow[]> = {
    execution: [],
    market_data: [],
    signal_paid: [],
    signal_free: [],
  };
  for (const r of data.rows) byCategory[r.category].push(r);

  const fetchedAge = Math.round(
    (Date.now() - new Date(data.fetched_at).getTime()) / 1000,
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header summary */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API & Data Source Health</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Live probe of every upstream the engine depends on. Cached 30s server-side;
              refreshes every 60s on the client.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-[11px] px-2.5 py-1 rounded border border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-300 disabled:opacity-50"
            >
              {isFetching ? "Probing…" : "Re-probe"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 mt-4">
          <SummaryCell label="OK" value={data.summary.ok} cls="text-green-400" />
          <SummaryCell label="Degraded" value={data.summary.degraded} cls="text-amber-400" />
          <SummaryCell label="Down" value={data.summary.down} cls="text-red-400" />
          <SummaryCell label="Disabled" value={data.summary.disabled} cls="text-gray-500" />
          <SummaryCell label="Total" value={data.summary.total} cls="text-gray-300" />
        </div>
        <div className="text-[10px] text-gray-600 mt-3">
          Last probe: {fetchedAge}s ago
        </div>
      </Card>

      {/* Category sections */}
      {CATEGORY_ORDER.map((cat) => {
        const rows = byCategory[cat];
        if (rows.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader>
              <CardTitle>{CATEGORY_LABELS[cat]}</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-[var(--border)]">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-gray-500 w-8"></th>
                    <th className="px-3 py-1.5 text-left text-gray-500">Service</th>
                    <th className="px-3 py-1.5 text-right text-gray-500">Latency</th>
                    <th className="px-3 py-1.5 text-center text-gray-500">Status</th>
                    <th className="px-3 py-1.5 text-left text-gray-500">Reason / Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((r) => (
                    <tr key={r.name} className="hover:bg-[var(--bg-card-hover)] align-top">
                      <td className="px-3 py-2">{statusDot(r.status)}</td>
                      <td className="px-3 py-2 text-gray-200 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-right">{fmtLatency(r.latency_ms)}</td>
                      <td className="px-3 py-2 text-center">{statusBadge(r.status)}</td>
                      <td className="px-3 py-2 text-gray-400">
                        {r.reason ? (
                          <span
                            className={
                              r.status === "down"
                                ? "text-red-400"
                                : r.status === "degraded"
                                ? "text-amber-400"
                                : r.status === "disabled"
                                ? "text-gray-500"
                                : "text-gray-400"
                            }
                          >
                            {r.reason}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                        {fmtDetail(r.detail)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}
