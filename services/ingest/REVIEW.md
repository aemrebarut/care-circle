# Ingest review receipts

All records and test notes are synthetic. Not medical advice.

## Scope

The ingest lane used an independent gpt-6-astra reviewer with xhigh reasoning for source ambiguity, provenance, upstream errors and idempotency. Track review agents also reproduced parser edge cases directly. Review probes did not mutate the shared brain.

## Findings resolved before integration

- Planned, proposed, declined and conditional changes: require a complete affirmative statement of a completed change.
- Frequency qualifiers such as as needed, for three days, or every other day: reject unsupported suffixes instead of truncating the recorded schedule.
- Historical or cross-specialty changes: reject statements that cannot be attributed to the declared visit.
- Qualifiers split by semicolons, newlines or correction sentences: reject unconsumed context around structured claims.
- Cancelled visits, referrals and bare specialty labels: require a supported completed encounter opening.
- Attendance from future appointments or later conversations: use only the validated encounter opening, independently from note authorship.
- Completed potassium checks: retain historical text only in the source, and require request wording for pending follow-ups.
- Questions addressed to siblings or insurers: require the known specialist as direct addressee.
- Malformed successful brain receipts: require a valid visit ID, inclusion in changedPageIds and a nonempty revision.
- Incomplete HTTP uploads: return bounded JSON 408; client disconnects do not become unhandled process errors.
- Future visit dates: reject dates later than fixed demo as-of 2026-09-27 with 422 before any upstream call. Future follow-up dates remain allowed.

## Evidence

`npm --prefix services/ingest test` passes 55 tests, including the exact contract demo, adversarial source cases, full source preservation, effective authorship, stable retry keys, mutation-free preview, upstream 409/422/503, timeouts, disconnects, invalid or oversized upstream bodies, River fallback, and incomplete uploads.

Track review independently reported all then-current extractor cases passing, including semicolon/newline qualifiers and separate corrections. That bounded recheck found no further material issue. Later as-of date guards have dedicated unit and HTTP regressions.

The persistent service is owned by cc-runtime. Its read-only health/extraction smoke passed. The first coordinated live mutation passed after runtime proved baseline persistence across a brain restart. `npm --prefix services/ingest run verify:commit` submitted the canonical note twice, received the same revision 2 and visit ID `visits/ingest-70c7a8a9face7c4158c7be49`, and verified exactly one visit and one new claim. The full note, author, attendance, potassium wording, nephrology question and source citation survived. The earlier 10 mg claim remained. Receipt: `evidence/first-commit.json`. No reset was performed. The mutation window was released to runtime and QA, with source state intact for an independent read-only audit.

After runtime verified the committed revision 2 state survived another brain restart, `npm --prefix services/ingest run verify:retry` passed with the original visit ID, revision, exact canonical request key and Extraction. Full HTTP state before and after that retry was deeply equal. `evidence/canonical-request.json` preserves the input and key; `evidence/restart-retry.json` preserves the returned response. The first script checked full applied receipt equality within the original process; the saved original receipt was a summary, so the restart check claims original identifiers/revision and unchanged state rather than full original applied-object equality. Runtime and QA received the final RELEASE.

Full repeated reset-to-demo evidence belongs to runtime and QA; this lane does not claim it from the narrower write-and-retry check.

## Limits

This is a narrow deterministic parser. Passing tests do not establish general language understanding or clinical safety. Unsupported forms fail closed or remain only in the verbatim source with warnings. Optional local River output cannot expand the accepted facts: it must match the deterministic Extraction exactly. No remote inference or training was performed by this lane.


## River demo source check

The River lane retained a real trained canonical-demo prediction that added `dueDate: "2026-09-30"` despite no explicit ISO date in the note. Ingest's existing strict evidence match rejects that addition. A focused HTTP regression confirms deterministic fallback keeps dueDate absent. The raw response was not rewritten into a successful model extraction, and no validation rule was weakened. This finding concerns the separately sampled demo output, not a change to the frozen held-out evaluation.


Accepted source-equal cached responses now retain validated replay provenance for both preview and committed-ingest responses. The metadata check enforces cached-replay mode, liveInference false, bounded model/request metadata and matching canonical input SHA-256. Tests cover preservation, required no-live-inference wording, wrong-input rejection and false execution-mode rejection. This does not accept the rejected inferred-date output or enable River attempts by itself.


Final product decision: no structural repair or medication-name case normalization ships. Independent offline review found that deleting one premature brace in the second actual demo output would recover the existing fields, but its name casing would still fail the unchanged strict gate. No repaired artifact was written or enabled by this lane. Product extraction remains deterministic and River attempts stay off. The frozen benchmark and original outputs remain unchanged.
