---
title: Independent end-to-end acceptance
---

## Purpose

Independent contract and demo acceptance for the synthetic Care Circle family. Owner cc-qa. Only `tests/e2e/` is owned by this lane. Reviewers report implementation fixes to component owners.

## Run

`node tests/e2e/acceptance.mjs --health-only` checks service readiness. `node tests/e2e/acceptance.mjs --read-only` checks current state without writes. `node tests/e2e/acceptance.mjs --full --cycles 2` uses runtime demo reset and performs two full synthetic demos. Coordinate shared-state mutations with cc-runtime first.

## Files

`tests/e2e/acceptance.mjs`: independent live HTTP assertions and JSON receipts. `tests/e2e/package.json`: commands. `tests/e2e/README.md`: coverage and limits. `tests/e2e/ACCEPTANCE.md`: milestone evidence and findings. `tests/e2e/results/`: ignored run and browser receipts. `tests/e2e/code-e2e.md`: source for code/qa.

`tests/e2e/RIVER_AUDIT.md`: independent offline paired-artifact audit, reproduced scores and interpretation limits.

## API

Consumes health on 4700 through 4706 and the public contract endpoints through the web proxy, or direct service HTTP with `--direct`. Exposes no listener or service API. Calls only 127.0.0.1.

## Depends on

[[code/runtime]] for startup and demo-reset; [[code/web]] for proxies; [[code/brain]] for durable page state and source lookup; [[code/ingest]] for extraction and idempotent writes; [[code/brief]] for answers, contradictions and previsit; [[code/river]] for truthful training status; [[code/sponsors]] for local capture/replay and clinic fetch; [[code/world]] for synthetic source records.

## Gotchas

All lanes share main and live state. Only one lane may reset or ingest at a time. Tests do not own any PID or port. Allow GBrain CLI latency. Citation resolution does not itself prove source interpretation. Sponsor mode labels cannot substitute for actual execution evidence. No external submissions, secrets, cross-service imports, or plain gbrain commands. Freeze code at 16:40 Pacific.

## Milestone evidence

Initial runner commit 778b1a0, syntax passes. Temporal controls and stricter evidence checks added after independent Astra xhigh review. Every service dependency code page has now been read. Independent GET/extract probes and real clinic browser rendering pass. Full reset-to-demo and family UI remain pending brain initialization plus runtime-granted mutation access.

M1 at 15:15: independent health 7/7 passes. Runtime baseline persistence and ingest first-write/retry are owner-reported passes; post-ingest restart/ledger proof precedes QA mutation handoff. Actual isolated Chromium unavailable-state screenshots and local clinic browser evidence are recorded under ignored results/ui. Ambiguous writes halt further mutation. Full HTTP and successful family UI flows are not yet claimed.

15:18: first full independent web-proxy acceptance passes 32/32, including preserved historical discrepancy, two resets, source/date safeguards, fresh concurrent idempotency and complete demo. Stable-revision source reviewer separately passed 44 citation pairs, 14 regimens and four doctor records. Clean baseline restored at revision 9 and explicitly released before browser handoff. Future runs preserve state after the first failure. Cached River replay checks require exact-input provenance and explicit no-live-inference warning. Real browser PDF verification and final consecutive cycles remain pending.

M2 at 15:35: real desktop/mobile UI flow passed except a print content omission. One A4 PDF page is proven; web fix 45a2295 adds omitted pharmacy/visit claim values and awaits reprint. State revision 10 was preserved on explicit RELEASE. Independent River payload, token, split and paired-score audit passes; final demo is deterministic/503 because both actual demo samples failed validation and cache support was removed. Runner enforces final mode, superseding the earlier conditional cache checks. Runtime maintenance, read-only reprint, sponsor proof and two consecutive full cycles are next.
