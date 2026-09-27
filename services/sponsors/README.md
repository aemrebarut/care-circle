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
| Memorable adapter | Exact request export follows its public API envelope, with a committed payload and hash | No API request, SDK run, account action, or credential access |
| Clinic reader | Actual bounded loopback HTTP fetch, fixture hash, observed response and extraction fields | No official UFO execution |
| UFO assets | Local MCP tool plus browser action recipe and task brief | No official extension packaging or hosted connector run verified |

Procedure execution is a **local simulation**, with synthetic tool inputs and outputs. Memorable payload preparation does not prove Memorable learning or replay. No Memorable extraction request, credential load, account action, or remote trace submission occurs.

Clinic fetching uses an actual HTTP request to the fixed local website. It is labeled **local-http-fetch**. HTTP extraction alone is not a browser run or official UFO extension execution. Extension assets and their validation status are documented in `extension/README.md`.

The service never accepts an arbitrary URL. Remote Memorable or UFO execution requires explicit Emre approval recorded by the lead. A key or installed SDK does not grant permission to submit a trace.

The reviewable Memorable body is `procedure/assets/memorable-request.json`; its manifest records the exact byte count and SHA-256. `extension/browser-actions.json` is our portable browser recipe, not an official UFO manifest. The local MCP endpoint is `http://127.0.0.1:4706/mcp`. Available browser tooling reported no connected browser during initial verification; no successful browser visit is claimed.

## Files and dependencies

- `server.mjs`: HTTP boundaries, dual-service lifecycle, and contract ports.
- `smoke.mjs`: Local API acceptance and failure-path checks.
- `procedure/`: Reusable procedure engine, synthetic fixtures, and Memorable adapter assets.
- `extension/`: Fictional website, bounded HTTP fetch, and UFO-related assets.

Only the shared `contract/` package is imported across lane boundaries. Services communicate over loopback HTTP. Captures are ephemeral and reset on process restart or `POST /v1/reset`; a replay requires capture first.
