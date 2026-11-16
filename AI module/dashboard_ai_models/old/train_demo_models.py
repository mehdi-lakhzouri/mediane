"""Trains DEMO versions of the 4 models on synthetic data, so the dashboard works today.

    python train_demo_models.py          (about 2-3 minutes)

The demo models use exactly the same features, model types and file formats as the
team's notebooks, but they learned from simulated signals. They show that the pipeline
works end to end; their scores mean nothing medically. Replace them with the real
files from the notebooks (see EXPORT_FROM_NOTEBOOKS.md): the dashboard picks the real
files automatically when they are in models/.
"""
import os
import pickle
import time

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from pipeline import cardiac_features as cf
from pipeline import seizure_features as sf
from pipeline import stroke_features as stf
from pipeline.detectors import MODELS_DIR, SelectionCorrelation
from pipeline.engine import hr_from_ppg
from pipeline.synthetic import SCENARIOS, SyntheticSensors

RNG = np.random.default_rng(0)
FS = 250


def save(obj, name):
    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(os.path.join(MODELS_DIR, name), "wb") as f:
        pickle.dump(obj, f)
    print("  saved", name)


# ----------------------------------------------------------------------------- cardiac
def train_cardiac():
    print("Cardiac: building 60 s windows ...")
    rows, y, groups = [], [], []
    seed = 0
    for name, sc in SCENARIOS.items():
        emergency = sc["group"] == "Cardiac"
        for k in range(45 if emergency else 30):
            seed += 1
            onset = RNG.uniform(10, 110)                       # event starts at a random time
            s = SyntheticSensors(name, onset_s=onset, seed=seed)
            end = int(RNG.uniform(70, 120) // 5 * 5)
            reads = [s.read(5) for _ in range(end // 5)]
            ecg = np.concatenate([d["ecg"] for d in reads])[-60 * FS:]
            ppg = np.concatenate([d["ppg"] for d in reads])[-60 * FS:]
            rows.append(cf.record_features(np.c_[ecg, ppg], ["I", "PLETH"], "I"))
            y.append(int(emergency and end - onset >= 8))           # at least 8 s of the event in view
            groups.append(seed)
    X = pd.DataFrame(rows)
    feats = list(X.columns)
    y = np.array(y)
    params = dict(n_estimators=200, learning_rate=0.05, num_leaves=15, min_child_samples=10, subsample=0.8,
                  subsample_freq=1, colsample_bytree=0.5, class_weight="balanced", verbose=-1)
    oof = cross_val_predict(lgb.LGBMClassifier(**params, random_state=0), X, y, cv=GroupKFold(5), groups=groups,
                            method="predict_proba")[:, 1]
    thr95 = float(np.clip(np.floor(np.quantile(oof[y == 1], 0.05) * 100) / 100, 0.1, 0.5))
    thr90 = float(np.clip(np.floor(np.quantile(oof[y == 1], 0.10) * 100) / 100, 0.1, 0.5))
    models = [lgb.LGBMClassifier(**params, random_state=k).fit(X.to_numpy(float), y) for k in range(3)]
    print(f"  {len(X)} windows ({y.sum()} emergencies), {len(feats)} features, thresholds {thr95} / {thr90}")
    save({"models": models, "features": feats, "thresholds": {"95% of events": max(thr95, 0.05), "90% of events": max(thr90, 0.05)},
          "rule": "hybrid", "high_threshold": 0.5, "stride_s": 10, "window_s": 60, "fs": FS, "demo": True}, "demo_cardiac.pkl")


# ----------------------------------------------------------------------------- seizure detection + type
def train_seizure():
    print("Seizure: building 5 s blocks ...")
    blocks, type_rows, seed = [], [], 1000
    for name, sc in SCENARIOS.items():
        is_seizure = sc["group"] == "Seizure"
        for k in range(14 if is_seizure else 6):
            seed += 1
            onset = int(RNG.uniform(30, 90) // 5 * 5)
            s = SyntheticSensors(name, onset_s=onset, seed=seed)
            hist, ppg, crisis = [], np.zeros(0), []
            for i in range(int((onset + 120) / 5)):
                d = s.read(5)
                ppg = np.r_[ppg, d["ppg"]][-10 * FS:]
                f = sf.accel_features(d["acc"])
                f["hr"] = hr_from_ppg(ppg)
                hist.append(f)
                full = sf.causal_features(hist)
                lab = int(is_seizure and d["t_end"] > onset + 2)
                blocks.append({**full, "y": lab, "g": seed})
                if lab:
                    crisis.append(sf.kenza_window_features(d["acc"], f["hr"]))
                    if len(crisis) >= 2 and RNG.random() < 0.35:
                        type_rows.append({**sf.resume_crise(crisis).iloc[0].to_dict(), "y": int(name == "Seizure: aura"), "g": seed})
    B = pd.DataFrame(blocks)
    X, y, g = B[sf.FEATURES_8], B.y.to_numpy(), B.g.to_numpy()
    mk = lambda: HistGradientBoostingClassifier(max_iter=150, learning_rate=0.05, class_weight="balanced", random_state=0)
    oof = cross_val_predict(mk(), X, y, cv=GroupKFold(5), groups=g, method="predict_proba")[:, 1]
    thr = float(np.clip(np.quantile(oof[y == 0], 0.97), 0.2, 0.8))   # ~3 % of normal blocks above (kept in 0.2-0.8)
    model = mk().fit(X, y)
    print(f"  {len(B)} blocks ({y.sum()} during seizures), threshold {thr:.3f}")
    save({"model": model, "features": sf.FEATURES_8, "threshold": thr, "n_consec": 2, "fs": 25, "demo": True},
         "demo_seizure.pkl")

    T = pd.DataFrame(type_rows)
    pipe = Pipeline([("imputation", SimpleImputer(strategy="median", keep_empty_features=True)),
                     ("standardisation", StandardScaler()), ("selection", SelectionCorrelation(seuil=0.10)),
                     ("modele", LogisticRegression(C=1.0, class_weight="balanced", max_iter=3000))])
    pipe.fit(T[sf.KENZA_FEATURES], T.y)
    print(f"  seizure type: {len(T)} seizure summaries ({T.y.sum()} auras)")
    save({"model": pipe, "features": sf.KENZA_FEATURES, "classes": ["convulsive", "Aura"], "demo": True},
         "demo_seizure_type.pkl")


# ----------------------------------------------------------------------------- stroke
def train_stroke():
    print("Stroke: building face + voice clips ...")
    F, A, y = [], [], []
    s = SyntheticSensors(seed=7)
    for k in range(160):
        lab = k % 2
        level = RNG.uniform(0.25, 1.0) if lab else RNG.uniform(0.0, 0.2)
        c = s.make_clip(level)
        ff, _ = stf.face_features_from_landmarks(c["pts"], c["blend"], c["t"])
        F.append(ff)
        A.append(stf.f_mfcc(c["audio"].astype(float), c["sr"]))
        y.append(lab)
    F, A, y = pd.DataFrame(F)[stf.FACE_FEATURES], np.array(A), np.array(y)
    mk = lambda: Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler()),
                           ("clf", LogisticRegression(max_iter=3000, class_weight="balanced"))])
    save({"face_model": mk().fit(F.to_numpy(float), y), "face_features": stf.FACE_FEATURES,
          "audio_model": mk().fit(A, y), "audio_family": "MFCC", "w_face": 0.7, "threshold": 0.5, "demo": True},
         "demo_stroke.pkl")


if __name__ == "__main__":
    t = time.time()
    train_cardiac()
    train_seizure()
    train_stroke()
    print(f"Done in {time.time() - t:.0f} s")
