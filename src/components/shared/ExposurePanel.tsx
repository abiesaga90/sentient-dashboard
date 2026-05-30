import { Card, CardHeader, CardTitle } from "../ui/Card";
import { formatUSD } from "../../lib/utils";
import type { BetaAggregate, RiskData, Position } from "../../types/api";

interface ExposurePanelProps {
  positions: Position[];
  beta: BetaAggregate;
  risk?: RiskData | null;
}

type View = "gross" | "notional" | "nav";

const VIEW_LABELS: Record<View, string> = {
  gross: "STRATEGY VIEW",
  notional: "NICKEL VIEW",
  nav: "EQUITY VIEW",
};

const VIEW_SUBTITLES: Record<View, string> = {
  gross: "Net / Gross — hedge quality (denominator-free)",
  notional: "Net / Notional — matches NT /v1/risk; mandate caps",
  nav: "Net / NAV — real P&L sensitivity on equity",
};

// Compact column showing the three Net/Net-Beta % views with denominator label.
// The Nickel column (notional) gets the highlighted treatment so it's
// unambiguous which numbers map 1:1 to Nickel's own reporting.
export function ExposurePanel({ positions, beta, risk }: ExposurePanelProps) {
  const longNotional = positions
    .filter((p) => p.side === "LONG")
    .reduce((a, p) => a + p.notional, 0);
  const shortNotional = positions
    .filter((p) => p.side === "SHORT")
    .reduce((a, p) => a + p.notional, 0);
  const grossUsd = longNotional + shortNotional;
  const netUsd = longNotional - shortNotional;
  const netBetaUsd = beta.net_beta_usd;

  // Notional capital: derive from /api/risk (gross_$ / gross_pct * 100) when
  // available, else use the beta block's denom_notional, else fall back to 100k.
  const notionalCapital = (() => {
    if (beta.denom_notional && beta.denom_notional > 0) return beta.denom_notional;
    if (risk && risk.gross_pct > 0) return (grossUsd / risk.gross_pct) * 100;
    return 100_000;
  })();
  const navUsd = risk?.nav && risk.nav > 0 ? risk.nav : beta.denom_nav ?? null;

  // Three denominators for net + net-beta (recompute client-side as fallback)
  const pct = (num: number, den: number | null | undefined) =>
    den && den > 0 ? (num / den) * 100 : 0;

  const netPctGross = risk?.net_pct_gross ?? pct(netUsd, grossUsd);
  const netPctNotional = risk?.net_pct_notional ?? risk?.net_pct ?? pct(netUsd, notionalCapital);
  const netPctNav = risk?.net_pct_nav ?? pct(netUsd, navUsd);

  const netBetaPctGross = beta.net_beta_pct_gross ?? pct(netBetaUsd, grossUsd);
  const netBetaPctNotional =
    beta.net_beta_pct_notional ?? risk?.net_beta_pct_notional ?? pct(netBetaUsd, notionalCapital);
  const netBetaPctNav = beta.net_beta_pct_nav ?? pct(netBetaUsd, navUsd);

  const grossPctNotional = risk?.gross_pct_notional ?? risk?.gross_pct ?? pct(grossUsd, notionalCapital);
  const grossPctNav = risk?.gross_pct_nav ?? pct(grossUsd, navUsd);

  const leverageNotional = grossUsd / notionalCapital;
  const leverageNav = navUsd ? grossUsd / navUsd : null;

  const targetBetaPct = risk?.target_beta_tilt_pct;
  const grossCapPct = risk?.limits?.max_leverage_pct ?? 200;
  const netCapPct = risk?.limits?.max_net_pct ?? 30;

  const denoms: Record<View, { value: number | null; label: string }> = {
    gross: { value: grossUsd, label: "current gross" },
    notional: { value: notionalCapital, label: "notional capital" },
    nav: { value: navUsd, label: "live equity" },
  };

  const tone = (v: number, hot: number, warn: number) =>
    Math.abs(v) < hot ? "text-green-400" : Math.abs(v) < warn ? "text-yellow-400" : "text-red-400";

  const ViewHeader = ({ view }: { view: View }) => {
    const isNickel = view === "notional";
    return (
      <div
        className={
          "text-center px-2 py-1.5 rounded-t border-b " +
          (isNickel
            ? "bg-[#bfb3a8]/10 border-[#bfb3a8]/40"
            : "bg-[var(--bg-secondary)] border-[var(--border)]")
        }
      >
        <div
          className={
            "inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide " +
            (isNickel
              ? "bg-[#0b688c] text-white"
              : "bg-[var(--bg-tertiary)] text-gray-400 border border-[var(--border)]")
          }
        >
          {VIEW_LABELS[view]}
        </div>
        <div className="text-[10px] text-gray-500 mt-1 leading-tight">
          {VIEW_SUBTITLES[view]}
        </div>
        <div className="text-[9px] text-gray-600 mt-0.5">
          denom: {denoms[view].value != null ? formatUSD(denoms[view].value!) : "—"}{" "}
          <span className="text-gray-700">({denoms[view].label})</span>
        </div>
      </div>
    );
  };

  const Cell = ({
    label,
    primary,
    secondary,
    accent,
    nickel,
  }: {
    label: string;
    primary: string;
    secondary?: string;
    accent?: string;
    nickel?: boolean;
  }) => (
    <div
      className={
        "px-2 py-2 text-center " +
        (nickel ? "bg-[#bfb3a8]/[0.07]" : "bg-[var(--bg-secondary)]") +
        " border-x border-b border-[var(--border)]"
      }
    >
      <div className="text-[9px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-base font-mono font-semibold ${accent || "text-gray-200"}`}>
        {primary}
      </div>
      {secondary && <div className="text-[9px] text-gray-600 mt-0.5">{secondary}</div>}
    </div>
  );

  const signed = (v: number, suffix = "%") =>
    `${v >= 0 ? "+" : ""}${v.toFixed(2)}${suffix}`;
  const signedUSD = (v: number) => `${v >= 0 ? "+" : ""}${formatUSD(v)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exposure &amp; Beta Hedging</CardTitle>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Long ${formatUSD(longNotional)} · Short ${formatUSD(shortNotional)} · Gross ${formatUSD(grossUsd)} · Net{" "}
          {signedUSD(netUsd)}
          {navUsd != null && (
            <>
              {" "}· NAV ${(navUsd / 1000).toFixed(1)}k · Lev (Notional) {leverageNotional.toFixed(2)}x
              {leverageNav != null && <> · Lev (NAV) {leverageNav.toFixed(2)}x</>}
            </>
          )}
        </div>
      </CardHeader>

      {/* Three-denominator grid: Gross | Notional (Nickel) | NAV */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {(["gross", "notional", "nav"] as View[]).map((view) => {
          const isNickel = view === "notional";
          let netPct: number;
          let netBetaPct: number;
          let grossPct: number | null;
          if (view === "gross") {
            netPct = netPctGross;
            netBetaPct = netBetaPctGross;
            grossPct = null;
          } else if (view === "notional") {
            netPct = netPctNotional;
            netBetaPct = netBetaPctNotional;
            grossPct = grossPctNotional;
          } else {
            netPct = netPctNav;
            netBetaPct = netBetaPctNav;
            grossPct = grossPctNav;
          }
          return (
            <div key={view} className="flex flex-col">
              <ViewHeader view={view} />
              <Cell
                label="Net $"
                primary={signedUSD(netUsd)}
                accent={tone(netUsd, 500, 2000)}
                nickel={isNickel}
              />
              <Cell
                label="Net %"
                primary={signed(netPct)}
                accent={tone(netPct, 5, 15)}
                secondary={isNickel ? `cap ±${netCapPct}%` : undefined}
                nickel={isNickel}
              />
              <Cell
                label="Net β $"
                primary={signedUSD(netBetaUsd)}
                accent={tone(netBetaUsd, 500, 2000)}
                nickel={isNickel}
              />
              <Cell
                label="Net β %"
                primary={signed(netBetaPct)}
                accent={tone(netBetaPct, 5, 15)}
                secondary={
                  isNickel
                    ? targetBetaPct != null
                      ? `target ${signed(targetBetaPct)}`
                      : undefined
                    : undefined
                }
                nickel={isNickel}
              />
              {grossPct != null ? (
                <Cell
                  label="Gross %"
                  primary={`${grossPct.toFixed(2)}%`}
                  secondary={isNickel ? `cap ${grossCapPct}%` : undefined}
                  nickel={isNickel}
                />
              ) : (
                <div
                  className={
                    "px-2 py-2 text-center text-[10px] text-gray-600 " +
                    "bg-[var(--bg-secondary)] border-x border-b border-[var(--border)] rounded-b"
                  }
                >
                  gross / gross = 100%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Basket beta summary (single row, view-independent) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-3">
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Long Basket β</div>
          <div className="text-base font-mono font-semibold text-green-400">
            {beta.long_basket_beta?.toFixed(3) ?? "—"}
          </div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Short Basket β</div>
          <div className="text-base font-mono font-semibold text-red-400">
            {beta.short_basket_beta?.toFixed(3) ?? "—"}
          </div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Beta Ratio</div>
          <div className="text-base font-mono font-semibold text-gray-200">
            {beta.beta_ratio?.toFixed(3) ?? "—"}
          </div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase">Short Avg Corr</div>
          <div className="text-base font-mono font-semibold text-gray-200">
            {beta.short_basket_avg_corr?.toFixed(3) ?? "—"}
          </div>
        </div>
      </div>

      {/* β-net decomposition: crypto basket + tokenized sleeve = total.
          The engine sizes the crypto basket aiming for (target_tilt − tokenized_net_β)
          so the WHOLE portfolio β-net hits the operator's tilt target. This row
          shows both legs separately so the operator can see what each contributes. */}
      {(beta.crypto_net_beta_pct_notional != null ||
        beta.tokenized_net_beta_pct_notional_approx != null) && (
        <div className="mt-3 p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 uppercase mb-2 flex items-center gap-2">
            β-net decomposition
            <span
              className="text-[9px] text-gray-600 normal-case"
              title="Whole-portfolio β-net is the SUM of crypto basket and tokenized sleeve. Crypto basket targets are auto-adjusted so the total lands at the operator's tilt target. Tokenized sleeve uses β≈1.0 approximation."
            >
              (sum = total β-net)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 bg-[var(--bg-primary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Crypto basket β</div>
              <div className="text-base font-mono font-semibold text-gray-200">
                {beta.crypto_net_beta_pct_notional != null
                  ? `${beta.crypto_net_beta_pct_notional >= 0 ? "+" : ""}${beta.crypto_net_beta_pct_notional.toFixed(2)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                ${beta.crypto_net_beta_usd?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"}
              </div>
            </div>
            <div className="text-center p-2 bg-[var(--bg-primary)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-gray-500 uppercase">Tokenized β (approx)</div>
              <div className="text-base font-mono font-semibold text-gray-200">
                {beta.tokenized_net_beta_pct_notional_approx != null
                  ? `${beta.tokenized_net_beta_pct_notional_approx >= 0 ? "+" : ""}${beta.tokenized_net_beta_pct_notional_approx.toFixed(2)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                ${beta.tokenized_net_beta_usd_approx?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"}
              </div>
            </div>
            <div className="text-center p-2 bg-[var(--bg-primary)] rounded border-2 border-[#0b688c]">
              <div className="text-[10px] text-[#0b688c] uppercase font-semibold">Total portfolio β</div>
              <div className="text-base font-mono font-semibold text-gray-100">
                {beta.net_beta_pct_notional != null
                  ? `${beta.net_beta_pct_notional >= 0 ? "+" : ""}${beta.net_beta_pct_notional.toFixed(2)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                ${beta.net_beta_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-gray-600 leading-snug">
            The operator tilt target (e.g. +6.20%) is for the WHOLE portfolio. The engine
            sizes the crypto basket to leave headroom for the tokenized sleeve's
            contribution — both add up to the total. Tokenized β uses dollar-net as a
            β≈1.0 approximation (tokenized perps are stocks/ETFs with broad-market β
            around 1).
          </div>
        </div>
      )}

      <div className="mt-2 text-[10px] text-gray-600 leading-snug">
        <span className="text-[#0b688c] font-semibold">Nickel View</span> matches NT{" "}
        <code>/v1/risk</code> — same denominator the mandate caps are enforced against
        (gross {grossCapPct}%, |net| {netCapPct}%). <span className="text-gray-500">Strategy</span> view
        (Net/Gross) is the truest read of hedge quality: invariant to leverage, useful for asking
        "are we still beta-neutral in shape?". <span className="text-gray-500">Equity</span> view
        (Net/NAV) tells you the live P&amp;L sensitivity to a market move; distorts during drawdowns as
        NAV shrinks.
      </div>
    </Card>
  );
}
