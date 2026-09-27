# Synthetic Rose world

This static package supplies the Care Circle family brain with 30 fictional source pages: Rose Alvarez, 81; her three adult children Ana, Ben, and Celia; four doctors; seven recorded medications; six visits; two insurer calls; three labs; one pharmacy record; and three open family questions. The children are siblings to one another.

All people, providers, records, values, and events are synthetic. Care Circle organizes information and cites sources; it never recommends doses or treatments. Not medical advice.

## Run

From the repository root:

```sh
node packages/world/build.mjs
node packages/world/smoke.mjs
```

Or run `npm test --prefix packages/world`. No dependencies or build pipeline are required. The checked-in seed and Markdown are ready to consume without generation. This is a static package, not an HTTP service, and does not open any port or brain database.

## Files and consumer contract

- `seed.json`: `{patientId,pages}` using the Page shape in `docs/CONTRACT.md`.
- `pages/<page-id>.md`: one source file per page. Slash-separated page IDs map to nested paths.
- `build.mjs`: deterministic source fixture authoring and generation.
- `smoke.mjs`: offline validation of counts, references, exact quotes, source dates, source attendees, baseline agreement, and Markdown metadata parity.

The brain service is the sole product brain owner. It consumes this package, imports the actual Markdown with `--no-embed`, and extracts links. No other service should import this package to bypass the brain HTTP API.

Each Markdown file contains the human source body followed by a single fenced block tagged `care-circle-page`. Its JSON contains `id`, `type`, `title`, `fields`, `links`, and `updatedAt`, matching the seed page. It excludes `body` to avoid recursion. The seed's `body` is only the human source Markdown. The brain can recover structured metadata after a restart from the imported fence. GBrain may store built-in link types while app semantics remain in the structured fields.

Every structured graph link appears as a wikilink in the human source body. Every medication claim has a source date, attendees or family recorder, source kind, and exact quote citation in `fields.citations`. Citation titles and quotes resolve to the bundled source page. A pharmacy recorder is identified as a recorder, not a visit attendee.

Lab pages are original synthetic report sources: `sourceId` points to the report page itself, whose body contains the exact name, value, unit, and date. `associatedVisitId` separately links the ordering or collection context, which is not the result source. Rose's `childIds` are her three adult children, siblings to one another.

## Demo chronology

- September 3: primary care medication reconciliation.
- September 8: cardiology source review, no medication change.
- September 10: endocrinology visit and A1c source record.
- September 15: last nephrology visit before the hero brief.
- September 16: potassium and creatinine source records, with no clinical interpretation.
- September 18: Ben's synthetic insurer call, pending a referral attachment.
- September 21: primary care paperwork follow-up, no medication change.
- September 22: Celia's synthetic follow-up call, attachment received and review pending.
- September 23: cardiology source records amlodipine changing from 2.5 mg daily to 5 mg daily; lisinopril remains recorded as 10 mg daily.
- September 24: pharmacy record agrees with the latest visit claims for all seven medications.
- September 27: demo reference date. The contract's cardiology note is ingested live and is deliberately absent from the seed.
- September 29: Tuesday's upcoming nephrology appointment.

The live note adds the fictional lisinopril 20 mg daily source claim and potassium recheck request. Keeping the pharmacy's 10 mg daily claim makes the discrepancy visible. The seed itself has no unresolved medication source discrepancy. Amlodipine's older 2.5 mg entry is history, not an unresolved current conflict, because the later visit and pharmacy both record 5 mg. Lab records predating the live note do not complete its later follow-up request.

## Gotchas and sponsor reality

The medication list is a recorded source list, not an administration log. As-needed acetaminophen is not scheduled dosing. No lab reference ranges, diagnoses, or interpretations are asserted. Insurer call statuses are sequential fictional claims, not approval or guaranteed coverage. The package performs no browser fetches, network requests, uploads, training, telemetry, or sponsor integrations. It supplies synthetic material only.

Do not use plain GBrain commands, open the product brain, or generate the September 27 event at seed time. Rebuild and rerun smoke after editing fixture sources, then coordinate seed changes with cc-brain.
