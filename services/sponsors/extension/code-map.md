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

## API

Export `createClinicServer()` as an unbound node:http Server; caller must listen on 127.0.0.1:4706. Export `fetchClinic({})` as Promise of `{clinic,sourceUrl,fetchedAt,mode,evidence}` with mode local-http-fetch. Export `getStatus()` as sponsor mode and limitations. GET /health returns `{ok:true,service:"sponsors-clinic",synthetic:true}`. GET / serves visible fields and the same embedded JSON source. POST /mcp exposes initialize, ping, tools/list and tools/call for the single read-only care_circle_fetch_clinic tool. Protocols 2025-03-26 and 2025-06-18 are supported with negotiation.

## Depends on

Parent [[code/sponsors]] owns the HTTP API on 4705 and persistent lifecycle integration with [[code/runtime]]. The [[code/world]] pharmacy name is mirrored as Demo Circle Pharmacy for narrative consistency; there is no import. Read those dependency pages before integration. Only this package's local files are imported. No family brain or credential access.

## Gotchas

Fixed URL is http://127.0.0.1:4706/. Nonempty caller input, redirects and any changed source HTML are rejected. Client deadline is 3 seconds and response limit 32 KiB; server deadline is 5 seconds and JSON body limit 8 KiB. Host must exactly match 127.0.0.1:4706. Origin, if present, must be the clinic or UI loopback origin. All data is synthetic, and the page footer is Not medical advice. Remote UFO cannot reach this loopback endpoint; no remote account, connection, tunnel, telemetry or official execution occurred. Browser actions remain prepared until a separate driver run records evidence. No URL configuration is permitted.

## Milestone evidence

2026-09-27 initial smoke passed health, visible source and pharmacy, repeated response hash, real extraction, caller-input rejection, Host/Origin rejection, MCP initialization/catalog/invocation, malformed JSON, fixed and chunked 8193-byte request rejection, redirects, oversized response, replaced fixture and 3 second timeout. All servers created by that adversarial smoke were closed. Public UFO browser, MCP and terminal guides were read, but no official extension packaging schema was located.
