# River training runner

This opt-in Python tool prepares synthetic Care Circle notes, trains a LoRA adapter through the real River SDK, and produces paired held-out predictions. The local HTTP service never invokes it automatically. Completed SDK calls and measured evaluation are required before claiming a trained result.

Official references: [River SFT guide](https://docs.river.ai/guides/sft/) and [Python API](https://docs.river.ai/python-api/). The runner uses river-client 0.11.0 public session, model, pending training operation, checkpoint, and sampling APIs. It does not create an account or a dedicated deployment.

Run commands below from the repository root.

```sh
python3 -m venv services/river/.venv
services/river/.venv/bin/python -m pip install -r services/river/requirements.txt
services/river/.venv/bin/python -m unittest discover -s services/river/training -p 'test_*.py'
```

Inspect capabilities with an existing process environment variable `RIVER_API_KEY`. The explicit `--load-authorized-key` option reads only that named variable from the authorized file `~/Workspace/qm-raid/services/forge/.env` when absent from the process environment. It never sources the file, evaluates shell syntax, prints a credential, or loads any other assignment. If the file or key is missing, external execution stops and local preparation remains available.

```sh
services/river/.venv/bin/python services/river/training/run.py discover \
  --output services/river/training/capabilities.json --load-authorized-key
```

Choose an exact returned model name explicitly. The initial intended small model is `Qwen/Qwen3.5-9B`; execution refuses substitution if capabilities no longer include the reviewed model.

```sh
services/river/.venv/bin/python services/river/training/run.py prepare \
  --model Qwen/Qwen3.5-9B --output services/river/training/prepared
```

Preparation makes no River API call and does not read credentials. It downloads only public tokenizer assets into `training/tokenizer-cache/`, with Hugging Face telemetry disabled, and saves a local tokenizer copy. It writes reviewable training text, exact tokenized training payloads, test prompt text and tokens, a deterministic training schedule, and `payload-manifest.json`. The manifest records SHA256 for each file, counts, settings, expected API submissions, tokenizer/library versions, and safety limits. Review these artifacts before running the following command with the exact printed digest. A fresh empty output directory is required for each run.

```sh
services/river/.venv/bin/python services/river/training/run.py run \
  --prepared services/river/training/prepared \
  --manifest-sha256 REVIEWED_DIGEST \
  --output services/river/training/runs/first \
  --submit --load-authorized-key
```

The default fixed training schedule is one epoch, shuffled with seed 20260927, batch size 16, rank 8, learning rate 0.0002, and gradient clipping 1.0. With 336 training records, this makes 21 forward/backward and 21 optimizer submissions. Prompt targets are masked; completion tokens and a single EOS contribute to loss. The terminal EOS has weight zero. A failed forward/backward never triggers an optimizer update. No submission is automatically retried.

The final checkpoint is saved before evaluation. Both base and checkpoint then see the same 72 test prompts, pretokenized once, with identical generation settings and per-prompt seeds. Default evaluation batches contain eight prompts, giving nine base and nine trained sampling submissions. Generation is greedy with a 1024-token limit. Test gold and all dev records remain local; no checkpoint selection uses either split. Test results describe this synthetic holdout only.

Hash canonicalization uses UTF-8 JSON with recursively sorted keys, compact comma and colon separators, Unicode preserved, and no trailing newline. The prompt is exactly `template.rstrip() + "\n\nINPUT_JSON:\n" + canonical(input) + "\n\nOUTPUT_JSON:\n"`. No chat template or special token prefix is added. Both input and full prompt hashes are recorded per prediction.

Each run writes:

- `protocol.json`: pinned model, settings, source hashes, and checkpoint identity.
- `base.jsonl` and `trained.jsonl`: record ID, raw model text in `output`, input/prompt/token hashes, settings, seed, and River request ID.
- `receipts.jsonl`: actual safe session, model, training request, checkpoint, and sampling receipts. No raw error body or credentials are retained.
- `paired-proof.json`: emitted only after both full arms pass identity checks.
- `run-status.json`: local execution status; also published atomically to `training/artifacts/run-status.json` for the service.

Sampling text is evidence, not trusted structured data. The parent service's evaluator validates JSON and contract compliance. Partial files are retained on failure for diagnosis, and failure is never reported as a completed comparison.

Bounds: 300 seconds per operation, 2700 seconds for the run, at most 6000 SDK result polls, and zero submission retries. SDK polling and heartbeats are transport calls in addition to the manifest's semantic submission counts. A Unix process alarm covers SDK cleanup as well as training. It records a failure at the deadline and permits 60 seconds of cleanup before exiting that process. The runner binds no network port. Startup of a local service cannot trigger training.

Prepared token files, tokenizer caches, raw run files, and credentials are excluded from git. Curated synthetic manifests, aggregate results, and safe receipts may be copied by the owning River lane into its result artifacts after review.
