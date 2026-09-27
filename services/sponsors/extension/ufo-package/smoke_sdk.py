"""Verify the real pinned SDK with denied network and no inherited credential environment."""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SDK_COMMIT = "63ba388ed449ff46c9d70744119dffc85df0fbf8"


def worker(live=False):
    allowed_roots = (ROOT, Path(sys.base_prefix).resolve())
    allowed_system_files = {Path("/System/Library/CoreServices/SystemVersion.plist")}
    blocked = []
    allowed_network = []

    def audit(event, args):
        if event in {"socket.connect", "socket.getaddrinfo"}:
            target = args[1] if event == "socket.connect" else (args[0], args[1])
            if live and isinstance(target, tuple) and target[:2] == ("127.0.0.1", 4705):
                allowed_network.append({"event": event, "host": "127.0.0.1", "port": 4705})
                return
            blocked.append({"event": event, "target": str(target)})
            raise PermissionError("SDK proof prohibits this network operation")
        if event in {"socket.bind", "subprocess.Popen", "os.system"}:
            frame = sys._getframe().f_back
            blocked.append({"event": event, "target": str(args[1]) if event == "socket.bind" else None,
                            "caller": frame.f_code.co_name, "callerFile": frame.f_code.co_filename})
            raise PermissionError("SDK proof prohibits server binds and subprocesses")
        if event == "open" and isinstance(args[0], (str, bytes, os.PathLike)):
            path = Path(os.fsdecode(args[0])).resolve()
            if path not in allowed_system_files and not any(path == base or base in path.parents for base in allowed_roots):
                blocked.append({"event": "file-access", "path": str(path)})
                raise PermissionError("SDK proof prohibits reading files outside its package and Python runtime")
            if path.name in {".env", ".netrc", "credentials", "auth.json", "token"}:
                blocked.append({"event": "credential-file"})
                raise PermissionError("SDK proof prohibits credential files")

    sys.addaudithook(audit)
    import asyncio
    from datetime import UTC, datetime
    from importlib import metadata
    from unittest.mock import patch

    from pydantic import ValidationError
    from ufo.sdk.manifest import Manifest
    from ufo.sdk.tools import ToolDef, ToolResult
    from ufo_ext_care_circle.manifest import ClinicLookupInput
    from ufo_ext_care_circle.transport import ClinicTransportError

    distribution = metadata.distribution("ufo")
    source = json.loads(distribution.read_text("direct_url.json"))
    assert SDK_COMMIT in source["url"], "SDK source does not match pinned official commit"
    matches = [entry for entry in metadata.entry_points(group="ufo.extension") if entry.name == "care_circle_clinic"]
    assert len(matches) == 1
    declared = matches[0].load()()
    assert isinstance(declared, Manifest)
    assert declared.name == "care-circle-clinic" and len(declared.tools) == 1
    assert not declared.credentials and not declared.deploy_keys and not declared.sandbox_internet
    tool = declared.tools[0]
    assert isinstance(tool, ToolDef)
    schema = tool.schema()
    assert schema.name == "care_circle_clinic_lookup"
    assert schema.input_schema["additionalProperties"] is False
    assert schema.input_schema["properties"] == {}
    assert tool.untrusted and not tool.side_effecting and not tool.binds_member_authority
    try:
        ClinicLookupInput.model_validate({"url": "https://example.test"})
    except ValidationError:
        pass
    else:
        raise AssertionError("Tool accepted a caller-provided URL")

    fake = {"clinic": {"name": "Offline fixture", "hours": "Fixture hours", "phone": "555-0100"},
            "sourceUrl": "http://127.0.0.1:4706/", "mode": "local-http-fetch",
            "evidence": {"synthetic": True, "officialUfoExecution": False}}
    if live:
        result = asyncio.run(tool.handler(None, ClinicLookupInput()))
    else:
        with patch("ufo_ext_care_circle.manifest.fetch_clinic", return_value=fake):
            result = asyncio.run(tool.handler(None, ClinicLookupInput()))
    assert isinstance(result, ToolResult) and not result.is_error and result.untrusted
    payload = json.loads(result.content[0].text)
    assert payload["sourceUrl"] == "http://127.0.0.1:4706/"
    assert payload["mode"] == "local-http-fetch" and payload["evidence"]["officialUfoExecution"] is False
    with patch("ufo_ext_care_circle.manifest.fetch_clinic", side_effect=ClinicTransportError("OFFLINE_FAILURE", "Synthetic failure")):
        failure = asyncio.run(tool.handler(None, ClinicLookupInput()))
    assert failure.is_error and json.loads(failure.content[0].text)["error"]["code"] == "OFFLINE_FAILURE"
    expected_probe = str(ROOT / ".venv/lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages/urllib3/util/connection.py")
    unexpected = [item for item in blocked if not (item.get("event") == "socket.bind"
                  and item.get("target") == "('::1', 0)" and item.get("caller") == "_has_ipv6"
                  and item.get("callerFile") == expected_probe)]
    if unexpected:
        raise AssertionError(f"SDK attempted unexpected prohibited operations: {unexpected}")
    proof = {
        "mode": "official-sdk-local-tool-proof",
        "observedAt": datetime.now(UTC).isoformat(),
        "sdk": {"distribution": "ufo", "version": distribution.version, "commit": SDK_COMMIT, "sourceUrl": source["url"]},
        "officialSdkRegistration": True,
        "registrationMethod": "Installed Python entry-point discovery, official Manifest/ToolDef construction and official tool schema generation",
        "officialSdkToolInvocation": True,
        "invocationMethod": "Direct SDK ToolDef handler call; no runtime dispatcher or model",
        "transportMode": "real-loopback-http" if live else "offline-fake-transport",
        "context": "None; handler does not inspect runtime context or credentials",
        "officialUfoExecution": False,
        "hostedExecution": False,
        "fullRuntimeExecution": False,
        "modelCalls": 0,
        "accountsCreated": 0,
        "telemetrySubmitted": False,
        "networkPolicy": "Only literal 127.0.0.1:4705 allowed" if live else "All socket connections and DNS resolution denied",
        "inheritedEnvironment": False,
        "deniedOperationAttempts": len(blocked),
        "blockedCapabilityProbes": [{"library": "urllib3", "probe": "IPv6 availability", "target": "[::1]:0", "bindPrevented": True} for _ in blocked],
        "allowedNetworkOperations": allowed_network,
        "unexpectedProhibitedOperations": 0,
        "checks": ["entry-point", "pinned-sdk", "manifest", "tool-schema", "empty-input", "typed-result", "typed-failure"],
    }
    if live:
        proof["result"] = payload
    print(json.dumps(proof))


if __name__ == "__main__":
    live = "--live" in sys.argv
    if "--worker" in sys.argv:
        worker(live=live)
    else:
        python = ROOT / ".venv" / "bin" / "python"
        args = [str(python), "-I", str(Path(__file__).resolve()), "--worker"]
        if live:
            args.append("--live")
        result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=30,
                                env={"PATH": os.defpath, "PYTHONNOUSERSITE": "1", "PYTHONDONTWRITEBYTECODE": "1", "OTEL_SDK_DISABLED": "true"})
        if result.returncode:
            print(result.stderr, file=sys.stderr)
            raise SystemExit(result.returncode)
        receipt = json.loads(result.stdout)
        evidence = ROOT / "evidence"
        evidence.mkdir(exist_ok=True)
        path = evidence / ("sdk-live.json" if live else "sdk-offline.json")
        path.write_text(json.dumps(receipt, indent=2) + "\n")
        print(f"PASS real UFO SDK entry point and handler: {receipt['transportMode']}; receipt {path.relative_to(ROOT)}")
