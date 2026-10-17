#!/usr/bin/env python3
"""Drives a ZAP daemon over its REST API: OpenAPI import, spider, passive and
active scans, reports, and the security gate. Standard library only.

    ZAP_API_KEY=... python3 .github/dast/zap_scan.py

Environment:
    ZAP_API_KEY        required; sent in the X-ZAP-API-Key header, never in URLs
    ZAP_URL            ZAP API, default http://127.0.0.1:8090
    API_TARGET         API base URL as ZAP sees it, default http://api:4000
    WEB_TARGET         web URL as ZAP sees it, default http://web:3000
    OPENAPI_FILE       path INSIDE the ZAP container, default /zap/wrk/openapi.json
    REPORT_DIR         path INSIDE the ZAP container, default /zap/wrk
    ASCAN_MAX_MINUTES  active scan time budget, default 20
    FAIL_ON            risk level that fails the gate: High (default) or Medium
    SECURITY_GATE_MODE audit (default, never fails) or enforce
    GITHUB_STEP_SUMMARY when set, a markdown summary is appended to it
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ZAP_URL = os.environ.get("ZAP_URL", "http://127.0.0.1:8090").rstrip("/")
API_KEY = os.environ.get("ZAP_API_KEY") or sys.exit("ZAP_API_KEY is required")
API_TARGET = os.environ.get("API_TARGET", "http://api:4000").rstrip("/")
WEB_TARGET = os.environ.get("WEB_TARGET", "http://web:3000").rstrip("/")
OPENAPI_FILE = os.environ.get("OPENAPI_FILE", "/zap/wrk/openapi.json")
REPORT_DIR = os.environ.get("REPORT_DIR", "/zap/wrk")
ASCAN_MAX_MINUTES = int(os.environ.get("ASCAN_MAX_MINUTES", "20"))
FAIL_ON = os.environ.get("FAIL_ON", "High")
ENFORCE = os.environ.get("SECURITY_GATE_MODE", "audit") == "enforce"
FILTERS_FILE = Path(__file__).with_name("zap-alert-filters.json")
CONTEXT = "cabinguard"
RISKS = ["High", "Medium", "Low", "Informational"]


def zap(path: str, **params: object) -> dict:
    """GET /JSON/<path>/ with the key in a header (keeps it out of ZAP's logs)."""
    query = urllib.parse.urlencode({k: str(v) for k, v in params.items()})
    request = urllib.request.Request(
        f"{ZAP_URL}/JSON/{path}/?{query}", headers={"X-ZAP-API-Key": API_KEY}
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        sys.exit(f"ZAP API {path} failed with {error.code}: {detail}")


def log(message: str) -> None:
    print(f"[zap] {message}", flush=True)


def wait_for(label: str, poll, done, interval: float = 5) -> None:
    while True:
        value = poll()
        log(f"{label}: {value}")
        if done(value):
            return
        time.sleep(interval)


def main() -> int:
    for _ in range(60):
        try:
            log(f"ZAP {zap('core/view/version')['version']} ready")
            break
        except (urllib.error.URLError, ConnectionError, SystemExit):
            time.sleep(2)
    else:
        sys.exit("ZAP did not answer")

    # Scope: only the two applications, nothing else on the network.
    context_id = zap("context/action/newContext", contextName=CONTEXT)["contextId"]
    for target in (API_TARGET, WEB_TARGET):
        zap("context/action/includeInContext", contextName=CONTEXT,
            regex=f"{re.escape(target)}.*")

    # Accepted false positives, each justified in the JSON file.
    for rule in json.loads(FILTERS_FILE.read_text())["filters"]:
        zap("alertFilter/action/addAlertFilter", contextId=context_id,
            ruleId=rule["ruleId"], newLevel=rule["newLevel"],
            url=rule.get("url", ""), urlIsRegex=str(rule.get("urlIsRegex", False)).lower(),
            parameter=rule.get("parameter", ""), enabled="true")
        log(f"alert filter {rule['ruleId']}: {rule['justification']}")

    # 1. Every API operation from the OpenAPI document.
    result = zap("openapi/action/importFile", file=OPENAPI_FILE,
                 target=API_TARGET, contextId=context_id)
    log(f"OpenAPI imported ({len(result.get('importFile', []))} warnings)")

    # 2. Crawl the web app (server-rendered pages, links, forms).
    zap("spider/action/setOptionMaxDuration", Integer=3)
    scan_id = zap("spider/action/scan", url=WEB_TARGET, contextName=CONTEXT,
                  recurse="true")["scan"]
    wait_for("spider %", lambda: int(zap("spider/view/status", scanId=scan_id)["status"]),
             lambda v: v >= 100)

    # 3. Passive rules over everything recorded so far.
    wait_for("passive records left",
             lambda: int(zap("pscan/view/recordsToScan")["recordsToScan"]),
             lambda v: v == 0, interval=3)

    # 4. Active attacks, time-boxed per rule and overall.
    zap("ascan/action/setOptionMaxScanDurationInMins", Integer=ASCAN_MAX_MINUTES)
    zap("ascan/action/setOptionMaxRuleDurationInMins", Integer=5)
    zap("ascan/action/setOptionThreadPerHost", Integer=4)
    scan_id = zap("ascan/action/scan", contextId=context_id, recurse="true",
                  inScopeOnly="false")["scan"]
    wait_for("active scan %", lambda: int(zap("ascan/view/status", scanId=scan_id)["status"]),
             lambda v: v >= 100, interval=10)
    wait_for("passive records left",
             lambda: int(zap("pscan/view/recordsToScan")["recordsToScan"]),
             lambda v: v == 0, interval=3)

    # 5. Reports (written by ZAP into its mounted work directory).
    sites = "|".join((API_TARGET, WEB_TARGET))
    for template, name in (("traditional-html", "zap-report.html"),
                           ("traditional-json", "zap-report.json"),
                           ("sarif-json", "zap-report.sarif.json")):
        zap("reports/action/generate", title="CabinGuard DAST", template=template,
            reportDir=REPORT_DIR, reportFileName=name, sites=sites)
    log(f"reports written to {REPORT_DIR}")

    # 6. Summary and gate.
    alerts = []
    start = 0
    while True:
        page = zap("core/view/alerts", start=start, count=500)["alerts"]
        alerts += [a for a in page if a["url"].startswith((API_TARGET, WEB_TARGET))]
        if len(page) < 500:
            break
        start += 500
    # One line per (risk, alert type); instances counted.
    by_type = Counter((a["risk"], a["alert"], a["pluginId"]) for a in alerts)
    by_risk = Counter(a["risk"] for a in alerts)

    lines = ["### DAST — OWASP ZAP", "",
             "| Risk | Alert | Rule | Instances |", "|---|---|---|---|"]
    for (risk, name, plugin), count in sorted(by_type.items(),
                                              key=lambda i: (RISKS.index(i[0][0]), i[0][1])):
        lines.append(f"| {risk} | {name} | {plugin} | {count} |")
    lines += ["", " · ".join(f"**{r}**: {by_risk.get(r, 0)}" for r in RISKS),
              "", f"Gate mode: `{'enforce' if ENFORCE else 'audit'}`, fails on `{FAIL_ON}` and above."]
    summary = "\n".join(lines)
    print(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
            fh.write(summary + "\n")

    failing = RISKS[: RISKS.index(FAIL_ON) + 1]
    blocking = sum(by_risk.get(r, 0) for r in failing)
    if blocking and ENFORCE:
        print(f"::error::{blocking} alert instance(s) at {FAIL_ON} risk or above")
        return 1
    if blocking:
        print(f"::warning::{blocking} alert instance(s) at {FAIL_ON} risk or above (audit mode)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
