// Procedural 3D world kit: Boston street + molasses tank + wave + courtroom. No external assets.
import * as THREE from 'three';
import { EXTRA_SETS } from './sets/index.js';

// deterministic RNG so every frame / every worker builds the identical world
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- canvas textures
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  return t;
}
function facadeTex(base, trim, lit, seed) {
  const r = mulberry(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 16) {          // brick courses
      const o = (y / 8) % 2 ? 8 : 0, v = (r() - 0.5) * 22;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 220 : 0},${v > 0 ? 200 : 0},${Math.abs(v) / 120})`; g.fillRect(x + o, y, 15, 7);
    }
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {                 // 2x2 windows
      const x = 24 + i * 112, y = 28 + j * 112;
      g.fillStyle = trim; g.fillRect(x - 6, y - 6, 92, 84);
      const isLit = r() < 0.3;
      g.fillStyle = isLit ? lit : '#27365a'; g.fillRect(x, y, 80, 72);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 4, y + 4, 30, 64);
      g.fillStyle = trim; g.fillRect(x + 38, y, 4, 72); g.fillRect(x, y + 34, 80, 4);
    }
  });
}
function cobbleTex() {
  const r = mulberry(11);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5a4650'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = -16; x < w; x += 48) {
      const o = (y / 32) % 2 ? 24 : 0, l = 0.55 + r() * 0.35;
      g.fillStyle = `rgb(${130 * l | 0},${108 * l | 0},${112 * l | 0})`;
      g.beginPath(); g.roundRect(x + o + 2, y + 2, 44, 28, 8); g.fill();
    }
  }, [28, 28]);
}
function plankTex(base, dark) {
  const r = mulberry(5);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = dark; g.fillRect(x, 0, 3, h); for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; g.fillRect(x + 4 + r() * 24, r() * h, 2, 30 + r() * 60); } }
  });
}
function plateTex(base, seam) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = seam;
    for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 4, h);
    for (let y = 0; y < h; y += 170) g.fillRect(0, y, w, 4);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, [12, 1]);
}

// ---------------------------------------------------------------- sky
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#3b74d6') }, bot: { value: new THREE.Color('#bfe0ff') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 top,bot,sunCol,sunDir; varying vec3 vP;
      void main(){ float h = clamp(vP.y*1.6+0.12,0.,1.); vec3 c = mix(bot, top, pow(h,0.7));
        float s = max(dot(normalize(vP), normalize(sunDir)),0.); c += sunCol*(pow(s,600.)*1.6 + pow(s,12.)*0.22);
        gl_FragColor = vec4(c,1.); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat); m.renderOrder = -10; m.frustumCulled = false;
  return m;
}
function makeClouds(seed) {
  const r = mulberry(seed), g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group(), n = 4 + (r() * 3 | 0);
    for (let k = 0; k < n; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat); s.position.set(k * 1.1 - n * 0.55, r() * 0.5, 0); s.scale.set(1.3 + r() * 0.6, 0.8 + r() * 0.5, 0.9); c.add(s); }
    const a = r() * Math.PI * 2, d = 380 + r() * 120;
    c.position.set(Math.sin(a) * d, 120 + r() * 90, -Math.abs(Math.cos(a)) * d * 0.9 - 80); c.scale.setScalar(26 + r() * 22); c.rotation.y = 0;
    g.add(c);
  }
  return g;
}

// ---------------------------------------------------------------- wave surface (also the lingering flood)
const WAVE_W = 90, WAVE_NX = 46, WAVE_NZ = 170, WAVE_L = 260;
class WaveSurface {
  constructor() {
    const nx = WAVE_NX + 1, nz = WAVE_NZ + 1;
    this.s = new Float32Array(nz);
    for (let j = 0; j < nz; j++) this.s[j] = WAVE_L * Math.pow(j / (nz - 1), 2.4);
    this.pos = new Float32Array(nx * nz * 3); this.col = new Float32Array(nx * nz * 3);
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setIndex(idx);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.05, emissive: 0x6a3008, emissiveIntensity: 0.55 }));
    this.mesh.receiveShadow = true; this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.dark = new THREE.Color('#7a3a0e'); this.light = new THREE.Color('#f2a840'); this._c = new THREE.Color();
  }
  // height of the surface `s` units behind the front, lateral x, at time T
  static height(s, x, T, st) {
    const flood = st.flood * 1.35;
    const grow = clamp01((st.waveZ + 40) / 22) * (1 - 0.7 * smooth(70, 160, st.waveZ));
    const H = 12 * grow * (st.waveZ < 150 ? 1 : 0);
    const lat = 1 - 0.55 * smooth(14, 40, Math.abs(x));
    const front = smooth(0, 0.9, s), tail = Math.exp(-Math.max(0, s - 0.9) / 5.5);
    const ripple = Math.sin(s * 0.85 - T * 5 + x * 0.35) * 0.22 + Math.sin(s * 0.37 + x * 0.21 - T * 2.2) * 0.3;
    return flood * (0.55 + 0.45 * smooth(0, 6, s)) + H * lat * front * tail + ripple * (0.25 + 0.75 * (H > 0 ? 1 : 0.4)) * (flood > 0.01 || H > 0 ? 1 : 0) * smooth(0, 3, s);
  }
  update(st, T) {
    const show = st.waveZ > -150 && (st.burst > 0.01 || st.flood > 0.01);
    this.mesh.visible = show;
    if (!show) return;
    const nx = WAVE_NX + 1, nz = WAVE_NZ + 1, { pos, col } = this;
    for (let j = 0; j < nz; j++) {
      const s = this.s[j], z = st.waveZ - s;
      for (let i = 0; i < nx; i++) {
        const x = (i / (nx - 1) - 0.5) * WAVE_W, o = (j * nx + i) * 3;
        const h = Math.max(0, WaveSurface.height(s, x, T, st));
        pos[o] = x; pos[o + 1] = Math.max(0.02, h) * (s < 0.01 ? 0 : 1) + 0.02; pos[o + 2] = z;
        const k = clamp01(h / 9) * 0.9 + (Math.sin(s * 0.9 - T * 4 + x * 0.3) * 0.5 + 0.5) * 0.12;
        this._c.copy(this.dark).lerp(this.light, clamp01(k));
        col[o] = this._c.r; col[o + 1] = this._c.g; col[o + 2] = this._c.b;
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

// ---------------------------------------------------------------- the street
function buildStreet() {
  const g = new THREE.Group();
  const r = mulberry(1919);
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 330), new THREE.MeshStandardMaterial({ map: cobbleTex(), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 40); ground.receiveShadow = true; g.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1400), new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.25, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.15, -500); water.receiveShadow = true; g.add(water);
  // sidewalks
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(3, 0.35, 170), new THREE.MeshStandardMaterial({ color: 0x9d8f93, roughness: 0.9 }));
    w.position.set(s * 8.2, 0.17, 55); w.receiveShadow = true; w.castShadow = true; g.add(w);
  }
  // buildings
  const palettes = [['#b2573a', '#e8dcc6', '#ffd27a'], ['#9a4a3b', '#d9cfba', '#ffcf6e'], ['#c07a4a', '#efe3cc', '#ffd98a'], ['#8e5a52', '#d8cbb6', '#ffc66b'], ['#a9633f', '#e5d8bf', '#ffd07a']];
  const buildings = [];
  for (const s of [-1, 1]) for (let i = 0; i < 13; i++) {
    const z = -12 + i * 11.5, h = 10 + r() * 9, w = 11 + r() * 3, d = 10.2;
    const p = palettes[(i + (s > 0 ? 2 : 0)) % palettes.length];
    const tex = facadeTex(p[0], p[1], p[2], 40 + i * 3 + (s > 0 ? 100 : 0)); tex.repeat.set(Math.round(w / 6), Math.round(h / 6));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    m.position.set(s * (10.6 + w / 2), h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    const cor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.7, d + 0.8), new THREE.MeshStandardMaterial({ color: new THREE.Color(p[1]).multiplyScalar(0.85), roughness: 0.8 }));
    cor.position.set(0, h / 2 + 0.35, 0); cor.castShadow = true; m.add(cor);
    buildings.push({ mesh: m, h, s, i, z, baseX: m.position.x, baseY: h / 2 });
  }
  // lamp posts
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
    const p = new THREE.Group(); const z = -18 + i * 17;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 6, 8), new THREE.MeshStandardMaterial({ color: 0x1f2430 })); pole.position.y = 3; pole.castShadow = true;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd27a, emissiveIntensity: 0.8 })); lamp.position.y = 6.2;
    p.add(pole, lamp); p.position.set(s * 7.4, 0, z); g.add(p);
  }
  // barrels / crates clutter
  const barrelM = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.8 });
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.2, 12), barrelM);
    const s = r() < 0.5 ? -1 : 1; b.position.set(s * (8.6 + r() * 1.2), 0.75, -24 + r() * 100); b.castShadow = true; g.add(b);
  }
  // elevated train structure along the left side (bends in the aftermath)
  const el = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.6, metalness: 0.4 });
  const cols = [];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.7), steel); c.position.set(-6.8, 4.5, 14 + i * 14); c.castShadow = true; el.add(c); cols.push(c);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 84), steel); deck.position.set(-6.8, 9.2, 56); deck.castShadow = true; el.add(deck);
  const trainCar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 9), new THREE.MeshStandardMaterial({ color: 0xb8442e, roughness: 0.6 })); trainCar.position.set(-6.8, 10.7, 40); trainCar.castShadow = true; el.add(trainCar);
  g.add(el);

  // ---- tank
  const TR = 15, TH = 24, TZ = -50;
  const tank = new THREE.Group(); tank.position.set(0, 0, TZ); g.add(tank);
  const metal = new THREE.MeshStandardMaterial({ map: plateTex('#6f8c80', '#3c4f48'), roughness: 0.6, metalness: 0.25 });
  const brown = new THREE.MeshStandardMaterial({ map: plateTex('#6e4222', '#3a200f'), roughness: 0.6, metalness: 0.1 });
  const brownIn = new THREE.MeshStandardMaterial({ map: plateTex('#6e4222', '#3a200f'), roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
  const intact = new THREE.Group(); tank.add(intact);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, TH, 64, 1, true), metal); body.position.y = TH / 2; body.castShadow = true; intact.add(body);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(TR + 0.12, TR + 0.12, TH, 64, 1, true), brown); shell.castShadow = true; intact.add(shell);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, 0.6, 64), new THREE.MeshStandardMaterial({ color: 0x59706a, roughness: 0.7 })); roof.position.y = TH + 0.3; roof.castShadow = true; intact.add(roof);
  const roofBrown = new THREE.Mesh(new THREE.CylinderGeometry(TR + 0.1, TR + 0.1, 0.7, 64), new THREE.MeshStandardMaterial({ color: 0x6e4222, roughness: 0.7 })); roofBrown.position.y = TH + 0.3; intact.add(roofBrown);
  // seam lines every ~8 units (visual rhythm) + catwalk
  const band = new THREE.MeshStandardMaterial({ color: 0x2c3a35, roughness: 0.7 });
  for (let y of [8, 16]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(TR + 0.22, TR + 0.22, 0.35, 64, 1, true), band); b.position.y = y; intact.add(b); }
  // rivets
  const RN = 396, rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 6, 5), new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.4, metalness: 0.6 }), RN);
  rivets.castShadow = true; rivets.frustumCulled = false; tank.add(rivets);
  const rv = [];
  for (let k = 0; k < RN; k++) {
    const ring = (k / 66) | 0, a = ((k % 66) / 66) * Math.PI * 2, y = 2.5 + ring * 3.9;
    const pop = r() < 0.3 ? r() * 0.82 : 9;
    rv.push({ a, y, pop, vx: Math.sin(a) * (14 + r() * 14), vz: Math.cos(a) * (14 + r() * 14) + 6, vy: 4 + r() * 8 });
  }
  // burst halves
  const half = (th0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, TH, 40, 1, true, th0, Math.PI), brownIn); m.position.y = TH / 2; m.castShadow = true; return m; };
  const halfA = half(0), halfB = half(Math.PI);
  const halves = new THREE.Group(); halves.add(halfA, halfB); tank.add(halves);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(TR - 0.4, TR - 0.4, TH - 1, 40), new THREE.MeshStandardMaterial({ color: 0x8a4a14, roughness: 0.2, emissive: 0x3a1503, emissiveIntensity: 0.7 })); column.position.y = TH / 2; tank.add(column);
  // leak streaks, puddle, drops
  const leaks = new THREE.Group(); tank.add(leaks);
  const leakM = new THREE.MeshStandardMaterial({ color: 0xe0a23a, emissive: 0x6a3a08, emissiveIntensity: 0.6, roughness: 0.3 });
  const streaks = [];
  for (let i = 0; i < 9; i++) {
    const a = (-0.8 + i * 0.2 + (r() - 0.5) * 0.1), len = 4 + r() * 9;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1, 0.06), leakM); m.position.set(Math.sin(a) * (TR + 0.04), 0, Math.cos(a) * (TR + 0.04)); m.rotation.y = a; leaks.add(m);
    streaks.push({ m, len, top: 6 + r() * 9 });
  }
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ color: 0xc27a1e, roughness: 0.15, emissive: 0x4a2606, emissiveIntensity: 0.5 }));
  puddle.rotation.x = -Math.PI / 2; puddle.position.set(0, 0.06, TR + 3.5); puddle.scale.set(11, 5.5, 1); leaks.add(puddle);
  const drops = []; for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), leakM); d.scale.y = 1.6; leaks.add(d); drops.push({ d, a: -0.8 + i * 0.18, off: i * 0.173 }); }

  // ---- thermometer prop
  const thermo = new THREE.Group(); thermo.position.set(9, 0, 10);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9, 0.45), new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.3 })); glass.position.y = 5.2; glass.castShadow = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14), new THREE.MeshStandardMaterial({ color: 0xd7332a, roughness: 0.3, emissive: 0x5a0e0a, emissiveIntensity: 0.6 })); bulb.position.y = 0.85; bulb.castShadow = true;
  const merc = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1, 0.6), new THREE.MeshStandardMaterial({ color: 0xd7332a, emissive: 0x5a0e0a, emissiveIntensity: 0.7 }));
  thermo.add(glass, bulb, merc);
  for (let i = 0; i < 10; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(i % 3 ? 0.4 : 0.7, 0.07, 0.1), new THREE.MeshBasicMaterial({ color: 0x2a1a24 })); tk.position.set(0.7, 1.9 + i * 0.78, 0.2); thermo.add(tk); }
  g.add(thermo);

  // ---- debris (floats on the flood)
  const debris = []; const dm = [new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0xb8442e, roughness: 0.8 })];
  for (let i = 0; i < 34; i++) {
    const w = 0.8 + r() * 2.2, m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5 + r() * 1.2, 0.8 + r() * 2.5), dm[i % 3]);
    m.castShadow = true; g.add(m);
    debris.push({ m, off: 2 + r() * 20, home: 6 + r() * 58, x: (r() - 0.5) * 15, rot: r() * 6 });
  }

  return { group: g, tank: { root: tank, intact, shell, body, roof, roofBrown, rivets, rv, halves, halfA, halfB, column, leaks, streaks, puddle, drops, TH, TR, TZ }, thermo: { root: thermo, merc }, buildings, debris, el: { cols, deck, trainCar } };
}

// ---------------------------------------------------------------- courtroom (placed far away from the street)
function buildCourt() {
  const g = new THREE.Group(); g.position.set(600, 0, 0);
  const wood = new THREE.MeshStandardMaterial({ map: plankTex('#9a6a3e', '#5a3a1e'), roughness: 0.7 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: (() => { const t = plankTex('#a8763f', '#5e3d1f'); t.repeat.set(8, 8); return t; })(), roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ color: 0xd8c3a0, roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 0.6), wallM); back.position.set(0, 8, -12); back.receiveShadow = true; g.add(back);
  const wains = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 0.9), new THREE.MeshStandardMaterial({ map: (() => { const t = plankTex('#7a4a28', '#40240f'); t.repeat.set(6, 1); return t; })(), roughness: 0.7 })); wains.position.set(0, 2.5, -11.7); g.add(wains);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 16, 40), wallM); w.position.set(s * 16, 8, 6); w.receiveShadow = true; g.add(w); }
  // tall windows with light
  for (const x of [-9, 9]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 0.2), new THREE.MeshBasicMaterial({ color: 0xbfe0ff })); f.position.set(x, 9, -11.6); g.add(f);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(4.5, 8.5, 0.15), new THREE.MeshStandardMaterial({ color: 0x4a2b14 })); fr.position.set(x, 9, -11.65); g.add(fr);
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 16), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); shaft.position.set(x + 3, 6, -6); shaft.rotation.set(0.9, 0, -0.3); g.add(shaft);
  }
  // dais + bench
  const dais = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 5), wood); dais.position.set(0, 0.5, -7); dais.castShadow = dais.receiveShadow = true; g.add(dais);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(9, 2.6, 1.2), wood); bench.position.set(0, 2.3, -4.6); bench.castShadow = true; g.add(bench);
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.25, 1.6), new THREE.MeshStandardMaterial({ color: 0x4a2b14, roughness: 0.5 })); benchTop.position.set(0, 3.7, -4.6); g.add(benchTop);
  // witness box, rail, pews
  const stand = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4), wood); stand.position.set(-8, 0.8, -3); stand.castShadow = true; g.add(stand);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 0.25), wood); rail.position.set(0, 0.8, 7); rail.castShadow = true; g.add(rail);
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 1.1), wood); p.position.set(0, 0.7, 10 + i * 3.5); p.castShadow = true; g.add(p); }
  // flag
  const flagTex = canvasTex(256, 160, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f4f0e8' : '#b83a32'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#2b3f7a'; c.fillRect(0, 0, w * 0.42, h * 7 / 13); c.fillStyle = '#f4f0e8'; for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) c.fillRect(10 + x * 17, 10 + y * 16, 4, 4); });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.8), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(6.5, 6.5, -10.8); g.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 8), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.6, roughness: 0.4 })); pole.position.set(4.2, 4.6, -10.8); g.add(pole);
  // seal
  const seal = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.5, roughness: 0.4 })); seal.position.set(0, 11.5, -11.6); g.add(seal);
  // easel board with stamp
  const board = new THREE.Group();
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 512; boardCanvas.height = 640;
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.2, 0.15), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.7 })); panel.position.y = 4.4; panel.castShadow = true; board.add(panel);
  for (const sx of [-1.4, 1.4]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6), wood); leg.position.set(sx, 1.8, -0.5); leg.rotation.x = 0.16; board.add(leg); }
  board.visible = false; g.add(board);
  const drawBoard = (text, color) => {
    const c = boardCanvas.getContext('2d'); c.fillStyle = '#f2ead6'; c.fillRect(0, 0, 512, 640);
    c.strokeStyle = '#2d4a8a'; c.lineWidth = 4; for (let y = 90; y < 600; y += 36) { c.globalAlpha = 0.5; c.beginPath(); c.moveTo(30, y); c.lineTo(482, y); c.stroke(); } c.globalAlpha = 1;
    c.strokeStyle = '#2d4a8a'; c.lineWidth = 7; c.strokeRect(40, 40, 432, 560);
    c.beginPath(); c.moveTo(70, 150); c.lineTo(440, 150); c.moveTo(70, 220); c.lineTo(300, 220); c.moveTo(70, 290); c.lineTo(400, 290); c.stroke();
    c.save(); c.translate(256, 450); c.rotate(-0.2); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 12; c.strokeRect(-200, -62, 400, 124);
    c.font = '900 76px "DejaVu Sans","Arial Black",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, 4); c.restore();
    boardTex.needsUpdate = true;
  };
  return { group: g, board, drawBoard, boardKey: '' };
}

// helpers shared with extra sets
export const KIT = { THREE, mulberry, canvasTex, facadeTex, cobbleTex, plankTex, plateTex, clamp01, smooth };

// ---------------------------------------------------------------- world assembly
export function buildWorld(scene) {
  const sky = makeSky(); const clouds = makeClouds(3); scene.add(sky, clouds);
  const street = buildStreet(); scene.add(street.group);
  const wave = new WaveSurface(); street.group.add(wave.mesh);
  const court = buildCourt(); scene.add(court.group);
  const T = street.tank;
  const tmp = new THREE.Vector3();
  const offsets = { street: [0, 0, 0], court: [600, 0, 0] };
  const extras = {};
  EXTRA_SETS.forEach((def, i) => {
    const inst = def.build(KIT); const o = [1200 + i * 600, 0, 0];
    inst.group.position.set(...o); inst.group.visible = false; scene.add(inst.group);
    offsets[def.name] = o; extras[def.name] = { def, inst };
  });

  return {
    sky, clouds, court,
    offset(name) { return offsets[name] || [0, 0, 0]; },
    setSet(name) {
      const ex = extras[name];
      street.group.visible = name === 'street'; clouds.visible = name === 'street' || !!(ex && ex.def.sky); sky.visible = clouds.visible; court.group.visible = name === 'court';
      for (const [k, e] of Object.entries(extras)) e.inst.group.visible = k === name;
      const o = offsets[name] || [0, 0, 0]; sky.position.x = o[0]; clouds.position.x = o[0];   // keep the sky dome centred on the active set
    },
    setBoard(b) {
      if (!b) { court.board.visible = false; return; }
      court.board.visible = true; court.board.position.set(b.pos[0], b.pos[1], b.pos[2]); court.board.rotation.y = (b.rot || 0) * Math.PI / 180;
      const k = b.text + b.color; if (court.boardKey !== k) { court.drawBoard(b.text, b.color); court.boardKey = k; }
    },
    update(st, time, beat) {
      const ex = beat && extras[beat.set]; if (ex && ex.inst.update) ex.inst.update(st, time, beat);
      if (beat && beat.set !== 'street') return;          // street/tank simulation only when visible
      // ---- tank
      const swell = st.swell, burst = st.burst;
      const shake = swell > 0.3 ? (swell - 0.3) * 0.35 : 0;
      T.root.position.set(Math.sin(time * 61) * shake, 0, T.TZ + Math.cos(time * 53) * shake * 0.5);
      const sx = 1 + 0.025 * swell, sy = 1 + 0.01 * swell;
      T.intact.scale.set(sx, sy, sx);
      T.intact.visible = burst < 0.01;
      T.halves.visible = burst >= 0.01; T.column.visible = burst >= 0.01;
      T.roofBrown.visible = st.paint > 0.98;
      const p = Math.max(0.001, st.paint);
      T.shell.scale.y = p; T.shell.position.y = (T.TH / 2) * p; T.shell.visible = st.paint > 0.001;
      // bulge the plates a touch as it swells (shell/body only)
      // rivets (some pop and fly)
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
      for (let k = 0; k < T.rv.length; k++) {
        const v = T.rv[k]; let sz = 1;
        const R = T.TR * (1 + 0.025 * swell) + 0.28;
        pos.set(Math.sin(v.a) * R, v.y, Math.cos(v.a) * R);
        const tau = (st.rivets - v.pop) * 3.2;
        if (tau > 0) { pos.x += v.vx * tau; pos.z += v.vz * tau; pos.y += v.vy * tau - 6 * tau * tau; if (pos.y < 0 || tau > 2.4) sz = 0; }
        sc.setScalar(sz); m.compose(pos, q, sc); T.rivets.setMatrixAt(k, m);
      }
      T.rivets.instanceMatrix.needsUpdate = true;
      T.rivets.visible = burst < 0.01 || st.rivets < 1;
      // burst: halves swing apart, column drains
      const b = burst;
      T.halfA.position.x = b * 6; T.halfB.position.x = -b * 6; T.halfA.rotation.z = -b * 0.12; T.halfB.rotation.z = b * 0.12;
      T.column.scale.y = Math.max(0.12, 1 - b * 0.9); T.column.position.y = (T.TH / 2) * T.column.scale.y;
      // leaks
      const L = st.leak; T.leaks.visible = L > 0.01;
      for (const s of T.streaks) { const len = s.len * L; s.m.scale.y = Math.max(0.01, len); s.m.position.y = s.top - len / 2; }
      T.puddle.scale.set(11 * Math.min(1, L * 1.2), 5.5 * Math.min(1, L * 1.2), 1);
      for (const d of T.drops) { const u = ((time * 1.7 + d.off) % 1); const a = d.a; const R = T.TR + 0.5; d.d.position.set(Math.sin(a) * R, 2.2 - u * 2.2, Math.cos(a) * R); d.d.visible = L > 0.05; }

      // ---- thermometer
      street.thermo.root.visible = st.thermo > 0.01;
      street.thermo.merc.scale.y = 0.2 + st.thermo * 7.6; street.thermo.merc.position.y = 0.9 + (0.2 + st.thermo * 7.6) / 2;

      // ---- wave / flood
      wave.update(st, time);

      // ---- debris + aftermath
      const A = st.aftermath;
      for (const d of street.debris) {
        d.m.visible = A > 0.01 || (st.waveZ > -40 && st.burst > 0.5 && st.waveZ < 150);
        if (!d.m.visible) continue;
        const front = st.waveZ;
        const z = Math.min(front - d.off, d.home + 10);
        const s = front - z;
        const h = Math.max(0, WaveSurface.height(s, d.x, time, st));
        d.m.position.set(d.x, h + 0.3 + Math.sin(time * 1.6 + d.rot) * 0.06, z);
        d.m.rotation.set(Math.sin(d.rot) * 0.3, d.rot + (1 - A) * 2, Math.cos(d.rot * 2) * 0.35);
      }
      for (const bd of street.buildings) {
        const dmg = (bd.i === 4 || bd.i === 5 || bd.i === 9) ? A : 0;     // crushed buildings
        bd.mesh.scale.y = 1 - dmg * 0.55; bd.mesh.position.y = bd.baseY * bd.mesh.scale.y;
        bd.mesh.rotation.z = dmg * bd.s * 0.14; bd.mesh.position.x = bd.baseX - bd.s * dmg * 1.2;
      }
      const el = street.el;
      el.cols.forEach((c, i) => { const bend = i >= 1 && i <= 3 ? A : 0; c.rotation.z = bend * (0.18 + i * 0.07); c.rotation.x = bend * 0.12; });
      el.deck.rotation.z = A * 0.1; el.deck.position.y = 9.2 - A * 0.7;
      el.trainCar.position.y = 10.7 - A * 1.2; el.trainCar.rotation.z = A * 0.5; el.trainCar.position.x = -6.8 + A * 1.5;
    },
    applyGrade(gr, camTarget, sun) {
      sky.material.uniforms.top.value.set(gr.skyTop); sky.material.uniforms.bot.value.set(gr.skyBot);
      sky.material.uniforms.sunDir.value.set(...gr.sunDir); sky.material.uniforms.sunCol.value.set(gr.sun);
      clouds.children.forEach((c) => c.children.forEach((s) => s.material.color.set(gr.cloud || '#ffffff')));
      sky.material.uniforms.sunCol.value.set(gr.sun);
      void tmp; void camTarget; void sun;
    },
  };
}
