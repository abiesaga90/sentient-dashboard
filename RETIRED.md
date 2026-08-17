# RETIRED — do not edit this repo

This repo is an archive as of **2026-08-17**. Its Render static site
(`sentient-dashboard`, `srv-d6qler4r85hc73f02so0`) is **suspended**, so nothing here is served
to anyone.

## Where the live dashboard is

**`~/sentient-equity-dashboard`** → GitHub `abiesaga90/sentient-equity-dashboard` → Render web
service `sentient-equity-dashboard-gated` (`srv-d9uplo6gekts73d13f0g`, autoDeploy on from `main`)
→ **sentientadvisory.llc**, behind HTTP Basic Auth.

Edit `src/pages/EquityPmsDashboard.tsx` **there**, not here. The copy in this repo has been stale
since 2026-07-27 and exists only as history.

## Why this file exists

Until 2026-08-17 the `sentient-equity-rv` daily job wrote every state JSON into *this* repo and
then copied a hand-listed subset into the served one. The list went stale in both directions:
`onboarding_state.json` was written daily and never copied, so it had never once reached the site,
and `frontier_state.json` / `path_reconciliation.json` sat frozen in the served repo while the
source kept moving. The job now writes straight into the served repo and adds whatever is there.

This repo also holds older pages (`DefiYieldPage`, `LiveDashboard`, `YieldDashboard`) from earlier
projects. They are not served either. If any of them is ever wanted again, port it forward into the
live repo rather than resuming this site.
