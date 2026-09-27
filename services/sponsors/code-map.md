---
title: Sponsors service
type: note
---

# Sponsors service

## Purpose

Capture and replay a synthetic prior-authorization procedure, prepare a local Memorable payload, serve a fictional clinic, and fetch its details with reproducible evidence. Sponsor execution modes are explicit.

## Run

`node services/sponsors/server.mjs` starts both 127.0.0.1:4705 and 127.0.0.1:4706. Runtime owns the persistent process. `node services/sponsors/smoke.mjs` verifies both running services and clears demo procedure state before and after its checks.

## Files

- services/sponsors/server.mjs: API boundary and dual-server lifecycle.
- services/sponsors/smoke.mjs: Local acceptance and failure-path checks.
- services/sponsors/procedure/: Captures, replay, fixtures, Memorable payload export.
- services/sponsors/procedure/assets/memorable-live-bridge-proof.json and memorable-live-bridge-manifest.json: Exact authorized local bridge receipt and source hash.
- services/sponsors/extension/: Fictional site, HTTP fetch, local UFO adapter assets.
- services/sponsors/extension/ufo-package/: Official Python extension entry point, pinned SDK and dependency constraints, direct handler proof.
- services/sponsors/extension/ufo-package/evidence/sdk-live.json: Official SDK direct handler with one real loopback clinic fetch.
- services/sponsors/evidence/: QA native Chrome browser receipt and page-only accessibility snapshot, with original receipt and snapshot hashes.

## API

4705: GET /health, GET /v1/status, POST /v1/procedure/capture, POST /v1/procedure/replay, GET /v1/procedure/memorable-payload, POST /v1/clinic/fetch, POST /v1/reset. POSTs are bounded JSON objects. 4706: GET / and GET /health, service sponsors-clinic.

## Depends on

Shared ports and IDs from contract/index.mjs. Integration with [[code/web]] via loopback HTTP and [[code/runtime]] for lifecycle. Internal component pages: [[code/sponsors-procedure]] and [[code/sponsors-extension]]. No family brain storage is opened and no other lane is imported.

## Gotchas

All procedure execution is local-simulation. Clinic extraction is real local-http-fetch, not full UFO runtime execution. Emre explicitly denied remote Memorable submission: no credential access, account action, approval record or remote request. Local recall remains authorized; the export is an unsent historical artifact. Captures are ephemeral; reset and restart require a new capture before replay. Only fixed clinic URL accepted. Browser origin is restricted to the local UI; API Host must be 127.0.0.1:4705. Both ports must be free at startup.

An official memorable-cli 0.5.30 local recall/show/list proof uses a manually seeded synthetic procedure under independently checked Node restrictions. It proves local recall only, not trace learning, hosted extraction, or official CLI execution during HTTP replay. Its receipt is under procedure/assets/ and its package is not redistributed.

The standalone Memorable bridge serializes an actual capture, uses the exact ID returned by official recall to select Ben replay, and verifies capture trace linkage. Default mode is in-process. The authorized live proof passed at 2026-09-27T22:36:09.277Z with exactly two local POSTs. Its preserved receipt is 7568 bytes, SHA-256 f5476befa70d48ffa2638f3a8aacf0f85c6a5091cb2a868cf5a3f5607fb85ef2. The real UFO Python SDK package is pinned to official commit 63ba388ed449ff46c9d70744119dffc85df0fbf8; official registration, schema and direct handler proof passed with one real loopback POST at 2026-09-27T22:36:13.633025+00:00. No hosted or full runtime execution occurred. The combined cc-runtime-local-proofs-20260927-1535 window is released; no further live invocation is authorized by it.

The production remote Memorable runner now refuses unconditionally before inspecting flags, records, payloads or credentials. Its network and credential path have been removed; status and manifest report denied. The unsent 3189-byte historical payload remains unchanged. No approval record is requested or created.

## Milestone

Early integration passed: node services/sponsors/smoke.mjs verified health, capture, distinct sibling replay, payload export, repeated local clinic fetch, reset and bounded input/Origin/Host errors. Component suite passed 10 procedure tests plus HTTP/MCP smoke. Runtime owns persistent lifecycle; all own development processes stopped. Runtime, world, web and extension dependency pages read. Native Chrome QA receipt at 2026-09-27T22:06:04.933Z proves the local clinic rendered with exact fictional details and safety footer; receipt and page-only snapshot committed under evidence/. Screenshots were inspected in tool transcript, not saved. No official UFO execution. Independent review fixes cover absolute request deadlines, header timeouts and MCP envelope validation.

At 15:40 Pacific, procedure tests pass 32/32, including unconditional denial with filesystem/network blocked and a credential-read trap. Independent review closed with no findings. The two live optional proofs passed and their exact existing receipts were promoted without rerunning them. No new capabilities are planned; runtime coordinates the one metadata restart after UI release and before QA cycles. Brain state remains untouched.

15:55 Pacific milestone: runtime completed its one sponsor refresh from PID 54803 to 64962 after UI release. Owner GET-only verification passed for both health identities, all denial flags, local execution modes and recorded recall/browser metadata. The brief refusal during the stop/start interval was resolved by the completed maintenance. QA now owns the two-cycle acceptance window; this lane is holding implementation stable with no further POSTs, resets or restarts. Final implementation and evidence commits are 74f8921 and 59898d3; root documentation is a20d35f. No blockers or external submissions.

## Final pause handoff

Emre paused the track and requested immediate wrap-up. Sponsor implementation, public proof receipts and remote-denial hardening are committed and pushed. Procedure tests last passed 32/32; independent denial review had no findings. The final runtime refresh and owner GET-only checks passed before pause. These are existing results, not tests repeated during wrap-up. All three sponsor subagents were notified to pause. No sponsor operation is in flight, and the runtime-owned services are left running untouched.

Resume only after Emre explicitly requests it. Lead owns docs/NEXT_STEPS.md. Remaining integrated acceptance status belongs to QA/runtime: the final two-cycle window had been granted, but sponsors had not received its completed result before pause. Do not infer completion or repeat any reset/proof command. Optional live proofs already passed and their grant is released. Remote Memorable remains denied; there is no pending request for credentials, an account or remote execution. No new sponsor capability is planned.
