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
services/web/server.mjs owns the HTTP asset and proxy allowlists. public/index.html, public/styles.css, public/app.js, and public/favicon.svg implement the responsive family room. smoke.mjs checks routing, error handling, response limits, origins, static assets, and real loopback transport. README.md documents behavior and sponsor reality.

# API
GET /health reports the web process only. /api/brain/*, /api/ingest/*, /api/brief/*, /api/river/*, and /api/sponsors/* map only explicit methods and endpoints to fixed loopback services. UI source lookup encodes slash-separated page IDs. Request body limit 64 KiB; response limit 4 MiB; upstream timeout 120 seconds.

# Depends on
[[code/brain]] supplies durable pages, graph, and recorded medications. [[code/ingest]] extracts and commits synthetic notes. [[code/brief]] returns cited medication answers, source discrepancies, and previsit briefs. [[code/river]] reports actual extraction mode and measured evaluation data. [[code/sponsors]] captures/replays local synthetic procedures and fetches the fictional clinic. [[code/runtime]] owns service processes. [[code/contract]] governs all HTTP integration.

# Gotchas
All product data comes from HTTP. Initial loading and service failures are visible, not replaced by fixtures. A newer visit claim never resolves a different pharmacy source. Note extraction is reviewed before save; unknown commit retries retain the same idempotency key while the note is unchanged. No clinical recommendations. Sponsor status and evidence distinguish deterministic fallback, local simulation, and local HTTP fetch. Browser content uses DOM text, not source HTML. No cross-lane runtime imports except shared contract. No external submissions, credentials, or network targets.

# Milestone
M1: Proxy smoke 67 checks passed. Native Chrome rendered the family room, unavailable dependency errors, and live deterministic note review with all warnings. Runtime owns persistent 4700. All dependency code pages read. Live read-only revision 2 has 32 pages, 132 edges, recorded 20 mg visit claim and both unresolved discrepancy sources. Four focused UI state regressions pass in an in-memory DOM: failed medication refresh cannot redraw stale doses; pending saves restore before requests settle and reuse their original key after reload. Sponsor status initialization is isolated from action evidence. Shared-state mutation windows belong to ingest, then QA, then web; no web mutations yet.
