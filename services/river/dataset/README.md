# Synthetic extraction corpus

Active dataset: `care-circle-corpus-v2`. It contains 480 fictional notes with gold Care Circle extraction JSON. There are no patient records, real visit observations, or clinical recommendations. Medication doses are invented source claims used to test transcription, not dosing guidance.

## Reproduce and verify

From the repository root:

```sh
node services/river/generate-dataset.mjs
node services/river/generate-dataset.mjs --check
```

The generator uses only Node built-in modules. Its fixed seed is `care-circle-synthetic-v2-2026-09-27`. Generation and validation make no network calls and do not train a model. `--check` regenerates expected bytes in memory and verifies every active artifact exactly. It also checks schema-relevant fields, source support, uniqueness, task counts, and split isolation.

## Files and split policy

| File | Records | Full sentence template families | Use |
| --- | ---: | ---: | --- |
| `train.jsonl` | 336 | 28 | Supervised fine-tuning only |
| `dev.jsonl` | 72 | 6 | Development evaluation and model selection |
| `test.jsonl` | 72 | 6 | Final held-out evaluation only |

Each line has `{id, split, templateFamily, caseId, entityGroup, entityKey, scenario, synthetic, input, gold}`. `input` is `{note, authorId, date}`. `gold` is `{extraction, warnings}`, with `extraction` matching `docs/CONTRACT.md`. Training must use only `input` and `gold` from `train.jsonl`; metadata is never part of a model prompt.

Each full sentence template family belongs to exactly one split. The precise combination of visit doctor, explicit question destination if present, attendees, all named medication IDs, and any unidentified medication phrase is deterministically assigned to one split. The generator verifies that these keys contain only observable entities. Fictional case IDs and complete note strings are unique. Shared schema vocabulary, individual doctors, siblings, medication names, short question text, and follow-up task text intentionally recur across splits. This is a grouped synthetic challenge, not proof that all semantic patterns are independent.

Six scenarios appear in every split: one confirmed medication change, two confirmed changes, a rejected change alongside a confirmed change, uncertainty, unchanged medication, and an unidentified medication mention. Notes vary punctuation, line breaks, dose strings, frequency abbreviations, attendees, explicit dates, questions, and follow-up tasks. Not every note has questions or follow-ups. Authors may differ from attendees, so attribution is not attendance evidence.

## Immutable held-out pin

`manifest.json` records split byte hashes, the generator hash, prompt hash, catalog hash, family membership, and validation counts. `heldout-manifest.json` pins each dev and test record, its input and target, case group, entity group, and template family with SHA256. Its commitment is in `heldout-manifest.sha256`.

The generator checks all existing dev/test files and held-out pins before writing anything, including training data. It refuses changes to any pinned bytes. There is no force flag. A dataset or prompt change requires a separately reviewed new version while preserving the old pin. Verification must happen before an external training payload is prepared. Only the active root-level `train.jsonl` is eligible for training. Never recursively glob this directory for training records.

The `archive/v1/` snapshot preserves the first local, untrained candidate. It was retired before training because a note without a question could retain a hidden question destination in its grouping key. That weakened observable entity isolation. V2 omits that hidden destination and independently checks keys against note and gold content. The archived records are not eligible for training or reported evaluation. Their source snapshot is retained as plain text for audit, not as another executable generator.

## Exact prompt protocol

Use `prompt.txt` unchanged for both base and trained models. The input rendered after it must contain only `note`, `authorId`, and `date`.

```python
rendered_prompt = (
    template.rstrip()
    + "\n\nINPUT_JSON:\n"
    + json.dumps(input_record, sort_keys=True, separators=(",", ":"))
    + "\n\nOUTPUT_JSON:\n"
)
```

The target is the `gold` wrapper as JSON. This version uses only ASCII source text, so Python's default ASCII escaping and JavaScript output agree for the actual dataset inputs. Use a single shared canonical rendering implementation in evaluation and training. Do not include row IDs, split names, families, scenario tags, or entity metadata in the model input.

Visit summaries copy the source note exactly. Attendee order and medication-change order follow the note. Dates and follow-up dates are explicit source facts. Dose units are copied rather than converted. Uncertain changes and unknown medication mentions leave the affected change out and emit a defined warning. Clear negations and unchanged doses do not emit warnings. Every record has an explicit known visit specialty; unknown-doctor refusal belongs in service-level error tests.

## Honest limitations

- These examples come from 40 authored template families, not 480 independent human narratives. Repeated phrasing within each split can inflate apparent performance.
- The entire corpus is authored and scored from the same generator specification. Programmatic assertions prove internal consistency, not clinical validity or independent annotation quality.
- All entities are from a closed fictional catalog. There are no unknown visit doctors, missing dates, multiple patient identities, drug interactions, speech transcripts, OCR errors, or realistic longitudinal medication history.
- Every extracted follow-up has an explicit ISO due date. Handling absent or relative due dates is not measured here.
- Questions and task wording intentionally recur across splits, and individual entity names recur. Only full template families, case IDs, complete notes, and exact observable entity combinations are disjoint.
- Sample counts per scenario are uneven in training. A high aggregate score can hide weaker performance on uncertainty, no-change, or unsupported notes. Report scenario breakdowns where possible.
- No score from this corpus establishes medical safety, real-world extraction accuracy, or readiness for patient use. Any reported base-versus-trained result must use the same pinned test rows, prompt, canonical input rendering, and evaluation metric.
- Corpus generation itself is local. Sponsor training and remote evaluation, if performed by the River lane, require separate run receipts. The presence of these files does not prove River trained or served a model.
