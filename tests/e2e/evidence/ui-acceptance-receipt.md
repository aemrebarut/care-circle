# Observed UI acceptance receipt

PASS. Synthetic local demo only, http://127.0.0.1:4700/. Observed September 27, 2026, 15:38 through 15:50 Pacific. Driver: isolated headless Chrome 153 through Playwright remote-debugging-pipe, without a listener. Desktop: 1440 x 1000. Family revision 10. No save, reset, capture, replay or clinic fetch occurred during this reprint and focus pass. Explicit RELEASE was sent to cc-qa and cc-runtime; browser pages are now idle.

The real browser PDF contains exactly **1 A4 page** (594.96 x 841.92 points, verified with pdfinfo). Its Poppler-rendered page was visually inspected: the unresolved discrepancy shows **20 mg daily, Visit claim, Sep 27** and **10 mg daily, Pharmacy claim, Sep 24**, each followed by its source citation. All 8 source references, the synthetic notice and the Not medical advice footer remain readable, without clipping. UI-P2-PRINT-DOSES is resolved. The original failure PDF/render remain unchanged under ignored tests/e2e/results/ui/.

Focus checks passed: medication-answer has aria-live=polite and changes asynchronously from loading to the cited answer; internal source navigation retains focus on source-title; both River disclosures remain expanded and focused through completed automatic HTTP 200 polls. One response wait timed out before subsequent successful poll observations. A reconnect extended observation time; no action or print was duplicated. Screen-reader audio, physical mobile hardware and a physical printer were not exercised.

Source provenance:

- Print fix: 45a22959cafea3746ab9cb06a226a7e4400b2aa4.
- Focus and final desktop source: 002da864b3b9e380be54f4f819a8fb272257cf04.
- Runtime M2 maintenance evidence: b35c2e3f8cf8011caf36e597ef91a8ab785e13a1. Runtime implementation reference at receipt: 655b461ffe19751a437c0e97fc1607a2255fee1d. Runtime health/state preservation was separately granted by cc-runtime.
- Print asset caveat: Includes the 45a2295 print fix and the 002da86 focus changes. Captured response differs from committed 002da86 only by one whitespace character at openSource. Print app.js SHA-256: 818a64b425d65b5725197c7f09331845ad8830ab014e5d9a587cc1b530d042dd.
- The later focus/desktop reload matched committed 002da86 exactly. Active app.js SHA-256: a176b1a8d4772daaf2ba3b669b9d2bda9860567ffcefe4bf19a99e15e8708084.

Selected artifact SHA-256 values:

- ui-nephrology-brief-final.pdf: 7903b97143af5ad0557eec12761855668d67f3db7203591b62260c22c9e7430a
- ui-nephrology-brief-final-page-1.png: d874afbe8257579ce1d6c7a39dc5955670b81d3d5093d849663b2d3c6bee0577
- ui-final-desktop.png: 1b8bf0916d2095df7bfe0db148841e1fbff283153f51ad8a08ab0c18c7731c48

River remained deterministic fallback with live extraction unavailable. Paired displayed metrics retained token-cap and synthetic-corpus limitations. Local browser proof is not official UFO execution or remote sponsor execution. Full private work receipts and tooling remain ignored under tests/e2e/results/ui/.
