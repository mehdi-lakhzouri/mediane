# How to put the REAL models in the dashboard

For now the dashboard runs with **demo models** trained on synthetic signals.
To use the team's real models, each notebook must save **one file**. Then copy
the files into the `models/` folder and press **Reset** in the dashboard.

The "Models loaded" tab shows **REAL** or **DEMO** for each model.

| Model | Notebook | File to put in `models/` | What to do |
|---|---|---|---|
| Cardiac | cardiac_arrest_HAJER | `cabinguard_monitor_v3.pkl` | nothing: section 11 already saves it |
| Seizure detection | seizure_detection_model_GHAYA | `seizure_detection_8features.pkl` | nothing: section 9 already saves it |
| Seizure type | Model_type_of_seizure_KENZA | `seizure_type_bundle.pkl` | add cell A below |
| Stroke | stroke_detection_DAOUSSAR | `stroke_bundle.pkl` | add cell B below |

Each notebook writes its file into your Google Drive, in `MyDrive/AI_outputs/<notebook name>/`.
Download it from there.

---

## Cell A: Kenza's notebook (add at the end, after section 3)

```python
# Save the seizure-type model for the dashboard
import pickle
final = clone(modele).fit(X, y)                       # trained on all seizures
bundle = {"model": final, "features": list(X.columns), "classes": CLASSES}
pickle.dump(bundle, open(SORTIES / "seizure_type_bundle.pkl", "wb"))
print("saved:", SORTIES / "seizure_type_bundle.pkl")
```

**Check this before using it.** The 7 values per 5 s block (`acc_ecart_type`,
`acc_puissance_mouvement`…) were computed by the script `code_modeles_v2`, which
is not in the notebook. The dashboard recomputes them in
`pipeline/seizure_features.py` → `kenza_window_features`. These are my best guess
from the column names. Compare them with `code_modeles_v2` and correct that
function if they differ. Otherwise the real model receives wrong numbers.

If the team keeps **model 2** (3 types) instead, save it the same way with
`"classes": ["Tonic-Clonic", "Other", "Aura"]`. The dashboard handles any number of classes.

## Cell B: Daoussar's notebook (add at the very end)

```python
# Save the stroke model (face + voice) for the dashboard
import pickle
bundle = {"face_model": visage_final().fit(X_sp, y_sp), "face_features": colonnes,
          "audio_model": audio_final().fit(X_aud, y_aud), "audio_family": FAMILLE,
          "w_face": 0.7, "threshold": 0.5}
pickle.dump(bundle, open(f"{PROJ}/stroke_bundle.pkl", "wb"))
print("saved:", f"{PROJ}/stroke_bundle.pkl")
```

## Predefined face + voice clips (stroke)

1. In Daoussar's Drive, copy a few files from `AI_outputs/stroke_detection/data_processed/landmarks/`.
   These `.npz` files are the MediaPipe face points, so the dashboard does not need to rerun MediaPipe.
2. Copy the matching `.wav` files from the NeuroFace dataset folder.
3. Put them all in `data/stroke_clips/` and choose **Predefined clips folder** in "1. Data sources".

Pick **non-speech** clips for the face (`KISS`, `SPREAD`, `BROW`, `OPEN`, `BLOW`),
because the face model was trained on those. The voice files only exist for
**speech** tasks (`NORMAL`, `PA`, `PATAKA`). The dashboard pairs each face clip
with a voice file of the **same person** (same code at the start of the name,
e.g. `OP01`). Raw `.avi` videos also work, but MediaPipe then takes about 15 s per clip.

## Library versions

A model saved on Colab must be opened with the **same versions** of
scikit-learn / LightGBM / XGBoost. On Colab, run:

```python
import sklearn, lightgbm, xgboost; print(sklearn.__version__, lightgbm.__version__, xgboost.__version__)
```

Then install exactly those versions on the laptop, e.g. `pip install scikit-learn==1.6.1`.
