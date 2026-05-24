import { useState } from "react";
import { Card, CardHeader, CardTitle } from "../../ui/Card";
import { Badge } from "../../ui/Badge";

// Counter-view to mirroring Aschenbrenner's 13F. Most points sourced from the
// All-In podcast episode 274 (Nov 2026, Gavin Baker discussing SAA's filing).
// Keep this informational, not actionable — the dashboard is a screen, not a
// directive.

interface RiskPoint {
  title: string;
  body: string;
}

const RISK_POINTS: RiskPoint[] = [
  {
    title: "45-day reporting lag",
    body: "13F shows positions as of 03-31. Q1 puts may have been geopolitical hedges (Iran tail risk) that have since been unwound. The current SAA book may differ substantially from what's displayed.",
  },
  {
    title: "NVDA short ($1.57B puts) vs fundamentals",
    body: "NVDA Q1 2026: +85% YoY revenue, $58B net income on $82B revenue, mid-teens forward P/E, CPU business added $20B/yr to the run rate. NVDA is gaining share. The bearish put thesis is hard to defend on fundamentals.",
  },
  {
    title: "AVGO short ($1.01B puts) vs guidance",
    body: "AVGO just guided +143% YoY AI semiconductor growth — opposite signal from the bearish put. Even if AVGO's 80x forward P/E feels rich, the actual numbers blow doors off the short thesis.",
  },
  {
    title: "Memory longs at 3-5x sector P/E",
    body: "SNDK ($724M long, no put) and the MU position trade at sector P/Es of 3-5x while NVDA trades at low-teens forward. Cross-sectionally this is either deep value or value trap — there's no clean read.",
  },
  {
    title: "CRWV TAM contested",
    body: "Aschenbrenner long CRWV $556M. But Anthropic just signed a $15B/yr Colossus rental from SpaceX — neocloud GPU rental TAM is increasingly contested by hyperscaler vertical integration (XAI compute, Tesla, OpenAI infra). CRWV competition risk has gone up since the filing.",
  },
  {
    title: "A 13F is a hedged, multi-objective snapshot",
    body: "Not a directional bet. Some positions are paired internally (the small NVDA / AMD / INTC / MU / TSM long shares against larger puts are clearly hedged structures, not net longs). Use the SAA overlay as a screen for thesis-aligned names, not as a position guide.",
  },
];

export function SaaRiskPanel() {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-amber-900/40 bg-amber-950/10">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-amber-300">
            Risks to mirroring SAA's positioning
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="text-[10px]">counter-view</Badge>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] text-amber-300/80 hover:text-amber-200 underline-offset-2 hover:underline"
            >
              {expanded ? "Collapse" : "Show 6 points"}
            </button>
          </div>
        </div>
        <div className="text-[10px] text-amber-200/60 mt-1 leading-snug">
          Reasons not to blindly mirror Aschenbrenner's 13F — informational, not actionable.
          Largely sourced from the All-In podcast (Gavin Baker, Treaties Management).
        </div>
      </CardHeader>
      {expanded && (
        <div className="space-y-3 text-[12px]">
          {RISK_POINTS.map((pt, i) => (
            <div key={i} className="border-l-2 border-amber-700/40 pl-3">
              <div className="font-medium text-amber-200 mb-0.5">{pt.title}</div>
              <div className="text-gray-300 leading-relaxed">{pt.body}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
