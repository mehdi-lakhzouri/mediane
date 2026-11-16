"""The car loop: plays the sensor data at its real rate and runs each model at its own pace.

Every 200 ms (one "tick"):
  1. read 0.2 s from the sensor source: 50 ECG + 50 PPG values (250 Hz), 5 accelerometer values (25 Hz)
  2. send these samples to the browser (live signals)
  3. start a model when its input is ready (in its helper process, so the stream never waits):
       seizure : every 5 s, on the 125 new accelerometer values + the heart rate
       cardiac : every 10 s, on the last 60 s of ECG + PPG (once 60 s are buffered)
       stroke  : at the end of every face + voice clip
  4. when a model answers: send its features and output, and update the final decision

`realtime=False` (used by check_scenarios.py) runs the very same code without waiting.
"""
import asyncio
import math
import time

import numpy as np

from pipeline.engine import decide, hr_from_ppg
from pipeline.sources import FS_ACC, FS_CARD

TICK = 0.2                      # s of data per step
CARDIAC_EVERY = 50              # ticks (10 s)
BLOCK = 5 * FS_ACC              # 125 accelerometer values = one seizure block
MODELS = ("Cardiac", "Seizure", "Stroke")


def clean(o):
    """Makes a message JSON-safe: numpy -> Python, NaN / infinity -> null, floats rounded."""
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, np.ndarray):
        return clean(o.tolist())
    if isinstance(o, (bool, np.bool_)):
        return bool(o)
    if isinstance(o, (int, np.integer)):
        return int(o)
    if isinstance(o, (float, np.floating)):
        f = float(o)
        return round(f, 4) if math.isfinite(f) else None
    return o


def group(state):
    return state.split(" ")[0]            # "Seizure (convulsive)" -> "Seizure"


class Drive:
    """Everything about one scenario playback: signal buffers, model results, decision, log."""

    def __init__(self, scenario):
        self.sc = scenario
        self.ecg, self.ppg = np.zeros(0), np.zeros(0)
        self.acc = []                                    # accelerometer values not yet in a block
        self.last = {m: None for m in MODELS}            # latest result of each model
        self.state = "Normal"
        self.timeline = [(0.0, "Normal")]                # (time, state) at each change
        self.log = []                                    # state changes
        self.history = {m: [] for m in MODELS}           # (time, p, alarm) of each run
        self.messages = []                               # model + decision messages (for late browsers)
        self.t = 0.0


class CarLoop:
    def __init__(self, scenarios, workers, send, model_info):
        self.scenarios = {s.name: s for s in scenarios}
        self.order = [s.name for s in scenarios]
        self.workers, self.send, self.model_info = workers, send, model_info
        self.task, self.drive, self.playlist, self.results = None, None, [], []

    # ------------------------------------------------------------------ control
    def hello(self):
        return {"type": "hello", "scenarios": [s.info() for s in self.scenarios.values()],
                "models": self.model_info, "playing": self.task is not None and not self.task.done()}

    def snapshot(self):
        """Messages a browser opened in the middle of a scenario needs to catch up."""
        dv = self.drive
        if dv is None or self.task is None or self.task.done():
            return []
        return [self._scenario_msg(dv.sc)] + dv.messages

    def play(self, names):
        if self.task and not self.task.done():
            self.task.cancel()
        self.task = asyncio.create_task(self._play(names))

    async def stop(self):
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        self.drive = None
        await self.send({"type": "idle", "results": self.results, "stopped": True})

    async def _play(self, names):
        self.playlist, self.results = list(names), []
        try:
            for i, name in enumerate(names):
                if i:
                    await self.send({"type": "status", "text": f"Next scenario: {name}", "seconds": 4})
                    await asyncio.sleep(4)
                self.results.append(await self.run(self.scenarios[name], True, i, len(names)))
        except Exception as exc:
            await self.send({"type": "error", "text": f"Scenario failed: {type(exc).__name__}: {exc}"})
        finally:
            await self.send({"type": "idle", "results": self.results, "stopped": False})

    # ------------------------------------------------------------------ one scenario
    def _scenario_msg(self, sc):
        i = self.playlist.index(sc.name) if sc.name in self.playlist else 0
        return {"type": "scenario", **sc.info(), "index": i, "total": max(len(self.playlist), 1)}

    async def run(self, sc, realtime=True, index=0, total=1):
        await asyncio.gather(*(w.reset() for w in self.workers.values()))
        src = sc.make_source()
        dv = self.drive = Drive(sc)
        if not self.playlist:
            self.playlist = [sc.name]
        await self.send(self._scenario_msg(sc))
        clock = asyncio.get_running_loop().time
        next_wall = clock()
        pending = []
        n = round(sc.duration / TICK)
        for k in range(1, n + 1):
            t0 = time.perf_counter()
            d = await asyncio.to_thread(src.read, TICK) if src.realtime else src.read(TICK)
            t = dv.t = round(k * TICK, 1)
            dv.ecg = np.concatenate([dv.ecg, d["ecg"]])[-60 * FS_CARD:]
            dv.ppg = np.concatenate([dv.ppg, d["ppg"]])[-60 * FS_CARD:]
            dv.acc.extend(np.asarray(d["acc"], float).tolist())
            sensors_ms = round(1000 * (time.perf_counter() - t0), 2)
            ev = sc.event
            await self.send({"type": "signal", "t": t, "ecg": d["ecg"], "ppg": d["ppg"], "acc": d["acc"],
                             "face": [[ft, pts, label] for ft, pts, label in d["face"]],
                             "event": bool(ev and ev[0] <= t <= ev[1] + TICK)})

            jobs = []
            if len(dv.acc) >= BLOCK:
                block, dv.acc = np.asarray(dv.acc[:BLOCK]), dv.acc[BLOCK:]
                if d["hr"] is None:
                    hr, hr_src = hr_from_ppg(dv.ppg[-10 * FS_CARD:]), "wheel PPG (last 10 s)"
                else:
                    hr, hr_src = d["hr"], "sensor in the dataset (OSDB watch)"
                jobs.append(("Seizure", (block, hr), {"hr_source": hr_src}))
            if k % CARDIAC_EVERY == 0 and len(dv.ecg) >= 60 * FS_CARD:
                jobs.append(("Cardiac", (dv.ecg.copy(), dv.ppg.copy()), {}))
            elif k % CARDIAC_EVERY == 0:
                await self.send({"type": "waiting", "model": "Cardiac", "t": t,
                                 "text": f"buffering 60 s of ECG + PPG ({len(dv.ecg) // FS_CARD}/60 s)"})
            if d["clip"] is not None:
                c = d["clip"]
                clip = {key: c.get(key) for key in ("pts", "blend", "t", "audio", "sr", "label", "voice")}
                jobs.append(("Stroke", (clip,), {"healthy_recording": c.get("healthy")}))

            for name, args, extra in jobs:
                await self.send({"type": "job", "model": name, "t": t})
                job = self._job(dv, name, args, extra, t, sensors_ms)
                if realtime:
                    pending.append(asyncio.create_task(job))
                else:
                    await job                      # check mode: same order every time
            if realtime and not src.realtime:
                next_wall += TICK
                await asyncio.sleep(max(0.0, next_wall - clock()))
        await asyncio.gather(*pending)
        summary = self.summarize(dv)
        await self.send({"type": "end", "summary": summary})
        return summary

    async def _job(self, dv, name, args, extra, t, sensors_ms):
        try:
            r = await self.workers[name].step(*args)
        except Exception as e:                       # show the problem, keep the drive going
            await self.send({"type": "error", "text": f"{name} model failed at {t:.0f} s: {type(e).__name__}: {e}"})
            return
        if dv is not self.drive:                     # the scenario was changed meanwhile
            return
        t0 = time.perf_counter()
        r["extra"].update(extra)
        dv.last[name] = r
        dv.history[name].append((t, r["p"], r["alarm"]))
        dec = decide(dv.last)
        change = None
        if dec["state"] != dv.state:
            change = {"t": t, "from": dv.state, "to": dec["state"], "by": dec["by"], "confidence": dec["confidence"]}
            dv.log.append(change)
            dv.state = dec["state"]
            dv.timeline.append((t, dec["state"]))
        ms = dict(r["ms"], sensors=sensors_ms, decision=round(1000 * (time.perf_counter() - t0), 2))
        msgs = [{"type": "model", "model": name, "t": t, "ms": ms,
                 **{k: r[k] for k in ("p", "alarm", "threshold", "rule", "status", "key", "features", "extra")}},
                {"type": "decision", "t": t, **dec, "change": change}]
        dv.messages += msgs
        for m in msgs:
            await self.send(m)

    # ------------------------------------------------------------------ result of one scenario
    def summarize(self, dv):
        """Expected event vs what the system decided (used for the check table and the page)."""
        sc = dv.sc
        start = sc.event[0] if sc.event else None
        segs = []                                        # (from, to, state) periods of the final decision
        for i, (a, s) in enumerate(dv.timeline):
            b = dv.timeline[i + 1][0] if i + 1 < len(dv.timeline) else sc.duration
            if b > a or i == len(dv.timeline) - 1:       # skip states replaced within the same tick
                segs.append((a, b, s))
        detected = None
        if start is not None:
            for a, b, s in segs:
                if group(s) == sc.expected and b >= start:
                    detected = a
                    break
        other = [(a, s) for a, b, s in segs if s != "Normal" and not (detected is not None and a == detected)]
        peaks = {}
        for m in MODELS:
            h = dv.history[m]
            before = [p for t, p, _ in h if start is None or t < start]
            after = [p for t, p, _ in h if start is not None and t >= start]
            peaks[m] = {"runs": len(h), "alarms": sum(a for _, _, a in h),
                        "max_before": max(before) if before else None, "max_after": max(after) if after else None}
        return {"scenario": sc.name, "expected": sc.expected, "event_start": start, "final": dv.state,
                "detected_at": detected, "delay": None if detected is None else round(detected - start, 1),
                "other_alarms": other, "log": dv.log, "models": peaks, "simulated": sc.simulated,
                "duration": sc.duration}
