import { useQuery } from "@tanstack/react-query";
import { useEngine } from "../../hooks/useEngine";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface BasisPair {
  symbol: string;
  base: string;
  perp_qty: number;
  perp_notional: number;
  mark: number;
  perp_unrealized_pnl: number;
  spot_units: number;
  spot_usd: number;
  net_units: number;
  net_delta_usd: number;
  gross_usd: number;
  funding_rate_ann_pct: number | null;
  accrued_funding_usd: number;
  entry_time: string | null;
  delta_neutral: boolean;
}

interface BasisSleeveResponse {
  enabled: boolean;
  pairs: BasisPair[];
  summary: {
    n_pairs?: number;
    gross_usd?: number;
    net_delta_usd?: number;
    accrued_funding_usd?: number;
  };
}

const tone = (v: number) =>
  Math.abs(v) < 0.01 ? "text-gray-300" : v > 0 ? "text-green-400" : "text-red-400";

/**
 * Funding-carry basis sleeve. Each pair is a SHORT perp + LONG spot held
 * delta-neutral to harvest positive funding. Tracked separately from the core
 * book (these symbols are excluded from the engine's exposure). Renders nothing
 * when the sleeve is off (no BASIS_SLEEVE_SYMBOLS configured).
 */
export function BasisSleeveSection() {
  const { client, engine } = useEngine();
  const { data } = useQuery<BasisSleeveResponse>({
    queryKey: ["basis-sleeve", engine.id],
    queryFn: () => client.get("/api/basis-sleeve"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (!data?.enabled || !data.pairs?.length) return null;
  const s = data.summary ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Basis Sleeve <span className="text-[10px] text-gray-500">(funding carry · delta-neutral)</span>
        </CardTitle>
      </CardHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Pairs</div>
          <div className="text-lg font-mono font-semibold text-gray-200">{s.n_pairs ?? 0}</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Gross</div>
          <div className="text-lg font-mono font-semibold text-gray-200">${(s.gross_usd ?? 0).toFixed(0)}</div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Net Delta</div>
          <div className={`text-lg font-mono font-semibold ${tone(s.net_delta_usd ?? 0)}`}>
            {(s.net_delta_usd ?? 0) >= 0 ? "+" : ""}${(s.net_delta_usd ?? 0).toFixed(0)}
          </div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Accrued Funding</div>
          <div className={`text-lg font-mono font-semibold ${tone(s.accrued_funding_usd ?? 0)}`}>
            {(s.accrued_funding_usd ?? 0) >= 0 ? "+" : ""}${(s.accrued_funding_usd ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase border-b border-[var(--border)]">
              <th className="text-left py-1.5 px-2">Pair</th>
              <th className="text-right py-1.5 px-2">Funding %ann</th>
              <th className="text-right py-1.5 px-2">Perp short</th>
              <th className="text-right py-1.5 px-2">Spot long</th>
              <th className="text-right py-1.5 px-2">Net delta</th>
              <th className="text-right py-1.5 px-2">Funding received</th>
              <th className="text-right py-1.5 px-2">USDT borrow paid</th>
              <th className="text-right py-1.5 px-2">Net carry</th>
              <th className="text-center py-1.5 px-2">State</th>
            </tr>
          </thead>
          <tbody>
            {data.pairs.map((p) => (
              <tr key={p.symbol} className="border-b border-[var(--border)]/40">
                <td className="py-1.5 px-2 font-medium text-gray-200">{p.base}</td>
                <td className="py-1.5 px-2 text-right font-mono text-emerald-400">
                  {p.funding_rate_ann_pct == null ? "—" : `${p.funding_rate_ann_pct.toFixed(1)}%`}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-gray-300">
                  ${Math.abs(p.perp_notional).toFixed(0)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-gray-300">
                  ${p.spot_usd.toFixed(0)}
                </td>
                <td className={`py-1.5 px-2 text-right font-mono ${tone(p.net_delta_usd)}`}>
                  {p.net_delta_usd >= 0 ? "+" : ""}${p.net_delta_usd.toFixed(0)}
                </td>
                <td className={`py-1.5 px-2 text-right font-mono ${tone(p.accrued_funding_usd)}`}>
                  {p.accrued_funding_usd >= 0 ? "+" : ""}${p.accrued_funding_usd.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-red-400" title="Estimated USDT borrow interest paid since the position opened">
                  -${((p as any).usdt_borrow_accrued_usd ?? 0).toFixed(2)}
                </td>
                <td className={`py-1.5 px-2 text-right font-mono ${tone((p as any).net_carry_accrued_usd ?? 0)}`} title="Funding received minus USDT borrow paid, since open">
                  {((p as any).net_carry_accrued_usd ?? 0) >= 0 ? "+" : ""}${((p as any).net_carry_accrued_usd ?? 0).toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-center">
                  <Badge variant={p.delta_neutral ? "success" : "warning"} className="text-[10px]">
                    {p.delta_neutral ? "neutral" : "delta gap"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
