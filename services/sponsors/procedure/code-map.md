---
title: Sponsors procedure component
---

## Purpose

Capture and replay a synthetic prior-authorization procedure locally with deterministic tool traces and reviewable Memorable export assets. All execution is labeled simulation and no external submission runs.

## Run

`npm --prefix services/sponsors/procedure test`

`node services/sponsors/procedure/export.mjs`

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

## API

Exports `capture({actorId?})`, `replay({procedureId?,actorId?})`, `getMemorablePayload({procedureId?})`, `reset()` and `getStatus()`. Errors carry `status` and `code`. Only stable Ana, Ben and Celia IDs are accepted. Default capture is Ana, default replay is Ben, and replay requires a distinct sibling.

## Depends on

Parent integration: [[code/sponsors]], read after initial creation. API and actor IDs: [[code/contract]], not yet present when checked; docs/CONTRACT.md was read fully. No cross-lane source imports or GBrain access. Node builtin APIs only.

Synthetic narrative from [[code/world]] is aligned to Demo Family Health Plan case DEMO-PA-2026-0918. The Sep27 rehearsal does not import world code or update its historical insurer call pages.

## Gotchas

Local simulation is Care Circle code, not Memorable extraction. In-memory captures reset on process restart. Trace evidence references owned synthetic fixture IDs, not GBrain page IDs. The public API export is unsubmitted and unvalidated remotely. `MEMORABLE_API_KEY` is named only; credentials are never read. The real submission gate always refuses. No doses, treatments or coverage recommendations are generated.

## Milestone

Initial implementation complete with deterministic Ana capture, Ben replay, strict input validation, reset and immutable returned evidence. Ten tests cover two reset-to-replay runs, source resolution, cloned responses, typed errors, fail-closed submission and exact committed payload integrity. Exact request byte count and SHA-256 are tracked in assets/manifest.json. Sponsor integration remains local-export-only.
