"""Standard-library client matching NestJS device-signature.ts exactly."""
import base64
import hashlib
import hmac
import json
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request


class DeliveryError(Exception):
    def __init__(self, status=0, retry_after=None):
        super().__init__(f"Gateway delivery failed (HTTP {status or 'unreachable'})")
        self.status = status
        self.retry_after = retry_after

    @property
    def permanent(self):
        return 400 <= self.status < 500 and self.status not in (408, 429)


def encode_body(payload):
    return json.dumps(payload, allow_nan=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def signed_headers(secret, serial, method, path, body, timestamp=None, nonce=None):
    timestamp = str(int(time.time())) if timestamp is None else str(timestamp)
    nonce = nonce or secrets.token_urlsafe(24)
    canonical = "\n".join((method.upper(), path, timestamp, nonce, hashlib.sha256(body).hexdigest()))
    return {
        "Content-Type": "application/json",
        "x-device-serial": serial,
        "x-device-timestamp": timestamp,
        "x-device-nonce": nonce,
        "x-device-signature": hmac.new(secret, canonical.encode(), hashlib.sha256).hexdigest(),
    }


class DeviceClient:
    def __init__(self, api_url, serial, encoded_secret, *, allow_insecure=False, timeout=10):
        parsed = urllib.parse.urlsplit(api_url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("API URL must be an HTTP(S) base URL without credentials, query, or fragment")
        if parsed.scheme != "https" and parsed.hostname not in ("127.0.0.1", "localhost", "::1") and not allow_insecure:
            raise ValueError("HTTPS is required; use --allow-insecure only with an isolated development API")
        self.base = api_url.rstrip("/")
        self.path_prefix = parsed.path.rstrip("/")
        self.serial, self.timeout = serial, timeout
        try:
            self.secret = base64.b64decode(encoded_secret + "=" * (-len(encoded_secret) % 4), altchars=b"-_", validate=True)
        except (ValueError, TypeError) as exc:
            raise ValueError("Device secret must be base64url") from exc
        if len(self.secret) != 32:
            raise ValueError("Device secret must decode to 32 bytes")

    def request(self, method, route, payload=None):
        body = b"" if payload is None else encode_body(payload)
        path = self.path_prefix + route
        headers = signed_headers(self.secret, self.serial, method, path, body)
        req = urllib.request.Request(self.base + route, data=body if method != "GET" else None, headers=headers, method=method)
        try:
            # Refuse redirects so credentials cannot be forwarded to another host/path.
            opener = urllib.request.build_opener(_NoRedirect())
            with opener.open(req, timeout=self.timeout) as response:
                envelope = json.load(response)
                if envelope.get("error") or envelope.get("data") is None:
                    raise DeliveryError(502)
                return envelope["data"]
        except urllib.error.HTTPError as exc:
            raw = exc.headers.get("Retry-After", "")
            raise DeliveryError(exc.code, min(float(raw), 300) if raw.isdigit() else None) from exc
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            raise DeliveryError() from exc


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
