# Offline review of River demo structural repair

Reviewer: cc-review. Date: 2026-09-27. Scope: the archived second canonical demo sample only. No implementation changes, remote requests, replay enablement or shared-state mutations.

## Decision

No-go for product replay under the unchanged strict ingest guard. A single structural edit can recover a valid extraction without changing any scalar value, but that extraction does not pass the existing source-equality check. The model emitted medication name `Lisinopril`; the deterministic extractor emits `lisinopril`. Every other extraction field matches. Changing case or substituting the deterministic object would exceed the proposed structure-only operation.

The product remains deterministic. This decision does not imply a new medical fact error in the second sample; it identifies a failed invariant of the current implementation. Any later policy for display-name normalization requires a separate explicit review and contract decision. It must not be introduced silently as JSON repair.

## Direct offline evidence

The archived raw model output is invalid JSON. Deleting exactly one closing brace, ASCII byte 0x7d at zero-based UTF-8 byte offset 92, moves the existing medicationChanges, questions and visit members into the extraction object. It leaves every other byte unchanged. The resulting object passes the existing River JSON/schema parser, has an empty model warnings array, and contains no follow-up dueDate. A direct deep equality comparison with extractDeterministic(input).extraction fails only on the medication display-name case above.

The completion receipt matches the exact prediction file hash and request ID. The archived plan hash and prompt hash also match the prediction metadata. These checks establish the local receipt chain; the reviewer did not make an external call.

| Artifact or identity | Value |
| --- | --- |
| Archived prediction | services/river/results/demo-attempt-2/prediction.json |
| Prediction file SHA-256 | 005274ec4c9f679836c47d134a7e0d490c75026bce69b10ad273498b3e203559 |
| Raw output string SHA-256 | 5e60affd9eee9a79dd367be9df113d376b2cb6b2efbe37c08693ef355eb3eb50 |
| One-brace repaired string SHA-256 | cdd28a22edb353dd2ceb5a8bcec35c354da7be4c05b7ee1320aa2bdadef0cbe8 |
| Receipts file SHA-256 | 6a1de01b1083a8f07f67d83c5e82edfbc62821e7522fae8acf2fb0a0740b4e52 |
| Plan SHA-256 | 3c1475d272a6d3cfd7bcfafab68df1b1a547dd0c703dbbc4b0e438699487509b |
| Actual product prompt SHA-256 | 4493f83602822e80225cd6a13a5df31b8577b0df3d4f027671faab407b50e458 |
| Request ID | 35902266-b768-4c65-9296-f199f6f86e28 |

## Invariants for any separately approved repair design

1. Pin this exact input, author, reference date, model, checkpoint, completed request, plan, actual product prompt and original raw output. Verify the receipt against unchanged archived prediction bytes. No arbitrary notes or generic model outputs qualify.
2. Apply only the audited single structural deletion at byte 92 after checking the complete raw hash and the expected brace at that offset. Reject any different bytes. Do not repair strings, numbers, keys, warnings, array order, omissions, duplicate keys or extra content.
3. Require the expected repaired hash, strict JSON parsing with no duplicate keys or trailing tokens, exact allowed schema, and preservation of every scalar and array element. Do not add defaults or infer dates.
4. Run the unchanged source-equality and unsupported-fact guard afterward. A mismatch rejects the draft. This sample currently fails that invariant because of the name case.
5. Preserve the raw output and its invalid-JSON status. Keep raw output hash, repaired output hash, repair version and exact edit operation distinct in provenance. Never replace the raw receipt or describe repaired bytes as raw model output.
6. Label any separately approved display as a cached model draft with structural repair and no live inference. Distinguish adapter disclosure from the model's original empty warnings list. Preserve that distinction through River, ingest, web preview and save results.
7. Keep this product-only attempt separate from the frozen benchmark. Do not rescore benchmark outputs with the repair, change the published 71/72 full-task result, or imply raw-valid/general extraction capability from this one reviewed sample.

The first attempt's inferred dueDate remains a rejection. Structural repair cannot delete or alter an unsupported fact to make a prediction pass.
