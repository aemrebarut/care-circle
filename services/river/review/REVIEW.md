# River independent review

Reviewer: cc-river-review. Date: 2026-09-27. Scope: synthetic corpus, leakage, evaluation, source grounding, and external payload boundaries.

## Review status

The active v2 synthetic corpus and exact prepared external payload passed independent review before submission. The evaluation regressions below pass after owner fixes. The parent reports that a real River run has started; completed training, paired model results, and live serving are not established by this review.

Reviewed payload SHA-256: `039f2af01c6a1dc265dd5e6e1a3c0cc5c40a6e2e9406aad48ba9f7c4b74e884b`.

Active held-out manifest SHA-256: `fe6698f683938cbb13d3f986fc016709df717ba4433cc519bd70230f36f31a2d`.

## Required evidence

- A deterministic corpus generator and exact split manifest with stable IDs, content hashes, counts, and scenario families.
- Training, development, and test splits separated by scenario or wording family, with duplicate and normalized near-duplicate checks. Merely changing names, dates, or doses does not create independent evidence of generalization.
- A frozen test split withheld from training and model selection. If development examples are used to change prompts or select checkpoints, label that split development rather than test.
- The identical system prompt, user prompt construction, held-out inputs, and decoding settings for base and trained inference. Record model/checkpoint IDs, harness version, attempted count, completed count, and request failures.
- Separate metrics for JSON parse validity, schema validity, full extraction exact match, critical field accuracy, and unsupported claims. Report complete denominators and uncertainty for small test sets. No selecting only parseable or successful results.
- A local deterministic extractor measured independently and labeled as a local baseline. It is not a River base model or a trained-model score.
- Gold extraction grounded in explicit note evidence, including negation, uncertainty, unchanged medication mentions, multiple changes, clinician identity, attendees, questions, and follow-ups. Defaults must be specified and shared by both inference arms.
- Exact external payload inventory showing synthetic-only fields, row counts, bytes, and hashes. Training labels belong only to the training payload. Evaluation prompts must not include gold answers, scenario tags that reveal answers, or split metadata.
- Honest status when uploads, training, evaluation, or serving have not completed. A created training job is not a served checkpoint, and successful local tests do not establish River training success.

## Adversarial checks

- Duplicate notes and normalized notes across splits.
- Shared template or paraphrase families across splits.
- Gold labels present in evaluation requests or generated from model output.
- Invalid JSON, missing fields, extra fields, incorrect IDs, wrong doses, and unsupported output facts.
- Negation such as no medication changes, a question about a dose, and a historical dose described alongside a current visit.
- Empty notes, oversized notes, control text, prompt injection, and requests to send non-synthetic data externally.
- Asymmetric prompts, model settings, retry rules, or exclusion rules between base and trained inference.
- Serving paths that silently claim River output when the response actually came from deterministic fallback.

## Findings

### R1: P2, missing output inflates JSON validity, fixed

File: `services/river/eval.mjs`, `parsePrediction`.

A review-only record with no prediction receives `jsonValid: 1` out of one example. A prediction with `output: null`, as produced by `eval-local.mjs` on transport or non-2xx failure, also receives JSON-valid credit. These are absent model responses, not successfully parsed JSON outputs. Exactness correctly remains zero.

Resolution: absent and transport-null outputs receive no validity credit. The literal model text `null` remains JSON valid and schema invalid. Independent regression tests pass.

### R2: P2, schema validity accepts invalid domain values, fixed

File: `services/river/eval.mjs`, `validExtraction`.

A review-only extraction with `date: "2026-99-99"`, `attendeeIds: ["not-a-person"]`, and `medicationId: "arbitrary/id"` passes validation. The contract expects allowed synthetic IDs and actual dates. This can overstate the schema-validity metric even though exact-match metrics remain strict.

Resolution: validator now rejects unsupported attendee/medication IDs and impossible visit/follow-up dates. The independent corpus audit also verified canonical medication name-to-ID consistency for every gold change. Exactness scores retain strict comparison with gold.

### R3: P2, paired provenance validation incomplete, fixed

File: `services/river/eval.mjs`, `compare`.

Initial comparison accepted equal base/trained prompt hashes without recomputing the expected prompt. It also did not verify per-row model, checkpoint, generation, seed, and tokenization metadata.

Resolution: comparison now requires the prompt template, recomputes each expected prompt, verifies model and arm identity, requires the exact trained checkpoint, compares generation settings with the protocol, checks authoritative generation digests, and matches seeds and tokenized-prompt hashes. Tests reject symmetric forged prompts and generation changes, wrong models/checkpoints, token mismatches, and mismatched seeds.

### R4: P2, Python and JavaScript numeric hash formatting differs, fixed

Files: `services/river/eval.mjs` and `services/river/training/run.py`.

Python writes integral floats such as `0.0`; JavaScript canonical JSON writes `0`. Recomputing Python generation fingerprints in JavaScript therefore rejected otherwise identical settings. The owner preserved the Python protocol's authoritative generation digest and separately checks structural settings equality. Prepared payloads and the training schedule remain unchanged. A regression test covers both accepted authoritative hashes and rejected substituted hashes.

### R5: P2, hidden question target weakened grouping, fixed before training

File: `services/river/generate-dataset.mjs`.

The initial generator included a random question doctor in grouping even when a note contained no question. The dataset owner corrected the observable group key before submission, archived untrained v1, and pinned active v2. Independent v2 review recomputed all observable groups and found no cross-split overlap. Archived v1 is excluded from training and evaluation.

## Corpus and payload gate

Passed independent checks on the active v2 corpus:

- 480 synthetic records: 336 training, 72 development, 72 test.
- 28 training wording families, six development families, six test families.
- 480 unique record IDs and 436 distinct observable entity groups.
- No cross-split exact notes, normalized full notes, or observable entity groups.
- All split file hashes and held-out record/gold hashes match pinned manifests.
- Every gold extraction passes schema validation. Source summaries, medication names, doses, frequencies or documented abbreviations, questions, and follow-ups appear in the corresponding note. Gold medication names match their IDs.

Passed independent checks on the exact prepared payload:

- All seven prepared file byte counts and hashes match the reviewed manifest.
- Training prompts and completions exactly match the active v2 inputs and gold.
- The 21-step schedule covers all 336 training rows exactly once. Every batch hash matches Python canonical serialization.
- All 72 evaluation rows contain only allowed prompt metadata and token IDs. Their prompts match the fixed renderer, their IDs do not occur in training, and gold targets are excluded.
- Prepared train, development, and test file hashes match active dataset files.
- An independent toy tokenizer confirmed the next-token loss mask: final prompt position predicts the first completion token, one EOS target is trained, and the final input EOS is masked.
- Static runner review confirmed both evaluation arms use the same tokenized prompts, generation settings, and seeds. Only the checkpoint differs.

The reviewer made no River API calls or data submissions, accessed no credentials, and started no service processes. Public official documentation was read. The internal review gate found no blocking payload or leakage concern for the already authorized submission.

## Limitations

- Test notes come from only six generated wording families. Shared atomic entity vocabulary and short question/follow-up phrases intentionally recur. Results measure synthetic-template extraction, not clinical accuracy or broad real-note generalization.
- Exact-match metrics include literal copied source text and array ordering. Structured exactness is reported separately from summary copying.
- Unsupported medication claims are scored against gold only among schema-valid predictions; a low count alone does not establish safe output behavior.
- A submitted run is not completed training, a completed checkpoint is not a measured improvement, and evaluation is not evidence of live serving. Real comparison review remains pending.

## Checks performed

Used fabricated `review-only` records, not held-out measurements or actual model outputs. Regression command: `node --test services/river/review/eval-regression.test.mjs`.

- Identical gold output: exactness and validity scores all one.
- Malformed JSON: validity and exactness scores all zero.
- Incorrect dose: extraction and medication exactness zero, unsupported medication claims one.
- Missing output: validity and exactness zero after the R1 fix.
- Invalid domain values: rejected after the R2 fix.
- Warning mismatch: included in task failures. Extra outer response claims: rejected by schema validation.
- Invalid paired prompt/model/checkpoint/generation/seed/token provenance: rejected.

Static HTTP review found loopback binding, request bounds, no remote calls, and truthful 503 extraction unavailability. No service process was started by the reviewer.

## Official documentation checked

[River SFT guide](https://docs.river.ai/guides/sft/) supports separate evaluation inputs and matched generation settings, with completion-only next-token training masks. [River checkpoint evaluation](https://docs.river.ai/guides/rl-checkpoints/) warns that semantic duplication remains the caller's responsibility. [River deployment guide](https://docs.river.ai/guides/deployments/) distinguishes saved checkpoints from dedicated deployments and requires deployment-capable team keys for the latter.
