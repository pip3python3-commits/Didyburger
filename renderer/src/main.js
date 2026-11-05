// Timeline driver: window.init(timeline) then window.renderFrame(t) -> draws one deterministic frame.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Character, faceTarget, springFace, FACE_INDEX } from './rig.js';
import { createLook } from './look.js';
import { createFX } from './fx.js';
import { GRADES } from './grades.js';
import { normalizeBeat } from './shots.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 720), H = +(q.get('h') || 1280);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const backOut = (x) => { x = clamp01(x); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const EASE = { linear: (x) => x, inOut: smooth, out: (x) => 1 - Math.pow(1 - x, 2.2), in: (x) => x * x };
const lerp = (a, b, f) => a + (b - a) * f;
const lerp3 = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
const WORLD_DEFAULT = { paint: 0, leak: 0, swell: 0, burst: 0, waveZ: -300, flood: 0, aftermath: 0, thermo: 0, rivets: 0, droop: 0, protoDroop: 0 };
const GESTS = ['palm', 'both', 'chop', 'point', 'count', 'palm', 'chest', 'both'];
const DOF_BY_SHOT = { close: 0.9, prop: 1.2, medium: 0.7, low: 0.5, wide: 0.18, high: 0.12 };

let S = null;

window.init = async function (timeline) {
  await document.fonts.ready;
  const FMT = timeline.format || {};
  timeline.beats.forEach(normalizeBeat);
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#bcd8f2', 90, 420);
  const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);

  const hemi = new THREE.HemisphereLight('#8fb8ff', '#34202b', 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0cc', 3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#ffffff', 0.9); scene.add(fill, fill.target);

  const world = buildWorld(scene);
  const look = createLook(renderer, scene, camera, W, H, { paint: +(q.get('paint') ?? 1), msaa: +(q.get('msaa') ?? 4) });
  const fx = createFX(scene);

  const chars = {};
  for (const [id, spec] of Object.entries(timeline.cast)) { chars[id] = new Character({ id, ...spec }); scene.add(chars[id].root); }

  // world-state keyframes, carried across beats (any key used by any beat; missing keys start at 0)
  const keys = { ...WORLD_DEFAULT };
  for (const b of timeline.beats) for (const k of Object.keys(b.world || {})) if (!(k in keys)) keys[k] = 0;
  const wstates = []; let prev = { ...keys };
  for (const b of timeline.beats) {
    const from = { ...prev }, to = { ...prev };
    for (const [k, v] of Object.entries(b.world || {})) { if (Array.isArray(v)) { from[k] = v[0]; to[k] = v[1]; } else { from[k] = v; to[k] = v; } }
    wstates.push({ from, to }); prev = to;
  }

  const cap = document.getElementById('cap');
  cap.style.fontSize = Math.round(H * (FMT.captionSize || 0.056)) + 'px';
  cap.style.top = Math.round(H * (FMT.captionY || 0.70)) + 'px';
  const title = document.getElementById('title');
  title.style.fontSize = Math.round(H * (W > H ? 0.11 : 0.07)) + 'px';
  const r = Math.max(3, Math.round(H * (W > H ? 0.0065 : 0.0085))); const sh = [];
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; sh.push(`${(Math.cos(a) * r).toFixed(1)}px ${(Math.sin(a) * r).toFixed(1)}px 0 #140a10`); }
  sh.push(`0 ${Math.round(r * 1.8)}px ${Math.round(r * 2.2)}px rgba(0,0,0,.5)`);
  cap.style.textShadow = sh.join(',');

  S = { basePaint: +(q.get('paint') ?? 1), renderer, scene, camera, hemi, sun, fill, world, look, fx, chars, timeline, wstates, keys, cap, title, fovScale: FMT.fovScale || 1 };
  return { duration: timeline.duration, beats: timeline.beats.length };
};

function findBeat(tl, t) { const b = tl.beats; let i = 0; while (i < b.length - 1 && t >= b[i + 1].start) i++; return i; }
function lerpAngle(a, b, f) { const d = ((b - a + 540) % 360) - 180; return a + d * f; }
function bracket(kfs, p, key) {
  const has = kfs.filter((k) => k[key] !== undefined);
  if (!has.length) return null;
  if (p <= has[0].at) return has[0][key];
  for (let i = 0; i < has.length - 1; i++) {
    const a = has[i], b = has[i + 1];
    if (p >= a.at && p <= b.at) { const f = smooth((p - a.at) / Math.max(1e-6, b.at - a.at)); return key === 'rot' ? lerpAngle(a[key], b[key], f) : lerp3(a[key], b[key], key === 'pos' && b.ease === 'linear' ? (p - a.at) / Math.max(1e-6, b.at - a.at) : f); }
  }
  return has[has.length - 1][key];
}

// ---------------------------------------------------------------- speech -> mouth, gestures, nods
function speech(beat, lt) {
  const words = beat.words || [], env = beat.env;
  let open = 0;
  if (env && env.length) { const x = lt * 30, i = Math.floor(x), f = x - i; open = lerp(env[Math.min(i, env.length - 1)] || 0, env[Math.min(i + 1, env.length - 1)] || 0, f); }
  let wi = -1; for (let i = 0; i < words.length; i++) { if (words[i].s <= lt) wi = i; else break; }
  const w = wi >= 0 ? words[wi] : null;
  const inWord = w && lt < w.e + 0.05;
  if (!env || !env.length) open = inWord ? Math.abs(Math.sin(Math.PI * (lt - w.s) / Math.max(0.12, (w.e - w.s) / Math.max(1, Math.round((w.e - w.s) / 0.17))))) : 0;
  let vowel = 'ah';
  if (inWord) { const vs = (w.w.toLowerCase().match(/[aeiouy]/g) || ['a']); const v = vs[Math.min(vs.length - 1, Math.floor(clamp01((lt - w.s) / Math.max(0.05, w.e - w.s)) * vs.length))]; vowel = 'ou'.includes(v) ? 'oh' : 'ei'.includes(v) ? 'ee' : 'ah'; }
  // gesture events on stressed words (long words, numbers, punctuation, emphasised)
  const emph = new Set((beat.emph || []).map((x) => x.toLowerCase()));
  let ev = null;
  for (let i = 0; i <= wi; i++) {
    const t = words[i].w, clean = t.toLowerCase().replace(/[^a-z0-9']/g, '');
    if (t.length >= 7 || /[0-9]/.test(t) || /[!?]$/.test(t) || emph.has(clean) || i === 0) ev = { i, s: words[i].s, q: /\?$/.test(t), x: /!$/.test(t) };
  }
  let gAmp = 0, gest = 'palm', nod = 0;
  if (ev) { const age = lt - ev.s; gAmp = Math.min(1, age / 0.14) * Math.exp(-Math.max(0, age - 0.14) / 0.9); gest = ev.q ? 'shrug' : ev.x ? 'up' : GESTS[(ev.i * 7 + (beat.id || '').length) % GESTS.length]; nod = Math.sin(Math.min(1, age / 0.3) * Math.PI) * 0.09 * (age < 0.3 ? 1 : 0); }
  if (beat.gesture) gest = beat.gesture;
  const raise = !!(ev && ev.q && lt - ev.s < 1.2);
  return { open: clamp01(open), vowel, gAmp: beat.gestures === false ? 0 : gAmp, gest, nod, raise, evS: ev ? ev.s : -9 };
}


// ---------------------------------------------------------------- face parameters over time (springy, deterministic)
// targetAt(tt): the face an actor "wants" at absolute time tt (expression of that beat + lip-sync + emphasis brow pops);
// springFace() convolves it with a damped-spring response so every change overshoots and settles.
function faceVec(id, t, curName) {
  const KI = FACE_INDEX, tl = S.timeline;
  const targetAt = (tt) => {
    tt = Math.max(0, tt);
    const bi = findBeat(tl, tt), beat = tl.beats[bi], lt = Math.max(0, tt - beat.start), p = clamp01(lt / beat.dur);
    const a = (beat.actors || []).find((x) => x.id === id);
    let name = curName;
    if (a) { name = 'neutral'; for (const k of a.tl) if (k.at <= p + 1e-9 && k.face) name = k.face; }
    const v = faceTarget(name).slice();
    if (a && (beat.talk || beat.speaker) === id) {
      const sp = speech(beat, lt), o = sp.open;
      if (sp.vowel === 'oh') { v[KI.mW] *= 0.55; v[KI.mOpen] += o * 62; }
      else if (sp.vowel === 'ee') { v[KI.mW] *= 1.18; v[KI.mOpen] += o * 30; }
      else { v[KI.mW] *= 0.92; v[KI.mOpen] += o * 70; }
      v[KI.bLy] += 9 * sp.gAmp + (sp.raise ? 10 : 0); v[KI.bRy] += 9 * sp.gAmp + (sp.raise ? 10 : 0);   // brows pop on stressed words
    }
    return v;
  };
  return springFace(targetAt, t);
}

// stage the scene for time t (camera, world, actors, light); returns info about the beat
function stage(t) {
  const { scene, camera, hemi, sun, fill, world, chars, timeline, wstates, keys, fovScale } = S;
  const bi = findBeat(timeline, t), beat = timeline.beats[bi];
  const lt = Math.max(0, t - beat.start), p = clamp01(lt / beat.dur);
  const OFF = world.offset(beat.set), off = OFF[0];

  const ws = wstates[bi], st = {};
  for (const k of Object.keys(keys)) st[k] = lerp(ws.from[k], ws.to[k], p);
  world.setSet(beat.set); world.setBoard(beat.set === 'court' ? beat.board : null);
  beat._p = p; world.update(st, t, beat);

  const gr = { ...(GRADES[beat.grade] || GRADES.dayCool), ...(beat.gradeOverride || {}) };
  scene.fog.color.set(gr.fog); scene.fog.near = gr.fogNear; scene.fog.far = gr.fogFar; scene.background = new THREE.Color(gr.fog);
  hemi.color.set(gr.hemiSky); hemi.groundColor.set(gr.hemiGnd); hemi.intensity = gr.hemiI * 1.5; fill.color.set(gr.hemiSky).lerp(new THREE.Color('#ffffff'), 0.5);
  sun.color.set(gr.sun); sun.intensity = gr.sunI; world.applyGrade(gr);

  // camera (+ 'zoom' cut punch-in, impact shake)
  const cam = beat.cam, e = (EASE[cam.ease] || EASE.inOut)(p);
  const pos = lerp3(cam.from.p, cam.to.p, e), tgt = lerp3(cam.from.t, cam.to.t, e);
  let fov = lerp(cam.from.fov, cam.to.fov, e) * fovScale;
  if (beat.cut === 'zoom') fov *= 1 - 0.22 * Math.pow(Math.max(0, 1 - lt / 0.35), 2);
  const imp = beat.fx && beat.fx.impact != null ? Math.max(0, 1 - Math.max(0, lt - beat.fx.impact * beat.dur) / 0.5) * (lt >= beat.fx.impact * beat.dur ? 1 : 0) : 0;
  const sk = (cam.shake || 0) + imp * 0.9;
  const hx = Math.sin(t * 1.3) * 0.04 + Math.sin(t * 2.9 + 1) * 0.02, hy = Math.sin(t * 1.7 + 2) * 0.03;
  const jx = sk * (Math.sin(t * 37.1) + Math.sin(t * 23.7 + 1.3)) * 0.18, jy = sk * (Math.sin(t * 41.3 + 0.4) + Math.sin(t * 19.1)) * 0.18;
  camera.position.set(pos[0] + off + hx + jx, pos[1] + hy + jy, pos[2]); camera.up.set(0, 1, 0);
  camera.lookAt(tgt[0] + off, tgt[1], tgt[2]); camera.rotateZ(sk * Math.sin(t * 29) * 0.012 + (cam.roll || 0));
  camera.fov = fov; camera.updateProjectionMatrix();
  const camPos = [camera.position.x, camera.position.y, camera.position.z];

  const f = new THREE.Vector3(tgt[0] + off, 0, tgt[2]);
  const d = new THREE.Vector3(...gr.sunDir).normalize().multiplyScalar(90);
  fill.position.set(camera.position.x, camera.position.y + 6, camera.position.z + 4); fill.target.position.copy(f); fill.intensity = 0.8;
  sun.position.copy(f).add(d); sun.target.position.copy(f); sun.target.updateMatrixWorld();

  // actors
  const talkId = beat.talk || beat.speaker || null;
  const sp = talkId ? speech(beat, lt) : null;
  const placed = {};
  for (const a of beat.actors || []) { const pp = bracket(a.tl, p, 'pos') || [0, 0, 0]; placed[a.id] = [pp[0] + off, pp[1] + 3, pp[2]]; }
  const used = new Set();
  for (const a of beat.actors || []) {
    const c = S.chars[a.id]; if (!c) continue; used.add(a.id);
    const kfs = a.tl, pp = bracket(kfs, p, 'pos') || [0, 0, 0], rot = bracket(kfs, p, 'rot') ?? 0;
    let anim = 'idle', prevAnim = null, animAt = -1, face = 'neutral', speed = 1, scale = 1, lastAnimIdx = -1, prop = null, propL = null, lk = null, enter = null;
    kfs.forEach((k, i) => { if (k.at <= p + 1e-9) { if (k.anim) lastAnimIdx = i; if (k.face) face = k.face; if (k.speed) speed = k.speed; if (k.scale) scale = k.scale; if (k.prop !== undefined) prop = k.prop; if (k.propL !== undefined) propL = k.propL; if (k.look !== undefined) lk = k.look; if (k.enter) enter = { type: k.enter, t: lt - k.at * beat.dur }; } });
    if (lastAnimIdx >= 0) { anim = kfs[lastAnimIdx].anim; animAt = kfs[lastAnimIdx].at; for (let i = lastAnimIdx - 1; i >= 0; i--) if (kfs[i].anim && kfs[i].anim !== anim) { prevAnim = kfs[i].anim; break; } }
    const animT = animAt <= 0 ? 99 : (p - animAt) * beat.dur;
    // eye-line
    let lookAt = null;
    if (lk === 'cam') lookAt = null; else if (Array.isArray(lk)) lookAt = [lk[0] + off, lk[1], lk[2]]; else if (typeof lk === 'string' && placed[lk]) lookAt = placed[lk];
    else if (talkId && a.id !== talkId && placed[talkId]) lookAt = placed[talkId];
    else if (talkId && a.id === talkId) { const others = Object.keys(placed).filter((k) => k !== talkId); if (others.length && Math.floor((lt + 0.6) / 2.6) % 2 === 0) lookAt = placed[others[0]]; }
    const talk = a.id === talkId ? sp : null;
    const listen = sp && a.id !== talkId ? { nod: Math.max(0, Math.sin(clamp01((lt - sp.evS - 0.25) / 0.45) * Math.PI)) * 0.12 } : null;
    const facep = faceVec(a.id, t, face);
    c.apply({ pos: [pp[0] + off, pp[1], pp[2]], rotY: rot * Math.PI / 180, scale, anim, prevAnim, animT, face, facep, t, speed, camPos, lookAt, talk, listen, prop, propL, enter });
  }
  for (const [id, c] of Object.entries(S.chars)) if (!used.has(id)) c.hide();
  S.fx.update(beat.fx, t, [tgt[0] + off, tgt[1] - 3, tgt[2]], lt, beat.dur);
  return { beat, bi, lt, p, gr, tgt: [tgt[0] + off, tgt[1], tgt[2]], imp };
}

window.renderFrame = function (t) {
  const { look, timeline, cap, title, camera } = S;
  const b0 = timeline.beats[findBeat(timeline, t)], lt0 = Math.max(0, t - b0.start);
  const GH = 0.6, bi0 = timeline.beats.indexOf(b0);
  let ghost = 0;
  if (b0.cut === 'ghost' && bi0 > 0 && lt0 < GH) { const pb = timeline.beats[bi0 - 1]; stage(pb.start + pb.dur - 0.02); look.captureGhost(); ghost = Math.pow(1 - lt0 / GH, 1.5); }
  const { beat, lt, gr, tgt, imp } = stage(t);
  const U = look.u, FX = beat.fx || {};
  const cut = beat.cut || 'none';
  U.ghost.value = ghost;
  U.whip.value = cut === 'whip' ? Math.pow(Math.max(0, 1 - lt / 0.3), 2) : 0;
  U.flash.value = (cut === 'flash' ? Math.pow(Math.max(0, 1 - lt / 0.22), 2) * 0.85 : 0) + imp * imp * 0.6;
  U.flashCol.value.set(beat.flashCol || FX.flashCol || '#fff6e8');
  U.iris.value = cut === 'iris' ? Math.max(0, 1 - lt / 0.45) : (beat.irisOut ? clamp01((lt - (beat.dur - 0.45)) / 0.45) : 0);
  U.sat.value = gr.sat || 1.1;
  U.paint.value = S.basePaint * (beat.paint ?? 0.55);
  U.time.value = t;
  // depth of field: focus on the camera target (or an actor), strength by shot type
  const dofAmt = beat.dof?.amt ?? (beat.shot ? DOF_BY_SHOT[beat.shot.type || 'medium'] ?? 0.5 : 0.3);
  let focusP = tgt;
  const fid = beat.dof?.on || (beat.shot && typeof beat.shot.f === 'string' ? beat.shot.f : null);
  if (fid && S.chars[fid]) { const r = S.chars[fid].root.position, sc = S.chars[fid].root.scale.y; focusP = [r.x, r.y + 3.0 * sc, r.z]; }
  else { let best = 1e9; for (const a of beat.actors || []) { const r = S.chars[a.id]?.root.position; if (!r) continue; const dd = Math.hypot(r.x - tgt[0], r.z - tgt[2]); if (dd < best) { best = dd; focusP = [r.x, r.y + 3.0 * S.chars[a.id].root.scale.y, r.z]; } } }
  U.dof.value = dofAmt; U.focus.value = Math.hypot(camera.position.x - focusP[0], camera.position.y - focusP[1], camera.position.z - focusP[2]);
  // light shafts: from the sun or a set light
  U.rays.value = FX.rays ?? 0;
  if (U.rays.value > 0) {
    const src = FX.raysFrom ? new THREE.Vector3(FX.raysFrom[0] + S.world.offset(beat.set)[0], FX.raysFrom[1], FX.raysFrom[2]) : camera.position.clone().add(new THREE.Vector3(...gr.sunDir).normalize().multiplyScalar(300));
    const v = src.project(camera); U.sunUV.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5); if (v.z > 1) U.rays.value = 0;
    U.rayCol.value.set(FX.rayCol || gr.sun);
  }
  U.speed.value = FX.speed ?? 0; U.veins.value = FX.veins ?? 0; U.chroma.value = (FX.chroma ?? 0) + imp * 1.5;
  U.crack.value = FX.crack != null ? clamp01((lt - FX.crack * beat.dur) / 0.25) : 0;
  look.bloom.strength = beat.bloom ?? gr.bloom ?? 0.35;
  look.render();

  if (beat.title && lt < (beat.title.dur || 2.6)) {
    const d = beat.title.dur || 2.6, a = Math.min(1, lt / 0.25, (d - lt) / 0.3);
    title.innerHTML = `<div class="t">${beat.title.text}</div>` + (beat.title.sub ? `<div class="s">${beat.title.sub}</div>` : '');
    title.style.opacity = String(Math.max(0, a)); title.style.transform = `translate(-50%,-50%) scale(${(0.8 + 0.2 * backOut(lt / 0.35)).toFixed(3)})`;
  } else title.style.opacity = '0';

  // captions: 1-3 words, pop in with overshoot; numbers / emphasised words get the accent colour
  const ch = (beat.chunks || []).find((c) => lt >= c.s && lt < c.e);
  if (ch && beat.captions !== false) {
    if (cap.dataset.k !== ch.text) {
      const emph = new Set((beat.emph || []).map((x) => x.toLowerCase()));
      cap.innerHTML = ch.text.split(' ').map((w) => { const c = w.toLowerCase().replace(/[^a-z0-9']/g, ''); return (/[0-9]/.test(w) || emph.has(c)) ? `<span style="color:${beat.accent || '#ffd23f'}">${w}</span>` : w; }).join(' ');
      cap.dataset.k = ch.text;
    }
    const k = (lt - ch.s) / 0.16;
    cap.style.opacity = '1';
    cap.style.transform = `translateY(${((1 - Math.min(1, k)) * 8).toFixed(1)}px) scale(${(0.6 + 0.4 * backOut(k)).toFixed(3)})`;
  } else { cap.style.opacity = '0'; }
  return { beat: beat.id, p: lt / beat.dur };
};

window.__dbg = { faceVec, speech: (id, t) => { const tl = S.timeline, b = tl.beats[findBeat(tl, t)]; return speech(b, t - b.start); } };
window.ready = true;
