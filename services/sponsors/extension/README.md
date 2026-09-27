# Synthetic clinic extension assets

Owns the fictional clinic on `127.0.0.1:4706`, a bounded fixed-URL HTTP reader, a portable browser action recipe, and a read-only local MCP endpoint. All providers and contact details are synthetic. Care Circle organizes information and cites sources; it never recommends doses or treatments. Not medical advice.

## Run

Normally start `node services/sponsors/server.mjs`; its parent service starts both 4705 and 4706. For an isolated local run only, use `npm start --prefix services/sponsors/extension`. Never start both runners together. Run `npm test --prefix services/sponsors/extension` for HTTP and MCP smoke checks. The smoke uses an existing clinic if healthy; otherwise it briefly starts and closes its own server on 4706. `node smoke.mjs --existing` only tests an already running service and never binds a server. `node smoke.mjs --adversarial` additionally tests rejected redirects, oversized responses and replaced source content on 4706 when that port is free.

## API

- `createClinicServer()` returns an unbound Node HTTP server. The parent must listen on `127.0.0.1:4706`.
- `fetchClinic({})` reads only `http://127.0.0.1:4706/` and returns `{clinic,sourceUrl,fetchedAt,mode,evidence}`. Mode is always `local-http-fetch`. Nonempty input is rejected. It never follows redirects, uses a 3 second deadline and 32 KiB limit, and checks the received HTML hash against the authored synthetic fixture before extracting it.
- `getStatus()` reports current mode, limitations and prepared assets. It does not claim that the clinic is reachable until a fetch succeeds.
- `GET /health` returns `{ok:true,service:"sponsors-clinic",synthetic:true}`. `GET /` serves the fictional clinic and pharmacy with visible source fields and an embedded JSON directory.
- `POST /mcp` offers stateless MCP Streamable HTTP, protocol `2025-06-18` only, with `initialize`, `ping`, `tools/list` and `tools/call`. Initialization offers that version when the client asks for another; subsequent requests must use that version. Its sole tool, `care_circle_fetch_clinic`, takes `{}` and returns the same real local HTTP evidence. Include `Accept: application/json, text/event-stream`, `Content-Type: application/json` and `MCP-Protocol-Version: 2025-06-18`. Requests are limited to 8 KiB and 5 seconds. GET on `/mcp` returns 405 because no SSE stream is offered. Batch messages are not supported.

## Browser and UFO reality

`browser-actions.json` is a Care Circle workflow, not an official UFO manifest. It lists selectors and permitted actions for a browser driver. A real browser run should record its driver name, timestamp, URL, observed text and a screenshot or snapshot; it must remain separate from the HTTP evidence. No browser execution is claimed by this package.

Official public docs were read on 2026-09-27 using HTTPS GET requests:

- [UFO browser guide](https://ufo.ai/docs/cloud/browser/) documents browser tasks, isolated sessions and explicit action/evidence constraints.
- [UFO MCP guide](https://ufo.ai/docs/connectors/mcp/) documents reachable HTTP or HTTPS Streamable HTTP endpoints. Hosted UFO cannot use local stdio servers. Its hosted environment cannot reach this machine's loopback endpoint.
- [UFO terminal guide](https://ufo.ai/docs/work/terminal/) describes installation and sign-in. Neither installation nor sign-in was performed.
- [MCP transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) describes JSON responses, origin checks and optional GET/SSE behavior used by the local adapter.

No official UFO extension packaging schema was found in the public guides inspected. `ufo-task.md` is a ready task brief for an authorized, locally reachable browser session; the MCP endpoint is a tested adapter asset. Neither proves UFO execution. No account, remote connection, tunnel, publication or telemetry submission has occurred. Enabling hosted UFO access would require a separately authorized networking and data-submission plan from cc-lead; this package never enables one.

## Files and constraints

`index.mjs` owns HTTP, fetch and MCP behavior; `site.mjs` owns the static source; `server.mjs` is the optional standalone runner; `smoke.mjs` verifies behavior. No package dependencies, credentials, configurable URL, external assets, browser telemetry or patient data. Source changes intentionally change the expected hash. Error responses carry stable codes. The only accepted Host is `127.0.0.1:4706`; requests with Origin allow only the local web app and clinic origins.
