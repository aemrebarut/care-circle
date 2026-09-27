# Care Circle family brain

The sole family GBrain owner. This Node service stores synthetic source pages, typed metadata, medication claims, citations, and idempotent ingest receipts in the real local GBrain 0.59 database through `scripts/brain`.

Care Circle organizes information and cites source records. It never recommends doses or treatments. All people, providers, records, and events are fictional. Not medical advice.

## Run and verify

```sh
node services/brain/server.mjs
npm test --prefix services/brain
node services/brain/smoke.mjs
```

The HTTP listener is fixed at `127.0.0.1:4701`. Coordinate persistent startup and restart with cc-runtime. The service binds before opening storage so a second copy fails before touching GBrain. Startup can take tens of seconds while source pages and links are verified. `/health` returns 503 until recovery finishes. The HTTP smoke is read-only and uses the already running service.

The existing family brain must be initialized separately through `scripts/brain` with embeddings disabled. Before opening a database, the service uses engine-free metadata to require local PGLite inside the dedicated family directory. It checks the exact `embedding_disabled` flag and normally sets `sync.write_through=false`. Native managed import temporarily enables write-through only after verifying that its effective canonical root is inside the dedicated family directory and its active owner is this host, then restores false in a finally block. The import copies source markdown into that existing GBrain content root; it does not alter the world package. It passes only PATH, HOME, and NO_COLOR to the wrapper, without provider credentials or remote storage overrides. It makes no external sponsor submissions or LLM calls.

For a fresh checkout on a machine with GBrain 0.59, run this once from the repository root before starting any service. The wrapper selects `~/Workspace/care-circle-brain/home` as GBRAIN_HOME; GBrain stores its configuration below that directory, not the user's primary brain. These flags were verified against the installed CLI. The existing demo brain was not reinitialized to test this runbook.

```sh
if [ -e "$HOME/Workspace/care-circle-brain" ] || [ -L "$HOME/Workspace/care-circle-brain" ]; then
  printf '%s\n' 'Family brain path already exists. Do not reinitialize it; start the existing service or inspect its setup.'
else
  mkdir -p "$HOME/Workspace/care-circle-brain/home" &&
    env -i PATH="$PATH" HOME="$HOME" scripts/brain init --pglite --no-embedding --non-interactive --no-git
fi
```

No `--force`, `--db-only`, remote database URL, credentials, source registration, or ownership transfer is needed. The normal PGLite initializer creates a dedicated canonical content owner, which native managed import needs. Never run plain `gbrain` here. After startup, other components use the HTTP API only.

## HTTP API

| Method | Path | Result |
| --- | --- | --- |
| GET | `/health` | Readiness, GBrain storage identity and revision |
| GET | `/v1/state` | Patient ID, typed pages, graph, revision |
| GET | `/v1/pages/:encodedId` | Source page; `%2F` IDs supported |
| GET | `/v1/medications` | Latest recorded visit claims and all source citations |
| GET | `/v1/graph` | Typed nodes and source relationships |
| POST | `/v1/ingest` | Durable visit, claim, question and idempotency receipt |
| POST | `/v1/reset` | Restore synthetic seed pages and clear this demo epoch's receipts |

POST bodies require `application/json`, with a 64 KiB limit. Ingest follows `docs/CONTRACT.md`. A request key repeated with identical payload returns its original response, including after restart. Reuse with different payload returns 409. IDs must resolve to allowed existing source types, dates must be real calendar dates, and unsupported fields are rejected. An empty attendee list or a source-only visit is valid. The source note and submitting author are stored separately from recorded attendees.

## Durability and recovery

GBrain page `care-circle/service-state` is the atomic commit record. It contains all typed pages, monotonic revision, ownership manifest, reset epoch, and the request hashes with exact ingest responses. There is no JSON-file database. First startup imports `packages/world/pages/` with `--no-embed`. Each entity is also materialized as a native GBrain markdown page with a final `care-circle-page` JSON fence preserving metadata, then native links are extracted.

The service serializes ingest and reset. It validates the whole mutation, commits the snapshot with an expected GBrain revision, materializes the changed entities, and extracts links before exposing the new revision. A failed projection leaves the service unavailable until repair. It never rolls back an already committed snapshot. A 503 after interrupted storage confirmation means the request may already be committed; retry the identical key and payload.

GBrain can return a nonterminal write receipt. The adapter replays the identical request UUID and intent. Before startup or recovery reads a snapshot, it commits an internal same-source barrier page. GBrain 0.59 drains database-only writes FIFO within one source incarnation, so the barrier ensures earlier admitted database writes have settled. Managed file imports use a separate worktree queue, so the adapter also refuses readiness while that worktree reports pending requests, recovery bytes, or recovering effects. Every operation explicitly selects the `default` source. This recovery assumption is specific to the installed GBrain version and should be rechecked on upgrades.

Restart rehydrates from GBrain and repairs native entity pages and links. A corrupt snapshot fails visibly rather than silently reseeding. Reset retains an explicit ownership manifest, including obsolete generated IDs, so interrupted deletion resumes safely. Unrelated pages and the brain directory are never deleted. A repeated reset increments the revision. Native pages are a recoverable projection; the HTTP service never exposes their partially applied state.

Shutdown retains the loopback listener until all owned CLI children and storage work have drained. The service does not kill the wrapper on timeout because that could leave a GBrain child holding PGLite open. An unusually stuck CLI may therefore require operator inspection; runtime must not force-kill it. HTTP requests retain their own bounded timeouts.

## Source interpretation and limits

The medication response displays the most recent visit claim as the recorded dose. Historical and pharmacy claims remain intact. A newer visit does not reconcile an unequal pharmacy claim. Reconciliation is not implemented in v1. Every citation is a literal excerpt from a resolvable source page. Long excerpts retain a bounded window around medication and dose evidence instead of clipping away the supporting text.

This local synthetic demo limits the canonical snapshot to 2 MB and serializes up to 20 queued writes. It is not a multi-user clinical database. GBrain is real; River training, Memorable submissions, and UFO execution are outside this service and are not claimed here.

## Files

`server.mjs` owns HTTP and lifecycle. `gbrain.mjs` is the only CLI adapter. `store.mjs` coordinates snapshots, projection, reset, and recovery. `domain.mjs` validates and constructs source-preserving mutations. `store.test.mjs` and `domain.test.mjs` cover restart, idempotency, failure recovery and validation. `fixtures/demo-ingest.json` is the brain lane's own synthetic integration payload.
