# Care Circle UFO Python extension

An authored Python extension using the official UFO SDK and `ufo.extension` entry-point format. Its only tool, `care_circle_clinic_lookup`, reads the Care Circle synthetic clinic through the fixed local sponsor API. It takes an empty object, reads no credentials or runtime context, and marks source text untrusted. Not medical advice.

## Official contract and scope

The source is the official [ufo-ai/ufo-core repository](https://github.com/ufo-ai/ufo-core), linked by the UFO documentation footer. SDK distribution `ufo` version `0.1.0` is pinned to commit `63ba388ed449ff46c9d70744119dffc85df0fbf8` in `pyproject.toml`.

- [Extension packaging](https://github.com/ufo-ai/ufo-core/blob/63ba388ed449ff46c9d70744119dffc85df0fbf8/README.md#extend-it): Python package with a `ufo.extension` entry point.
- [Official sample](https://github.com/ufo-ai/ufo-core/blob/63ba388ed449ff46c9d70744119dffc85df0fbf8/extensions/sample/ufo_ext_sample/manifest.py): `Manifest`, `ToolDef`, typed input and async handler.
- [Public tool types](https://github.com/ufo-ai/ufo-core/blob/63ba388ed449ff46c9d70744119dffc85df0fbf8/core/src/ufo/sdk/tools.py): `ToolContext`, `ToolResult` and `TextContent`.
- [Extension specification](https://github.com/ufo-ai/ufo-core/blob/63ba388ed449ff46c9d70744119dffc85df0fbf8/spec.md#extension-system): manifest and deployment boundaries.

This targets the reviewed, in-process Python mechanism on a self-host deployment. The separate third-party JavaScript runner design in the specification blocks loopback and is not the format implemented here. No store compatibility, publication, hosted execution, account setup or full UFO runtime run is claimed.

## Install and offline verification

The verified environment uses Python 3.14.7. From this directory, create a local environment with `python3 -m venv .venv`, then install the package with `uv --no-config pip install --python .venv/bin/python --constraint sdk-constraints.txt --editable .`. The portable constraints record the dependency versions used by the proof; the SDK source commit is pinned in `pyproject.toml`. No upstream code is committed to Care Circle. No CLI account setup or UFO server is needed.

Run `python3 smoke_transport.py` for dependency-free transport tests. Run `python3 smoke_sdk.py` for installed SDK entry-point discovery, official type construction, tool schema generation and direct handler calls against a fake transport. The latter writes `evidence/sdk-offline.json` only after success. Its child receives a fresh environment with no inherited credentials, disables the OpenTelemetry SDK, denies socket connections/DNS/server binds/subprocesses, and permits file reads only inside this package, the Python installation and macOS's public version plist. The SDK's OTel initialization function is not called. Import-time core skill reads remain inside the SDK package. urllib3 attempts an IPv6 availability bind during import; the audit guard prevents it, and the receipt explicitly records that denied probe. Any other prohibited operation fails the proof.

The proof distinguishes `officialSdkRegistration` and `officialSdkToolInvocation` from `officialUfoExecution`, which stays false. Direct handler testing does not execute UFO's full runtime dispatcher, grant system or model loop. The context is `None` because this tool never accesses it.

## Verified local SDK invocation

The parent ran `python3 smoke_sdk.py --live` once at 2026-09-27 22:36:13 UTC during runtime window `cc-runtime-local-proofs-20260927-1535`. The committed [live receipt](evidence/sdk-live.json) records installed SDK registration and a direct SDK handler invocation using real loopback HTTP. It made one fixed `POST /v1/clinic/fetch` to 127.0.0.1:4705; the sponsor service fetched its synthetic page at 127.0.0.1:4706. The observed clinic fields, 3135 response bytes and SHA256 match the authored page. The returned source remains labeled `local-http-fetch`.

This is actual SDK type/schema/handler execution with a real local source. `officialUfoExecution`, `fullRuntimeExecution` and `hostedExecution` remain false. No model, account, remote telemetry, browser action or full runtime dispatcher was used. The audit receipt records one allowed loopback connection and the prevented urllib3 IPv6 capability probe.

Any repeat of `python3 smoke_sdk.py --live` requires another explicitly released runtime/QA window. The opt-in command permits only `127.0.0.1:4705` and replaces the live receipt. Do not rerun it during a reserved QA window.

## Runtime behavior

The handler performs only `POST http://127.0.0.1:4705/v1/clinic/fetch` with `{}` using Python `http.client.HTTPConnection` and the literal loopback address. There is no proxy support, configurable URL, redirect following or cross-service import. A 5 second total deadline closes the socket; the response limit is 64 KiB. The response must identify the synthetic source, retain `mode: local-http-fetch`, and state `officialUfoExecution: false`. SDK results preserve that response without relabeling it as a browser run.

Files: `src/ufo_ext_care_circle/manifest.py` declares the tool; `transport.py` handles bounded HTTP; `smoke_transport.py` checks rejection cases without networking; `smoke_sdk.py` creates isolated SDK proof receipts. The root sponsor service needs no change or restart for this package.
