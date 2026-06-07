import { useFundingCarryShadow, type CarryShadowPair } from "../../../hooks/useFundingCarryShadow";
import { Card } from "../../ui/Card";
import { fmtUsd, pctColor } from "./format";

const sym = (s: string) => s.replace("USDT", "");

const annCell = (v: number | null) =>
  v == null ? <span className="text-gray-600">—</span> : (
    <span className={`font-mono ${pctColor(v)}`}>{v >= 0 ? "+" : ""}{v.toFixed(0)}%</span>
  );

const usdCell = (v: number) => (
  <span className={`font-mono ${pctColor(v)}`}>
    {v >= 0 ? "+" : "−"}{fmtUsd(Math.abs(v), 0).replace("$", "$")}
  </span>
);

export function CarryShadowSubTab() {
  const { data, isLoading } = useFundingCarryShadow();
  const pairs: CarryShadowPair[] = data?.pairs ?? [];

  const book = pairs.reduce(
    (a, p) => ({
      carry: a.carry + (p.carry_usd ?? 0),
      drift: a.drift + (p.drift_usd ?? 0),
      total: a.total + (p.total_usd ?? 0),
    }),
    { carry: 0, drift: 0, total: 0 },
  );

  return (
    <div className="space-y-3">
      {/* PAPER banner — unmissable */}
      <div className="flex items-center gap-2 rounded-md border border-amber-500/60 bg-amber-950/40 px-3 py-2">
        <span className="inline-flex items-center rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
          Paper · Shadow
        </span>
        <span className="text-[11px] text-amber-200">
          Simulated positions only. No orders are placed and this does not touch the live book or NAV.
          Tracks whether realized funding carry survives the price/hedge drift before any capital.
        </span>
      </div>

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Funding-carry shadow</h3>
            <p className="text-[11px] text-gray-500">
              Short the high-funding leg (collect funding), long a correlated leg (hedge). Perp-perp RV —
              these do not cointegrate, so drift can swamp carry. Paper notional{" "}
              {fmtUsd(data?.notional_per_short ?? 10000, 0)}/short leg.
            </p>
          </div>
          {data?.computed_at && (
            <span className="text-[10px] text-gray-600">
              updated {new Date(data.computed_at).toLocaleString()}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-xs text-gray-500">Loading…</div>
        ) : pairs.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-500">
            No paper positions yet. They open on the next shadow tick (hourly), or force one via{" "}
            <code className="text-gray-400">POST /api/admin/refresh-funding-carry-shadow</code>.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-[var(--border)]">
                    <th className="py-1.5 pr-2">Pair (S / L)</th>
                    <th className="py-1.5 px-2 text-right">Held</th>
                    <th className="py-1.5 px-2 text-right">β</th>
                    <th className="py-1.5 px-2 text-right">Modeled</th>
                    <th className="py-1.5 px-2 text-right">Carry</th>
                    <th className="py-1.5 px-2 text-right">Drift</th>
                    <th className="py-1.5 px-2 text-right">Net</th>
                    <th className="py-1.5 px-2 text-right">P&amp;L ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => (
                    <tr key={`${p.short}/${p.long}`} className="border-b border-[var(--border)]/50">
                      <td className="py-1.5 pr-2">
                        <span className="font-medium text-gray-200">
                          <span className="text-rose-300">S {sym(p.short)}</span>
                          {" / "}
                          <span className="text-emerald-300">L {sym(p.long)}</span>
                        </span>
                        {p.label && <div className="text-[10px] text-gray-600">{p.label}</div>}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-400">
                        {p.days_held.toFixed(0)}d
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-400">
                        {p.beta.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right">{annCell(p.modeled_spread_ann_pct)}</td>
                      <td className="py-1.5 px-2 text-right">{annCell(p.carry_ann_pct)}</td>
                      <td className="py-1.5 px-2 text-right">{annCell(p.drift_ann_pct)}</td>
                      <td className="py-1.5 px-2 text-right font-semibold">{annCell(p.total_ann_pct)}</td>
                      <td className="py-1.5 px-2 text-right">
                        <span title={`carry ${fmtUsd(p.carry_usd, 0)} + drift ${fmtUsd(p.drift_usd, 0)}`}>
                          {usdCell(p.total_usd)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border)] text-gray-300">
                    <td className="py-1.5 pr-2 font-semibold" colSpan={4}>
                      Book ({pairs.length} paper pairs)
                    </td>
                    <td className="py-1.5 px-2 text-right">{usdCell(book.carry)}</td>
                    <td className="py-1.5 px-2 text-right">{usdCell(book.drift)}</td>
                    <td className="py-1.5 px-2 text-right" />
                    <td className="py-1.5 px-2 text-right font-semibold">{usdCell(book.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-gray-600">
              Modeled = forward net funding spread at inception. Carry = funding banked since inception
              (short collects, long pays), annualized. Drift = β-hedged price move (the hedge residual).
              Net = carry + drift. The $ column is the honest read; annualized % over a short window can
              look extreme.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
