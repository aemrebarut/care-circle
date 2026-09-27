# Independent acceptance

Owner: cc-qa. These tests call the running Care Circle services through loopback HTTP. They never import service implementations, open a brain database, bind a port, or manage service PIDs. The only imported shared code is `contract/index.mjs`.

## Run

From the repository root:

```sh
node tests/e2e/acceptance.mjs --health-only
node tests/e2e/acceptance.mjs --read-only
node tests/e2e/acceptance.mjs --full --cycles 2
```

Coordinate the full run with cc-runtime and other lanes first. Full acceptance invokes `scripts/demo-reset`, resetting synthetic shared demo state. Each cycle then ingests the demo note and captures/replays the local procedure. It leaves the final cycle ready to inspect. Read-only mode checks the existing state and generates a brief without changing family records. `npm test --prefix tests/e2e` is read-only. No command submits data externally.

Health calls use each service directly. Product APIs use the web proxy by default, checking the same path as the UI. Add `--direct` to exercise the individual service HTTP endpoints. Calls reject redirects and use bounded timeouts, allowing GBrain startup and writes to take longer than lightweight health checks. `--wait-seconds 120` polls health until startup completes.

Each run prints named checks and writes a concise JSON receipt under ignored `tests/e2e/results/`. A failed check makes the process exit nonzero. A skipped dependent check is explicit, never counted as a pass. The receipt records git commit, time, mode, transport, and check results. It contains no environment values or credentials.

## Coverage

- All seven health endpoints and same-origin proxy compatibility.
- Source page lookup for every medication, answer, brief, and contradiction citation.
- Graph endpoints resolve to pages, and graph/page IDs are unique.
- Reset twice preserves the synthetic baseline with seven medications and lisinopril recorded at 10 mg.
- A later visit agreeing with the pharmacy does not erase an earlier unresolved discrepancy. Historical visit-only amlodipine changes do not create false alarms.
- Extraction is nonmutating; unsupported notes cannot create unsupported clinical facts.
- Negation, uncertainty, qualified schedules and historical sentences cannot become confirmed current changes. Future visits are rejected; future follow-up requests remain valid.
- Demo ingest records 20 mg, keeps the 10 mg pharmacy claim, and remains idempotent on duplicate submission.
- Concurrent first submissions with a fresh key create one visit and claim. Reused keys with different notes never partially apply.
- The unresolved 10 vs 20 mg contradiction cites both source records.
- Nephrology brief starts at the September 15 visit, includes every subsequent visit to other doctors, the demo medication change and potassium question, and source citations.
- Procedure replay uses a different sibling, and clinic fetch identifies the local synthetic source.
- River and sponsor status expose actual modes and limitations; measured score provenance is also independently reviewed.

The temporal regression visits run before the second clean reset in each cycle. The canonical demo follows that reset, so regression fixtures do not contaminate the final demo state. Doctor last-visit fields and displayed source text must agree after the temporal checks.

## Limits

HTTP acceptance does not prove a rendered browser interaction, database durability after restart, or that an external training run occurred. The UI reviewer, brain owner, runtime owner, and River reviewer supply that separate evidence. QA does not run external sponsor SDKs. A syntactically valid citation proves source resolution; manual review still assesses whether its wording fairly represents the source.
