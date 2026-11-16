"""Where the sensor data comes from.

The car loop only knows ONE interface, `SensorSource.read(seconds)`. It returns the next
`seconds` of every sensor, exactly as the car sensors send them:

    {"ecg":  250 values per second (steering-wheel ECG),
     "ppg":  250 values per second (steering-wheel PPG),
     "acc":  25 values per second (accelerometer magnitude, milli-g, like OSDB),
     "hr":   None  = no heart-rate sensor: the loop computes the heart rate from the PPG
             float = heart rate from a sensor (bpm; NaN = sensor has no value right now),
     "clip": None, or one finished face + voice clip (input of the stroke model),
     "face": face points of the camera images in this chunk (only for the screen)}

Two sources exist:
    RecordingPlayer : plays real recordings (the scenarios), one chunk at a time
    GatewaySource   : the real sensors (next week): only its read() must be written

The loaders below turn each dataset into that format (units, sampling rates).
"""
import glob
import gzip
import json
import os
from datetime import datetime

import numpy as np
from scipy.signal import resample_poly

FS_CARD, FS_ACC = 250, 25
G = 9.80665                        # 1 g in m/s2
NON_SPEECH = ("BLOW", "BROW", "KISS", "OPEN", "SPREAD")   # face tasks the stroke face model was trained on
SPEECH = ("NORMAL", "PA", "PATAKA")                         # voice tasks


class SensorSource:
    """The interface. `read(seconds)` returns the dict described at the top of this file."""
    realtime = False      # True: read() itself waits until the data has arrived (real sensors)
    duration = None       # seconds of data available (None = endless)
    labels = {}           # sensor group -> where its data comes from (shown on screen)

    def read(self, seconds):
        raise NotImplementedError


class GatewaySource(SensorSource):
    """The sensor gateway (next week).

    Write `read(seconds)` so that it WAITS until `seconds` of data have arrived, then returns
    the dict described at the top of this file. Notes:
      * resample to 250 Hz (ECG, PPG) and 25 Hz (accelerometer) with scipy.signal.resample_poly
        if the sensors run at other rates: the models only work at these rates;
      * accelerometer = magnitude sqrt(x2 + y2 + z2) in milli-g (1000 = gravity), like OSDB;
      * "hr": None (there is no wearable: the heart rate is computed from the PPG);
      * "clip": a face + voice clip when the camera has recorded one, otherwise None.
    Then, in pipeline/scenarios.py, add a scenario whose make_source() returns GatewaySource().
    """
    realtime = True

    def __init__(self, **connection_settings):
        self.settings = connection_settings
        self.labels = {"ECG + PPG": "gateway", "Accelerometer": "gateway", "Face + voice": "gateway"}

    def read(self, seconds):
        raise NotImplementedError("Gateway not connected yet: see the docstring of GatewaySource.")


class RecordingPlayer(SensorSource):
    """Plays prepared recordings at their real sampling rates, chunk by chunk.

    ecg, ppg : arrays at 250 Hz          acc : array at 25 Hz (milli-g)
    hr       : None, or one value per accelerometer sample (bpm)
    clips    : list of (start time in s, clip dict) for the camera + microphone
    """

    def __init__(self, ecg, ppg, acc, hr=None, clips=(), labels=None, duration=None):
        self.ecg, self.ppg, self.acc, self.hr = ecg, ppg, acc, hr
        self.clips = sorted(clips, key=lambda c: c[0])
        self.labels = labels or {}
        n = min(len(ecg) / FS_CARD, len(acc) / FS_ACC)
        self.duration = min(n, duration) if duration else n
        self.t = 0.0
        self.i_card = self.i_acc = 0
        self.next_clip = 0            # index of the next clip whose end has not been delivered

    def read(self, seconds):
        n_c, n_a = round(seconds * FS_CARD), round(seconds * FS_ACC)
        a, b = self.i_card, self.i_card + n_c
        c, d = self.i_acc, self.i_acc + n_a
        t0, t1 = self.t, self.t + seconds
        out = {"ecg": self.ecg[a:b], "ppg": self.ppg[a:b], "acc": self.acc[c:d],
               "hr": None if self.hr is None else float(self.hr[min(d, len(self.hr)) - 1]),
               "clip": None, "face": []}
        for start, clip in self.clips:                         # camera images of this chunk
            if start < t1 and start + clip["duration"] > t0:
                at = start + clip["t_rel"]
                for k in np.nonzero((at >= t0) & (at < t1))[0]:
                    if np.isfinite(clip["pts68"][k]).all():
                        out["face"].append((float(at[k]), clip["pts68"][k], clip["label"]))
        while self.next_clip < len(self.clips):                 # a clip whose recording ends now
            start, clip = self.clips[self.next_clip]
            if start + clip["duration"] > t1:
                break
            out["clip"] = clip
            self.next_clip += 1
        self.i_card, self.i_acc, self.t = b, d, t1
        return out


# ============================================================================= loaders
def lead_for_car(sig, names):
    """Lead I (the steering-wheel lead) if it exists or can be derived, otherwise lead II."""
    from .cardiac_features import lead_I
    ecg, how = lead_I(sig, names)
    if ecg is not None:
        return ecg, "lead I" if how == "I" else f"lead I derived ({how})"
    for n in ["II", "V", "MCL"]:
        if n in names:
            return sig[:, names.index(n)], f"lead {n} (no lead I in this record)"
    raise ValueError(f"no ECG lead in {names}")


def load_cinc(path, start_s):
    """A CinC 2015 record from `start_s` to its end. The alarm is at 300 s in every record."""
    import wfdb
    r = wfdb.rdrecord(path)
    names, sig = list(r.sig_name), r.p_signal.astype(float)
    ecg, lead = lead_for_car(sig, names)
    ppg = sig[:, names.index("PLETH")]
    a = int(start_s * FS_CARD)
    alarm = r.comments[0] if r.comments else "?"
    return {"ecg": ecg[a:], "ppg": ppg[a:], "lead": lead, "alarm_type": alarm,
            "true_alarm": len(r.comments) > 1 and r.comments[1].lower().startswith("true"),
            "alarm_at": 300 - start_s, "length": len(ecg) / FS_CARD - start_s}


def load_ptt(path):
    """A Pulse Transit Time PPG record (healthy volunteer), converted to the car format.

    ECG 500 -> 250 Hz. PPG: infrared fingertip channel (pleth_2), upside down in this dataset,
    so it is inverted, as in Hajer's notebook. Accelerometer: the header says "g" but the values
    are m/s2 (about 9.8 at rest), so it is divided by 9.81 and x1000 -> milli-g, each axis
    resampled 500 -> 25 Hz, then the magnitude, like the OSDB watch.
    """
    import wfdb
    r = wfdb.rdrecord(path)
    names, sig = list(r.sig_name), r.p_signal.astype(float)
    k = int(r.fs) // FS_CARD
    ecg = resample_poly(sig[:, names.index("ecg")], 1, k)
    ppg = -resample_poly(sig[:, names.index("pleth_2")], 1, k)
    axes = [resample_poly(sig[:, names.index(a)], 1, int(r.fs) // FS_ACC) for a in ("a_x", "a_y", "a_z")]
    acc = np.sqrt(sum(x ** 2 for x in axes)) / G * 1000
    return {"ecg": ecg, "ppg": ppg, "acc": acc}


def load_osdb(path):
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        return json.load(f)


def seizure_times(event):
    st = event["seizureTimes"]
    return json.loads(st) if isinstance(st, str) else st


def osdb_blocks(event):
    """The 5 s blocks of one OSDB event, cleaned like Ghaya's notebook (125 values,
    duplicated timestamps removed, time order). Returns a list of (t, acc[125], hr, ictal)."""
    t0 = datetime.fromisoformat(event["dataTime"])
    s0, s1 = seizure_times(event)
    rows = []
    for p in event["datapoints"]:
        if len(p.get("rawData") or []) != 125:
            continue
        t = (datetime.fromisoformat(p["dataTime"]) - t0).total_seconds()
        hr = p.get("hr")
        rows.append((t, np.asarray(p["rawData"], float), float(hr) if (hr or -1) > 0 else np.nan, s0 <= t <= s1))
    times = [r[0] for r in rows]
    rows = [r for r in rows if times.count(r[0]) == 1]
    return sorted(rows, key=lambda r: r[0])


def osdb_stream(event):
    """One OSDB event as a continuous 25 Hz stream (accelerometer + heart rate held per block)."""
    rows = osdb_blocks(event)
    acc = np.concatenate([r[1] for r in rows])
    hr = np.repeat([r[2] for r in rows], 125)
    ictal = [i for i, r in enumerate(rows) if r[3]]
    return {"acc": acc, "hr": hr, "seizure": (5 * ictal[0], 5 * (ictal[-1] + 1)) if ictal else None,
            "label": f"OSDB event {event['id']} ({event.get('subType') or 'Unknown'}, user {event['userId']})"}


def load_clip(npz_path, wav_path=None):
    """One NeuroFace clip: face landmarks (.npz from Daoussar's notebook) + an optional voice .wav."""
    from .stroke_features import AUDIO_SR, MP68, load_audio
    z = np.load(npz_path)
    pts, blend, t = np.asarray(z["pts"], float), np.asarray(z["blend"], float), np.asarray(z["t"], float)
    if pts.shape[1] == 478:
        pts = pts[:, MP68, :]
    pts68 = pts[..., :2]
    t_rel = t - t[0]
    step = float(np.median(np.diff(t_rel))) if len(t_rel) > 1 else 0.1
    name = os.path.splitext(os.path.basename(npz_path))[0]
    person = name.split("_")[0]
    return {"pts": pts68, "blend": blend, "t": t, "t_rel": t_rel, "pts68": pts68, "duration": float(t_rel[-1] + step),
            "audio": load_audio(wav_path) if wav_path else None, "sr": AUDIO_SR, "person": person,
            "healthy": person.upper().startswith("N"), "label": name,
            "voice": os.path.basename(wav_path) if wav_path else None}


def find_clips(folder):
    """Face clips (.npz) of the folder, each paired with a voice .wav of the same person.
    Non-speech face tasks are preferred: the face model was trained on them."""
    npz = sorted(glob.glob(os.path.join(folder, "*.npz")))
    wavs = sorted(glob.glob(os.path.join(folder, "*.wav")))
    key = lambda p: os.path.splitext(os.path.basename(p))[0].replace("_color", "")
    face = [p for p in npz if key(p).split("_")[-1].upper() in NON_SPEECH] or npz
    def voice_for(p):
        person = key(p).split("_")[0]
        same = [w for w in wavs if key(w).split("_")[0] == person]
        speech = [w for w in same if key(w).split("_")[-1].upper() in SPEECH]
        return (speech or same or [None])[0]
    return [(p, voice_for(p)) for p in face]
