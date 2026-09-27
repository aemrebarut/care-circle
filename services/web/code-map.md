---
type: note
title: Care Circle Web Family Room
ingested_at: '2026-09-27T22:05:40.313Z'
source_kind: put_page
ingested_via: put_page
---

# Purpose
A calm, source-connected family room for the synthetic Care Circle demo. Presents live graph records, cited recorded medications, unresolved source discrepancies, note review and save, printable previsit, and honest sponsor helper status.

# Run
Runtime owns persistent node services/web/server.mjs on 127.0.0.1:4700. npm test --prefix services/web runs isolated smoke with short-lived 4719 web and 4712 synthetic upstream listeners. No build or dependency installation is needed.

# Files
services/web/server.mjs owns the HTTP asset and proxy allowlists. public/index.html, public/styles.css, public/app.js, and public/favicon.svg implement the responsive family room. smoke.mjs checks routing, error handling, response limits, origins, static assets, and real loopback transport. test/ui-state.test.mjs exercises the real app with an isolated in-memory DOM. README.md documents behavior and sponsor reality. QA.md records evidence and outstanding verification.

# API
GET /health reports the web process only. /api/brain/*, /api/ingest/*, /api/brief/*, /api/river/*, and /api/sponsors/* map only explicit methods and endpoints to fixed loopback services. UI source lookup encodes slash-separated page IDs. Request body limit 64 KiB; response limit 4 MiB; upstream timeout 120 seconds.

# Depends on
[[code/brain]] supplies durable pages, graph, and recorded medications. [[code/ingest]] extracts and commits synthetic notes. [[code/brief]] returns cited medication answers, source discrepancies, and previsit briefs. [[code/river]] reports actual extraction mode and measured evaluation data. [[code/sponsors]] captures/replays local synthetic procedures and fetches the fictional clinic. [[code/runtime]] owns service processes. [[code/contract]] governs all HTTP integration.

# Gotchas
All product data comes from HTTP. Initial loading and service failures are visible, not replaced by fixtures. Request versions prevent old responses from overwriting fresh records. A newer visit claim never resolves a different pharmacy source. Alerts and print show every differing claim with dose, frequency, date, and citation, retaining historical discrepancy descriptions. Note extraction is reviewed before save; unknown commit retries retain payload and idempotency key across reload in session storage. Re-review preserves uncertainty until confirmed save. No clinical recommendations. Sponsor status and evidence distinguish deterministic fallback, local simulation, and local HTTP fetch. Historical local Memorable recall and browser observation do not imply learned procedures or official UFO execution. River provenance is preserved, but rejected demo samples mean extraction remains deterministic. Browser content uses DOM text, not source HTML. No cross-lane runtime imports except shared contract. No external submissions, credentials, or network targets.

# Milestone
M3 at 15:55: npm test passes 67 proxy checks and 12 UI regressions. Independent QA and web owner inspected the corrected live PDF: one A4 page, explicit visit 20 mg daily and pharmacy 10 mg daily claims with dates and citations, all eight unique source IDs and footer, no clipping. Desktop flow, 390 by 844 mobile graphs, and source drawers passed. Browser receipt for 002da86 verifies nested source heading focus, polite medication-answer live region, and expanded/focused River evidence retained across successful polls. Screen-reader audio was not exercised. Post-save revision 10 preserved during read-only checks; zero web mutations. River shows verified 0/72 base and 71/72 trained strict synthetic task match with token-cap caveat; no demo model extraction success claimed. Latest sponsor page read: separate official local recall-to-simulated-replay bridge and official SDK handler proofs do not change HTTP simulation/fetch modes. Remote Memorable denied. Implementation held stable for final two-cycle QA; runtime owns 4700. No persistent web-owned process or restart.

# Paused handoff
Track paused by Emre. No automatic continuation to freeze and no implementation, tests, resets, restarts, model calls, or sponsor calls until explicit resume. All three native web subagents are stopped. Web has no in-flight operation; runtime-owned services remain running. Existing implementation 002da86, print repair 45a2295, 67 proxy checks and 12 UI regressions passed before pause. Corrected PDF and browser focus receipts passed. Final two-cycle acceptance remains unfinished; QA/runtime must report any already accepted reset outcome before a future cycle. Live unknown-save browser reload remains unverified beyond the in-memory regression. Lead owns docs/NEXT_STEPS.md. No open web-specific release defect.
