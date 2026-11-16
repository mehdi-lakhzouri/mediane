"""Cardiac feature extraction, copied WITHOUT CHANGES from Hajer's notebook
(cardiac_arrest_HAJER_.ipynb, cells 8-12).

Do not edit the feature code here: the model only works if the dashboard computes
exactly the same features as the notebook that trained it.
Input : 60 s of one ECG lead + PPG at 250 Hz (15,000 samples each).
Output: a dict of ~85 numbers (features).
"""
"""CabinGuard cardiac features: ECG (one lead) + PPG only, from the 60 s before the alarm.

Everything here uses only signals a car can measure (one ECG lead from the steering
wheel, PPG from the wheel or a camera). Arterial pressure, respiration and the
monitor's alarm type are never used as inputs.
"""
import warnings
import numpy as np
import wfdb
from wfdb import processing
from scipy.signal import butter, sosfiltfilt, find_peaks, welch
from scipy.stats import kurtosis, skew

FS = 250
T0, T1 = 240, 300                 # analysis window in the record (s): 60 s ending at the alarm
BASE = (0.0, 44.0)                # baseline, 240-284 s (seconds relative to T0)
L16, L10, L5 = (44.0, 60.0), (50.0, 60.0), (55.0, 60.0)
ECG_LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "V", "MCL"]

# ----------------------------------------------------------------------------- helpers
def _sos(lo, hi, order=3):
    return butter(order, [lo, hi], btype="band", fs=FS, output="sos")

SOS = {k: _sos(*k) for k in [(0.5, 40), (5, 15), (0.5, 8), (1, 30)]}

def bp(x, lo, hi):
    return sosfiltfilt(SOS[(lo, hi)], x)

def fill_nan(x):
    """Linear interpolation of missing samples. Returns (signal or None, missing fraction)."""
    x = np.asarray(x, float)
    m = np.isnan(x)
    if m.all():
        return None, 1.0
    if m.any():
        i = np.arange(len(x))
        x = x.copy()
        x[m] = np.interp(i[m], i[~m], x[~m])
    return x, float(m.mean())

def seg(x, win):
    return x[int(win[0] * FS):int(win[1] * FS)]

def band_power(f, p, lo, hi):
    m = (f >= lo) & (f < hi)
    return float(p[m].sum())

def block_stat(x, sec, fn):
    """Statistic per block of `sec` seconds, interpolated back to every sample."""
    n = int(sec * FS)
    k = max(len(x) // n, 1)
    vals = np.array([fn(x[i * n:(i + 1) * n]) for i in range(k)])
    centers = (np.arange(k) + 0.5) * n
    return np.interp(np.arange(len(x)), centers, vals), vals

def longest_run(mask):
    best = cur = 0
    for v in mask:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best


# ----------------------------------------------------------------------------- lead handling
def lead_I(sig, names):
    """Lead I (left hand - right hand, the steering-wheel lead) when it exists or can be derived."""
    g = {n: sig[:, names.index(n)] for n in names}
    if "I" in g:
        return g["I"], "I"
    if "II" in g and "III" in g:
        return g["II"] - g["III"], "II-III"
    if "II" in g and "aVF" in g:
        return 2 * g["II"] - 2 * g["aVF"], "2II-2aVF"
    if "II" in g and "aVL" in g:
        return g["aVL"] + g["II"] / 2, "aVL+II/2"
    if "II" in g and "aVR" in g:
        return -2 * g["aVR"] - g["II"], "-2aVR-II"
    return None, None


def load_window(path, rec):
    r = wfdb.rdrecord(f"{path}/{rec}", sampfrom=T0 * FS, sampto=T1 * FS)
    return r.p_signal.astype(float), list(r.sig_name)

# ----------------------------------------------------------------------------- beat detection
def qrs_xqrs(x):
    if x is None or np.ptp(x) < 1e-6:
        return np.array([], int)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return np.asarray(processing.xqrs_detect(sig=x, fs=FS, verbose=False), int)
    except Exception:
        return np.array([], int)


def qrs_energy(x):
    """Pan-Tompkins-style detector (independent of xqrs, used for detector agreement)."""
    if x is None or np.ptp(x) < 1e-6:
        return np.array([], int)
    f = bp(x, 5, 15)
    e = np.gradient(f) ** 2
    w = int(0.12 * FS)
    mwi = np.convolve(e, np.ones(w) / w, "same")
    th, blocks = block_stat(mwi, 2, lambda s: np.percentile(s, 98))
    floor = 0.1 * np.median(blocks)
    pk, _ = find_peaks(mwi, height=np.maximum(0.3 * th, floor), distance=int(0.18 * FS))
    # move each peak to the largest |ECG| sample nearby (aligns with the R wave)
    r = int(0.08 * FS)
    af = np.abs(f)
    return np.array([max(p - r, 0) + int(np.argmax(af[max(p - r, 0):p + r])) for p in pk], int)


def ppg_peaks(x):
    """Systolic peaks of the PPG; returns (peak indices, pulse amplitudes, filtered PPG)."""
    if x is None:
        return np.array([], int), np.array([]), None
    if np.ptp(x) < 1e-9:                                    # sensor flat for the whole minute
        return np.array([], int), np.array([]), np.zeros(len(x))
    f = bp(x, 0.5, 8)
    loc, _ = block_stat(f, 2, lambda s: np.percentile(s, 95) - np.percentile(s, 5))
    base = np.percentile(seg(f, BASE), 95) - np.percentile(seg(f, BASE), 5)
    prom = np.maximum(0.3 * loc, 0.1 * base)
    pk, _ = find_peaks(f, distance=int(0.27 * FS), prominence=prom)
    amps = []
    prev = 0
    for p in pk:
        lo = max(prev, p - int(0.8 * FS))
        amps.append(f[p] - f[lo:p + 1].min())
        prev = p
    return pk, np.asarray(amps, float), f


def match_f1(a, b, tol=0.15):
    """Agreement between two beat lists (seconds): F1 with a tolerance."""
    if len(a) == 0 and len(b) == 0:
        return np.nan
    if len(a) == 0 or len(b) == 0:
        return 0.0
    hit = sum(np.min(np.abs(b - t)) <= tol for t in a)
    return 2 * hit / (len(a) + len(b))

# ----------------------------------------------------------------------------- feature groups
def rhythm(t, win, pre):
    a, b = win
    tt = t[(t >= a) & (t < b)]
    rr = np.diff(tt)
    o = {f"{pre}_n": len(tt) / (b - a) * 60}            # beats per minute counted
    o[f"{pre}_hr"] = 60 / np.median(rr) if len(rr) >= 2 else np.nan
    o[f"{pre}_cv"] = rr.std() / rr.mean() if len(rr) >= 3 else np.nan
    o[f"{pre}_maxgap"] = float(np.diff(np.r_[a, tt, b]).max())
    o[f"{pre}_endgap"] = float(b - tt[-1]) if len(tt) else float(b - a)
    if len(rr) >= 4:
        r4 = np.convolve(rr, np.ones(4) / 4, "valid")
        o[f"{pre}_hrmax4"], o[f"{pre}_hrmin4"] = 60 / r4.min(), 60 / r4.max()
    else:
        o[f"{pre}_hrmax4"] = o[f"{pre}_hrmin4"] = np.nan
    return o


def ecg_quality(x, win, pre):
    s = seg(x, win)
    f = bp(x, 0.5, 40)
    fs_ = seg(f, win)
    fr, p = welch(s - s.mean(), FS, nperseg=min(len(s), 4 * FS))
    tot = band_power(fr, p, 0.5, 100) + 1e-12
    o = {f"{pre}_kurt": float(kurtosis(fs_)), f"{pre}_skew": float(skew(fs_)),
         f"{pre}_psqi": band_power(fr, p, 5, 15) / (band_power(fr, p, 5, 40) + 1e-12),
         f"{pre}_bas": band_power(fr, p, 0, 1) / (band_power(fr, p, 0, 40) + 1e-12),
         f"{pre}_hf": band_power(fr, p, 40, 100) / tot}
    return o


def flat_seconds(f, win, ref):
    """Longest run (s) of 0.5-s blocks whose peak-to-peak is below 5% of the baseline size."""
    s = seg(f, win)
    n = int(0.5 * FS)
    k = len(s) // n
    if k == 0:
        return np.nan
    if ref <= 1e-9:                                         # flat already at baseline
        return (win[1] - win[0]) if np.ptp(s) <= 1e-9 else np.nan
    ptp = np.ptp(s[:k * n].reshape(k, n), axis=1)
    return longest_run(ptp < 0.05 * ref) * 0.5


def vf_features(x, win, pre):
    """Classic ventricular-fibrillation detectors on the last seconds of ECG."""
    s = seg(bp(x, 1, 30), win)
    s = s - s.mean()
    o = {}
    fr, p = welch(s, FS, nperseg=min(len(s), 4 * FS))
    m = (fr >= 0.5) & (fr <= 20)
    tot = p[m].sum() + 1e-12
    fd = fr[m][np.argmax(p[m])]
    o[f"{pre}_fdom"] = float(fd)
    o[f"{pre}_conc"] = float(p[(fr >= fd - 1) & (fr <= fd + 1)].sum() / tot)      # spectral concentration
    o[f"{pre}_vfband"] = float(p[(fr >= 2) & (fr < 8)].sum() / tot)
    # VF filter leakage (Kuo & Dillman): low leakage = sine-like = VF
    d = np.abs(np.diff(s)).sum() + 1e-12
    N = int(round(np.pi * np.abs(s).sum() / d / 2))
    if 1 <= N < len(s) // 2:
        o[f"{pre}_leak"] = float(np.abs(s[N:] + s[:-N]).sum() / (np.abs(s[N:]).sum() + np.abs(s[:-N]).sum() + 1e-12))
    else:
        o[f"{pre}_leak"] = np.nan
    # threshold-crossing sample count (Arafat): share of samples above 20% of max, per 3-s block
    n3 = 3 * FS
    blocks = [s[i:i + n3] for i in range(0, len(s) - n3 + 1, n3)] or [s]
    o[f"{pre}_tcsc"] = float(np.mean([np.mean(np.abs(b / (np.abs(b).max() + 1e-12)) > 0.2) for b in blocks]))
    # mean absolute value of the normalised signal (Anas) and zero crossings per second
    o[f"{pre}_mav"] = float(np.mean([np.mean(np.abs(b / (np.abs(b).max() + 1e-12))) for b in blocks]))
    o[f"{pre}_zc"] = float(np.sum(np.diff(np.sign(s)) != 0) / (len(s) / FS))
    # Lempel-Ziv complexity of the signal binarised at its median
    o[f"{pre}_lz"] = lz_complexity((s > np.median(s)).astype(np.int8))
    return o


def lz_complexity(b):
    """Normalised Lempel-Ziv complexity (Kaspar-Schuster)."""
    n = len(b)
    if n < 2:
        return np.nan
    s = b.tobytes()
    c, l, i, k, kmax = 1, 1, 0, 1, 1
    while True:
        if s[i + k - 1] == s[l + k - 1]:
            k += 1
            if l + k > n:
                c += 1
                break
        else:
            kmax = max(k, kmax)
            i += 1
            if i == l:
                c += 1
                l += kmax
                if l + 1 > n:
                    break
                i, k, kmax = 0, 1, 1
            else:
                k = 1
    return float(c * np.log2(n) / n)


def beat_morphology(f, beats, pre):
    """QRS shape: do the beats before the alarm look like the patient's baseline beats? (VT = wide, different)."""
    h = int(0.1 * FS)
    def cut(idx):
        return np.array([f[i - h:i + h] for i in idx if h <= i < len(f) - h])
    t = beats / FS
    bb, lb = beats[(t >= BASE[0]) & (t < BASE[1])], beats[(t >= L16[0]) & (t < L16[1])]
    B, L = cut(bb), cut(lb)
    o = {f"{pre}_corr": np.nan, f"{pre}_lowcorr": np.nan, f"{pre}_width": np.nan,
         f"{pre}_width_ratio": np.nan, f"{pre}_selfcorr": np.nan, f"{pre}_amp_ratio": np.nan}
    if len(B) < 5 or len(L) < 3:
        return o
    tmpl = np.median(B, axis=0)
    def corr(a, b):
        a, b = a - a.mean(), b - b.mean()
        return float(a @ b / (np.sqrt((a @ a) * (b @ b)) + 1e-12))
    cs = np.array([corr(b, tmpl) for b in L])
    o[f"{pre}_corr"] = float(np.median(cs))
    o[f"{pre}_lowcorr"] = float(np.mean(cs < 0.7))
    def width(w):
        e = np.abs(w - np.median(w))
        return float(np.sum(e > 0.5 * e.max()) / FS * 1000)        # ms above half of the peak
    lt = np.median(L, axis=0)
    o[f"{pre}_width"] = width(lt)
    o[f"{pre}_width_ratio"] = width(lt) / (width(tmpl) + 1e-9)
    o[f"{pre}_selfcorr"] = float(np.median([corr(L[i], L[i + 1]) for i in range(len(L) - 1)])) if len(L) > 1 else np.nan
    o[f"{pre}_amp_ratio"] = float(np.ptp(lt) / (np.ptp(tmpl) + 1e-9))
    return o


def ppg_morphology(f, pk, pre):
    """Do the pulses before the alarm keep the baseline pulse shape? (lost pulse / motion = no)."""
    o = {f"{pre}_tcorr": np.nan, f"{pre}_skew10": np.nan}
    if f is None:
        return o
    o[f"{pre}_skew10"] = float(skew(seg(f, L10)))
    h0, h1 = int(0.3 * FS), int(0.5 * FS)
    t = pk / FS
    def cut(idx):
        return np.array([f[i - h0:i + h1] for i in idx if h0 <= i < len(f) - h1])
    B = cut(pk[(t >= BASE[0]) & (t < BASE[1])])
    L = cut(pk[(t >= L10[0]) & (t < L10[1])])
    if len(B) >= 5 and len(L) >= 2:
        tm = np.median(B, axis=0)
        cs = [np.corrcoef(b, tm)[0, 1] for b in L]
        o[f"{pre}_tcorr"] = float(np.nanmedian(cs))
    return o

# ----------------------------------------------------------------------------- one record
def ecg_block(ecg_raw):
    """All features that need only the ECG lead."""
    ecg, ecg_nan = fill_nan(ecg_raw)
    o = {"ecg_nan": ecg_nan}
    if ecg is None:
        return o, None
    bx = qrs_xqrs(ecg)
    be = qrs_energy(ecg)
    tx, te = bx / FS, be / FS
    f = bp(ecg, 0.5, 40)
    for win, tag in [(BASE, "b"), (L16, "16"), (L10, "10"), (L5, "5")]:
        r = rhythm(tx, win, f"ecg{tag}")
        if tag in ("b", "5"):
            r = {k: v for k, v in r.items() if k.endswith(("_hr", "_n"))}
        o.update(r)
    # beats from the second detector in the last 16 s (robust rate when one detector fails)
    o.update({k.replace("ecg16", "ecgE16"): v for k, v in rhythm(te, L16, "ecg16").items()
              if k.endswith(("_hr", "_maxgap", "_hrmax4"))})
    o["ecg_bsqi16"] = match_f1(tx[tx >= L16[0]], te[te >= L16[0]])
    o["ecg_bsqi_b"] = match_f1(tx[tx < BASE[1]], te[te < BASE[1]])
    o.update(ecg_quality(ecg, L10, "ecgq10"))
    o.update({k: v for k, v in ecg_quality(ecg, BASE, "ecgqb").items() if k.endswith(("kurt", "psqi"))})
    ref = np.percentile(seg(f, BASE), 99) - np.percentile(seg(f, BASE), 1)
    o["ecg_amp_ratio10"] = (np.percentile(seg(f, L10), 99) - np.percentile(seg(f, L10), 1)) / (ref + 1e-9)
    o["ecg_flat16"] = flat_seconds(f, L16, ref)
    raw16 = seg(ecg, L16)
    o["ecg_sat16"] = float(np.mean((raw16 == raw16.max()) | (raw16 == raw16.min())))
    o.update(vf_features(ecg, (52.0, 60.0), "vf8"))
    o.update(beat_morphology(f, bx, "qrs"))
    o["ecg_hr_jump"] = o["ecg10_hr"] - o["ecgb_hr"]
    return o, tx


def ppg_block(ppg_raw):
    ppg, ppg_nan = fill_nan(ppg_raw)
    o = {"ppg_nan": ppg_nan}
    if ppg is None:
        return o, None
    pk, amps, f = ppg_peaks(ppg)
    tp = pk / FS
    for win, tag in [(BASE, "b"), (L16, "16"), (L10, "10"), (L5, "5")]:
        r = rhythm(tp, win, f"ppg{tag}")
        if tag in ("b", "5"):
            r = {k: v for k, v in r.items() if k.endswith(("_hr", "_n"))}
        o.update(r)
    def med_amp(win):
        m = (tp >= win[0]) & (tp < win[1])
        return float(np.median(amps[m])) if m.sum() else 0.0
    ab = med_amp(BASE)
    o["ppg_pamp10"] = med_amp(L10) / (ab + 1e-9) if ab > 0 else np.nan     # pulse size now vs baseline
    o["ppg_pamp5"] = med_amp(L5) / (ab + 1e-9) if ab > 0 else np.nan
    ref = np.percentile(seg(f, BASE), 95) - np.percentile(seg(f, BASE), 5)
    o["ppg_std_ratio10"] = float(seg(f, L10).std() / (seg(f, BASE).std() + 1e-9))
    o["ppg_flat16"] = flat_seconds(f, L16, ref)
    raw16 = seg(ppg, L16)
    o["ppg_sat16"] = float(np.mean((raw16 == raw16.max()) | (raw16 == raw16.min())))
    o["ppg_kurt10"] = float(kurtosis(seg(f, L10)))
    o.update(ppg_morphology(f, pk, "ppgm"))
    o["ppg_hr_jump"] = o["ppg10_hr"] - o["ppgb_hr"]
    return o, tp


def cross_block(te, tp):
    """Does every heartbeat produce a pulse? (the core ECG + PPG cross-check)"""
    o = {k: np.nan for k in ["x_match16", "x_match_b", "x_match_drop", "x_ptt", "x_ptt_iqr",
                             "x_rate_ratio10", "x_rate_diff10", "x_count_diff16"]}
    if te is None or tp is None:
        return o
    def next_delay(e):
        if len(tp) == 0:
            return np.full(len(e), np.inf)
        j = np.searchsorted(tp, e)
        ok = j < len(tp)
        d = np.full(len(e), np.inf)
        d[ok] = tp[j[ok]] - e[ok]
        return d
    # the beat-to-pulse delay differs between patients and monitors: learn it from the baseline
    eb = te[(te >= BASE[0]) & (te < BASE[1])]
    db = next_delay(eb)
    db = db[db < 1.5]
    D = float(np.median(db)) if len(db) >= 5 else 0.3
    def match(win, tol=0.15):
        e = te[(te >= win[0]) & (te < win[1])]
        if len(e) == 0:
            return np.nan, np.array([])
        if len(tp) == 0:
            return 0.0, np.array([])
        d = np.min(np.abs(tp[None, :] - (e[:, None] + D)), axis=1)
        good = d <= tol
        return float(good.mean()), next_delay(e[good])
    o["x_match16"], d16 = match(L16)
    o["x_match_b"], _ = match(BASE)
    o["x_match_drop"] = o["x_match_b"] - o["x_match16"]
    d16 = d16[np.isfinite(d16)]
    if len(d16) >= 3:
        o["x_ptt"] = float(np.median(d16) - D)
        o["x_ptt_iqr"] = float(np.subtract(*np.percentile(d16, [75, 25])))
    re_ = rhythm(te, L10, "e")["e_hr"]
    rp_ = rhythm(tp, L10, "p")["p_hr"]
    if np.isfinite(re_) and np.isfinite(rp_):
        o["x_rate_ratio10"] = re_ / rp_
        o["x_rate_diff10"] = abs(re_ - rp_)
    o["x_count_diff16"] = (np.sum(te >= L16[0]) - np.sum(tp >= L16[0])) / 16 * 60
    return o


def record_features(sig, names, ecg_lead):
    """Features for one record using ONE ECG lead (`ecg_lead`, or 'I*' for derived lead I) + PLETH."""
    if ecg_lead == "I*":
        ecg_raw, _ = lead_I(sig, names)
    elif ecg_lead is None:
        ecg_raw = None
    else:
        ecg_raw = sig[:, names.index(ecg_lead)]
    ppg_raw = sig[:, names.index("PLETH")] if "PLETH" in names else None
    o = {}
    te = tp = None
    if ecg_raw is not None:
        e, te = ecg_block(ecg_raw)
        o.update(e)
    p, tp = ppg_block(ppg_raw)
    o.update(p)
    o.update(cross_block(te, tp))
    return o


# ----------------------------------------------------------------------------- VTaC (external VT dataset)
def load_vtac_window(hea_path, npy_path):
    """VTaC: the 240-300 s window saved as raw int16 + its header -> (physical signals, channel names)."""
    L = [l for l in open(hea_path).read().splitlines() if l and not l.startswith("#")]
    nsig = int(L[0].split()[1])
    raw = np.load(npy_path).astype(float)
    names, sig = [], np.empty_like(raw)
    for j, l in enumerate(L[1:1 + nsig]):
        p = l.split()
        g = p[2].split("/")[0]
        base = 0.0
        if "(" in g:
            g, b = g.split("(")
            base = float(b.rstrip(")"))
        gain = float(g) or 200.0
        col = raw[:, j]
        sig[:, j] = np.where(col == -32768, np.nan, (col - base) / gain)
        names.append(p[-1])
    return sig, names
