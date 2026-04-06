import { useState } from "react";
import { cn } from "../../lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SignalFlowDiagramProps {
  token?: {
    symbol: string;
    signals: Record<string, { value: number | null; score: number; label: string }>;
    va_count: number;
    sm_count: number;
    raw_score: number;
    adjusted_score: number;
    confidence: number;
    tilt: number;
  } | null;
  vaWeights?: Record<string, number>;
  config?: Record<string, number>;
}

function PillarBox({
  title,
  subtitle,
  accent,
  filled,
  total,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  filled?: number;
  total?: number;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  const accentBorder =
    accent === "purple"
      ? "border-t-purple-500"
      : accent === "blue"
        ? "border-t-blue-500"
        : "border-t-orange-500";

  const accentText =
    accent === "purple"
      ? "text-purple-400"
      : accent === "blue"
        ? "text-blue-400"
        : "text-orange-400";

  return (
    <div
      className={cn(
        "flex-1 rounded-lg border border-gray-800 bg-gray-900/80 border-t-2",
        accentBorder
      )}
    >
      <div
        className={cn(
          "px-3 py-2.5",
          onToggle && "cursor-pointer select-none"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <span className={cn("text-xs font-semibold", accentText)}>
            {title}
          </span>
          {onToggle && (
            <span className="text-gray-500">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
        {filled != null && total != null && (
          <div className="mt-1.5 flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i < filled
                    ? accent === "purple"
                      ? "bg-purple-500"
                      : accent === "blue"
                        ? "bg-blue-500"
                        : "bg-orange-500"
                    : "bg-gray-700"
                )}
              />
            ))}
          </div>
        )}
      </div>
      {expanded && children && (
        <div className="border-t border-gray-800 px-3 py-2">{children}</div>
      )}
    </div>
  );
}

function FormulaBox({
  formula,
  resolved,
}: {
  formula: string;
  resolved?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/80 px-4 py-2.5 text-center">
      <div className="font-mono text-xs text-gray-300">{formula}</div>
      {resolved && (
        <div className="mt-1 font-mono text-xs text-gray-500">{resolved}</div>
      )}
    </div>
  );
}

function MergeArrows() {
  return (
    <div className="relative flex h-10 items-end justify-center">
      {/* Three vertical lines from pillars */}
      <div className="absolute top-0 left-1/6 h-4 w-px bg-gray-700" />
      <div className="absolute top-0 left-1/2 h-4 w-px bg-gray-700 -translate-x-px" />
      <div className="absolute top-0 right-1/6 h-4 w-px bg-gray-700" />
      {/* Horizontal connector */}
      <div className="absolute top-4 left-1/6 right-1/6 h-px bg-gray-700" />
      {/* Center vertical line down */}
      <div className="absolute top-4 left-1/2 h-4 w-px bg-gray-700 -translate-x-px" />
      {/* Arrow head */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-gray-600" />
    </div>
  );
}

export function SignalFlowDiagram({
  token,
  vaWeights,
  config,
}: SignalFlowDiagramProps) {
  const [p1Expanded, setP1Expanded] = useState(false);

  const smMultiplier = config?.SM_MULTIPLIER ?? 0.5;
  const p3Multiplier = config?.P3_MULTIPLIER ?? 0.3;
  const mmMultiplier = config?.MM_MULTIPLIER ?? 0.09;

  // Build resolved formula strings when token is selected
  const rawFormula = `Raw Score = VA×w + ${smMultiplier.toFixed(2)}×SM + ${p3Multiplier.toFixed(2)}×OP + ${mmMultiplier.toFixed(2)}×MM`;
  const rawResolved = token
    ? `= ${token.va_count} signals + ${smMultiplier.toFixed(2)}×${token.sm_count} signals → ${token.raw_score.toFixed(3)}`
    : undefined;

  const confFormula = `× Confidence × Aggression`;
  const confResolved = token
    ? `× ${token.confidence.toFixed(2)} → ${token.adjusted_score.toFixed(3)}`
    : undefined;

  const tiltFormula = `Tilt = max(0.25, 2^adjusted)`;
  const tiltResolved = token
    ? `= max(0.25, 2^${token.adjusted_score.toFixed(3)}) → ${token.tilt.toFixed(3)}`
    : undefined;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-gray-400">
          Signal Flow
        </span>
        {token && (
          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold text-gray-300">
            {token.symbol}
          </span>
        )}
      </div>

      {/* Row 1: Pillar boxes */}
      <div className="flex gap-2">
        <PillarBox
          title="P1: Value Accrual"
          subtitle={
            vaWeights
              ? `${Object.keys(vaWeights).length} signals`
              : "6 signals, 20% each"
          }
          accent="purple"
          filled={token ? token.va_count : undefined}
          total={token ? (vaWeights ? Object.keys(vaWeights).length : 6) : undefined}
          expanded={p1Expanded}
          onToggle={vaWeights ? () => setP1Expanded(!p1Expanded) : undefined}
        >
          {vaWeights && (
            <div className="space-y-1">
              {Object.entries(vaWeights).map(([key, weight]) => {
                const sig = token?.signals[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between text-[10px]"
                  >
                    <span className="text-gray-400 truncate mr-2">
                      {sig?.label ?? key.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-600">
                        w={weight.toFixed(2)}
                      </span>
                      {sig && (
                        <span
                          className={cn(
                            "font-mono",
                            sig.score > 0
                              ? "text-emerald-400"
                              : sig.score < 0
                                ? "text-red-400"
                                : "text-gray-600"
                          )}
                        >
                          {sig.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PillarBox>

        <PillarBox
          title="SM: Smart Money"
          subtitle={`${token ? token.sm_count : 10} signals, ×${smMultiplier.toFixed(2)}`}
          accent="blue"
          filled={token ? token.sm_count : undefined}
          total={token ? 10 : undefined}
        />

        <PillarBox
          title="OP: Operational Performance"
          subtitle={`per-token bespoke, ×${p3Multiplier.toFixed(2)}`}
          accent="orange"
        />

        <PillarBox
          title="MM: Market Microstructure"
          subtitle={`4 signals, ×${mmMultiplier.toFixed(2)}`}
          accent="cyan"
        />
      </div>

      {/* Row 2: Merge arrows */}
      <MergeArrows />

      {/* Row 3: Formula boxes */}
      <div className="space-y-1.5">
        <FormulaBox formula={rawFormula} resolved={rawResolved} />
        <FormulaBox formula={confFormula} resolved={confResolved} />
        <FormulaBox formula={tiltFormula} resolved={tiltResolved} />
      </div>
    </div>
  );
}
