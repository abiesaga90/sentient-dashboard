import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { KpiCard } from "../shared/KpiCard";
import {
  useAlphaModel,
  type AlphaModelToken,
  type PerPillarConfidence,
} from "../../hooks/useDashboardQuery";

/* ──────────────────────── Types ──────────────────────── */

type SortKey =
  | "symbol"
  | "adjusted_score"
  | "raw_score"
  | "confidence"
  | "va_score"
  | "sm_score"
  | "p3_score"
  | "mm_score"
  | "n_total";

interface TableRow extends AlphaModelToken {
  symbol: string;
  n_total: number;
}

/* ──────────────────────── Helpers ──────────────────────── */

const fmt = (n: number | null | undefined, digits = 3): string =>
  n == null ? "—" : n.toFixed(digits);

const fmtPct = (n: number | null | undefined, digits = 0): string =>
  n == null ? "—" : `${(n * 100).toFixed(digits)}%`;

const scoreColor = (v: number | null | undefined): string => {
  if (v == null) return "text-gray-500";
  if (v > 0.3) return "text-green-400";
  if (v > 0.05) return "text-green-500/70";
  if (v < -0.3) return "text-red-400";
  if (v < -0.05) return "text-red-500/70";
  return "text-gray-400";
};

const confColor = (c: number): string => {
  if (c >= 0.8) return "text-green-400";
  if (c >= 0.5) return "text-yellow-400";
  if (c > 0) return "text-orange-400";
  return "text-red-500";
};

/* ──────────────────────── Per-pillar bar ──────────────────────── */

function PillarBar({ confidence }: { confidence: PerPillarConfidence }) {
  const segs = [
    { key: "VA", val: confidence.va, color: "bg-blue-500" },
    { key: "SM", val: confidence.sm, color: "bg-green-500" },
    { key: "P3", val: confidence.p3, color: "bg-purple-500" },
    { key: "MM", val: confidence.mm, color: "bg-orange-500" },
  ];
  return (
    <div className="flex items-center gap-1">
      {segs.map((s) => (
        <div
          key={s.key}
          className="h-3 w-6 rounded-sm bg-gray-800 overflow-hidden"
          title={`${s.key}: ${(s.val * 100).toFixed(0)}%`}
        >
          <div
            className={`${s.color} h-full transition-all`}
            style={{ width: `${Math.max(0, Math.min(100, s.val * 100))}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────── Component ──────────────────────── */

export function AlphaModelTab() {
  const { data, isLoading, error } = useAlphaModel();
  const [sortKey, setSortKey] = useState<SortKey>("adjusted_score");
  const [sortDesc, setSortDesc] = useState(true);
  const [hideZeroConf, setHideZeroConf] = useState(false);

  const rows = useMemo<TableRow[]>(() => {
    if (!data?.tokens) return [];
    const out: TableRow[] = [];
    for (const [symbol, t] of Object.entries(data.tokens)) {
      out.push({
        ...t,
        symbol,
        n_total: t.n_va + t.n_sm + t.n_p3 + t.n_mm,
      });
    }
    return out;
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!hideZeroConf) return rows;
    return rows.filter((r) => (r.confidence ?? 0) > 0);
  }, [rows, hideZeroConf]);

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      const na = va == null ? -Infinity : Number(va);
      const nb = vb == null ? -Infinity : Number(vb);
      return sortDesc ? nb - na : na - nb;
    });
    return arr;
  }, [filteredRows, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-red-400 text-sm">Failed to load alpha model: {String(error)}</div>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-gray-400 text-sm">Loading alpha model…</div>
        </Card>
      </div>
    );
  }

  if (!data.available) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Alpha Model</CardTitle>
          </CardHeader>
          <div className="text-gray-400 text-sm">
            {data.reason || "No alpha model snapshot available yet."}
          </div>
        </Card>
      </div>
    );
  }

  const stats = data.universe_stats;
  const flags = data.feature_flags;

  const headerCell = (label: string, key: SortKey, align: "left" | "right" = "right") => (
    <th
      className={`px-2 py-2 text-xs uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-300 ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => handleSort(key)}
    >
      {label}
      {sortKey === key && <span className="ml-1 text-gray-400">{sortDesc ? "↓" : "↑"}</span>}
    </th>
  );

  return (
    <div className="p-4 space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Universe scored"
          value={String(stats.n_scored)}
          sub="tokens with signal data"
        />
        <KpiCard
          label="VA coverage"
          value={`${stats.va_coverage_pct.toFixed(0)}%`}
          sub="tokens with ≥1 VA signal"
          valueColor={
            stats.va_coverage_pct >= 70
              ? "text-green-400"
              : stats.va_coverage_pct >= 40
              ? "text-yellow-400"
              : "text-red-400"
          }
        />
        <KpiCard
          label="Median confidence"
          value={fmtPct(stats.median_confidence, 0)}
          sub="across the universe"
          valueColor={confColor(stats.median_confidence)}
        />
        <KpiCard
          label="VA prior applied"
          value={String(stats.n_va_prior_applied)}
          sub={flags.va_skeptical_prior_enabled ? "flag ON" : "flag OFF (computed only)"}
          valueColor={stats.n_va_prior_applied > 0 ? "text-orange-400" : "text-gray-400"}
        />
        <KpiCard
          label="Per-pillar gating"
          value={flags.per_pillar_confidence ? "ON" : "OFF"}
          sub="MM-only kill switch"
          valueColor={flags.per_pillar_confidence ? "text-green-400" : "text-gray-400"}
        />
      </div>

      {/* Layer note */}
      <Card>
        <div className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Layer 1 — Alpha Model:</strong>{" "}
          per-token expected return from the four-pillar scoring pipeline (VA + SM + P3 + MM).
          Confidence is reported per-pillar so you can see exactly which signals carry each
          token. When <code className="text-gray-300">PER_PILLAR_CONFIDENCE</code> is on,
          MM contribution is gated to require at least one fundamental pillar — kills
          momentum-only candidates without ad-hoc rules. When{" "}
          <code className="text-gray-300">VA_SKEPTICAL_PRIOR_ENABLED</code> is on, tokens
          with zero VA signals get <code className="text-gray-300">va_score</code> shrunk
          to <code className="text-gray-300">−0.30</code> (BTCUSDT, ETHUSDT, TRXUSDT exempt).
        </div>
      </Card>

      {/* Token table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Per-Token Expected Returns</CardTitle>
            <button
              onClick={() => setHideZeroConf(!hideZeroConf)}
              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                hideZeroConf
                  ? "bg-blue-900/30 text-blue-300 border-blue-700/50"
                  : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
              }`}
            >
              {hideZeroConf ? "Showing only conf > 0" : "Show all"}
            </button>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr>
                {headerCell("Symbol", "symbol", "left")}
                <th className="px-2 py-2 text-xs uppercase tracking-wider text-gray-500 text-left">
                  Profile
                </th>
                {headerCell("Adj Score", "adjusted_score")}
                {headerCell("Raw", "raw_score")}
                {headerCell("Conf", "confidence")}
                <th className="px-2 py-2 text-xs uppercase tracking-wider text-gray-500 text-left">
                  Pillar Conf
                </th>
                {headerCell("VA", "va_score")}
                {headerCell("SM", "sm_score")}
                {headerCell("P3", "p3_score")}
                {headerCell("MM", "mm_score")}
                {headerCell("n", "n_total")}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.symbol} className="border-b border-gray-900 hover:bg-gray-900/40">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-200 font-mono">
                        {r.symbol.replace("USDT", "")}
                      </span>
                      {r.va_prior_applied && (
                        <Badge variant="warning" className="text-[9px] px-1 py-0">
                          VA prior
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-gray-500">
                    {r.va_profile?.replace("_", " ") || "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${scoreColor(r.adjusted_score)}`}>
                    {r.adjusted_score != null
                      ? `${r.adjusted_score >= 0 ? "+" : ""}${fmt(r.adjusted_score)}`
                      : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono text-xs ${scoreColor(r.raw_score)}`}>
                    {r.raw_score != null
                      ? `${r.raw_score >= 0 ? "+" : ""}${fmt(r.raw_score)}`
                      : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${confColor(r.confidence ?? 0)}`}>
                    {fmtPct(r.confidence)}
                  </td>
                  <td className="px-2 py-1.5">
                    <PillarBar confidence={r.per_pillar_confidence} />
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono text-xs ${scoreColor(r.va_score)}`}>
                    {fmt(r.va_score)}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono text-xs ${scoreColor(r.sm_score)}`}>
                    {fmt(r.sm_score)}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono text-xs ${scoreColor(r.p3_score)}`}>
                    {fmt(r.p3_score)}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono text-xs ${scoreColor(r.mm_score)}`}>
                    {fmt(r.mm_score)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-500">
                    {r.n_va}/{r.n_sm}/{r.n_p3}/{r.n_mm}
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-4 text-center text-gray-500">
                    No tokens to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[11px] text-gray-600 leading-relaxed space-y-1">
          <div>
            <strong className="text-gray-500">Pillar Conf bars:</strong> blue=VA, green=SM,
            purple=P3, orange=MM. A token with no fundamental pillars and only orange (MM)
            is exactly the case <code className="text-gray-500">PER_PILLAR_CONFIDENCE</code>{" "}
            kills.
          </div>
          <div>
            <strong className="text-gray-500">n column:</strong> signal counts per pillar
            (VA/SM/P3/MM). Sort by adjusted score to see ranking.
          </div>
        </div>
      </Card>
    </div>
  );
}
