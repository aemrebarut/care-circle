---
title: Sponsors procedure component
---

## Purpose

Capture and replay a synthetic prior-authorization procedure locally with deterministic tool traces and reviewable Memorable export assets. Prove official CLI local recall of a manual synthetic fixture, and prepare a separately gated one-request extraction runner. No remote extraction has been authorized or executed.

## Run

`npm --prefix services/sponsors/procedure test`

`node services/sponsors/procedure/export.mjs`

`npm --prefix services/sponsors/procedure run prepare:memorable` downloads the pinned package without install scripts; `npm --prefix services/sponsors/procedure run proof:memorable` proves isolated offline recall. Neither performs remote extraction.

The parent sponsor service owns HTTP health, reset and port 4705. This component opens no sockets.

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
- `services/sponsors/procedure/memorable-submit.mjs`: default-refusing one-request CLI and verified submission history status.
- `services/sponsors/procedure/submit.test.mjs`: fake-transport approval, cleanup, reflected-key rejection and history tests.

## API

Exports `capture({actorId?})`, `replay({procedureId?,actorId?})`, `getMemorablePayload({procedureId?})`, `reset()` and `getStatus()`. Errors carry `status` and `code`. Only stable Ana, Ben and Celia IDs are accepted. Default capture is Ana, default replay is Ben, and replay requires a distinct sibling.

## Depends on

Parent integration: [[code/sponsors]], read after initial creation. API and actor IDs: [[code/contract]], not yet present when checked; docs/CONTRACT.md was read fully. No cross-lane source imports or GBrain access. Node builtin APIs only.

Synthetic narrative from [[code/world]] is aligned to Demo Family Health Plan case DEMO-PA-2026-0918. The Sep27 rehearsal does not import world code or update its historical insurer call pages.

## Gotchas

Local simulation is Care Circle code, not Memorable extraction. In-memory captures reset on process restart. Trace evidence references owned synthetic fixture IDs, not GBrain page IDs. The public API export is unsubmitted and unvalidated remotely. No credential was read during implementation or tests. The service submission function always refuses. No doses, treatments or coverage recommendations are generated.

Official local recall proof uses manually seeded data and does not imply learned procedures. Downloaded package code stays ignored, unmodified and undistributed. The opt-in CLI can read a process credential only after a matching lead-owned contract/memorable-approval.json authorizes the exact one-shot request. It rejects redirects, oversized or malformed responses and key reflection, never retries, and never executes returned steps. Persistent attempt history is independent of current approval and is not reset by the demo. Unknown delivery is represented by null, not a false claim of no submission.

## Milestone

Initial capture/replay shipped as 086d651. Current 21 tests cover two reset-to-replay runs, source resolution, cloned responses, typed errors, exact payload integrity, permission-enforced official recall evidence, one-request gates, body cleanup, credential reflection and uncertainty after failed attempts. Official CLI 0.5.30 recall, show and list all passed with network, write and subprocess permissions denied. The request remains exactly 3189 bytes and SHA-256 994c84515254b5e26114a7249ef3bf56e106503ac1e21560fccd2ab620c0bf32. API mode stays local-simulation and no remote extraction has run.
