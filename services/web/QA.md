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

## Remaining verification

- Corrected live PDF with explicit 20 mg daily visit claim and 10 mg daily pharmacy claim, both dates and citations, on one A4 page.
- Two final reset-to-demo runs, coordinated with runtime and QA.
- Browser reload while a save outcome is uncertain, if QA can isolate the transport failure without interfering with shared state.
