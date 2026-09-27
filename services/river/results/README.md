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

This file records the plan, not proof that training completed. Safe actual receipts and scores are added only after execution. Unit-test fixture metrics are never published here.
