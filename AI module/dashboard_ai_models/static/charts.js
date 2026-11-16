// Small canvas charts for the live screen (no library needed, works offline).
//   StripChart : a scrolling signal (ECG, PPG, accelerometer)
//   FaceView   : the 68 face points of the current camera image
//   Sparkline  : the history of one feature
//   ProbChart  : probability of each model over the drive + the decision timeline
"use strict";

const INK = { primary: "#f0efec", secondary: "#c3c2b7", muted: "#898781", grid: "#2c2c2a", axis: "#383835",
              surface: "#1a1a19" };
const MODEL_COLOR = { Cardiac: "#c93636", Seizure: "#c98500", Stroke: "#9085e9" };
const STATE_COLOR = { Normal: "#0ca30c", Cardiac: "#c93636", Seizure: "#c98500", Stroke: "#9085e9" };
const groupOf = (state) => (state || "Normal").split(" ")[0];

// Canvas sized for the screen's pixel density; returns the drawing context in CSS pixels.
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// ------------------------------------------------------------------ scrolling signal
class StripChart {
  constructor(canvas, { fs, span, color, keep }) {
    Object.assign(this, { canvas, fs, span, color, keep: keep || span + 3 });
    this.reset();
  }
  reset() { this.data = []; this.tEnd = 0; this.lo = null; this.hi = null; }
  push(tEnd, values) {                      // values: the samples that end at time tEnd
    for (const v of values) this.data.push(v === null ? NaN : v);
    this.tEnd = tEnd;
    const max = Math.round(this.keep * this.fs);
    if (this.data.length > max) this.data.splice(0, this.data.length - max);
  }
  draw(now) {
    const { ctx, w, h } = fitCanvas(this.canvas);
    ctx.clearRect(0, 0, w, h);
    const t0 = now - this.span, n = this.data.length;
    // one hairline per second, like a monitor
    ctx.strokeStyle = INK.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let s = Math.ceil(t0); s <= now; s++) { const x = Math.round((s - t0) / this.span * w) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    ctx.stroke();
    if (!n) return;
    const i0 = Math.max(0, Math.floor(n - (this.tEnd - t0) * this.fs)), i1 = Math.min(n, Math.ceil(n - (this.tEnd - now) * this.fs));
    let lo = Infinity, hi = -Infinity;
    for (let i = i0; i < i1; i++) { const v = this.data[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!isFinite(lo)) return;
    if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
    const pad = 0.12 * (hi - lo);
    lo -= pad; hi += pad;
    // smooth the scale so the trace does not jump
    this.lo = this.lo === null ? lo : this.lo + 0.15 * (lo - this.lo);
    this.hi = this.hi === null ? hi : this.hi + 0.15 * (hi - this.hi);
    const y = (v) => h - (v - this.lo) / (this.hi - this.lo) * h;
    ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    let pen = false;
    for (let i = i0; i < i1; i++) {
      const v = this.data[i];
      if (!isFinite(v)) { pen = false; continue; }
      const x = (this.tEnd - (n - 1 - i) / this.fs - t0) / this.span * w;
      if (pen) ctx.lineTo(x, y(v)); else { ctx.moveTo(x, y(v)); pen = true; }
    }
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ face points
const FACE_LINES = [[0, 16, false], [17, 21, false], [22, 26, false], [27, 30, false], [31, 35, false],
                    [36, 41, true], [42, 47, true], [48, 59, true], [60, 67, true]];

class FaceView {
  constructor(canvas) { this.canvas = canvas; this.reset(); }
  reset() { this.frames = []; this.box = null; }
  push(frames) { for (const f of frames) this.frames.push(f); if (this.frames.length > 120) this.frames.splice(0, this.frames.length - 120); }
  current(now) {                              // latest image not in the future, if recent
    let f = null;
    for (const x of this.frames) { if (x[0] <= now) f = x; else break; }
    return f && now - f[0] < 1.0 ? f : null;
  }
  draw(now) {
    const { ctx, w, h } = fitCanvas(this.canvas);
    ctx.clearRect(0, 0, w, h);
    const f = this.current(now);
    if (!f) {
      ctx.fillStyle = INK.muted; ctx.font = "15px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(this.frames.length ? "between two clips" : "no camera clip yet", w / 2, h / 2);
      return;
    }
    const p = f[1];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const box = [x0, x1, y0, y1];                // smooth the zoom so the face does not jump
    this.box = this.box ? this.box.map((v, i) => v + 0.2 * (box[i] - v)) : box;
    const [bx0, bx1, by0, by1] = this.box;
    const s = 0.85 * Math.min(w / (bx1 - bx0), h / (by1 - by0));
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    const X = (x) => w / 2 + (x - cx) * s, Y = (y) => h / 2 + (y - cy) * s;
    // middle line used by the asymmetry features (between nose top 27 and chin 8)
    ctx.strokeStyle = INK.axis; ctx.lineWidth = 1; ctx.beginPath();
    const mx = (p[27][0] + p[8][0]) / 2;
    ctx.moveTo(X(mx), 4); ctx.lineTo(X(mx), h - 4); ctx.stroke();
    ctx.strokeStyle = INK.muted; ctx.lineWidth = 1.5; ctx.beginPath();
    for (const [a, b, closed] of FACE_LINES) {
      ctx.moveTo(X(p[a][0]), Y(p[a][1]));
      for (let i = a + 1; i <= b; i++) ctx.lineTo(X(p[i][0]), Y(p[i][1]));
      if (closed) ctx.lineTo(X(p[a][0]), Y(p[a][1]));
    }
    ctx.stroke();
    ctx.fillStyle = INK.primary;
    for (const [x, y] of p) { ctx.beginPath(); ctx.arc(X(x), Y(y), 2.2, 0, 2 * Math.PI); ctx.fill(); }
  }
}

// ------------------------------------------------------------------ sparkline
function drawSparkline(canvas, values, color) {
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const v = values.filter((x) => x !== null && isFinite(x));
  if (v.length < 2) return;
  let lo = Math.min(...v), hi = Math.max(...v);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const n = values.length, X = (i) => 3 + i / (n - 1) * (w - 8), Y = (x) => h - 4 - (x - lo) / (hi - lo) * (h - 8);
  ctx.strokeStyle = INK.muted; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.beginPath();
  let pen = false;
  values.forEach((x, i) => {
    if (x === null || !isFinite(x)) { pen = false; return; }
    if (pen) ctx.lineTo(X(i), Y(x)); else { ctx.moveTo(X(i), Y(x)); pen = true; }
  });
  ctx.stroke();
  const last = values[n - 1];
  if (last !== null && isFinite(last)) {                 // newest value = accent dot with a surface ring
    ctx.fillStyle = INK.surface; ctx.beginPath(); ctx.arc(X(n - 1), Y(last), 5, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(n - 1), Y(last), 3.5, 0, 2 * Math.PI); ctx.fill();
  }
}

// ------------------------------------------------------------------ probability over time + decision timeline
class ProbChart {
  constructor(canvas, tooltip) {
    this.canvas = canvas; this.tip = tooltip; this.hoverX = null;
    canvas.addEventListener("mousemove", (e) => { this.hoverX = e.offsetX; });
    canvas.addEventListener("mouseleave", () => { this.hoverX = null; this.tip.hidden = true; });
    this.reset(1, null, {});
  }
  reset(duration, event, thresholds) {
    Object.assign(this, { duration, event, thresholds, series: { Cardiac: [], Seizure: [], Stroke: [] }, states: [[0, "Normal"]] });
  }
  add(model, t, p) { this.series[model].push([t, p]); }
  state(t, s) { this.states.push([t, s]); }
  stateAt(t) { let s = "Normal"; for (const [a, x] of this.states) if (a <= t) s = x; return s; }
  pAt(model, t) { let p = null; for (const [a, x] of this.series[model]) if (a <= t) p = x; return p; }

  draw(now) {
    const { ctx, w, h } = fitCanvas(this.canvas);
    ctx.clearRect(0, 0, w, h);
    const L = 62, R = 92, T = 20, band = 24, B = 22 + band + 6;  // plot area margins
    const pw = w - L - R, ph = h - T - B;
    const X = (t) => L + t / this.duration * pw, Y = (p) => T + (1 - p) * ph;
    ctx.font = "12px system-ui, sans-serif";
    // event period (ground truth of the recording)
    if (this.event) {
      const a = X(this.event[0]), b = Math.max(X(this.event[1]), a + 3);
      ctx.fillStyle = "rgba(240,239,236,0.07)"; ctx.fillRect(a, T, b - a, ph);
      ctx.fillStyle = INK.secondary; ctx.textAlign = "left"; ctx.fillText("event in the recording", a + 4, T - 6);
    }
    // grid + y axis (one axis: probability 0-1)
    ctx.strokeStyle = INK.grid; ctx.lineWidth = 1; ctx.fillStyle = INK.muted; ctx.textAlign = "right";
    for (const p of [0, 0.5, 1]) {
      const y = Math.round(Y(p)) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke();
      ctx.fillText(p.toFixed(1), L - 6, y + 4);
    }
    ctx.textAlign = "center";
    const step = this.duration > 200 ? 60 : 30;
    for (let t = 0; t <= this.duration + 0.01; t += step) ctx.fillText(fmtTime(t), X(t), T + ph + 16);
    // thresholds: thin dashed reference lines in the model colour
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    for (const [m, thr] of Object.entries(this.thresholds)) {
      ctx.strokeStyle = MODEL_COLOR[m]; ctx.globalAlpha = 0.7; ctx.beginPath();
      ctx.moveTo(L, Y(thr) + 0.5); ctx.lineTo(L + pw, Y(thr) + 0.5); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.setLineDash([]);
    // each model: step line (its answer holds until its next run) + a dot at each run
    const ends = [];
    for (const [m, pts] of Object.entries(this.series)) {
      if (!pts.length) continue;
      ctx.strokeStyle = MODEL_COLOR[m]; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.beginPath();
      pts.forEach(([t, p], i) => {
        if (i === 0) ctx.moveTo(X(t), Y(p)); else { ctx.lineTo(X(t), Y(pts[i - 1][1])); ctx.lineTo(X(t), Y(p)); }
      });
      const last = pts[pts.length - 1];
      ctx.lineTo(X(Math.max(last[0], Math.min(now, this.duration))), Y(last[1]));
      ctx.stroke();
      for (const [t, p] of pts.slice(-40)) {
        ctx.fillStyle = INK.surface; ctx.beginPath(); ctx.arc(X(t), Y(p), 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = MODEL_COLOR[m]; ctx.beginPath(); ctx.arc(X(t), Y(p), 3.5, 0, 2 * Math.PI); ctx.fill();
      }
      ends.push([m, last[1]]);
    }
    // direct labels at the right edge, only where they do not collide (the legend always names the lines)
    ends.sort((a, b) => b[1] - a[1]);
    let prevY = -100;
    ctx.textAlign = "left"; ctx.fillStyle = INK.secondary;
    for (const [m, p] of ends) {
      const y = Y(p) + 4;
      if (y - prevY < 15) continue;
      ctx.fillText(`${m} ${p.toFixed(2)}`, L + pw + 6, y); prevY = y;
    }
    // "now" line
    const xn = X(Math.min(now, this.duration));
    ctx.strokeStyle = INK.axis; ctx.beginPath(); ctx.moveTo(Math.round(xn) + 0.5, T); ctx.lineTo(Math.round(xn) + 0.5, T + ph); ctx.stroke();
    // decision timeline band
    const by = T + ph + 24;
    ctx.fillStyle = INK.muted; ctx.textAlign = "right"; ctx.fillText("decision", L - 6, by + band / 2 + 4);
    for (let i = 0; i < this.states.length; i++) {
      const a = this.states[i][0], b = i + 1 < this.states.length ? this.states[i + 1][0] : Math.min(now, this.duration);
      if (b <= a && i + 1 < this.states.length) continue;
      const x0 = X(a), x1 = Math.max(X(b), x0 + 2);
      ctx.fillStyle = STATE_COLOR[groupOf(this.states[i][1])];
      ctx.fillRect(x0, by, Math.max(1, x1 - x0 - 2), band);       // 2px surface gap between periods
      const label = this.states[i][1];
      ctx.font = "12px system-ui, sans-serif";
      if (ctx.measureText(label).width + 12 < x1 - x0) {
        const g = groupOf(label);
        ctx.fillStyle = g === "Seizure" || g === "Stroke" ? "#0b0b0b" : "#ffffff";
        ctx.textAlign = "left"; ctx.fillText(label, x0 + 6, by + band / 2 + 4);
      }
    }
    // hover: crosshair + tooltip
    if (this.hoverX !== null && this.hoverX >= L && this.hoverX <= L + pw) {
      const t = (this.hoverX - L) / pw * this.duration;
      ctx.strokeStyle = INK.secondary; ctx.beginPath(); ctx.moveTo(this.hoverX + 0.5, T); ctx.lineTo(this.hoverX + 0.5, by + band); ctx.stroke();
      const rows = Object.keys(this.series).map((m) => {
        const p = this.pAt(m, t);
        return `<div><span class="key" style="background:${MODEL_COLOR[m]}"></span>${m}: ${p === null ? "-" : p.toFixed(2)}</div>`;
      }).join("");
      this.tip.innerHTML = `<b>${fmtTime(t)}</b>${rows}<div>Decision: ${this.stateAt(t)}</div>`;
      this.tip.hidden = false;
      this.tip.style.left = `${Math.min(this.hoverX + 14, w - 170)}px`;
      this.tip.style.top = "10px";
    }
  }
}

function fmtTime(t) {
  t = Math.max(0, Math.round(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
