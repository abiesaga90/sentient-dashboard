import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function DefiYieldPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-gray-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">Sentient Advisory</span>
        </Link>
      </nav>

      {/* Cover */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-purple-400 mb-6">
          Sentient Advisory
        </p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          DeFi Yield Management
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-2">
          Autonomous, risk-scored deployment of capital across DeFi protocols.
          Market-neutral yield denominated in your deposit asset.
        </p>
        <p className="text-sm text-gray-600">March 2026 &middot; Confidential</p>
      </section>

      {/* The Opportunity */}
      <Section num="01" title="The Opportunity">
        <p className="text-gray-400 mb-4">
          Decentralized finance holds <Hl>$200B+ in total value locked</Hl>, yet
          the supply of institutional capital managers remains a fraction of the
          protocols demanding liquidity.
        </p>
        <p className="text-gray-400 mb-8">
          Over the past year, <Hl>1,000+ new DeFi platforms</Hl> launched. The
          number of professional yield managers did not keep pace. This creates a
          structural supply-demand imbalance in favor of capital providers.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="$200B+" label="Total DeFi TVL" />
          <StatCard value="1,000+" label="New protocols in 2025" />
          <StatCard value="4-15%" label="Stablecoin yield range" />
          <StatCard value="~20 bps" label="Annual hack loss rate" />
        </div>
        <p className="text-gray-400 mt-6">
          DeFi yields are <Accent>structurally higher</Accent> than TradFi
          alternatives because the cost of launching a protocol approaches zero,
          while the cost of launching a fund remains high.
        </p>
      </Section>

      {/* Our Thesis */}
      <Section num="02" title="Our Thesis">
        <blockquote className="text-xl md:text-2xl font-medium text-gray-100 mb-6 border-l-2 border-purple-500 pl-6">
          "We are bankers to the blockchain — stepping in to provide liquidity
          where it is needed most, and earning yield for doing so."
        </blockquote>
        <p className="text-gray-400 mb-6">
          Our primary risk is <Hl>software risk</Hl> — the possibility that a
          protocol is exploited. This is analogous to{" "}
          <Accent>selling a put option</Accent>: you earn a premium (yield) every
          day, and your exposure is to a tail-risk event (a hack).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Rigorous Scoring">
            7-pillar risk framework rates every protocol A through F. Only grade
            C+ receives capital.
          </Card>
          <Card title="Diversification">
            Capital spread across protocols, chains, and asset types. No single
            point of failure.
          </Card>
          <Card title="Same-Asset Yield">
            Yield denominated in your deposit: BTC earns BTC, ETH earns ETH, USD
            earns USD. No directional exposure.
          </Card>
        </div>
      </Section>

      {/* How It Works */}
      <Section num="03" title="How It Works">
        <p className="text-gray-400 mb-8">
          A fully autonomous AI agent scans, scores, and deploys capital across
          the highest risk-adjusted yield opportunities. No scheduled
          rebalancing — capital is reallocated only on risk triggers.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <PipelineStep num="1" title="Scan" detail="100+ pools across 2 chains" />
          <Arrow />
          <PipelineStep num="2" title="Score" detail="7-pillar risk framework" />
          <Arrow />
          <PipelineStep num="3" title="Deploy" detail="Allocate to top-scored protocols" />
          <Arrow />
          <PipelineStep num="4" title="Monitor" detail="Continuous risk surveillance" />
          <Arrow />
          <PipelineStep num="5" title="Reallocate" detail="Only on risk triggers" />
        </div>
        <p className="text-gray-400">
          Every step is transparent and verifiable on-chain. The live dashboard at{" "}
          <Hl>sentientadvisory.llc/defi-yield</Hl> shows the full pipeline in
          real time.
        </p>
      </Section>

      {/* Risk Framework */}
      <Section num="04" title="Risk Framework">
        <p className="text-gray-400 mb-6">
          Every protocol is scored across 7 pillars, producing a composite grade
          from A (safest) to F (excluded). Scores are not binary — we operate in
          the <Accent>"50 shades of yellow"</Accent> between safe and risky.
        </p>
        <div className="space-y-3 mb-8">
          <PillarBar name="Admin & Governance" weight={20} />
          <PillarBar name="TVL Stability" weight={15} />
          <PillarBar name="Audit Quality" weight={15} />
          <PillarBar name="Code Maturity (Lindy)" weight={15} />
          <PillarBar name="Composability Risk" weight={15} />
          <PillarBar name="Bug Bounty" weight={10} />
          <PillarBar name="Oracle Dependencies" weight={10} />
        </div>
        <h3 className="text-lg font-semibold mb-3">Circuit Breakers</h3>
        <div className="flex flex-wrap gap-2">
          <Override text="Previous hack (>$1M) → capped at B" />
          <Override text="EOA admin, no timelock → capped at C" />
          <Override text="Zero audits → capped at D" />
          <Override text="Deployed <30 days → capped at C" />
        </div>
      </Section>

      {/* Current Opportunities */}
      <Section num="05" title="Current Opportunity Set">
        <p className="text-gray-400 mb-6">
          Live stablecoin yield opportunities scoring grade B or above. Data sourced
          from DefiLlama. <Hl>Base APY</Hl> = stablecoin-denominated interest.{" "}
          <Accent>Reward APY</Accent> = volatile token incentives (discounted 75% in
          our ranking).
        </p>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-gray-500 text-xs uppercase tracking-wider">
                <th className="py-2 px-3 text-left">Protocol</th>
                <th className="py-2 px-3 text-left">Chain</th>
                <th className="py-2 px-3 text-left">Asset</th>
                <th className="py-2 px-3 text-right">Base APY</th>
                <th className="py-2 px-3 text-right">Reward</th>
                <th className="py-2 px-3 text-right">TVL</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <OpRow protocol="Morpho (Steakhouse)" chain="Base" asset="USDC" base="3.75%" reward="-" tvl="$449M" />
              <OpRow protocol="Morpho (Gauntlet)" chain="Base" asset="USDC" base="3.75%" reward="-" tvl="$354M" />
              <OpRow protocol="Jupiter Lend" chain="Solana" asset="USDC" base="2.34%" reward="1.19%" tvl="$495M" />
              <OpRow protocol="Aave V3" chain="Base" asset="USDC" base="2.50%" reward="-" tvl="$92M" />
              <OpRow protocol="Avantis" chain="Base" asset="USDC" base="7.78%" reward="-" tvl="$76M" />
              <OpRow protocol="Morpho (BBQ)" chain="Base" asset="USDC" base="4.84%" reward="-" tvl="$18M" />
              <OpRow protocol="Morpho (Spark)" chain="Base" asset="USDC" base="4.05%" reward="-" tvl="$13M" />
              <OpRow protocol="Spectra Metavaults" chain="Base" asset="USDC" base="15.61%" reward="1.85%" tvl="$5M" />
              <OpRow protocol="Loopscale" chain="Solana" asset="USDC" base="6.94%" reward="1.22%" tvl="$2M" />
              <OpRow protocol="Extra Finance" chain="Base" asset="USDC" base="4.85%" reward="-" tvl="$4M" />
            </tbody>
          </table>
        </div>
        <p className="text-gray-500 text-xs">
          Data as of March 2026. Yields are variable and subject to change. Only
          protocols meeting minimum risk grade (C+) and TVL ($1M) thresholds are
          shown.
        </p>
      </Section>

      {/* Collateral Types */}
      <Section num="06" title="Collateral Types (Roadmap)">
        <p className="text-gray-400 mb-8">
          Capital is deployed in the <Hl>same asset it is denominated in</Hl>.
          No currency conversion, no directional exposure.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CollateralCard
            emoji="$"
            name="Stablecoins"
            apy="4-15%"
            description="USDC/USDT lending on Morpho, Kamino, Jupiter. Pendle PT fixed-rate. Permissionless RWA tokens (sUSDS, sFRAX)."
          />
          <CollateralCard
            emoji="ETH"
            name="Ethereum"
            apy="3-10%"
            description="LST staking (wstETH, weETH), ETH lending on Aave/Morpho, Pendle PT-weETH fixed yield."
          />
          <CollateralCard
            emoji="BTC"
            name="Bitcoin"
            apy="2-6%"
            description="wBTC lending on Aave/Morpho, Pendle PT-wBTC, emerging BTC-Fi protocols."
          />
        </div>
        <p className="text-gray-400 mt-6">
          We strongly prioritize <Hl>base yield</Hl> (interest and fees paid in
          the deposit asset) over <Accent>reward yield</Accent> (volatile
          governance token incentives). Reward APY is discounted to 25% of face
          value in our ranking.
        </p>
      </Section>

      {/* Custody & Security */}
      <Section num="07" title="Custody & Security">
        <p className="text-gray-400 mb-6">
          Investor capital is secured in <Hl>multisig smart contract wallets</Hl> where
          investors retain co-signing authority at all times. Sentient operates as the
          execution agent — proposing transactions to whitelisted protocols only.
          No single party can unilaterally move funds.
        </p>

        <h3 className="text-lg font-semibold mb-4">Multisig Architecture</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card title="Base — Gnosis Safe">
            Industry-standard multisig (2-of-2 or 2-of-3). Investor holds
            Signer 1, Sentient bot holds Signer 2. Whitelisted destinations
            restrict interactions to approved protocol contracts and
            return-to-investor address only. Free, battle-tested, fully
            audited.
          </Card>
          <Card title="Solana — Squads Protocol">
            Equivalent multisig on Solana. Same co-signing model — investor
            retains veto authority over every transaction. Program-level
            whitelisting restricts deployment to scored protocols only.
          </Card>
        </div>

        <h3 className="text-lg font-semibold mb-4">Transaction Flow</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card title="1. Propose">
            Sentient agent identifies opportunity and proposes a deposit
            transaction to a whitelisted protocol contract.
          </Card>
          <Card title="2. Approve">
            Transaction auto-executes if destination is on the whitelist.
            Non-whitelisted destinations require explicit investor approval.
          </Card>
          <Card title="3. Verify">
            All transactions on-chain and visible in block explorers.
            Real-time dashboard and Telegram alerts for every state change.
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Chains">
            Solana (primary) + Base (secondary). Gas costs &lt;0.1% of capital.
            Scale path: add Ethereum L1 at &gt;$50K capital.
          </Card>
          <Card title="Protocols">
            ERC-4626 vault deposits (Morpho, Fluid), protocol-native SDKs (Drift,
            Jupiter, Kamino). All on-chain, fully verifiable.
          </Card>
        </div>
      </Section>

      {/* Terms */}
      <Section num="08" title="Terms">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard value="$50,000" label="Minimum allocation" />
          <StatCard value="30%" label="Performance fee" />
          <StatCard value="30 days" label="Redemption notice" />
          <StatCard value="Real-time" label="Dashboard + Telegram" />
        </div>
        <h3 className="text-lg font-semibold mb-3">Getting Started</h3>
        <div className="space-y-2 text-gray-400 text-sm">
          <p>1. Choose collateral type(s): Stablecoins, ETH, BTC, or a combination</p>
          <p>2. Agree on risk parameters and reporting preferences</p>
          <p>3. Fund the multisig wallet (Gnosis Safe / Squads)</p>
          <p>4. Sentient agent proposes deployments to whitelisted protocols</p>
          <p>5. Monitor positions live at <Hl>sentientadvisory.llc/defi-yield</Hl></p>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-6 text-center text-xs text-gray-600">
        Sentient Advisory LLC &nbsp;&middot;&nbsp; sentientadvisory.llc
        &nbsp;&middot;&nbsp; Confidential — March 2026
      </footer>
    </div>
  );
}

/* ---- Reusable components ---- */

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-4xl mx-auto px-6 py-16 border-t border-[var(--border)]">
      <h2 className="text-3xl font-bold mb-6">
        <span className="text-purple-400 font-light mr-3">{num}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="font-mono text-xl md:text-2xl font-medium text-cyan-400">
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <p className="text-xs text-gray-400">{children}</p>
    </div>
  );
}

function PillarBar({ name, weight }: { name: string; weight: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-48 text-sm text-gray-400 shrink-0">{name}</span>
      <div className="flex-1 h-6 bg-gray-800/50 rounded overflow-hidden">
        <div
          className="h-full bg-purple-500/70 rounded flex items-center pl-2 text-xs font-medium"
          style={{ width: `${weight * 5}%` }}
        >
          {weight}%
        </div>
      </div>
      <span className="w-10 text-right text-xs text-gray-500">{weight}%</span>
    </div>
  );
}

function PipelineStep({
  num,
  title,
  detail,
}: {
  num: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 text-center min-w-[130px]">
      <div className="text-[11px] uppercase tracking-widest text-purple-400 mb-1">
        Step {num}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[11px] text-gray-500 mt-1">{detail}</div>
    </div>
  );
}

function Arrow() {
  return <span className="text-gray-600 text-lg px-1 hidden md:inline">&rarr;</span>;
}

function Override({ text }: { text: string }) {
  return (
    <span className="inline-block bg-red-500/10 text-red-400 text-xs px-3 py-1 rounded-md">
      {text}
    </span>
  );
}

function CollateralCard({
  emoji,
  name,
  apy,
  description,
}: {
  emoji: string;
  name: string;
  apy: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 text-center">
      <div className="text-2xl font-mono font-bold text-gray-500 mb-2">
        {emoji}
      </div>
      <h3 className="font-semibold mb-1">{name}</h3>
      <div className="font-mono text-xl text-green-400 mb-2">{apy} APY</div>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  );
}

function OpRow({
  protocol,
  chain,
  asset,
  base,
  reward,
  tvl,
}: {
  protocol: string;
  chain: string;
  asset: string;
  base: string;
  reward: string;
  tvl: string;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-card)]">
      <td className="py-2 px-3 font-medium">{protocol}</td>
      <td className="py-2 px-3 text-gray-400">{chain}</td>
      <td className="py-2 px-3 font-mono text-xs">{asset}</td>
      <td className="py-2 px-3 text-right font-mono text-green-400">{base}</td>
      <td className="py-2 px-3 text-right font-mono text-gray-500">{reward}</td>
      <td className="py-2 px-3 text-right font-mono">{tvl}</td>
    </tr>
  );
}

function Hl({ children }: { children: React.ReactNode }) {
  return <span className="text-cyan-400 font-semibold">{children}</span>;
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-purple-300">{children}</span>;
}
