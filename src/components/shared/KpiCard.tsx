import { Card } from "../ui/Card";
import { cn } from "../../lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, sub, valueColor, icon }: KpiCardProps) {
  return (
    <Card className="flex flex-col gap-1 min-w-[140px]">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <div className={cn("text-lg font-semibold", valueColor || "text-gray-100")}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </Card>
  );
}
