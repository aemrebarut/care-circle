"""Offline fixed-demo guards and one-request artifact checks."""
import argparse
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

import demo


class Tokenizer:
    def encode(self, text, add_special_tokens=False):
        return [ord(char) for char in text]


class DemoTests(unittest.TestCase):
    def setUp(self):
        temporary_root = Path(__file__).resolve().parent / ".tmp"
        temporary_root.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=temporary_root)
        self.root = Path(self.temp.name)
        self.paired = self.root / "paired"
        self.paired.mkdir()
        self.generation = {"num_samples": 1, "max_tokens": 1024, "temperature": 0.0,
                           "top_p": 1.0, "top_k": -1, "stop": None}
        protocol = {"baseModel": demo.MODEL, "trainedCheckpoint": demo.CHECKPOINT,
                    "generation": self.generation, "generationSha256": demo.sha(demo.canonical(self.generation)),
                    "promptSha256": "fixture-template-hash", "manifestSha256": "fixture-manifest-hash",
                    "training": {"seed": 20260927}, "evaluation": {"count": 1}}
        proof = {"verified": True, "count": 1, "checkpoint": demo.CHECKPOINT}
        for arm in ("base", "trained"):
            path = self.paired / f"{arm}.jsonl"
            path.write_text('{"id":"fixture","output":"synthetic"}\n')
            proof[f"{arm}PredictionsSha256"] = demo.sha(path.read_bytes())
        demo.write_json(self.paired / "paired-proof.json", proof)
        demo.write_json(self.paired / "protocol.json", protocol)
        demo.write_json(self.paired / "run-status.json", {"status": "completed"})
        self.plan_directory = self.root / "plan"
        self.prompt = demo.render_prompt("fixture prompt", demo.DEMO_INPUT)
        self.tokenizer_patch = patch.object(demo, "local_tokenizer", return_value=Tokenizer())
        self.prompt_patch = patch.object(demo, "fixed_prompt", return_value=self.prompt)
        self.tokenizer_patch.start()
        self.prompt_patch.start()
        with demo.quiet_vendor():
            demo.prepare(argparse.Namespace(paired_run=self.paired, output=self.plan_directory))
        self.args = argparse.Namespace(plan_directory=self.plan_directory,
                                       plan_sha256=(self.plan_directory / "plan.sha256").read_text().strip(),
                                       paired_run=self.paired, output=self.root / "sample", submit=True,
                                       load_authorized_key=False)

    def tearDown(self):
        self.prompt_patch.stop()
        self.tokenizer_patch.stop()
        self.temp.cleanup()

    def test_fixed_note_matches_shared_contract(self):
        contract = (demo.RIVER_ROOT.parent.parent / "contract/index.mjs").read_text()
        self.assertIn("export const DEMO_NOTE = '" + demo.DEMO_NOTE + "';", contract)

    def test_unfinished_paired_run_refused(self):
        demo.write_json(self.paired / "run-status.json", {"status": "evaluating_trained"})
        with self.assertRaisesRegex(demo.SafeError, "paired_evaluation_must_be_completed"):
            demo.verify_plan(self.args)

    def test_arbitrary_note_refused_even_with_new_hashes(self):
        payload_path = self.plan_directory / "payload.json"
        payload = json.loads(payload_path.read_text())
        payload["input"]["note"] = "arbitrary note must never be sent"
        demo.write_json(payload_path, payload)
        plan_path = self.plan_directory / "plan.json"
        plan = json.loads(plan_path.read_text())
        plan["payloadSha256"] = demo.sha(payload_path.read_bytes())
        demo.write_json(plan_path, plan)
        self.args.plan_sha256 = demo.sha(plan_path.read_bytes())
        with self.assertRaisesRegex(demo.SafeError, "only_fixed_demo_input"):
            demo.verify_plan(self.args)

    def test_single_checkpoint_request_preserves_raw_output(self):
        calls = []
        raw = "RAW MODEL TEXT: intentionally not parsed"
        class Session:
            session_id = "fixture-session"
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def sample(self, **kwargs):
                calls.append(kwargs)
                return [[types.SimpleNamespace(text=raw, request_id="fixture-request", stop_reason="stop")]]
        class Client:
            def session(self, **kwargs): return Session()
            def close(self): pass
        with patch.object(demo, "make_client", return_value=(None, Client())), demo.quiet_vendor():
            demo.execute(self.args)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["checkpoint"], demo.CHECKPOINT)
        self.assertEqual(calls[0]["prompt_token_ids"], [Tokenizer().encode(self.prompt)])
        artifact = json.loads((self.args.output / "prediction.json").read_text())
        self.assertEqual(artifact["mode"], "cached-replay")
        self.assertEqual(artifact["input"], demo.DEMO_INPUT)
        self.assertEqual(artifact["output"], raw)
        self.assertEqual(artifact["requestId"], "fixture-request")
        self.assertEqual(artifact["validationStatus"], "unvalidated-raw")
        self.assertNotIn("promptTokenIds", artifact)
        self.assertEqual(artifact["generationSha256"], demo.sha(demo.canonical(self.generation)))

    def product_plan(self):
        directory = self.root / "product-plan"
        with demo.quiet_vendor():
            demo.prepare(argparse.Namespace(paired_run=self.paired, output=directory, product_protocol=True))
        self.args.plan_directory = directory
        self.args.plan_sha256 = (directory / "plan.sha256").read_text().strip()
        return directory

    def test_product_plan_is_separate_and_preserves_frozen_evidence(self):
        frozen = [*self.paired.glob("*"), *self.plan_directory.glob("*"), demo.RIVER_ROOT / "dataset/prompt.txt"]
        before = {path: demo.sha(path.read_bytes()) for path in frozen if path.is_file()}
        directory = self.product_plan()
        plan, payload, _ = demo.verify_plan(self.args)
        self.assertEqual(plan["promptProtocol"], "product-relative-date-v1")
        self.assertEqual(plan["singleProductAttemptLimit"], 1)
        self.assertEqual(plan["trainingCalls"], 0)
        self.assertEqual(plan["heldOutEvaluationCalls"], 0)
        self.assertNotEqual(plan["promptTemplateSha256"], plan["benchmarkPromptTemplateSha256"])
        self.assertEqual(payload["input"], demo.DEMO_INPUT)
        self.assertEqual(payload["generation"], self.generation)
        self.assertIn("Preserve relative weekday wording", payload["prompt"])
        self.assertIn("omit dueDate entirely", payload["prompt"])
        self.assertEqual(before, {path: demo.sha(path.read_bytes()) for path in before})
        self.assertEqual(directory / "plan.json", Path(self.args.plan_directory) / "plan.json")

    def test_product_protocol_still_rejects_arbitrary_note(self):
        directory = self.product_plan()
        payload_path = directory / "payload.json"
        payload = json.loads(payload_path.read_text())
        payload["input"]["note"] = "unapproved different input"
        demo.write_json(payload_path, payload)
        plan_path = directory / "plan.json"
        plan = json.loads(plan_path.read_text())
        plan["payloadSha256"] = demo.sha(payload_path.read_bytes())
        demo.write_json(plan_path, plan)
        self.args.plan_sha256 = demo.sha(plan_path.read_bytes())
        with self.assertRaisesRegex(demo.SafeError, "only_fixed_demo_input"):
            demo.verify_plan(self.args)

    def test_product_attempt_latch_refuses_repeated_sampling(self):
        self.product_plan()
        latch = self.root / "product-attempt.json"
        latch.write_text('{"state":"reserved"}\n')
        with patch.object(demo, "PRODUCT_ATTEMPT_PATH", latch), patch.object(demo, "make_client") as client:
            with self.assertRaisesRegex(demo.SafeError, "single_product_sample_attempt_already_reserved"):
                demo.execute(self.args)
            client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
