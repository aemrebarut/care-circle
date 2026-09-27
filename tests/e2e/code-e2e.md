---
title: Independent end-to-end acceptance
---

## Purpose

Independent contract and demo acceptance for the synthetic Care Circle family. Owner cc-qa. Only `tests/e2e/` is owned by this lane. Reviewers report implementation fixes to component owners.

## Run

`node tests/e2e/acceptance.mjs --health-only` checks service readiness. `node tests/e2e/acceptance.mjs --read-only` checks current state without writes. `node tests/e2e/acceptance.mjs --full --cycles 2` uses runtime demo reset and performs two full synthetic demos. Coordinate shared-state mutations with cc-runtime first.

## Files

`tests/e2e/acceptance.mjs`: independent live HTTP assertions and JSON receipts. `tests/e2e/package.json`: commands. `tests/e2e/README.md`: coverage and limits. `tests/e2e/results/`: ignored run receipts. `tests/e2e/code-e2e.md`: source for this code map.

## API

Consumes health on 4700 through 4706 and the public contract endpoints through the web proxy, or direct service HTTP with `--direct`. Exposes no listener or service API. Calls only 127.0.0.1.

## Depends on

[[code/runtime]] for startup and demo-reset; [[code/web]] for proxies; [[code/brain]] for durable page state and source lookup; [[code/ingest]] for extraction and idempotent writes; [[code/brief]] for answers, contradictions and previsit; [[code/river]] for truthful training status; [[code/sponsors]] for local capture/replay and clinic fetch; [[code/world]] for synthetic source records.

## Gotchas

All lanes share main and live state. Only one lane may reset or ingest at a time. Tests do not own any PID or port. Allow GBrain CLI latency. Citation resolution does not itself prove source interpretation. Sponsor mode labels cannot substitute for actual execution evidence. No external submissions, secrets, cross-service imports, or plain gbrain commands. Freeze code at 16:40 Pacific.
