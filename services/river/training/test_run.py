"""Offline protocol tests. No credentials or external API endpoints are used."""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("river_run", Path(__file__).with_name("run.py"))
run = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(run)


class FakeTokenizer:
    eos_token_id = 0

    def encode(self, text, add_special_tokens=False):
        assert add_special_tokens is False
        return [ord(char) + 1 for char in text]

    def save_pretrained(self, path):
        path.mkdir()
        (path / "tokenizer.json").write_text("{}");


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        temporary_root = Path(__file__).resolve().parent / ".tmp"
        temporary_root.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=temporary_root)
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_token_mask_predicts_completion_and_single_eos(self):
        tokenizer = FakeTokenizer()
        datum, prompt = run.make_datum(tokenizer, "PROMPT", {"value": 3})
        gold = tokenizer.encode(run.canonical({"value": 3})) + [0]
        trained_targets = [token for token, weight in zip(datum["target_tokens"], datum["weights"]) if weight]
        self.assertEqual(trained_targets, gold)
        self.assertEqual(len(datum["input_ids"]), len(datum["weights"]))
        self.assertEqual(datum["weights"][-1], 0.0)
        self.assertEqual(prompt, tokenizer.encode("PROMPT"))

    def test_key_loader_only_reads_named_assignment(self):
        path = self.root / "synthetic.env"
        path.write_text("UNRELATED=fixture-not-a-secret\nexport RIVER_API_KEY='fixture-key'\nAFTER=ignored\n")
        with patch.dict(os.environ, {}, clear=True):
            self.assertTrue(run.load_authorized_key(path))
            self.assertEqual(dict(os.environ), {"RIVER_API_KEY": "fixture-key"})

    def test_key_loader_does_not_expand_shell_syntax(self):
        path = self.root / "synthetic.env"
        path.write_text("RIVER_API_KEY=$(do-not-execute)\n")
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(run.SafeError):
            run.load_authorized_key(path)

    def test_absent_key_does_not_try_fallback_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(run.load_authorized_key(self.root / "absent"))
            with self.assertRaisesRegex(run.SafeError, "missing_RIVER_API_KEY"):
                run.make_client(argparse.Namespace(load_authorized_key=False, operation_timeout=1))

    def test_exception_does_not_include_error_body(self):
        result = run.safe_exception(ValueError("RAW_BODY_MUST_NOT_ESCAPE"))
        self.assertEqual(result, {"code": "ValueError"})

    def dataset(self):
        directory = self.root / "dataset"
        directory.mkdir()
        for split in ("train", "dev", "test"):
            rows = [{"id": f"{split}-{i}", "input": {"note": f"synthetic {split} {i}", "date": "2026-09-27", "authorId": "people/ana-alvarez"},
                     "gold": {"extraction": {"marker": "GOLD_ONLY_" + split}, "warnings": []}} for i in range(3)]
            run.write_jsonl(directory / f"{split}.jsonl", rows)
        (directory / "prompt.txt").write_text("Return JSON.\n")
        return directory

    def prepare(self):
        directory = self.dataset()
        output = self.root / "prepared"
        args = argparse.Namespace(dataset=directory, output=output, model="Fixture/Small", max_sequence_tokens=8192,
                                  epochs=1, seed=7, batch_size=2, eval_batch_size=2, rank=8, learning_rate=2e-4,
                                  max_tokens=1024, operation_timeout=3, max_run_seconds=60, max_polls=100)
        fake_transformers = types.SimpleNamespace(AutoTokenizer=types.SimpleNamespace(from_pretrained=lambda *a, **k: FakeTokenizer()))
        with patch.dict("sys.modules", {"transformers": fake_transformers}), patch.object(run.importlib.metadata, "version", return_value="fixture"):
            run.prepare(args)
        return output, fake_transformers

    def test_prepare_excludes_test_gold_and_records_call_counts(self):
        output, _ = self.prepare()
        text = (output / "test-prompts.jsonl").read_text()
        self.assertNotIn("GOLD_ONLY", text)
        self.assertNotIn('"gold"', text)
        digest = (output / "payload-manifest.sha256").read_text().strip()
        manifest = run.verify_prepared(output, digest)
        self.assertEqual(manifest["expectedApiCalls"]["forward_backward_submissions"], 2)
        self.assertEqual(manifest["expectedApiCalls"]["base_sample_submissions"], 2)
        self.assertFalse(manifest["evaluation"]["goldSubmitted"])

    def test_manifest_and_payload_tamper_fail_before_submission(self):
        output, _ = self.prepare()
        digest = (output / "payload-manifest.sha256").read_text().strip()
        with self.assertRaisesRegex(run.SafeError, "manifest_sha256_mismatch"):
            run.verify_prepared(output, "0" * 64)
        (output / "train-tokens.jsonl").write_text("tampered")
        with self.assertRaisesRegex(run.SafeError, "prepared_file_sha256_mismatch"):
            run.verify_prepared(output, digest)

    def test_split_leakage_rejected(self):
        directory = self.dataset()
        train = run.read_jsonl(directory / "train.jsonl")
        test = run.read_jsonl(directory / "test.jsonl")
        test[0]["input"] = train[0]["input"]
        run.write_jsonl(directory / "test.jsonl", test)
        with self.assertRaisesRegex(run.SafeError, "duplicate_note_or_input"):
            run.load_dataset(directory)

    def test_complete_fake_sdk_run_proves_paired_identity(self):
        output, fake_transformers = self.prepare()
        calls = []
        class Pending:
            request_id = "fixture-operation"
            def result(self, before_poll):
                before_poll()
                return types.SimpleNamespace(metrics={"loss": 0.5})
        class Model:
            model_id = "fixture-model"
            def submit_forward_backward(self, data, **kwargs):
                calls.append(("fb", copy.deepcopy(data)))
                return Pending()
            def submit_optim_step(self, **kwargs):
                calls.append(("optim", kwargs))
                return Pending()
            def save_weights(self, *args, **kwargs):
                return types.SimpleNamespace(path="river://fixture/checkpoint", step=2)
        class Session:
            session_id = "fixture-session"
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def create_model(self, **kwargs): return Model()
            def sample(self, **kwargs):
                calls.append(("sample", copy.deepcopy({k: v for k, v in kwargs.items() if k != "tokenizer"})))
                return [[types.SimpleNamespace(text='{"extraction":{},"warnings":[]}', request_id="fixture-sample", stop_reason="stop")] for _ in kwargs["prompt_token_ids"]]
        class Client:
            def get_capabilities(self): return ["Fixture/Small"]
            def session(self, **kwargs): return Session()
            def close(self): pass
        fake_river = types.SimpleNamespace(LoraConfig=lambda **kwargs: kwargs)
        args = argparse.Namespace(submit=True, prepared=output, output=self.root / "run",
                                  manifest_sha256=(output / "payload-manifest.sha256").read_text().strip(), load_authorized_key=False)
        with patch.dict("sys.modules", {"transformers": fake_transformers}), patch.object(run, "make_client", return_value=(fake_river, Client())), patch.object(run, "STATUS_FILE", self.root / "status.json"):
            run.execute(args)
        samples = [call[1] for call in calls if call[0] == "sample"]
        self.assertEqual(len(samples), 4)
        for base, trained in zip(samples[:2], samples[2:]):
            trained = {key: value for key, value in trained.items() if key != "checkpoint"}
            self.assertEqual(base, trained)
        proof = json.loads((self.root / "run/paired-proof.json").read_text())
        self.assertTrue(proof["verified"])
        self.assertEqual(proof["count"], 3)
        self.assertEqual(json.loads((self.root / "status.json").read_text())["status"], "completed")


if __name__ == "__main__":
    unittest.main()
