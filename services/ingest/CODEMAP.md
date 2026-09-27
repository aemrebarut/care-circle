---
title: Care Circle ingest
type: page
tags: [code, ingest]
---
# Care Circle ingest

## Purpose

Turn supported synthetic visit notes into exact contract Extraction objects and submit verified, idempotent mutations to the real family brain. Preserve source wording, note authorship, event dates and explicit attendance. Never infer treatment instructions.

## Run

`node services/ingest/server.mjs` binds 127.0.0.1:4702. Persistent start is owned by runtime. `npm --prefix services/ingest test` runs unit and HTTP failure tests on reserved 4713. `node services/ingest/smoke.mjs` checks live health/extraction with no writes. `npm --prefix services/ingest run verify:commit` explicitly writes the canonical demo and retries it; coordinate the mutation window first.

## Files

`services/ingest/extract.mjs`, `server.mjs`, `smoke.mjs`, `verify-commit.mjs`, `verify-retry.mjs`, `REVIEW.md`, `evidence/`, `test/extract.test.mjs`, `test/http.test.mjs`, `package.json`, `README.md`, and `CODEMAP.md`.

## API

GET /health. POST /v1/extract {note,authorId?,date?} returns {extraction,method,warnings}. POST /v1/ingest additionally accepts idempotencyKey and returns applied plus effective idempotencyKey. Brain errors remain failures; uncertain outcomes include a stable retry key. Fixed loopback upstreams only, no redirects.

## Depends on

[[code/brain]] owns durable pages, atomic mutations and key/payload binding. [[code/river]] optionally serves 4704 extraction, currently unavailable with truthful 503. [[code/runtime]] owns persistent process startup. Shared contract/index.mjs supplies IDs, ports, synthetic date and demo note. No cross-lane imports other than contract.

## Gotchas

Strict deterministic baseline recognizes a completed visit and one explicit lisinopril change. It rejects historical, uncertain, negated, planned, refused or qualified changes, including qualifiers split across statements. Unknown contextual text around any structured claim fails closed. Source-only notes can retain unrecognized text with warnings. Author is not an attendee. Relative due dates stay in source text. Visits later than fixed demo as-of 2026-09-27 reject with 422 before upstream calls; future follow-up dates remain allowed. Original note is preserved verbatim.

No credentials or external APIs. INGEST_USE_RIVER=1 only enables loopback River; output must exactly match validated deterministic evidence or fall back honestly. No local success cache, so brain reset and restart stay authoritative. Request/read/response limits and upstream timeouts are bounded. All data is synthetic. Not medical advice.

## Milestone evidence

M1: 54 unit and HTTP tests pass. Exact demo extraction, scoped attendees, context/schedule/history rejection, upstream uncertainty, stable retry keys and optional model fallback covered. Runtime owns the live service; read-only smoke passed. Added JSON 408 for incomplete body uploads and split-qualifier guards for questions and follow-ups.


M1 live integration: runtime baseline survived a real GBrain restart, then the reserved canonical ingest and identical retry passed at revision 2 with visit visits/ingest-70c7a8a9face7c4158c7be49. Exactly one source visit and one new 20 mg claim; original 10 mg retained. Original note, author, attendance, pending potassium wording, question and citation all verified over HTTP. No reset performed. Mutation window released to runtime and QA with source intact for independent audit. Latest implementation commits: ab0b640, 48fa839, 291d739; verification script a6fbaeb.


M1 durability follow-up: runtime proved revision 2, 32 pages and 132 edges survived a second brain restart. `npm --prefix services/ingest run verify:retry` then returned the original canonical visit ID and revision with the same key/payload; exact before/after HTTP state remained equal. The canonical request and full retry response are retained under services/ingest/evidence/. The original full applied object was compared within the first run but only a summary was initially saved; the restart proof asserts identifiers, revision and unchanged state honestly. Final RELEASE sent to runtime/QA.


Optional replay metadata: accepted source-equal River responses retain validated cached-replay provenance, including liveInference false and exact input digest. Preview and save label the saved prediction explicitly. Invalid provenance or unsupported inferred due dates fall back deterministically. The observed first trained demo prediction invented a dueDate and remains rejected; no grammar or fact gate was weakened.
