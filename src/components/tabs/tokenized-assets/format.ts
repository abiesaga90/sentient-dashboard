export const fmtUsd = (v: number | null | undefined, digits = 2): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(digits)}`;
};

export const fmtPrice = (v: number | null | undefined, digits = 2): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (v >= 1000) return `$${v.toFixed(0)}`;
  if (v >= 1) return `$${v.toFixed(digits)}`;
  return `$${v.toFixed(4)}`;
};

export const fmtPct = (v: number | null | undefined, digits = 2): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
};

export const fmtNum = (v: number | null | undefined, digits = 2): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
};

export const fmtInt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString();
};

export const pctColor = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "text-gray-400";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-red-400";
  return "text-gray-300";
};

export const fundingColor = (apr: number | null | undefined): string => {
  if (apr === null || apr === undefined || Number.isNaN(apr)) return "text-gray-400";
  if (apr > 10) return "text-red-400";
  if (apr > 3) return "text-amber-400";
  if (apr < -3) return "text-emerald-400";
  return "text-gray-300";
};
