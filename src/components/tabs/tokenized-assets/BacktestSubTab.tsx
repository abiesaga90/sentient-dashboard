import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../../ui/Card";

interface MethodStats {
  n_windows: number;
  total_return_pct?: number;
  avg_window_return_pct?: number;
  median_window_return_pct?: number;
  ann_return_pct?: number;
  ann_vol_pct?: number;
  realized_sharpe?: number;
  hit_rate_pct?: number;
  max_drawdown_pct?: number;
}

interface BacktestResult {
  error?: string;
  n_windows?: number;
  rebalance_days?: number;
  holding_days?: number;
  top_n_per_method?: number;
  n_pairs_eligible?: number;
  methods?: Record<string, MethodStats>;
  meta?: {
    n_symbols_with_returns: number;
    n_quality_scored: number;
    n_funding_populated: number;
    n_candidate_pairs: number;
  };
}

const METHOD_LABELS: Record<string, { label: string; description: string }> = {
  random: {
    label: "Random",
    description: "Baseline — pairs sampled uniformly from the universe. The other methods must beat this meaningfully.",
  },
  sharpe_1x: {
    label: "Sharpe (1:1)",
    description: "Rank by carry / spread vol Sharpe. Pure stat-arb-style scoring with no fundamental input.",
  },
  carry_only: {
    label: "Carry only",
    description: "Rank by funding carry APR alone. Tests whether carry is sufficient signal on its own.",
  },
  quality_x_carry: {
    label: "Quality × Carry",
    description: "Rank by Quality Δ (fundamental) × Sharpe. The dashboard's default sort for the alpha-layer thesis.",
  },
};

function MethodRow({ name, s }: { name: string; s: MethodStats }) {
  const meta = METHOD_LABELS[name] ?? { label: name, description: "" };
  const highlight = name === "quality_x_carry";
  return (
    <tr className={`border-t border-slate-800/50 ${highlight ? "bg-emerald-950/10" : ""}`}>
      <td className={`py-2 pl-2 ${highlight ? "text-emerald-300 font-semibold" : "text-gray-300"}`}>
        <div>{meta.label}</div>
        <div className="text-[10px] text-gray-500 font-normal leading-snug">{meta.description}</div>
      </td>
      <td className="py-2 px-2 text-right font-mono">
        {s.total_return_pct != null ? `${s.total_return_pct >= 0 ? "+" : ""}${s.total_return_pct.toFixed(1)}%` : "—"}
      </td>
      <td className="py-2 px-2 text-right font-mono">
        {s.ann_return_pct != null ? `${s.ann_return_pct >= 0 ? "+" : ""}${s.ann_return_pct.toFixed(1)}%` : "—"}
      </td>
      <td className="py-2 px-2 text-right font-mono">
        {s.realized_sharpe != null ? s.realized_sharpe.toFixed(2) : "—"}
      </td>
      <td className="py-2 px-2 text-right font-mono">
        {s.hit_rate_pct != null ? `${s.hit_rate_pct.toFixed(0)}%` : "—"}
      </td>
      <td className="py-2 px-2 text-right font-mono text-red-300/80">
        {s.max_drawdown_pct != null ? `${s.max_drawdown_pct.toFixed(1)}%` : "—"}
      </td>
      <td className="py-2 pr-2 text-right font-mono text-gray-500">
        {s.n_windows}
      </td>
    </tr>
  );
}

export function BacktestSubTab() {
  const { client, engine } = useEngine();
  const [rebalanceDays, setRebalanceDays] = useState(30);
  const [holdingDays, setHoldingDays] = useState(90);
  const [topN, setTopN] = useState(5);

  const { data, isLoading, error, refetch, isFetching } = useQuery<BacktestResult>({
    queryKey: ["tokenized-backtest", engine.id, rebalanceDays, holdingDays, topN],
    queryFn: () =>
      client.get("/api/tokenized-backtest", {
        rebalance_days: rebalanceDays,
        holding_days: holdingDays,
        top_n: topN,
      }),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="text-[11px] text-amber-300/80 bg-amber-950/30 border border-amber-900/40 rounded-md px-3 py-2">
        <span className="font-semibold">Walk-forward backtest.</span>{" "}
        Validates whether the dashboard's ranking methods predict forward P&L over the
        2y daily underlying-return window. At each rebalance, the engine selects the
        top-N pairs by each method using only data available at that point in time
        (no look-ahead), then rolls forward to measure realized spread P&L. The{" "}
        <span className="text-emerald-300">Quality × Carry</span> method MUST
        meaningfully beat the random baseline for the alpha-layer thesis to hold.
        Funding contribution assumed = current funding regime persists; underlying
        P&L from yfinance close-to-close. Stop-loss / take-profit not modeled —
        matches the live book's long-term, no-stop discipline.
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Backtest controls</CardTitle>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-[11px] px-2 py-1 rounded border border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/70 disabled:opacity-50"
            >
              {isFetching ? "Running…" : "Re-run"}
            </button>
          </div>
        </CardHeader>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Rebalance every (days)</label>
            <input
              type="range"
              min="7"
              max="180"
              step="7"
              value={rebalanceDays}
              onChange={(e) => setRebalanceDays(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500"
            />
            <div className="text-center font-mono text-gray-200">{rebalanceDays}d</div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Holding period (days)</label>
            <input
              type="range"
              min="30"
              max="365"
              step="15"
              value={holdingDays}
              onChange={(e) => setHoldingDays(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500"
            />
            <div className="text-center font-mono text-gray-200">
              {holdingDays}d
              <span className="text-[10px] text-gray-500 ml-1">
                ({(holdingDays / 30).toFixed(1)}mo)
              </span>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Top-N pairs per method</label>
            <input
              type="range"
              min="3"
              max="15"
              step="1"
              value={topN}
              onChange={(e) => setTopN(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500"
            />
            <div className="text-center font-mono text-gray-200">{topN}</div>
          </div>
        </div>
      </Card>

      {error && (
        <Card>
          <div className="text-sm text-red-400">
            Backtest request failed: {String((error as Error).message)}
          </div>
        </Card>
      )}

      {isLoading && (
        <Card>
          <div className="py-10 text-center text-xs text-gray-500">
            Running walk-forward backtest…
          </div>
        </Card>
      )}

      {data?.error && (
        <Card>
          <div className="text-sm text-amber-400">
            {data.error}
          </div>
          {data.meta && (
            <div className="text-[11px] text-gray-500 mt-2">
              Symbols with returns: {data.meta.n_symbols_with_returns} · Quality-scored:{" "}
              {data.meta.n_quality_scored} · Funding populated: {data.meta.n_funding_populated} ·
              Candidate pairs: {data.meta.n_candidate_pairs}
            </div>
          )}
        </Card>
      )}

      {data?.methods && Object.keys(data.methods).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>
                Method comparison{" "}
                <span className="text-[11px] font-normal text-gray-500">
                  ({data.n_windows} walk-forward windows · {data.n_pairs_eligible} pair candidates ·
                  top-{topN} per method)
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 text-[10px] uppercase tracking-wide">
                <th className="text-left py-2 pl-2 font-normal">Method</th>
                <th className="text-right py-2 px-2 font-normal">Total</th>
                <th className="text-right py-2 px-2 font-normal">Ann.</th>
                <th className="text-right py-2 px-2 font-normal">Sharpe</th>
                <th className="text-right py-2 px-2 font-normal">Hit rate</th>
                <th className="text-right py-2 px-2 font-normal">Max DD</th>
                <th className="text-right py-2 pr-2 font-normal">n_w</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.methods).map(([name, s]) => (
                <MethodRow key={name} name={name} s={s} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="text-[10px] text-gray-600 italic px-2 leading-snug">
        Realized P&L = (long_return − short_return) × holding_days + funding_carry × (holding_days / 365).
        Funding assumes current regime persists across each holding window (known limitation —
        next iteration will use per-day funding history). Stop-loss / take-profit explicitly NOT
        modeled to match the live book's discipline. Sharpe is annualized realized
        (mean × scale) / (std × √scale) with scale = 365 / rebalance_days. n_w = number of
        evaluation windows the method actually had candidates for.
      </div>
    </div>
  );
}
