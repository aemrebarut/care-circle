# Independent River result audit

Reviewer: cc-river-review. Reviewed 2026-09-27 after the run completed at 15:12:32 Pacific.

## Verdict

The frozen experiment's provenance, recorded River operations, and reported arithmetic pass independent review. The candidate results can be published with the interpretation limits below. The reviewer made no River API calls or data submissions and accessed no credentials.

The main complete-task result is **71/72 exact trained responses (98.61%) versus 0/72 for the base model under this fixed raw-completion protocol**. The trained model produced 72/72 exact extractions; one response added an incorrect warning.

This is a synthetic-template extraction and output-format result. It is not clinical validation, a measurement of general model capability, or evidence that live extraction is deployed.

## Frozen experiment identity

- Base model: `Qwen/Qwen3.5-9B`.
- Training: 336 synthetic records, one fixed epoch, 21 batches of 16, LoRA rank 8, learning rate 0.0002.
- Development: 72 local-only records, not submitted or used for checkpoint selection.
- Test: 72 frozen notes across six wording families, with all examples retained in both metric denominators.
- Session: `6f387123-0ec0-40e5-8e4e-0181dbd06580`.
- Model instance: `6f387123-0ec0-40e5-8e4e-0181dbd06580:model:1`.
- Final checkpoint: `river://ac60a978-376d-43b2-a03b-4e7b9d358337/sampler_weights/care-circle-final`.
- Checkpoint was saved after step 21, before either test evaluation arm. No intermediate test-based selection occurred in the recorded run.
- Both arms used the exact same raw prompt token IDs, temperature 0, top-p 1, top-k -1, one sample, 1024 maximum generated tokens, no custom stop strings, and the same per-example seeds. No chat template was applied.

## Independently recomputed results

The reviewer parsed and compared the saved responses in Python without calling the JavaScript evaluator. Counts, rates, and failure IDs exactly match `results/comparison-candidate.json`.

| Metric | Base | Trained |
| --- | ---: | ---: |
| Predictions received | 72/72 | 72/72 |
| Entire response is valid JSON | 0/72 | 72/72 |
| Schema valid | 0/72 | 72/72 |
| Extraction exact | 0/72 | 72/72 |
| Structured extraction exact, excluding summary | 0/72 | 72/72 |
| Medication-change list exact | 0/72 | 72/72 |
| Warnings exact | 0/72 | 71/72 |
| Complete task exact, including warnings | 0/72 | 71/72 |
| Medication claims in schema-valid responses | 0 | 48 |
| Gold-unsupported medication claims in schema-valid responses | 0 | 0 |

The base unsupported-claim count is zero because no base response passed the parser. It must not be presented as evidence of safe base output.

## Failure inspection

All 72 base responses were nonempty. Inspection found draft JSON followed by additional JSON or thinking text, with some malformed fields and incorrect dates or copied source text. Strict parsing of the entire response therefore failed. River stop reasons were `length` for 54 base responses and `stop` for 18. All 72 trained responses ended with `stop`.

The zero base score is specific to the frozen raw-completion interface and strict single-JSON scorer. It does not establish that a chat-formatted or otherwise configured base model has zero extraction ability. No alternate prompts, repaired parsing, or changed generation limits were applied to this frozen evaluation.

The only trained complete-task error is `care-circle-corpus-v2-negation-test-01-11`. Its note explicitly rejects an Acetaminophen change and confirms a Lisinopril change. The model correctly extracted only the confirmed Lisinopril update, visit, question, and follow-up, but added `Unsupported medication mention: Acetaminophen.`. The gold warnings list is empty because Acetaminophen is known and its change was explicitly rejected. The error was retained in the published denominator and was not used to tune the checkpoint or prompt.

## Provenance and payload checks

The independent audit verified:

- The active train, development, test, prompt, and held-out manifest remain identical to the reviewed pre-training hashes.
- All seven prepared files still match their manifest byte counts and hashes.
- Every base and trained prediction has exactly one matching frozen test ID, in the expected order, with no missing or duplicate rows.
- All 144 predictions match the frozen input hash, rendered prompt hash, prepared prompt-token hash, exact model, correct base/trained arm, expected checkpoint identity, generation settings and authoritative Python generation digest, and the expected per-example seed.
- Base rows use no checkpoint. Trained rows identify the saved final checkpoint.
- Both prediction-file hashes match the paired proof, and the candidate protocol matches the completed run protocol.
- All 21 submitted training batches match the approved schedule's data hashes and record counts. Only training rows occur in that schedule. Evaluation gold was excluded from the prepared request files.

| Artifact | SHA-256 |
| --- | --- |
| Approved payload manifest | `039f2af01c6a1dc265dd5e6e1a3c0cc5c40a6e2e9406aad48ba9f7c4b74e884b` |
| Active held-out manifest | `fe6698f683938cbb13d3f986fc016709df717ba4433cc519bd70230f36f31a2d` |
| Frozen test JSONL | `040953c027b4a79ebb23f531345a5e0f05962002749545808a3e822de70de100` |
| Prompt template | `010e5b6032951e699de04e8ca5d7e3ece7f35c7b5d78f83d4d33b4bd29602fd2` |
| Base predictions | `8672f2032ec872bdb2a6868892d21a42ecd4d485852ed23aa974359853e0c40a` |
| Trained predictions | `0bc2a7d0c1d761483fc75ce1c978e08890863c69e6be2b5f33c971c4fbacd7b9` |
| Reviewed candidate comparison | `a8ee5a83ee1d77b7d31a4ac007f593ae080b0e9d15a36a964c31ecde255ccf9a` |

## Operation receipts and bounds

The run lasted 330.055872 seconds against its 2700-second bound. It recorded 463 polls against a 6000-poll bound, 126 operation receipt events, no recorded failures, and completed session cleanup. The run status reports all 21 planned updates completed and 72 predictions per arm.

Receipts show one capability lookup, one session creation attempt, one model creation, 21 forward/backward submissions and completions, 21 optimizer submissions and completions, one final checkpoint save, nine base sample batches, nine trained sample batches, and session cleanup. For each sample batch, the receipt's example IDs and request IDs match the saved predictions. For every training step, submission/completion request IDs match. Receipt timestamps are monotonic and the saved checkpoint reports step 21.

These are retained local SDK-operation receipts and response metadata, not an independent server-side billing audit. The reviewer verified their internal consistency with the driver and pinned payload. SDK heartbeat and polling RPCs are additional transport activity, as disclosed in the protocol.

## Reporting limits

- Report complete-task exactness as 71/72 or 98.61%, and distinguish extraction-only exactness of 72/72.
- Keep the raw-completion, no-chat-template, strict-JSON, and base-truncation context alongside the comparison.
- The holdout has six generated wording families and a fixed known entity vocabulary. It cannot support broad real-note or clinical claims.
- No reliable population uncertainty interval is claimed because examples share generated wording families.
- A cached demo-note inference, if added later, is a separate demonstration. It must not be added to the frozen test result or described as fresh live inference when replayed.

## Artifacts inspected

- `services/river/dataset/{train,dev,test}.jsonl`, `prompt.txt`, and `heldout-manifest.json`.
- `services/river/training/prepared/payload-manifest.json` and all seven pinned files.
- `services/river/training/runs/experiment-1/{base,trained}.jsonl`, `protocol.json`, `paired-proof.json`, `receipts.jsonl`, and `run-status.json`.
- `services/river/results/comparison-candidate.json`.

See `services/river/review/REVIEW.md` for the pre-submission corpus and payload review and evaluation regression fixes.
