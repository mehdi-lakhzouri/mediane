#!/usr/bin/env python3
"""Makes ZAP's SARIF acceptable to GitHub Code scanning.

ZAP locates an alert by URL (http://api:4000/...), but Code scanning only
accepts locations inside the repository and rejects the whole file otherwise.
Each URL is mapped to the file that configures that surface (the API's HTTP
security setup, or the web app's headers), the URL moves into the message,
and a fingerprint per rule and URL keeps the alerts distinct.

    python3 .github/dast/sarif_for_code_scanning.py <zap.sarif.json> <out.sarif.json>
"""
from __future__ import annotations

import hashlib
import json
import sys

SURFACES = {
    "http://api:4000": "backend/src/bootstrap/configure-app.ts",
    "http://web:3000": "frontend/apps/web/next.config.js",
}
FALLBACK = ".github/dast/compose.dast.yaml"


def file_for(url: str) -> str:
    return next((f for prefix, f in SURFACES.items() if url.startswith(prefix)), FALLBACK)


def main(source: str, target: str) -> None:
    with open(source, encoding="utf-8") as fh:
        sarif = json.load(fh)

    converted = 0
    for run in sarif.get("runs", []):
        for result in run.get("results", []):
            urls = []
            for location in result.get("locations", []):
                physical = location.get("physicalLocation", {})
                uri = physical.get("artifactLocation", {}).get("uri", "")
                if not uri.startswith(("http://", "https://")):
                    continue
                urls.append(uri)
                snippet = physical.get("region", {}).get("snippet")
                region = {"startLine": 1}
                if snippet:
                    region["snippet"] = snippet
                location["physicalLocation"] = {
                    "artifactLocation": {"uri": file_for(uri)},
                    "region": region,
                }
            if not urls:
                continue
            converted += 1
            message = result.setdefault("message", {})
            text = message.get("text", "").rstrip()
            message["text"] = f"{text}\n\nURL: {', '.join(urls)}".strip()
            # One rule can fire twice on a URL (e.g. script-src and style-src).
            method = result.get("webRequest", {}).get("method", "")
            key = f"{result.get('ruleId', '')}|{method}|{'|'.join(sorted(urls))}|{text}"
            result.setdefault("partialFingerprints", {})["primaryLocationLineHash"] = (
                hashlib.sha256(key.encode()).hexdigest()
            )

    with open(target, "w", encoding="utf-8") as fh:
        json.dump(sarif, fh)
    print(f"{converted} ZAP result(s) relocated for Code scanning -> {target}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
