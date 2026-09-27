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

The [official Memorable documentation](https://www.memorable.sh/doc), checked on 2026-09-27, describes `POST /v1/extract` at `https://memorable-extraction-api.memorable.workers.dev`. Its example sends `session_id`, `task_description`, `harness`, and `tool_calls` containing `name`, `input`, and `result`. It uses the variable name `MEMORABLE_API_KEY` for authorization and returns a `draft` plus `request_id`.

`memorable-adapter.mjs` maps the synthetic capture to that example format. Custom tool interpretation and response compatibility remain unverified remotely. Its `submitMemorable()` function always throws `EXTERNAL_SUBMISSION_NOT_AUTHORIZED`; the service never submits on startup or on API capture/replay. The separately reviewed opt-in runner is locked behind an explicit approval record. No account, login, hook installation, credential access, telemetry or remote extraction has run while preparing these assets.

The exact proposed request is committed at `assets/memorable-request.json`. `assets/manifest.json` records its SHA-256, byte count, endpoint and review status. `assets/capture-trace.json` and `assets/replay-trace.json` show the complete local evidence. Tests verify these assets against the current deterministic implementation. Run `npm --prefix services/sponsors/procedure run build:assets` after intentionally changing the local fixtures or procedure. This regeneration writes only these local assets and never submits them.

## Official local recall proof

Unmodified `memorable-cli@0.5.30` successfully ran `recall`, `show` and `list` against a manually seeded synthetic local procedure. The recall matched through the lexical tier. Care Circle authored the fixture; Memorable did not extract or learn it. The web API still uses the local simulation engine. `assets/memorable-local-proof.json` contains the observed output, version, source hash and isolation receipts. `assets/memorable-local-procedure.json` is the exact manual fixture. Original output hashes are retained; dash punctuation in displayed output is normalized to ASCII.

```sh
npm --prefix services/sponsors/procedure run prepare:memorable
npm --prefix services/sponsors/procedure run proof:memorable
```

Preparation explicitly downloads the pinned official npm package with install scripts disabled, using isolated npm config and cache. Its archive integrity and CLI hash are verified. It does not execute Memorable. The package stays under ignored `.runtime/` and is never redistributed or modified.

The proof requires Node 26 with network permission enforcement. A child process first proves that filesystem reads and writes, network connections and child processes are denied. Only then does the unmodified CLI run with read access to the downloaded package and owned synthetic fixture folder. All writes, network and child processes remain denied. Its environment contains only four explicit non-credential settings, with no inherited values and no HOME override. The fixture consent is read-only; no login, enable, initialization, hooks or credential store is used. CLI `ingest` and `record` require hosted extraction and were not run.

## Pending single-request runner

`memorable-submit.mjs` is a prepared CLI, not an authorization. It refuses by default. Only cc-lead may write `contract/memorable-approval.json`, using `assets/memorable-approval-template.json` after an actual Emre approval. The record must authorize one synthetic extraction, name the exact payload hash and byte count, name `MEMORABLE_API_KEY`, and supply a real approval reference and timestamp. The template's `approved:false` cannot authorize a request.

After that approval is recorded and Emre supplies the named variable to the authorized process, the concrete command is:

```sh
node services/sponsors/procedure/memorable-submit.mjs --send \
  --approved-payload-sha256 994c84515254b5e26114a7249ef3bf56e106503ac1e21560fccd2ab620c0bf32 \
  --approval-reference ACTUAL_RECORDED_REFERENCE
```

The runner reads the process credential only after validating every gate. It makes one POST to the fixed documented endpoint, refuses redirects, imposes a 15-second timeout and 256 KiB response limit, validates the response schema, rejects credential reflection and aborts the transport on every exit. It never retries. An exclusive attempt marker prevents repeat submission, including after failure. Returned steps are saved as inert data and never executed. The receipt and response stay under ignored `.runtime/submission/`; keys and request headers are never saved or printed.

Status verifies successful receipt hashes and schemas. An attempted request with no validated receipt reports `remoteAttempted:true`, `remoteSubmitted:null`, `delivery:unknown` and `outcome:unvalidated-or-failed`. Past attempt history remains visible even if approval is later revoked. Authorization state is reported separately, and `remoteSubmissionEnabledInService` is always false. Demo reset never clears submission history or its one-attempt marker. All runner tests use local fake transports. This component never opens the family GBrain directly.
