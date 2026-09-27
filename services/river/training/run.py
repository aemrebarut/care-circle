#!/usr/bin/env python3
"""Prepare inspectable synthetic River payloads; submit only with explicit opt-in."""

import argparse
import contextlib
import hashlib
import importlib.metadata
import json
import logging
import math
import os
from pathlib import Path
import random
import re
import signal
import sys
import time
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
RIVER_ROOT = HERE.parent
KEY_FILE = Path.home() / "Workspace/qm-raid/services/forge/.env"
STATUS_FILE = HERE / "artifacts/run-status.json"
SCHEMA = "care-circle-river-protocol-v1"

# Public asset downloads are allowed; usage telemetry is not part of this run.
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["DO_NOT_TRACK"] = "1"


class SafeError(Exception):
    """Only fixed, non-sensitive error codes may be passed to this exception."""


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def sha(value):
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode("utf-8")).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n")
    temporary.replace(path)


def write_jsonl(path, rows):
    Path(path).write_text("".join(canonical(row) + "\n" for row in rows))


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]


def render_prompt(template, input_value):
    # This exact function is shared by train, base evaluation, and trained evaluation.
    return template.rstrip() + "\n\nINPUT_JSON:\n" + canonical(input_value) + "\n\nOUTPUT_JSON:\n"


def load_authorized_key(path=KEY_FILE):
    """Read only the named variable, without dotenv evaluation or logging file data."""
    if os.environ.get("RIVER_API_KEY"):
        return True
    if not path.is_file():
        return False
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            match = re.match(r"^\s*(?:export\s+)?RIVER_API_KEY\s*=\s*(.*?)\s*$", line)
            if not match:
                continue
            value = match.group(1)
            if len(value) >= 2 and value[0] in "\"'" and value[-1] == value[0]:
                value = value[1:-1]
            elif " #" in value:
                value = value.split(" #", 1)[0].rstrip()
            # Never perform substitutions, source a shell, or copy another value.
            if not value or any(char.isspace() for char in value) or "$" in value or "`" in value:
                raise SafeError("invalid_RIVER_API_KEY_format")
            os.environ["RIVER_API_KEY"] = value
            return True
    return False


@contextlib.contextmanager
def quiet_vendor():
    # SDK tracebacks and transport errors can contain request bodies or metadata.
    prior = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        try:
            yield
        finally:
            logging.disable(prior)


def safe_exception(error):
    code = str(error) if isinstance(error, SafeError) else type(error).__name__
    result = {"code": code if re.fullmatch(r"[A-Za-z0-9_]{1,100}", code) else "operation_failed"}
    request_id = getattr(error, "request_id", None)
    if isinstance(request_id, str) and re.fullmatch(r"[A-Za-z0-9:_./-]{1,200}", request_id):
        result["requestId"] = request_id
    return result


def make_client(args):
    if args.load_authorized_key:
        load_authorized_key()
    if not os.environ.get("RIVER_API_KEY"):
        raise SafeError("missing_RIVER_API_KEY_dry_run_only")
    with quiet_vendor():
        import river_client as river
        client = river.Client(api_key=os.environ["RIVER_API_KEY"], timeout=args.operation_timeout, enable_retries=False)
    return river, client


def discover(args):
    _, client = make_client(args)
    try:
        with quiet_vendor():
            models = client.get_capabilities()
        if not isinstance(models, list) or not all(isinstance(model, str) for model in models):
            raise SafeError("unexpected_capabilities_shape")
        result = {"observedAt": now(), "models": sorted(models), "apiCalls": {"get_capabilities": 1},
                  "dataSubmitted": "No notes, gold labels, or training tokens. Capability metadata only.",
                  "selection": "Pass an exact returned model name to prepare. No automatic model substitution."}
        write_json(args.output, result)
        print(canonical(result))
    finally:
        with quiet_vendor():
            client.close()


def load_dataset(directory):
    splits = {name: read_jsonl(directory / f"{name}.jsonl") for name in ("train", "dev", "test")}
    ids, inputs, notes = set(), set(), set()
    for name, rows in splits.items():
        if not rows:
            raise SafeError("empty_dataset_split")
        for row in rows:
            if not isinstance(row.get("id"), str) or row["id"] in ids:
                raise SafeError("duplicate_or_missing_record_id")
            ids.add(row["id"])
            value = row.get("input", {})
            if set(value) != {"note", "date", "authorId"} or not all(isinstance(v, str) and v for v in value.values()):
                raise SafeError("invalid_input_shape")
            fingerprint = sha(canonical(value))
            note_fingerprint = sha(value["note"].strip().lower())
            if fingerprint in inputs or note_fingerprint in notes:
                raise SafeError("duplicate_note_or_input_between_records")
            inputs.add(fingerprint)
            notes.add(note_fingerprint)
            if name == "train" and set(row.get("gold", {})) != {"extraction", "warnings"}:
                raise SafeError("invalid_training_gold_shape")
    return splits


def make_datum(tokenizer, prompt, gold):
    prompt_ids = tokenizer.encode(prompt, add_special_tokens=False)
    completion_ids = tokenizer.encode(canonical(gold), add_special_tokens=False)
    eos = tokenizer.eos_token_id
    if not prompt_ids or not completion_ids or not isinstance(eos, int):
        raise SafeError("tokenizer_missing_prompt_completion_or_eos")
    # Every target is the next token. Train completion and a single EOS only.
    # The terminal EOS has no next token and is masked out.
    ids = prompt_ids + completion_ids + [eos]
    targets = ids[1:] + [eos]
    weights = [0.0] * (len(prompt_ids) - 1) + [1.0] * (len(completion_ids) + 1) + [0.0]
    if len(ids) != len(targets) or len(ids) != len(weights):
        raise SafeError("token_mask_length_mismatch")
    return {"input_ids": ids, "target_tokens": targets, "weights": weights}, prompt_ids


def prepare(args):
    dataset = Path(args.dataset).resolve()
    output = Path(args.output).resolve()
    if output.exists() and any(output.iterdir()):
        raise SafeError("prepare_output_must_be_empty")
    splits = load_dataset(dataset)
    template_path = dataset / "prompt.txt"
    template = template_path.read_text()
    with quiet_vendor():
        from transformers import AutoTokenizer
        # Only public tokenizer assets are downloaded; no model weights or remote code.
        tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=False, token=False,
                                                   cache_dir=HERE / "tokenizer-cache")
    output.mkdir(parents=True, exist_ok=True)
    with quiet_vendor():
        tokenizer.save_pretrained(output / "tokenizer")
    train_payload, training_text, evaluation = [], [], []
    for row in splits["train"]:
        prompt = render_prompt(template, row["input"])
        datum, prompt_ids = make_datum(tokenizer, prompt, row["gold"])
        if len(datum["input_ids"]) > args.max_sequence_tokens:
            raise SafeError("training_sequence_exceeds_reviewed_limit")
        train_payload.append({"id": row["id"], "datum": datum})
        training_text.append({"id": row["id"], "prompt": prompt, "completion": canonical(row["gold"]),
                              "inputSha256": sha(canonical(row["input"])), "promptSha256": sha(prompt)})
    for index, row in enumerate(splits["test"]):
        prompt = render_prompt(template, row["input"])
        prompt_ids = tokenizer.encode(prompt, add_special_tokens=False)
        if len(prompt_ids) + args.max_tokens > args.max_sequence_tokens:
            raise SafeError("evaluation_sequence_exceeds_reviewed_limit")
        # Deliberate allowlist: gold and other dataset metadata never enter this file.
        evaluation.append({"id": row["id"], "prompt": prompt, "promptTokenIds": prompt_ids,
                           "inputSha256": sha(canonical(row["input"])), "promptSha256": sha(prompt),
                           "promptTokenIdsSha256": sha(canonical(prompt_ids)), "seed": args.seed + index})
    write_jsonl(output / "train-tokens.jsonl", train_payload)
    write_jsonl(output / "train-text.jsonl", training_text)
    write_jsonl(output / "test-prompts.jsonl", evaluation)
    order = list(range(len(train_payload)))
    schedule = []
    for epoch in range(args.epochs):
        random.Random(args.seed + epoch).shuffle(order)
        for offset in range(0, len(order), args.batch_size):
            indices = order[offset:offset + args.batch_size]
            data = [train_payload[i]["datum"] for i in indices]
            schedule.append({"step": len(schedule) + 1, "epoch": epoch + 1, "indices": indices,
                             "ids": [train_payload[i]["id"] for i in indices], "dataSha256": sha(canonical(data))})
    write_json(output / "schedule.json", schedule)
    files = {str(path.relative_to(output)): {"sha256": sha(path.read_bytes()), "bytes": path.stat().st_size}
             for path in sorted(output.rglob("*")) if path.is_file()}
    sample_calls = math.ceil(len(evaluation) / args.eval_batch_size)
    manifest = {"schema": SCHEMA, "createdAt": now(), "syntheticOnly": True,
                "baseModel": args.model, "noModelSubstitution": True,
                "dataset": {name: {"count": len(rows), "sha256": sha((dataset / f"{name}.jsonl").read_bytes())}
                            for name, rows in splits.items()},
                "promptTemplateSha256": sha(template_path.read_bytes()),
                "promptRendering": "template.rstrip() + LF LF INPUT_JSON: LF + canonical(input) + LF LF OUTPUT_JSON: LF",
                "canonicalJson": "UTF-8; recursively sorted keys; compact comma/colon; Unicode preserved; no trailing newline",
                "tokenization": {"addSpecialTokens": False, "chatTemplateApplied": False,
                                  "eosTokenId": tokenizer.eos_token_id, "trainingLoss": "completion and one EOS only"},
                "training": {"epochs": args.epochs, "batchSize": args.batch_size, "steps": len(schedule),
                             "rank": args.rank, "learningRate": args.learning_rate, "seed": args.seed,
                             "lossFunction": "cross_entropy", "gradClipNorm": 1.0,
                             "maxSequenceTokens": args.max_sequence_tokens,
                             "uniqueRecords": len(train_payload),
                             "tokensPerEpoch": sum(len(row["datum"]["input_ids"]) for row in train_payload)},
                "generation": {"num_samples": 1, "max_tokens": args.max_tokens, "temperature": 0.0,
                               "top_p": 1.0, "top_k": -1, "stop": None},
                "evaluation": {"split": "test", "count": len(evaluation), "batchSize": args.eval_batch_size,
                               "order": "Train fixed schedule, save final checkpoint, then base and trained test evaluation.",
                               "samePromptTokenIdsBothArms": True, "sameGenerationSettingsBothArms": True,
                               "seeds": [row["seed"] for row in evaluation], "goldSubmitted": False,
                               "promptSetSha256": sha(canonical([{k: row[k] for k in ("id", "promptSha256", "promptTokenIdsSha256", "seed")} for row in evaluation]))},
                "expectedApiCalls": {"get_capabilities": 1, "create_session": 1, "create_model": 1,
                                     "base_sample_submissions": sample_calls, "forward_backward_submissions": len(schedule),
                                     "optim_step_submissions": len(schedule), "save_weights": 1,
                                     "trained_sample_submissions": sample_calls, "unload_model_on_exit": 1},
                "transportNotes": "Counts describe semantic submissions. SDK polling and heartbeats are additional RPCs, bounded by operation timeouts, poll count, and run deadline. No submission retries.",
                "limits": {"operationTimeoutSeconds": args.operation_timeout, "maxRunSeconds": args.max_run_seconds,
                           "maxPolls": args.max_polls, "submissionRetries": 0},
                "privacy": {"training": "Only train prompt token IDs, completion target token IDs, and loss masks.",
                            "evaluation": "Only held-out prompt token IDs and generation settings. Test gold stays local.",
                            "dev": "Local only; not submitted or used for checkpoint selection."},
                "versions": {name: importlib.metadata.version(name) for name in ("river-client", "transformers")},
                "files": files}
    write_json(output / "payload-manifest.json", manifest)
    digest = sha((output / "payload-manifest.json").read_bytes())
    (output / "payload-manifest.sha256").write_text(digest + "\n")
    print(canonical({"status": "prepared_only_no_River_calls", "manifestSha256": digest,
                     "manifest": str(output / "payload-manifest.json"), "counts": {k: len(v) for k, v in splits.items()},
                     "expectedApiCalls": manifest["expectedApiCalls"]}))


def verify_prepared(directory, digest):
    manifest_bytes = (directory / "payload-manifest.json").read_bytes()
    if sha(manifest_bytes) != digest:
        raise SafeError("manifest_sha256_mismatch")
    manifest = json.loads(manifest_bytes)
    if manifest.get("schema") != SCHEMA:
        raise SafeError("unsupported_protocol_schema")
    for name, expected in manifest["files"].items():
        path = (directory / name).resolve()
        if not path.is_relative_to(directory.resolve()) or not path.is_file():
            raise SafeError("invalid_prepared_file_path")
        if sha(path.read_bytes()) != expected["sha256"]:
            raise SafeError("prepared_file_sha256_mismatch")
    return manifest


class Recorder:
    def __init__(self, output, manifest, digest):
        self.output = output
        self.output.mkdir(parents=True, exist_ok=False)
        self.started = time.monotonic()
        self.manifest = manifest
        self.polls = 0
        self.receipts = 0
        self.status = {"status": "starting", "startedAt": now(), "updatedAt": now(),
                       "completedSteps": 0, "plannedSteps": manifest["training"]["steps"],
                       "runDir": str(output), "model": manifest["baseModel"], "checkpoint": None,
                       "manifestSha256": digest, "errors": [], "receiptCount": 0}
        self.protocol = {**manifest, "testSha256": manifest["dataset"]["test"]["sha256"],
                         "promptSha256": manifest["promptTemplateSha256"], "trainedCheckpoint": None,
                         "manifestSha256": digest}
        write_json(self.output / "protocol.json", self.protocol)
        self.update("starting")

    def update(self, status, **values):
        self.status.update(values)
        self.status.update(status=status, updatedAt=now(), receiptCount=self.receipts, pollCount=self.polls)
        write_json(self.output / "run-status.json", self.status)
        write_json(STATUS_FILE, self.status)

    def event(self, operation, **values):
        self.receipts += 1
        with (self.output / "receipts.jsonl").open("a") as stream:
            stream.write(canonical({"at": now(), "operation": operation, **values}) + "\n")

    def guard(self):
        if time.monotonic() - self.started >= self.manifest["limits"]["maxRunSeconds"]:
            raise SafeError("run_deadline_exceeded")

    def before_poll(self):
        self.guard()
        self.polls += 1
        if self.polls > self.manifest["limits"]["maxPolls"]:
            raise SafeError("poll_limit_exceeded")


def safe_metrics(result):
    return {key: value for key, value in getattr(result, "metrics", {}).items()
            if isinstance(key, str) and re.fullmatch(r"[a-zA-Z0-9_./-]{1,80}", key)
            and isinstance(value, (int, float)) and math.isfinite(value)}


class ProcessDeadline:
    """Bound SDK session cleanup too; its unload helper has a long SDK default."""
    def __init__(self, recorder):
        self.recorder = recorder
        self.triggered = False

    def expire(self, signum, frame):
        if self.triggered:
            # The parent owns this process. Preserve the already-written failure receipt.
            os._exit(124)
        self.triggered = True
        self.recorder.event("deadline_exceeded")
        self.recorder.update("failed", errors=[{"code": "run_deadline_exceeded"}], failedAt=now())
        signal.setitimer(signal.ITIMER_REAL, 60)
        raise SafeError("run_deadline_exceeded")

    def start(self):
        self.previous = signal.signal(signal.SIGALRM, self.expire)
        signal.setitimer(signal.ITIMER_REAL, self.recorder.manifest["limits"]["maxRunSeconds"])

    def stop(self):
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, self.previous)


def evaluate(session, tokenizer, checkpoint, arm, rows, manifest, recorder):
    settings = manifest["generation"]
    batch_size = manifest["evaluation"]["batchSize"]
    output_file = recorder.output / f"{arm}.jsonl"
    for offset in range(0, len(rows), batch_size):
        recorder.guard()
        batch = rows[offset:offset + batch_size]
        kwargs = {"base_model": manifest["baseModel"], "prompt_token_ids": [row["promptTokenIds"] for row in batch],
                  "tokenizer": tokenizer, "seeds": [row["seed"] for row in batch],
                  "timeout": manifest["limits"]["operationTimeoutSeconds"], **settings}
        if checkpoint is not None:
            kwargs["checkpoint"] = checkpoint
        recorder.event(f"{arm}_sample_attempt", ids=[row["id"] for row in batch])
        with quiet_vendor():
            results = session.sample(**kwargs)
        if len(results) != len(batch) or any(len(samples) != 1 for samples in results):
            raise SafeError("unexpected_sample_count")
        with output_file.open("a") as stream:
            for row, samples in zip(batch, results):
                sample = samples[0]
                prediction = {key: row[key] for key in ("id", "inputSha256", "promptSha256", "promptTokenIdsSha256", "seed")}
                prediction.update(output=sample.text, arm=arm, model=manifest["baseModel"],
                                  checkpoint=checkpoint.path if checkpoint else None,
                                  generation=settings, generationSha256=sha(canonical(settings)),
                                  requestId=getattr(sample, "request_id", ""), stopReason=getattr(sample, "stop_reason", None))
                stream.write(canonical(prediction) + "\n")
        recorder.event(f"{arm}_sample_completed", ids=[row["id"] for row in batch],
                       requestIds=sorted({getattr(samples[0], "request_id", "") for samples in results}))
        recorder.update(f"evaluating_{arm}", **{f"{arm}Predictions": offset + len(batch)})


def execute(args):
    if not args.submit:
        raise SafeError("submit_flag_required_no_external_call_made")
    prepared = Path(args.prepared).resolve()
    manifest = verify_prepared(prepared, args.manifest_sha256)
    args.operation_timeout = manifest["limits"]["operationTimeoutSeconds"]
    rows = read_jsonl(prepared / "test-prompts.jsonl")
    train = read_jsonl(prepared / "train-tokens.jsonl")
    schedule = json.loads((prepared / "schedule.json").read_text())
    # Validation precedes all credential access and River calls.
    if len(rows) != manifest["evaluation"]["count"] or len(schedule) != manifest["training"]["steps"]:
        raise SafeError("prepared_count_mismatch")
    if any(set(row) != {"id", "prompt", "promptTokenIds", "inputSha256", "promptSha256", "promptTokenIdsSha256", "seed"} for row in rows):
        raise SafeError("unreviewed_eval_fields")
    for row in rows:
        if sha(row["prompt"]) != row["promptSha256"] or sha(canonical(row["promptTokenIds"])) != row["promptTokenIdsSha256"]:
            raise SafeError("prompt_hash_mismatch")
    recorder = Recorder(Path(args.output).resolve(), manifest, args.manifest_sha256)
    client = None
    deadline = ProcessDeadline(recorder)
    deadline.start()
    try:
        with quiet_vendor():
            from transformers import AutoTokenizer
            tokenizer = AutoTokenizer.from_pretrained(prepared / "tokenizer", local_files_only=True, trust_remote_code=False)
        river, client = make_client(args)
        with quiet_vendor():
            capabilities = client.get_capabilities()
        recorder.event("get_capabilities", models=capabilities)
        if manifest["baseModel"] not in capabilities:
            raise SafeError("reviewed_model_unavailable_no_substitution")
        with quiet_vendor():
            context = client.session(project="care-circle-synthetic-sft", timeout=args.operation_timeout,
                                     before_poll=recorder.before_poll,
                                     on_session_creation_attempted=lambda: recorder.event("create_session_attempt"),
                                     on_session_closed=lambda: recorder.event("session_cleanup_completed"))
        with quiet_vendor(), context as session:
            recorder.event("session_created", sessionId=session.session_id)
            recorder.update("creating_model", sessionId=session.session_id)
            recorder.guard()
            with quiet_vendor():
                model = session.create_model(base_model=manifest["baseModel"], tokenizer=tokenizer,
                                             lora=river.LoraConfig(rank=manifest["training"]["rank"]),
                                             timeout=args.operation_timeout)
            recorder.event("create_model", modelId=model.model_id)
            recorder.update("training", modelId=model.model_id)
            for step in schedule:
                recorder.guard()
                data = [train[i]["datum"] for i in step["indices"]]
                if sha(canonical(data)) != step["dataSha256"]:
                    raise SafeError("batch_payload_hash_mismatch")
                with quiet_vendor():
                    pending = model.submit_forward_backward(data, loss_fn="cross_entropy", timeout=args.operation_timeout)
                recorder.event("forward_backward_submitted", step=step["step"], requestId=pending.request_id,
                               dataSha256=step["dataSha256"], recordCount=len(data))
                with quiet_vendor():
                    result = pending.result(before_poll=recorder.before_poll)
                recorder.event("forward_backward_completed", step=step["step"], requestId=pending.request_id, metrics=safe_metrics(result))
                recorder.guard()
                with quiet_vendor():
                    pending = model.submit_optim_step(lr=manifest["training"]["learningRate"], grad_clip_norm=1.0,
                                                      timeout=args.operation_timeout)
                recorder.event("optim_step_submitted", step=step["step"], requestId=pending.request_id)
                with quiet_vendor():
                    result = pending.result(before_poll=recorder.before_poll)
                recorder.event("optim_step_completed", step=step["step"], requestId=pending.request_id, metrics=safe_metrics(result))
                recorder.update("training", completedSteps=step["step"])
            recorder.guard()
            recorder.update("saving_checkpoint")
            with quiet_vendor():
                checkpoint = model.save_weights("care-circle-final", mode="inference", timeout=args.operation_timeout)
            recorder.event("save_weights", checkpoint=checkpoint.path, step=checkpoint.step)
            recorder.protocol["trainedCheckpoint"] = checkpoint.path
            write_json(recorder.output / "protocol.json", recorder.protocol)
            recorder.update("evaluating_base", checkpoint=checkpoint.path)
            evaluate(session, tokenizer, None, "base", rows, manifest, recorder)
            recorder.update("evaluating_trained", checkpoint=checkpoint.path)
            evaluate(session, tokenizer, checkpoint, "trained", rows, manifest, recorder)
            base, trained = read_jsonl(recorder.output / "base.jsonl"), read_jsonl(recorder.output / "trained.jsonl")
            identity_keys = ("id", "inputSha256", "promptSha256", "promptTokenIdsSha256", "seed", "generationSha256")
            if len(base) != len(trained) or any(any(a[key] != b[key] for key in identity_keys) for a, b in zip(base, trained)):
                raise SafeError("paired_evaluation_protocol_mismatch")
            write_json(recorder.output / "paired-proof.json", {"verified": True, "count": len(base),
                       "fieldsCompared": list(identity_keys), "manifestSha256": args.manifest_sha256,
                       "basePredictionsSha256": sha((recorder.output / "base.jsonl").read_bytes()),
                       "trainedPredictionsSha256": sha((recorder.output / "trained.jsonl").read_bytes()),
                       "testGoldSubmitted": False, "checkpoint": checkpoint.path})
        recorder.update("completed", completedAt=now())
        print(canonical(recorder.status))
    except BaseException as error:
        recorder.event("run_failed", error=safe_exception(error))
        recorder.update("failed", errors=[safe_exception(error)], failedAt=now())
        raise
    finally:
        try:
            if client is not None:
                with quiet_vendor():
                    client.close()
        finally:
            deadline.stop()


def positive(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def cli():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    discover_parser = commands.add_parser("discover", help="Query authorized model names only; no note submission")
    discover_parser.add_argument("--output", default=str(HERE / "capabilities.json"))
    discover_parser.add_argument("--operation-timeout", type=positive, default=300)
    discover_parser.add_argument("--load-authorized-key", action="store_true")
    discover_parser.set_defaults(handler=discover)
    prepare_parser = commands.add_parser("prepare", help="Prepare reviewable payload locally; downloads a public tokenizer")
    prepare_parser.add_argument("--model", required=True)
    prepare_parser.add_argument("--dataset", default=str(RIVER_ROOT / "dataset"))
    prepare_parser.add_argument("--output", default=str(HERE / "prepared"))
    prepare_parser.add_argument("--batch-size", type=positive, default=16)
    prepare_parser.add_argument("--eval-batch-size", type=positive, default=8)
    prepare_parser.add_argument("--epochs", type=positive, default=1)
    prepare_parser.add_argument("--rank", type=positive, default=8)
    prepare_parser.add_argument("--learning-rate", type=float, default=2e-4)
    prepare_parser.add_argument("--seed", type=int, default=20260927)
    prepare_parser.add_argument("--max-tokens", type=positive, default=1024)
    prepare_parser.add_argument("--max-sequence-tokens", type=positive, default=8192)
    prepare_parser.add_argument("--operation-timeout", type=positive, default=300)
    prepare_parser.add_argument("--max-run-seconds", type=positive, default=2700)
    prepare_parser.add_argument("--max-polls", type=positive, default=6000)
    prepare_parser.set_defaults(handler=prepare)
    run_parser = commands.add_parser("run", help="Submit the exact reviewed manifest with explicit opt-in")
    run_parser.add_argument("--prepared", default=str(HERE / "prepared"))
    run_parser.add_argument("--manifest-sha256", required=True)
    run_parser.add_argument("--output", required=True)
    run_parser.add_argument("--submit", action="store_true")
    run_parser.add_argument("--load-authorized-key", action="store_true")
    run_parser.set_defaults(handler=execute)
    args = parser.parse_args()
    if args.command == "prepare" and (args.rank > 32 or not math.isfinite(args.learning_rate) or args.learning_rate <= 0):
        raise SafeError("invalid_training_hyperparameters")
    args.handler(args)


if __name__ == "__main__":
    try:
        cli()
    except BaseException as error:
        if isinstance(error, SystemExit):
            raise
        # Deliberately no raw exception text, traceback, environment, or vendor body.
        print(canonical({"status": "failed", "error": safe_exception(error)}), file=sys.stderr)
        sys.exit(130 if isinstance(error, KeyboardInterrupt) else 1)
