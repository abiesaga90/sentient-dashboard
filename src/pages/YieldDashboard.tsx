import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Treemap,
} from "recharts";
import { Card, CardHeader, CardTitle } from "../components/ui/Card";
import { KpiCard } from "../components/shared/KpiCard";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────

interface Pool {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  stablecoin: boolean;
  ilRisk: string;
  apyMean30d: number | null;
  volumeUsd7d: number | null;
}

interface ScoredPool extends Pool {
  riskGrade: string;
  riskScore: number;
  effectiveApy: number;
  riskAdjApy: number;
}

// ── Risk scoring (simplified 7-pillar proxy) ────────────────────

const PROTOCOL_GRADES: Record<string, { grade: string; score: number }> = {
  "morpho-v1": { grade: "A", score: 88 },
  "aave-v3": { grade: "A", score: 92 },
  "jupiter-lend": { grade: "A", score: 85 },
  "compound-v3": { grade: "A", score: 90 },
  "loopscale": { grade: "B", score: 72 },
  "avantis": { grade: "B", score: 68 },
  "extra-finance-leverage": { grade: "B", score: 65 },
  "spectra-metavaults": { grade: "B", score: 62 },
  "harvest-finance": { grade: "B", score: 64 },
  "aerodrome-slipstream": { grade: "B", score: 70 },
  "moonwell": { grade: "B", score: 67 },
  "yo-protocol": { grade: "B", score: 60 },
  "zircuit-finance": { grade: "B", score: 61 },
  "autofinance": { grade: "C", score: 52 },
  "carrot-liquidity": { grade: "C", score: 50 },
};

const GRADE_MULT: Record<string, number> = {
  A: 1.0, B: 0.85, C: 0.6, D: 0.3, F: 0, "?": 0.5,
};

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e", B: "#3b82f6", C: "#eab308", D: "#f97316", F: "#ef4444", "?": "#64748b",
};

function scorePool(p: Pool): ScoredPool {
  const meta = PROTOCOL_GRADES[p.project] || { grade: "?", score: 40 };
  const base = p.apyBase ?? 0;
  const reward = p.apyReward ?? 0;
  const effectiveApy = base + reward * 0.25;
  const mult = GRADE_MULT[meta.grade] ?? 0.5;
  const riskAdjApy = effectiveApy * mult;
  return { ...p, riskGrade: meta.grade, riskScore: meta.score, effectiveApy, riskAdjApy };
}

// ── Target allocation (greedy optimizer) ────────────────────────

interface Allocation {
  protocol: string;
  chain: string;
  symbol: string;
  grade: string;
  amount: number;
  pctOfCapital: number;
  baseApy: number;
  riskAdjApy: number;
  tvl: number;
}

function computeAllocation(pools: ScoredPool[], capital: number): Allocation[] {
  const eligible = pools
    .filter((p) => ["A", "B"].includes(p.riskGrade) && p.tvlUsd >= 1_000_000)
    .sort((a, b) => b.riskAdjApy - a.riskAdjApy);

  const allocs: Allocation[] = [];
  let remaining = capital;
  const maxPerProtocol = capital * 0.5;
  const maxPositions = 5;

  for (const p of eligible) {
    if (allocs.length >= maxPositions || remaining < 5000) break;
    const size = Math.min(remaining, maxPerProtocol);
    allocs.push({
      protocol: p.project,
      chain: p.chain,
      symbol: p.symbol,
      grade: p.riskGrade,
      amount: size,
      pctOfCapital: (size / capital) * 100,
      baseApy: p.apyBase ?? 0,
      riskAdjApy: p.riskAdjApy,
      tvl: p.tvlUsd,
    });
    remaining -= size;
  }
  return allocs;
}

// ── DefiLlama fetch ─────────────────────────────────────────────

const STABLES = new Set(["USDC", "USDT", "DAI", "USDS", "FRAX", "GHO", "EURC", "pyUSD", "USDM"]);
const CHAINS = new Set(["Solana", "Base"]);

async function fetchPools(): Promise<Pool[]> {
  const res = await fetch("https://yields.llama.fi/pools");
  const data = await res.json();
  return (data.data as Pool[]).filter(
    (p) =>
      CHAINS.has(p.chain) &&
      p.stablecoin &&
      p.tvlUsd >= 1_000_000 &&
      (p.apy ?? 0) >= 2 &&
      (p.apy ?? 0) <= 50 &&
      [...STABLES].some((s) => (p.symbol || "").includes(s))
  );
}

// ── Dashboard ───────────────────────────────────────────────────

const CAPITAL = 50_000;

export function YieldDashboard() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPools();
      setPools(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const scored = useMemo(() => pools.map(scorePool).sort((a, b) => b.riskAdjApy - a.riskAdjApy), [pools]);
  const allocation = useMemo(() => computeAllocation(scored, CAPITAL), [scored]);

  const blendedApy = useMemo(() => {
    if (!allocation.length) return 0;
    const totalAlloc = allocation.reduce((s, a) => s + a.amount, 0);
    return allocation.reduce((s, a) => s + a.riskAdjApy * (a.amount / totalAlloc), 0);
  }, [allocation]);

  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, "?": 0 };
    for (const p of scored) {
      const g = p.riskGrade;
      counts[g] = (counts[g] || 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([grade, count]) => ({ grade, count, color: GRADE_COLORS[grade] || "#64748b" }));
  }, [scored]);

  const chainBreakdown = useMemo(() => {
    const chains: Record<string, { count: number; tvl: number }> = {};
    for (const p of scored) {
      if (!chains[p.chain]) chains[p.chain] = { count: 0, tvl: 0 };
      chains[p.chain].count++;
      chains[p.chain].tvl += p.tvlUsd;
    }
    return Object.entries(chains).map(([chain, d]) => ({
      chain,
      count: d.count,
      tvl: d.tvl,
    }));
  }, [scored]);

  const topByTvl = useMemo(() =>
    [...scored]
      .filter((p) => ["A", "B"].includes(p.riskGrade))
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 12)
      .map((p) => ({
        name: `${p.project.replace(/-/g, " ")}`,
        size: p.tvlUsd / 1e6,
        apy: p.apyBase ?? 0,
        grade: p.riskGrade,
        color: GRADE_COLORS[p.riskGrade],
      })),
    [scored]
  );

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-red-400 text-sm text-center">
          <div className="text-lg mb-2">Failed to load yield data</div>
          <div className="text-gray-500 text-xs">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-200 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-semibold">DeFi Yield Scanner</h1>
            <p className="text-xs text-gray-500">Sentient Advisory</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-[var(--border)] rounded-lg px-3 py-1.5 transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <Link
            to="/defi-yield"
            className="text-xs text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded-lg px-3 py-1.5"
          >
            Pitch Deck
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            label="Pools Scanned"
            value={loading ? "..." : String(scored.length)}
            sub="Solana + Base"
          />
          <KpiCard
            label="Grade A/B Pools"
            value={loading ? "..." : String(scored.filter((p) => ["A", "B"].includes(p.riskGrade)).length)}
            sub="Investable universe"
          />
          <KpiCard
            label="Best Base APY"
            value={loading ? "..." : `${(scored[0]?.apyBase ?? 0).toFixed(1)}%`}
            valueColor="text-green-400"
            sub={scored[0]?.project.replace(/-/g, " ") || ""}
          />
          <KpiCard
            label="Blended Risk-Adj APY"
            value={loading ? "..." : `${blendedApy.toFixed(2)}%`}
            valueColor="text-cyan-400"
            sub={`On $${(CAPITAL / 1000).toFixed(0)}K allocation`}
          />
          <KpiCard
            label="Est. Annual Yield"
            value={loading ? "..." : `$${((CAPITAL * blendedApy) / 100).toFixed(0)}`}
            valueColor="text-green-400"
            sub={`At ${blendedApy.toFixed(1)}% risk-adjusted`}
          />
        </div>

        {/* Target Allocation + Grade Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Target allocation */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Target Allocation — ${(CAPITAL / 1000).toFixed(0)}K</CardTitle>
              </CardHeader>
              {allocation.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {allocation.map((a) => (
                    <div key={a.protocol + a.symbol} className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: GRADE_COLORS[a.grade] + "20",
                          color: GRADE_COLORS[a.grade],
                        }}
                      >
                        {a.grade}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">
                            {a.protocol.replace(/-/g, " ")}
                          </span>
                          <span className="text-sm font-mono">
                            ${(a.amount / 1000).toFixed(0)}K
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${a.pctOfCapital}%`,
                                backgroundColor: GRADE_COLORS[a.grade],
                                opacity: 0.7,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">
                            {a.baseApy.toFixed(1)}% base
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            {a.chain}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border)] pt-3 mt-3 flex justify-between text-sm">
                    <span className="text-gray-400">Blended risk-adjusted APY</span>
                    <span className="text-cyan-400 font-mono font-semibold">
                      {blendedApy.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Grade distribution pie */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Grade Distribution</CardTitle>
            </CardHeader>
            <div className="flex items-center justify-center">
              <PieChart width={200} height={200}>
                <Pie
                  data={gradeDistribution}
                  cx={100}
                  cy={100}
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="count"
                  nameKey="grade"
                  stroke="none"
                >
                  {gradeDistribution.map((d) => (
                    <Cell key={d.grade} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: any, name: any) => [`${value} pools`, `Grade ${name}`]}
                />
              </PieChart>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {gradeDistribution.map((d) => (
                <div key={d.grade} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-400">{d.grade}: {d.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* TVL Treemap + Chain Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Investable Universe by TVL</CardTitle>
              </CardHeader>
              <ResponsiveContainer width="100%" height={220}>
                <Treemap
                  data={topByTvl}
                  dataKey="size"
                  aspectRatio={4 / 1}
                  stroke="var(--bg-primary)"
                  content={<TreemapCell />}
                />
              </ResponsiveContainer>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Chain Breakdown</CardTitle>
            </CardHeader>
            <div className="space-y-4 mt-2">
              {chainBreakdown.map((c) => (
                <div key={c.chain}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{c.chain}</span>
                    <span className="text-gray-400">{c.count} pools</span>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.count / scored.length) * 100}%`,
                        backgroundColor: c.chain === "Solana" ? "#9945FF" : "#0052FF",
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ${(c.tvl / 1e9).toFixed(2)}B TVL
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Yield distribution histogram */}
        <Card>
          <CardHeader>
            <CardTitle>Base APY Distribution (Grade A/B Pools)</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <ApyHistogram pools={scored.filter((p) => ["A", "B"].includes(p.riskGrade))} />
          </ResponsiveContainer>
        </Card>

        {/* Full opportunity table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Opportunities ({scored.length} pools)</CardTitle>
              <span className="text-xs text-gray-500">Sorted by risk-adjusted APY</span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-gray-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3 text-left">Grade</th>
                  <th className="py-2 px-3 text-left">Protocol</th>
                  <th className="py-2 px-3 text-left">Chain</th>
                  <th className="py-2 px-3 text-left">Asset</th>
                  <th className="py-2 px-3 text-right">Base APY</th>
                  <th className="py-2 px-3 text-right">Reward</th>
                  <th className="py-2 px-3 text-right">Risk-Adj</th>
                  <th className="py-2 px-3 text-right">TVL</th>
                </tr>
              </thead>
              <tbody>
                {scored.slice(0, 30).map((p, i) => (
                  <tr
                    key={p.pool}
                    className={cn(
                      "border-b border-[var(--border)] hover:bg-[var(--bg-card)]",
                      i < allocation.length && "bg-purple-500/5"
                    )}
                  >
                    <td className="py-2 px-3">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
                        style={{
                          backgroundColor: GRADE_COLORS[p.riskGrade] + "20",
                          color: GRADE_COLORS[p.riskGrade],
                        }}
                      >
                        {p.riskGrade}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium">
                      {p.project.replace(/-/g, " ")}
                    </td>
                    <td className="py-2 px-3 text-gray-400">{p.chain}</td>
                    <td className="py-2 px-3 font-mono text-xs text-gray-400">
                      {p.symbol.length > 16 ? p.symbol.slice(0, 16) + "..." : p.symbol}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-green-400">
                      {(p.apyBase ?? 0).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-500">
                      {(p.apyReward ?? 0) > 0 ? `${(p.apyReward ?? 0).toFixed(2)}%` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-cyan-400 font-semibold">
                      {p.riskAdjApy.toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {p.tvlUsd >= 1e9
                        ? `$${(p.tvlUsd / 1e9).toFixed(1)}B`
                        : `$${(p.tvlUsd / 1e6).toFixed(1)}M`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-gray-600">
        Sentient Advisory LLC &middot; Data from DefiLlama &middot; Risk grades are indicative
      </footer>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function TreemapCell(props: any) {
  const { x, y, width, height, name, size, color } = props;
  if (width < 40 || height < 25) return null;
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        rx={4}
        fill={color || "#8b5cf6"}
        fillOpacity={0.3}
        stroke="var(--bg-primary)"
        strokeWidth={2}
      />
      {width > 60 && (
        <>
          <text x={x + 6} y={y + 16} fill="#e2e8f0" fontSize={11} fontWeight={600}>
            {name && name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + ".." : name}
          </text>
          <text x={x + 6} y={y + 30} fill="#94a3b8" fontSize={10}>
            ${size?.toFixed(0)}M
          </text>
        </>
      )}
    </g>
  );
}

function ApyHistogram({ pools }: { pools: ScoredPool[] }) {
  const buckets = useMemo(() => {
    const b: Record<string, number> = {};
    for (let i = 0; i <= 16; i += 2) {
      b[`${i}-${i + 2}%`] = 0;
    }
    for (const p of pools) {
      const apy = p.apyBase ?? 0;
      const bucket = Math.min(Math.floor(apy / 2) * 2, 16);
      const key = `${bucket}-${bucket + 2}%`;
      b[key] = (b[key] || 0) + 1;
    }
    return Object.entries(b).map(([range, count]) => ({ range, count }));
  }, [pools]);

  return (
    <BarChart data={buckets} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
      <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 10 }} />
      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} />
      <Tooltip
        contentStyle={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, fontSize: 12 }}
      />
      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
    </BarChart>
  );
}
