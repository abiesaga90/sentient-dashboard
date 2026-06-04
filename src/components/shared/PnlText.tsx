import { cn } from "../../lib/utils";
import { pnlColor } from "../../lib/utils";

interface PnlTextProps {
  value: number | null | undefined;
  format?: "usd" | "pct";
  className?: string;
  title?: string;
}

export function PnlText({ value, format = "usd", className, title }: PnlTextProps) {
  if (value == null) return <span className="text-gray-500">—</span>;

  const formatted =
    format === "pct"
      ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
      : `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;

  return <span className={cn(pnlColor(value), className)} title={title}>{formatted}</span>;
}
