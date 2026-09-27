# Independent River artifact audit

Reviewer: cc-qa-http, gpt-6-astra with xhigh reasoning. Reported September 27, 2026 at about 15:28 Pacific, against repository HEAD `e171089`. Scope was read-only local artifact inspection using Node built-ins, Python standard library, and the offline tokenizer. No credentials, network, training, service imports, or model inference were used.

## Result

The published paired artifacts are internally consistent. Independent scoring reproduces **0/72 base versus 71/72 trained strict JSON task matches**. Every trained extraction matches the gold extraction; the one full-task failure adds the warning `Unsupported medication mention: Acetaminophen.`

This measures raw JSON formatting plus extraction under identical raw-completion settings and a 1024-token completion cap. It does not measure clinical accuracy or the base model's general ability.

| Check | Independent observation |
| --- | --- |
| Dataset sizes | 336 train, 72 development, 72 test |
| Split separation | No shared IDs, case IDs, template families, entity groups, canonical inputs, or whitespace-normalized note text |
| Dataset integrity | Active v2 split byte hashes and held-out per-row and pin hashes recomputed |
| Prepared payloads | All seven prepared payload and tokenizer file hashes match the reviewed manifest |
| Training membership | Train text and token IDs match the training split only; all 336 prompt/completion pairs match input and gold |
| Training loss | All 336 token sequences, next-token targets and completion/EOS-only loss masks checked |
| Schedule | Every training record appears once in 21 batches; batch hashes match submitted/completed receipts |
| Held-out payloads | All 72 evaluation token payloads decode to the frozen prompt template plus input only, with no gold or evaluation metadata |
| Paired comparison | Both arms cover the same 72 unique held-out IDs with matching input, prompt and token hashes |
| Request provenance | Seeds, generation settings, model/checkpoint and completed request IDs match prepared payloads, protocol and saved receipts |
| Prediction integrity | Raw prediction file hashes match the paired proof; comparison artifact stayed unchanged during the audit |
| Independent score | Base strict task 0/72; trained strict task 71/72; trained extraction exact 72/72 |
| Completion limits | 54/72 base responses stopped at the 1024-token cap; all 72 trained responses stopped normally |

Hash recomputation preserves Python float spellings such as `0.0` and `1.0` where the protocol uses them. Naive JavaScript reserialization does not reproduce those generation and weight hashes; byte/protocol-compatible recomputation does.

## Interpretation limits

The comparison used raw completions without a chat template. The low base strict score is therefore tied to this output protocol and completion budget. Fifty-four truncated base outputs are a material limitation, not a footnote to a general intelligence claim.

The test set contains six held-out wording families. Split membership is clean, but shared vocabulary, task phrases, and one synthetic generator limit generalization. Exact matching also treats an extra warning as a task failure, even when the extraction matches.

The base artifact reports zero unsupported medication claims because it has zero schema-valid outputs. That value is unscored evidence, not proof that the base model gave safe answers. Unsupported-claim metrics compare schema-valid outputs with synthetic gold only.

Internally consistent saved requests, completions and checkpoint identifiers support the remote-run claim. This audit did not query River independently, inspect model weights, rerun inference, or prove the absence of unrecorded model selection. The reviewer found no defect in the published paired artifacts within this scope.

Exact-demo cached replay is separate from training, evaluation and live serving. At this audit checkpoint, that replay had not been independently verified and must not be described as live inference. The HTTP acceptance runner requires explicit cached-replay provenance, exact-input hashes and a no-live-inference warning whenever it is exposed.
