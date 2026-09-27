# Synthetic procedure capture and replay

This component records a deterministic local administrative prior-authorization rehearsal. Ana captures a six-step tool trace and Ben reuses the recorded procedure. Each run includes tool inputs, outputs, preconditions, postconditions, fixture excerpts and SHA-256 evidence. All people, documents, insurer details and results are synthetic. Execution is a simulation: no insurer is contacted and no coverage decision is made. Not medical advice.

The working API path is implemented by Care Circle. It has not been learned, extracted or replayed by Memorable. Captures live only in the sponsor process memory and are cleared on reset or restart. The parent sponsor service owns HTTP, health checks and port 4705. The API module opens no sockets and requires no dependency install. A separate isolated test proves actual official Memorable local recall, as described below.

The September 27 local rehearsal uses the synthetic world's Demo Family Health Plan case `DEMO-PA-2026-0918`, a nephrology follow-up referral authorization. It does not change the September 18 or September 22 insurer call pages, their historical statuses, or any family brain record. The simulated pending-review status describes only this new local rehearsal, not a claim about the insurer's current state.

## Run

```sh
npm --prefix services/sponsors/procedure test
node services/sponsors/procedure/export.mjs
```

The export command prints a synthetic, unsent review artifact to standard output. It does not read a credential or perform a network operation.

## API

- `capture({actorId?}={})` returns `{procedureId,steps,mode,evidence}`. Default actor is `people/ana-alvarez`.
- `replay({procedureId?,actorId?}={})` returns `{procedureId,actorId,steps,result,mode,evidence}`. Defaults to the latest capture and `people/ben-alvarez`. Capture is required first; replay must use a different sibling.
- `getMemorablePayload({procedureId?}={})` returns the documented extraction body under `payload`, together with explicit unsent review metadata. Defaults to the latest capture.
- `reset()` returns `{ok:true}` and clears only this process's procedure state.
- `getStatus()` returns local mode, limitations, capture/replay counts and sponsor truth labels.

Allowed actors are Ana, Ben and Celia's stable `people/<name>-alvarez` IDs. Unknown fields, invalid actors and invalid procedure IDs are rejected. Errors have integer `status` and string `code` for the parent HTTP service. The mode is always `local-simulation`; export mode is `local-export-only`.

Each step is `{index,tool,input,output,sourceIds,precondition,postcondition,status}`. The plan reads a fictional member record, reads a request, reads requirements, assembles a synthetic packet, simulates submission and records an administrative follow-up question. Only fixed internal tools can run. Input cannot supply tools, commands, source URLs or documents.

`evidence.sourceGrounding` resolves every step's fixture source ID to an exact excerpt and hash. These are local component fixtures, not claims read from GBrain. Identical inputs and reset state produce identical IDs and outputs. Replay evidence links back to the capture trace while replacing actor-dependent inputs. Returning cloned data prevents callers from mutating stored procedures.

## Memorable adapter reality

The [official Memorable documentation](https://www.memorable.sh/doc), checked on 2026-09-27, describes `POST /v1/extract` at `https://memorable-extraction-api.memorable.workers.dev`. Its example sends `session_id`, `task_description`, `harness`, and `tool_calls` containing `name`, `input`, and `result`. Its response example contains a `draft` plus `request_id`.

`memorable-adapter.mjs` maps the synthetic capture to that example format. Custom tool interpretation and response compatibility remain unverified remotely. Its `submitMemorable()` function always throws `EXTERNAL_SUBMISSION_NOT_AUTHORIZED`; the service never submits on startup or on API capture/replay. Emre explicitly declined remote Memorable submission. The production CLI is now unconditionally disabled, regardless of flags or records. No account, login, hook installation, credential access, telemetry or remote extraction has run.

The exact proposed request is committed at `assets/memorable-request.json`. `assets/manifest.json` records its SHA-256, byte count, endpoint and review status. `assets/capture-trace.json` and `assets/replay-trace.json` show the complete local evidence. Tests verify these assets against the current deterministic implementation. Run `npm --prefix services/sponsors/procedure run build:assets` after intentionally changing the local fixtures or procedure. This regeneration writes only these local assets and never submits them.

## Official local recall proof

Unmodified `memorable-cli@0.5.30` successfully ran `recall`, `show` and `list` against a manually seeded synthetic local procedure. The recall matched through the lexical tier. Care Circle authored the fixture; Memorable did not extract or learn it. The web API still uses the local simulation engine. `assets/memorable-local-proof.json` contains the observed output, version, source hash and isolation receipts. `assets/memorable-local-procedure.json` is the exact manual fixture. Original output hashes are retained; dash punctuation in displayed output is normalized to ASCII.

```sh
npm --prefix services/sponsors/procedure run prepare:memorable
npm --prefix services/sponsors/procedure run proof:memorable
```

Preparation explicitly downloads the pinned official npm package with install scripts disabled, using isolated npm config and cache. Its archive integrity and CLI hash are verified. It does not execute Memorable. The package stays under ignored `.runtime/` and is never redistributed or modified.

The proof requires Node 26 with network permission enforcement. A child process first proves that filesystem reads and writes, network connections and child processes are denied. Only then does the unmodified CLI run with read access to the downloaded package and owned synthetic fixture folder. All writes, network and child processes remain denied. Its environment contains only four explicit non-credential settings, with no inherited values and no HOME override. The fixture consent is read-only; no login, enable, initialization, hooks or credential store is used. CLI `ingest` and `record` require hosted extraction and were not run.

## Capture to official recall to Ben replay

The standalone bridge connects the actual synthetic capture to official recall and then to replay, without changing the service API:

```sh
npm --prefix services/sponsors/procedure run proof:bridge
```

It captures Ana's trace in process, serializes that trace into a local Memorable procedure row, runs the pinned official CLI under the same isolation, parses the returned procedure ID, and passes that exact ID to Ben's simulated replay. It refuses missing or ambiguous recall results and verifies that replay's `captureTraceId` equals Ana's capture trace. `assets/memorable-bridge-proof.json` records this successful offline chain with capture/replay response hashes and official command output. No service state or listener is touched. The row is authored from the capture by Care Circle; `manualSerialization:true` and `officialLearning:false` remain explicit.

An optional `--live --runtime-window-reference ACTUAL_PARENT_GRANTED_WINDOW` invocation of `memorable-bridge.mjs` is reserved for a safe window explicitly granted by the parent and runtime coordinator. It makes exactly two bounded local requests: capture `{}` at `http://127.0.0.1:4705/v1/procedure/capture`, then replay with the officially recalled ID and Ben's actor ID at `/v1/procedure/replay`. It makes no reset, brain, restart or remote sponsor requests. Each local request has an 8-second timeout, a 128 KiB response limit, redirect refusal and no retries. The official CLI still has no network permission. Live evidence, if authorized and run, is written to ignored `.runtime/live-bridge/receipt.json`. The parent ran the local-only bridge once at 2026-09-27T22:36:09.277Z under runtime window `cc-runtime-local-proofs-20260927-1535`, then released the window. That run passed with exactly two loopback requests, the official recalled ID selecting Ben replay, and matching capture trace IDs. No further live invocation is authorized by that completed window.

The exact parent-produced receipt is preserved at `assets/memorable-live-bridge-proof.json`, with source path, runtime-window reference, byte count and SHA-256 in `assets/memorable-live-bridge-manifest.json`. Promotion copied the 7568-byte receipt unchanged; its SHA-256 is `f5476befa70d48ffa2638f3a8aacf0f85c6a5091cb2a868cf5a3f5607fb85ef2`. Promotion performed no live requests.

## Remote submission declined

Emre explicitly declined remote Memorable submission. `memorable-submit.mjs` returns `MEMORABLE_REMOTE_SUBMISSION_DENIED` before inspecting flags, reading records or accessing credentials. There is no production transport or credential-reading path. The obsolete approval template and operational upload instructions were removed. No key, account or approval record is needed or requested.

The exact 3189-byte request remains an unsent historical review artifact with SHA-256 `994c84515254b5e26114a7249ef3bf56e106503ac1e21560fccd2ab620c0bf32`. Its manifest records the denied decision. The API reports `externalSubmissionAuthorized:false`, `authorizationDecision:denied` and `remoteSubmissionEnabledInService:false`; local simulation and official offline recall remain available.

Historical receipt validation is retained so previously recorded actions would not disappear from status. No remote attempt exists for this track. Fake-response and transport tests live in a separate test-only module using a fixed synthetic marker and no production credential provider. Production CLI tests prove unconditional refusal with filesystem/network access denied and a trap that fails on any key read. This component never opens the family GBrain directly.
