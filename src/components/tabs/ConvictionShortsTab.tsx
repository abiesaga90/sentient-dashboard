import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { DataTable, type Column } from "../shared/DataTable";
import { Badge } from "../ui/Badge";

// ── Signal bar (reused pattern from ShortSelectionTab) ──
function SignalBar({ value, label }: { value: number | null; label?: string }) {
  if (value == null) return <span className="text-gray-700 text-[11px]">—</span>;
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color =
    pct > 60 ? "bg-red-500" : pct > 30 ? "bg-yellow-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-1.5 min-w-[70px]">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-gray-400 w-8 text-right">
        {label ?? value.toFixed(2)}
      </span>
    </div>
  );
}

// ── Types ──
interface ConvictionCandidate {
  symbol: string;
  rank: number;
  conviction_score: number;
  sub_scores: {
    dilution_overhang: number;
    revenue_void: number;
    valuation_absurdity: number;
    unlock_pressure: number;
  };
  raw: {
    fdv: number | null;
    market_cap: number | null;
    fdv_mcap_ratio: number | null;
    float_pct: number | null;
    fees_30d: number | null;
    holders_revenue_30d: number | null;
    holders_revenue_methodology: string | null;
    tvl: number | null;
    volume_24h_usd: number | null;
    unlock_pressure: number | null;
    supply_delta_30d_pct: number | null;
  };
  in_short_basket: boolean;
  rejection_reasons: string[];
  data_coverage: number;
  corr: number | null;
  beta: number | null;
  corr_pass: boolean | null;
  beta_pass: boolean | null;
}

interface ConvictionShortsResponse {
  candidates: ConvictionCandidate[];
  count: number;
  universe_scored: number;
  in_basket_count: number;
  not_in_basket_count: number;
  weights: Record<string, number>;
}

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B${suffix}`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M${suffix}`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K${suffix}`;
  return `$${v.toFixed(0)}${suffix}`;
}

// ── Columns ──
function buildColumns(): Column<ConvictionCandidate>[] {
  return [
    {
      key: "rank",
      header: "#",
      render: (r) => <span className="text-gray-500 text-xs">{r.rank}</span>,
      sortKey: (r) => r.conviction_score,
    },
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
      key: "score",
      header: "Score",
      render: (r) => {
        const color =
          r.conviction_score >= 80
            ? "text-red-400 font-bold"
            : r.conviction_score >= 60
              ? "text-yellow-400 font-semibold"
              : "text-gray-400";
        return <span className={`${color} text-sm`}>{r.conviction_score.toFixed(1)}</span>;
      },
      sortKey: (r) => r.conviction_score,
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.in_short_basket ? (
          <Badge variant="default" className="bg-green-900/50 text-green-400 text-[10px] px-1.5">
            IN BASKET
          </Badge>
        ) : (
          <Badge variant="default" className="bg-red-900/30 text-red-400 text-[10px] px-1.5">
            NOT SELECTED
          </Badge>
        ),
      sortKey: (r) => (r.in_short_basket ? 0 : 1),
    },
    {
      key: "dilution",
      header: "Dilution",
      render: (r) => (
        <div className="space-y-0.5">
          <SignalBar value={r.sub_scores.dilution_overhang} />
          <span className="text-[10px] text-gray-500">
            {r.raw.fdv_mcap_ratio != null ? `${r.raw.fdv_mcap_ratio.toFixed(1)}x` : "—"}
            {r.raw.float_pct != null ? ` · ${r.raw.float_pct.toFixed(0)}% circ` : ""}
          </span>
        </div>
      ),
      sortKey: (r) => r.sub_scores.dilution_overhang,
    },
    {
      key: "revenue",
      header: "Revenue Void",
      render: (r) => (
        <div className="space-y-0.5">
          <SignalBar value={r.sub_scores.revenue_void} />
          <span className="text-[10px] text-gray-500">
            {r.raw.fees_30d != null ? fmt(r.raw.fees_30d, "/mo") : "no data"}
          </span>
        </div>
      ),
      sortKey: (r) => r.sub_scores.revenue_void,
    },
    {
      key: "valuation",
      header: "Valuation",
      render: (r) => (
        <div className="space-y-0.5">
          <SignalBar value={r.sub_scores.valuation_absurdity} />
          <span className="text-[10px] text-gray-500">
            {fmt(r.raw.fdv)} FDV · {r.raw.tvl != null ? fmt(r.raw.tvl, " TVL") : "no TVL"}
          </span>
        </div>
      ),
      sortKey: (r) => r.sub_scores.valuation_absurdity,
    },
    {
      key: "unlock",
      header: "Unlock",
      render: (r) => (
        <div className="space-y-0.5">
          <SignalBar value={r.sub_scores.unlock_pressure} />
          <span className="text-[10px] text-gray-500">
            {r.raw.supply_delta_30d_pct != null
              ? `${r.raw.supply_delta_30d_pct > 0 ? "+" : ""}${r.raw.supply_delta_30d_pct.toFixed(1)}% 30d`
              : "—"}
          </span>
        </div>
      ),
      sortKey: (r) => r.sub_scores.unlock_pressure,
    },
    {
      key: "corr",
      header: "Corr",
      render: (r) => {
        if (r.corr == null) return <span className="text-gray-600 text-[11px]">—</span>;
        const pass = r.corr_pass;
        return (
          <span className={`text-[11px] font-mono ${pass ? "text-green-400" : "text-red-400"}`}>
            {r.corr.toFixed(2)}
            {pass === false && <span className="text-red-500 ml-0.5">✗</span>}
          </span>
        );
      },
      sortKey: (r) => r.corr ?? -1,
      align: "right",
    },
    {
      key: "beta",
      header: "Beta",
      render: (r) => {
        if (r.beta == null) return <span className="text-gray-600 text-[11px]">—</span>;
        const pass = r.beta_pass;
        return (
          <span className={`text-[11px] font-mono ${pass ? "text-green-400" : "text-red-400"}`}>
            {r.beta.toFixed(2)}
            {pass === false && <span className="text-red-500 ml-0.5">✗</span>}
          </span>
        );
      },
      sortKey: (r) => r.beta ?? -1,
      align: "right",
    },
    {
      key: "why_not",
      header: "Why Not?",
      render: (r) =>
        r.in_short_basket ? (
          <span className="text-green-600 text-[11px]">selected</span>
        ) : (
          <span className="text-red-400/70 text-[11px]">
            {r.rejection_reasons.join("; ") || "—"}
          </span>
        ),
      sortKey: (r) => r.rejection_reasons.length,
    },
  ];
}

// ── Main Component ──
export function ConvictionShortsTab() {
  const { engine, client } = useEngine();

  const { data, isLoading } = useQuery({
    queryKey: ["conviction-shorts", engine.id],
    queryFn: () =>
      client.get<ConvictionShortsResponse>("/api/conviction_shorts"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="text-gray-500 text-sm p-8 text-center">
        Loading conviction scores...
      </div>
    );
  }

  if (!data || data.count === 0) {
    return (
      <div className="text-gray-500 text-sm p-8 text-center">
        No conviction scores available. Scoring runs on next rebalance cycle.
      </div>
    );
  }

  const columns = buildColumns();

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-gray-500">Universe Scored</CardTitle>
            <p className="text-lg font-bold text-gray-200">{data.universe_scored}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-gray-500">In Basket</CardTitle>
            <p className="text-lg font-bold text-green-400">
              {data.in_basket_count}
              <span className="text-gray-500 text-sm font-normal"> / {data.count}</span>
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-gray-500">Not Selected</CardTitle>
            <p className="text-lg font-bold text-red-400">{data.not_in_basket_count}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-gray-500">Top Score</CardTitle>
            <p className="text-lg font-bold text-yellow-400">
              {data.candidates[0]?.conviction_score.toFixed(1) ?? "—"}
              <span className="text-gray-500 text-sm font-normal ml-1">
                {data.candidates[0]?.symbol.replace("USDT", "") ?? ""}
              </span>
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* Weights legend */}
      <div className="flex gap-3 text-[11px] text-gray-500 px-1">
        {Object.entries(data.weights).map(([key, w]) => (
          <span key={key}>
            {key.replace(/_/g, " ")}: {(w * 100).toFixed(0)}%
          </span>
        ))}
      </div>

      {/* Main table */}
      <DataTable
        columns={columns}
        data={data.candidates}
        defaultSort="score"
        defaultDir="desc"
      />
    </div>
  );
}
