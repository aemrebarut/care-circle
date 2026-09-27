# Review findings

All reproductions below use synthetic in-memory inputs. No shared service state was mutated. Findings describe the observed implementation snapshot; owner fixes require a separate verification entry.

## R1: Intent and refusal become confirmed medication changes

Priority P1. Owner cc-ingest. Fixed and directly reverified at 15:00 Pacific.

services/ingest/extract.mjs initially accepted both `Cardiology today with Ana. Dr. Chen plans to increase lisinopril to 20 mg daily.` and the same sentence with `declined to increase`. Both produced a confirmed 20 mg daily medication change. The affirmative happy path passed and `did not increase` correctly rejected. Require affirmative completed-change grammar or conservative rejection of unsupported statements.

Evidence: direct pure extractDeterministic import, no HTTP or writes.

## R2: Dose-only citation can quote the wrong medication

Priority P1. Owner cc-brief. Fixed and directly reverified at 15:00 Pacific.

services/brief/domain.mjs sourceClaims initially passed only claim.dose to citation(). A synthetic pharmacy source with separate `Metformin: the pharmacy record lists 500 mg twice daily.` and `Acetaminophen: the pharmacy record lists 500 mg once daily as needed for pain.` lines returned the metformin line for a 500 mg acetaminophen claim. The generated world has this shared-dose pattern. Medication change citations used the same dose-only hint. Match medication identity and regimen against actual source text.

Evidence: direct citation() import and source inspection of packages/world/build.mjs.

## R3: Later matching visit hides unresolved earlier discrepancy

Priority P1. Owner cc-brief. Fixed and directly reverified at 15:00 Pacific; contract clarified by cc-lead in c483ce5.

services/brief/domain.mjs initially retained only latest visit and pharmacy claims. A fixture with pharmacy 10 mg on September 24, visit 20 mg on September 25, and visit 10 mg on September 27 returned no contradiction. Lead confirmed the invariant: each pharmacy claim compares with the latest visit at or before its date and every subsequent visit. Unequal pairs persist even when a later visit matches. Older visit-only history before that baseline is excluded. Label an earlier unresolved discrepancy honestly.

Required owner regression: pharmacy 10 mg on September 22, visit 20 mg on September 23, later visit 10 mg on September 27 remains unresolved and cites the earlier unequal pair.

Evidence: direct buildContradictions() import on an in-memory graph; no shared mutation. QA and owner notified.

## R4: Schedule qualifiers are silently removed

Priority P1. Owner cc-ingest. Original same-statement cases fixed and directly reverified at 15:00 Pacific. See R7 for a separate cross-clause residual.

The initial extractor returned frequency daily for explicit changes ending `daily as needed`, `daily for three days`, or `daily or every other day`. This loses as-needed use, duration, or ambiguity while creating a confirmed claim. Preserve the complete supported source schedule or reject the unsupported statement without creating a simplified claim.

Evidence: independent Astra xhigh subreviewer pure extractDeterministic imports.

## R5: Historical medication events become current visit changes

Priority P1. Owner cc-ingest. Fixed and directly reverified at 15:00 Pacific.

After the opening `Cardiology today with Ana.`, `On 2026-09-01 Dr. Chen increased lisinopril to 20 mg daily.` became a September 27 change. `Last week the nephrologist increased...` similarly became a current cardiology change. The source history must not be asserted as a new event today.

Evidence: independent Astra xhigh subreviewer pure extractDeterministic imports.

## R6: Visit and attendee provenance are over-inferred

Priority P2. Owner cc-ingest. Fixed and directly reverified at 15:01 Pacific, including valid multi-attendee controls.

The initial extractor accepted cancelled cardiology appointments and requested referrals as completed visits. It also looked for attendance across all note statements: `Cardiology today with Ana. Nephrology next Tuesday with Ben.` added Ben to today's visit, and `Cardiology today. I spoke with Celia afterward.` added Celia. Explicit `Cardiology today with Ana and Ben.` is a valid positive control.

Evidence: independent Astra xhigh subreviewer pure extractDeterministic imports.

## R7: Detached qualifier or correction does not block a change

Priority P1. Owner cc-ingest. Open, reported 15:01 Pacific.

The anchored medication grammar fixes R1, R4 and R5 within a statement, but the note splitter separates semicolon and newline clauses first. `Cardiology today with Ana. Dr. Chen increased lisinopril to 20 mg daily; as needed.` and a newline before `as needed` still produce a confirmed daily claim. A following `Correction: that did not happen.` also leaves the claim intact. Check context outside the matched medication sentence and fail closed for unconsumed qualifiers or corrections.

Evidence: independent pure-function regression after the 31-test owner suite passed. No service or storage mutation.

## R8: Interrupted runtime operation can strand its lock

Priority P2. Owner cc-runtime. Open, reported 15:00 Pacific.

Initial packages/runtime/lifecycle.mjs retried an existing operation.lock without verifying the owner. Cleanup lived only in async finally, with no CLI signal handling. Process interruption could leave start, stop and reset permanently timing out. Recovery must verify that the recorded owner is dead and must never delete a lock held by a live unknown process.

Evidence: independent static control-flow review. No lifecycle interruption test was run against shared services.

## R9: Missing River output counted as valid JSON

Priority P2. Owner cc-river. Owner reports fix; independent reverification pending.

Initial eval.mjs classified absent output as jsonValid true. A pure score call with one synthetic gold record and zero predictions yielded predictions 0 and JSON validity 1.0. Schema and exactness metrics still failed. Missing or failed transport results must not count as parsed model JSON.

Evidence: independent pure score() reproduction. No external request or training run.

## Fix verification evidence

At 15:00, `node --test services/ingest/test/extract.test.mjs` passed 31 of 31 tests, including the exact demo and all original intent/refusal, suffix, historical, cancelled/referral cases. Independent checks also passed attendance negatives and two/three-attendee positives.

Direct brief assertions passed: same-dose acetaminophen quote selects the correct source line; the lead's pharmacy10 / visit20 / later visit10 regression preserves both original sources and uses temporalStatus past-discrepancy-unreconciled; an old visit5 / latest visit10 / pharmacy10 control returns no contradiction.

## Positive observations

- River's initial server honestly returns RIVER_UNAVAILABLE with status 503, deterministic status, extractionAvailable false, and null model metrics.
- Sponsor initial README explicitly identifies local simulation and local HTTP fetching without claiming live Memorable/UFO execution.
- Current contract now explicitly separates recorded dose, actual use, and unresolved discrepancies.

These observations do not establish end-to-end acceptance, training success, or durable persistence. Those gates remain pending.
