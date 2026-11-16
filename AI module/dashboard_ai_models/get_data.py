"""Downloads the PhysioNet recordings used by the scenarios into data/physionet/ (about 30 MB, once).

Run:  python get_data.py

Files already on disk are skipped. The two other data sets are NOT downloaded here (put them by hand):
  data/osdb_3min_allSeizures.json.gz   (Open Seizure Database, seizure scenarios)
  data/stroke_clips/                   (NeuroFace face landmarks .npz + voice .wav, stroke scenario)
"""
import os
import sys
import urllib.request

from pipeline.scenarios import CINC_RECORDS, PHYSIONET_DIR, PTT_RECORDS

CINC_URL = "https://physionet.org/files/challenge-2015/1.0.0/training"
PTT_URL = "https://physionet.org/files/pulse-transit-time-ppg/1.1.0"


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        print(f"  already here  {os.path.basename(path)}")
        return
    tmp = path + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, path)
    print(f"  downloaded    {os.path.basename(path)} ({os.path.getsize(path) / 1e6:.1f} MB)")


def main():
    cinc_dir, ptt_dir = os.path.join(PHYSIONET_DIR, "cinc2015"), os.path.join(PHYSIONET_DIR, "ptt")
    os.makedirs(cinc_dir, exist_ok=True)
    os.makedirs(ptt_dir, exist_ok=True)
    print("CinC 2015 (ICU alarms, cardiac scenarios) ->", cinc_dir)
    download(f"{CINC_URL}/ALARMS", os.path.join(cinc_dir, "ALARMS"))
    for rec in CINC_RECORDS.values():
        for ext in ("hea", "mat"):
            download(f"{CINC_URL}/{rec}.{ext}", os.path.join(cinc_dir, f"{rec}.{ext}"))
    print("Pulse Transit Time PPG (healthy volunteers, sitting) ->", ptt_dir)
    for rec in PTT_RECORDS.values():
        for ext in ("hea", "dat"):
            download(f"{PTT_URL}/{rec}.{ext}", os.path.join(ptt_dir, f"{rec}.{ext}"))
    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        sys.exit(f"Download failed ({e}). Check the internet connection and run again.")
