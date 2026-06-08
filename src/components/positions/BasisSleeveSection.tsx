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
  days_held?: number;
  net_carry_accrued_usd?: number;
}

interface BasisSleeveResponse {
  enabled: boolean;
  pairs: BasisPair[];
  summary: {
    n_pairs?: number;
    gross_usd?: number;
    net_delta_usd?: number;
    accrued_funding_usd?: number;
    usdt_borrow_accrued_usd?: number;
    net_carry_accrued_usd?: number;
    usdt_borrow_actual?: boolean;
    days_held?: number;
    nav?: number;
    net_carry_ann_usd?: number;
    // Forward (current funding tick) run-rate.
    net_carry_daily_usd?: number;
    net_carry_daily_pct_nav?: number;
    net_carry_daily_pct_gross?: number;
    net_carry_ann_pct_nav?: number;
    net_carry_ann_pct_gross?: number;
    // Realized run-rate (trailing accrued / days held).
    net_carry_realized_daily_usd?: number;
    net_carry_realized_daily_pct_nav?: number;
    net_carry_realized_daily_pct_gross?: number;
    net_carry_realized_ann_pct_nav?: number;
    net_carry_realized_ann_pct_gross?: number;
    // Cumulative earned since open.
    net_carry_return_pct_nav?: number;
    net_carry_return_pct_gross?: number;
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
  const { data: alloc } = useQuery<{
    available?: boolean; fire?: boolean; reason?: string; auto_execute?: boolean;
    sustained_carry?: Record<string, number>; deltas?: Record<string, number>;
  }>({
    queryKey: ["basis-sleeve-allocator", engine.id],
    queryFn: () => client.get("/api/basis-sleeve-allocator"),
    refetchInterval: 60_000,
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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-3">
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
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]" title="Gross funding received (before USDT borrow cost)">
          <div className="text-[10px] text-gray-500 uppercase">Funding Gross</div>
          <div className={`text-lg font-mono font-semibold ${tone(s.accrued_funding_usd ?? 0)}`}>
            {(s.accrued_funding_usd ?? 0) >= 0 ? "+" : ""}${(s.accrued_funding_usd ?? 0).toFixed(2)}
          </div>
        </div>
        <div
          className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]"
          title={`Net carry = funding received minus USDT borrow paid${
            s.usdt_borrow_actual ? " (actual ledger interest)" : " (modeled borrow)"
          }`}
        >
          <div className="text-[10px] text-gray-500 uppercase">Net Carry</div>
          <div className={`text-lg font-mono font-semibold ${tone(s.net_carry_accrued_usd ?? 0)}`}>
            {(s.net_carry_accrued_usd ?? 0) >= 0 ? "+" : ""}${(s.net_carry_accrued_usd ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-gray-400 mb-3 flex flex-wrap gap-x-4 gap-y-1">
        <span title="Trade age (longest-held pair)">
          Held: <span className="font-mono text-gray-300">{(s.days_held ?? 0).toFixed(1)}d</span>
        </span>
        <span title="Net carry actually earned since the positions opened, as a % of NAV and of sleeve gross">
          Earned so far:{" "}
          <span className={`font-mono ${tone(s.net_carry_return_pct_nav ?? 0)}`}>
            {(s.net_carry_return_pct_nav ?? 0) >= 0 ? "+" : ""}{(s.net_carry_return_pct_nav ?? 0).toFixed(3)}% of NAV
          </span>
          {" · "}
          <span className={`font-mono ${tone(s.net_carry_return_pct_gross ?? 0)}`}>
            {(s.net_carry_return_pct_gross ?? 0) >= 0 ? "+" : ""}{(s.net_carry_return_pct_gross ?? 0).toFixed(3)}% of gross
          </span>
        </span>
      </div>

      {/* Daily net carry — two views. REALIZED = trailing accrued/days actually
          banked. FORWARD = projection of the current funding tick (spike-prone,
          mean-reverts), so forward > realized when funding is elevated. */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 uppercase mb-1">Daily net carry — two views</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase border-b border-[var(--border)]">
                <th className="text-left py-1 px-2">Metric</th>
                <th className="text-right py-1 px-2" title="Trailing: net carry actually banked (accrued ÷ days held). The honest run-rate.">
                  Realized (trailing)
                </th>
                <th className="text-right py-1 px-2" title="Projection of the CURRENT funding tick. Spike-prone — funding mean-reverts, so this overstates a sustainable rate.">
                  Forward (current tick)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]/40">
                <td className="py-1 px-2 text-gray-400">Net carry $/day</td>
                <td className={`py-1 px-2 text-right font-mono ${tone(s.net_carry_realized_daily_usd ?? 0)}`}>
                  {(s.net_carry_realized_daily_usd ?? 0) >= 0 ? "+" : ""}${(s.net_carry_realized_daily_usd ?? 0).toFixed(2)}
                </td>
                <td className={`py-1 px-2 text-right font-mono ${tone(s.net_carry_daily_usd ?? 0)}`}>
                  {(s.net_carry_daily_usd ?? 0) >= 0 ? "+" : ""}${(s.net_carry_daily_usd ?? 0).toFixed(2)}
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]/40">
                <td className="py-1 px-2 text-gray-400">% of NAV / day</td>
                <td className={`py-1 px-2 text-right font-mono ${tone(s.net_carry_realized_daily_pct_nav ?? 0)}`}>
                  {(s.net_carry_realized_daily_pct_nav ?? 0) >= 0 ? "+" : ""}{(s.net_carry_realized_daily_pct_nav ?? 0).toFixed(3)}%
                </td>
                <td className={`py-1 px-2 text-right font-mono ${tone(s.net_carry_daily_pct_nav ?? 0)}`}>
                  {(s.net_carry_daily_pct_nav ?? 0) >= 0 ? "+" : ""}{(s.net_carry_daily_pct_nav ?? 0).toFixed(3)}%
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]/40">
                <td className="py-1 px-2 text-gray-400">% of gross / day</td>
                <td className={`py-1 px-2 text-right font-mono ${tone(s.net_carry_realized_daily_pct_gross ?? 0)}`}>
                  {(s.net_carry_realized_daily_pct_gross ?? 0) >= 0 ? "+" : ""}{(s.net_carry_realized_daily_pct_gross ?? 0).toFixed(3)}%
                </td>
                <td className={`py-1 px-2 text-right font-mono ${tone(s.net_carry_daily_pct_gross ?? 0)}`}>
                  {(s.net_carry_daily_pct_gross ?? 0) >= 0 ? "+" : ""}{(s.net_carry_daily_pct_gross ?? 0).toFixed(3)}%
                </td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-gray-400">Annualized (NAV)</td>
                <td className={`py-1 px-2 text-right font-mono ${tone(s.net_carry_realized_ann_pct_nav ?? 0)}`}>
                  {(s.net_carry_realized_ann_pct_nav ?? 0) >= 0 ? "+" : ""}{(s.net_carry_realized_ann_pct_nav ?? 0).toFixed(2)}%/yr
                </td>
                <td className={`py-1 px-2 text-right font-mono ${tone(s.net_carry_ann_pct_nav ?? 0)}`}>
                  {(s.net_carry_ann_pct_nav ?? 0) >= 0 ? "+" : ""}{(s.net_carry_ann_pct_nav ?? 0).toFixed(2)}%/yr
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-gray-600 mt-1">
          Forward projects the current funding tick (spike-prone); realized is what's actually banked. Trust realized.
        </div>
      </div>

      {alloc?.available !== false && alloc?.sustained_carry && (
        <div className="text-[10px] text-gray-500 mb-3 flex flex-wrap gap-x-3 gap-y-1 items-center">
          <span className="uppercase">Allocator{alloc.auto_execute ? "" : " (shadow)"}:</span>
          <span className={alloc.fire ? "text-amber-400 font-mono" : "text-gray-400 font-mono"}>
            {alloc.fire ? "REWEIGHT" : "hold"}
          </span>
          {alloc.sustained_carry && (
            <span className="font-mono text-gray-400">
              7d carry: {Object.entries(alloc.sustained_carry).map(([k, v]) => `${k.replace("USDT", "")} ${v >= 0 ? "+" : ""}${v.toFixed(0)}%`).join(" · ")}
            </span>
          )}
          <span className="text-gray-600">{alloc.reason}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase border-b border-[var(--border)]">
              <th className="text-left py-1.5 px-2">Pair</th>
              <th className="text-right py-1.5 px-2">Days</th>
              <th className="text-right py-1.5 px-2" title="7d trailing realized net carry (durable signal the allocator weights on)">7d carry (durable)</th>
              <th className="text-right py-1.5 px-2" title="Live funding tick, annualized — spike-prone, NOT the basis for reallocation">Funding now (tick)</th>
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
                <td className="py-1.5 px-2 text-right font-mono text-gray-400">
                  {(p.days_held ?? 0).toFixed(1)}d
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-emerald-400 font-semibold">
                  {alloc?.sustained_carry?.[p.symbol] == null ? "—" : `${alloc.sustained_carry[p.symbol] >= 0 ? "+" : ""}${alloc.sustained_carry[p.symbol].toFixed(0)}%`}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-gray-500" title="Live tick — spike-prone, not the reallocation signal">
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
