# Experiment receipts

`experiment-1-plan.json` is the exact reviewed payload manifest. SHA256: `039f2af01c6a1dc265dd5e6e1a3c0cc5c40a6e2e9406aad48ba9f7c4b74e884b`.

The first fixed experiment uses Qwen/Qwen3.5-9B, LoRA rank 8, one epoch over 336 synthetic training examples, 21 batches, learning rate 0.0002, and 72 held-out notes for both base and trained evaluation. The prompt, split and hyperparameters were fixed before evaluation. Development examples stay local. Test gold is never submitted. The raw reviewed token payload remains local under `training/prepared/`; its individual file hashes and sizes are recorded in the manifest. No checkpoint selection uses the test scores.

Exact opt-in command:

```sh
services/river/.venv/bin/python services/river/training/run.py run \
  --prepared services/river/training/prepared \
  --manifest-sha256 039f2af01c6a1dc265dd5e6e1a3c0cc5c40a6e2e9406aad48ba9f7c4b74e884b \
  --output services/river/training/runs/experiment-1 \
  --submit --load-authorized-key
```

The run completed on 2026-09-27 at 15:12:32 Pacific: 21 training steps, a saved checkpoint, and 72 predictions per evaluation arm. `comparison.json` contains independently verified scores and required interpretation caveats. `experiment-1/` contains the unmodified raw predictions, actual request receipts, paired proof, and protocol. `review/result-audit.md` records the independent arithmetic and provenance review. Unit-test fixture metrics are never published here.

Full-task exact success was 71/72 for the trained checkpoint versus 0/72 strict JSON success for the base under the identical 1024-token raw completion budget. The base returned extra text and 54 responses hit the token limit. This is a narrow formatting and extraction benchmark, not clinical validation or a general capability comparison.

## Separate demo sampling

`demo-attempt-1/` preserves one actual post-benchmark checkpoint sample. It inferred `2026-09-30` from relative follow-up wording and was rejected by the source guard. The raw output is unchanged, no cached success was published, and the benchmark is unaffected. An additional product-only prompt attempt is authorized, with its own prompt hash and receipts; it must pass the same source guard before replay can be enabled.
