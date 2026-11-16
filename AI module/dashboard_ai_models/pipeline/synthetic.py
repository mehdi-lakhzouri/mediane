"""Synthetic sensors: realistic-looking signals for each driving scenario.

This replaces the real sensors until the gateway is ready. Every call to `read(5)`
returns the next 5 seconds of every sensor, exactly like the gateway will:

    ecg : 1250 values (250 Hz, steering-wheel lead I)
    ppg : 1250 values (250 Hz, steering-wheel PPG)
    acc : 125 values  (25 Hz, seat / wheel accelerometer magnitude)
    clip: every `clip_every_s` seconds, one face + voice clip (stroke model input)

The signals are simple physiological models (beat templates, pulse waves, rhythmic
shaking...). They are good enough to exercise the full pipeline and the models,
NOT to evaluate the models: always use real recordings for numbers in the paper.
"""
import numpy as np

FS_CARD = 250
FS_ACC = 25

# ----------------------------------------------------------------------------- scenarios
# Each scenario = what the driver's body does once the event starts.
SCENARIOS = {
    "Normal driving":                 dict(rhythm="sinus", hr=72, motion="drive", stroke=0.0, group="Normal"),
    "Stressed driver (tachycardia)":  dict(rhythm="sinus", hr=135, motion="drive", stroke=0.0, group="Normal"),
    "Bumpy road (motion artefact)":   dict(rhythm="sinus", hr=80, motion="bumpy", stroke=0.0, group="Normal"),
    "Cardiac: ventricular tachycardia (VT)": dict(rhythm="vt", hr=185, motion="drive", stroke=0.0, group="Cardiac"),
    "Cardiac: ventricular fibrillation (VF)": dict(rhythm="vf", hr=0, motion="slump", stroke=0.0, group="Cardiac"),
    "Cardiac: asystole":              dict(rhythm="asystole", hr=0, motion="slump", stroke=0.0, group="Cardiac"),
    "Cardiac: extreme bradycardia":   dict(rhythm="sinus", hr=32, motion="drive", stroke=0.0, group="Cardiac"),
    "Seizure: tonic-clonic":          dict(rhythm="sinus", hr=125, motion="tonic_clonic", stroke=0.0, group="Seizure"),
    "Seizure: aura":                  dict(rhythm="sinus", hr=92, motion="aura", stroke=0.0, group="Seizure"),
    "Stroke: facial droop + slurred speech": dict(rhythm="sinus", hr=84, motion="drive", stroke=0.8, group="Stroke"),
}
BASELINE = SCENARIOS["Normal driving"]


# ----------------------------------------------------------------------------- face template (68 points)
def face_template():
    """A neutral 68-point face (same numbering as the dlib / iBUG scheme used by the notebook)."""
    p = np.zeros((68, 2))
    th = np.pi - np.arange(17) * np.pi / 16                      # jaw 0-16
    p[:17] = np.c_[np.cos(th), 0.1 + 1.1 * np.sin(th)]
    bx = np.linspace(-0.85, -0.2, 5)                             # brows 17-21 and 22-26
    p[17:22] = np.c_[bx, -0.55 - 0.12 * np.sin(np.linspace(0.3, np.pi - 0.3, 5))]
    p[22:27] = np.c_[-bx[::-1], p[17:22, 1][::-1]]
    p[27:31] = np.c_[np.zeros(4), np.linspace(-0.35, 0.15, 4)]   # nose bridge
    p[31:36] = np.c_[np.linspace(-0.2, 0.2, 5), [0.25, 0.28, 0.3, 0.28, 0.25]]
    for c, idx in [(-0.45, range(36, 42)), (0.45, range(42, 48))]:   # eyes
        a = np.linspace(np.pi, -np.pi, 7)[:6] if c < 0 else np.linspace(np.pi, -np.pi, 7)[:6]
        p[list(idx)] = np.c_[c + 0.15 * np.cos(a), -0.3 - 0.05 * np.sin(a)]
    a = np.pi - np.arange(12) * 2 * np.pi / 12                   # mouth outer 48-59
    p[48:60] = np.c_[0.4 * np.cos(a), 0.62 - 0.12 * np.sin(a)]
    a = np.pi - np.arange(8) * 2 * np.pi / 8                     # mouth inner 60-67
    p[60:68] = np.c_[0.3 * np.cos(a), 0.62 - 0.05 * np.sin(a)]
    return p


LEFT_MOUTH = [48, 49, 50, 58, 59, 60, 61, 67]                    # image-left half of the mouth
RIGHT_MOUTH = [52, 53, 54, 55, 56, 63, 64, 65]
RIGHT_BROW = list(range(22, 27))


class SyntheticSensors:
    """Generates all sensor streams for one scenario, with an onset delay."""

    def __init__(self, scenario="Normal driving", onset_s=30, clip_every_s=30, seed=0, overrides=None):
        self.rng = np.random.default_rng(seed)
        self.scenario, self.onset_s, self.clip_every_s = scenario, onset_s, clip_every_s
        self.overrides = overrides or {}
        self.t = 0.0                      # seconds of signal already produced
        self.beats = []                   # recent beat times (s) with their type
        self.next_beat = 0.4
        self.vf_phase = 0.0
        self.next_clip = clip_every_s
        self.template = face_template()
        # every simulated driver is a bit different (makes the task less trivial for the models)
        self.var = dict(hr_scale=self.rng.uniform(0.85, 1.15), noise=self.rng.uniform(0.5, 2.5),
                        intensity=self.rng.uniform(0.35, 1.2), moves=self.rng.uniform(0.0, 1.0))

    # -- which body state applies at time t
    def state(self, t):
        s = dict(BASELINE)
        if t >= self.onset_s:
            s = dict(SCENARIOS[self.scenario])
        s.update(self.overrides if t >= self.onset_s else {})
        return s

    # ------------------------------------------------------------------ ECG + PPG
    def _schedule_beats(self, t_end):
        while self.next_beat < t_end:
            st = self.state(self.next_beat)
            if st["rhythm"] in ("sinus", "vt") and st["hr"] > 0:
                self.beats.append((self.next_beat, st["rhythm"]))
                rr = 60.0 / (st["hr"] * self.var["hr_scale"])
                jitter = 0.04 if st["rhythm"] == "sinus" else 0.01
                self.next_beat += rr * (1 + jitter * self.rng.standard_normal())
            else:
                self.next_beat += 0.25        # no beat: check again a bit later
        self.beats = [b for b in self.beats if b[0] > self.t - 2]

    @staticmethod
    def _g(t, mu, w, a):
        return a * np.exp(-((t - mu) / w) ** 2)

    def _ecg_ppg(self, n_sec):
        t = self.t + np.arange(int(n_sec * FS_CARD)) / FS_CARD
        self._schedule_beats(t[-1] + 1)
        ecg, ppg = np.zeros_like(t), np.zeros_like(t)
        for bt, kind in self.beats:
            m = np.abs(t - bt) < 1.0
            if not m.any():
                continue
            tt = t[m]
            if kind == "sinus":
                ecg[m] += (self._g(tt, bt - 0.18, 0.025, 0.12) + self._g(tt, bt - 0.03, 0.01, -0.12)
                           + self._g(tt, bt, 0.012, 1.0) + self._g(tt, bt + 0.03, 0.012, -0.25)
                           + self._g(tt, bt + 0.26, 0.05, 0.3))
                pulse = 1.0
            else:                                         # VT: wide, tall, bizarre complexes
                ecg[m] += self._g(tt, bt, 0.045, 1.6) + self._g(tt, bt + 0.12, 0.05, -0.7)
                pulse = 0.18                              # very weak pulse
            mp = np.abs(t - bt - 0.6) < 1.2
            tp = t[mp]
            ppg[mp] += pulse * (self._g(tp, bt + 0.28, 0.09, 1.0) + self._g(tp, bt + 0.55, 0.08, 0.3))
        # VF: chaotic 4-6 Hz waves, no pulse
        vf = np.array([self.state(x)["rhythm"] == "vf" for x in t])
        if vf.any():
            f = 5 + 0.8 * np.sin(2 * np.pi * 0.2 * t)
            ph = self.vf_phase + 2 * np.pi * np.cumsum(f) / FS_CARD
            ecg += vf * (0.5 + 0.3 * np.sin(2 * np.pi * 0.3 * t)) * np.sin(ph)
            self.vf_phase = ph[-1]
        # noise, baseline wander, motion artefacts
        st = self.state(t[-1])
        nz = self.var["noise"]
        ecg += 0.02 * nz * self.rng.standard_normal(len(t)) + 0.08 * np.sin(2 * np.pi * 0.25 * t)
        ppg += 0.015 * nz * self.rng.standard_normal(len(t)) + 0.05 * np.sin(2 * np.pi * 0.2 * t)
        if st["motion"] in ("bumpy", "tonic_clonic"):
            k = 0.25 if st["motion"] == "bumpy" else 0.4
            art = np.convolve(self.rng.standard_normal(len(t)), np.ones(25) / 5, "same")
            ecg += k * art
            ppg += 0.5 * k * art
        return ecg, ppg

    # ------------------------------------------------------------------ accelerometer
    def _acc(self, n_sec):
        t = self.t + np.arange(int(n_sec * FS_ACC)) / FS_ACC
        out = 1.0 + 0.015 * self.var["noise"] * self.rng.standard_normal(len(t))   # gravity + sensor noise
        out += 0.03 * np.sin(2 * np.pi * 0.4 * t + self.rng.uniform(0, 6))       # steering / body sway
        if self.rng.random() < 0.15 * self.var["moves"]:                        # normal arm movement
            f = self.rng.uniform(0.8, 3.5)
            out += self.rng.uniform(0.05, 0.3) * np.sin(2 * np.pi * f * t) * np.hanning(len(t))
        st = self.state(t[-1])
        k = self.var["intensity"]
        since = max(t[0] - self.onset_s, 0)
        if st["motion"] == "bumpy":
            bumps = self.rng.random(len(t)) < 0.06
            out += np.convolve(bumps * self.rng.normal(0, 0.35, len(t)), np.exp(-np.arange(8) / 2), "same")
        elif st["motion"] == "tonic_clonic":
            ramp = min(1.0, (since + 2) / 10)
            f = max(6.0 - since / 30, 3.0)                              # clonic jerks slow down
            out += k * ramp * 0.6 * np.sin(2 * np.pi * f * t) * (1 + 0.3 * self.rng.standard_normal(len(t)))
            out += 0.1 * k * ramp * self.rng.standard_normal(len(t))
        elif st["motion"] == "aura":
            out += k * 0.08 * np.sin(2 * np.pi * 1.5 * t) + 0.02 * self.rng.standard_normal(len(t))
        elif st["motion"] == "slump":
            out += 0.0                                                  # unconscious: almost no movement
            out = 1.0 + 0.005 * self.rng.standard_normal(len(t))
        return out

    # ------------------------------------------------------------------ face + voice clip
    def make_clip(self, stroke):
        """One face clip (68 points + 52 blendshapes) and one voice clip, like a NeuroFace recording."""
        fps, dur = 15, 8
        tt = np.arange(fps * dur) / fps
        n = len(tt)
        smile = np.clip(np.sin(2 * np.pi * tt / 4), 0, None)            # smile twice
        opn = np.clip(np.sin(2 * np.pi * tt / 4 + np.pi), 0, None)      # open mouth in between
        brow = np.clip(np.sin(2 * np.pi * tt / 2.7), 0, None) * 0.5
        weak = 1 - 0.75 * stroke                                       # right side moves less
        pts = np.repeat(self.template[None], n, 0).copy()
        for side, k in [(LEFT_MOUTH, 1.0), (RIGHT_MOUTH, weak)]:
            sign = np.sign(pts[0, side, 0])[None, :]
            pts[:, side, 0] += (0.08 * k * smile)[:, None] * sign
            pts[:, side, 1] -= (0.05 * k * smile)[:, None]
        pts[:, RIGHT_MOUTH, 1] += 0.09 * stroke                         # drooping corner
        pts[:, RIGHT_BROW, 1] += 0.06 * stroke
        low = [55, 56, 57, 58, 59, 65, 66, 67]
        pts[:, low, 1] += (0.15 * opn)[:, None]
        pts[:, 17:22, 1] -= (0.08 * brow)[:, None]
        pts[:, 22:27, 1] -= (0.08 * brow * weak)[:, None]
        pts[:, 48:68, 0] += self.rng.normal(0, 0.03)                     # natural, healthy asymmetry
        pts += 0.012 * self.rng.standard_normal(pts.shape)
        ang = 0.05 * np.sin(2 * np.pi * tt / 6)                         # small head motion, removed by alignment
        rot = np.stack([np.c_[np.cos(ang), -np.sin(ang)], np.c_[np.sin(ang), np.cos(ang)]], 1)
        pts = np.einsum("nij,nkj->nki", rot, pts) * 120 + 300
        blend = np.abs(0.03 * self.rng.standard_normal((n, 52)))
        for left, right, sig in [(44, 45, smile), (4, 5, brow), (7, 8, smile * 0.6), (46, 47, opn * 0.5), (34, 35, opn)]:
            blend[:, left] += 0.8 * sig
            blend[:, right] += 0.8 * sig * weak
        blend[:, 31] += 0.4 * stroke                                    # mouth frown, one side
        # voice: "pa-ta-ka" style syllables; stroke = slower, shakier, breathier
        sr, vd = 16000, 4.0
        ts = np.arange(int(sr * vd)) / sr
        rate = 5.5 - 2.5 * stroke
        f0 = 125 * (1 + (0.01 + 0.06 * stroke) * self.rng.standard_normal(len(ts)).cumsum() / 400)
        ph = 2 * np.pi * np.cumsum(f0) / sr
        voice = sum(np.sin(k * ph) / k for k in range(1, 12))
        env = 0.5 * (1 + np.sin(2 * np.pi * rate * ts)) ** (2 - 1.2 * stroke)
        voice = voice * env + (0.05 + 0.4 * stroke) * self.rng.standard_normal(len(ts)) * env
        voice = np.convolve(voice, [1, 0.6, 0.3], "same")
        voice /= np.abs(voice).max() + 1e-9
        return {"pts": pts, "blend": blend, "t": tt, "audio": voice.astype(np.float32), "sr": sr,
                "label": f"synthetic clip (stroke level {stroke:.1f})"}

    # ------------------------------------------------------------------ public
    def read(self, n_sec=5):
        ecg, ppg = self._ecg_ppg(n_sec)
        acc = self._acc(n_sec)
        clip = None
        if self.t + n_sec >= self.next_clip:
            clip = self.make_clip(self.state(self.t + n_sec)["stroke"])
            self.next_clip += self.clip_every_s
        self.t += n_sec
        return {"t_end": self.t, "ecg": ecg, "ppg": ppg, "acc": acc, "hr_motion": None, "clip": clip,
                "truth": self.state(self.t - 0.01)["group"]}
