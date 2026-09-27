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

Priority P1. Owner cc-ingest. Fixed and independently reverified at 15:04 Pacific.

The anchored medication grammar fixes R1, R4 and R5 within a statement, but the note splitter separates semicolon and newline clauses first. `Cardiology today with Ana. Dr. Chen increased lisinopril to 20 mg daily; as needed.` and a newline before `as needed` still produce a confirmed daily claim. A following `Correction: that did not happen.` also leaves the claim intact. Check context outside the matched medication sentence and fail closed for unconsumed qualifiers or corrections.

Evidence: independent pure-function regression after the 31-test owner suite passed. No service or storage mutation.

## R8: Interrupted runtime operation can strand its lock

Priority P2. Owner cc-runtime. Closed after direct follow-up source review at 15:16 Pacific. The first fix resolved interruption cleanup but the initial static closure was too broad; the live-unknown edge was reopened and then fixed.

Initial packages/runtime/lifecycle.mjs retried an existing operation.lock without verifying the owner. Cleanup lived only in async finally, with no CLI signal handling. Process interruption could leave start, stop and reset permanently timing out. Recovery must verify that the recorded owner is dead and must never delete a lock held by a live unknown process.

Evidence: independent static control-flow review. No lifecycle interruption test was run against shared services.

Follow-up evidence: recoverDeadLock accepted any nonempty identity and treated any inequality with current process identity as death. A live PID with saved identity unknown was therefore reclaimed. The existing fixture explicitly expected recovery with process.pid and an arbitrary previous identity string. The owner was asked to recover only when the PID is absent, or when validated immutable birth identity proves a different incarnation. Malformed identity and same-birth command changes must fail closed.

Final fix: both recovery checks now require processIdentity(pid) to return null. Every live PID fails closed, including reused PIDs and unknown identities. Direct review confirmed the two checks and added malformed/same-birth owner tests. cc-runtime reported 17/17 lifecycle tests passing, with a truly exited owner fixture replacing the misleading live mismatch fixture.

## R9: Missing River output counted as valid JSON

Priority P2. Owner cc-river. Fixed and directly reverified at 15:04 Pacific. Missing output and null transport result receive no JSON-valid credit; literal model text null receives JSON-valid credit but fails schema validation.

Initial eval.mjs classified absent output as jsonValid true. A pure score call with one synthetic gold record and zero predictions yielded predictions 0 and JSON validity 1.0. Schema and exactness metrics still failed. Missing or failed transport results must not count as parsed model JSON.

Evidence: independent pure score() reproduction. No external request or training run.

## Fix verification evidence

At 15:00, `node --test services/ingest/test/extract.test.mjs` passed 31 of 31 tests, including the exact demo and all original intent/refusal, suffix, historical, cancelled/referral cases. Independent checks also passed attendance negatives and two/three-attendee positives.

Direct brief assertions passed: same-dose acetaminophen quote selects the correct source line; the lead's pharmacy10 / visit20 / later visit10 regression preserves both original sources and uses temporalStatus past-discrepancy-unreconciled; an old visit5 / latest visit10 / pharmacy10 control returns no contradiction.

At 15:04, the independent extractor recheck passed 40 pure unit tests and 24 additional in-memory assertions. R7 semicolon/newline qualifiers and correction cases now reject, while the complete demo extraction is unchanged. The owner subsequently reported a 52-test extraction/HTTP suite after additional request handling hardening. That larger total is owner-reported rather than a reviewer execution receipt.

## R10: Paired evaluation verifier accepts incompatible run metadata

Priority P2. Owner cc-river. Fixed and independently reverified at 15:12 Pacific.

The initial compare() verifier accepted paired true with base temperature 0, seed 1 and trained temperature 1, seed 99, plus a trained checkpoint different from the protocol. Prompt/input hashes alone did not validate generation settings and checkpoint provenance. The training runner itself uses matching settings; this finding concerns the verifier and is not evidence that an actual model run was mismatched.

Evidence: independent pure comparison with fabricated review-only rows and matching input hashes. No held-out data was submitted or altered.

## R11: Training protocol handoff and evaluation CLI disagree

Priority P2. Owner cc-river. Fixed by producer/consumer inspection at 15:12 Pacific. The emitted protocol now has required split, prompt and generation hashes and is updated with the saved checkpoint.

The initial training runner wrote a payload-manifest-shaped protocol.json, while eval.mjs expected top-level testSha256, promptSha256 and trainedCheckpoint fields. No emitted conversion was present at that snapshot. The advertised CLI path needs a compatible protocol artifact and an offline handoff test.

Evidence: independent static producer/consumer inspection. Training was not invoked.

## R12: Future visit changes current dose and source chronology diverges

Priority P1 for future-date inconsistency, P2 for stale doctor prose. Owner cc-brain, with extraction guard owned by cc-ingest. Fixed and directly reverified at 15:09 Pacific; contract resolved in f2c881a.

A direct in-memory brain ingestion dated October 1 produced lisinopril dose 20 mg in medications(), although the demo as-of date is September 27 and brief excludes future claims. It also updated doctor.fields.lastVisitDate to October 1 while the doctor body still said September 23.

Lead decision: reject future visits with 422 before mutation at extraction and brain boundaries. Future follow-up due dates remain valid. A doctor's lastVisitDate body text must stay consistent with fields and cite the causing visit. QA received regression requirements; reviewer will verify owner code directly.

Evidence: applyIngest() with a cloned synthetic seed, followed by medications() and doctor page inspection. No shared GBrain or HTTP mutation.

Fix evidence: explicit and requested future dates reject with 422 in extraction; direct brain applyIngest rejects with byte-identical input state. A September 27 visit with October 1 follow-up succeeds. Doctor displayed date equals the field and cites the causing visit. Brain domain tests passed 18 of 18.

## R13: Printable warnings and past discrepancy labels

Priority P2. Owner cc-web. Fixed by direct code inspection at 15:08 Pacific.

Initial renderBrief omitted brief.warnings, losing record-gap caveats in the printable view. Medication rows always used Sources disagree even when temporalStatus was past-discrepancy-unreconciled and the latest records agreed. Preserve warnings in the print artifact and distinguish an earlier unresolved discrepancy.

Static UI review otherwise found stable same-page retry keys, disabled editing while saving, success receipt checks, text-node source rendering and truthful local sponsor labels. Pending-key persistence across browser reload was suggested as resilience improvement, not a release blocker.

The fix adds a print-visible Record limitations section and the Earlier discrepancy unresolved label. Pending-save payload and key now survive browser-session reload, clear after confirmed save or explicit edit, and restore for review before retry. Proxy validation preserves safe idempotency, outcome and retryability metadata.

## Positive observations

- River's initial server honestly returns RIVER_UNAVAILABLE with status 503, deterministic status, extractionAvailable false, and null model metrics.
- Sponsor initial README explicitly identifies local simulation and local HTTP fetching without claiming live Memorable/UFO execution.
- Current contract now explicitly separates recorded dose, actual use, and unresolved discrepancies.

These initial observations alone do not establish end-to-end acceptance, training success, or durable persistence. Later evidence is recorded in milestones.md.

## R14: Replay cache does not verify its claimed sample provenance

Priority P2. Owner cc-river. Prototype withdrawn at 15:29 Pacific; no production replay was enabled. The receipt-binding requirement remains a gate for any later implementation.

services/river/demo-cache.mjs checks exact input, model, checkpoint and source facts, but only requires truthy requestId, promptSha256 and sampledAt. An independent in-memory fixture with a handwritten expected extraction and values not-a-river-request, not-a-hash and not-a-date is accepted and labeled an actual trained prediction. Bind the published cache to the unchanged archived raw output and completed sample receipt, validate all contract provenance fields, and retain the actual product prompt hash separately from the frozen benchmark prompt.

This is a provenance-verification gap, not evidence that a fabricated sample was served. The production demo cache was absent. The real first attempt is archived and correctly rejected because it inferred dueDate 2026-09-30. Its raw output must remain unchanged. A bounded second product-only prompt attempt is separately approved and does not alter benchmark metrics.

Ingest now requires complete cached-replay provenance, liveInference false and an exact canonical input hash, then preserves those fields in preview and save responses. Web renders the distinction and provenance. Direct inspection confirms the source-equality gate remains intact. Metadata shape validation in ingest does not replace the River owner's actual receipt binding.

## R15: Import preflight accepts malformed ownership and queue metadata

Priority P2. Owner cc-brain. Fixed and independently reverified in e171089 at 15:28 Pacific.

The new managed-import quiescence gate in services/brain/gbrain.mjs converts counters with Number(). Null, false and empty-string counters therefore pass as zero. Its host ownership check also accepts both host_id and owner_host_id being absent because their undefined values compare equal. Pure injected fixtures reproduced both paths, including reaching write-through/import without established host identity. Require explicitly valid zero counters and nonempty matching host identifiers before allowing import.

No installed CLI failure is alleged. The normal recovery ordering is sound: the default-source database barrier precedes the managed-worktree quiescence check and snapshot read. Nonzero pending states remain unavailable. Effective-root realpath containment and the finally restoration guard are present. Independent adapter/domain/storage suites passed 35/35 without running HTTP listener tests or accessing family storage.

Fix evidence: counters now accept only numeric zero or exact string zero; worktree and matching host identities must be nonempty strings; engine thin_client must explicitly be false. Missing, null, false, empty, whitespace and malformed metadata reject before write-through/import. A pure positive control verifies normal import and restoration to false. Updated adapter/domain/storage suites passed 37/37; the listener test was excluded.

## R16: Reviewing an unknown save falsely promises an unchanged record

Priority P2. Owner cc-web. Open at 15:26 Pacific.

After reloading a persisted save with unknown outcome, selecting Review note changes the status to Nothing has been saved yet and then The family record is unchanged. The original save may already have committed. An independent in-memory DOM reproduction confirmed both strings while the pending payload and key remained stored. Preserve the unknown-outcome explanation through review until the exact-key retry confirms the saved result.

The retry identity itself is sound: note, author, date and idempotency key remain unchanged. The existing seven UI tests pass. Separate checks passed past-discrepancy labels, replay/no-live disclosures, printable warning/citation framing and proxy provenance/error metadata preservation. No browser or shared service was operated by this reviewer.

Follow-up: the main path now keeps pendingSave through re-review and uses honest unknown-outcome wording. Eight UI tests and independent retry identity checks pass. One malformed-success preview error still says Nothing has been saved before appending the earlier-save-unconfirmed notice; that remaining contradictory sentence was returned to the owner.
