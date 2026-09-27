"""Offline transport behavior checks. No SDK, socket connection or running service needed."""

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent / "src"))
from ufo_ext_care_circle import transport

FIXTURE = {
    "clinic": {"name": "Offline test fixture", "hours": "Fixture hours", "phone": "555-0100"},
    "sourceUrl": "http://127.0.0.1:4706/", "mode": "local-http-fetch",
    "evidence": {"synthetic": True, "officialUfoExecution": False},
}


class Response:
    def __init__(self, status=200, body=None, headers=None):
        self.status = status
        self.closed = False
        self.body = json.dumps(FIXTURE).encode() if body is None else body
        self.headers = {"Content-Type": "application/json"} if headers is None else headers

    def getheader(self, name, default=None):
        return self.headers.get(name, default)

    def read(self, size):
        return self.body[:size]

    def close(self):
        self.closed = True


class TransportSmoke(unittest.TestCase):
    def request(self, response):
        events = []

        class Connection:
            sock = None

            def __init__(self, *args, **kwargs):
                events.append((args, kwargs))

            def request(self, *args, **kwargs):
                events.append((args, kwargs))

            def connect(self):
                pass

            def getresponse(self):
                return response

            def close(self):
                events.append("closed")

        with patch.object(transport, "HTTPConnection", Connection):
            result = transport.fetch_clinic()
        return result, events

    def test_fixed_target_and_no_proxy(self):
        result, events = self.request(Response())
        self.assertEqual(result, FIXTURE)
        self.assertEqual(events[0], (("127.0.0.1", 4705), {"timeout": 5}))
        self.assertEqual(events[1][0], ("POST", "/v1/clinic/fetch"))
        self.assertEqual(events[1][1]["body"], b"{}")
        self.assertEqual(events[-1], "closed")

    def test_bad_responses(self):
        cases = [
            (Response(status=302), "REDIRECT_REJECTED"),
            (Response(status=500), "UPSTREAM_ERROR"),
            (Response(headers={"Content-Type": "text/html"}), "INVALID_CONTENT"),
            (Response(body=b"{"), "INVALID_CONTENT"),
            (Response(body=b"x" * 65_537), "RESPONSE_TOO_LARGE"),
            (Response(headers={"Content-Type": "application/json", "Content-Length": "65537"}), "RESPONSE_TOO_LARGE"),
            (Response(body=b"{}"), "UNTRUSTED_RESPONSE"),
        ]
        for response, code in cases:
            with self.subTest(code=code):
                with self.assertRaises(transport.ClinicTransportError) as raised:
                    self.request(response)
                self.assertEqual(raised.exception.code, code)
                self.assertTrue(response.closed)

    def test_total_deadline_retains_detached_socket(self):
        callbacks = []
        shutdowns = []

        class Socket:
            def shutdown(self, direction):
                shutdowns.append(direction)

        held_socket = Socket()

        class DetachedResponse(Response):
            def read(self, size):
                callbacks[0]()
                return super().read(size)

        class Connection:
            sock = None

            def __init__(self, *args, **kwargs):
                pass

            def connect(self):
                self.sock = held_socket

            def request(self, *args, **kwargs):
                pass

            def getresponse(self):
                self.sock = None
                return DetachedResponse()

            def close(self):
                pass

        class Deadline:
            def __init__(self, seconds, callback):
                self.seconds = seconds
                callbacks.append(callback)

            def start(self):
                pass

            def cancel(self):
                pass

        with patch.object(transport, "HTTPConnection", Connection), patch.object(transport, "Timer", Deadline):
            with self.assertRaises(transport.ClinicTransportError) as raised:
                transport.fetch_clinic()
        self.assertEqual(raised.exception.code, "TIMEOUT")
        self.assertEqual(shutdowns, [transport.socket.SHUT_RDWR])


if __name__ == "__main__":
    unittest.main()
