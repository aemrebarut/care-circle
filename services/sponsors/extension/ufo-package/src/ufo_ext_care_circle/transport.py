"""Fixed loopback transport. No proxy handling, credentials, redirects or URL input."""

import json
import socket
from http.client import HTTPConnection, HTTPException
from threading import Timer

HOST = "127.0.0.1"
PORT = 4705
PATH = "/v1/clinic/fetch"
SOURCE_URL = "http://127.0.0.1:4706/"
TIMEOUT_SECONDS = 5
MAX_BYTES = 65_536


class ClinicTransportError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def fetch_clinic() -> dict:
    connection = HTTPConnection(HOST, PORT, timeout=TIMEOUT_SECONDS)
    timed_out = False
    active_socket = None
    response = None

    def abort():
        nonlocal timed_out
        timed_out = True
        for target in (active_socket, connection.sock):
            if target is None:
                continue
            try:
                target.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        connection.close()

    deadline = Timer(TIMEOUT_SECONDS, abort)
    deadline.daemon = True
    deadline.start()
    try:
        connection.connect()
        active_socket = connection.sock
        connection.request("POST", PATH, body=b"{}", headers={
            "Content-Type": "application/json", "Accept": "application/json",
            "Content-Length": "2", "Connection": "close",
        })
        response = connection.getresponse()
        if 300 <= response.status < 400:
            raise ClinicTransportError("REDIRECT_REJECTED", "Loopback redirects are not permitted.")
        if response.status != 200:
            raise ClinicTransportError("UPSTREAM_ERROR", "The local sponsor service did not return HTTP 200.")
        if response.getheader("Content-Type", "").split(";", 1)[0].strip() != "application/json":
            raise ClinicTransportError("INVALID_CONTENT", "Expected local sponsor JSON.")
        advertised = response.getheader("Content-Length")
        if advertised is not None:
            try:
                if int(advertised) > MAX_BYTES:
                    raise ClinicTransportError("RESPONSE_TOO_LARGE", "Local response exceeded 64 KiB.")
            except ValueError as error:
                raise ClinicTransportError("INVALID_CONTENT", "Invalid response size header.") from error
        payload = response.read(MAX_BYTES + 1)
        if timed_out:
            raise ClinicTransportError("TIMEOUT", "Local clinic lookup exceeded 5 seconds.")
        if len(payload) > MAX_BYTES:
            raise ClinicTransportError("RESPONSE_TOO_LARGE", "Local response exceeded 64 KiB.")
        try:
            result = json.loads(payload)
        except (ValueError, UnicodeDecodeError) as error:
            raise ClinicTransportError("INVALID_CONTENT", "Local response was not valid JSON.") from error
        if (not isinstance(result, dict) or result.get("mode") != "local-http-fetch"
                or result.get("sourceUrl") != SOURCE_URL
                or not isinstance(result.get("evidence"), dict)
                or result["evidence"].get("synthetic") is not True
                or result["evidence"].get("officialUfoExecution") is not False
                or not isinstance(result.get("clinic"), dict)
                or any(not isinstance(result["clinic"].get(key), str) for key in ("name", "hours", "phone"))):
            raise ClinicTransportError("UNTRUSTED_RESPONSE", "Local response did not identify the expected synthetic source.")
        return result
    except (OSError, HTTPException) as error:
        code = "TIMEOUT" if timed_out or isinstance(error, TimeoutError) else "UNAVAILABLE"
        raise ClinicTransportError(code, "The local synthetic clinic lookup could not complete.") from error
    finally:
        deadline.cancel()
        if response is not None:
            response.close()
        connection.close()
