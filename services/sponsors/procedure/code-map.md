---
title: Sponsors procedure component
---

## Purpose

Capture and replay a synthetic prior-authorization procedure locally with deterministic tool traces and historical Memorable export assets. Prove official CLI local recall selecting Ben's simulated replay. Emre explicitly declined remote Memorable submission; its production CLI is unconditionally disabled and no remote extraction has run.

## Run

`npm --prefix services/sponsors/procedure test`

`node services/sponsors/procedure/export.mjs`

`npm --prefix services/sponsors/procedure run prepare:memorable` downloads the pinned package without install scripts; `npm --prefix services/sponsors/procedure run proof:memorable` proves isolated offline recall. Neither performs remote extraction.

`npm --prefix services/sponsors/procedure run proof:bridge` captures Ana in process, lets official local recall select the procedure ID, and replays that returned ID as Ben with trace-link verification. It does not mutate the running service.

The parent sponsor service owns HTTP health, reset and port 4705. The imported procedure API opens no listeners and makes no network requests. The standalone preparation CLI downloads the pinned package; the production submission CLI always refuses without accessing credentials. The bridge's optional live mode uses only two existing loopback endpoints within a parent-granted runtime-safe window.

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
- `services/sponsors/procedure/memorable-submit.mjs`: unconditional remote denial and historical receipt validation.
- `services/sponsors/procedure/offline-submission-test-support.mjs`: separate fake-transport test adapter with a fixed synthetic marker, no production credential provider.
- `services/sponsors/procedure/submit.test.mjs`: unconditional production denial, key-read trap and offline fake-response/history tests.

## API

Exports `capture({actorId?})`, `replay({procedureId?,actorId?})`, `getMemorablePayload({procedureId?})`, `reset()` and `getStatus()`. Errors carry `status` and `code`. Only stable Ana, Ben and Celia IDs are accepted. Default capture is Ana, default replay is Ben, and replay requires a distinct sibling.

## Depends on

Parent integration: [[code/sponsors]], read after initial creation. API and actor IDs: [[code/contract]], successfully read after its initial absence; docs/CONTRACT.md was read fully. No cross-lane source imports or GBrain access. Node builtin APIs only.

Synthetic narrative from [[code/world]] is aligned to Demo Family Health Plan case DEMO-PA-2026-0918. The Sep27 rehearsal does not import world code or update its historical insurer call pages.

## Gotchas

Local simulation is Care Circle code, not Memorable extraction. In-memory captures reset on process restart. Trace evidence references owned synthetic fixture IDs, not GBrain page IDs. The public API export is unsubmitted and unvalidated remotely. No credential was read during implementation or tests. The service submission function always refuses. No doses, treatments or coverage recommendations are generated.

Official local recall proof uses manually seeded data and does not imply learned procedures. Downloaded package code stays ignored, unmodified and undistributed. Remote Memorable submission is explicitly denied, not awaiting approval. The production transport and credential-reading path, approval template and operational upload instructions were removed. No credential, account or approval record is requested. Historical attempt validation remains separate from the denied decision; no remote attempt exists. The exact payload remains an unsent historical review artifact.

The bridge serializes the actual captured trace into the local row. Official recall selects the ID but Care Circle still performs the simulated replay. It does not learn a procedure through Memorable or alter core API/status behavior. No live capture or replay request may run during a QA window; live mode requires an explicitly granted parent/runtime window and does not reset anything.

## Milestone

Initial capture/replay shipped as 086d651; official recall shipped as 275feb7 and the offline bridge as b575a65. Current 32 tests add unconditional production denial with key-read traps and verify the exact parent live receipt. Parent ran one local-only bridge at 2026-09-27T22:36:09.277Z under cc-runtime-local-proofs-20260927-1535, then released the window. Two loopback POSTs passed; official recall selected the Ben replay ID and its capture trace matched. The 7568-byte live receipt was promoted unchanged with SHA-256 f5476befa70d48ffa2638f3a8aacf0f85c6a5091cb2a868cf5a3f5607fb85ef2. No live call was rerun during promotion. The historical request remains exactly 3189 bytes and SHA-256 994c84515254b5e26114a7249ef3bf56e106503ac1e21560fccd2ab620c0bf32. API mode stays local-simulation and remote submission is explicitly denied.
