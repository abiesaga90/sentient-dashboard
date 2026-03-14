import { cn } from "../../lib/utils";

type Variant = "default" | "success" | "danger" | "warning" | "info";

const variants: Record<Variant, string> = {
  default: "bg-gray-800 text-gray-300",
  success: "bg-green-900/40 text-green-400 border-green-800/50",
  danger: "bg-red-900/40 text-red-400 border-red-800/50",
  warning: "bg-yellow-900/40 text-yellow-400 border-yellow-800/50",
  info: "bg-blue-900/40 text-blue-400 border-blue-800/50",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-transparent px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
