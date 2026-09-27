# QA acceptance log

Owner: cc-qa. All evidence refers to synthetic local data. This log separates source review, owner-reported tests, and independent live execution.

Current disposition: **paused by Emre at 15:56 Pacific**. The final two-cycle gate was interrupted and is incomplete. No automatic continuation is authorized. See the pause receipt below; the earlier 32/32 single-cycle result and browser evidence remain valid historical observations.

## Initial implementation, 15:08 Pacific

Committed runner: `778b1a0`. `node --check tests/e2e/acceptance.mjs` passes. First health receipt at 15:00 had no services available. The 15:04 receipt has four healthy endpoints: ingest, River, sponsors and clinic. Runtime reports six of seven ready, with real GBrain initialization and restart pending. No full acceptance or browser family demo is claimed yet.

Additional tests in progress cover preserved historical pharmacy discrepancies, exact source claims, fresh-key concurrent ingest, future-date rejection and future follow-up acceptance. The runner uses direct health and the same web proxy routes used by the UI. Only runtime owns live processes.

## Findings routed to owners

| ID | Finding | Resolution evidence |
| --- | --- | --- |
| H1 | A later agreeing visit dropped an earlier pharmacy discrepancy. | Fixed by brief owner. Independent live temporal regression passed in the 15:18 full cycle. |
| H2 | Unchanged visit claims appeared as medication changes. | Fixed by brief owner. Exact baseline and post-ingest changed-medication sets passed in the full cycle. |
| H3 | Missing River predictions counted as valid JSON. | Fixed with 13 owner tests. Independent status arithmetic and offline paired-output rescoring passed; see RIVER_AUDIT.md. |
| H4 | Durable ownership regex rejected the real pharmacy/ seed slug on restart. | Fixed with actual seed encode/decode regression. Runtime proved exact baseline and post-ingest state across native restarts; ingest proved unchanged retry after restart. |

## Independent live observations

The HTTP reviewer used only GET and nonmutating extract calls. The canonical demo with Ben as uploader preserved Ana as attendee and returned 20 mg daily. Supported daily and twice-daily controls worked; 14 qualified or historical variations returned 422. No unsafe schedule truncation was observed. River status reported deterministic mode, prepared corpus, extraction unavailable, and null paired metrics. Sponsor status reported local simulation and local HTTP fetch.

Native Chrome rendered the local clinic at `http://127.0.0.1:4706/` at 2026-09-27T22:06:04.933Z. The UI reviewer observed fictional clinic and pharmacy names, hours, phones, synthetic notice and exact Not medical advice footer through accessibility and two visually inspected screenshots. Ignored receipt: `tests/e2e/results/ui/clinic-browser-observation.json`. Ignored page snapshot: `tests/e2e/results/ui/clinic-browser-snapshot.txt`. This proves local browser rendering only; official UFO execution remains false.

## Limits and next gate

Full live reset/ingest acceptance requires an exclusive mutation window from cc-runtime after brain startup and restart. Family UI interactions will follow HTTP acceptance in a separate window. Score arithmetic and status provenance do not themselves prove a remote training or serving run; the River lane supplies artifact-level evidence. Source review is not a substitute for these live checks.

## M1, 15:15 Pacific

Independent `node tests/e2e/acceptance.mjs --health-only` passed all seven endpoints at 15:13:44.884. Receipt: `tests/e2e/results/2026-09-27T22-13-44.884Z.json`. A preceding read-only run independently passed River metric provenance and sponsor status checks; brain-dependent checks correctly failed or skipped during the repaired startup.

Runtime reports the real GBrain baseline survived an exact-PID restart with identical revision 1, 30 pages and 120 edges. Ingest reports the first canonical note and same-key retry passed at revision 2, source `visits/ingest-70c7a8a9face7c4158c7be49`, with one 20 mg claim and preserved pharmacy 10 mg. These are owner-reported integration receipts; independent full acceptance has not run yet. Runtime is now proving post-ingest persistence and the ingest idempotency ledger before releasing state to QA.

The isolated headless Chrome reviewer also verified the real family UI unavailable state at 1440 by 1000: graph and medications show errors, sponsor modes are explicit, synthetic and non-advice notices are visible, navigation and GET-only retry work, and there were no page errors or external requests. Receipt: `tests/e2e/results/ui/web-initial-observation.json`. Screenshots are under the same ignored directory. Successful graph, save, citation and print flows still await the stable mutation handoff.

The runner now blocks further writes after any uncertain reset/write result. Graph endpoint comparison accepts ordering differences and additive envelope fields while comparing the actual nodes and edges. No QA family mutation has occurred at this milestone.

## First full acceptance, 15:18 Pacific

`node tests/e2e/acceptance.mjs --full --cycles 1` passed **32 checks, zero failures, zero skips** through the actual web proxy, from 15:17:32.510 to 15:18:24.206. Receipt: `tests/e2e/results/2026-09-27T22-17-32.510Z.json`, observed repository commit `1c64515915304c1074315de946df00ddc2d58d66`. QA implementation at this run was committed in `09f1a81`.

The run independently verifies H1 and H2 fixes; both resets; future visit rejection without mutation; valid future follow-up persistence; literal source citations; exact uploader/attendee separation; qualified, uncertain and historical note handling; concurrent first writes and retries; unchanged state on key conflict; the 10 versus 20 mg discrepancy; the complete nephrology brief; local procedure capture/replay linkage; local clinic bytes/hash/field agreement; and current River metric arithmetic/provenance.

Before the full run, an independent stable-revision audit checked 44 claim/citation pairs, 14 displayed regimens and all four doctor date/body/source records at revision 2. It found no issues. Runtime and ingest separately proved the committed state and idempotency ledger survived a real GBrain process restart.

Measured River status at the full run reported a completed paired experiment with strict JSON task matches of base 0/72 and trained 71/72. This is a synthetic extraction task under the same prompt and 1024-token completion cap, not clinical accuracy. Live serving was unavailable and the actual extractor mode was deterministic. Artifact-level paired prediction review and explicit cached-replay provenance checks are subsequent work, not implied by the numeric status check.

QA then performed the separately authorized clean reset and independently checked revision 9, 30 pages, 120 edges, lisinopril 10 mg and zero captured procedures. Runtime received an explicit RELEASE, restarted sponsor metadata, and granted the browser reviewer the sole UI mutation window. Successful family UI and real one-page PDF verification are now underway. Final definition of done still requires two consecutive full cycles after the remaining changes settle.

## M2, 15:35 Pacific

The actual isolated Chromium desktop and mobile flow completed with exactly one family save, one capture, one distinct-sibling replay and one local clinic fetch. Source drawers resolve the 20 mg September 27 visit and the 10 mg September 24 pharmacy record. Both mobile graph views fit a 390-pixel viewport without outer-label clipping. The latest narrative source renderer is readable on desktop and mobile. Sponsor and River limitations are visible, with no page errors or external page requests observed.

The real Print action produced one A4 PDF page, rendered and visually inspected. Review caught `UI-P2-PRINT-DOSES`: the paper discrepancy named the sources but omitted their dose/frequency values. Web owner fixed it in `45a2295`; corrected print verification remains pending after runtime maintenance. Original PDF and render remain preserved. Full UI acceptance is not yet claimed. Complete browser receipt: `tests/e2e/results/ui/ui-complete-observation.json`.

QA explicitly released the browser window at 15:33 with revision 10, 32 pages and 132 edges preserved; captured/replayed procedure counts were each one. Runtime is refreshing brain, ingest and River with exact state preservation. Read-only corrected print and a separate sponsor proof window precede two consecutive full HTTP cycles.

The independent River artifact audit passed and is documented in `RIVER_AUDIT.md`, with a detailed ignored receipt under `results/qa-http/`. Actual demo model samples both failed validation, so the final release decision is deterministic extraction and River 503, with no cached or live inference. The runner now asserts that final reality. Memorable remote submission was declined; local simulation and offline proof stay explicitly labeled.

## Corrected print verification, 15:39 Pacific

`UI-P2-PRINT-DOSES` is closed. The isolated Chromium reprint after `45a2295` is exactly one A4 page according to `pdfinfo`. The reviewer, QA root and lead visually inspected its rendered page: 20 mg daily from the September 27 visit and 10 mg daily from the September 24 pharmacy record each have an explicit source citation. All eight unique source references, the synthetic notice and the non-advice footer fit without clipping. This is actual browser PDF output, not an HTML modal claim.

Receipt: `tests/e2e/results/ui/ui-final-reprint-receipt.json`. Corrected PDF: `tests/e2e/results/ui/ui-nephrology-brief-final.pdf`. Render: `tests/e2e/results/ui/ui-nephrology-brief-final-page-1.png`. The original failed print is preserved separately. Reprint performed no family or sponsor mutation and kept revision 10.

## Pause wrap, 15:57 Pacific

The authorized final `--full --cycles 2` run completed the first reset and all seven health checks. Its first temporal regression write was already accepted when Emre paused the track. QA stopped only its exact test driver, preventing further requests or a second cycle; no service or GBrain process was signaled, and no write was retried.

A minimal health read at 2026-09-27T22:57:41.166Z returned HTTP 200, ready, revision 12 and 31 pages. The accepted backend operation therefore drained. This is a partial regression-fixture state, not a clean baseline or completed canonical demo. It was preserved without reset. The test process did not produce its normal completion receipt because it was terminated to prevent queued writes. The explicit partial receipt is [paused-two-cycle-receipt.json](evidence/paused-two-cycle-receipt.json).

No final two-cycle pass is claimed. Both reviewers acknowledged pause with no operations in flight and no uncommitted authored evidence. Existing services remain running. All further tests, mutations, restarts, milestones and external calls wait for Emre's explicit resume. A devbrain map capture accepted before pause returned pending request `24b2d392-8a1c-4968-aad4-c87c0d54d92f`; it was not retried and its completion was not verified during wrap.
