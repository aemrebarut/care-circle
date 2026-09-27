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

`demo-attempt-1/` preserves one actual post-benchmark checkpoint sample. It inferred `2026-09-30` from relative follow-up wording and was rejected by the source guard. `demo-attempt-2/` preserves the sole authorized product-only prompt revision; it omitted the date but produced invalid JSON and was also rejected. Neither raw output was repaired or served. Their raw artifact `mode` describes the intended replay use, not acceptance; `validation.json` records each actual rejection. The final service has no cache-serving branch and remains deterministic fallback only.

The second attempt used product template SHA256 `f5e343b7fb5f71f3d18c9269e3a37aa9738f525f553c515f7ebce9ac0e38cf09` and full prompt SHA256 `4493f83602822e80225cd6a13a5df31b8577b0df3d4f027671faab407b50e458`. It did not change the weights, benchmark prompt, split, predictions or scores. No further sampling is authorized or planned. See [demo audit](../review/demo-audit.md).
