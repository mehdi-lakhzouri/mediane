"""Run real model scenarios through NestJS without enabling external alerts.

Example: python -m gateway.replay --api http://localhost:4000/api/v1 --serial CG-DEMO --scenario Stroke
Secret comes from CABINGUARD_DEVICE_SECRET, never command-line arguments.
"""
import argparse
import asyncio
import hashlib
import json
import math
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .client import DeviceClient, DeliveryError
from .outbox import Outbox

MODEL_TYPES = {"Cardiac": "CARDIAC_EMERGENCY", "Seizure": "SEIZURE", "Stroke": "STROKE"}
ROOT = Path(__file__).resolve().parents[1]


def verified_manifest():
    manifest = json.loads((ROOT / "models" / "manifest.json").read_text(encoding="utf-8"))
    for entry in manifest["models"].values():
        if hashlib.sha256((ROOT / "models" / entry["file"]).read_bytes()).hexdigest() != entry["sha256"]:
            raise RuntimeError("Model checksum mismatch; refusing to load artifacts")
    return manifest["models"]


def utc(value):
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


async def play(args):
    # Verify before importing a module that can unpickle model artifacts.
    manifest = verified_manifest()
    from pipeline.scenarios import build_scenarios
    from server.car_loop import CarLoop
    from server.model_workers import start_workers

    client = DeviceClient(args.api, args.serial, os.environ.get("CABINGUARD_DEVICE_SECRET", ""), allow_insecure=args.allow_insecure)
    session = await asyncio.to_thread(client.request, "GET", "/device/ai/session")
    if not session["paired"]:
        raise RuntimeError("Pair the device with a test driver before replaying")
    association = session["associationId"]
    queue_key = hashlib.sha256((args.api.rstrip('/') + ':' + args.serial).encode()).hexdigest()[:16]
    outbox = Outbox(args.outbox or ROOT / '.gateway' / f'outbox-{queue_key}.sqlite')
    boot_id = str(uuid.uuid4())
    statuses = {m: "WARMING_UP" for m in MODEL_TYPES}
    started = datetime.now(timezone.utc)
    heartbeat_at = 0.0
    completed_at = {}
    scenarios = build_scenarios()
    selected = scenarios if args.scenario == "all" else [s for s in scenarios if s.name == args.scenario]
    if not selected:
        outbox.close()
        raise ValueError("Unknown scenario. Available: " + ", ".join(s.name for s in scenarios))
    workers, infos = await start_workers()
    model_messages = 0

    async def publish(message):
        nonlocal model_messages
        if delivery.done() and not delivery.cancelled():
            delivery.result()  # Do not continue after authentication/association failure.
        if message["type"] == "scenario":
            print("Replaying:", message["name"], "(replay events never open actionable incidents)")
        if message["type"] == "error":
            raise RuntimeError("A model failed; replay integration cannot be considered successful")
        if message["type"] == "model":
            model_messages += 1
            model, score = message["model"], message["p"]
            valid = isinstance(score, (int, float)) and math.isfinite(score) and 0 <= score <= 1
            statuses[model] = "READY" if valid else "ERROR"
            completed_at[model] = time.monotonic()
            if valid:
                captured = datetime.now(timezone.utc)
                def payload(event_id):
                    return {"clientEventId": event_id, "type": MODEL_TYPES[model], "detectedAt": utc(captured),
                            "confidence": float(score), "ai": {"schemaVersion": 1, "associationId": association,
                            "episodeId": event_id, "inputKind": "REPLAY", "model": model,
                            "modelSha256": manifest[model]["sha256"], "featureVersion": "1", "decisionVersion": "1",
                            "windowStartAt": utc(max(started, captured - timedelta(seconds=60 if model == "Cardiac" else 5))),
                            "windowEndAt": utc(captured)}}
                outbox.observe(f"{association}:{model}", bool(message["alarm"]), payload)
        # DB operations remain on this thread; the delivery task performs HTTP in a helper thread.

    async def deliver():
        nonlocal heartbeat_at
        while True:
            if time.monotonic() - heartbeat_at >= 15:
                for model, last_at in completed_at.items():
                    if time.monotonic() - last_at > (40 if model == 'Stroke' else 25):
                        statuses[model] = 'DEGRADED'
                health = {"associationId": association, "runtimeVersion": "0.1.0", "bootId": boot_id,
                          "queueDepth": outbox.depth, **{m.lower(): v for m, v in statuses.items()}}
                try:
                    await asyncio.to_thread(client.request, 'POST', '/device/ai/heartbeat', health)
                except DeliveryError as exc:
                    if exc.permanent:
                        raise
                    print('Heartbeat unavailable; detections remain queued locally')
                heartbeat_at = time.monotonic()
            if not await outbox.deliver_one_async(client, association):
                await asyncio.sleep(0.25)

    loop = CarLoop(selected, workers, publish, infos)
    delivery = asyncio.create_task(deliver())
    try:
        for scenario in selected:
            await loop.run(scenario, realtime=not args.fast)
        delivery.cancel()
        await asyncio.gather(delivery, return_exceptions=True)
        while await outbox.deliver_one_async(client, association):
            pass
        print(f"Completed {len(selected)} scenario(s), {model_messages} model outputs; pending events: {outbox.depth}")
        if outbox.depth or outbox.quarantined:
            raise RuntimeError(f"Undelivered events: {outbox.depth} pending, {outbox.quarantined} quarantined; inspect configuration/association before retrying")
    finally:
        delivery.cancel()
        await asyncio.gather(delivery, return_exceptions=True)
        # A successful run is not evidence that an exited gateway is still monitoring.
        try:
            await asyncio.to_thread(client.request, 'POST', '/device/ai/heartbeat', {
                'associationId': association, 'runtimeVersion': '0.1.0', 'bootId': boot_id,
                'queueDepth': outbox.depth, 'cardiac': 'UNAVAILABLE', 'seizure': 'UNAVAILABLE', 'stroke': 'UNAVAILABLE',
            })
        except DeliveryError:
            pass  # The server also expires coverage when heartbeats stop.
        for worker in workers.values():
            worker.close()
        outbox.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", required=True)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--scenario", default="Stroke")
    parser.add_argument("--outbox", help="Persistent SQLite path; defaults to a queue per API/device")
    parser.add_argument("--fast", action="store_true", help="Accelerated replay for integration checks only")
    parser.add_argument("--allow-insecure", action="store_true")
    args = parser.parse_args()
    asyncio.run(play(args))


if __name__ == "__main__":
    main()
