"""The 4 real models, wrapped so the car loop can call them the same way.

Each detector loads its file from models/ (saved by the team's notebooks), computes the
features with the code copied from the notebooks, runs the model and applies the alarm rule
of the notebook. `step()` returns one result dict:

    p, alarm, threshold, rule (text), status (text), key (main features with names),
    features (all of them), ms (time of each pipeline step), extra (model-specific values)
"""
import os
import hashlib
import json
import pickle
import time

import joblib
import numpy as np
import pandas as pd
from scipy.stats import rankdata
from sklearn.base import BaseEstimator, TransformerMixin

from . import cardiac_features as cf
from . import seizure_features as sf
from . import stroke_features as stf

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
MODEL_FILES = {"cardiac": "cardiac_arrest_HAJER.pkl", "seizure": "seizure_detection_GHAYA.pkl",
               "seizure_type": "seizure_type_KENZA.pkl", "stroke": "stroke_detection_DAOUSSAR.pkl"}


# Kenza's pipeline uses this custom step: it must exist when her file is loaded.
class SelectionCorrelation(TransformerMixin, BaseEstimator):
    """Copied from Kenza's notebook: keeps features with |correlation| with the class >= seuil."""

    def __init__(self, seuil=0.10):
        self.seuil = seuil

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        classes = np.unique(y)
        Y = (np.asarray(y)[:, None] == classes[None, :]).astype(float)
        if len(classes) == 2:
            Y = Y[:, 1:]
        force = np.zeros(X.shape[1])
        for A, B in ((X, Y), (rankdata(X, axis=0), rankdata(Y, axis=0))):
            A = (A - A.mean(0)) / np.where(A.std(0) > 0, A.std(0), np.inf)
            B = (B - B.mean(0)) / np.where(B.std(0) > 0, B.std(0), np.inf)
            force = np.maximum(force, np.abs(A.T @ B / len(A)).max(axis=1))
        self.correlation_ = force
        self.support_ = force >= self.seuil
        if not self.support_.any():
            self.support_[np.argmax(force)] = True
        return self

    def transform(self, X):
        return np.asarray(X, dtype=float)[:, self.support_]


class _Unpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if name == "SelectionCorrelation":
            return SelectionCorrelation
        return super().find_class(module, name)


def _load(path):
    try:
        with open(path, "rb") as f:
            return _Unpickler(f).load()
    except Exception:
        import __main__
        __main__.SelectionCorrelation = SelectionCorrelation    # files saved from a notebook
        return joblib.load(path)


def load_bundle(kind):
    """Returns (bundle, file name). Stops with a clear message if the file is missing."""
    name = MODEL_FILES[kind]
    path = os.path.join(MODELS_DIR, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model file missing: models/{name}")
    with open(os.path.join(MODELS_DIR, 'manifest.json'), encoding='utf-8') as f:
        manifest = json.load(f)
    expected = next(entry['sha256'] for entry in manifest['models'].values() if entry['file'] == name)
    with open(path, 'rb') as f:
        if hashlib.sha256(f.read()).hexdigest() != expected:
            raise RuntimeError(f"Unapproved model artifact: {name}")
    return _load(path), name


# ----------------------------------------------------------------------------- stopwatch
# Measures the time spent in the preprocessing functions (filters, beat detection, face alignment)
# by wrapping them. The functions themselves are NOT changed: same inputs, same outputs.
_PRE = {"s": 0.0, "depth": 0}


def _timed(fn):
    def wrapper(*args, **kwargs):
        if _PRE["depth"]:                          # called from another timed function: counted once
            return fn(*args, **kwargs)
        _PRE["depth"] += 1
        t0 = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            _PRE["s"] += time.perf_counter() - t0
            _PRE["depth"] -= 1
    wrapper.__wrapped__ = fn
    return wrapper


for _mod, _names in [(cf, ["fill_nan", "bp", "qrs_xqrs", "qrs_energy", "ppg_peaks"]), (stf, ["aligner"])]:
    for _n in _names:
        if not hasattr(getattr(_mod, _n), "__wrapped__"):
            setattr(_mod, _n, _timed(getattr(_mod, _n)))


def _ms(seconds):
    return round(1000 * seconds, 1)


def _key(values, spec):
    """Main features with a readable name: spec = [(feature, label, unit, scale), ...]."""
    out = []
    for fid, label, unit, scale in spec:
        v = values.get(fid)
        v = float(v) * scale if v is not None and np.isfinite(v) else None
        out.append({"id": fid, "label": label, "unit": unit, "value": v})
    return out


# ----------------------------------------------------------------------------- cardiac (Hajer)
CARDIAC_KEY = [("ecg10_hr", "Heart rate, ECG (last 10 s)", "bpm", 1),
               ("ppg10_hr", "Pulse rate, PPG (last 10 s)", "bpm", 1),
               ("ecg16_maxgap", "Longest pause between beats (16 s)", "s", 1),
               ("x_match16", "Beats followed by a pulse (16 s)", "%", 100),
               ("vf8_vfband", "VF band power 2-8 Hz (8 s)", "%", 100),
               ("qrs_width_ratio", "Beat width vs baseline", "x", 1),
               ("ppg_pamp10", "Pulse size vs baseline", "x", 1)]


class CardiacDetector:
    """Every 10 s: last 60 s of ECG + PPG -> 85 features -> 5 LightGBM averaged -> hybrid rule."""
    name = "Cardiac"

    def __init__(self, operating_point="95% of events"):
        self.b, self.file = load_bundle("cardiac")
        self.thr = self.b["thresholds"][operating_point]
        self.hi = self.b.get("high_threshold", 0.5)
        self.rule = f"emergency if one window >= {self.hi:.2f}, or 2 windows in a row >= {self.thr:.2f}"
        self.run = 0

    def step(self, ecg60, ppg60):
        _PRE["s"] = 0.0
        t0 = time.perf_counter()
        f = cf.record_features(np.c_[ecg60, ppg60], ["I", "PLETH"], "I")
        total, pre = time.perf_counter() - t0, _PRE["s"]
        t0 = time.perf_counter()
        x = np.array([[f.get(c, np.nan) for c in self.b["features"]]], float)
        p = float(np.mean([m.predict_proba(x)[0, 1] for m in self.b["models"]]))
        self.run = self.run + 1 if p >= self.thr else 0
        alarm = p >= self.hi or self.run >= 2
        model_s = time.perf_counter() - t0
        status = ("EMERGENCY" if alarm else
                  f"above threshold ({self.run}/2 in a row)" if self.run else "no emergency")
        return {"p": p, "alarm": alarm, "threshold": self.thr, "rule": self.rule, "status": status,
                "key": _key(f, CARDIAC_KEY), "features": {c: f.get(c, np.nan) for c in self.b["features"]},
                "ms": {"preprocessing": _ms(pre), "features": _ms(total - pre), "model": _ms(model_s)},
                "extra": {"high_threshold": self.hi}}


# ----------------------------------------------------------------------------- seizure (Ghaya + Kenza)
SEIZURE_KEY = [("hr", "Heart rate used", "bpm", 1),
               ("acc_std_m15", "Movement intensity (15 s mean)", "mg", 1),
               ("acc_std_d15", "Movement change over 15 s", "mg", 1),
               ("p_3_8_m15", "Movement energy 3-8 Hz (15 s)", "%", 100),
               ("p_8_12.5", "Movement energy 8-12.5 Hz", "%", 100),
               ("domfreq", "Dominant movement frequency", "Hz", 1),
               ("acc_kurt", "Peakiness of movement (kurtosis)", "", 1),
               ("hr_rel", "Heart rate vs personal baseline", "bpm", 1),
               ("hr_d15", "Heart-rate change over 15 s", "bpm", 1)]
TYPE_WARNING = ("Seizure type: the 7 values per 5 s block are a reconstruction (the script "
                "code_modeles_v2 that made the training values is not available). Not verified.")


class SeizureDetector:
    """Every 5 s: 125 accelerometer values + heart rate -> 8 features -> HistGradientBoosting.
    Alarm when the threshold is passed 2 blocks in a row. During a seizure, Kenza's model
    gives its type from all the seizure blocks so far."""
    name = "Seizure"

    def __init__(self):
        self.b, self.file = load_bundle("seizure")
        tb, self.type_file = load_bundle("seizure_type")
        self.type_model, self.type_features = tb["model"], tb["features"]
        self.type_classes = tb.get("classes", ["convulsive", "Aura"])
        self.thr, self.n = self.b["threshold"], self.b["n_consec"]
        self.rule = f"seizure if P > {self.thr:.2f} for {self.n} blocks in a row ({5 * self.n} s)"
        self.history, self.above, self.crisis_windows, self.quiet = [], [], [], 0

    def step(self, acc, hr):
        t0 = time.perf_counter()
        f = sf.accel_features(acc)
        f["hr"] = hr if (hr is not None and np.isfinite(hr) and hr > 0) else np.nan
        self.history.append(f)
        self.history = self.history[-120:]                # last 10 minutes are enough for the HR baseline
        full = sf.causal_features(self.history)
        feat_s = time.perf_counter() - t0
        t0 = time.perf_counter()
        p = float(self.b["model"].predict_proba(pd.DataFrame([full])[self.b["features"]])[0, 1])
        self.above.append(p > self.thr)
        run = 0
        for a in reversed(self.above):
            if not a:
                break
            run += 1
        alarm = run >= self.n
        model_s = time.perf_counter() - t0

        # seizure type, only while a seizure is going on
        kw = sf.kenza_window_features(acc, f["hr"])
        if self.above[-1]:
            self.crisis_windows.append(kw)
            self.quiet = 0
        else:
            self.quiet += 1
            if self.quiet >= 3:                           # 15 s calm: the seizure is over
                self.crisis_windows = []
        stype = p_type = None
        type_s = 0.0
        if alarm and len(self.crisis_windows) >= 2:
            t0 = time.perf_counter()
            X = sf.resume_crise(self.crisis_windows)[self.type_features]
            pr = self.type_model.predict_proba(X)[0]
            k = int(np.argmax(pr))
            stype, p_type = self.type_classes[k], float(pr[k])
            type_s = time.perf_counter() - t0
        status = "SEIZURE" if alarm else (f"above threshold ({run}/{self.n} in a row)" if run else "no seizure")
        return {"p": p, "alarm": alarm, "threshold": self.thr, "rule": self.rule, "status": status,
                "key": _key(full, SEIZURE_KEY), "features": full,
                "ms": {"preprocessing": None, "features": _ms(feat_s), "model": _ms(model_s + type_s)},
                "extra": {"type": stype, "p_type": p_type, "type_blocks": len(self.crisis_windows),
                          "type_warning": TYPE_WARNING}}


# ----------------------------------------------------------------------------- stroke (Daoussar)
STROKE_KEY = [("asym_mouth_med", "Mouth asymmetry", "", 1),       # distances in eye-distance units
              ("mouth_tilt_med", "Mouth tilt", "", 1),
              ("asym_brows_med", "Brow asymmetry", "", 1),
              ("bs_mouth_smile_asym", "Smile asymmetry (blendshapes)", "", 1)]


class StrokeDetector:
    """For each face + voice clip: face asymmetry model + voice model, late fusion 70/30
    (face only if there is no voice)."""
    name = "Stroke"

    def __init__(self):
        self.b, self.file = load_bundle("stroke")
        self.w = self.b.get("w_face", 0.7)
        self.thr = self.b.get("threshold", 0.5)
        self.rule = f"stroke if {self.w:.1f} x face + {1 - self.w:.1f} x voice >= {self.thr:.2f} (one clip)"

    def step(self, clip):
        _PRE["s"] = 0.0
        t0 = time.perf_counter()
        ff, _ = stf.face_features_from_landmarks(clip["pts"], clip["blend"], clip["t"])
        total, pre = time.perf_counter() - t0, _PRE["s"]
        xf = np.array([[ff.get(c, np.nan) for c in self.b["face_features"]]], float)
        t0 = time.perf_counter()
        p_face = float(self.b["face_model"].predict_proba(xf)[0, 1])
        model_s = time.perf_counter() - t0
        feats = {c: ff.get(c, np.nan) for c in self.b["face_features"]}
        p_voice = None
        if clip.get("audio") is not None and self.b.get("audio_model") is not None:
            t0 = time.perf_counter()
            fn = stf.f_mfcc if self.b.get("audio_family", "MFCC") == "MFCC" else stf.f_mel
            xa = fn(np.asarray(clip["audio"], float), clip.get("sr", stf.AUDIO_SR))[None]
            total += time.perf_counter() - t0
            t0 = time.perf_counter()
            p_voice = float(self.b["audio_model"].predict_proba(xa)[0, 1])
            model_s += time.perf_counter() - t0
            half = xa.shape[1] // 2
            feats.update({f"voice_{'mean' if i < half else 'std'}_{i % half + 1}": float(v) for i, v in enumerate(xa[0])})
        p = p_face if p_voice is None else self.w * p_face + (1 - self.w) * p_voice
        alarm = p >= self.thr
        return {"p": p, "alarm": alarm, "threshold": self.thr, "rule": self.rule,
                "status": "STROKE" if alarm else "no stroke",
                "key": _key(ff, STROKE_KEY), "features": feats,
                "ms": {"preprocessing": _ms(pre), "features": _ms(total - pre), "model": _ms(model_s)},
                "extra": {"p_face": p_face, "p_voice": p_voice, "clip": clip["label"], "voice": clip.get("voice")}}


DETECTORS = {"Cardiac": CardiacDetector, "Seizure": SeizureDetector, "Stroke": StrokeDetector}
