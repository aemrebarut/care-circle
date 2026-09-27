# Care Circle: paused handoff and remaining work

Paused by Emre on September 27, 2026 at about 15:56 Pacific. The earlier instruction to work through the 16:40 freeze is suspended. Do not resume agents, tests, mutations, service restarts or milestone work without an explicit resume instruction.

## State at pause

- Public repo: https://github.com/aemrebarut/care-circle, shared `main`.
- App: http://127.0.0.1:4700. Runtime-owned services are being left running on 4700-4706.
- Runtime's recorded pause PIDs are brain 4515, River 15568, ingest 15708, brief 56383, web 56463, and sponsors 64962 (serving both sponsor endpoints). These are historical receipts; runtime must verify ownership again before any future process action.
- The final two-cycle HTTP acceptance run is **incomplete**. QA stopped and terminated its exact driver PID 70213. The first reset and health checks passed; one temporal regression mutation had already been accepted. It drained successfully: QA observed brain `200 ready` at 15:57:41, revision 12 with 31 pages; lead independently observed the same healthy state at 15:59. This is a partial acceptance fixture, not a clean demo seed. No second cycle or retry ran after the driver stopped.
- The queued PATH-only brain restart is canceled while paused. No license agreement or global Xcode setting was changed.
- No open Emre approval questions. Remote Memorable submission was explicitly declined and its production command refuses before credential access. No more River training or inference calls are planned.

## What is complete

- Public repo, shared contract and service plan; all implementation lanes use Astra xhigh. All 17 component/decision pages in the development GBrain resolve, with checked code links intact.
- Real GBrain import, source pages and graph; baseline and post-ingest exact state persisted across owned restarts. Canonical ingest and same-key retries preserve the original visit and do not duplicate state.
- Deterministic note extraction, cited medication answers, preserved 20 mg visit versus 10 mg pharmacy discrepancy, and the nephrology brief. The first independent full HTTP cycle passed 32/32.
- Actual desktop/mobile browser flows, source drawers and bounded DOM accessibility checks passed. The corrected browser PDF is one unclipped A4 page with both dated regimens, eight source references and the footer.
- Real River SFT and paired 72+72 predictions are independently audited: base 0/72 versus trained 71/72 exact full tasks, trained extraction 72/72. Base 54/72 hit the 1024-token cap; both arms used raw completion without a chat template, and test data covers six held-out wording families. This is not general or clinical accuracy. Both separate demo predictions failed validation; no cache or structural repair ships.
- Official Memorable CLI recall selected a locally serialized captured procedure for Ben's simulated replay. Official UFO SDK registration and a direct handler call fetched the fictional clinic through loopback HTTP. Neither is automatic learning, hosted execution or a full UFO runtime.

Public evidence:

- [One-page brief PDF](../tests/e2e/evidence/ui-nephrology-brief-final.pdf), [rendered page](../tests/e2e/evidence/ui-nephrology-brief-final-page-1.png), [family room](../tests/e2e/evidence/ui-final-desktop.png), [browser receipt](../tests/e2e/evidence/ui-acceptance-receipt.md), committed in `fd82772`.
- [HTTP acceptance status](../tests/e2e/ACCEPTANCE.md) and [review findings](reviews/findings.md).
- [Interrupted two-cycle receipt](../tests/e2e/evidence/paused-two-cycle-receipt.json) and [runtime persistence/test receipts](../packages/runtime/evidence/).
- [River comparison](../services/river/results/comparison.json), [Memorable local bridge](../services/sponsors/procedure/assets/memorable-live-bridge-proof.json), and [UFO SDK local proof](../services/sponsors/extension/ufo-package/evidence/sdk-live.json).

## Resume checklist, in order

1. Have `cc-runtime` and `cc-qa` read their paused receipts and reconfirm `GET /health` and `GET /v1/state` over HTTP only. The accepted write was already observed drained at revision 12. If anything is unexpectedly committing on resume, preserve it and inspect only owner logs/read-only status until it settles. Do not open the family brain through the CLI while its service owns it.
2. Reconfirm exclusive mutation ownership before any write. If the macOS Git shim still requests an Xcode license, use per-process `PATH=/Library/Developer/CommandLineTools/usr/bin:$PATH`; the installed Command Line Tools Git was verified working. Do not accept a license or change system settings. If needed, runtime can perform the previously proposed exact-PID brain restart with this PATH, comparing the complete HTTP snapshot before/after and running read-only smokes. This was not performed before pause.
3. Grant QA a fresh exclusive window and run **two consecutive full reset-to-demo cycles** from the acceptance runbook. The interrupted run does not satisfy this gate. Stop on the first failure and preserve evidence; fix only a reproduced defect in its owner's folder. Keep all other agents read-only during this window.

   ```sh
   PATH=/Library/Developer/CommandLineTools/usr/bin:$PATH node tests/e2e/acceptance.mjs --full --cycles 2
   ```

4. After QA explicitly releases the window, record the completed receipt, run `scripts/smoke`, and have runtime restore the clean demo seed with `scripts/demo-reset`. Verify 30 pages, 120 graph edges, seven medications, lisinopril 10 mg baseline, and cleared ephemeral procedure state. Reload the browser. Do not leave a regression fixture as the presentation state.
5. Use the [two-minute script](STATUS.md#two-minute-demo-script). Existing corrected print and UI evidence need rerunning only if a relevant implementation change occurs. Preserve all source and sponsor truth labels.
6. Reconcile any pre-pause development-brain writes using their existing request receipts, without blindly resubmitting different content. QA reported pending request `24b2d392-8a1c-4968-aad4-c87c0d54d92f`; review reported pending request `8812046a-b361-4304-9f6e-c4b69d11e304` for the content in docs/reviews/code-review.md at `cff7227`. Update STATUS, the code map and final review with actual results; commit/push owned changes and verify a clean working tree plus remote synchronization. Record the final presentation commit. A new freeze schedule requires Emre's resume direction; no automatic work remains scheduled.

## Ownership and preserved work

`cc-runtime` owns service PIDs and lifecycle; `cc-qa` owns the acceptance driver and evidence. Brain, ingest, brief, web, River and sponsors own their service directories; world owns its package; review owns docs/reviews; lead owns root/shared docs and contract. Parent lanes propagate pause to their native and Herdr subagents.

All lanes and their subagents acknowledged pause. No agent-owned work remains in flight. Tracked source, documentation and selected synthetic evidence are committed and pushed as the pause wrap-up. Temporary runtime receipts, browser tooling, local databases, virtual environments and keys remain ignored and local.

Remaining verification limits: browser reload after an unknown save outcome is covered by in-memory tests, but was not exercised live. Screen-reader audio, physical mobile hardware, physical printing and a full fresh-machine installation were not tested. These limits are separate from the unfinished required two-cycle acceptance gate.
