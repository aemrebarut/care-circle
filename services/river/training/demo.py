#!/usr/bin/env python3
"""Sample one fixed synthetic demo note from the already-trained checkpoint."""
import argparse
import json
from pathlib import Path
import sys

from run import (HERE, RIVER_ROOT, ProcessDeadline, SafeError, canonical, make_client,
                 now, quiet_vendor, render_prompt, safe_exception, sha, write_json)

MODEL = "Qwen/Qwen3.5-9B"
CHECKPOINT = "river://ac60a978-376d-43b2-a03b-4e7b9d358337/sampler_weights/care-circle-final"
DEMO_NOTE = "Cardiology today with Ana. Dr. Chen increased lisinopril to 20 mg daily. Wants potassium rechecked before nephrology Tuesday. Ask the nephrologist about the potassium recheck."
DEMO_INPUT = {"note": DEMO_NOTE, "authorId": "people/ana-alvarez", "date": "2026-09-27"}
SCHEMA = "care-circle-fixed-demo-v1"
BENCHMARK_PROMPT_PROTOCOL = "frozen-benchmark-v1"
PRODUCT_PROMPT_PROTOCOL = "product-relative-date-v1"
PRODUCT_PROMPT_PATH = HERE / "product-prompt.txt"
PRODUCT_ATTEMPT_PATH = HERE / "artifacts/product-relative-date-v1-attempt.json"


def completed_protocol(directory):
    """Refuse to interfere with the frozen paired experiment or reuse partial proof."""
    directory = Path(directory).resolve()
    protocol = json.loads((directory / "protocol.json").read_text())
    status = json.loads((directory / "run-status.json").read_text())
    proof_path = directory / "paired-proof.json"
    proof = json.loads(proof_path.read_text())
    if status.get("status") != "completed" or proof.get("verified") is not True:
        raise SafeError("paired_evaluation_must_be_completed")
    if protocol.get("baseModel") != MODEL or protocol.get("trainedCheckpoint") != CHECKPOINT or proof.get("checkpoint") != CHECKPOINT:
        raise SafeError("fixed_demo_checkpoint_mismatch")
    if proof.get("count") != protocol["evaluation"]["count"]:
        raise SafeError("paired_evaluation_count_mismatch")
    for arm in ("base", "trained"):
        if sha((directory / f"{arm}.jsonl").read_bytes()) != proof.get(f"{arm}PredictionsSha256"):
            raise SafeError("paired_evaluation_proof_mismatch")
    if protocol.get("generationSha256") != sha(canonical(protocol["generation"])):
        raise SafeError("paired_generation_fingerprint_mismatch")
    return protocol, sha(proof_path.read_bytes())


def fixed_prompt(protocol):
    template_path = RIVER_ROOT / "dataset/prompt.txt"
    if sha(template_path.read_bytes()) != protocol["promptSha256"]:
        raise SafeError("frozen_prompt_template_mismatch")
    return render_prompt(template_path.read_text(), DEMO_INPUT)


def selected_prompt(protocol, prompt_protocol):
    benchmark_prompt = fixed_prompt(protocol)
    if prompt_protocol == BENCHMARK_PROMPT_PROTOCOL:
        return benchmark_prompt, protocol["promptSha256"]
    if prompt_protocol != PRODUCT_PROMPT_PROTOCOL:
        raise SafeError("unsupported_demo_prompt_protocol")
    template_bytes = PRODUCT_PROMPT_PATH.read_bytes()
    template_sha = sha(template_bytes)
    if template_sha == protocol["promptSha256"]:
        raise SafeError("product_prompt_must_differ_from_benchmark")
    return render_prompt(template_bytes.decode("utf-8"), DEMO_INPUT), template_sha


def local_tokenizer():
    # Uses the tokenizer frozen for the original training experiment; no download.
    with quiet_vendor():
        from transformers import AutoTokenizer
        return AutoTokenizer.from_pretrained(HERE / "prepared/tokenizer", local_files_only=True, trust_remote_code=False)


def prepare(args):
    directory = Path(args.output).resolve()
    if directory.exists() and any(directory.iterdir()):
        raise SafeError("demo_plan_output_must_be_empty")
    protocol, proof_sha = completed_protocol(args.paired_run)
    prompt_protocol = PRODUCT_PROMPT_PROTOCOL if getattr(args, "product_protocol", False) else BENCHMARK_PROMPT_PROTOCOL
    prompt, template_sha = selected_prompt(protocol, prompt_protocol)
    token_ids = local_tokenizer().encode(prompt, add_special_tokens=False)
    payload = {"input": DEMO_INPUT, "prompt": prompt, "promptTokenIds": token_ids,
               "inputSha256": sha(canonical(DEMO_INPUT)), "promptSha256": sha(prompt),
               "promptTokenIdsSha256": sha(canonical(token_ids)),
               "promptProtocol": prompt_protocol, "promptTemplateSha256": template_sha,
               "benchmarkPromptTemplateSha256": protocol["promptSha256"],
               "model": MODEL, "checkpoint": CHECKPOINT, "generation": protocol["generation"],
               "generationSha256": protocol["generationSha256"], "seed": protocol["training"]["seed"]}
    directory.mkdir(parents=True, exist_ok=True)
    write_json(directory / "payload.json", payload)
    plan = {"schema": SCHEMA, "scope": "fixed-contract-demo-note-only", "createdAt": now(),
            "syntheticOnly": True, "payloadSha256": sha((directory / "payload.json").read_bytes()),
            "pairedProofSha256": proof_sha, "originalManifestSha256": protocol["manifestSha256"],
            "model": MODEL, "checkpoint": CHECKPOINT, "inputSha256": payload["inputSha256"],
            "promptSha256": payload["promptSha256"], "generationSha256": payload["generationSha256"],
            "promptProtocol": prompt_protocol, "promptTemplateSha256": template_sha,
            "benchmarkPromptTemplateSha256": protocol["promptSha256"],
            "singleProductAttemptLimit": 1 if prompt_protocol == PRODUCT_PROMPT_PROTOCOL else None,
            "expectedApiCalls": {"create_session": 1, "checkpoint_sample_submissions": 1},
            "trainingCalls": 0, "heldOutEvaluationCalls": 0, "goldSubmitted": False,
            "limits": {"operationTimeoutSeconds": 300, "maxRunSeconds": 660, "maxPolls": 900,
                       "submissionRetries": 0},
            "transportNotes": "SDK polling and heartbeats are additional bounded transport calls. No model creation or deployment.",
            "artifactUse": "Unvalidated raw prediction. Parent validates before publishing an exact-input cached replay. No arbitrary-input endpoint."}
    write_json(directory / "plan.json", plan)
    digest = sha((directory / "plan.json").read_bytes())
    (directory / "plan.sha256").write_text(digest + "\n")
    print(canonical({"status": "prepared_only_no_River_calls", "planSha256": digest,
                     "plan": str(directory / "plan.json"), "expectedApiCalls": plan["expectedApiCalls"]}))


def verify_plan(args):
    directory = Path(args.plan_directory).resolve()
    plan_bytes = (directory / "plan.json").read_bytes()
    if sha(plan_bytes) != args.plan_sha256:
        raise SafeError("demo_plan_sha256_mismatch")
    plan = json.loads(plan_bytes)
    if plan.get("schema") != SCHEMA or plan.get("scope") != "fixed-contract-demo-note-only":
        raise SafeError("unsupported_demo_plan")
    payload_bytes = (directory / "payload.json").read_bytes()
    if sha(payload_bytes) != plan["payloadSha256"]:
        raise SafeError("demo_payload_sha256_mismatch")
    payload = json.loads(payload_bytes)
    protocol, proof_sha = completed_protocol(args.paired_run)
    if proof_sha != plan["pairedProofSha256"] or protocol["manifestSha256"] != plan["originalManifestSha256"]:
        raise SafeError("paired_experiment_identity_mismatch")
    if payload.get("input") != DEMO_INPUT or payload.get("model") != MODEL or payload.get("checkpoint") != CHECKPOINT:
        raise SafeError("only_fixed_demo_input_and_checkpoint_allowed")
    prompt_protocol = plan.get("promptProtocol", BENCHMARK_PROMPT_PROTOCOL)
    prompt, template_sha = selected_prompt(protocol, prompt_protocol)
    if payload.get("promptProtocol", BENCHMARK_PROMPT_PROTOCOL) != prompt_protocol:
        raise SafeError("demo_prompt_protocol_mismatch")
    if payload.get("prompt") != prompt:
        raise SafeError("only_frozen_demo_prompt_allowed")
    if prompt_protocol == PRODUCT_PROMPT_PROTOCOL and (
            plan.get("singleProductAttemptLimit") != 1 or plan.get("promptTemplateSha256") != template_sha
            or plan.get("benchmarkPromptTemplateSha256") != protocol["promptSha256"]):
        raise SafeError("product_protocol_manifest_mismatch")
    if payload.get("generation") != protocol["generation"] or payload.get("generationSha256") != protocol["generationSha256"]:
        raise SafeError("frozen_generation_settings_mismatch")
    if payload.get("seed") != protocol["training"]["seed"]:
        raise SafeError("frozen_demo_seed_mismatch")
    for field, expected in (("inputSha256", sha(canonical(DEMO_INPUT))),
                            ("promptSha256", sha(payload["prompt"])),
                            ("promptTokenIdsSha256", sha(canonical(payload["promptTokenIds"]))),
                            ("promptTemplateSha256", template_sha)):
        if payload.get(field) != expected:
            raise SafeError("demo_provenance_hash_mismatch")
    tokenizer = local_tokenizer()
    if tokenizer.encode(payload["prompt"], add_special_tokens=False) != payload["promptTokenIds"]:
        raise SafeError("demo_tokenizer_payload_mismatch")
    return plan, payload, tokenizer


class DemoRecorder:
    """Keep demo progress separate from the completed training service status."""
    def __init__(self, output, plan):
        self.output = Path(output).resolve()
        self.output.mkdir(parents=True, exist_ok=False)
        self.manifest = plan
        self.polls = 0
        self.status = {"status": "starting", "startedAt": now(), "model": MODEL, "checkpoint": CHECKPOINT}
        self.update("starting")

    def update(self, status, **values):
        self.status.update(status=status, updatedAt=now(), **values)
        write_json(self.output / "run-status.json", self.status)

    def event(self, operation, **values):
        with (self.output / "receipts.jsonl").open("a") as stream:
            stream.write(canonical({"at": now(), "operation": operation, **values}) + "\n")

    def before_poll(self):
        self.polls += 1
        if self.polls > self.manifest["limits"]["maxPolls"]:
            raise SafeError("demo_poll_limit_exceeded")


def execute(args):
    if not args.submit:
        raise SafeError("submit_flag_required_no_external_call_made")
    plan, payload, tokenizer = verify_plan(args)
    product_protocol = plan.get("promptProtocol") == PRODUCT_PROMPT_PROTOCOL
    if product_protocol and PRODUCT_ATTEMPT_PATH.exists():
        raise SafeError("single_product_sample_attempt_already_reserved")
    args.operation_timeout = plan["limits"]["operationTimeoutSeconds"]
    recorder = DemoRecorder(args.output, plan)
    write_json(recorder.output / "plan.json", plan)
    deadline = ProcessDeadline(recorder)
    deadline.start()
    client = None
    try:
        _, client = make_client(args)
        with quiet_vendor(), client.session(project="care-circle-fixed-demo", timeout=args.operation_timeout,
                                             before_poll=recorder.before_poll,
                                             on_session_creation_attempted=lambda: recorder.event("create_session_attempt"),
                                             on_session_closed=lambda: recorder.event("session_cleanup_completed")) as session:
            recorder.event("session_created", sessionId=session.session_id)
            recorder.update("sampling", sessionId=session.session_id)
            if product_protocol:
                PRODUCT_ATTEMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
                # Reserve before the RPC. Uncertain outcomes consume the one attempt too.
                try:
                    with PRODUCT_ATTEMPT_PATH.open("x") as stream:
                        stream.write(canonical({"state": "reserved", "at": now(), "planSha256": args.plan_sha256,
                                                "promptProtocol": PRODUCT_PROMPT_PROTOCOL, "sessionId": session.session_id}) + "\n")
                except FileExistsError:
                    raise SafeError("single_product_sample_attempt_already_reserved") from None
            recorder.event("checkpoint_sample_attempt", checkpoint=CHECKPOINT, model=MODEL,
                           inputSha256=payload["inputSha256"], promptSha256=payload["promptSha256"],
                           promptProtocol=plan.get("promptProtocol", BENCHMARK_PROMPT_PROTOCOL),
                           promptTemplateSha256=payload["promptTemplateSha256"])
            results = session.sample(base_model=MODEL, checkpoint=CHECKPOINT,
                                     prompt_token_ids=[payload["promptTokenIds"]], tokenizer=tokenizer,
                                     seeds=[payload["seed"]], timeout=args.operation_timeout, **payload["generation"])
            if len(results) != 1 or len(results[0]) != 1:
                raise SafeError("unexpected_demo_sample_count")
            sample = results[0][0]
            prediction = {key: value for key, value in payload.items() if key != "promptTokenIds"}
            prediction.update(schema=SCHEMA, method="river", mode="cached-replay", syntheticOnly=True,
                              validationStatus="unvalidated-raw", output=sample.text,
                              requestId=getattr(sample, "request_id", ""), sessionId=session.session_id,
                              stopReason=getattr(sample, "stop_reason", None), sampledAt=now(),
                              planSha256=args.plan_sha256, pairedProofSha256=plan["pairedProofSha256"],
                              originalManifestSha256=plan["originalManifestSha256"])
            write_json(recorder.output / "prediction.json", prediction)
            recorder.event("checkpoint_sample_completed", requestId=prediction["requestId"],
                           predictionSha256=sha((recorder.output / "prediction.json").read_bytes()))
        recorder.update("completed", completedAt=now(), prediction=str(recorder.output / "prediction.json"))
        print(canonical(recorder.status))
    except BaseException as error:
        recorder.event("demo_failed", error=safe_exception(error))
        recorder.update("failed", errors=[safe_exception(error)], failedAt=now())
        raise
    finally:
        try:
            if client is not None:
                with quiet_vendor():
                    client.close()
        finally:
            deadline.stop()


def cli():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    plan_parser = commands.add_parser("prepare")
    plan_parser.add_argument("--paired-run", required=True)
    plan_parser.add_argument("--output", default=str(HERE / "demo-prepared"))
    plan_parser.add_argument("--product-protocol", action="store_true",
                             help="Separate product-relative-date-v1 prompt; one additional fixed-note sample maximum")
    plan_parser.set_defaults(handler=prepare)
    run_parser = commands.add_parser("run")
    run_parser.add_argument("--plan-directory", default=str(HERE / "demo-prepared"))
    run_parser.add_argument("--plan-sha256", required=True)
    run_parser.add_argument("--paired-run", required=True)
    run_parser.add_argument("--output", required=True)
    run_parser.add_argument("--submit", action="store_true")
    run_parser.add_argument("--load-authorized-key", action="store_true")
    run_parser.set_defaults(handler=execute)
    args = parser.parse_args()
    args.handler(args)


if __name__ == "__main__":
    try:
        cli()
    except BaseException as error:
        if isinstance(error, SystemExit):
            raise
        print(canonical({"status": "failed", "error": safe_exception(error)}), file=sys.stderr)
        sys.exit(130 if isinstance(error, KeyboardInterrupt) else 1)
