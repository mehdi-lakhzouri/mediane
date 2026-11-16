// CabinGuard live screen: receives the car loop's messages over the WebSocket and draws them.
// The only things the user chooses are the scenario, Play / Play all and Stop.
"use strict";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MODELS = ["Cardiac", "Seizure", "Stroke"];
const PACE = { Cardiac: "every 10 s, last 60 s of ECG + PPG", Seizure: "every 5 s, last 5 s of movement + heart rate",
               Stroke: "once per face + voice clip" };
const STEPS = {
  Cardiac: ["Sensors", "Filters + beat detection", "85 features", "5 LightGBM averaged", "Decision"],
  Seizure: ["Sensors", "Gravity removal + FFT", "8 features + 15 s history", "HistGradientBoosting (+ type)", "Decision"],
  Stroke: ["Sensors", "Face alignment", "37 face + 26 voice", "2 logistic regressions", "Decision"],
};
const DISPLAY_DELAY = 0.3;            // s: the screen plays 0.3 s behind the data so scrolling stays smooth

// ------------------------------------------------------------------ state
let ws = null, info = { scenarios: [], models: [] }, sc = null;
let fhist = {}, last = {}, prevFeatures = {}, drawerTab = "Cardiac";
const clock = { last: 0, wall: 0, shown: 0, active: false };
const ecg = new StripChart($("ecg"), { fs: 250, span: 10, color: "#3987e5" });
const ppg = new StripChart($("ppg"), { fs: 250, span: 10, color: "#199e70" });
const acc = new StripChart($("acc"), { fs: 25, span: 30, color: "#d55181" });
const face = new FaceView($("face"));
const prob = new ProbChart($("prob"), $("tip"));

function nowT() {
  if (clock.active) {
    const t = Math.min(clock.last, clock.last - DISPLAY_DELAY + (performance.now() - clock.wall) / 1000);
    clock.shown = Math.max(clock.shown, t);
  }
  return clock.shown;
}

function fmtVal(v, unit) {
  if (v === null || v === undefined || !isFinite(v)) return "&mdash;";
  const a = Math.abs(v);
  const d = unit === "%" || unit === "bpm" || a >= 100 ? 0 : a >= 10 ? 1 : a >= 0.1 || a === 0 ? 2 : 3;
  return `${v.toFixed(d)}<span class="u">${esc(unit)}</span>`;
}

function toast(text, kind = "", ms = 4000) {
  const t = $("toast");
  t.textContent = text; t.className = `toast ${kind}`; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}

// ------------------------------------------------------------------ connection
function connect() {
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  ws.onopen = () => { $("conn").textContent = "connected to the car loop"; $("conn").className = "conn ok"; };
  ws.onclose = () => {
    $("conn").textContent = "disconnected, retrying..."; $("conn").className = "conn bad";
    setButtons(false, false); setTimeout(connect, 2000);
    $("gatewayStatus").textContent = "Dashboard déconnecté ; état d’envoi inconnu.";
  };
  ws.onmessage = (e) => handle(JSON.parse(e.data));
}
const send = (cmd) => ws && ws.readyState === 1 && ws.send(JSON.stringify(cmd));
$("play").onclick = () => send({ cmd: "play", scenario: $("scenario").value });
$("playall").onclick = () => send({ cmd: "play_all" });
$("stop").onclick = () => send({ cmd: "stop" });

function setButtons(ready, playing) {
  for (const id of ["scenario", "play", "playall"]) $(id).disabled = !ready;
  $("stop").disabled = !playing;
}

// ------------------------------------------------------------------ messages
function handle(m) {
  switch (m.type) {
    case "gateway": return onGateway(m);
    case "hello": return onHello(m);
    case "scenario": return onScenario(m);
    case "signal": return onSignal(m);
    case "job": return pipelineRunning(m.model);
    case "waiting": return onWaiting(m);
    case "model": return onModel(m);
    case "decision": return onDecision(m);
    case "end": return onEnd(m.summary);
    case "status": return toast(m.text, "", (m.seconds || 4) * 1000);
    case "idle": return onIdle(m);
    case "error": return toast(m.text, "error", 8000);
  }
}

function onGateway(m) {
  $("gatewayStatus").textContent = !m.enabled
    ? "Mode local : l’envoi vers le conducteur n’est pas configuré."
    : m.connected ? "Connecté à l’API — boîtier associé à un conducteur" : "Envoi indisponible";
  $("gatewayTarget").textContent = m.enabled
    ? `${m.api} · Boîtier ${m.serial || "non configuré"}${m.driver ? ` · Conducteur configuré : ${m.driver}` : ""}`
    : "Pour connecter la démo, configurez le boîtier avec python -m gateway.configure, puis redémarrez.";
  $("gatewayDelivery").textContent = m.enabled
    ? `${m.sent} détection(s) envoyée(s) · ${m.pending} en attente · ${m.quarantined} refusée(s)` : "";
  $("gatewayError").hidden = !m.error;
  $("gatewayError").textContent = m.error || "";
}

function onHello(m) {
  info = m;
  const sel = $("scenario");
  sel.innerHTML = m.scenarios.map((s) => `<option>${esc(s.name)}</option>`).join("");
  sel.value = m.scenarios[0] ? m.scenarios[0].name : "";
  $("models").innerHTML = m.models.map((x) =>
    `<div><b>${esc(x.model)}</b> ${esc(x.files.join(" + "))}</div>`).join("");
  setButtons(true, m.playing);
  buildPipeline();
  if (!m.playing) resetCards();
}

function onScenario(m) {
  sc = m;
  $("scenario").value = m.name;
  setButtons(true, true);
  fhist = {}; last = {}; prevFeatures = {};
  for (const c of [ecg, ppg, acc]) c.reset();
  face.reset();
  const thr = {};
  for (const x of info.models) thr[x.model] = x.threshold;
  prob.reset(m.duration, m.event, thr);
  Object.assign(clock, { last: 0, wall: performance.now(), shown: 0, active: true });
  $("clockTotal").textContent = ` / ${fmtTime(m.duration)}`;
  $("playlist").textContent = m.total > 1 ? `scenario ${m.index + 1} of ${m.total}` : "";
  $("sources").innerHTML = (m.simulated ? `<span class="badge-sim">SIMULATED</span>` : "") +
    Object.entries(m.sources).map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join("");
  $("notes").innerHTML = m.notes.map((n) => `<div>${esc(n)}</div>`).join("");
  $("ecgSrc").textContent = m.sources["ECG + PPG"] || "";
  $("faceLabel").textContent = "";
  $("log").innerHTML = "";
  logLine(0, `<span class="result">Scenario: ${esc(m.name)}</span> <span class="muted">(${esc(m.event_text)})</span>`);
  setBanner({ state: "Normal", group: "Normal", confidence: null, by: null, candidates: {} });
  $("truth").textContent = "normal driving";
  resetCards();
  buildPipeline();
  renderFeatures();
}

function onSignal(m) {
  ecg.push(m.t, m.ecg); ppg.push(m.t, m.ppg); acc.push(m.t, m.acc);
  if (m.face.length) {
    face.push(m.face.map((f) => [f[0], f[1]]));
    const lbl = m.face[m.face.length - 1][2];
    $("faceLabel").textContent = `clip ${lbl}`;
  }
  Object.assign(clock, { last: m.t, wall: performance.now() });
  $("truth").textContent = m.event ? `EVENT: ${sc ? sc.event_text : ""}` : (sc && sc.event && m.t > sc.event[1] ? "after the event" : "normal driving");
}

function onWaiting(m) {
  const el = document.querySelector(`#card-${m.model} .extra`);
  if (el) el.textContent = `waiting: ${m.text}`;
}

// ------------------------------------------------------------------ model results
function onModel(m) {
  prevFeatures[m.model] = last[m.model] ? last[m.model].features : null;
  last[m.model] = m;
  const h = fhist[m.model] = fhist[m.model] || {};
  for (const k of m.key) (h[k.id] = h[k.id] || []).push(k.value);
  prob.add(m.model, m.t, m.p);
  renderFeatures(m.model);
  renderCard(m);
  pipelineDone(m);
  if (!$("drawer").hidden) renderDrawer();
}

// +1 / -1 when the newest value jumps much more than the usual step-to-step change, else 0.
// Needs 4 earlier values, so the first computations of a drive are never highlighted.
function bigChange(values) {
  const n = values.length;
  if (n < 5) return 0;
  const cur = values[n - 1], prev = values[n - 2];
  const fin = (x) => x !== null && isFinite(x);
  if (fin(prev) !== fin(cur)) return fin(cur) ? 1 : -1;       // a value appears or disappears (e.g. no beat found)
  if (!fin(cur)) return 0;
  const d = cur - prev, older = values.slice(0, -1).filter(fin);
  if (older.length < 4) return 0;
  const steps = older.slice(1).map((x, i) => Math.abs(x - older[i])).sort((a, b) => a - b);
  const typical = steps[Math.floor(steps.length / 2)];
  const spread = Math.max(...older) - Math.min(...older);
  const big = Math.abs(d) > 3 * typical && Math.abs(d) > 0.5 * spread && Math.abs(d) > 0.05 * Math.max(Math.abs(prev), Math.abs(cur));
  return big ? Math.sign(d) : 0;
}

function renderFeatures(only) {
  const box = $("features");
  if (!only) {
    box.innerHTML = MODELS.map((mdl) => `
      <div class="fgroup" id="fg-${mdl}">
        <div class="fhead"><span class="swatch" style="background:${MODEL_COLOR[mdl]}"></span><b>${mdl}</b>
          <span class="muted">${PACE[mdl]}</span><span class="when"></span></div>
        <div class="rows"><div class="fnote">waiting for the first computation...</div></div>
        <div class="fnotes"></div>
      </div>`).join("");
    return;
  }
  const m = last[only], g = $(`fg-${only}`);
  g.querySelector(".when").textContent = `computed at ${fmtTime(m.t)}`;
  const rows = g.querySelector(".rows");
  if (!rows.querySelector(".frow")) {
    rows.innerHTML = m.key.map((k) => `
      <div class="frow" data-id="${esc(k.id)}" title="${esc(k.id)}">
        <span class="fl">${esc(k.label)}</span><span class="fv"></span><canvas></canvas></div>`).join("");
  }
  for (const k of m.key) {
    const row = rows.querySelector(`[data-id="${CSS.escape(k.id)}"]`);
    const hist = fhist[only][k.id];
    const ch = bigChange(hist);
    row.querySelector(".fv").innerHTML = (ch ? `<span class="arrow">${ch > 0 ? "&#9650;" : "&#9660;"}</span>` : "") + fmtVal(k.value, k.unit);
    if (ch) { row.classList.remove("changed"); void row.offsetWidth; row.classList.add("changed"); }
    drawSparkline(row.querySelector("canvas"), hist.slice(-30), MODEL_COLOR[only]);
  }
  const notes = [];
  if (only === "Seizure") {
    notes.push(`<div class="fnote">Heart rate from: ${esc(m.extra.hr_source)}</div>`);
    if (m.extra.type) notes.push(`<div class="fnote warn">${esc(m.extra.type_warning)}</div>`);
  }
  if (only === "Stroke") notes.push(`<div class="fnote">Clip ${esc(m.extra.clip)}${m.extra.voice ? `, voice ${esc(m.extra.voice)}` : ", no voice"}. Distances in eye-distance units.</div>`);
  g.querySelector(".fnotes").innerHTML = notes.join("");
}

function resetCards() {
  $("cards").innerHTML = MODELS.map((mdl) => {
    const x = info.models.find((y) => y.model === mdl) || { rule: "", threshold: 0.5 };
    const first = { Cardiac: "first answer at 1:00 (needs 60 s of signal)", Seizure: "first answer at 0:05",
                    Stroke: "first answer at the end of the first clip" }[mdl];
    return `<div class="card" id="card-${mdl}" style="border-left-color:${MODEL_COLOR[mdl]}">
      <div class="card-top"><b>${mdl}</b><span class="status">waiting</span><span class="p">&ndash;</span></div>
      <div class="gauge"><div class="fill" style="width:0;background:${MODEL_COLOR[mdl]}"></div>
        <div class="thr" style="left:${x.threshold * 100}%" title="threshold ${x.threshold}"></div>
        ${mdl === "Cardiac" ? `<div class="thr hi" style="left:50%" title="one window above 0.5"></div>` : ""}</div>
      <div class="rule">Rule: ${esc(x.rule)}</div>
      <div class="extra">${first}</div></div>`;
  }).join("");
}

function renderCard(m) {
  const c = $(`card-${m.model}`);
  c.querySelector(".p").textContent = m.p.toFixed(2);
  const st = c.querySelector(".status");
  st.textContent = m.alarm ? "ALARM" : m.status;
  st.className = `status ${m.alarm ? "alarm" : "ok"}`;
  c.querySelector(".fill").style.width = `${Math.min(100, m.p * 100)}%`;
  let extra = `last run at ${fmtTime(m.t)}, threshold ${m.threshold.toFixed(2)}`;
  if (m.model === "Seizure" && m.extra.type) extra = `Seizure type: <b>${esc(m.extra.type)}</b> (${m.extra.p_type.toFixed(2)}, ${m.extra.type_blocks} blocks) &middot; ` + extra;
  if (m.model === "Stroke") extra = `face ${m.extra.p_face.toFixed(2)}${m.extra.p_voice === null ? " (no voice)" : ` &middot; voice ${m.extra.p_voice.toFixed(2)}`} &middot; ` + extra;
  if (m.model === "Cardiac") extra += ` (one window &ge; ${m.extra.high_threshold.toFixed(2)} also fires)`;
  c.querySelector(".extra").innerHTML = extra;
}

// ------------------------------------------------------------------ decision
const STATE_TEXT = { Normal: "NORMAL", Cardiac: "CARDIAC EMERGENCY", Seizure: "SEIZURE", Stroke: "STROKE" };

function setBanner(d) {
  const g = d.group || "Normal";
  $("banner").className = `banner state-${g}`;
  const type = g === "Seizure" && d.state.includes("(") ? ` · ${d.state.split("(")[1].replace(")", "").toUpperCase()}` : "";
  $("state").textContent = STATE_TEXT[g] + type;
  $("confidence").textContent = d.confidence === null ? "-" : d.confidence.toFixed(2);
  const c = Object.entries(d.candidates || {}).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ");
  $("stateWhy").textContent = d.by
    ? `Decided by the ${d.by.toLowerCase()} model. Models in alarm: ${c} (highest probability wins).`
    : "No model is in alarm. Confidence = 1 - the highest model probability.";
}

function onDecision(d) {
  setBanner(d);
  if (d.change) {
    prob.state(d.t, d.change.to);
    logLine(d.t, `${esc(d.change.from)} &rarr; <b>${esc(d.change.to)}</b> <span class="muted">${d.change.by ? `${esc(d.change.by)} model, P ${d.change.confidence.toFixed(2)}` : "no model in alarm"}</span>`);
  }
}

function logLine(t, html) {
  const el = document.createElement("div");
  el.innerHTML = `<span class="t">${fmtTime(t)}</span>${html}`;
  $("log").prepend(el);
}

function resultText(s) {
  if (s.expected === "Normal") {
    return s.other_alarms.length ? `false alarm(s): ${s.other_alarms.map(([t, x]) => `${x} at ${fmtTime(t)}`).join(", ")}` : "stayed Normal the whole time";
  }
  const det = s.detected_at === null ? "MISSED"
    : s.delay < 0 ? `in alarm since ${fmtTime(s.detected_at)}, BEFORE the event start (${s.delay.toFixed(0)} s)`
    : `detected at ${fmtTime(s.detected_at)} (+${s.delay.toFixed(0)} s after the event start)`;
  const other = s.other_alarms.length ? `; other alarms: ${s.other_alarms.map(([t, x]) => `${x} at ${fmtTime(t)}`).join(", ")}` : "";
  return `expected ${s.expected}: ${det}${other}`;
}

function onEnd(s) {
  logLine(s.duration, `<span class="result">End of scenario: ${esc(resultText(s))}</span>`);
  clock.last = s.duration;
}

function onIdle(m) {
  setButtons(true, false);
  clock.active = false;
  if (m.results && m.results.length > 1) {
    logLine(clock.shown, `<span class="result">All scenarios done:</span><br>` +
      m.results.map((s) => `&nbsp;&nbsp;${esc(s.scenario)}: ${esc(resultText(s))}`).join("<br>"));
  }
  if (m.stopped) toast("Stopped.");
}

// ------------------------------------------------------------------ pipeline strip
function buildPipeline() {
  $("pipeline").innerHTML = MODELS.map((mdl) =>
    `<div class="name"><span class="swatch" style="background:${MODEL_COLOR[mdl]}"></span>${mdl}</div>` +
    STEPS[mdl].map((s, i) => `<div class="step${i === 4 ? " last" : ""}" id="st-${mdl}-${i}"><span class="lbl">${s}</span><span class="ms">&ndash;</span></div>`).join("")
  ).join("");
}

function pipelineRunning(mdl) {
  for (let i = 0; i < 5; i++) {
    const el = $(`st-${mdl}-${i}`);
    el.classList.remove("done");
    if (i >= 1 && i <= 3) { el.classList.add("running"); el.querySelector(".ms").innerHTML = "&hellip;"; }
  }
}

function pipelineDone(m) {
  const ms = [m.ms.sensors, m.ms.preprocessing, m.ms.features, m.ms.model, m.ms.decision];
  ms.forEach((v, i) => {
    const el = $(`st-${m.model}-${i}`);
    el.classList.remove("running"); el.classList.add("done");
    el.querySelector(".ms").textContent = v === null || v === undefined ? "in features" : `${v < 10 ? v.toFixed(1) : v.toFixed(0)} ms`;
  });
}

// ------------------------------------------------------------------ "show all features" drawer
$("allFeatures").onclick = () => { $("drawer").hidden = false; renderDrawer(); };
$("closeDrawer").onclick = () => { $("drawer").hidden = true; };

function renderDrawer() {
  $("tabs").innerHTML = MODELS.map((mdl) => `<button class="${mdl === drawerTab ? "on" : ""}" data-m="${mdl}">${mdl}</button>`).join("");
  for (const b of $("tabs").querySelectorAll("button")) b.onclick = () => { drawerTab = b.dataset.m; renderDrawer(); };
  const m = last[drawerTab];
  if (!m) { $("drawerBody").innerHTML = `<p class="muted">No computation yet for this model.</p>`; return; }
  const prev = prevFeatures[drawerTab] || {}, keyIds = new Set(m.key.map((k) => k.id));
  const f = (v) => v === null || v === undefined ? "&mdash;" : Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(4);
  $("drawerBody").innerHTML = `<p class="muted">All ${Object.keys(m.features).length} features of the last computation (at ${fmtTime(m.t)}),
    exactly as given to the model. Bold = shown in the main panel.</p>
    <table><tr><th>feature</th><th>now</th><th>previous</th></tr>` +
    Object.entries(m.features).map(([k, v]) => `<tr class="${keyIds.has(k) ? "input" : ""}"><td>${keyIds.has(k) ? `<b>${esc(k)}</b>` : esc(k)}</td><td>${f(v)}</td><td>${f(prev[k])}</td></tr>`).join("") +
    `</table>`;
}

// ------------------------------------------------------------------ animation
let shownSecond = -1;
function frame() {
  const t = nowT();
  ecg.draw(t); ppg.draw(t); acc.draw(t); face.draw(t); prob.draw(t);
  const s = Math.floor(t);
  if (s !== shownSecond) { shownSecond = s; $("clock").textContent = fmtTime(t); }
  requestAnimationFrame(frame);
}

renderFeatures();
buildPipeline();
connect();
requestAnimationFrame(frame);
