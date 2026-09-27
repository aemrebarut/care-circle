# Care Circle status

## Needs Emre

- None.

## Log

### 15:35 Pacific M2 integration and browser evidence

- Emre declined remote Memorable submission. The request is closed; no request ran, and no credential or account is needed. Local CLI recall and Care Circle simulation remain the supported path.
- Independent HTTP acceptance passed 32/32 in the first full cycle. Baseline and post-ingest restart persistence, unchanged retry state, literal citations, contradictory claims, unsupported notes, and sponsor evidence passed. Two consecutive final cycles remain pending after maintenance.
- Actual desktop and 390-pixel mobile browser flows passed: one canonical save, source drawers, graph, cited medication answer, sponsor capture/replay, and clinic fetch. QA released the shared state at revision 10, 32 pages, 132 edges without resetting it.
- Chromium produced a one-page A4 brief without clipping. QA found missing dose/frequency values in the printed conflict; web fix 45a2295 is committed. Corrected PDF reprint is the remaining UI gate.
- River paired results are independently recomputed and audited: base 0/72 versus trained 71/72 full task. Both canonical-note model attempts failed validation. A separate offline structural-repair assessment also failed the unchanged evidence gate, so the product remains deterministic with no model replay claim and no further model calls planned.
- Official UFO SDK extension discovery and direct handler tests pass offline. Official Memorable recall of a serialized captured procedure also passes offline. Narrow live local proof commands are queued after maintenance; neither is a hosted run or automatic procedure learning.
- Runtime is applying queued owner-approved service refreshes after QA release. Test the app at http://127.0.0.1:4700 after health returns, or run read-only `scripts/smoke`. Shared mutation windows remain coordinated.
- Next STATUS update by 15:55 Pacific. Freeze remains 16:40.

### 15:16 Pacific M1 passed, core M2 path already working

- All seven service endpoints are healthy. Real GBrain native import succeeded for all 30 seed pages; native links extracted, world package unchanged, write-through restored false.
- Runtime proved the complete baseline snapshot survived an owned brain restart: revision 1, 30 pages, 120 edges. Ingest then committed the canonical note and identical-key retry at revision 2 with no duplication.
- Post-ingest restart also passed: exact revision 2, 32-page, 132-edge HTTP state survived PID 95456 to 19257. Ingest then retried the same key and received the original visit/revision with unchanged state. QA now gets its exclusive two-cycle reset acceptance window; browser save/print checks follow.
- Independent live brief audit: seven medications, two actual changes, three other visits, three nephrology questions including potassium, one unresolved 20 mg visit versus 10 mg pharmacy conflict, literal source quotes, no record-gap warnings. Printable Markdown is 347 words with nine sources.
- River completed actual SFT and 72 base plus 72 trained evaluations. Independent audit passed: full task 0/72 base versus 71/72 trained; structured extraction 72/72 trained. Base 54/72 hit the shared 1024-token cap, so these are strict output results, not general or clinical accuracy. Scores and receipts are published under services/river/results/.
- Actual clinic Chrome rendering and app unavailable-state behavior are verified. Official Memorable offline recall is proven on a manually seeded procedure; remote extraction still awaits the concrete approval above. Official UFO execution remains unverified.
- Test now: open http://127.0.0.1:4700 and inspect graph, sources, recorded medications and brief. Avoid save/reset during the coordinated acceptance window. `scripts/smoke` is read-only.
- Next scheduled STATUS update by 15:35 Pacific. Freeze remains 16:40.

### 15:07 Pacific real River training started

- River lane started the approved run at 15:07:02. Session `6f387123-0ec0-40e5-8e4e-0181dbd06580` was created at 15:07:06; Qwen/Qwen3.5-9B is loading.
- Fixed experiment: 336 synthetic training rows, rank 8, one epoch, 21 steps, then the same prompt on 72 held-out examples for each of base and trained models. No measured model accuracy yet.
- Payload manifest SHA256 `039f2af01c6a1dc265dd5e6e1a3c0cc5c40a6e2e9406aad48ba9f7c4b74e884b`. Bounded run ends by 15:52 plus cleanup; actual progress is exposed at `http://127.0.0.1:4704/v1/status`.
- Six service health endpoints now pass. Brain is finishing startup; web and brief owners have handed over their services and QA is preparing a real Chrome demo pass.

### 15:05 Pacific early integration

- World delivery independently reviewed clean: 30 pages, 120 resolving links, 21 exact medication citations. `npm test --prefix packages/world` passes per owner and reviewer.
- Lead verified HTTP 200 health on 4702 ingest, 4704 River, 4705 sponsors, and 4706 sponsors-clinic. Brain, brief and web are still being integrated.
- Ingest committed with 46 tests passing. Evidence guards cover optional model output; prospective, declined, historical and qualified changes are not silently committed.
- River real metadata access succeeded. Synthetic split has 336 train, 72 development, 72 test records; final split/tokenization review precedes first training, targeted around 15:10. No trained-model accuracy claimed.
- Sponsor local capture/replay and fixed clinic HTTP fetch pass smoke checks. Official Memorable and UFO execution have not run. Exact optional Memorable request is now listed above for approval.
- Test now: `curl http://127.0.0.1:4702/health`, `curl http://127.0.0.1:4704/v1/status`, `npm test --prefix packages/world`. Full app demo is not ready yet.
- Next scheduled STATUS update by 15:25 Pacific, with M1 gate review at 15:15.

### 14:57 Pacific River key ready

- Analyst reports the approved River key file is now present. River lane instructed to load only the named variable without printing and start real synthetic training after payload validation.
- Ten Astra xhigh lanes are active with additional planners and reviewers. Initial independent architecture review is committed; no implementation completion is claimed yet.

### 14:53 Pacific authorization update

- Analyst conveyed Emre approval for River synthetic note/JSON corpus uploads, training, and evaluation. Synthetic data only.
- River lane may load only `RIVER_API_KEY` from `~/Workspace/qm-raid/services/forge/.env` read-only into its process environment without printing it. This is the sole exception to the primary track hands-off rule. Build and test dry runs until the file exists.
- Memorable and UFO local work is approved. Account creation or remote submission remains pending a concrete request under Needs Emre.
- Public repo created and pushed: https://github.com/aemrebarut/care-circle. Lane launch in progress.

### 14:53 Pacific kickoff

- Read the full brief. Contract and plan authored before dispatch.
- Building independent service lanes on 4700 through 4706 with GBrain as durable family storage.
- Public repository setup and Astra xhigh lane launch are in progress.
- Test now: read docs/CONTRACT.md and docs/PLAN.md. App is not running yet.
- Next update by 15:13 Pacific; milestones remain 15:15, 15:35, 15:55, 16:15, 16:35.

## Two-minute demo script

Before presenting, after the shared test window is released: run `scripts/smoke`, then `scripts/demo-reset`, and reload http://127.0.0.1:4700. Keep the browser at desktop width. All data is fictional.

1. **0:00-0:15, the family.** Show Rose's circle. "Three siblings, four specialists, and one shared family brain. Every record lives in GBrain and links back to its source. This organizes information; it is not medical advice."
2. **0:15-0:45, the new note.** Choose **Try the sample note**, **Review note**, then **Save to the family brain**. "Ana brought this cardiology note home. The conservative deterministic extractor shows what it will save, including the potassium question."
3. **0:45-1:00, the disagreement.** Choose **What is Mom taking now?** and open the lisinopril sources. "The visit records 20 mg daily; the pharmacy still records 10 mg daily. We preserve both claims and who was there. We do not choose a dose."
4. **1:00-1:25, the hero.** Choose **Prepare a visit brief**. Show changes since September 15, other visits, questions, and both conflict sources. Choose **Print brief**. "The nephrologist gets one cited page with what changed elsewhere." Close the print dialog to continue.
5. **1:25-1:45, sharing the work.** In **A few little helpers**, choose **Capture with Ana**, **Replay with Ben**, then **Look up the demo clinic**. "This replay is simulated. Separately, the official Memorable CLI selected the captured procedure locally, and our UFO SDK extension fetched this fictional clinic locally. No insurer was contacted."
6. **1:45-2:00, the measured model.** Show River results. "We trained a real River model: 71 of 72 exact held-out tasks versus zero for the base under this strict prompt. The base hit its token cap on 54 notes. Both demo model attempts failed validation, so the app keeps its deterministic path."
