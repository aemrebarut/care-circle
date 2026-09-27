# QA acceptance log

Owner: cc-qa. All evidence refers to synthetic local data. This log separates source review, owner-reported tests, and independent live execution.

## Initial implementation, 15:08 Pacific

Committed runner: `778b1a0`. `node --check tests/e2e/acceptance.mjs` passes. First health receipt at 15:00 had no services available. The 15:04 receipt has four healthy endpoints: ingest, River, sponsors and clinic. Runtime reports six of seven ready, with real GBrain initialization and restart pending. No full acceptance or browser family demo is claimed yet.

Additional tests in progress cover preserved historical pharmacy discrepancies, exact source claims, fresh-key concurrent ingest, future-date rejection and future follow-up acceptance. The runner uses direct health and the same web proxy routes used by the UI. Only runtime owns live processes.

## Findings routed to owners

| ID | Finding | Resolution evidence |
| --- | --- | --- |
| H1 | A later agreeing visit dropped an earlier pharmacy discrepancy. | Brief owner added persistent unresolved evidence and focused tests. Independent live regression pending. |
| H2 | Unchanged visit claims appeared as medication changes. | Brief owner now uses explicit visit medicationChanges. Independent exact changed-set check pending. |
| H3 | Missing River predictions counted as valid JSON. | Owner reports 13 tests passing, including 8 independent regression checks. Source now marks missing/null transport output unavailable. Live metric provenance check pending. |
| H4 | Durable ownership regex rejected the real pharmacy/ seed slug on restart. | Brain owner fixed prefix and reports actual 30-page seed roundtrip plus recovery tests, 25 passing. Native GBrain restart pending. |

## Independent live observations

The HTTP reviewer used only GET and nonmutating extract calls. The canonical demo with Ben as uploader preserved Ana as attendee and returned 20 mg daily. Supported daily and twice-daily controls worked; 14 qualified or historical variations returned 422. No unsafe schedule truncation was observed. River status reported deterministic mode, prepared corpus, extraction unavailable, and null paired metrics. Sponsor status reported local simulation and local HTTP fetch.

Native Chrome rendered the local clinic at `http://127.0.0.1:4706/` at 2026-09-27T22:06:04.933Z. The UI reviewer observed fictional clinic and pharmacy names, hours, phones, synthetic notice and exact Not medical advice footer through accessibility and two visually inspected screenshots. Ignored receipt: `tests/e2e/results/ui/clinic-browser-observation.json`. Ignored page snapshot: `tests/e2e/results/ui/clinic-browser-snapshot.txt`. This proves local browser rendering only; official UFO execution remains false.

## Limits and next gate

Full live reset/ingest acceptance requires an exclusive mutation window from cc-runtime after brain startup and restart. Family UI interactions will follow HTTP acceptance in a separate window. Score arithmetic and status provenance do not themselves prove a remote training or serving run; the River lane supplies artifact-level evidence. Source review is not a substitute for these live checks.
