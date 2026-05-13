import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface TeroxxTicker {
  symbol: string;
  name: string | null;
  sector: string | null;
  verdict: string;
  spot_usd: number | null;
  pwpt_usd: number | null;
  return_pwpt: number | null;
  return_bear: number | null;
  return_base: number | null;
  return_bull: number | null;
}

interface TeroxxValuation {
  extracted_at: string;
  methodology: string;
  note: string;
  tickers: TeroxxTicker[];
}

interface PositionRow {
  symbol: string;
  side: "LONG" | "SHORT" | string;
}

interface PositionsResponse {
  positions?: PositionRow[];
}

interface Props {
  /** Optional context label, e.g. "long" or "short", to bias the sort */
  highlight?: "long" | "short" | "both";
}

const verdictColor = (v: string): string => {
  if (v === "OVERWEIGHT") return "bg-emerald-900/40 text-emerald-300 border-emerald-700";
  if (v === "UNDERWEIGHT") return "bg-red-900/40 text-red-300 border-red-700";
  if (v === "NEUTRAL") return "bg-amber-900/40 text-amber-300 border-amber-700";
  return "bg-gray-800/40 text-gray-400 border-gray-700";
};

const returnColor = (r: number | null | undefined): string => {
  if (r == null) return "text-gray-500";
  if (r >= 0.5) return "text-emerald-400";
  if (r >= 0) return "text-emerald-500/70";
  if (r >= -0.3) return "text-amber-400";
  return "text-red-400";
};

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  const max = v < 1 ? 4 : 2;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: max })}`;
}

export function TeroxxValuationPanel({ highlight = "both" }: Props) {
  const { client, engine } = useEngine();

  const { data: teroxx } = useQuery<TeroxxValuation>({
    queryKey: ["teroxx-valuation", engine.id],
    queryFn: () => client.get("/api/valuation/teroxx"),
    refetchInterval: 600_000,
    staleTime: 300_000,
  });

  const { data: positions } = useQuery<PositionsResponse | PositionRow[]>({
    queryKey: ["positions-for-teroxx", engine.id],
    queryFn: () => client.get("/api/positions"),
    refetchInterval: 120_000,
    staleTime: 30_000,
  });

  if (!teroxx?.tickers) return null;

  const posList: PositionRow[] = Array.isArray(positions)
    ? positions
    : (positions as PositionsResponse)?.positions ?? [];
  const longSyms = new Set(
    posList.filter((p) => p.side === "LONG").map((p) => p.symbol)
  );
  const shortSyms = new Set(
    posList.filter((p) => p.side === "SHORT").map((p) => p.symbol)
  );

  // Annotate each Teroxx ticker with our position direction.
  const rows = teroxx.tickers
    .filter((t) => t.return_pwpt != null || t.verdict === "RESERVE")
    .map((t) => ({
      ...t,
      side:
        longSyms.has(t.symbol) ? "LONG" :
          shortSyms.has(t.symbol) ? "SHORT" : null,
    }));

  // Sort: members of the highlighted side first, then the other side,
  // then unowned. Within each, descending by PWPT return for longs and
  // ascending (most negative) for shorts. Default: longs by PWPT.
  const rankSide = (s: string | null): number => {
    if (highlight === "short") return s === "SHORT" ? 2 : s === "LONG" ? 1 : 0;
    if (highlight === "long") return s === "LONG" ? 2 : s === "SHORT" ? 1 : 0;
    return s === "LONG" || s === "SHORT" ? 1 : 0;
  };
  rows.sort((a, b) => {
    const dr = rankSide(b.side) - rankSide(a.side);
    if (dr !== 0) return dr;
    if (highlight === "short") {
      return (a.return_pwpt ?? 999) - (b.return_pwpt ?? 999);
    }
    return (b.return_pwpt ?? -999) - (a.return_pwpt ?? -999);
  });

  // Disagreement detection (both sides).
  const conflictsLong = rows.filter(
    (r) =>
      r.side === "LONG" &&
      (r.verdict === "UNDERWEIGHT" ||
        (r.return_pwpt != null && r.return_pwpt < -0.3))
  );
  const conflictsShort = rows.filter(
    (r) =>
      r.side === "SHORT" &&
      (r.verdict === "OVERWEIGHT" ||
        (r.return_pwpt != null && r.return_pwpt > 0.3))
  );
  const missedShorts = rows.filter(
    (r) => r.verdict === "UNDERWEIGHT" && r.side !== "SHORT"
  );
  const missedLongs = rows.filter(
    (r) => r.verdict === "OVERWEIGHT" && r.side !== "LONG"
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Discretionary Valuation · screening only</span>
          <span className="text-[10px] font-normal text-gray-500">
            Does NOT feed the model — used for promotion / re-rate decisions only
          </span>
        </CardTitle>
      </CardHeader>
      <div className="px-4 pb-4 space-y-3">
        <div className="text-[10px] text-gray-500">
          Snapshot: {teroxx.extracted_at.slice(0, 10)} · {teroxx.methodology}
        </div>

        {/* Conflicts banners */}
        {conflictsLong.length > 0 && (
          <div className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded p-2">
            ⚠ <strong>Long positions rated rich by discretionary valuation</strong> (UW or PWPT &lt; −30%):{" "}
            {conflictsLong
              .map(
                (r) =>
                  `${r.symbol.replace("USDT", "")} (${r.verdict}, ${
                    r.return_pwpt != null ? (r.return_pwpt * 100).toFixed(0) + "%" : "—"
                  })`
              )
              .join(", ")}
            . Interrogate the quant model's positive read.
          </div>
        )}
        {conflictsShort.length > 0 && (
          <div className="text-[11px] text-rose-300 bg-rose-900/20 border border-rose-800/40 rounded p-2">
            ⚠ <strong>Short positions rated cheap by discretionary valuation</strong> (OW or PWPT &gt; +30%):{" "}
            {conflictsShort
              .map(
                (r) =>
                  `${r.symbol.replace("USDT", "")} (${r.verdict}, ${
                    r.return_pwpt != null ? (r.return_pwpt * 100).toFixed(0) + "%" : "—"
                  })`
              )
              .join(", ")}
            . Risk of being short a structurally undervalued name.
          </div>
        )}
        {missedShorts.length > 0 && (
          <div className="text-[11px] text-rose-200/80 bg-gray-900/30 border border-gray-800 rounded p-2">
            📉 <strong>UW names not in short book</strong>:{" "}
            {missedShorts.map((r) => r.symbol.replace("USDT", "")).join(", ")}
            . Candidate shorts if quant model agrees.
          </div>
        )}
        {missedLongs.length > 0 && (
          <div className="text-[11px] text-emerald-200/80 bg-gray-900/30 border border-gray-800 rounded p-2">
            📈 <strong>OW names not in long basket</strong>:{" "}
            {missedLongs.map((r) => r.symbol.replace("USDT", "")).join(", ")}
            . Candidate longs if quant model agrees.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 border-b border-gray-800">
              <tr>
                <th className="text-left py-1.5 pr-3">Symbol</th>
                <th className="text-left pr-3">Sector</th>
                <th className="text-center pr-3">Verdict</th>
                <th className="text-right pr-3">Spot</th>
                <th className="text-right pr-3">PWPT</th>
                <th className="text-right pr-3">Bear / Base / Bull</th>
                <th className="text-right pr-3">Implied 12m</th>
                <th className="text-center pr-3">Position</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.symbol}
                  className={`border-b border-gray-900 ${
                    r.side === "LONG"
                      ? "bg-emerald-900/10"
                      : r.side === "SHORT"
                        ? "bg-rose-900/10"
                        : ""
                  }`}
                >
                  <td className="py-1.5 pr-3 font-mono">{r.symbol.replace("USDT", "")}</td>
                  <td className="pr-3 text-gray-400">{r.sector ?? "—"}</td>
                  <td className="pr-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${verdictColor(r.verdict)}`}>
                      {r.verdict.slice(0, 3)}
                    </span>
                  </td>
                  <td className="pr-3 text-right text-gray-400 font-mono">
                    {fmtPrice(r.spot_usd)}
                  </td>
                  <td className={`pr-3 text-right font-mono ${returnColor(r.return_pwpt)}`}>
                    {fmtPrice(r.pwpt_usd)}
                  </td>
                  <td className="pr-3 text-right text-[10px] text-gray-500 font-mono">
                    {r.return_bear != null && r.return_base != null && r.return_bull != null
                      ? `${(r.return_bear * 100).toFixed(0)}% / ${(r.return_base * 100).toFixed(0)}% / ${(r.return_bull * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className={`pr-3 text-right font-mono font-semibold ${returnColor(r.return_pwpt)}`}>
                    {r.return_pwpt != null
                      ? `${r.return_pwpt >= 0 ? "+" : ""}${(r.return_pwpt * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="pr-3 text-center">
                    {r.side === "LONG" ? (
                      <Badge variant="success">long</Badge>
                    ) : r.side === "SHORT" ? (
                      <Badge variant="danger">short</Badge>
                    ) : (
                      <span className="text-gray-700 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
