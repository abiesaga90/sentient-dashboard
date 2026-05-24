import type { SaaPosition } from "../../../hooks/useTokenizedAssets";
import { fmtUsd } from "./format";

interface SaaBadgeProps {
  position?: SaaPosition;
}

export function SaaBadge({ position }: SaaBadgeProps) {
  if (!position) {
    return <span className="text-gray-600 text-xs">—</span>;
  }
  const isPut = position.type === "put";
  const tone = isPut
    ? "bg-red-900/40 text-red-300 border-red-800/50"
    : "bg-emerald-900/40 text-emerald-300 border-emerald-800/50";
  const label = isPut ? "P" : position.type === "call" ? "C" : "L";

  return (
    <a
      href={position.filing_url}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${tone} hover:opacity-90`}
      title={`${position.ticker} · ${position.type} · ${fmtUsd(position.value_usd)} · ${position.pct_of_aum.toFixed(2)}% AUM · filed ${position.filing_period ?? ""}`}
    >
      <span className="font-mono">{label}</span>
      <span>{fmtUsd(position.value_usd)}</span>
      <span className="text-[10px] opacity-70">{position.pct_of_aum.toFixed(1)}%</span>
      {position.put_value_usd && position.type === "long" && (
        <span className="text-[10px] text-red-300/80" title={`also holds put ${fmtUsd(position.put_value_usd)}`}>
          +P
        </span>
      )}
    </a>
  );
}
