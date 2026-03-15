import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface SignalComponent {
  value: number | null;
  signal: number;
  label: string;
}

interface TokenSignal {
  source: string;
  signal: number | null;
  tilt_contribution: number;
  weight: number;
  token_boost: number;
  enabled: boolean;
  components: Record<string, SignalComponent>;
  pillar: string;
  error?: string;
}

interface TokenSignalsResponse {
  tokens: Record<string, TokenSignal>;
  coverage: {
    total_longs: number;
    with_signals: number;
    enabled: number;
    three_pillar: boolean;
  };
}

function SignalBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.abs(value) * 50;
  const isPositive = value >= 0;
  return (
    <div className={`relative h-3 w-24 bg-gray-800 rounded overflow-hidden ${className}`}>
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

function TokenRow({ symbol, data }: { symbol: string; data: TokenSignal }) {
  const [expanded, setExpanded] = useState(false);
  const displaySymbol = symbol.replace("USDT", "");
  const components = Object.entries(data.components);

  return (
    <div
      className={`border border-[var(--border)] rounded-lg overflow-hidden ${
        data.enabled ? "" : "opacity-60"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors text-left"
      >
        <span className="font-medium text-gray-200 w-16">{displaySymbol}</span>
        <Badge variant={data.source === "custom" ? "info" : "default"}>
          {data.source === "custom" ? "Custom" : "Blockworks"}
        </Badge>
        <div className="flex-1 flex items-center gap-2">
          {data.signal !== null ? (
            <>
              <SignalBar value={data.signal} />
              <span
                className={`font-mono text-sm ${
                  data.signal > 0
                    ? "text-green-400"
                    : data.signal < 0
                      ? "text-red-400"
                      : "text-gray-400"
                }`}
              >
                {data.signal > 0 ? "+" : ""}
                {data.signal.toFixed(3)}
              </span>
            </>
          ) : (
            <span className="text-gray-500 text-sm">No data</span>
          )}
        </div>
        <span className="font-mono text-xs text-gray-500 w-20 text-right">
          boost={data.token_boost.toFixed(3)}
        </span>
        <Badge variant={data.enabled ? "success" : "default"}>
          {data.enabled ? `w=${data.weight}` : "OFF"}
        </Badge>
        <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && components.length > 0 && (
        <div className="px-4 pb-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="text-xs text-gray-500 mt-2 mb-1 uppercase tracking-wide">
            Pillar 3: Token Components
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
            {components.map(([name, comp]) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] rounded border border-[var(--border)]"
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
                  <SignalBar value={comp.signal} className="w-16" />
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
                    {comp.signal.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TokenSignalsTab() {
  const { client, engine } = useEngine();
  const { data, isLoading } = useQuery<TokenSignalsResponse>({
    queryKey: ["token-signals", engine.id],
    queryFn: () => client.get("/api/token-signals"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-4 text-gray-500 text-sm">Loading token signals...</div>
    );
  }

  const { tokens, coverage } = data;
  const sorted = Object.entries(tokens).sort(
    ([, a], [, b]) => Math.abs(b.signal ?? 0) - Math.abs(a.signal ?? 0)
  );

  const enabledTokens = Object.values(tokens).filter((t) => t.enabled);

  return (
    <div className="space-y-4 p-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <div className="p-3 text-center">
            <div className="text-xs text-gray-500 uppercase">Coverage</div>
            <div className="text-lg font-medium text-gray-200">
              {coverage.with_signals}/{coverage.total_longs}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-3 text-center">
            <div className="text-xs text-gray-500 uppercase">Enabled</div>
            <div className="text-lg font-medium text-gray-200">
              {coverage.enabled}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-3 text-center">
            <div className="text-xs text-gray-500 uppercase">System</div>
            <div className="text-lg font-medium text-gray-200">
              {coverage.three_pillar ? "3-Pillar" : "Legacy"}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-3 text-center">
            <div className="text-xs text-gray-500 uppercase">Data Sources</div>
            <div className="text-lg font-medium text-gray-200">
              {new Set(Object.values(tokens).map((t) => t.source)).size}
            </div>
          </div>
        </Card>
      </div>

      {/* Token Rows */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Token Signals (Pillar 3)</CardTitle>
        </CardHeader>
        <div className="p-3 space-y-2">
          {sorted.map(([symbol, tok]) => (
            <TokenRow key={symbol} symbol={symbol} data={tok} />
          ))}
          {sorted.length === 0 && (
            <div className="text-gray-500 text-sm text-center py-8">
              No token signals configured
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
