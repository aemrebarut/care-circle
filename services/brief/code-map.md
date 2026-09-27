---
type: note
title: Care Circle brief service
---

# Purpose

Graph-grounded pre-visit brief, recorded medication answer and unresolved source discrepancy detector. Deterministic synthetic record organization, never treatment advice.

# Run

`node services/brief/server.mjs` on 127.0.0.1:4703. Runtime owns persistent startup. `npm test --prefix services/brief` creates and closes fixture HTTP servers on 4717 and 4718. `node services/brief/smoke.mjs` is live read-only verification. No variable names or credentials required.

# Files

`services/brief/server.mjs`, `domain.mjs`, `README.md`, `package.json`, `smoke.mjs`, `test/fixture.mjs`, `test/domain.test.mjs`, `test/http.test.mjs`, `code-map.md`.

# API

GET /health, /v1/answer/medications, /v1/contradictions. POST /v1/previsit with doctorId. Uses one brain GET /v1/state snapshot with revision, pages and persisted graph. Returns citations, warnings, traversal paths and compact Markdown. Error envelope follows shared contract.

# Depends on

[[code/brain]] supplies state and resolvable source pages over HTTP. [[code/contract]] defines ports and schemas. [[code/world]] defines synthetic source semantics, consumed only through brain HTTP. [[code/runtime]] owns live processes. [[code/web]] renders answers, source drawers and printable Markdown. [[code/ingest]] creates source-cited changes through brain. [[code/qa]] checks integrated acceptance.

# Gotchas

No cross-lane imports except shared contract; no family database reads. Traversal uses both edge directions and excludes foreign patient IDs. Since cutoff is strictly after 2026-09-15 for nephrology, through demo date 2026-09-27. Unchanged dose claims never become medication changes. Every pharmacy claim is compared to the latest preceding visit and all later visits; unresolved unequal evidence survives later matching visits. No reconciliation exists in v1. Same-day incompatible visit claims remain ambiguous. Medication-specific quote selection prevents same-dose drugs from citing each other's lines. No sponsor calls, credentials or external submissions. Not medical advice.

# Milestone evidence

M1 service d9204b3 committed and pushed. Follow-up review fixes cover foreign patient traversal, future-only doses, unreachable/future question origins, historical discrepancy labels, long-line source excerpts, numeric dose boundaries and meaningful citation preservation. Focused tests pass. Runtime owns live 4703; real-brain read-only smoke awaits brain readiness. No external sponsor activity.
