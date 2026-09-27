# Independent review milestones

## M1, 15:15 Pacific

Review artifact owner: cc-review, docs/reviews/ only. No reviewer implementation edits, credentials, external submissions or shared-state mutations.

### Direct evidence

- Brain health returned 200 with storage gbrain, ready status, revision 1 and 30 pages before the coordinated first-write window.
- After the ingest owner completed the canonical note and retry, a read-only audit passed at revision 2. The final check still returned revision 2. State contained 32 pages, 132 resolving graph edges and seven medications.
- Visit visits/ingest-70c7a8a9face7c4158c7be49 preserved the note, Ana as author, and Ana as recorded attendee. The latest recorded lisinopril dose was 20 mg daily, while the 10 mg pharmacy source remained an unresolved contradiction with both source IDs.
- Forty citation instances across medication responses, grounded answer, contradiction and brief matched literal source text and resolved to the expected title. The answer explicitly said source records do not confirm actual use.
- The nephrology brief used September 15 as cutoff and contained two actual medication changes, three other visits and three open questions, including potassium. It retained synthetic and Not medical advice framing.
- Reviewer released the read-only audit window to cc-runtime and cc-qa before their reset work.
- Pure tests executed by reviewer or independent Astra xhigh subreviewers: initial extraction 31/31, later extraction 40/40 plus 24 targeted assertions, brief domain 12/12, brain domain 18/18, brain storage 8/8, River evaluation regressions 18/18. These are distinct snapshots and suites, not a summed test total.
- River v2 corpus parsed read-only: 336 train, 72 development and 72 test records. Checked IDs, template families, case IDs, entity groups and normalized notes had no cross-split overlaps. All 480 gold schemas and declared corpus/prompt/held-out hashes passed. This verifies synthetic benchmark preparation, not model quality.

### Owner-reported evidence

- cc-runtime completed a real baseline brain restart proof preserving revision 1, 30 pages and 120 edges, then all-service smoke.
- cc-brain reported native GBrain import of 30/30 pages, unchanged packages/world, and write-through restored false. The adapter checks realpath containment before temporary write-through. Contract 7db93a3 matches this native import path; trusted per-page writes are a fallback only.
- cc-brain supplied installed GBrain journal source evidence at src/core/persistence/journal.ts 158-161 for same-source FIFO blocking behind earlier queued, running or recovering writes. The service pins regular writes to the default database-only source. Reviewers inspected barrier ordering and request UUID replay without opening family storage.
- cc-ingest reported the larger HTTP/extraction suite and first canonical ingest plus exact retry. The reviewer independently inspected its resulting source state, not the write operation itself.
- Sponsor lane has native Chrome evidence of the local fictional clinic. Local procedure replay and HTTP fetch are implemented; official Memorable learning and official UFO execution remain unclaimed.

### Open at this milestone

- R8 P2: runtime stale-lock recovery must retain live unknown owners; identity inequality alone is insufficient proof of death. Owner notified with the existing fixture as evidence.
- Two complete coordinated reset-to-demo passes and browser interaction/print evidence remain release gates.
- No verified River trained-model comparison or live River extractor is claimed by this review. Training progress is separate from evaluation completion.

All other R1 through R13 findings are closed by the stated direct tests or source inspections. This milestone is not final release sign-off.

### M1 follow-up, 15:16 Pacific

R8 is closed after direct review of both absent-PID checks and the corrected fixtures. cc-runtime reports 17/17 lifecycle tests passing. A post-ingest restart and identical retry are now coordinated by runtime and ingest before QA resets. No reviewer mutation is involved.

### Follow-up, 15:25 Pacific

- cc-runtime reports exact post-ingest state surviving PID 95456 to 19257: revision 2, 32 pages and 132 edges. cc-ingest then reports the original visit/revision returned by retry with deep-equal before/after state. These executions are owner receipts, not reviewer-operated restarts.
- Root README review found the reported River results and caveats consistent with comparison.json, paired-proof.json and the independent native audit. Both arms have 72 rows. Trained structured extraction is 72/72 and full task 71/72; base strict success is 0/72, with 54 token-cap truncations. The same prompt/settings and 1,024-token raw-completion budget are disclosed. No general or clinical capability conclusion is supported or claimed.
- The separate first canonical demo sample added an unsupported due date and remains rejected. The frozen benchmark is unchanged. R14 records a pre-publication provenance check gap in the new exact-input cache; no accepted production artifact was observed.
- Ingest and web preserve and display validated cached replay provenance, including the explicit no-live-inference distinction. Source equality remains mandatory.
- Independent sponsor review verified the official Memorable offline local recall receipts and their manually seeded fixture binding. They do not prove trace learning or official replay. Remote extraction remains approval-gated.
- The fresh-machine brain README includes guarded initialization commands and explicitly says the existing demo brain was not reinitialized to test them. The reviewer did not execute initialization.
- QA retains the coordinated mutation and UI window. Reviewer activity remains source inspection and isolated pure checks only.
