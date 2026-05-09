import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { ChartContainer } from "../shared/ChartContainer";
import { DataTable, type Column } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";

interface PairMapping {
  long: string;
  short: string;
  match_score: number;
  correlation?: number;
  beta_gap?: number;
  match_details?: { sector?: number; mcap?: number; vol?: number; beta?: number; corr?: number };
  corr_7d?: number | null;
  corr_drift?: number | null;
}

interface PairsResponse {
  pairs: PairMapping[];
  unmatched_shorts: string[];
  avg_match_score: number;
}

interface SectorRow {
  sector: string;
  n_longs: number;
  n_shorts: number;
  gross_long: number;
  gross_short: number;
  net_exposure: number;
  net_pct_of_gross: number;
  unrealized_pnl?: number;
  realized_pnl_today?: number;
  total_pnl_today?: number;
  hedge_ratio?: number | null;
  short_concentration_pct?: number;
  unrealized_long?: number;
  unrealized_short?: number;
  long_symbols?: string[];
  short_symbols?: string[];
}

interface SectorHistoryRow {
  date: string;
  sector: string;
  net_pct_of_gross: number;
}

interface SectorExposureResponse {
  date: string;
  sectors: SectorRow[];
  summary: {
    sector_coverage_pct: number;
    n_sectors_long: number;
    n_sectors_short: number;
    unhedged_sectors: string[];
    max_sector_gap_pct: number;
    max_sector_gap_name: string | null;
    total_gross: number;
    short_concentration_max_pct?: number;
    short_concentration_max_sector?: string;
  };
  history: SectorHistoryRow[];
  coverage_trend?: Array<{ date: string; coverage_pct: number }>;
}

// Distinct colors per sector for the stacked area chart
const SECTOR_COLORS: Record<string, string> = {
  l1: "#3b82f6",
  ai: "#8b5cf6",
  defi: "#10b981",
  defi_lending: "#06b6d4",
  defi_dex: "#14b8a6",
  defi_yield: "#22d3ee",
  privacy: "#f59e0b",
  storage: "#ec4899",
  oracle: "#f97316",
  gaming: "#a855f7",
  meme: "#ef4444",
  infra: "#6366f1",
  other: "#64748b",
};

const scoreColor = (score: number) => {
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-red-400";
};

const sectorStatusBadge = (row: SectorRow) => {
  if (row.n_longs > 0 && row.n_shorts === 0) return <Badge variant="danger">UNHEDGED</Badge>;
  if (row.n_longs === 0 && row.n_shorts > 0) return <Badge variant="warning">SHORT ONLY</Badge>;
  if (row.n_longs === 0 && row.n_shorts === 0) return <Badge variant="default">EMPTY</Badge>;
  const absNet = Math.abs(row.net_pct_of_gross);
  if (absNet > 20) return <Badge variant="warning">HIGH TILT</Badge>;
  if (absNet > 10) return <Badge variant="info">TILTED</Badge>;
  return <Badge variant="success">HEDGED</Badge>;
};

const netColor = (pct: number) => {
  const abs = Math.abs(pct);
  if (abs > 20) return "text-red-400";
  if (abs > 10) return "text-yellow-400";
  return "text-gray-300";
};

const sectorColumns: Column<SectorRow>[] = [
  {
    key: "sector",
    header: "Sector",
    render: (r) => (
      <div className="flex flex-col gap-1 min-w-[220px]">
        <span className="font-medium text-gray-100 capitalize">{r.sector.replace(/_/g, " ")}</span>
        {(r.long_symbols && r.long_symbols.length > 0) || (r.short_symbols && r.short_symbols.length > 0) ? (
          <div className="flex flex-wrap gap-1 max-w-[420px]">
            {(r.long_symbols ?? []).map((sym) => (
              <span
                key={`L-${sym}`}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-300 border border-green-500/20"
                title={`Long ${sym}`}
              >
                L {sym}
              </span>
            ))}
            {(r.short_symbols ?? []).map((sym) => (
              <span
                key={`S-${sym}`}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20"
                title={`Short ${sym}`}
              >
                S {sym}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    ),
    sortKey: (r) => r.sector,
  },
  {
    key: "n_longs",
    header: "Longs",
    render: (r) => <span className="font-mono text-green-400">{r.n_longs}</span>,
    sortKey: (r) => r.n_longs,
    align: "right",
  },
  {
    key: "n_shorts",
    header: "Shorts",
    render: (r) => <span className="font-mono text-red-400">{r.n_shorts}</span>,
    sortKey: (r) => r.n_shorts,
    align: "right",
  },
  {
    key: "gross_long",
    header: "Long $",
    render: (r) => <span className="font-mono text-gray-300">${r.gross_long.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>,
    sortKey: (r) => r.gross_long,
    align: "right",
  },
  {
    key: "gross_short",
    header: "Short $",
    render: (r) => <span className="font-mono text-gray-300">${r.gross_short.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>,
    sortKey: (r) => r.gross_short,
    align: "right",
  },
  {
    key: "hedge_ratio",
    header: "Hedge %",
    render: (r) => {
      if (r.hedge_ratio == null) return <span className="text-gray-600">&mdash;</span>;
      const color = r.hedge_ratio >= 80 ? "text-green-400" : r.hedge_ratio >= 40 ? "text-yellow-400" : "text-red-400";
      return <span className={`font-mono ${color}`}>{r.hedge_ratio.toFixed(0)}%</span>;
    },
    sortKey: (r) => r.hedge_ratio ?? -1,
    align: "right" as const,
  },
  {
    key: "net_exposure",
    header: "Net $",
    render: (r) => (
      <span className={`font-mono ${netColor(r.net_pct_of_gross)}`}>
        {r.net_exposure >= 0 ? "+" : ""}${r.net_exposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
    ),
    sortKey: (r) => r.net_exposure,
    align: "right",
  },
  {
    key: "net_pct_of_gross",
    header: "Net %",
    render: (r) => (
      <span className={`font-mono ${netColor(r.net_pct_of_gross)}`}>
        {r.net_pct_of_gross >= 0 ? "+" : ""}{r.net_pct_of_gross.toFixed(1)}%
      </span>
    ),
    sortKey: (r) => Math.abs(r.net_pct_of_gross),
    align: "right",
  },
  {
    key: "unrealized_long",
    header: "Long P&L",
    render: (r) => {
      const v = r.unrealized_long ?? 0;
      return (
        <span className={`font-mono ${v >= 0 ? "text-green-400" : "text-red-400"}`}>
          {v >= 0 ? "+" : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      );
    },
    sortKey: (r) => r.unrealized_long ?? 0,
    align: "right" as const,
  },
  {
    key: "unrealized_short",
    header: "Short P&L",
    render: (r) => {
      const v = r.unrealized_short ?? 0;
      return (
        <span className={`font-mono ${v >= 0 ? "text-green-400" : "text-red-400"}`}>
          {v >= 0 ? "+" : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      );
    },
    sortKey: (r) => r.unrealized_short ?? 0,
    align: "right" as const,
  },
  {
    key: "unrealized_pnl",
    header: "Net Unrl P&L",
    render: (r) => {
      const v = r.unrealized_pnl ?? ((r.unrealized_long ?? 0) + (r.unrealized_short ?? 0));
      return (
        <span className={`font-mono font-semibold ${v >= 0 ? "text-green-400" : "text-red-400"}`}>
          {v >= 0 ? "+" : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      );
    },
    sortKey: (r) => r.unrealized_pnl ?? ((r.unrealized_long ?? 0) + (r.unrealized_short ?? 0)),
    align: "right",
  },
  {
    key: "status",
    header: "Status",
    render: (r) => sectorStatusBadge(r),
    sortKey: (r) => {
      if (r.n_longs > 0 && r.n_shorts === 0) return 0;
      return Math.abs(r.net_pct_of_gross);
    },
    align: "center",
  },
  {
    key: "short_concentration_pct",
    header: "Short Conc.",
    render: (r) => {
      const v = r.short_concentration_pct ?? 0;
      if (v === 0) return <span className="text-gray-600">&mdash;</span>;
      const color = v > 40 ? "text-red-400 font-semibold" : v > 25 ? "text-yellow-400" : "text-gray-300";
      return <span className={`font-mono ${color}`}>{v.toFixed(1)}%</span>;
    },
    sortKey: (r) => r.short_concentration_pct ?? 0,
    align: "right" as const,
  },
];

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
    key: "sector_match",
    header: "Sector",
    render: (r) => {
      const s = r.match_details?.sector;
      if (s === 1) return <Badge variant="success">MATCH</Badge>;
      return <Badge variant="default">CROSS</Badge>;
    },
    sortKey: (r) => r.match_details?.sector ?? 0,
    align: "center",
  },
  {
    key: "match_score",
    header: "Match",
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
    header: "Corr",
    render: (r) => {
      const corr = r.correlation ?? r.match_details?.corr;
      return (
        <span className="font-mono text-gray-300">{corr != null ? corr.toFixed(3) : "\u2014"}</span>
      );
    },
    sortKey: (r) => r.correlation ?? r.match_details?.corr ?? 0,
    align: "right",
  },
  {
    key: "beta_gap",
    header: "Beta",
    render: (r) => {
      const beta = r.beta_gap ?? r.match_details?.beta;
      return (
        <span className="font-mono text-gray-300">{beta != null ? beta.toFixed(3) : "\u2014"}</span>
      );
    },
    sortKey: (r) => r.beta_gap ?? r.match_details?.beta ?? 0,
    align: "right",
  },
  {
    key: "corr_7d",
    header: "Corr 7d",
    render: (r) => {
      if (r.corr_7d == null) return <span className="text-gray-600">&mdash;</span>;
      return <span className="font-mono text-gray-300">{r.corr_7d.toFixed(3)}</span>;
    },
    sortKey: (r) => r.corr_7d ?? 0,
    align: "right" as const,
  },
  {
    key: "corr_drift",
    header: "Drift",
    render: (r) => {
      if (r.corr_drift == null) return <span className="text-gray-600">&mdash;</span>;
      const abs = Math.abs(r.corr_drift);
      const color = abs > 0.15 ? "text-red-400 font-semibold" : abs > 0.08 ? "text-yellow-400" : "text-gray-500";
      const arrow = r.corr_drift > 0.02 ? "\u2193" : r.corr_drift < -0.02 ? "\u2191" : "\u2192";
      return <span className={`font-mono ${color}`}>{arrow} {r.corr_drift >= 0 ? "+" : ""}{r.corr_drift.toFixed(3)}</span>;
    },
    sortKey: (r) => Math.abs(r.corr_drift ?? 0),
    align: "right" as const,
  },
];

export function PairsTab() {
  const { client, engine } = useEngine();

  const { data: sectorData, isLoading: sectorLoading } = useQuery<SectorExposureResponse>({
    queryKey: ["sector-exposure", engine.id],
    queryFn: () => client.get("/api/sector-exposure"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: pairsData, isLoading: pairsLoading } = useQuery<PairsResponse>({
    queryKey: ["pairs", engine.id],
    queryFn: () => client.get("/api/pairs"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Pivot history rows [{date, sector, net_pct_of_gross}] into chart-friendly
  // [{date, l1: 5.2, ai: -3.1, ...}] for stacked area chart
  const { historyChart, historySectors } = useMemo(() => {
    if (!sectorData?.history?.length) return { historyChart: [], historySectors: [] };
    const byDate: Record<string, Record<string, number>> = {};
    const sectorSet = new Set<string>();
    for (const row of sectorData.history) {
      if (!byDate[row.date]) byDate[row.date] = {};
      byDate[row.date][row.sector] = row.net_pct_of_gross;
      sectorSet.add(row.sector);
    }
    const sectors = Array.from(sectorSet).sort();
    const chart = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => {
        const entry: Record<string, string | number> = { date: date.slice(5) }; // MM-DD
        for (const s of sectors) entry[s] = vals[s] ?? 0;
        return entry;
      });
    return { historyChart: chart, historySectors: sectors };
  }, [sectorData?.history]);

  if (sectorLoading && pairsLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading sector exposure...
      </div>
    );
  }

  const summary = sectorData?.summary;

  return (
    <div className="space-y-4 p-4">
      {/* Sector KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KpiCard
            label="Sector Coverage"
            value={`${summary.sector_coverage_pct.toFixed(0)}%`}
            sub={`${summary.n_sectors_short} of ${summary.n_sectors_long} long sectors hedged`}
            valueColor={summary.sector_coverage_pct >= 80 ? "text-green-400" : summary.sector_coverage_pct >= 60 ? "text-yellow-400" : "text-red-400"}
          />
          <KpiCard
            label="Max Sector Gap"
            value={`${summary.max_sector_gap_pct.toFixed(1)}%`}
            sub={summary.max_sector_gap_name?.replace(/_/g, " ") ?? ""}
            valueColor={summary.max_sector_gap_pct > 20 ? "text-red-400" : summary.max_sector_gap_pct > 10 ? "text-yellow-400" : "text-green-400"}
          />
          <KpiCard
            label="Unhedged"
            value={String(summary.unhedged_sectors.length)}
            sub={summary.unhedged_sectors.length > 0 ? summary.unhedged_sectors.map(s => s.replace(/_/g, " ")).join(", ") : "none"}
            valueColor={summary.unhedged_sectors.length > 0 ? "text-red-400" : "text-green-400"}
          />
          {pairsData && (
            <>
              <KpiCard
                label="Avg Match Score"
                value={pairsData.avg_match_score.toFixed(3)}
                valueColor={scoreColor(pairsData.avg_match_score)}
              />
              <KpiCard
                label="Pairs / Unmatched"
                value={`${pairsData.pairs.length} / ${pairsData.unmatched_shorts.length}`}
              />
            </>
          )}
          {summary?.short_concentration_max_pct != null && (
            <KpiCard
              label="Short Concentration"
              value={`${summary.short_concentration_max_pct.toFixed(0)}%`}
              sub={summary.short_concentration_max_sector?.replace(/_/g, " ") ?? ""}
              valueColor={summary.short_concentration_max_pct > 40 ? "text-red-400" : summary.short_concentration_max_pct > 25 ? "text-yellow-400" : "text-green-400"}
            />
          )}
        </div>
      )}

      {/* Sector Exposure Table */}
      {sectorData && sectorData.sectors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sector Exposure ({sectorData.sectors.length} sectors)</CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <DataTable
              columns={sectorColumns}
              data={sectorData.sectors}
              defaultSort="net_pct_of_gross"
              defaultDir="desc"
              maxHeight="400px"
            />
          </div>
        </Card>
      )}

      {/* Coverage Trend */}
      {sectorData?.coverage_trend && sectorData.coverage_trend.length > 1 && (
        <ChartContainer title="Sector Coverage Over Time (%)" height={180}>
          <AreaChart data={sectorData.coverage_trend.map(d => ({ ...d, date: d.date.slice(5) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1e1e2e" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: "6px", fontSize: "11px" }}
              formatter={(value) => [`${Number(value).toFixed(1)}%`, "Coverage"]}
            />
            <Area type="monotone" dataKey="coverage_pct" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
          </AreaChart>
        </ChartContainer>
      )}

      {/* Sector Exposure History Chart */}
      {historyChart.length > 1 && (
        <ChartContainer title="Net Sector Exposure Over Time (% of Gross)" height={280}>
          <AreaChart data={historyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#1e1e2e" }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#111118",
                border: "1px solid #1e1e2e",
                borderRadius: "6px",
                fontSize: "11px",
              }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(value, name) => {
                const v = Number(value);
                return [`${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, String(name).replace(/_/g, " ")];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px" }}
              formatter={(v: string) => v.replace(/_/g, " ")}
            />
            {historySectors.map((sector) => (
              <Area
                key={sector}
                type="monotone"
                dataKey={sector}
                stackId="1"
                stroke={SECTOR_COLORS[sector] || "#64748b"}
                fill={SECTOR_COLORS[sector] || "#64748b"}
                fillOpacity={0.4}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      )}

      {/* Pair Mapping Table */}
      {pairsData && pairsData.pairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pair Mapping ({pairsData.pairs.length})</CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <DataTable
              columns={pairColumns}
              data={pairsData.pairs}
              defaultSort="match_score"
              maxHeight="600px"
            />
          </div>
        </Card>
      )}

      {/* Unmatched Shorts */}
      {pairsData && pairsData.unmatched_shorts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Unmatched Shorts</CardTitle>
              <Badge variant="warning">{pairsData.unmatched_shorts.length}</Badge>
            </div>
          </CardHeader>
          <div className="p-4 pt-0 flex flex-wrap gap-2">
            {pairsData.unmatched_shorts.map((s) => (
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
