---
title: River corpus, training, evaluation and local status
---

## Purpose

Prepare synthetic note extraction examples, run an explicitly authorized River SFT experiment, and report measured results without inventing a trained-model success. Local API remains available without credentials.

## Run

`node services/river/server.mjs` binds 127.0.0.1:4704. Runtime owns the persistent process. `npm --prefix services/river test` checks evaluation and API status; `node services/river/smoke.mjs` checks the running API. Training is a separate opt-in Python runner.

## Files

`server.mjs`, `smoke.mjs`, `test/`, `eval.mjs`, `eval-local.mjs`, `generate-dataset.mjs`, `dataset/`, `training/`, `results/`, `review/`, `requirements.txt`, `README.md`.

## API

GET /health returns ok and service river. GET /v1/status reports mode deterministic, trainingStatus, corpus, externalSubmissionAuthorized true, measured metrics or null, and limitations. POST /v1/extract returns 503 while live River extraction is unavailable. It never silently pretends deterministic output came from River.

## Depends on

[[code/ingest]] provides a conservative loopback baseline on 4702. [[code/runtime]] owns process startup and health smoke. [[code/world]] defines synthetic medication, doctor and sibling IDs. [[code/web]] presents sponsor reality. Contract is docs/CONTRACT.md; no cross-lane imports or family brain access.

## Gotchas

Training startup is never coupled to service startup. Only the named authorized River key may be loaded by the explicit runner. Dataset train/dev/test groups must remain disjoint, and test gold must never become model input. Missing predictions and failed transport count as failures. Base and trained comparisons require the same frozen prompt and held-out IDs. Synthetic template scores are not clinical validation. No live extractor is claimed until independently verified.

## Milestone evidence

Active v2 has 480 unique notes split 336/72/72, with zero template family, case or observable entity-group overlap. Independent corpus and exact token-payload audit passed. Frozen payload SHA256 is 039f2af01c6a1dc265dd5e6e1a3c0cc5c40a6e2e9406aad48ba9f7c4b74e884b. Actual River SFT and paired evaluation completed at 15:12:32 Pacific: 21 steps, 72 base and 72 trained predictions. Independently audited full-task exact success is 71/72 trained and 0/72 base under identical raw completion prompts and 1024-token budget. Base returned extra text and 54 responses hit the cap, so this is not a general capability or clinical accuracy claim. The test has six wording families. Full receipts and audit were pushed in f77cf20.

Two later exact-demo samples failed: an invented due date, then invalid JSON under a distinct product-only prompt. Both unchanged raw outputs and receipts are preserved. No live or cached model extraction is served, no safety gate was weakened, and no further remote calls are planned. The unshipped cache branch was removed. Local deterministic benchmark rejected all 72 broader held-out notes with HTTP 422; those are explicit conservative refusals. Runtime owns 4704. HTTP fixtures use reserved 4714. Fixed demo date rejects future visits, while future follow-ups are allowed.

### 15:35 milestone

No new inference or training. All River paths are committed through a7ae036; the audited experiment and both rejected demo attempts are preserved. Runtime is applying the queued source refresh in its exclusive maintenance window. The River lane is read-only and will verify health, status, and safe extraction refusal after handoff.

Refresh verified after runtime handoff: River PID 15568 served healthy status and safe 503 extraction. Live status shows completed training, audited 71/72 full-task success, extractionMode unavailable, replay null, and both rejected demo attempts. No further remote calls or shared-state mutations.
