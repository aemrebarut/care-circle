# Static world review receipt

Date: 2026-09-27. Reviewer: cc-world-review in Herdr session carecircle, pane w1:pC. Model: gpt-6-astra, reasoning xhigh. Reviewed world commit: d3c5a0b.

Scope: read-only review of `build.mjs`, `seed.json`, all 30 generated pages, README, and `code/world`. This review covers source framing and record coherence, not clinical validity or suitability for patient care. No real patient information was used.

## Findings resolved before seed commit

- WR-001, medium: lab numeric result provenance originally pointed to ordering or collection visits lacking the value. Lab pages now explicitly represent original synthetic reports, use their own ID as `sourceId`, and separately record `associatedVisitId`. Smoke requires the result source to contain the exact name, value, unit, and date.
- WR-002, low: the September 10 A1c page inherited September 16 wording. Every lab now says that its result predates the September 27 demo note without borrowing another result's date.
- WR-003, low: Rose's children were initially named `siblingIds` in patient metadata. The field is now `childIds`; the three adults are siblings to one another, and their person pages identify their relationship to Rose.

## Verified results

The reviewer reported a clean recheck with no remaining findings in the static world scope. `npm test --prefix packages/world` passed: 30 pages, 120 resolvable links, 21 exact medication source citations, source dates and attendees, metadata parity, baseline agreement, and synthetic/non-advice framing. Independent read-only checks and `node --check packages/world/build.mjs` also passed.

The review verified required entity counts; lisinopril recorded as 10 mg daily in baseline visit and pharmacy claims; the September 27 event absent from the seed; amlodipine 2.5 to 5 mg as historical change with a matching current pharmacy entry; lab values without clinical interpretation; and sequential insurer claims that never imply authorization or guaranteed coverage.

No service was started, product brain opened, credential accessed, external submission made, or sponsor execution claimed by this review. Import, mutation, reset, and restart verification remain the brain and integration lanes' responsibility.

## M1 live import audit by cc-world

At 15:12 Pacific, cc-world independently verified the imported world through `http://127.0.0.1:4701` using only GET requests. Brain revision 1 served all 30 seed page IDs through encoded page lookup. All 21 seed medication quotations appeared verbatim in the served source bodies, and all 21 citations returned by the medication API also resolved to exact source text. All 120 served graph edges had existing source and target pages. Seven recorded medications were returned.

Result: PASS. This check read `/health`, `/v1/state`, `/v1/pages/:encodedId`, `/v1/medications`, and `/v1/graph`. It performed no reset, ingest, database access, process start, or service mutation. It demonstrates live import and citation fidelity; it does not claim restart or end-to-end ingest verification.
