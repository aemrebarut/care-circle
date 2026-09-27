---
title: Care Circle ingest
type: page
tags: [code, ingest]
---
# Care Circle ingest

## Purpose

Turn supported synthetic visit notes into exact contract Extraction objects and submit verified, idempotent mutations to the real family brain. Preserve source wording, note authorship, event dates and explicit attendance. Never infer treatment instructions.

## Run

`node services/ingest/server.mjs` binds 127.0.0.1:4702. Persistent start is owned by runtime. `npm --prefix services/ingest test` runs unit and HTTP failure tests on reserved 4713. `node services/ingest/smoke.mjs` checks live health/extraction with no writes.

## Files

`services/ingest/extract.mjs`, `server.mjs`, `smoke.mjs`, `test/extract.test.mjs`, `test/http.test.mjs`, `package.json`, `README.md`, and `CODEMAP.md`.

## API

GET /health. POST /v1/extract {note,authorId?,date?} returns {extraction,method,warnings}. POST /v1/ingest additionally accepts idempotencyKey and returns applied plus effective idempotencyKey. Brain errors remain failures; uncertain outcomes include a stable retry key. Fixed loopback upstreams only, no redirects.

## Depends on

[[code/brain]] owns durable pages, atomic mutations and key/payload binding. [[code/river]] optionally serves 4704 extraction, currently unavailable with truthful 503. [[code/runtime]] owns persistent process startup. Shared contract/index.mjs supplies IDs, ports, synthetic date and demo note. No cross-lane imports other than contract.

## Gotchas

Strict deterministic baseline recognizes a completed visit and one explicit lisinopril change. It rejects historical, uncertain, negated, planned, refused or qualified changes, including qualifiers split across statements. Unknown contextual text around a medication change fails closed. Source-only notes can retain unrecognized text with warnings. Author is not an attendee. Relative due dates stay in source text. Original note is preserved verbatim.

No credentials or external APIs. INGEST_USE_RIVER=1 only enables loopback River; output must exactly match validated deterministic evidence or fall back honestly. No local success cache, so brain reset and restart stay authoritative. Request/read/response limits and upstream timeouts are bounded. All data is synthetic. Not medical advice.

## Milestone evidence

M1: 46 unit and HTTP tests pass. Exact demo extraction, scoped attendees, context/schedule/history rejection, upstream uncertainty, stable retry keys and optional model fallback covered. Runtime handover ready; no persistent development PID was started.
