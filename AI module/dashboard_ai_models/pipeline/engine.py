"""Shared detection logic used by the car loop (server/car_loop.py):

  * hr_from_ppg : heart rate for the seizure model, from the steering-wheel PPG (no wearable in the car)
  * decide      : the final decision = among the models in alarm, the highest confidence wins
"""
import numpy as np
from scipy.signal import butter, find_peaks, sosfiltfilt

FS_CARD = 250
TIE_ORDER = ["Cardiac", "Seizure", "Stroke"]   # only used when two confidences are almost equal


def hr_from_ppg(ppg, fs=FS_CARD):
    """Heart rate (bpm) from the last 10 s of PPG, for the seizure model (no wearable in the car)."""
    ppg = np.asarray(ppg, float)
    if len(ppg) < 5 * fs or not np.isfinite(ppg).all() or np.ptp(ppg) < 1e-9:
        return np.nan
    f = sosfiltfilt(butter(3, [0.5, 8], btype="band", fs=fs, output="sos"), ppg)
    pk, _ = find_peaks(f, distance=int(0.27 * fs), prominence=0.3 * (np.percentile(f, 95) - np.percentile(f, 5)))
    if len(pk) < 3:
        return np.nan
    return float(60 / np.median(np.diff(pk) / fs))


def decide(results):
    """Highest confidence among the models that raise an alarm; otherwise Normal."""
    firing = {k: r for k, r in results.items() if r is not None and r["alarm"]}
    if not firing:
        best = max((r["p"] for r in results.values() if r is not None), default=0.0)
        return {"state": "Normal", "group": "Normal", "confidence": 1 - best, "by": None, "candidates": {}}
    # highest confidence wins; near-ties (< 0.02 apart) go to the most time-critical event
    top = max(r["p"] for r in firing.values())
    k = next(n for n in TIE_ORDER if n in firing and firing[n]["p"] >= top - 0.02)
    label = k
    stype = firing[k].get("extra", {}).get("type")
    if k == "Seizure" and stype:
        label = f"Seizure ({stype})"
    return {"state": label, "group": k, "confidence": firing[k]["p"], "by": k,
            "candidates": {n: round(r["p"], 2) for n, r in firing.items()}}
