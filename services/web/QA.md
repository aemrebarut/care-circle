# Web verification

All checks use synthetic data and loopback services. Persistent service processes belong to runtime.

## Initial milestone

- Proxy smoke: 67 passing checks with isolated 4719 and 4712 listeners, both closed afterward. Covers all allowlisted routes, real loopback transport, request bounds, unsafe origins and paths, upstream failures, and validated ingest retry metadata.
- Native Chrome at http://127.0.0.1:4700: page renders its warm family room; unavailable brain, medication, and brief dependencies show explicit errors without fabricated records.
- Live note extraction through the web proxy: sample note review shows deterministic mode, full limitations, recorded lisinopril 20 mg daily claim, potassium follow-up, and the nephrology question. No save performed while brain initialization was under repair.
- River status renders reported training progress and corpus counts, while clearly saying live model extraction is unavailable. No model comparison is invented when metrics is null.
- Independent review confirmed safe text-only source rendering, source-discrepancy descriptions, note edit invalidation, unknown-outcome key reuse, and safe proxy retry metadata.

## 15:35 milestone

- Isolated `npm test --prefix services/web`: 67 proxy checks and 10 UI state regressions pass. Includes request ordering, pending save restoration, repeated review, malformed extraction during an unknown save, same-key retry, safe source text, honest River modes, and printed discrepancy claim details.
- Independent QA reports the live desktop flow passed: graph, reviewed exact demo note, verified save, cited recorded dose, both conflict sources, medication answer, previsit, procedure capture/replay, and clinic fetch. QA owns the shared-state writer window; web performed no mutations.
- QA reports 390 by 844 mobile care graph and all 32 records fit without outer label clipping or document overflow. Human-readable source rendering passed on desktop and mobile. Artifacts are under `tests/e2e/results/ui/`, including `ui-mobile-care-graph.png`, `ui-mobile-all-records.png`, `ui-mobile-full.png`, `ui-source-final-desktop.png`, and `ui-source-final-mobile.png`.
- Initial live post-save PDF fit one A4 page without clipping. QA found that the discrepancy section omitted the claim doses. Commit `45a2295` adds each dose, frequency, source type, date, and citation to both the alert and brief while preserving the full print source index and historical unresolved description. The corrected PDF is awaiting QA reprint.
- Pending-save identity and uncertainty have independent in-memory verification. Actual browser reload evidence remains pending.
- River extraction stays deterministic. The displayed measured comparison is 0/72 base versus 71/72 trained strict task match under the same prompt and token limit, with synthetic-only and truncation caveats. Neither rejected demo model prediction is shown as cached or live success.

## 15:55 milestone

- Corrected PDF passed QA and web owner visual inspection: `tests/e2e/results/ui/ui-nephrology-brief-final.pdf` is one A4 page with no clipping. The unresolved section explicitly includes the Sep 27 visit claim of 20 mg daily and Sep 24 pharmacy claim of 10 mg daily, their citations, all eight unique source IDs, and the safety footer. `ui-final-reprint-receipt.json` records revision 10 and zero mutating actions.
- Bounded accessibility commit `002da86` passed the isolated suite: 67 proxy checks and 12 UI regressions. Medication answer has a polite live region; nested source navigation preserves heading focus; closing a drawer prevents late focus theft; River polling preserves expanded evidence and focused summaries.
- `tests/e2e/results/ui/ui-final-focus-receipt.json` confirms the loaded `002da86` asset, successful cited medication answer, source-title focus after nested navigation, and both River evidence disclosures staying open and focused across repeated successful HTTP polls. Zero mutating actions. This verifies DOM live-region behavior, not screen-reader audio. One automation wait timed out, but later completed polls and DOM inspection passed.
- Implementation is held stable for final two-cycle acceptance. Runtime owns every persistent process. No web restart is needed for these static asset fixes.

## Remaining verification

- Two final reset-to-demo runs, coordinated with runtime and QA.
- Browser reload while a save outcome is uncertain remains covered by in-memory tests, not a live browser transport-failure receipt.

## Paused handoff

Emre paused the track before final two-cycle acceptance completed. No further implementation, tests, resets, restarts, or model/sponsor calls are authorized until explicit resume. Web has no in-flight operation. All three native web subagents are stopped and received the pause directive. Runtime-owned services remain running; files and QA evidence are preserved.

Implementation is committed in `002da86`; print repair is in `45a2295`. The last completed test run passed 67 proxy checks and 12 UI regressions. Corrected PDF and browser focus receipts above passed. These are existing results, not tests rerun during wrap-up.

On explicit resume, obtain QA/runtime's final outcome for any reset accepted before pause before starting another cycle. The remaining release gate is two consecutive reset-to-demo runs. A live browser unknown-save reload check is additional coverage, not completed evidence. Lead owns `docs/NEXT_STEPS.md` and receives this handoff. No web-specific release defect remains open.
