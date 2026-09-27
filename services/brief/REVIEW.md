# Brief lane review evidence

Date: 2026-09-27. Owner: cc-brief. All planner and reviewer work used gpt-6-astra with xhigh reasoning. Reviews were read-only; the lane owner applied all changes in services/brief/.

## Planner

Recommended one revision-consistent brain HTTP snapshot, bidirectional persisted graph traversal, strict event-date filtering, explicit source provenance and separate handling of historical changes versus unresolved source discrepancies. Cases informed the focused fixture suite. The lead clarified that v1 has no reconciliation action, including when a later visit reverts to a matching dose.

## Reviewer

Targeted clean receipt for bb3cda8: 21 tests and independent assertions pass. Verified medication-specific source selection, numeric dose boundaries, long source-line excerpts, meaningful source citation preservation, explicit foreign-patient exclusion, future-only dose suppression, question origin reachability and historical discrepancy labels. No remaining findings in that review scope.

The track reviewer separately reproduced and verified: acetaminophen 500 mg cites its own line; pharmacy 10 mg then visit 20 mg then visit 10 mg remains unresolved with the original unequal sources; older visit 5 mg then visit 10 mg before matching pharmacy 10 mg does not create a false discrepancy. The world seed contains the equivalent amlodipine 2.5 mg to 5 mg historical case.

## Verification boundary

`npm test --prefix services/brief` runs the domain fixtures and bounded loopback HTTP checks. It does not prove the live GBrain path. `node services/brief/smoke.mjs` separately verifies live endpoints, source resolution and exact source-quote inclusion once runtime confirms brain readiness. Runtime owns all persistent service PIDs. Full demo mutation and reset windows belong to runtime and QA.

No sponsor SDK is used in the brief service. No external submissions, credentials or actual patient data were used.

## M1 live seed receipt

`node services/brief/smoke.mjs` passed against the real GBrain-backed brain at revision 1: seven recorded active medications, one actual amlodipine change since 2026-09-15, two other visits, two open nephrology questions, zero discrepancies and zero record-gap warnings. Every source lookup resolved and every quoted excerpt was present in its source body. The seed Markdown is 256 words with six numbered source citations. An initial request during runtime's brain restart returned 502; the repeat after readiness passed. No records were mutated by this check.

## Post-ingest live receipt

The same read-only smoke passed at revision 2 after runtime's post-ingest persistence restart. Targeted assertions verified seven recorded medications; exactly two actual changes, amlodipine on September 23 and lisinopril on September 27; three other visits; three open questions including potassium; one unresolved discrepancy; and zero record-gap warnings. The discrepancy retains the original 10 mg pharmacy source and the new 20 mg visit source with exact medication-specific quotes. The recorded answer labels the visit's 20 mg dose as a source claim. Demo Markdown is 347 words with nine numbered source citations.

The independent QA lane reports its first full HTTP acceptance cycle passed 32/32, including persistent discrepancy history, exact medication change sets and source quotes. This is a reported independent receipt. Actual browser print pagination and two final consecutive full cycles remain separate acceptance gates.

## M2 print review

QA reports actual Chromium print output of one A4 page, visually inspected with no overflow. The first UI renderer omitted the conflicting dose values despite their presence in backend JSON and Markdown. Web owns and fixed that issue in 45a2295, including dose, frequency, source, date and past-discrepancy wording. A read-only reprint after runtime maintenance remains pending. No backend compaction or service change was needed.
