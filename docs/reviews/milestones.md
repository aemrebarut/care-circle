# Independent review milestones

## M1, 15:15 Pacific

Review artifact owner: cc-review, docs/reviews/ only. No reviewer implementation edits, credentials, external submissions or shared-state mutations.

### Direct evidence

- Brain health returned 200 with storage gbrain, ready status, revision 1 and 30 pages before the coordinated first-write window.
- After the ingest owner completed the canonical note and retry, a read-only audit passed at revision 2. The final check still returned revision 2. State contained 32 pages, 132 resolving graph edges and seven medications.
- Visit visits/ingest-70c7a8a9face7c4158c7be49 preserved the note, Ana as author, and Ana as recorded attendee. The latest recorded lisinopril dose was 20 mg daily, while the 10 mg pharmacy source remained an unresolved contradiction with both source IDs.
- Forty citation instances across medication responses, grounded answer, contradiction and brief matched literal source text and resolved to the expected title. The answer explicitly said source records do not confirm actual use.
- The nephrology brief used September 15 as cutoff and contained two actual medication changes, three other visits and three open questions, including potassium. It retained synthetic and Not medical advice framing.
- Reviewer released the read-only audit window to cc-runtime and cc-qa before their reset work.
- Pure tests executed by reviewer or independent Astra xhigh subreviewers: initial extraction 31/31, later extraction 40/40 plus 24 targeted assertions, brief domain 12/12, brain domain 18/18, brain storage 8/8, River evaluation regressions 18/18. These are distinct snapshots and suites, not a summed test total.
- River v2 corpus parsed read-only: 336 train, 72 development and 72 test records. Checked IDs, template families, case IDs, entity groups and normalized notes had no cross-split overlaps. All 480 gold schemas and declared corpus/prompt/held-out hashes passed. This verifies synthetic benchmark preparation, not model quality.

### Owner-reported evidence

- cc-runtime completed a real baseline brain restart proof preserving revision 1, 30 pages and 120 edges, then all-service smoke.
- cc-brain reported native GBrain import of 30/30 pages, unchanged packages/world, and write-through restored false. The adapter checks realpath containment before temporary write-through. Contract 7db93a3 matches this native import path; trusted per-page writes are a fallback only.
- cc-brain supplied installed GBrain journal source evidence at src/core/persistence/journal.ts 158-161 for same-source FIFO blocking behind earlier queued, running or recovering writes. The service pins regular writes to the default database-only source. Reviewers inspected barrier ordering and request UUID replay without opening family storage.
- cc-ingest reported the larger HTTP/extraction suite and first canonical ingest plus exact retry. The reviewer independently inspected its resulting source state, not the write operation itself.
- Sponsor lane has native Chrome evidence of the local fictional clinic. Local procedure replay and HTTP fetch are implemented; official Memorable learning and official UFO execution remain unclaimed.

### Open at this milestone

- R8 P2: runtime stale-lock recovery must retain live unknown owners; identity inequality alone is insufficient proof of death. Owner notified with the existing fixture as evidence.
- Two complete coordinated reset-to-demo passes and browser interaction/print evidence remain release gates.
- No verified River trained-model comparison or live River extractor is claimed by this review. Training progress is separate from evaluation completion.

All other R1 through R13 findings are closed by the stated direct tests or source inspections. This milestone is not final release sign-off.

### M1 follow-up, 15:16 Pacific

R8 is closed after direct review of both absent-PID checks and the corrected fixtures. cc-runtime reports 17/17 lifecycle tests passing. A post-ingest restart and identical retry are now coordinated by runtime and ingest before QA resets. No reviewer mutation is involved.

### Follow-up, 15:25 Pacific

- cc-runtime reports exact post-ingest state surviving PID 95456 to 19257: revision 2, 32 pages and 132 edges. cc-ingest then reports the original visit/revision returned by retry with deep-equal before/after state. These executions are owner receipts, not reviewer-operated restarts.
- Root README review found the reported River results and caveats consistent with comparison.json, paired-proof.json and the independent native audit. Both arms have 72 rows. Trained structured extraction is 72/72 and full task 71/72; base strict success is 0/72, with 54 token-cap truncations. The same prompt/settings and 1,024-token raw-completion budget are disclosed. No general or clinical capability conclusion is supported or claimed.
- The separate first canonical demo sample added an unsupported due date and remains rejected. The frozen benchmark is unchanged. R14 records a pre-publication provenance check gap in the new exact-input cache; no accepted production artifact was observed.
- Ingest and web preserve and display validated cached replay provenance, including the explicit no-live-inference distinction. Source equality remains mandatory.
- Independent sponsor review verified the official Memorable offline local recall receipts and their manually seeded fixture binding. They do not prove trace learning or official replay. Remote extraction remains approval-gated.
- The fresh-machine brain README includes guarded initialization commands and explicitly says the existing demo brain was not reinitialized to test them. The reviewer did not execute initialization.
- QA retains the coordinated mutation and UI window. Reviewer activity remains source inspection and isolated pure checks only.

## M2, 15:35 Pacific

All R1 through R16 findings are closed. R14 closed by removal of the unshipped cache path; no receipt-verifier fix or successful replay is claimed. The lead rejected structural repair and content normalization. Both failed actual demo samples remain archived, and the frozen benchmark and deterministic product path are unchanged.

### Direct and independent review evidence

- R15 malformed storage metadata rejects before native import. Independent pure adapter/domain/storage tests passed 37/37, including absent identities, nonzero/invalid counters and a normal import control. HTTP listener tests were excluded.
- R16 now preserves unknown-save wording during initial restoration, re-review, malformed preview and retry. The parent reviewer directly ran the latest UI suite: 10/10 passed. Pending note, author, date and retry key remain intact. Print DOM includes each unresolved claim's dose, frequency, date and source, plus prior-discrepancy wording and record limitations.
- Two independent offline checks found that removing one brace from River demo attempt 2 recovers a valid schema but still fails the unchanged ingest equality guard on medication display-name case. No implementation was edited. Exact hashes and the no-go decision are in river-structural-repair.md.
- Root README now states that both canonical model predictions failed and neither live nor cached extraction is claimed. Its comparison numbers and raw-completion/truncation caveats match the reviewed receipts.
- Independent sponsor delta review found no new issue. Official Memorable recall is explicitly a local selection of a serialized capture followed by Care Circle simulation, not learned trace extraction. UFO evidence distinguishes official SDK discovery/direct-handler testing from full or hosted execution. Eight bridge tests and three fake-transport tests passed without network calls or listeners.
- Emre explicitly declined remote Memorable submission. The request is closed and no submission is claimed.

### Acceptance receipts and remaining gates

- The reviewer inspected QA's first complete live receipt: 32 passes, no failures or skips, web-proxy transport, 15:17:32 to 15:18:24. It includes sticky historical discrepancies, future-date/no-mutation checks, future follow-up acceptance, source citations, concurrent retries, key conflicts, full brief, local procedure and clinic evidence. This is QA execution evidence, not a second reviewer-operated run.
- Brain reports the latest guarded adapter reloaded successfully and passed read-only smoke at revision 10, 32 pages, seven medications and 132 edges. Runtime still owns the final maintenance equality receipt.
- Two consecutive final reset-to-demo cycles and rendered browser/PDF verification remain pending. All shared mutations, restarts and their timing remain with runtime and QA. No review sign-off substitutes for those gates.

### M2 maintenance follow-up, 15:36 Pacific

Runtime's exact-state maintenance check passed at 22:34:38Z. The reviewer inspected .runtime/managed/post-ui-maintenance-check.json: revision 10, 32 pages, 132 edges, state SHA-256 37422fc883d9c46d96f3bba70ee753575e970e7f8df5dd37b788a6e351940633. Runtime reports owned brain, River and ingest restarts, all-service smoke, owner smokes and preserved sponsor counts. This clears the maintenance equality gate as owner execution plus reviewer receipt inspection. QA's corrected read-only reprint and the separate bounded local sponsor proof window precede the final two acceptance cycles.

### M2 sponsor receipt follow-up

Independent artifact audit passed for the authorized local sponsor proof window. The reviewer did not rerun either proof or make service requests.

- UFO receipt in 59898d3 records exactly one connection to 127.0.0.1:4705. Its nested clinic GET is fixed to 127.0.0.1:4706. All 3,135 authored HTML bytes, SHA-256 acd6313c7a88fd9d84d8b710817786a3771b8134a81eac774a1aef969c5ef710, and clinic/pharmacy fields match the receipt. The official SDK ToolDef handler ran directly; full runtime, hosted execution and model calls remain false or zero.
- Memorable live bridge receipt in 74f8921 matches its original receipt byte-for-byte: 7,568 bytes, SHA-256 f5476befa70d48ffa2638f3a8aacf0f85c6a5091cb2a868cf5a3f5607fb85ef2. Capture response, serialized local store, official recall output, selected ID, Ben replay and captureTraceId all bind. Recall/show/list exit codes are zero. Two loopback requests are recorded. Manual serialization and Care Circle simulated replay remain explicit; official learning and remote submission are false.
- The production Memorable submission path now refuses unconditionally before credentials or requests, matching Emre's declined authorization.
- The timed demo's narrow local sponsor wording is supported by these receipts. No full UFO runtime, hosted integration or learned procedure claim is supported.
- The root README's Bun 1.3.11 minimum and unrelated npm-package warning match the [official GBrain installation instructions](https://github.com/garrytan/gbrain#install). No installer or initialization command was run by the reviewer.

### Final print review, 15:52 Pacific

The parent reviewer visually inspected the complete corrected page render from ui-nephrology-brief-final.pdf. The 20 mg daily September 27 visit claim and 10 mg daily September 24 pharmacy claim are separately labeled and cited. All eight source references, unresolved/actual-use caveats and the synthetic/Not medical advice footer are visible. No clipping was observed. Read-only pdfinfo confirms one A4 page, 594.96 by 841.92 points, 162,770 bytes.

- PDF SHA-256: 7903b97143af5ad0557eec12761855668d67f3db7203591b62260c22c9e7430a.
- Render SHA-256: d874afbe8257579ce1d6c7a39dc5955670b81d3d5093d849663b2d3c6bee0577.
- QA receipt: tests/e2e/results/ui/ui-final-reprint-receipt.json. It records revision 10, zero mutating actions, no page errors and no blocked requests.
- Focus receipt: tests/e2e/results/ui/ui-final-focus-receipt.json. It records source-heading focus, stable expanded River evidence across successful polls and the medication answer live region. It explicitly does not claim screen-reader audio testing and discloses an earlier response-wait timeout followed by successful verification.

The browser/print gate is clear. The reviewer did not rerun browser or service calls. Two consecutive final HTTP cycles remain pending.

## M3, 15:55 Pacific

All R1 through R16 remain closed. Final README/runbook changes and exact local sponsor receipts have been reviewed. Corrected print is directly verified as one readable A4 page with both dose claims and all eight sources. No new capabilities or implementation edits are proposed by review.

QA now owns the exclusive two-consecutive-cycle window after all browser and sponsor releases. The reviewer sampled only GET /health at 22:55:01Z: web, ingest, brief, River, sponsors and clinic returned 200; brain returned 503 at revision 11 during QA's active mutation window. This concurrent sample does not by itself establish a defect. QA was notified for correlation; final health will be checked after release. No reset, retry, restart or shared write was attempted.

Review-owned paths remain docs/reviews/. All git operations now use the per-invocation CommandLineTools PATH workaround; no license acceptance or global settings change was performed. Stabilization continues through freeze, with final two-cycle receipts still pending.

## Pause and wrap handoff, 15:57 Pacific

Emre paused the track before freeze and authorized only wrap-up of completed work. The parent propagated pause to all three native reviewers and confirmed they were stopped. No Herdr child agents were created by this lane. Existing services were left running. No implementation, test, reset, restart, model or sponsor call was started after the pause.

All R1 through R16 are closed. Completed evidence includes canonical source/citation audit, verified fixes, actual River benchmark review with both demo predictions rejected, maintenance equality, local sponsor receipt binding and direct one-page print review. The final two consecutive QA cycles and stable post-release health were not received before pause. QA/runtime/brain own settling any already accepted family mutation; the reviewer will not interrupt or retry it.

The M3 code-map put had returned write_pending for request 8812046a-b361-4304-9f6e-c4b69d11e304 before pause. Its accepted arguments were code/review and the exact docs/reviews/code-review.md content in cff7227. No duplicate request or retry was submitted. Its final outcome remains unconfirmed by this lane. The already-started link extraction completed successfully and reported 106 links from 17 pages; that does not establish the pending put's outcome. On explicit resume, reconcile the existing request before any new map write.

All review-owned changes through cff7227 were committed and pushed before pause; the wrap commit adds only this handoff and the paused verdict. Root docs/NEXT_STEPS.md remains lead-owned. Resume items sent to lead: settle and record the accepted QA operation, inspect the existing devbrain request, complete the coordinated final two-cycle gate if still required, then sample stable GET-only health and update release evidence. Do not restart automatically at the former 16:40 deadline.
