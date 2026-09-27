---
type: note
title: Sponsors synthetic clinic and local adapter
---

# code/sponsors-extension

## Purpose

Serve a fully fictional clinic and pharmacy directory, extract its contact details through a real fixed-URL local HTTP request, and prepare browser and MCP adapter assets without claiming official UFO execution. The response hash proves the reader received the authored synthetic source.

## Run

Parent command: `node services/sponsors/server.mjs` starts 4705 and 4706. Standalone package command: `npm start --prefix services/sponsors/extension`. Use only one runner. `npm test --prefix services/sponsors/extension` validates an existing healthy service or briefly starts and closes its own server. `node services/sponsors/extension/smoke.mjs --adversarial` requires free port 4706 and also checks redirect, response size, substituted content and timeout failures.

## Files

`index.mjs`: createClinicServer, fetchClinic, getStatus, bounded HTTP and read-only MCP. `site.mjs`: static synthetic source. `server.mjs`: optional standalone runner. `smoke.mjs`: behavior checks. `browser-actions.json`: driver-neutral local browser recipe, not an official UFO manifest. `ufo-task.md`: bounded task brief. `README.md`: public official documentation references and sponsor reality.

`ufo-package/`: authored Python package registered through the official ufo.extension entry-point format, pinned to ufo-ai/ufo-core commit 63ba388ed449ff46c9d70744119dffc85df0fbf8. Its manifest uses public SDK types only. Its independent bounded transport calls the fixed parent sponsor HTTP endpoint without proxies or redirects. SDK dependencies live only in its ignored .venv. `smoke_transport.py` verifies transport behavior offline; `smoke_sdk.py` produces isolated real SDK proof receipts with fake transport by default.

## API

Export `createClinicServer()` as an unbound node:http Server; caller must listen on 127.0.0.1:4706. Export `fetchClinic({})` as Promise of `{clinic,sourceUrl,fetchedAt,mode,evidence}` with mode local-http-fetch. Export `getStatus()` as sponsor mode and limitations. GET /health returns `{ok:true,service:"sponsors-clinic",synthetic:true}`. GET / serves visible fields and the same embedded JSON source. POST /mcp exposes initialize, ping, tools/list and tools/call for the single read-only care_circle_fetch_clinic tool. Only protocol 2025-06-18 is supported; initialization offers June when another version is requested. Batch messages are rejected.

## Depends on

Parent [[code/sponsors]] owns the HTTP API on 4705 and persistent lifecycle integration with [[code/runtime]]. The [[code/world]] pharmacy name is mirrored as Demo Circle Pharmacy for narrative consistency; there is no import. Read those dependency pages before integration. Only this package's local files are imported. No family brain or credential access.

## Gotchas

Fixed URL is http://127.0.0.1:4706/. Nonempty caller input, redirects and any changed source HTML are rejected. Client deadline is 3 seconds and response limit 32 KiB; server deadline is 5 seconds and JSON body limit 8 KiB. Host must exactly match 127.0.0.1:4706. Origin, if present, must be the clinic or UI loopback origin. All data is synthetic, and the page footer is Not medical advice. Remote UFO cannot reach this loopback endpoint; no remote account, connection, tunnel, telemetry or official execution occurred. Browser actions remain prepared until a separate driver run records evidence. No URL configuration is permitted.

## Milestone evidence

2026-09-27 initial smoke passed health, visible source and pharmacy, repeated response hash, real extraction, caller-input rejection, Host/Origin rejection, MCP initialization/catalog/invocation, malformed JSON, fixed and chunked 8193-byte request rejection, redirects, oversized response, replaced fixture and 3 second timeout. All servers created by that adversarial smoke were closed. Public UFO browser, MCP and terminal guides were read, but no official extension packaging schema was located.

Independent review fixes verified against the runtime-owned service with `node services/sponsors/extension/smoke.mjs --existing`: malformed request IDs are rejected, unknown tool and method errors use distinct codes, only June 2025 protocol is accepted after negotiation, and incomplete headers receive HTTP 408 within 7 seconds. This verification performed no bind, process signal, reset or remote submission.

Official Python SDK follow-up: the pinned ufo distribution installed successfully. Offline SDK entry-point discovery, Manifest/ToolDef construction, schema generation and direct handler success/failure tests passed. A guard prevents all network connections, DNS, binds and subprocesses during this proof; urllib3's attempted IPv6 availability bind is blocked and recorded as the sole expected capability probe. No credentials are inherited or read. Proof is official-sdk-local-tool-proof with offline-fake-transport, not a full runtime or hosted UFO execution. Transport tests also prove that the total deadline shuts down a socket detached by HTTPConnection and that early response rejection closes the HTTPResponse. Live invocation remains separately scheduled by parent/runtime.
