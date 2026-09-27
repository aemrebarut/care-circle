---
title: Sponsors procedure component
---

## Purpose

Capture and replay a synthetic prior-authorization procedure locally with deterministic tool traces and reviewable Memorable export assets. Prove official CLI local recall of a manual synthetic fixture, and prepare a separately gated one-request extraction runner. No remote extraction has been authorized or executed.

## Run

`npm --prefix services/sponsors/procedure test`

`node services/sponsors/procedure/export.mjs`

`npm --prefix services/sponsors/procedure run prepare:memorable` downloads the pinned package without install scripts; `npm --prefix services/sponsors/procedure run proof:memorable` proves isolated offline recall. Neither performs remote extraction.

`npm --prefix services/sponsors/procedure run proof:bridge` captures Ana in process, lets official local recall select the procedure ID, and replays that returned ID as Ben with trace-link verification. It does not mutate the running service.

The parent sponsor service owns HTTP health, reset and port 4705. The imported procedure API opens no listeners and makes no network requests. The standalone preparation CLI downloads the pinned package; the separate submission CLI requires explicit approval before its one remote request. The bridge's optional live mode uses only two existing loopback endpoints after a parent-granted runtime-safe window.

## Files

- `services/sponsors/procedure/index.mjs`: fixed local tools, capture registry, replay, evidence and status.
- `services/sponsors/procedure/fixtures.json`: synthetic administrative source cards.
- `services/sponsors/procedure/memorable-adapter.mjs`: documented payload mapping and fail-closed remote gate.
- `services/sponsors/procedure/export.mjs`: print the unsent review artifact.
- `services/sponsors/procedure/build-assets.mjs`: regenerate exact local review files without remote requests.
- `services/sponsors/procedure/test.mjs`: validation, deterministic repeatability, reset, distinct actors, evidence and submission gate tests.
- `services/sponsors/procedure/README.md`: run instructions and sponsor reality.
- `services/sponsors/procedure/assets/`: exact unsent request, byte/hash manifest, capture and replay evidence.
- `services/sponsors/procedure/prepare-memorable-local.mjs`: download and verify official package, never execute it.
- `services/sponsors/procedure/memorable-local-proof.mjs`: permission-enforced official local recall, show and list proof.
- `services/sponsors/procedure/memorable-local-runner.mjs`: shared pinned package checks, permission probe, capture serialization and official recall ID parsing.
- `services/sponsors/procedure/memorable-bridge.mjs`: standalone capture to official recall to Ben replay, offline by default.
- `services/sponsors/procedure/bridge.test.mjs`: exact selected-ID propagation, trace links, ambiguous recall refusal and fake loopback transport tests.
- `services/sponsors/procedure/memorable-submit.mjs`: default-refusing one-request CLI and verified submission history status.
- `services/sponsors/procedure/submit.test.mjs`: fake-transport approval, cleanup, reflected-key rejection and history tests.

## API

Exports `capture({actorId?})`, `replay({procedureId?,actorId?})`, `getMemorablePayload({procedureId?})`, `reset()` and `getStatus()`. Errors carry `status` and `code`. Only stable Ana, Ben and Celia IDs are accepted. Default capture is Ana, default replay is Ben, and replay requires a distinct sibling.

## Depends on

Parent integration: [[code/sponsors]], read after initial creation. API and actor IDs: [[code/contract]], successfully read after its initial absence; docs/CONTRACT.md was read fully. No cross-lane source imports or GBrain access. Node builtin APIs only.

Synthetic narrative from [[code/world]] is aligned to Demo Family Health Plan case DEMO-PA-2026-0918. The Sep27 rehearsal does not import world code or update its historical insurer call pages.

## Gotchas

Local simulation is Care Circle code, not Memorable extraction. In-memory captures reset on process restart. Trace evidence references owned synthetic fixture IDs, not GBrain page IDs. The public API export is unsubmitted and unvalidated remotely. No credential was read during implementation or tests. The service submission function always refuses. No doses, treatments or coverage recommendations are generated.

Official local recall proof uses manually seeded data and does not imply learned procedures. Downloaded package code stays ignored, unmodified and undistributed. The opt-in CLI can read a process credential only after a matching lead-owned contract/memorable-approval.json authorizes the exact one-shot request. It rejects redirects, oversized or malformed responses and key reflection, never retries, and never executes returned steps. Persistent attempt history is independent of current approval and is not reset by the demo. Unknown delivery is represented by null, not a false claim of no submission.

The bridge serializes the actual captured trace into the local row. Official recall selects the ID but Care Circle still performs the simulated replay. It does not learn a procedure through Memorable or alter core API/status behavior. No live capture or replay request may run during a QA window; live mode requires an explicitly granted parent/runtime window and does not reset anything.

## Milestone

Initial capture/replay shipped as 086d651; official recall and gated submission runner shipped as 275feb7. Current 29 tests also cover exact official-recall ID propagation to Ben replay, linked capture evidence, ambiguous results and fake-only live transports. The actual offline bridge passed and recorded assets/memorable-bridge-proof.json, with network, write and subprocess permissions denied to official CLI 0.5.30. The request remains exactly 3189 bytes and SHA-256 994c84515254b5e26114a7249ef3bf56e106503ac1e21560fccd2ab620c0bf32. API mode stays local-simulation; no remote extraction or live bridge invocation has run.
