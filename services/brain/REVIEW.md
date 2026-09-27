# Brain lane verification

All records and fixtures are synthetic. Review and implementation used only Astra with xhigh reasoning. This lane owns only `services/brain/`; cc-runtime owns the persistent process.

## M1, September 27 at 15:15 Pacific

Implementation commit: `e95452d`, pushed to the public Care Circle repository.

- `npm test --prefix services/brain`: 27 passing tests. Domain validation, source preservation, exact citations, future visit rejection, doctor chronology, HTTP limits, and storage fault models pass.
- Real GBrain put/get roundtrip preserved fenced JSON types, arrays, and values. Stdin writes returned committed receipts. The lane's temporary synthetic probe pages were soft-deleted.
- Native `scripts/brain import` with `--no-embed` committed all 30 actual world markdown pages with zero errors. GBrain 0.59 required temporary write-through into its existing canonical content root. The adapter verifies that root is inside the dedicated family brain and restores database-only writes in a finally block.
- `git diff -- packages/world` was empty after import. `scripts/brain config get sync.write_through` confirmed false. No source registration, ownership transfer, or database reinitialization occurred.
- cc-runtime reported exact full HTTP state equality after restart `80970` to `95456`: revision 1, 30 pages, 120 graph edges. All seven service health endpoints passed.
- cc-world independently read every source through HTTP: 30 IDs, seven medications, 21 literal seed/API citations, and 120 resolving graph edges passed.
- cc-ingest reported canonical demo ingest plus identical retry through port 4702 returned the same revision 2 and visit `visits/ingest-70c7a8a9face7c4158c7be49`. Verbatim note, author versus attendance, single added medication claim, retained 10 mg source, citation, and question passed.
- At 15:16, cc-runtime reported exact full post-ingest state equality after graceful restart `95456` to `19257`: revision 2, 32 pages, 132 graph edges. The brain lane's own live read-only `node services/brain/smoke.mjs` passed those counts and all seven medication citation sets. A 503 observed during the coordinated restart was expected; smoke now waits up to 180 seconds for startup or recovery readiness.
- At 15:17, cc-ingest repeated the identical canonical request after that process restart. It returned the original visit and revision 2, and the full HTTP state remained unchanged. Runtime released the shared-state mutation window to QA afterward.

## Storage review and fault boundaries

An independent Astra xhigh storage reviewer inspected installed GBrain 0.59 source, without opening family storage. `src/core/persistence/journal.ts`, `claimNextWrite`, lines 158 through 161, refuses a later write while an earlier sequence with the same `COALESCE(worktree_id, 'db:' || source_incarnation)` remains queued, running, or recovering. The service pins ordinary writes and recovery barriers to the default source with write-through disabled. A committed barrier therefore precedes snapshot reads on startup and recovery.

The review found and the implementation corrected these issues:

- A pending GBrain write is an exit-1 `write_pending` receipt, with queued/running/recovering states. The adapter replays the exact UUID and intent, and recovery drains admitted writes before selecting a snapshot.
- Killing a wrapper could release its lock while a child still holds PGLite. The service lets owned CLI work exit, keeps its port bound during shutdown drain, and handles repeated termination signals safely.
- Singular `pharmacy/` ownership must survive real-seed snapshot decoding. The actual-world regression covers it.
- Future visits must not become current records in the fixed September 27 demo. They fail with 422 without mutation; future follow-up due dates remain valid.
- Doctor metadata and displayed last-visit prose must advance together, citing the causing source visit. Backdated notes cannot regress them.

Storage unit tests simulate transport loss after a queued snapshot, restart with pending journal work, interrupted entity projection, and interrupted reset cleanup. They also assert that unrelated pages survive reset and corrupt state never silently reseeds. These are fault models, not claims of destructive live crash testing. Real process restart checks are performed separately by runtime.

## Sponsor reality

GBrain storage, native markdown import, typed metadata persistence, and link extraction are real. No embeddings, LLM calls, uploads, training submissions, telemetry traces, accounts, or sponsor publications were made by this service.

## Follow-up storage and citation review, 15:22 Pacific

- A second storage review identified that native managed imports and database-only writes use separate journal ordering groups. Startup and recovery now also require the selected worktree's queued, running, recovering, recovering-effects, and recovery-bytes counters to be zero before choosing a snapshot. Native import checks the same condition after completion.
- Canonical import containment now resolves the effective local path plus relative path, and requires the recorded owner to match the local host. Enabling write-through is inside the try/finally block so an uncertain enable still attempts restoration.
- Engine-free preflight refuses remote engines, thin clients, and database paths outside the dedicated family directory before any database opens. Read-only metadata on the actual setup confirmed PGLite, no thin client, and correct containment without a connectivity probe.
- A 1,609-character source note reproduced a citation that omitted both medication and dose after clipping. The fix selects a literal window around the relevant evidence and repairs previously clipped citations from the retained source note. Regressions include long prefixes and suffixes, dose-first wording, and Unicode prefixes.
- `npm test --prefix services/brain`: 36 passing tests. These changes await a runtime-controlled restart after the QA browser mutation window; no shared state was mutated by this follow-up work.
