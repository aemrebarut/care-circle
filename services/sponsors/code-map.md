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
- services/sponsors/extension/: Fictional site, HTTP fetch, local UFO adapter assets.

## API

4705: GET /health, GET /v1/status, POST /v1/procedure/capture, POST /v1/procedure/replay, GET /v1/procedure/memorable-payload, POST /v1/clinic/fetch, POST /v1/reset. POSTs are bounded JSON objects. 4706: GET / and GET /health, service sponsors-clinic.

## Depends on

Shared ports and IDs from contract/index.mjs. Integration with [[code/web]] via loopback HTTP and [[code/runtime]] for lifecycle. Internal component pages: [[code/sponsors-procedure]] and [[code/sponsors-extension]]. No family brain storage is opened and no other lane is imported.

## Gotchas

All procedure execution is local-simulation. Clinic extraction is real local-http-fetch, not verified UFO execution. No remote sponsor authorization, keys, accounts, or submissions. Memorable payload export is review-only. Captures are ephemeral; reset and restart require a new capture before replay. Only fixed clinic URL accepted. Browser origin is restricted to the local UI; API Host must be 127.0.0.1:4705. Both ports must be free at startup.

## Milestone

Early integration passed: node services/sponsors/smoke.mjs verified health, capture, distinct sibling replay, payload export, repeated local clinic fetch, reset and bounded input/Origin/Host errors. Component suite passed 10 procedure tests plus HTTP/MCP smoke. Persistent lifecycle handed to runtime after exact own dev PID 87423 stopped. Runtime and world dependency pages read; web page not yet present. No remote sponsor execution. Browser tool had no connected browser, so browser execution remains unverified. Independent review fixes cover absolute request deadlines and MCP envelope validation.
