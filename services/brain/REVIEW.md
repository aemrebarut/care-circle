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
- Independent follow-up review found malformed ownership metadata could coerce null, false, or empty counters to zero, and absent host IDs could compare equal. Quiescence now requires numeric zero or canonical string `0`; import requires explicit nonempty matching host IDs. Missing thin-client metadata is also rejected. Missing/null/malformed counter and identity regressions bring the full suite to 38 passing tests.

## M2, 15:35 Pacific

Runtime loaded the reviewed build through `e171089` into owned brain PID 4515. Exact HTTP state equality preserved revision 10, 32 pages and 132 graph edges. All-service and owner smokes passed. The brain lane independently ran `node services/brain/smoke.mjs`: all seven medications and their literal source citations passed. New storage containment and managed-import quiescence checks passed on the actual setup. No reset occurred during maintenance. QA's consecutive end-to-end cycles remain a separate upcoming gate.

## Runbook review, 15:42 Pacific

World review findings WR-RB-01 and WR-RB-02 are addressed. The README now lists Node.js 22+, Bun 1.3.11+ and GBrain 0.59 as the verified prerequisites, links official GitHub installation guidance, and identifies the unrelated npm package. Initialization precedes managed startup through `scripts/start brain`; optional foreground startup explicitly requires a second terminal for checks. Verification used installed runtime-version source, the public upstream install section, and the repository runtime launcher. This was a documentation-only correction; no installation, initialization, shared-state mutation or process restart was performed.

## M3, 15:55 Pacific

The final independent Astra xhigh storage review confirmed the mixed-queue recovery fence, effective canonical path and host checks, and uncertain-enable restoration are closed. It found no remaining concrete high-impact storage defect. The isolated adapter suite passed 9 of 9 tests; the latest complete suite remains 38 of 38. Live read-only HTTP smoke passed revision 10, 32 pages, seven medications and 132 graph edges before QA's final two-cycle window.

The macOS default Git launcher began returning an Xcode license error. Repository commands now use a per-invocation CommandLineTools PATH; no license or system settings changed. The service inherits PATH for its CLI children, and installed GBrain native import discovery and optional Git durability effects can invoke Git. A PATH-only process restart was requested from runtime, queued behind QA's exclusive window. Normal existing-snapshot writes use database-only mode; no live mutation failure is claimed. Implementation is held stable pending QA receipts and runtime's scheduling decision.

## Paused handoff, 15:57 Pacific

Emre paused the track and requested wrap-up before freeze. All three native brain subagents were notified; this lane owns no Herdr subagents. No new implementation or tests followed the pause. Runtime-owned PID 4515 remains running, and the queued PATH-only restart is deferred until explicit resume.

QA's accepted reset advanced to revision 11 with 30 seed pages. A later already accepted mutation reached revision 12 with 31 pages. The last minimal health observation at 15:57 returned 503 with status `committing`: the canonical snapshot had committed and projection was still draining. It was not interrupted, retried or reset. No new Git-related service error was observed. QA/runtime own the final operation receipt and must preserve the accepted write. The final two-cycle acceptance gate is not claimed complete.

On explicit resume, first read the final QA/runtime receipt and check readiness. If necessary, runtime can perform the approved exact-state-preserving restart with the per-process CommandLineTools PATH, then read-only smoke. Resume acceptance only in an explicit QA mutation window. Existing storage and citation review is complete; the latest full test suite passed 38 tests. Lead owns the consolidated `docs/NEXT_STEPS.md`.

Final permitted settlement observation: GET `/health` returned HTTP 200, `ready`, revision 12 and 31 pages. The accepted mutation drained successfully without interruption, retry, reset or restart. No brain-owned operation remains in flight. The QA driver receipt and final two-cycle acceptance remain separate evidence.
