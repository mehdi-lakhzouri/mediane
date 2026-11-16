"""Seizure feature extraction.

Two models use the accelerometer + heart rate, one 5-second block at a time
(25 Hz -> 125 accelerometer values per block):

1. Seizure DETECTION (Ghaya's notebook): `accel_features` + causal history features.
   Copied from seizure_detection_model_GHAYA.ipynb (cells 10, 13 and SeizureMonitor).

2. Seizure TYPE (Kenza's notebook): each 5 s block becomes 7 signal values,
   then the whole seizure is summarised into 51 numbers (`resume_crise`).
   `resume_crise` is copied from Model_type_of_seizure_..._KENZA_.ipynb (cell 8).

   WARNING: the 7 per-block values (`kenza_window_features`) were computed in the
   team's script `code_modeles_v2` (not in the notebook). The definitions below are
   our best reconstruction from the column names. Before using Kenza's real saved
   model, check them against `code_modeles_v2` and fix them here if they differ.
"""
import numpy as np
import pandas as pd

FS = 25          # accelerometer sampling rate (Hz)
BLOCK = 125      # 5 s x 25 Hz


# ----------------------------------------------------------------------------- model 1 (Ghaya)
def accel_features(raw, fs=FS):
    """Features of one accelerometer block (125 values). Copied from Ghaya's notebook."""
    x = np.asarray(raw, float)
    x = x - x.mean()                                   # remove gravity / orientation
    spec = np.abs(np.fft.rfft(x)) ** 2                 # power per frequency
    freqs = np.fft.rfftfreq(len(x), 1 / fs)
    total = spec[1:].sum() + 1e-9
    feats = {
        "acc_std":  x.std(),
        "acc_rng":  np.ptp(x),
        "acc_mad":  np.abs(np.diff(x)).mean(),
        "acc_kurt": (x**4).mean() / (x.var()**2 + 1e-9),
        "logpow":   np.log1p(total),
        "domfreq":  freqs[1:][spec[1:].argmax()],
    }
    for lo, hi in [(0.5, 3), (3, 8), (8, 12.5)]:
        feats[f"p_{lo}_{hi}"] = spec[(freqs >= lo) & (freqs < hi)].sum() / total
    return feats


def causal_features(history):
    """Adds the 'last 15 seconds' features to the newest block.

    `history` = list of dicts (accel_features + 'hr') of all blocks so far, oldest first.
    Same logic as SeizureMonitor.update in Ghaya's notebook (only the past is used).
    """
    h = pd.DataFrame(history)
    f = dict(history[-1])
    for c in ["hr", "acc_std", "p_3_8", "logpow"]:
        f[c + "_d15"] = h[c].iloc[-1] - h[c].iloc[-4] if len(h) >= 4 else np.nan
        f[c + "_m15"] = h[c].iloc[-3:].mean()
    f["hr_base"] = h["hr"].median()
    f["hr_rel"] = f["hr"] - f["hr_base"]
    return f


FEATURES_8 = ["acc_std_m15", "acc_std_d15", "acc_kurt",
              "p_3_8_m15", "p_8_12.5", "domfreq",
              "hr_rel", "hr_d15"]


# ----------------------------------------------------------------------------- model 3 (Kenza)
SIGNAL = ["hr", "acc_ecart_type", "acc_amplitude", "acc_puissance_mouvement",
          "acc_puissance_3_8Hz", "acc_energie_3_8Hz_pct", "acc_freq_dominante"]
LOG = ["acc_ecart_type", "acc_amplitude", "acc_puissance_mouvement", "acc_puissance_3_8Hz"]


def kenza_window_features(raw, hr, fs=FS):
    """The 7 values of one 5 s block used by the seizure-type model (reconstruction, see top)."""
    x = np.asarray(raw, float)
    x = x - x.mean()
    spec = np.abs(np.fft.rfft(x)) ** 2 / len(x)
    freqs = np.fft.rfftfreq(len(x), 1 / fs)
    total = spec[1:].sum() + 1e-12
    band = spec[(freqs >= 3) & (freqs < 8)].sum()
    f = {"hr": hr if (hr is not None and hr > 0) else np.nan,
         "acc_ecart_type": x.std(),
         "acc_amplitude": np.ptp(x),
         "acc_puissance_mouvement": float(np.mean(x ** 2)),
         "acc_puissance_3_8Hz": float(band),
         "acc_energie_3_8Hz_pct": float(100 * band / total),
         "acc_freq_dominante": float(freqs[1:][spec[1:].argmax()])}
    for c in LOG:                                     # same log(1 + x) as the notebook
        f[c] = np.log1p(f[c])
    return f


def _q10(s):
    return s.quantile(0.10)


def _q90(s):
    return s.quantile(0.90)


def resume_crise(windows):
    """One row of 51 numbers for a whole seizure. Copied from Kenza's notebook (cell 8).

    `windows` = list of dicts from `kenza_window_features`, one per 5 s block of the seizure.
    """
    d = pd.DataFrame(windows)
    d["eventId"] = "live"
    par_crise = d.groupby("eventId", sort=True)
    resume = par_crise[SIGNAL].agg(["mean", "std", "min", "max", "median", _q10, _q90])
    resume.columns = [f"{c}_{s.lstrip('_')}" for c, s in resume.columns]
    colonnes_std = [c for c in resume.columns if c.endswith("_std")]
    resume[colonnes_std] = resume[colonnes_std].fillna(0.0)
    resume["duree_crise_s"] = par_crise.size() * 5
    premier_hr = par_crise["hr"].apply(lambda s: s.dropna().iloc[0] if s.notna().any() else np.nan)
    resume["hr_hausse"] = par_crise["hr"].max() - premier_hr
    return resume


KENZA_FEATURES = [f"{c}_{s}" for c in SIGNAL for s in ["mean", "std", "min", "max", "median", "q10", "q90"]] \
    + ["duree_crise_s", "hr_hausse"]
