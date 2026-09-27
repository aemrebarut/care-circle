# Care Circle ingest

A conservative parser for synthetic after-visit notes, with committed writes through the real brain service. This service organizes source claims. It never recommends doses or treatment. All demo people, providers and records are synthetic.

Not medical advice

## Run

```sh
node services/ingest/server.mjs
npm --prefix services/ingest test
node services/ingest/smoke.mjs
```

The server binds only `127.0.0.1:4702`. Runtime owns the persistent process. No packages or credentials are required. `npm test` starts short-lived test servers only on reserved port 4713 and mocks upstream responses in memory. The smoke script checks live health and extraction without writing to brain.

For a coordinated live write check, run `npm --prefix services/ingest run verify:commit`. It submits the exact synthetic demo note and an identical retry, then checks the durable source, author, attendance, question, source citation and preserved 10 mg claim over HTTP. It performs no reset. Coordinate the shared mutation window with runtime and QA before running it. It saves full responses in `evidence/latest-commit.json`. The dedicated `npm --prefix services/ingest run verify:retry` replays the preserved first-demo key after a coordinated brain restart, checks original visit/revision and exact unchanged state, and writes `evidence/restart-retry.json`.

## API

- `GET /health`: service liveness and whether optional River attempts are enabled.
- `POST /v1/extract`: `{note,authorId?,date?}` returns `{extraction,method,warnings}` without mutation.
- `POST /v1/ingest`: `{note,authorId?,date?,idempotencyKey?}` returns the same extraction plus a verified brain `applied` receipt and `idempotencyKey`.

Use `Content-Type: application/json`. Event dates must be valid `YYYY-MM-DD`. Default note author is Ana; default date is the fixed synthetic demo date `2026-09-27`, both disclosed in warnings. Visit dates after this fixed as-of date return 422 before any upstream call; future follow-up due dates are allowed. These defaults do not invent visit attendance. All original source text, including whitespace, is preserved in `visit.summary` and the brain `note` payload. Explicit attendees come only from the completed visit opening.

The supported demo note is:

> Cardiology today with Ana. Dr. Chen increased lisinopril to 20 mg daily. Wants potassium rechecked before nephrology Tuesday. Ask the nephrologist about the potassium recheck.

The baseline supports one explicit completed specialty visit opening and one affirmative completed lisinopril change with a single dose in mg and a complete supported frequency. It rejects intent, refusal, negation, uncertainty, historical changes, competing doses, unsupported schedule suffixes, cancelled visits, and unknown qualifying text around any structured claim. Other source-only visits can preserve unrecognized text with warnings. Unsupported clinical facts never become invented changes. This is a deliberately limited grammar, not a general medical language model.

Questions keep their source statement. Potassium follow-ups require explicit request wording. Relative wording such as Tuesday is preserved without inventing a due date. An explicit supported `on` or `by` calendar date may become `dueDate`. Changes attributed to another specialist require separate review.

## Durable writes and failures

All mutation goes through loopback HTTP to brain `127.0.0.1:4701/v1/ingest`. Brain validates known IDs and binds idempotency keys to canonical payloads. Ingest never imports brain code, opens GBrain storage, or caches successful writes locally. This preserves reset behavior.

Without a supplied key, ingest derives a stable SHA-256 key from the exact note, effective author and event date. Repeat the same key and same source to recover a timed-out or disconnected attempt. The error response includes the key and an `outcome` of `unknown` when a commit may have happened. A changed payload using an existing key receives HTTP 409. Success is returned only after a valid brain commit receipt.

Request bodies are bounded to 64 KiB, notes to 12000 characters, and upstream bodies to 1 MiB. Request reads have a 10-second bound, brain calls a 90-second bound and optional River calls a 2.5-second bound. Redirects are forbidden. Errors use `{error:{code,message,...}}`, including 400 invalid input, 408 incomplete request, 413 oversized bodies, 415 unsupported media, 422 unsupported note, and 502/504 unconfirmed upstream results.

## River reality

Default extraction is deterministic. No River training, remote inference, SDK execution or external submission occurs here. Optional `INGEST_USE_RIVER=1` enables calls only to local `127.0.0.1:4704/v1/extract`. River receives the exact note plus effective author and date. The deterministic source validator runs first, and model output must exactly match its Extraction before it is eligible for `method: "river"`. Malformed, unavailable, unsupported or differing output falls back with an explicit warning and `method: "deterministic"`. Schema-valid model output cannot bypass source evidence checks. A response is eligible for method river only for the exact canonical demo note, author and date, and only with complete cached-replay provenance. Ingest validates the mode, false liveInference flag, bounded metadata, digests and exact input digest before preserving it in preview and save responses. An explicit saved-prediction warning always accompanies that provenance. Invalid provenance triggers deterministic fallback.

## Files

- `extract.mjs`: input checks, narrow source parser, stable key derivation.
- `server.mjs`: HTTP boundary, bounded upstream calls and verified commit receipts.
- `smoke.mjs`: read-only live check.
- `verify-commit.mjs`: explicit coordinated demo write and idempotent retry check.
- `REVIEW.md`: independent review findings and bounded verification evidence.
- `test/`: source ambiguity, attribution, HTTP and failure-path tests.
- `CODEMAP.md`: source for the `code/ingest` devbrain page.
