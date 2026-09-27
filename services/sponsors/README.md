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
| Clinic reader | Actual bounded loopback HTTP fetch, fixture hash, observed response and extraction fields | No official UFO execution |
| UFO assets | Local MCP tool plus browser action recipe and task brief | No official extension packaging or hosted connector run verified |
| Browser check | Native Chrome accessibility observation and two inspected screenshots by cc-qa-ui | Local browser rendering verified; no official UFO execution |

Procedure execution is a **local simulation**, with synthetic tool inputs and outputs. Memorable payload preparation does not prove Memorable learning or replay. No Memorable extraction request, credential load, account action, or remote trace submission occurs.

The official Memorable local recall proof is recorded in `procedure/assets/memorable-local-proof.json`. Its runner verifies the inspected package hash, probes Node permission enforcement, and starts the CLI with access only to its package and a synthetic local store. It supplies no credentials or inherited environment and allows no network, writes, or child processes. The store is manually populated from our capture; Memorable did not learn that procedure. HTTP capture and replay still use Care Circle's simulation engine.

Clinic fetching uses an actual HTTP request to the fixed local website. It is labeled **local-http-fetch**. HTTP extraction alone is not a browser run or official UFO extension execution. Extension assets and their validation status are documented in `extension/README.md`.

The service never accepts an arbitrary URL. Remote Memorable or UFO execution requires explicit Emre approval recorded by the lead. A key or installed SDK does not grant permission to submit a trace.

The separate `procedure/memorable-submit.mjs` runner refuses by default. A future authorized invocation requires a matching lead-owned `contract/memorable-approval.json`, `--send`, the exact approved SHA-256 and the recorded approval reference. It makes at most one fixed-destination request, rejects redirects, bounds time and response size, and validates returned data without executing it. It reads `MEMORABLE_API_KEY` only from the authorized process environment after the approval checks. It never runs during service startup. Demo reset does not clear its one-attempt receipt or grant another request.

The reviewable Memorable body is `procedure/assets/memorable-request.json`; its manifest records the exact byte count and SHA-256. `extension/browser-actions.json` is our portable browser recipe, not an official UFO manifest. The local MCP endpoint is `http://127.0.0.1:4706/mcp`.

QA verified the clinic in native Chrome at `2026-09-27T22:06:04.933Z`. The committed receipt is `evidence/clinic-browser-observation.json`, with a page-only accessibility snapshot alongside it. Two screenshots were inspected in the QA tool transcript; screenshot files were not saved. This **local-browser-observation** proves visible clinic details and safety framing. `/v1/status` includes the recorded observation separately from the per-request HTTP evidence. Neither claims official UFO execution.

## Files and dependencies

- `server.mjs`: HTTP boundaries, dual-service lifecycle, and contract ports.
- `smoke.mjs`: Local API acceptance and failure-path checks.
- `procedure/`: Reusable procedure engine, synthetic fixtures, and Memorable adapter assets.
- `extension/`: Fictional website, bounded HTTP fetch, and UFO-related assets.

Only the shared `contract/` package is imported across lane boundaries. Services communicate over loopback HTTP. Captures are ephemeral and reset on process restart or `POST /v1/reset`; a replay requires capture first.
