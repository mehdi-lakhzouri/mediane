"""Stroke feature extraction (face + voice), from Daoussar's notebook
(stroke_detection_DAOUSSAR.ipynb, cells 11, 13 and 20). Feature code copied without changes.

Face : a clip -> MediaPipe face points (478 per image) -> keep 68 -> align -> 37 asymmetry numbers.
Voice: a speech recording -> 13 MFCC (mean + std) = 26 numbers (or 40-band mel = 80 numbers).

Accepted face inputs:
  * a .npz landmarks file made by the notebook (keys pts, blend, t)  -> fastest, no MediaPipe needed
  * a video file (.avi / .mp4)                                         -> MediaPipe runs first
"""
import os
import urllib.request

import numpy as np

MP68 = [162,234,93,58,172,136,149,148,152,377,378,365,397,288,323,454,389,
        71,63,105,66,107,336,296,334,293,301,168,6,197,195,98,97,2,326,327,
        33,160,158,133,153,144,362,385,387,263,373,380,
        61,40,37,0,267,270,291,321,314,17,84,91,78,81,13,311,308,402,14,178]   # 68 points among the 478
BOUCHE = [(48,54),(49,53),(50,52),(59,55),(58,56),(60,64),(61,63),(67,65)]   # (left, right) pairs
SOURCILS = [(17,26),(18,25),(19,24),(20,23),(21,22)]
BLEND = {"brow_down": (1,2), "brow_outer_up": (4,5), "cheek_squint": (7,8), "eye_blink": (9,10), "eye_squint": (19,20),
         "mouth_dimple": (28,29), "mouth_frown": (30,31), "mouth_press": (36,37), "mouth_smile": (44,45),
         "mouth_stretch": (46,47), "mouth_upper_up": (48,49), "nose_sneer": (50,51), "mouth_lower_down": (34,35)}
AVEC_VITESSE = ["mouth_width", "mouth_open", "brow_to_eye", "corner_to_nose"]
dist = lambda a, b: np.linalg.norm(a - b, axis=-1)


def aligner(p):                                            # p : (images, 68 points, 2)
    centre = (p[:, 36] + p[:, 45]) / 2
    yeux = p[:, 45] - p[:, 36]
    angle = -np.arctan2(yeux[:, 1], yeux[:, 0])
    q = p - centre[:, None, :]
    x = q[..., 0] * np.cos(angle)[:, None] - q[..., 1] * np.sin(angle)[:, None]
    y = q[..., 0] * np.sin(angle)[:, None] + q[..., 1] * np.cos(angle)[:, None]
    return np.stack([x, y], -1) / np.linalg.norm(yeux, axis=1)[:, None, None]


def asymetrie(p, paires):                                  # left point vs mirror of its right twin
    milieu = (p[:, 27, 0] + p[:, 8, 0]) / 2
    return np.mean([dist(p[:, g], np.stack([2 * milieu - p[:, d, 0], p[:, d, 1]], -1)) for g, d in paires], axis=0)


def mesures_par_image(p):
    oeil_g, oeil_d = p[:, 36:42].mean(1), p[:, 42:48].mean(1)
    milieu = (p[:, 27, 0] + p[:, 8, 0]) / 2
    return {"asym_mouth": asymetrie(p, BOUCHE), "asym_brows": asymetrie(p, SOURCILS),
            "mouth_tilt": np.abs(p[:, 54, 1] - p[:, 48, 1]),
            "mouth_hshift": np.abs((p[:, 48, 0] + p[:, 54, 0]) / 2 - milieu),
            "corner_diff": np.abs(dist(p[:, 48], p[:, 33]) - dist(p[:, 54], p[:, 33])),
            "brow_diff": np.abs(dist(p[:, 19], oeil_g) - dist(p[:, 24], oeil_d)),
            "brow_to_eye": (dist(p[:, 19], oeil_g) + dist(p[:, 24], oeil_d)) / 2,
            "corner_to_nose": (dist(p[:, 48], p[:, 33]) + dist(p[:, 54], p[:, 33])) / 2,
            "mouth_width": dist(p[:, 48], p[:, 54]), "mouth_open": dist(p[:, 62], p[:, 66])}


def resumer(p, blend, t):                                  # one row of numbers for the whole clip
    out = {}
    for nom, v in mesures_par_image(p).items():
        out[f"{nom}_med"] = np.nanmedian(v)
        out[f"{nom}_rom"] = np.nanpercentile(v, 95) - np.nanpercentile(v, 5)
        if nom in AVEC_VITESSE: out[f"{nom}_speed"] = np.nanmedian(np.abs(np.diff(v)) / np.diff(t))
    for nom, (g, d) in BLEND.items():
        out[f"bs_{nom}_asym"] = abs(np.nanpercentile(blend[:, g], 90) - np.nanpercentile(blend[:, d], 90))
    return out


FACE_FEATURES = list(resumer(np.random.rand(5, 68, 2), np.random.rand(5, 52), np.arange(5.0)).keys())


def face_features_from_landmarks(pts, blend, t):
    """pts: (images, 478 or 68, 2 or 3). Returns (features dict, aligned 68 points)."""
    pts = np.asarray(pts, float)
    if pts.shape[1] == 478:
        pts = pts[:, MP68, :]
    p = aligner(pts[..., :2])
    return resumer(p, np.asarray(blend, float), np.asarray(t, float)), p


# ----------------------------------------------------------------------------- video -> landmarks (MediaPipe)
_DETECTOR = None
MP_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"


def _detector(model_path):
    global _DETECTOR
    if _DETECTOR is None:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision
        if not os.path.exists(model_path):
            os.makedirs(os.path.dirname(model_path) or ".", exist_ok=True)
            urllib.request.urlretrieve(MP_MODEL_URL, model_path)
        _DETECTOR = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=model_path),
            running_mode=vision.RunningMode.IMAGE, num_faces=1, output_face_blendshapes=True))
    return _DETECTOR


def landmarks_from_video(path, model_path="models/face_landmarker.task", pas=2):
    """Same as `extraire` in the notebook: MediaPipe on one image out of two."""
    import cv2
    import mediapipe as mp
    det = _detector(model_path)
    video = cv2.VideoCapture(path); fps = video.get(cv2.CAP_PROP_FPS) or 30
    points, blend, temps, n = [], [], [], 0
    while True:
        ok, image = video.read()
        if not ok: break
        if n % pas == 0:
            r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(image, cv2.COLOR_BGR2RGB)))
            h, w = image.shape[:2]
            if r.face_landmarks:
                points.append([[q.x * w, q.y * h, q.z * w] for q in r.face_landmarks[0]])
                blend.append([b.score for b in r.face_blendshapes[0]])
            else:
                points.append(np.full((478, 3), np.nan)); blend.append(np.full(52, np.nan))
            temps.append(n / fps)
        n += 1
    video.release()
    return np.array(points, float), np.array(blend, float), np.array(temps)


# ----------------------------------------------------------------------------- voice
AUDIO_SR = 16000


def f_mfcc(son, sr):                                       # 13 MFCC -> mean + std = 26 numbers
    import librosa
    m = librosa.feature.mfcc(y=son, sr=sr, n_mfcc=13)
    return np.r_[m.mean(axis=1), m.std(axis=1)]


def f_mel(son, sr):                                        # 40 bands -> mean + std = 80 numbers
    import librosa
    m = librosa.power_to_db(librosa.feature.melspectrogram(y=son, sr=sr, n_mels=40))
    return np.r_[m.mean(axis=1), m.std(axis=1)]


def load_audio(path):
    import librosa
    return librosa.load(path, sr=AUDIO_SR, mono=True, duration=30)[0]
