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
M2 at 15:35: npm test passes 67 proxy checks and 10 UI regressions. Independent QA reports full desktop flow, 390 by 844 mobile layout, care/all-record graphs, and human-readable source drawers pass with live records. Post-save state is revision 10, preserved by the sole QA writer. Initial PDF is one A4 page; QA dose omission fixed in 45a2295 with explicit visit 20 mg daily and pharmacy 10 mg daily claims, dates, and full citations. Corrected reprint pending. River shows verified 0/72 base and 71/72 trained strict synthetic task match with token-cap caveat; no demo model extraction success claimed. No web mutations or persistent process ownership. Runtime owns 4700; all dependency code pages read.
