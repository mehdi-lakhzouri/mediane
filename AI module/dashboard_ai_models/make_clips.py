"""Makes the face + voice clips of the dashboard from the raw NeuroFace dataset (once).

Run:  python make_clips.py "D:\\...\\neuroface data"

For each chosen video it runs MediaPipe exactly like Daoussar's notebook (`extraire`: one image
out of two, 478 points + 52 blendshapes) and saves data/stroke_clips/<name>.npz. It also copies
one speech recording (.wav) per person. Fixed choice (never based on the model's answers):
the first PEOPLE healthy people (N...) and the first PEOPLE post-stroke people (OP.../S...),
sorted by code, face tasks KISS and SPREAD, voice task BBP_NORMAL.
"""
import argparse
import glob
import os
import shutil
import sys

import numpy as np

from pipeline.scenarios import CLIPS_DIR
from pipeline.stroke_features import landmarks_from_video

TASKS = ["KISS", "SPREAD"]          # non-speech tasks: the face model was trained on these
VOICE = "BBP_NORMAL"                # speech task for the voice model


def people(folder):
    videos = glob.glob(os.path.join(folder, "**", "*_color.avi"), recursive=True)
    return sorted({os.path.basename(v).split("_")[0] for v in videos})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("neuroface", help="folder with 'Healthy controls' and 'Stroke'")
    ap.add_argument("--people", type=int, default=2, help="people per group (default 2)")
    args = ap.parse_args()
    os.makedirs(CLIPS_DIR, exist_ok=True)
    for group in ["Healthy controls", "Stroke"]:
        folder = os.path.join(args.neuroface, group)
        if not os.path.isdir(folder):
            sys.exit(f"Folder not found: {folder}")
        for person in people(folder)[:args.people]:
            for task in TASKS:
                video = glob.glob(os.path.join(folder, "Videos", "**", f"{person}_*_NSM_{task}_color.avi"), recursive=True)
                if not video:
                    print(f"  {person} {task}: no video, skipped")
                    continue
                name = os.path.basename(video[0]).replace("_color.avi", "")
                out = os.path.join(CLIPS_DIR, name + ".npz")
                if os.path.exists(out):
                    print(f"  already here  {name}.npz")
                    continue
                pts, blend, t = landmarks_from_video(video[0])
                np.savez_compressed(out, pts=pts.astype(np.float32), blend=blend.astype(np.float32), t=t)
                found = np.isfinite(pts[:, 0, 0]).mean()
                print(f"  made          {name}.npz ({len(t)} images, face found in {found:.0%})")
            wav = [w for w in glob.glob(os.path.join(folder, "Audios", "**", f"{person}_*"), recursive=True)
                   if VOICE in os.path.basename(w).upper() and w.lower().endswith(".wav")]
            if wav:
                dest = os.path.join(CLIPS_DIR, os.path.splitext(os.path.basename(wav[0]))[0] + ".wav")
                if not os.path.exists(dest):
                    shutil.copyfile(wav[0], dest)
                print(f"  voice         {os.path.basename(dest)}")
            else:
                print(f"  {person}: no {VOICE} recording (face only)")
    print("Clips folder:", CLIPS_DIR)


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    main()
