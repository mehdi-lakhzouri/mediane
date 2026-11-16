"""The scenarios: which real recordings make each simulated drive.

Rule used everywhere: inside ONE sensor stream, a scenario never joins recordings of two
different people. The models compare "now" with the last minute (cardiac: last 16 s vs the
44 s before; seizure: heart rate vs the personal baseline), so a join would itself look
like an event. Different sensors may come from different recordings.

    scenario                ECG + PPG (wheel)              accelerometer (seat)        face + voice
    Normal driving          healthy volunteer s3           same volunteer              healthy clips
    Cardiac: ...            CinC record, 180 s -> end      healthy volunteer s14       healthy clips
    Seizure: ...            healthy volunteer s7           OSDB event + its heart rate healthy clips
    Stroke                  healthy volunteer s10          same volunteer              healthy, then post-stroke clips

If the real data of a scenario is missing, the synthetic generator (synthetic.py) replaces
it and the scenario is marked SIMULATED.
"""
import json
import os
from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from . import sources as S

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
PHYSIONET_DIR = os.path.join(DATA_DIR, "physionet")
OSDB_FILES = ["osdb_3min_allSeizures.json.gz", "osdb_3min_allSeizures.json"]
CLIPS_DIR = os.path.join(DATA_DIR, "stroke_clips")
OSDB_CACHE = os.path.join(DATA_DIR, "cache", "osdb_selected_events.json")

# CinC 2015 records with a TRUE alarm, all from the held-out test split of Hajer's notebook
CINC_RECORDS = {"Cardiac: ventricular tachycardia": "v255l", "Cardiac: ventricular fibrillation": "f563l",
                "Cardiac: asystole": "a142s", "Cardiac: extreme bradycardia": "b455l"}
CINC_START = 180            # play from 180 s: the alarm (at 300 s in every record) comes at 2:00
# healthy volunteers held out from training (PTT_TEST in Hajer's notebook), sitting
PTT_RECORDS = {"normal": "s3_sit", "seizure": "s7_sit", "stroke": "s10_sit", "cardiac": "s14_sit"}
OSDB_TYPES = {"Seizure: tonic-clonic": "Tonic-Clonic", "Seizure: aura": "Aura"}
NORMAL_DURATION = 240       # s
STROKE_DURATION, STROKE_ONSET = 150, 60
TICK = 0.2


@dataclass
class Scenario:
    name: str
    expected: str                       # Normal / Cardiac / Seizure / Stroke
    duration: float                     # s
    event: tuple = None                 # (start, end) in s from the start of the drive, None = no event
    event_text: str = ""
    sources: dict = field(default_factory=dict)     # sensor group -> where the data comes from
    notes: list = field(default_factory=list)       # shown on screen
    simulated: bool = False
    make_source: Callable = None        # returns a fresh SensorSource for one playback

    def info(self):
        return {"name": self.name, "expected": self.expected, "duration": self.duration,
                "event": list(self.event) if self.event else None, "event_text": self.event_text,
                "sources": self.sources, "notes": self.notes, "simulated": self.simulated}


def _floor_tick(x):
    return int(x / TICK + 1e-6) * TICK


def schedule(clips, start, until):
    """Clips back to back (cycling through the list) from `start` until `until` seconds."""
    out, t, i = [], start, 0
    while clips and t < until:
        c = clips[i % len(clips)]
        out.append((t, c))
        t += c["duration"] + 0.5                 # half a second between two recordings
        i += 1
    return out


# ----------------------------------------------------------------------------- data loading
def _ptt(key):
    path = os.path.join(PHYSIONET_DIR, "ptt", PTT_RECORDS[key])
    return S.load_ptt(path) if os.path.exists(path + ".dat") else None


def _osdb_events():
    """The two OSDB events used (one per type). Picked by a fixed rule, never by the model output:
    the first event of the type (file order) with >= 60 s before the seizure, a seizure of >= 20 s
    and a heart rate in >= 80 % of the blocks. Cached in data/cache/ after the first load."""
    path = next((os.path.join(DATA_DIR, f) for f in OSDB_FILES if os.path.exists(os.path.join(DATA_DIR, f))), None)
    if path is None:
        return {}, None
    if os.path.exists(OSDB_CACHE) and os.path.getmtime(OSDB_CACHE) > os.path.getmtime(path):
        with open(OSDB_CACHE, encoding="utf-8") as f:
            return json.load(f), os.path.basename(path)
    events = S.load_osdb(path)
    chosen = {}
    for name, subtype in OSDB_TYPES.items():
        cands = [e for e in events if (e.get("subType") or "") == subtype]
        for ev in cands:
            rows = S.osdb_blocks(ev)
            ictal = [i for i, r in enumerate(rows) if r[3]]
            if ictal and ictal[0] >= 12 and len(ictal) >= 4 and np.mean([np.isfinite(r[2]) for r in rows]) >= 0.8:
                chosen[name] = ev
                break
        else:
            chosen.update({name: ev for ev in cands[:1] if any(r[3] for r in S.osdb_blocks(ev))})
    os.makedirs(os.path.dirname(OSDB_CACHE), exist_ok=True)
    with open(OSDB_CACHE, "w", encoding="utf-8") as f:
        json.dump(chosen, f)
    return chosen, os.path.basename(path)


def _clips():
    healthy, stroke = [], []
    for npz, wav in S.find_clips(CLIPS_DIR) if os.path.isdir(CLIPS_DIR) else []:
        c = S.load_clip(npz, wav)
        (healthy if c["healthy"] else stroke).append(c)
    return healthy, stroke


def _names(clips):
    names = sorted({c["label"] for c in clips})
    return ", ".join(names[:3]) + (" ..." if len(names) > 3 else "")


def _clip_label(clips):
    return f"NeuroFace {_names(clips)}" if clips else "no clips in data/stroke_clips (camera off)"


def _player(ecg, ppg, acc, hr=None, clips=(), labels=None, duration=None):
    return lambda: S.RecordingPlayer(ecg, ppg, acc, hr, clips, labels, duration)


# ----------------------------------------------------------------------------- simulated fallback
def _simulated(name, syn_name, expected, onset, duration, note):
    """All sensors from synthetic.py (used only when the real data of a scenario is missing)."""
    from .synthetic import SyntheticSensors
    syn = SyntheticSensors(syn_name, onset_s=onset, clip_every_s=20, seed=7)
    parts, clips = [], []
    for _ in range(int(np.ceil(duration / 5))):
        d = syn.read(5)
        parts.append(d)
        c = d["clip"]
        if c is not None:
            c.update(t_rel=c["t"] - c["t"][0], pts68=c["pts"], duration=float(c["t"][-1] - c["t"][0] + 1 / 15),
                     person="SYN", healthy=c["label"].endswith("0.0)"), voice="synthetic voice")
            clips.append((d["t_end"] - c["duration"], c))
    ecg = np.concatenate([d["ecg"] for d in parts])
    ppg = np.concatenate([d["ppg"] for d in parts])
    acc = np.concatenate([d["acc"] for d in parts]) * 1000           # g -> milli-g
    src = {k: "SIMULATED (synthetic.py)" for k in ["ECG + PPG", "Accelerometer", "Face + voice"]}
    event = None if expected == "Normal" else (onset, duration)
    return Scenario(name, expected, _floor_tick(duration), event,
                    f"simulated event at {onset:.0f} s" if event else "no event: must stay Normal",
                    src, [note], True, _player(ecg, ppg, acc, None, clips, src, duration))


# ----------------------------------------------------------------------------- the scenarios
def build_scenarios(log=print):
    """Loads every recording once and returns the list of scenarios."""
    healthy, stroke_clips = _clips()
    cam_normal = _clip_label(healthy)
    log(f"face + voice clips: {len(healthy)} healthy, {len(stroke_clips)} post-stroke")
    out = []

    # --- normal driving
    p = _ptt("normal")
    if p is not None:
        d = NORMAL_DURATION
        src = {"ECG + PPG": f"PTT {PTT_RECORDS['normal']} (healthy volunteer, sitting)",
               "Accelerometer": f"PTT {PTT_RECORDS['normal']} (same volunteer, fingertip sensor, converted to milli-g)",
               "Face + voice": cam_normal}
        out.append(Scenario("Normal driving", "Normal", d, None, "no event: must stay Normal", src,
                            ["Healthy volunteer held out from the cardiac model's training. Sitting, not driving."],
                            False, _player(p["ecg"], p["ppg"], p["acc"], None, schedule(healthy, 2, d), src, d)))
    else:
        out.append(_simulated("Normal driving", "Normal driving", "Normal", 10 ** 6, NORMAL_DURATION,
                              "Run python get_data.py to use real recordings."))

    # --- cardiac
    motion = _ptt("cardiac")
    for name, rec in CINC_RECORDS.items():
        path = os.path.join(PHYSIONET_DIR, "cinc2015", rec)
        if not os.path.exists(path + ".mat") or motion is None:
            syn = {"ventricular tachycardia": "Cardiac: ventricular tachycardia (VT)",
                   "ventricular fibrillation": "Cardiac: ventricular fibrillation (VF)",
                   "asystole": "Cardiac: asystole", "extreme bradycardia": "Cardiac: extreme bradycardia"}[name.split(": ")[1]]
            out.append(_simulated(name, syn, "Cardiac", 120, 150, "Run python get_data.py to use real recordings."))
            continue
        c = S.load_cinc(path, CINC_START)
        d = _floor_tick(c["length"])
        src = {"ECG + PPG": f"CinC 2015 {rec}, {CINC_START}-{CINC_START + d:.0f} s ({c['lead']}, PLETH)",
               "Accelerometer": f"PTT {PTT_RECORDS['cardiac']} (healthy volunteer, fingertip sensor, converted to milli-g)",
               "Face + voice": cam_normal}
        notes = [f"ICU patient, true {c['alarm_type'].replace('_', ' ')} alarm at 300 s of the record (here at "
                 f"{c['alarm_at']:.0f} s). Record from the held-out test split: never used to train the cardiac model.",
                 "The minutes before the alarm are the same patient (ICU, not a healthy driver)."]
        if not c["lead"].startswith("lead I"):
            notes.append(f"ECG: {c['lead']}; the car will use lead I. The cardiac model was trained on every lead.")
        if d <= c["alarm_at"] + 1:
            notes.append("The recording stops at the alarm: only the window ending at the alarm sees the event.")
        out.append(Scenario(name, "Cardiac", d, (c["alarm_at"], d), f"true alarm at {c['alarm_at']:.0f} s", src,
                            notes, False, _player(c["ecg"], c["ppg"], motion["acc"], None, schedule(healthy, 2, d), src, d)))

    # --- seizure
    events, osdb_file = _osdb_events()
    p = _ptt("seizure")
    for name, subtype in OSDB_TYPES.items():
        ev = events.get(name)
        if ev is None or p is None:
            out.append(_simulated(name, name, "Seizure", 60, 180,
                                  "No OSDB file in data/ (osdb_3min_allSeizures.json.gz): simulated movement."))
            continue
        o = S.osdb_stream(ev)
        d = _floor_tick(len(o["acc"]) / S.FS_ACC)
        src = {"ECG + PPG": f"PTT {PTT_RECORDS['seizure']} (healthy volunteer, sitting)",
               "Accelerometer": f"{o['label']} from {osdb_file}, with its heart rate",
               "Face + voice": cam_normal}
        notes = [f"Seizure from {o['seizure'][0]:.0f} to {o['seizure'][1]:.0f} s (OSDB seizureTimes). The seizure "
                 "detection model was trained on ALL OSDB events, this one included: demo, not a test.",
                 "Heart rate for the seizure model: from the OSDB watch (the ECG/PPG shown are a healthy volunteer).",
                 "Seizure type: the 7 values per block are a reconstruction (code_modeles_v2 not available)."]
        out.append(Scenario(name, "Seizure", d, o["seizure"], f"seizure {o['seizure'][0]:.0f}-{o['seizure'][1]:.0f} s",
                            src, notes, False,
                            _player(p["ecg"], p["ppg"], o["acc"], o["hr"], schedule(healthy, 2, d), src, d)))

    # --- stroke
    p = _ptt("stroke")
    if p is None or not healthy or not stroke_clips:
        out.append(_simulated("Stroke", "Stroke: facial droop + slurred speech", "Stroke", STROKE_ONSET, STROKE_DURATION,
                              "No healthy + post-stroke clips in data/stroke_clips: simulated face and voice."))
    else:
        d = STROKE_DURATION
        first = schedule(healthy, 2, STROKE_ONSET)
        onset = first[-1][0] + first[-1][1]["duration"] + 0.5 if first else STROKE_ONSET
        cams = first + schedule(stroke_clips, onset, d)
        src = {"ECG + PPG": f"PTT {PTT_RECORDS['stroke']} (healthy volunteer, sitting)",
               "Accelerometer": f"PTT {PTT_RECORDS['stroke']} (same volunteer, fingertip sensor, converted to milli-g)",
               "Face + voice": f"NeuroFace healthy {_names(healthy)}, then post-stroke {_names(stroke_clips)}"}
        notes = [f"Healthy clips first, post-stroke clips from {onset:.0f} s. The stroke model answers at the end of each clip.",
                 "The stroke model was trained on all NeuroFace people, these included: demo, not a test."]
        out.append(Scenario("Stroke", "Stroke", d, (onset, d), f"post-stroke clips from {onset:.0f} s", src, notes,
                            False, _player(p["ecg"], p["ppg"], p["acc"], None, cams, src, d)))
    return out
