"""Quality check: plays every scenario at full speed through the same car loop as the dashboard
(same sources, same helper processes, same models, same decision), without a browser and
without waiting, then prints:

  1. the accelerometer format check (OSDB normal block vs healthy-volunteer block)
  2. for each scenario: expected event, final state, detection delay, other alarms

Run:  python check_scenarios.py
"""
import asyncio
import argparse
import json
import os
import sys
import time
import warnings

import numpy as np

warnings.filterwarnings("ignore")


def accelerometer_check():
    from pipeline import scenarios as SC
    from pipeline import sources as S
    from pipeline.seizure_features import accel_features
    print("\n1. ACCELEROMETER FORMAT (both: magnitude, 25 Hz, milli-g)")
    rows = []
    events, _ = SC._osdb_events()
    for name, ev in events.items():
        normal = [r for r in S.osdb_blocks(ev) if not r[3]][:12]       # blocks before the seizure
        if normal:
            rows.append((f"OSDB event {ev['id']} ({ev.get('subType')}), first normal block", normal[0][1]))
            rows.append((f"OSDB event {ev['id']}, {len(normal)} normal blocks (all values)", np.concatenate([r[1] for r in normal])))
    if not events:
        print("   (no OSDB file in data/: OSDB side not available)")
    for key in ["normal", "cardiac"]:
        p = SC._ptt(key)
        if p is not None:
            rows.append((f"volunteer {SC.PTT_RECORDS[key]}, block at 60-65 s", p["acc"][60 * 25:65 * 25]))
            rows.append((f"volunteer {SC.PTT_RECORDS[key]}, whole recording", p["acc"]))
    print(f"   {'':58s} {'mean':>8s} {'std':>7s} {'min':>7s} {'max':>7s}   acc_std of a 5 s block (median)")
    for label, x in rows:
        blocks = x[:len(x) // 125 * 125].reshape(-1, 125)
        med_std = np.median([accel_features(b)["acc_std"] for b in blocks])
        print(f"   {label:58s} {x.mean():8.1f} {x.std():7.1f} {x.min():7.1f} {x.max():7.1f}   {med_std:6.1f}")


def fmt_t(t):
    return "-" if t is None else f"{t:.0f} s"


def quality_findings(results):
    findings = []
    for result in results:
        if result['expected'] != 'Normal' and result['detected_at'] is None:
            findings.append(f"{result['scenario']}: expected event missed")
        if result['other_alarms']:
            findings.append(f"{result['scenario']}: unexpected final alarms")
        if result['delay'] is not None and result['delay'] < 0:
            findings.append(f"{result['scenario']}: final alarm preceded the labelled event")
    return findings


async def main(smoke=False, report=None):
    from pipeline.scenarios import build_scenarios
    from server.car_loop import CarLoop
    from server.model_workers import start_workers

    accelerometer_check()
    print("\nLoading data and models ...")
    scenarios = build_scenarios(log=lambda m: print("  ", m))
    workers, infos = await start_workers()
    for i in infos:
        print(f"   {i['model']:8s} {', '.join(i['files'])} | {i['rule']}")
    errors = []

    async def send(m):
        if m["type"] == "error":
            errors.append(m["text"])
            print("   ERROR:", m["text"])

    loop = CarLoop(scenarios, workers, send, infos)
    results = []
    print("\n2. SCENARIOS (played at full speed, same code as the dashboard)")
    for sc in scenarios:
        t0 = time.perf_counter()
        r = await loop.run(sc, realtime=False)
        results.append(r)
        print(f"   {sc.name:36s} {sc.duration:5.0f} s of data in {time.perf_counter() - t0:5.1f} s"
              f"{'   SIMULATED' if sc.simulated else ''}")
    for w in workers.values():
        w.close()

    print("\nRESULTS")
    head = f"{'scenario':36s} {'expected':9s} {'event at':>8s} {'detected at':>11s} {'delay':>7s}  {'final state':22s} other alarms"
    print(head + "\n" + "-" * (len(head) + 20))
    for r in results:
        delay = "-" if r["delay"] is None else f"{r['delay']:+.0f} s" + ("*" if r["delay"] < 0 else "")
        if r["expected"] != "Normal" and r["detected_at"] is None:
            delay = "MISSED"
        other = ", ".join(f"{s} at {a:.0f} s" for a, s in r["other_alarms"]) or "none"
        name = r["scenario"] + (" (SIM)" if r["simulated"] else "")
        print(f"{name:36s} {r['expected']:9s} {fmt_t(r['event_start']):>8s} {fmt_t(r['detected_at']):>11s} "
              f"{delay:>7s}  {r['final']:22s} {other}")
    print("\nPER MODEL: highest probability before / after the event start (threshold), alarm windows / runs")
    thr = {i["model"]: i["threshold"] for i in infos}
    for r in results:
        cells = []
        for m, v in r["models"].items():
            b = "-" if v["max_before"] is None else f"{v['max_before']:.2f}"
            a = "-" if v["max_after"] is None else f"{v['max_after']:.2f}"
            cells.append(f"{m} {b}/{a} (thr {thr[m]:.2f}) {v['alarms']}/{v['runs']}")
        print(f"   {r['scenario']:36s} " + " | ".join(cells))
    print("\nDelay = time of the first correct final decision minus the event start.")
    print("* = the alarm started BEFORE the event and was still on at the event start. For Seizure and Stroke this")
    print("    is a false alarm that happened to last. For Cardiac, the event start is the time of the ICU alarm,")
    print("    and the arrhythmia itself can start some seconds earlier.")
    if errors:
        print(f"\n{len(errors)} ERROR(S) during the runs (see above).")
    findings = quality_findings(results)
    if report:
        from pathlib import Path
        Path(report).write_text(json.dumps({'results': results, 'errors': errors, 'quality_findings': findings}, indent=2), encoding='utf-8')
    if findings:
        print('\nQUALITY GATE: FAILED (synthetic replay is not model validation)')
        for finding in findings:
            print('  ', finding)
    if errors or (findings and not smoke):
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--smoke', action='store_true', help='Check execution only; still report quality failures')
    parser.add_argument('--json-report', help='Write machine-readable scenario results')
    args = parser.parse_args()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    asyncio.run(main(args.smoke, args.json_report))
