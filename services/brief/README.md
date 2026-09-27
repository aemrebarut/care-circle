# Care Circle brief service

The brief service reads one revision of the family brain over loopback HTTP. It follows persisted graph edges to prepare a cited medication answer, detect unresolved source discrepancies, and render a compact pre-visit Markdown brief. All records are synthetic. It organizes sources and never recommends doses or treatment.

## Run

```sh
node services/brief/server.mjs
npm test --prefix services/brief
node services/brief/smoke.mjs
```

Runtime owns the persistent process at `127.0.0.1:4703`. Brain must serve `http://127.0.0.1:4701`. No variables or credentials are needed. Tests create and close their own fixture servers on reserved ports 4717 and 4718. `npm test` is independent of the live brain. The smoke script reads the live service without mutating any records.

## API

- `GET /health`: process health, service name and synthetic-data label.
- `GET /v1/answer/medications`: recorded active medication list, per-item citations, source history and uncertainty. The displayed latest visit claim does not verify actual intake.
- `GET /v1/contradictions`: unresolved discrepancies with all relevant source citations and a `temporalStatus` distinguishing present disagreement from unreconciled earlier disagreement.
- `POST /v1/previsit` with `{"doctorId":"doctors/nephrologist"}`: since date, medication changes, other visits, open questions, discrepancies, citations, compact printable Markdown, graph traversal evidence and brain revision.

All data routes fetch `/v1/state` from brain. They use its graph and pages from the same snapshot, avoiding mixed-revision reads. Errors have `{error:{code,message}}`. The server bounds request bodies to 16 KiB, upstream snapshots to 8 MiB and upstream calls to 8 seconds. It refuses redirects or non-loopback upstream addresses. Service requests have a 10-second deadline. Web proxies `/api/brief/*` to these routes.

## Graph and date semantics

Traversal follows incoming and outgoing persisted edges, records actual predecessor paths and terminates on cycles. It excludes explicitly foreign patient records. Medication answers start from the patient; pre-visit briefs start from the requested doctor. Missing and disconnected claim sources produce record-gap warnings, not invented citations. Every quote is an excerpt of the source page body, with medication identity used before dose and frequency when selecting a line.

The synthetic reference date is 2026-09-27. The nephrologist baseline is its doctor page's last visit, 2026-09-15. Visits and explicit `medicationChanges` are included strictly after that day and on or before the reference date. Repeated unchanged medication claims are not changes. Open questions addressed to that doctor remain relevant even when they predate the baseline. Future questions and future claims are excluded. Same-day conflicting visit sources have no invented ordering and no single selected dose.

For every pharmacy claim, compare the latest visit at or before its date and all later visit claims through the reference date. Preserve unequal pairs. Thus an intentional historical visit-only change is not a conflict, while pharmacy 10 mg followed by visit 20 mg remains unresolved. A later visit returning to 10 mg does not close the earlier discrepancy: it is labeled a past unresolved discrepancy. The latest records can agree while unresolved history remains. V1 has no source-cited reconciliation action. Pharmacy pages lack a declared supersession lineage, so historical pharmacy evidence is preserved. Dose normalization handles case and whitespace only; it never infers clinical equivalence or converts units.

## Files

- `server.mjs`: bounded loopback HTTP and upstream reads.
- `domain.mjs`: graph traversal, source citations, temporal claims, answers and Markdown.
- `test/fixture.mjs`: small synthetic independent fixture.
- `test/domain.test.mjs`, `test/http.test.mjs`: focused semantic and HTTP regressions.
- `smoke.mjs`: live read-only endpoints and exact source quote verification.
- `code-map.md`: source for the `code/brief` devbrain page.

## Integration reality and limits

This service uses deterministic transformations of source records, not an LLM or a sponsor SDK. GBrain integration is real through the brain service HTTP API; this service never opens its storage. It performs no external submissions, telemetry or training. Missing doctor baselines fail explicitly. Full JSON arrays and citations are retained; the Markdown is compact for the seeded one-page demo, and larger histories may require more paper. Citations use the web source lookup route `/api/brain/pages/:encodedId`.

Not medical advice
