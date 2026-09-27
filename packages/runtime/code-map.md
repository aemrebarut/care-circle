---
title: Care Circle runtime
type: code
---

# Care Circle runtime

## Purpose

Manage the local demo with exact process ownership, bounded health checks, read-only smoke, and HTTP-only reset. Runtime has no HTTP listener of its own.

## Run

`scripts/setup` checks prerequisites and installs the public secret hook for a fresh clone. Then `scripts/start`, `scripts/smoke`, `scripts/demo-reset`, `scripts/stop`. Select names with `scripts/start brain`. Tests: `npm test --prefix packages/runtime`. Startup allows 180 seconds per service by default for GBrain CLI latency.

## Files

`packages/runtime/cli.mjs`, `registry.mjs`, `lifecycle.mjs`, `http.mjs`, `checks.mjs`, `README.md`, package metadata and synthetic tests. Shell entrypoints under `scripts/`; existing brain wrappers remain untouched. Hook source `scripts/hooks/pre-commit` and installer `scripts/install-hooks` support fresh clones.

## API

Reads service `/health` at 4700 through 4706. Starts Node entrypoints at `services/<name>/server.mjs`. Sponsors owns 4705 and 4706 with health identities sponsors and sponsors-clinic. Reset sends `{}` to brain and sponsors `/v1/reset`. Smoke reads brain state and medications, brief contradiction and answer responses, sponsor status, UI and web proxy. All HTTP uses 127.0.0.1 with redirects rejected and bounded time and body sizes.

## Depends on

[[code/brain]], [[code/river]], [[code/ingest]], [[code/brief]], [[code/sponsors]], [[code/web]], [[code/qa]], and shared contract constants. Only HTTP crosses service ownership boundaries.

## Gotchas

Runtime owns only PIDs it starts. Receipts and logs live in `.runtime/managed/`, separate from coordinator state. Successful stop archives its receipt in `history/` before removing active ownership. Repeated start reuses healthy external listeners without adopting them. Stop validates process identity and never signals unknown listeners or process groups. No forced kill during potential brain writes. Shared operation lock serializes start, stop, and reset. Signals cancel cleanly; stale locks recover only with verified dead-owner proof and exclusive recovery claim. Incomplete or interrupted recovery stays fail-closed. Coordinate reset/ingest with QA. Reset timeout is ambiguous and must not be blindly retried. No direct family brain access. Test fixtures reserve 4715 and 4716 only. All data is synthetic and recorded doses are source claims. No sponsor upload is triggered by runtime.

## Milestone evidence

M1: 55 passing synthetic tests, including exact-PID stop, idempotent startup, external listener survival, partial sponsor groups, bounded HTTP, dead-owner recovery, contention, cancellation, and secret-hook enforcement. Hook source matches the original protection byte for byte. Successful stop now archives its verified receipt, covered by the focused lifecycle assertion. Fresh-clone setup runs hook installation.

All seven live endpoints passed runtime smoke. Static world smoke passed 30 pages, 120 links and 21 exact citations. After the brain owner repaired canonical import ownership, runtime proved exact HTTP state equality across a graceful owned brain restart: revision 1, 30 pages, 120 graph edges. The local proof receipt is `.runtime/managed/persistence-check.json`. Brain and brief live read-only smoke also passed.

Post-ingest persistence also passed: exact HTTP state revision 2, 32 pages and 132 graph edges survived another graceful owned restart. Local receipt: `.runtime/managed/post-ingest-persistence-check.json`. Ingest then replayed the same canonical key/payload and verified the original visit/revision and unchanged complete state. Independent review inspected citations, retained 10 mg source conflict, and 20 mg recorded claim without mutation. Exclusive QA acceptance window began at 15:17 Pacific after all releases.

R8 follow-up: lock recovery now requires PID absence at both checks. Any live PID preserves the lock, including malformed identity, changed command, or PID reuse. All 17 lifecycle tests pass; the original 39 hook checks are unchanged.

## M2, 15:35 Pacific

Full runtime regression suite passes 56/56. Independent HTTP acceptance passed its first complete cycle 32/32, then demo-reset restored the clean seed. Browser QA made one save and preserved revision 10; desktop, mobile, sources and sponsor checks passed. Its one-page print claim fix is awaiting a read-only reprint.

After explicit UI release, runtime refreshed the brain storage guards, ingest provenance validation, and River status/no-cache source. Exact state equality passed across those owned restarts: revision 10, 32 pages, 132 edges. Receipt: `.runtime/managed/post-ui-maintenance-check.json`. All-service smoke plus brain, ingest and River owner smoke passed. Optional River attempts remain disabled; River is deterministic fallback with extraction unavailable. Sponsor capture/replay counts survived unchanged.

QA has read-only reprint access. Sponsors has a separate explicit grant for exactly three local proof POSTs, with no brain writes, reset, restart or remote submission. Two consecutive full QA cycles follow both releases. Remote Memorable submission was explicitly declined. Runtime has made no external sponsor submissions.
