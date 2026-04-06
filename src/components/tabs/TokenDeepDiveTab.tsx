import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface SignalComponent {
  value: number | null;
  signal: number;
  label: string;
}

interface TokenDeepDiveResponse {
  symbol: string;
  thesis: string;
  position: {
    side: string;
    entry_price: number;
    current_price: number | null;
    pnl_pct: number | null;
    pnl_usd: number | null;
    notional: number | null;
    hours_held: number | null;
  } | null;
  p3_signal: {
    composite: number | null;
    components: Record<string, SignalComponent>;
    error?: string;
  };
  value_accrual?: {
    mechanism: string;
    confidence: string;
    description: string;
    estimated_holders_revenue_30d: number | null;
    last_audited: string;
  };
  history: Array<{
    date: string;
    data: Record<string, number>;
  }>;
}

function SignalBar({ value }: { value: number }) {
  const pct = Math.abs(value) * 50;
  const isPositive = value >= 0;
  return (
    <div className="relative h-3 w-24 bg-gray-800 rounded overflow-hidden">
      {isPositive ? (
        <div
          className="absolute left-1/2 h-full bg-green-500/70 rounded-r"
          style={{ width: `${pct}%` }}
        />
      ) : (
        <div
          className="absolute right-1/2 h-full bg-red-500/70 rounded-l"
          style={{ width: `${pct}%` }}
        />
      )}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <div className="p-3 text-center">
        <div className="text-xs text-gray-500 uppercase">{label}</div>
        <div className="text-lg font-medium text-gray-200">{value}</div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
    </Card>
  );
}

interface TokenDeepDiveTabProps {
  symbol: string;
  displayName: string;
}

export function TokenDeepDiveTab({ symbol, displayName }: TokenDeepDiveTabProps) {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<TokenDeepDiveResponse>({
    queryKey: ["token-deep-dive", symbol, engine.id],
    queryFn: () => client.get(`/api/tokens/${symbol}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-4 text-gray-500 text-sm">Loading {displayName} data...</div>
    );
  }

  const { position, p3_signal, value_accrual, history } = data;
  const components = p3_signal?.components
    ? Object.entries(p3_signal.components)
    : [];

  return (
    <div className="space-y-4 p-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Composite Signal"
          value={
            p3_signal?.composite !== null && p3_signal?.composite !== undefined
              ? (p3_signal.composite > 0 ? "+" : "") + p3_signal.composite.toFixed(3)
              : "N/A"
          }
        />
        <KpiCard
          label="Position P&L"
          value={
            position?.pnl_pct != null
              ? `${position.pnl_pct > 0 ? "+" : ""}${position.pnl_pct.toFixed(2)}%`
              : "No position"
          }
          sub={
            position?.pnl_usd != null
              ? `$${position.pnl_usd.toFixed(2)}`
              : undefined
          }
        />
        <KpiCard
          label="Notional"
          value={
            position?.notional != null
              ? `$${position.notional.toFixed(0)}`
              : "--"
          }
          sub={position?.side ?? undefined}
        />
        <KpiCard
          label="Hours Held"
          value={
            position?.hours_held != null
              ? `${position.hours_held.toFixed(0)}h`
              : "--"
          }
        />
      </div>

      {/* Thesis Card */}
      <Card>
        <CardHeader>
          <CardTitle>Thesis</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4 text-sm text-gray-300">{data.thesis}</div>
      </Card>

      {/* Signal Components */}
      <Card>
        <CardHeader>
          <CardTitle>OP Signal Components</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4">
          {p3_signal?.error ? (
            <div className="text-sm text-red-400">{p3_signal.error}</div>
          ) : components.length === 0 ? (
            <div className="text-sm text-gray-500">
              No signal data yet (accumulating snapshots)
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {components.map(([name, comp]) => (
                <div
                  key={name}
                  className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">
                      {name.replace(/_/g, " ")}
                    </div>
                    <div className="text-sm text-gray-300 truncate">
                      {comp.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <SignalBar value={comp.signal} />
                    <span
                      className={`font-mono text-xs w-12 text-right ${
                        comp.signal > 0
                          ? "text-green-400"
                          : comp.signal < 0
                            ? "text-red-400"
                            : "text-gray-400"
                      }`}
                    >
                      {comp.signal > 0 ? "+" : ""}
                      {comp.signal.toFixed(3)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Value Accrual */}
      {value_accrual && (
        <Card>
          <CardHeader>
            <CardTitle>Value Accrual</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="info">
                {value_accrual.mechanism.replace(/_/g, " ")}
              </Badge>
              <Badge
                variant={
                  value_accrual.confidence === "verified"
                    ? "success"
                    : value_accrual.confidence === "missing"
                      ? "warning"
                      : "default"
                }
              >
                {value_accrual.confidence}
              </Badge>
            </div>
            <div className="text-sm text-gray-300">
              {value_accrual.description}
            </div>
            {value_accrual.estimated_holders_revenue_30d != null && (
              <div className="text-sm text-gray-400">
                Est. holders revenue (30d):{" "}
                <span className="text-gray-200 font-mono">
                  ${value_accrual.estimated_holders_revenue_30d.toLocaleString()}
                </span>
              </div>
            )}
            <div className="text-xs text-gray-600">
              Last audited: {value_accrual.last_audited}
            </div>
          </div>
        </Card>
      )}

      {/* Historical Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshots (30d)</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4">
          {history.length === 0 ? (
            <div className="text-sm text-gray-500">
              No historical data yet. Snapshots will accumulate after deployment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-[var(--border)]">
                    <th className="text-left py-2 pr-4">Date</th>
                    {history[0]?.data &&
                      Object.keys(history[0].data)
                        .slice(0, 5)
                        .map((key) => (
                          <th key={key} className="text-right py-2 pr-4">
                            {key.replace(/_/g, " ").replace("dl ", "")}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((snap) => (
                    <tr
                      key={snap.date}
                      className="border-b border-[var(--border)] text-gray-300"
                    >
                      <td className="py-1.5 pr-4 font-mono text-xs">
                        {snap.date}
                      </td>
                      {Object.keys(snap.data)
                        .slice(0, 5)
                        .map((key) => {
                          const v = snap.data[key];
                          let display = "--";
                          if (v != null) {
                            if (v >= 1_000_000)
                              display = `$${(v / 1_000_000).toFixed(1)}M`;
                            else if (v >= 1_000)
                              display = `$${Math.round(v).toLocaleString()}`;
                            else display = v.toFixed(4);
                          }
                          return (
                            <td
                              key={key}
                              className="py-1.5 pr-4 text-right font-mono"
                            >
                              {display}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
