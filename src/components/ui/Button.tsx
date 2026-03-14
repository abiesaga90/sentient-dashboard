import { cn } from "../../lib/utils";

type Variant = "default" | "ghost" | "outline";

const variants: Record<Variant, string> = {
  default: "bg-blue-600 hover:bg-blue-700 text-white",
  ghost: "hover:bg-white/5 text-gray-400 hover:text-gray-200",
  outline: "border border-[var(--border)] hover:bg-white/5 text-gray-300",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export function Button({
  variant = "default",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        variants[variant],
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        className
      )}
      {...props}
    />
  );
}
