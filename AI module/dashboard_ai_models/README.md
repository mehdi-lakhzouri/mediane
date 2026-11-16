# CabinGuard: live in-car detection dashboard

## NestJS / Flutter integration

The `gateway` package now sends signed, versioned detections to the application without exposing the research dashboard. Start with [the integration review](../../docs/AI_INTEGRATION_REVIEW.md) for setup, endpoints, validation, and remaining work.

For the validated Python 3.12 environment, install `requirements.lock`. Run `python -m unittest discover -s tests -v` for the gateway checks. `python -m gateway.replay --help` describes the replay bridge; it reads its signing secret from `CABINGUARD_DEVICE_SECRET`.

Replay is always recorded without actionable incidents. The synthetic fallback scenarios currently fail the prediction-quality gate; `check_scenarios.py` reports those failures and exits nonzero. Use `--smoke` only to check runtime execution, and `--json-report <path>` to save findings. These are research models, and the integration does not establish their accuracy on real drivers.

The dashboard behaves like the system running in the car. When the server starts, it loads
the 4 real models and the recordings. Then it streams the sensor data **row by row at the
real sampling rate**, the way the car sensors would send it. The only choice on the page is
the **scenario** (or **Play all scenarios**). Everything else runs by itself:

1. live signals: ECG and PPG (steering wheel), accelerometer (seat), face points (camera)
2. the **features** of each model, computed live, with their history (sparklines)
3. each model's probability vs its threshold, and its alarm state
4. the final decision (Normal / Cardiac / Seizure + type / Stroke), with a timeline and an event log
5. the pipeline steps (sensors -> preprocessing -> features -> model -> decision) with their time in ms

## 1. Install (once)

You need Python 3.10 or newer (tested with 3.13).

```bash
cd "AI module/dashboard_ai_models"
python -m venv .venv
.venv\Scripts\activate            # Windows   (Linux / Mac: source .venv/bin/activate)
pip install -r requirements.txt
```

`scikit-learn==1.6.1` and `lightgbm==4.6.0` are the versions used on Colab to save the
models. Keep them: with scikit-learn 1.9 the seizure model does not load at all.

## 2. Data (once)

```bash
python get_data.py
```
This downloads the PhysioNet recordings (about 30 MB) into `data/physionet/`. Two more
data sets must be copied by hand:

| What | Where | Used by |
|---|---|---|
| `osdb_3min_allSeizures.json.gz` (Open Seizure Database) | `data/` | the seizure scenarios |
| NeuroFace clips: face landmarks `.npz` (from Daoussar's Drive, `data_processed/landmarks/`) and voice `.wav` files | `data/stroke_clips/` | the camera in every scenario, the stroke scenario |

For the clips, the easiest way is to make them from the raw NeuroFace dataset:

```bash
python make_clips.py "D:\IEEE\CIS EMBS SBJC\tsyp\EMBS\neuroface data"
```
It runs MediaPipe on the videos exactly like Daoussar's notebook (about 1 minute). By a fixed
rule, it takes the first 2 healthy people (N001, N002) and the first 2 post-stroke people
(OP01, OP02), their KISS and SPREAD face videos, and one speech recording (BBP_NORMAL) each.
Use `--people 3` for more. `data/` is in `.gitignore`: NeuroFace is under a licence, so never
publish these files.

To copy clips by hand instead: the file names start with the person code (`N...` = healthy,
`OP...` / `S...` = post-stroke). Use non-speech face tasks (KISS, SPREAD, BROW, OPEN, BLOW) and
one speech `.wav` (NORMAL, PA, PATAKA) per person.

If the data of a scenario is missing, that scenario uses simulated signals
(`pipeline/synthetic.py`). The page then shows a yellow **SIMULATED** badge.

## 3. Run

```bash
python run.py
```
Loading takes about 10-20 s, then the browser opens at http://127.0.0.1:8000.
Choose a scenario and press **Play**, or press **Play all scenarios**. Press Ctrl+C in the
terminal to stop the server.

## 4. Check that every scenario works

```bash
python check_scenarios.py
```
This plays every scenario at full speed through **the same code** as the dashboard (same
sources, same models, same decision), without the browser. It prints:
* the accelerometer format check (OSDB values vs the healthy volunteers' values);
* for each scenario: the expected event, the time of the first correct decision, the delay,
  any other alarm, and the highest probability of each model before / after the event.

The thresholds are the ones saved in the model files. They are never tuned here.

## The scenarios

Inside one sensor, a scenario never joins two people's recordings. The models compare
"now" with the last minute, so a join would itself look like an event.

| Scenario | ECG + PPG (wheel) | Accelerometer (seat) | Face + voice | Event |
|---|---|---|---|---|
| Normal driving | PTT `s3_sit` (healthy volunteer) | same volunteer | healthy clips | none |
| Cardiac: VT / VF / asystole / extreme bradycardia | CinC 2015 `v255l` / `f563l` / `a142s` / `b455l`, from 180 s to the end | PTT `s14_sit` | healthy clips | true ICU alarm (at 2:00) |
| Seizure: tonic-clonic / aura | PTT `s7_sit` | one OSDB event + its heart rate | healthy clips | OSDB `seizureTimes` |
| Stroke | PTT `s10_sit` | same volunteer | healthy clips, then post-stroke clips | first post-stroke clip |

* The CinC records come from the held-out test split of the cardiac notebook (never used
  for training). So do the PTT volunteers (s3, s7, s10, s14). Most CinC records have no
  lead I: lead II is used, and the page says so.
* The OSDB event of each type is picked by a fixed rule in `pipeline/scenarios.py`: the first
  one in the file with at least 60 s before the seizure, a seizure of at least 20 s, and a
  heart rate in at least 80 % of the blocks.
* Accelerometer format: the PTT header says "g", but the values are m/s² (about 9.8 at rest).
  They are divided by 9.81, x1000 -> milli-g, resampled to 25 Hz, then converted to the
  magnitude, like OSDB.

## How it works

```
 SensorSource.read(0.2 s)          every 200 ms (server/car_loop.py)
   ECG, PPG 250 Hz | acc 25 Hz | hr | clip
        |
        |-- to the browser (WebSocket) ........................ live signals
        |
        |-- every 5 s   -> seizure model  (helper process 1) -.
        |-- every 10 s  -> cardiac model  (helper process 2) --+-> decision -> browser
        '-- each clip   -> stroke model   (helper process 3) -'
```

* Each model runs in its **own helper process** (`server/model_workers.py`). The cardiac
  features take about 200 ms, as long as one streaming step. In a separate process they
  never delay the stream, so the page never freezes.
* Heart rate for the seizure model: from the dataset when it has one (OSDB watch),
  otherwise from the steering-wheel PPG (`hr_from_ppg`). There is no wearable in the car.
* Final decision (`pipeline/engine.py`): among the models in alarm, the highest probability
  wins. Near-ties (< 0.02) go to Cardiac > Seizure > Stroke. No alarm -> Normal.

## Next week: the gateway

Open `pipeline/sources.py`, class `GatewaySource`. Only its `read(seconds)` must be written.
It must **wait** until `seconds` of data have arrived, then return:

```python
{"ecg": [...250 * seconds values...],   # 250 Hz
 "ppg": [...250 * seconds values...],   # 250 Hz
 "acc": [...25 * seconds values...],    # 25 Hz, magnitude in milli-g (1000 = gravity)
 "hr": None,                            # None: the heart rate is computed from the PPG
 "clip": None,                          # or a face + voice clip when the camera has one
 "face": []}                            # face points for the screen (optional)
```
Then add a scenario in `pipeline/scenarios.py` whose `make_source` returns `GatewaySource(...)`.
Nothing else changes: same features, models, decision and screen.

## Files

```
run.py                      starts the server and opens the browser
check_scenarios.py          plays every scenario at full speed and prints the results table
get_data.py                 downloads the PhysioNet recordings
make_clips.py               makes the face + voice clips from the raw NeuroFace videos
server/app.py               web server + WebSocket
server/car_loop.py          the car loop (200 ms steps, models at their own pace, decision)
server/model_workers.py     one helper process per model
pipeline/sources.py         SensorSource, RecordingPlayer, GatewaySource, dataset loaders
pipeline/scenarios.py       which recordings make each scenario
pipeline/detectors.py       the 4 models: loading, features -> probability -> alarm rule
pipeline/engine.py          final decision + heart rate from the PPG
pipeline/cardiac_features.py, seizure_features.py, stroke_features.py
                            feature code copied from the notebooks (do not change)
pipeline/synthetic.py       simulated signals (only when real data is missing)
static/                     the page (index.html, style.css, app.js, charts.js)
models/                     the 4 model files from the notebooks
old/                        the previous Streamlit app (not maintained)
```

## Limits (to say honestly)

* The seizure detection model (Ghaya) and the stroke model (Daoussar) were trained on
  **all** their data. The OSDB event and the NeuroFace clips replayed here were part of
  their training, so those scenarios are a demo, not a test. The cardiac scenarios use
  held-out records.
* Seizure type (Kenza): the 7 values per 5 s block are a reconstruction. The script that
  made the training values (`code_modeles_v2`) is not available, so they are **not verified**.
  The page shows this warning.
* The healthy volunteers were sitting, not driving. Their accelerometer is a fingertip sensor,
  while OSDB comes from a wrist watch. The ICU patients are not drivers either.
* The CinC asystole record stops at the alarm: only one model window sees the event.
* The model probabilities are not calibrated on the same scale, so "highest probability wins"
  is a simple rule, not a statistical comparison.
