# Care Circle sponsors

Local, synthetic procedure capture and replay on `127.0.0.1:4705`, plus a fictional clinic website on `127.0.0.1:4706`. Care Circle organizes information and cites sources; it never recommends doses or treatments. All people, providers, calls, and clinic details are synthetic. Not medical advice.

## Run

From the repository root:

```sh
node services/sponsors/server.mjs
node services/sponsors/smoke.mjs
```

The single process starts both services and stops its own listeners on SIGINT or SIGTERM. It binds only to `127.0.0.1` and fails if either port is unavailable. The runtime lane owns the persistent process. There are no required credentials or external dependencies.

## HTTP API

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/health` | Sponsor health, `service: sponsors` |
| GET | `/v1/status` | Memorable and UFO mode, limitations, and readiness |
| POST | `/v1/procedure/capture` | Capture a synthetic prior-authorization trace, default actor Ana |
| POST | `/v1/procedure/replay` | Replay a captured procedure as another sibling, default Ben |
| GET | `/v1/procedure/memorable-payload` | Review the local payload prepared for Memorable; makes no external request |
| POST | `/v1/clinic/fetch` | Fetch the fixed local synthetic clinic page and return extraction evidence |
| POST | `/v1/reset` | Clear captured in-memory procedures for a repeatable demo |

POST requests require `Content-Type: application/json` and an object body. Capture accepts optional `actorId`; replay accepts optional `procedureId` and `actorId`. Clinic fetch and reset accept only `{}`. Errors use `{error:{code,message}}`. Bodies are bounded to 32 KiB and requests to five seconds. The API accepts only its loopback Host and the local web origin when a browser Origin is supplied.

The clinic supports `GET /` and `GET /health`, identifying its service as `sponsors-clinic`. Procedure traces and clinic evidence are local demonstration artifacts, not durable family GBrain pages.

## Integration reality

| Component | Verified locally | Official sponsor runtime |
| --- | --- | --- |
| Procedure | Six synthetic tool steps, repeatable capture and distinct sibling replay, grounded trace hashes | Memorable has not learned or replayed this trace |
| Memorable adapter | Exact request export follows its public API envelope, with a committed payload and hash | No hosted extraction, account action, or credential access |
| Memorable local recall | Unmodified CLI 0.5.30 recalled, displayed and listed a manually seeded synthetic procedure with network and writes denied | Official local CLI executed; trace learning and hosted extraction did not run |
| Memorable bridge | Live capture serialized locally, official recall returned the exact ID used by the live service for Ben's simulated replay | Official recall selects replay; no automatic learning or hosted extraction |
| Clinic reader | Actual bounded loopback HTTP fetch, fixture hash, observed response and extraction fields | No official UFO execution |
| UFO assets | Documented Python extension with pinned official SDK, local MCP tool and browser recipe | Real SDK entry-point, schema and direct handler verified with a live loopback fetch; no full runtime or hosted execution |
| Browser check | Native Chrome accessibility observation and two inspected screenshots by cc-qa-ui | Local browser rendering verified; no official UFO execution |

Procedure execution is a **local simulation**, with synthetic tool inputs and outputs. Memorable payload preparation does not prove Memorable learning or replay. No Memorable extraction request, credential load, account action, or remote trace submission occurs.

The official Memorable local recall proof is recorded in `procedure/assets/memorable-local-proof.json`. Its runner verifies the inspected package hash, probes Node permission enforcement, and starts the CLI with access only to its package and a synthetic local store. It supplies no credentials or inherited environment and allows no network, writes, or child processes. The store is manually populated from our capture; Memorable did not learn that procedure. HTTP capture and replay still use Care Circle's simulation engine.

Clinic fetching uses an actual HTTP request to the fixed local website. It is labeled **local-http-fetch**. HTTP extraction alone is not a browser run or official UFO extension execution. Extension assets and their validation status are documented in `extension/README.md`.

The service never accepts an arbitrary URL. Emre explicitly denied remote Memorable submission. No credential access, account action or remote extraction is authorized. Local Memorable recall and replay remain authorized. No hosted UFO run or remote telemetry is configured.

The earlier submission preparation is an unsent historical artifact. The separate `procedure/memorable-submit.mjs` entry point refuses unconditionally with `MEMORABLE_REMOTE_SUBMISSION_DENIED` before flags, records, payloads or credentials are inspected. Its production transport and credential-reading path have been removed. No approval record is to be created. Status reports `authorizationDecision: denied`, `externalSubmissionAuthorized: false`, `remoteSubmissionEnabledInService: false` and `adapter.productionSubmissionEnabled: false`. Demo reset does not change this decision.

The reviewable Memorable body is [procedure/assets/memorable-request.json](procedure/assets/memorable-request.json); [its manifest](procedure/assets/manifest.json) records the exact byte count, SHA-256 and denied decision. `extension/browser-actions.json` is our portable browser recipe, not an official UFO manifest. The local MCP endpoint is `http://127.0.0.1:4706/mcp`.

The documented UFO Python extension is in `extension/ufo-package/`. It declares the official `ufo.extension` entry point and wraps only the existing loopback clinic endpoint. Its pinned SDK, dependency constraints and offline receipt are included. The [live SDK receipt](extension/ufo-package/evidence/sdk-live.json) records actual package registration, schema construction and direct SDK handler invocation with one local clinic-fetch request at `2026-09-27T22:36:13.633025+00:00`. It does not claim a full UFO agent run, hosted execution or browser automation by UFO.

`procedure/memorable-bridge.mjs` demonstrates capture, official local recall and Ben replay without changing the service API. Its default proof runs in-process. The live proof passed at `2026-09-27T22:36:09.277Z` under `cc-runtime-local-proofs-20260927-1535`: Ana capture, isolated official recall, then Ben replay using the recalled ID and matching the capture trace. The exact [live bridge receipt](procedure/assets/memorable-live-bridge-proof.json) and [promotion manifest](procedure/assets/memorable-live-bridge-manifest.json) are committed. The receipt is 7568 bytes with SHA-256 `f5476befa70d48ffa2638f3a8aacf0f85c6a5091cb2a868cf5a3f5607fb85ef2`.

That completed window authorized exactly three local POSTs: two for the Memorable bridge and one for the UFO SDK handler. All passed, the window was released, and no reset, brain write, restart or remote request occurred. Live proof commands require a new runtime-coordinated window; this recorded result does not authorize another invocation.

QA verified the clinic in native Chrome at `2026-09-27T22:06:04.933Z`. The committed receipt is `evidence/clinic-browser-observation.json`, with a page-only accessibility snapshot alongside it. Two screenshots were inspected in the QA tool transcript; screenshot files were not saved. This **local-browser-observation** proves visible clinic details and safety framing. `/v1/status` includes the recorded observation separately from the per-request HTTP evidence. Neither claims official UFO execution.

## Files and dependencies

- `server.mjs`: HTTP boundaries, dual-service lifecycle, and contract ports.
- `smoke.mjs`: Local API acceptance and failure-path checks.
- `procedure/`: Reusable procedure engine, synthetic fixtures, and Memorable adapter assets.
- `extension/`: Fictional website, bounded HTTP fetch, and UFO-related assets.

Only the shared `contract/` package is imported across lane boundaries. Services communicate over loopback HTTP. Captures are ephemeral and reset on process restart or `POST /v1/reset`; a replay requires capture first.
