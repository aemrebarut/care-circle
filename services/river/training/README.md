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

## Fixed demo checkpoint sample

`demo.py` is a separate opt-in tool for the exact synthetic cardiology note in the shared contract, with Ana and date 2026-09-27. It has no arbitrary note, author, date, model, checkpoint, or generation-setting option. It requires the frozen paired experiment to be completed, verifies its prediction hashes, and reuses its prompt template and settings. It performs no training, test tuning, or deployment.

```sh
services/river/.venv/bin/python services/river/training/demo.py prepare \
  --paired-run services/river/training/runs/experiment-1 \
  --output services/river/training/demo-prepared
services/river/.venv/bin/python services/river/training/demo.py run \
  --plan-directory services/river/training/demo-prepared \
  --plan-sha256 REVIEWED_DEMO_PLAN_DIGEST \
  --paired-run services/river/training/runs/experiment-1 \
  --output services/river/training/demo-runs/first \
  --submit --load-authorized-key
```

Preparation is local only and writes `payload.json`, `plan.json`, and `plan.sha256`. Execution creates one session and submits exactly one checkpoint sample, with bounded result polling and no submission retry. It writes `prediction.json` containing the raw output, fixed input, provenance hashes, model/checkpoint, generation settings, seed, request/session IDs, sample time, and `validationStatus: "unvalidated-raw"`. The parent validates the output before publishing an exact-input cache. A cache hit must be described as a replay of the recorded River sample, never as a fresh request or general live inference. Other input receives an unavailable response so the existing fallback can take over. Demo progress stays separate from completed training status.

The optional `prepare --product-protocol` selects the separate static `product-prompt.txt` template, labeled `product-relative-date-v1`. It clarifies that relative weekday text stays in the follow-up text, and an optional `dueDate` requires a literal ISO date in that same source task. It supplies no gold answer. The fixed demo input, checkpoint, generation settings, and seed stay identical. This is a product prompt experiment and does not change the frozen benchmark prompt, predictions, weights, or reported metrics. Its plan and artifact carry separate product and benchmark template hashes. The original first demo artifact is retained unchanged.

```sh
services/river/.venv/bin/python services/river/training/demo.py prepare \
  --product-protocol \
  --paired-run services/river/training/runs/experiment-1 \
  --output services/river/training/demo-prepared-product
```

After review, use the ordinary `run` command with this plan directory and digest, and a fresh output such as `training/demo-runs/product-relative-date-1`. Exactly one additional sample attempt is authorized for this protocol. The runner reserves `training/artifacts/product-relative-date-v1-attempt.json` immediately before the sample RPC and refuses a repeated attempt, including after an uncertain outcome. Do not remove that receipt to retry. If the raw result fails source validation, keep the deterministic fallback and publish no accepted cached result. Validators are unchanged.

Recorded demo outcome: the first fixed-note sample invented a due date absent from the source and was rejected by the source guard. The one authorized product-protocol sample returned invalid JSON and was rejected. Both raw artifacts and receipts are preserved; neither is an accepted cached extraction. The authorized product attempt is exhausted. The product retains its deterministic fallback, while the separately completed frozen training and paired evaluation remain unchanged. No further sample, prompt tuning, or training is authorized by this protocol.
