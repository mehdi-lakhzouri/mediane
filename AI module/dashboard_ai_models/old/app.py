"""Mediane / CabinGuard-ADI: detection dashboard.

Run:  streamlit run app.py
"""
import os
os.environ.setdefault("OMP_NUM_THREADS", "1")   # one thread per model: steadier timing in a real-time loop
import glob
import re
import warnings

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from pipeline.engine import Engine, TICK_S
from pipeline.sources import CardiacReplay, MixedSource, SeizureReplay, StrokeClips, list_osdb_events
from pipeline.synthetic import SCENARIOS, SyntheticSensors

warnings.filterwarnings("ignore")
st.set_page_config(page_title="Mediane: detection dashboard", page_icon="🚗", layout="wide")

COLORS = {"Normal": "#1e8e3e", "Cardiac": "#c5221f", "Seizure": "#e37400", "Stroke": "#7b1fa2"}
SPEEDS = {"Real time (1 step every 5 s)": 5.0, "x5 (1 step per second)": 1.0, "x25 (fast)": 0.2}


def color_of(state):
    return next((c for k, c in COLORS.items() if state.startswith(k)), "#5f6368")


# ============================================================================= sidebar: sources and scenario
st.sidebar.title("Controls")

with st.sidebar.expander("1. Data sources", expanded=False):
    st.caption("Each sensor group can be simulated or replayed from real dataset files on this laptop.")
    card_mode = st.radio("ECG + PPG (steering wheel)", ["Synthetic", "Replay a WFDB record"], key="card_mode")
    card_path = st.text_input("Record path without extension (e.g. data/cinc/v131l)", key="card_path") \
        if card_mode != "Synthetic" else None
    mot_mode = st.radio("Accelerometer (seat / wheel)", ["Synthetic", "Replay an OSDB event"], key="mot_mode")
    mot_path, mot_idx = None, 0
    if mot_mode != "Synthetic":
        mot_path = st.text_input("OSDB file (osdb_3min_allSeizures.json or .json.gz)", key="mot_path")
        mot_idx = st.number_input("Event number in the file", 0, 100000, 0, key="mot_idx")
    face_mode = st.radio("Face + voice (camera, microphone)", ["Synthetic", "Predefined clips folder"], key="face_mode")
    face_dir = st.text_input("Folder with .npz / .avi clips and .wav files", "data/stroke_clips", key="face_dir") \
        if face_mode != "Synthetic" else None

scenario = st.sidebar.selectbox("2. Scenario", list(SCENARIOS), key="scenario",
                                help="What happens to the driver when the event starts.")
onset = st.sidebar.slider("Event starts after (s)", 0, 180, 60, 5, key="onset",
                          help="Normal driving first, then the event. The cardiac model needs 60 s of signal before its first answer.")
with st.sidebar.expander("Manual control (optional)"):
    st.caption("Overrides the scenario once the event has started.")
    use_manual = st.checkbox("Use manual values", key="use_manual")
    man_hr = st.slider("Heart rate (bpm)", 0, 220, 75, key="man_hr")
    man_rhythm = st.selectbox("Heart rhythm", ["sinus", "vt", "vf", "asystole"], key="man_rhythm",
                              help="sinus = normal beat shape; vt = ventricular tachycardia; vf = fibrillation; asystole = no beat")
    man_motion = st.selectbox("Body movement", ["drive", "bumpy", "aura", "tonic_clonic", "slump"], key="man_motion")
    man_stroke = st.slider("Face / voice stroke signs (0 = none, 1 = strong)", 0.0, 1.0, 0.0, 0.1, key="man_stroke")
speed = st.sidebar.selectbox("3. Speed", list(SPEEDS), index=1, key="speed")


def build_engine():
    overrides = dict(hr=man_hr, rhythm=man_rhythm, motion=man_motion, stroke=man_stroke) if use_manual else None
    syn = SyntheticSensors(scenario, onset_s=onset, seed=np.random.randint(1_000_000), overrides=overrides)
    cardiac = motion = stroke = None
    if card_mode != "Synthetic" and card_path:
        cardiac = CardiacReplay(card_path)
    if mot_mode != "Synthetic" and mot_path:
        motion = SeizureReplay(list_osdb_events(mot_path)[int(mot_idx)])
    if face_mode != "Synthetic" and face_dir:
        files = sorted(glob.glob(os.path.join(face_dir, "*.npz")) + glob.glob(os.path.join(face_dir, "*.avi"))
                       + glob.glob(os.path.join(face_dir, "*.mp4")))
        key = lambda p: re.sub(r"(_color|_gt)$", "", os.path.splitext(os.path.basename(p))[0])
        wavs = {key(w): w for w in glob.glob(os.path.join(face_dir, "*.wav"))}
        if not files:
            raise FileNotFoundError(f"No .npz / .avi / .mp4 clip in {face_dir}")
        def voice_for(f):            # same clip name first, otherwise any speech clip of the same person
            k = key(f)
            return wavs.get(k) or next((w for kk, w in sorted(wavs.items()) if kk.split("_")[0] == k.split("_")[0]), None)
        stroke = StrokeClips([{"face": f, "audio": voice_for(f)} for f in files])
    return Engine(MixedSource(syn, cardiac, motion, stroke))


c1, c2 = st.sidebar.columns(2)
if c1.button("▶ Start", use_container_width=True):
    if "engine" not in st.session_state:
        try:
            st.session_state.engine = build_engine()
        except Exception as e:
            st.sidebar.error(f"Could not open the data source: {e}")
    st.session_state.running = "engine" in st.session_state
if c2.button("⏸ Pause", use_container_width=True):
    st.session_state.running = False
if st.sidebar.button("↺ Reset (apply new settings)", use_container_width=True):
    st.session_state.pop("engine", None)
    st.session_state.pop("last", None)
    st.session_state.running = False
st.sidebar.caption("Changed the sources, the scenario or the manual values? Press Reset, then Start.")

# ============================================================================= header
st.title("Mediane: in-cabin medical event detection")
st.caption("Sensors -> preprocessing -> 4 models -> decision. One loop step = 5 s of driving.")


def card(col, title, r, extra=""):
    with col:
        if r is None:
            st.markdown(f"**{title}**")
            st.markdown("<span style='color:#5f6368'>waiting for data…</span>", unsafe_allow_html=True)
            return
        on = r["alarm"]
        c = "#c5221f" if on else "#1e8e3e"
        st.markdown(f"**{title}**")
        st.markdown(f"<div style='font-size:30px;font-weight:700;color:{c}'>{r['p']:.2f}</div>"
                    f"<div style='color:{c};font-weight:600'>{'ALARM' if on else 'no alarm'}</div>"
                    f"<div style='color:#5f6368;font-size:13px'>threshold {r['threshold']:.2f}{extra}</div>",
                    unsafe_allow_html=True)


def line_chart(y, fs, seconds, title, color, height=170):
    y = np.asarray(y)[-int(seconds * fs):]
    x = np.arange(len(y)) / fs - len(y) / fs
    fig = go.Figure(go.Scatter(x=x, y=y, mode="lines", line=dict(color=color, width=1.2)))
    fig.update_layout(title=dict(text=title, font=dict(size=13)), height=height, margin=dict(l=10, r=10, t=30, b=10),
                      xaxis_title="seconds (0 = now)", showlegend=False)
    return fig


@st.fragment(run_every=SPEEDS[speed] if st.session_state.get("running") else None)
def live():
    eng = st.session_state.get("engine")
    if eng is None:
        st.info("Choose a scenario in the left panel, then press **Start**.")
        return
    if st.session_state.get("running"):
        st.session_state.last = eng.tick()
    out = st.session_state.get("last")
    if out is None:
        st.info("Ready. Press **Start**.")
        return
    dec = out["decision"]
    truth = out["row"]["truth"]

    # ---- final decision banner
    col = color_of(dec["state"])
    st.markdown(
        f"<div style='background:{col};color:white;padding:14px 20px;border-radius:10px;display:flex;"
        f"justify-content:space-between;align-items:center'>"
        f"<div><div style='font-size:14px;opacity:.85'>FINAL STATE</div>"
        f"<div style='font-size:32px;font-weight:800'>{dec['state'].upper()}</div></div>"
        f"<div style='text-align:right'><div style='font-size:14px;opacity:.85'>confidence</div>"
        f"<div style='font-size:28px;font-weight:700'>{dec['confidence']:.2f}</div></div>"
        f"<div style='text-align:right'><div style='font-size:14px;opacity:.85'>time</div>"
        f"<div style='font-size:28px;font-weight:700'>{eng.t} s</div></div></div>", unsafe_allow_html=True)
    if truth:
        st.caption(f"Simulation truth right now: **{truth}** · decision rule: among the models in alarm, "
                   f"the highest confidence wins · loop step computed in {out['row']['loop_ms']:.0f} ms")

    # ---- model cards
    L = eng.last
    k1, k2, k3, k4 = st.columns(4)
    card(k1, "❤️ Cardiac (ECG + PPG)", L["Cardiac"])
    card(k2, "⚡ Seizure detection (motion + HR)", L["Seizure"])
    with k3:
        s = L["Seizure"]
        st.markdown("**🧭 Seizure type**")
        if s and s.get("type"):
            st.markdown(f"<div style='font-size:30px;font-weight:700;color:#e37400'>{s['type']}</div>"
                        f"<div style='color:#5f6368;font-size:13px'>probability {s['p_type']:.2f}</div>",
                        unsafe_allow_html=True)
        else:
            st.markdown("<span style='color:#5f6368'>runs only during a detected seizure</span>", unsafe_allow_html=True)
    extra = ""
    if L["Stroke"]:
        pv = L["Stroke"]["p_voice"]
        extra = f"<br>face {L['Stroke']['p_face']:.2f}" + (f" · voice {pv:.2f}" if pv is not None else " · no voice")
    card(k4, "🙂 Stroke (face + voice)", L["Stroke"], extra)

    tabs = st.tabs(["📈 Live signals", "📊 Model outputs over time", "⚙️ Pipeline steps", "📝 Event log",
                    "🔢 Features", "📦 Models loaded"])

    with tabs[0]:
        a, b = st.columns(2)
        a.plotly_chart(line_chart(eng.ecg, 250, 10, "ECG, steering wheel (last 10 s)", "#c5221f"), use_container_width=True)
        b.plotly_chart(line_chart(eng.ppg, 250, 10, "PPG pulse, steering wheel (last 10 s)", "#1a73e8"), use_container_width=True)
        a, b = st.columns(2)
        a.plotly_chart(line_chart(eng.acc, 25, 30, "Accelerometer, seat / wheel (last 30 s)", "#e37400"), use_container_width=True)
        if L["Stroke"] is not None:
            p = L["Stroke"]["aligned"]
            fr = p[len(p) // 4]
            fig = go.Figure(go.Scatter(x=fr[:, 0], y=-fr[:, 1], mode="markers", marker=dict(size=6, color="#7b1fa2")))
            mid = (fr[27, 0] + fr[8, 0]) / 2
            fig.add_vline(x=mid, line_dash="dash", line_color="red")
            fig.update_layout(title=dict(text=f"Face points after alignment, red = middle line ({L['Stroke']['clip']})",
                                         font=dict(size=13)), height=260, margin=dict(l=10, r=10, t=30, b=10),
                              yaxis=dict(scaleanchor="x", visible=False), xaxis=dict(visible=False))
            b.plotly_chart(fig, use_container_width=True)
        else:
            b.info("Face + voice: first clip after 30 s.")

    with tabs[1]:
        H = pd.DataFrame(eng.history)
        fig = go.Figure()
        for c, n, colr in [("p_cardiac", "Cardiac", COLORS["Cardiac"]), ("p_seizure", "Seizure", COLORS["Seizure"]),
                           ("p_stroke", "Stroke", COLORS["Stroke"])]:
            fig.add_trace(go.Scatter(x=H.t, y=H[c], name=n, mode="lines+markers", line=dict(color=colr), connectgaps=True))
        if "truth" in H and H.truth.notna().any():
            ev = H[H.truth != "Normal"]
            if len(ev):
                fig.add_vrect(x0=ev.t.min() - TICK_S, x1=ev.t.max(), fillcolor="grey", opacity=0.12, line_width=0,
                              annotation_text="simulated event", annotation_position="top left")
        fig.update_layout(height=330, yaxis=dict(range=[0, 1.02], title="model probability"), xaxis_title="time (s)",
                          margin=dict(l=10, r=10, t=10, b=10))
        st.plotly_chart(fig, use_container_width=True)
        fig = go.Figure(go.Scatter(x=H.t, y=H.hr, mode="lines", line=dict(color="#1a73e8")))
        fig.update_layout(height=200, title=dict(text="Heart rate from the PPG (bpm)", font=dict(size=13)),
                          margin=dict(l=10, r=10, t=30, b=10))
        st.plotly_chart(fig, use_container_width=True)

    with tabs[2]:
        st.caption("What each block did the last time it ran, from sensors to decision (time in milliseconds). "
                   "Seizure runs every 5 s, cardiac every 10 s, stroke once per face + voice clip (every 30 s).")
        st.dataframe(pd.DataFrame(eng.all_steps(), columns=["block", "last run (s)", "step", "what happened", "ms"]),
                     use_container_width=True, hide_index=True)
        cols = st.columns(3)
        for col_, n in zip(cols, ["Cardiac", "Seizure", "Stroke"]):
            if L[n]:
                col_.markdown(f"**{n}: key values**")
                col_.dataframe(pd.Series({k: (round(v, 3) if isinstance(v, (int, float)) and v is not None and np.isfinite(v) else v)
                                          for k, v in L[n]["info"].items()}, name="value").astype(str),
                               use_container_width=True)

    with tabs[3]:
        if eng.log:
            st.dataframe(pd.DataFrame(eng.log), use_container_width=True, hide_index=True)
        else:
            st.caption("No state change yet.")

    with tabs[4]:
        for n in ["Cardiac", "Seizure"]:
            if L[n]:
                with st.expander(f"{n}: all features of the last window ({len(L[n]['features'])})"):
                    st.dataframe(pd.Series(L[n]["features"], name="value").astype(float).round(4), use_container_width=True)

    with tabs[5]:
        st.dataframe(pd.DataFrame(eng.models_info()), use_container_width=True, hide_index=True)
        st.dataframe(pd.Series(eng.source.describe(), name="source"), use_container_width=True)
        if any(r["kind"].startswith("DEMO") for r in eng.models_info()):
            st.warning("DEMO models are trained on synthetic signals: they show the pipeline works, their scores "
                       "mean nothing medically. Put the real files from the notebooks in models/ (see "
                       "EXPORT_FROM_NOTEBOOKS.md) and press Reset.")


live()
