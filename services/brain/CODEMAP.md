---
type: note
title: Care Circle family brain service
---

# Purpose

Own the synthetic family's real GBrain database and expose typed source pages, persisted graph relationships, cited medication records, durable ingest, and safe demo reset over loopback HTTP.

# Run

Follow `README.md` prerequisites and guarded initialization first: Node.js 22+, Bun 1.3.11+, and the real GBrain from its official GitHub project. The verified storage version is GBrain 0.59. cc-runtime owns persistent startup through `scripts/start brain`, stop, and restart. The listener binds `127.0.0.1:4701`. `npm test --prefix services/brain` runs 38 tests, including an isolated HTTP fixture on port 4719. `node services/brain/smoke.mjs` checks a live service without mutation and waits up to 180 seconds for readiness.

# Files

`server.mjs` owns HTTP and shutdown drain. `gbrain.mjs` exclusively wraps `scripts/brain`. `store.mjs` owns canonical snapshots, serialized mutations, reset and recovery. `domain.mjs` validates records, preserves claims, creates citations and emits entity markdown. Tests cover each layer. `fixtures/demo-ingest.json` is the lane's own synthetic integration payload. `README.md` contains setup and recovery instructions; `REVIEW.md` records evidence. This file is the source for the development brain map.

# API

GET `/health`, `/v1/state`, `/v1/pages/:encodedId`, `/v1/medications`, and `/v1/graph`. POST `/v1/ingest` and `/v1/reset`. Ingest accepts the contract extraction, original note, separate author, and bounded idempotency key. An exact retry returns its original response; conflicting reuse returns 409. Future visits after September 27, 2026 return 422; future follow-up dates are permitted. Request bodies are capped at 64 KiB, pending writes at 20, and the durable snapshot at 2 MB.

# Depends on

[[code/world]] provides static synthetic markdown and seed metadata. [[code/contract]] owns shapes and constants. [[code/runtime]] owns persistent processes and demo resets. [[code/ingest]] sends supported extractions over HTTP. [[code/brief]] reads source records and the graph. [[code/web]] exposes the family interface. [[code/qa]] owns coordinated acceptance windows.

# Gotchas

Only this service opens the family brain, always through `scripts/brain`. Never use plain GBrain or the primary track's storage. Engine-free preflight requires local PGLite inside the dedicated family directory, explicit non-thin-client metadata, and disabled embeddings. Provider credentials and remote storage overrides are not inherited by CLI children.

Native managed import requires write-through. The adapter verifies the existing effective canonical root is inside the family directory and owned by this host, temporarily enables write-through for `import --no-embed`, and restores false in a finally block. The static world package is never modified. Normal writes explicitly target the default source in database-only mode.

GBrain page `care-circle/service-state` is the atomic durable commit boundary. It stores all typed pages, revision, reset epoch, ownership manifest and exact idempotent receipts. Entity pages carry a final `care-circle-page` JSON fence, with native link extraction after materialization. Interrupted projection blocks readiness until recovery finishes. Restart never silently reseeds corrupt state.

GBrain 0.59 pending writes replay the exact UUID and intent. Startup and recovery first commit a same-source database barrier, then require the separate managed-import worktree to have no pending requests, recovery bytes or recovering effects. Counter metadata must be numeric zero or canonical string zero. The installed GBrain journal's FIFO guarantee is documented in `REVIEW.md` and must be rechecked on upgrades.

Shutdown retains port ownership while initialization, queued mutations, recovery and owned CLI children drain. The wrapper is never killed on timeout. Reset retains tombstones and only deletes obsolete owned IDs. Unrelated family-brain pages survive.

Original notes and authors remain separate from attendance. Older and conflicting pharmacy claims are retained; newer visits do not reconcile them. Doctor displayed chronology cites its causing visit. Long citation excerpts retain medication and dose evidence. All data is synthetic. Not medical advice. No external sponsor submissions occur.

# Milestone evidence

Initial implementation `e95452d` and follow-ups through `e171089` are pushed. Native GBrain import committed all 30 world pages with zero errors; the world diff stayed empty and write-through was restored to false. Independent HTTP citation audit passed 21 literal quotes, seven medications and 120 graph edges.

Runtime baseline restart preserved exact revision 1 state. Canonical ingest plus retry produced one visit and claim. Post-ingest restart preserved revision 2, 32 pages and 132 graph edges, and the same-key retry returned the original response with unchanged state. At M2, 15:35 Pacific, the latest reviewed build loaded into runtime-owned PID 4515 and preserved exact revision 10 state with 32 pages and 132 edges. The brain lane's read-only citation smoke and all-service smokes passed. There are no known brain blockers; QA owns remaining coordinated demo cycles.

At M3, 15:55 Pacific, the final storage review closed all prior findings and passed all nine isolated adapter tests. Read-only HTTP smoke again passed revision 10 with 32 pages, seven medications and 132 edges. QA owns the final two-cycle mutation window. A runtime PATH-only restart request is queued after that window because the default macOS Git launcher now requires an unaccepted license; no license or global setting was changed. Implementation remains stable, with 38 passing tests in the latest full suite.

# Paused handoff

Emre paused this track at 15:57 Pacific and requested immediate wrap-up. All three native brain subagents were notified. Leave runtime-owned PID 4515 running; no further work resumes automatically at freeze. The last minimal health observation showed an already accepted mutation at revision 12 with 31 pages and status `committing`; let it drain without interruption or retry. QA/runtime own its final receipt. Final two-cycle acceptance is not yet claimed complete. On explicit resume, inspect that receipt and readiness before coordinating any PATH-only restart or QA mutation window. Lead owns `docs/NEXT_STEPS.md`.
