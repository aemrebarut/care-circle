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
