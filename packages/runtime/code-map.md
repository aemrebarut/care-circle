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

Runtime owns only PIDs it starts. Receipts and logs live in `.runtime/managed/`, separate from coordinator state. Repeated start reuses healthy external listeners without adopting them. Stop validates process identity and never signals unknown listeners or process groups. No forced kill during potential brain writes. Shared operation lock serializes start, stop, and reset. Signals cancel cleanly; stale locks recover only with verified dead-owner proof and exclusive recovery claim. Incomplete or interrupted recovery stays fail-closed. Coordinate reset/ingest with QA. Reset timeout is ambiguous and must not be blindly retried. No direct family brain access. Test fixtures reserve 4715 and 4716 only. All data is synthetic and recorded doses are source claims. No sponsor upload is triggered by runtime.

## Milestone evidence

Initial lifecycle and hook implementation: 55 passing synthetic tests, including exact-PID stop, idempotent startup, external listener survival, partial sponsor groups, bounded HTTP, dead-owner recovery, contention, cancellation, and secret-hook enforcement. Hook source matches the original protection byte for byte. Persistent River, ingest, sponsors, and brief services handed over by owners and started by runtime. Brain and web readiness pending. Static world smoke passed 30 pages, 120 links and 21 exact citations.
