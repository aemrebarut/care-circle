# Care Circle River lane

This service prepares synthetic note extraction experiments and reports what actually ran. It never recommends a dose or treatment. All records describe fictional people and source claims. Not medical advice.

## Run

```sh
node services/river/server.mjs
npm --prefix services/river test
node services/river/smoke.mjs
```

The service binds only `127.0.0.1:4704`. The runtime lane owns its persistent process. Startup does not read credentials, install packages, upload data or train a model. `GET /health` is independent of River availability. `GET /v1/status` reports corpus and experiment artifacts, with null paired metrics until both model runs have been verified. `POST /v1/extract` returns explicit 503 so ingest uses its conservative deterministic fallback. Future visit dates receive 422. No live or cached River extraction is served.

## Measured fixed experiment

River completed a real 21-step SFT run on 336 synthetic examples using Qwen/Qwen3.5-9B, saved a checkpoint, and evaluated 72 held-out notes on each arm. The trained model achieved 71/72 full-task exact matches (98.61%) and 72/72 extraction exact matches. One response added a spurious unsupported-medication warning.

The base achieved 0/72 strict full-response JSON matches under the same raw completion prompt and 1024-token budget. It generated extra text, and 54/72 responses hit the token cap. No chat template was applied. These numbers measure this output protocol and narrow synthetic task, not general model extraction ability or clinical accuracy. The test contains six held-out wording families with shared atomic vocabulary. No test-guided prompt or checkpoint selection occurred. An independent Python audit verified the paired provenance and arithmetic. See [full results and caveats](results/comparison.json), [raw receipts](results/experiment-1/receipts.jsonl), and [independent audit](review/result-audit.md).

Two separate product-demo samples failed validation. The first invented an unstated due date; one authorized product-only prompt revision omitted that date but returned malformed JSON. Both unchanged raw predictions and receipts are retained in `results/demo-attempt-1/` and `results/demo-attempt-2/`. No repair or successful replay is claimed. The product prompt has its own hash and does not alter the frozen benchmark. No further sampling or training is planned.

## Corpus and evaluation

The corpus generator creates synthetic note/gold pairs with train, development and test splits. Split manifests and content hashes live under `dataset/`. Held-out examples are never SFT inputs. Base and trained outputs must use the same frozen prompt, inputs and decoding settings.

`eval.mjs` checks JSON validity, Extraction schema validity, medication exactness, complete extraction exactness, structured exactness excluding copied summary, warning exactness, and full task exactness. The denominator includes every held-out row, including missing or invalid predictions. Unsupported medication claims are compared with gold among schema-valid outputs. This is a narrow synthetic benchmark, not a clinical accuracy claim.

```sh
node services/river/eval-local.mjs
node services/river/eval.mjs TEST.jsonl BASE.jsonl TRAINED.jsonl PROTOCOL.json services/river/results/comparison.json
```

The local command calls only the loopback ingest service at port 4702. It labels its scores `local-deterministic`, never base or trained River results. A paired River comparison additionally checks per-row input and prompt hashes and requires a checkpoint identifier.

## River workflow and authorization

Emre authorized upload of the synthetic corpus for River training and evaluation. The runner under `training/` is a separate explicit opt-in command. Its payload manifest must be reviewed before submission. Only `RIVER_API_KEY` may be loaded from the specifically authorized file; never print or copy the key. No credentials enter dataset, logs, status or committed artifacts.

Official references: [River quickstart](https://docs.river.ai/quickstart/), [SFT guide](https://docs.river.ai/guides/sft/), [Python API](https://docs.river.ai/python-api/). The experiment uses the documented token-level supervised training loop and saved checkpoint sampling. A supported River architecture is the experimental artifact, separate from the Astra agents implementing this repository.

## Files and boundaries

- `server.mjs`, `smoke.mjs`, `test/`: local API and checks.
- `generate-dataset.mjs`, `dataset/`: generated corpus, source protocol and immutable split manifest.
- `training/`, `requirements.txt`: reviewed River payload and opt-in training runner.
- `eval.mjs`, `eval-local.mjs`, `results/`: measured evaluation and prediction receipts.
- `review/`: independent leakage and evaluation findings.

Only HTTP connects this service to ingest. No cross-lane source imports or family brain access. Runtime startup is always safe without a key. Training does not imply that live River extraction is integrated; status reports those facts separately.
