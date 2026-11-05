// Procedural 3D cartoon character: big round head (skin tone), layered face (eyes/brows shell + mouth shell) with
// lip-sync visemes, blinks and eye darts, thin rubber-hose limbs, costume + hair + hat, held props, talk gestures,
// listener reactions, squash & stretch and pop entrances. Everything is a pure function of the inputs (deterministic).
import * as THREE from 'three';
import { makeProp, PROP_KINDS } from './props.js';

const INK = 0x2a1a24;
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1a0f16, side: THREE.BackSide });
export const SKIN = { s1: '#f6dccb', s2: '#ebbf9c', s3: '#d39b6e', s4: '#a8693f', s5: '#7a4a2c', s6: '#4f3122', white: '#fbfaf8' };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ------------------------------------------------------------------ rim light (fresnel) patch
function rimify(m, strength = 0.35, color = 0xfff1dd) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimCol = { value: new THREE.Color(color) }; sh.uniforms.rimStr = { value: strength };
    sh.fragmentShader = 'uniform vec3 rimCol; uniform float rimStr;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n float rimF = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.6);\n totalEmissiveRadiance += rimCol * rimF * rimStr;');
  };
  m.customProgramCacheKey = () => 'rim' + strength;
  return m;
}
function lam(color, rough = 0.75) { return rimify(new THREE.MeshStandardMaterial({ color, roughness: rough }), 0.25); }
function addWithOutline(parent, mesh, thick = 1.05) {
  mesh.castShadow = true; parent.add(mesh);
  const o = new THREE.Mesh(mesh.geometry, OUTLINE); o.scale.setScalar(thick); mesh.add(o);
  return mesh;
}

// ------------------------------------------------------------------ face layers (transparent canvases on shells)
// Sphere UV: u = 0.25 is the +Z (front) meridian. Canvas 1024x512 -> front at x = 256.
const CX = 256, CY = 250, EX = 42, EY = CY - 14;
const cache = new Map();
function canvasTexture(draw) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round'; draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const INKS = '#1d1218';
function strokeLine(g, x0, y0, x1, y1, w) { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
function strokeCurve(g, x0, y0, qx, qy, x1, y1, w) { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(qx, qy, x1, y1); g.stroke(); }

const EXPR = {
  neutral: { eyes: 'open', brows: 'flat', mouth: 'line' },
  smile:   { eyes: 'open', brows: 'up', mouth: 'smile' },
  grin:    { eyes: 'happy', brows: 'up', mouth: 'grin' },
  smug:    { eyes: 'lid', brows: 'smug', mouth: 'smirk' },
  shock:   { eyes: 'wide', brows: 'high', mouth: 'O' },
  panic:   { eyes: 'wide', brows: 'high', mouth: 'scream', drops: 2 },
  worried: { eyes: 'open', brows: 'worry', mouth: 'wavy', drops: 1 },
  sweat:   { eyes: 'lid', brows: 'worry', mouth: 'wavy', drops: 3 },
  sad:     { eyes: 'open', brows: 'worry', mouth: 'frown' },
  angry:   { eyes: 'angry', brows: 'angry', mouth: 'frown' },
  rage:    { eyes: 'angry', brows: 'angry', mouth: 'teeth' },
  laugh:   { eyes: 'happy', brows: 'up', mouth: 'grin' },
  think:   { eyes: 'lid', brows: 'think', mouth: 'side' },
  sly:     { eyes: 'lid', brows: 'smug', mouth: 'smile' },
  tired:   { eyes: 'lid', brows: 'worry', mouth: 'line' },
};
export const FACES = Object.keys(EXPR);

function eyesTex(extras, eyes, brows, blink, look, raise) {
  const k = `E|${extras}|${eyes}|${brows}|${blink}|${look}|${raise}`;
  if (cache.has(k)) return cache.get(k);
  const t = canvasTexture((g) => {
    g.strokeStyle = INKS; g.fillStyle = INKS;
    for (const s of [-1, 1]) {
      const x = CX + s * EX, y = EY;
      if (blink || eyes === 'happy') {
        if (eyes === 'happy' && !blink) strokeCurve(g, x - 17, y + 6, x, y - 16, x + 17, y + 6, 7);
        else strokeCurve(g, x - 17, y, x, y + 7, x + 17, y, 7);
        continue;
      }
      const rx = eyes === 'wide' ? 21 : 15, ry = eyes === 'wide' ? 25 : 20;
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); g.lineWidth = 4.5; g.stroke();
      g.fillStyle = INKS;
      const px = x + look * 5 + (eyes === 'wide' ? 0 : 0), py = y + (eyes === 'lid' ? 5 : 2);
      g.beginPath(); g.ellipse(px, py, eyes === 'wide' ? 8 : 9, eyes === 'wide' ? 10 : 12, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(px + 3, py - 4, 2.6, 0, 7); g.fill(); g.fillStyle = INKS;
      if (eyes === 'lid') { g.fillStyle = 'rgba(0,0,0,0)'; g.save(); g.beginPath(); g.ellipse(x, y, rx + 1, ry + 1, 0, 0, 7); g.clip(); g.clearRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 0.85); g.restore(); strokeLine(g, x - rx - 1, y - ry * 0.15, x + rx + 1, y - ry * 0.15, 6); }
      if (eyes === 'angry') { g.save(); g.beginPath(); g.ellipse(x, y, rx + 1, ry + 1, 0, 0, 7); g.clip(); g.beginPath(); g.moveTo(x - rx - 3, s < 0 ? y - ry - 2 : y - 2); g.lineTo(x + rx + 3, s < 0 ? y - 2 : y - ry - 2); g.lineTo(x + rx + 3, y - ry - 6); g.lineTo(x - rx - 3, y - ry - 6); g.closePath(); g.clearRect(0, 0, 0, 0); g.globalCompositeOperation = 'destination-out'; g.fill(); g.restore(); g.globalCompositeOperation = 'source-over'; }
    }
    // brows
    const by = EY - 36 - raise * 10;
    for (const s of [-1, 1]) {
      const x = CX + s * EX; g.strokeStyle = INKS;
      if (brows === 'flat') strokeLine(g, x - 17, by + 4, x + 17, by + 4, 8);
      else if (brows === 'up') strokeCurve(g, x - 17, by + 6, x, by - 7, x + 17, by + 6, 8);
      else if (brows === 'high') strokeCurve(g, x - 19, by - 6, x, by - 20, x + 19, by - 6, 8);
      else if (brows === 'worry') strokeLine(g, s < 0 ? x - 18 : x + 18, by + 8, s < 0 ? x + 18 : x - 18, by - 6, 8);
      else if (brows === 'angry') strokeLine(g, s < 0 ? x - 18 : x + 18, by - 6, s < 0 ? x + 18 : x - 18, by + 12, 9);
      else if (brows === 'smug') { if (s < 0) strokeLine(g, x - 18, by + 8, x + 18, by + 8, 8); else strokeCurve(g, x - 18, by + 4, x, by - 14, x + 18, by - 4, 8); }
      else if (brows === 'think') { if (s < 0) strokeLine(g, x - 18, by - 4, x + 18, by + 4, 8); else strokeLine(g, x - 18, by + 6, x + 18, by + 6, 8); }
    }
    if (extras.includes('glasses')) {
      g.strokeStyle = INKS; g.lineWidth = 5; g.fillStyle = 'rgba(190,225,255,0.18)';
      for (const s of [-1, 1]) { g.beginPath(); g.arc(CX + s * EX, EY, 28, 0, 7); g.fill(); g.stroke(); }
      strokeLine(g, CX - 14, EY, CX + 14, EY, 5);
    }
  });
  cache.set(k, t); return t;
}

// mouth: base shape (from expression) or a viseme while talking: level 0..3, vowel ah|oh|ee
function mouthTex(extras, base, level, vowel, drops) {
  const k = `M|${extras}|${base}|${level}|${vowel}|${drops}`;
  if (cache.has(k)) return cache.get(k);
  const t = canvasTexture((g) => {
    const my = CY + 64; g.strokeStyle = INKS; g.fillStyle = INKS;
    const fillMouth = (path) => { g.fillStyle = '#3a1218'; path(); g.fill(); g.save(); path(); g.clip();
      g.fillStyle = '#e8737f'; g.beginPath(); g.ellipse(CX, my + 30, 26, 14, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.fillRect(CX - 40, my - 30, 80, 13); g.restore(); g.lineWidth = 5; path(); g.stroke(); g.fillStyle = INKS; };
    if (level > 0) {
      const smiley = ['smile', 'grin', 'smirk'].includes(base);
      const w = vowel === 'oh' ? 15 + level * 4 : vowel === 'ee' ? 30 + level * 5 : 22 + level * 5;
      const h = vowel === 'ee' ? 5 + level * 5 : vowel === 'oh' ? 9 + level * 7 : 7 + level * 8;
      if (smiley) fillMouth(() => { g.beginPath(); g.moveTo(CX - w - 6, my - 8); g.quadraticCurveTo(CX, my - 2 + h * 0.2, CX + w + 6, my - 8); g.quadraticCurveTo(CX, my + h * 2.1, CX - w - 6, my - 8); g.closePath(); });
      else if (base === 'frown' || base === 'wavy' || base === 'teeth') fillMouth(() => { g.beginPath(); g.ellipse(CX, my + 6, w, h, 0, 0, 7); });
      else fillMouth(() => { g.beginPath(); g.ellipse(CX, my + 4, w, h, 0, 0, 7); });
    } else {
      const curve = (x0, y0, qx, qy, x1, y1, w = 7) => strokeCurve(g, x0, y0, qx, qy, x1, y1, w);
      if (base === 'line') strokeLine(g, CX - 18, my, CX + 18, my, 7);
      else if (base === 'smirk') curve(CX - 24, my + 2, CX + 6, my + 10, CX + 34, my - 12);
      else if (base === 'smile') curve(CX - 34, my - 6, CX, my + 26, CX + 34, my - 6);
      else if (base === 'side') curve(CX - 6, my + 2, CX + 14, my + 6, CX + 30, my - 4);
      else if (base === 'frown') curve(CX - 28, my + 14, CX, my - 12, CX + 28, my + 14);
      else if (base === 'wavy') { g.lineWidth = 6; g.beginPath(); g.moveTo(CX - 28, my + 4); for (let i = 0; i <= 6; i++) g.lineTo(CX - 28 + i * 9.4, my + 4 + (i % 2 ? -7 : 6)); g.stroke(); }
      else if (base === 'grin') fillMouth(() => { g.beginPath(); g.moveTo(CX - 42, my - 8); g.quadraticCurveTo(CX, my + 50, CX + 42, my - 8); g.closePath(); });
      else if (base === 'O') fillMouth(() => { g.beginPath(); g.ellipse(CX, my + 8, 17, 24, 0, 0, 7); });
      else if (base === 'scream') fillMouth(() => { g.beginPath(); g.ellipse(CX, my + 12, 34, 34, 0, 0, 7); });
      else if (base === 'teeth') { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(CX - 36, my - 10, 72, 24, 6); g.fill(); g.lineWidth = 5; g.stroke(); strokeLine(g, CX - 36, my + 2, CX + 36, my + 2, 3); for (let i = -2; i <= 2; i++) strokeLine(g, CX + i * 13, my - 10, CX + i * 13, my + 14, 3); }
    }
    for (let i = 0; i < drops; i++) { const x = CX + (i % 2 ? 98 : -98) + i * 6, y = CY - 60 + i * 26; g.fillStyle = '#7fc4f0'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 20); g.quadraticCurveTo(x + 15, y + 5, x, y + 12); g.quadraticCurveTo(x - 15, y + 5, x, y - 20); g.fill(); g.stroke(); }
    if (extras.includes('mustache')) {
      g.fillStyle = '#2b1a14'; g.beginPath();
      g.moveTo(CX, my - 26); g.quadraticCurveTo(CX - 40, my - 44, CX - 76, my - 16); g.quadraticCurveTo(CX - 40, my - 20, CX, my - 12);
      g.quadraticCurveTo(CX + 40, my - 20, CX + 76, my - 16); g.quadraticCurveTo(CX + 40, my - 44, CX, my - 26); g.fill();
    }
    if (extras.includes('blush')) { g.fillStyle = 'rgba(232,110,120,0.35)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(CX + s * 70, CY + 30, 18, 10, 0, 0, 7); g.fill(); } }
  });
  cache.set(k, t); return t;
}

// ------------------------------------------------------------------ limb (rubber hose)
class Hose {
  constructor(radius, color, segs = 12, rad = 6) {
    this.segs = segs; this.rad = rad; this.radius = radius;
    const n = (segs + 1) * rad; this.pos = new Float32Array(n * 3);
    const idx = [];
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) { const a = i * rad + j, b = i * rad + (j + 1) % rad, c = (i + 1) * rad + j, d = (i + 1) * rad + (j + 1) % rad; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setIndex(idx); this.geo = geo;
    this.mesh = new THREE.Mesh(geo, lam(color, 0.7)); this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this._a = new THREE.Vector3(); this._m = new THREE.Vector3(); this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._bn = new THREE.Vector3(); this._p = new THREE.Vector3();
  }
  update(a, b, mid) {
    const { segs, rad, radius, pos } = this;
    const c = this._m.copy(mid).multiplyScalar(2).sub(this._a.copy(a).add(b).multiplyScalar(0.5));
    const N = this._n, B = this._bn, Tn = this._t, Pp = this._p;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, iu = 1 - u;
      Pp.set(iu * iu * a.x + 2 * iu * u * c.x + u * u * b.x, iu * iu * a.y + 2 * iu * u * c.y + u * u * b.y, iu * iu * a.z + 2 * iu * u * c.z + u * u * b.z);
      Tn.set(2 * iu * (c.x - a.x) + 2 * u * (b.x - c.x), 2 * iu * (c.y - a.y) + 2 * u * (b.y - c.y), 2 * iu * (c.z - a.z) + 2 * u * (b.z - c.z));
      if (Tn.lengthSq() < 1e-8) Tn.set(0, 1, 0); Tn.normalize();
      if (i === 0) { const ref = Math.abs(Tn.x) < 0.8 ? B.set(1, 0, 0) : B.set(0, 0, 1); N.crossVectors(Tn, ref).normalize(); }
      else { N.addScaledVector(Tn, -N.dot(Tn)); if (N.lengthSq() < 1e-8) N.set(0, 0, 1); N.normalize(); }   // parallel transport: carry the previous normal
      B.crossVectors(Tn, N).normalize();
      for (let j = 0; j < rad; j++) {
        const th = (j / rad) * Math.PI * 2, cs = Math.cos(th) * radius, sn = Math.sin(th) * radius, o = (i * rad + j) * 3;
        pos[o] = Pp.x + N.x * cs + B.x * sn; pos[o + 1] = Pp.y + N.y * cs + B.y * sn; pos[o + 2] = Pp.z + N.z * cs + B.z * sn;
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  }
}

// ------------------------------------------------------------------ outfits, hats, hair
// Every outfit can be overridden per cast entry: {type, skin, hair, hairColor, hat, hatColor, torso, trousers, acc:[...], extras:[...], scale}
const OUTFITS = {
  worker:   { torso: 0x7a4a2a, trousers: INK, hat: 'flatcap', hatColor: 0x4b3a33, acc: ['vest'], skin: 's3', hair: 'none' },
  boss:     { torso: 0x24304f, trousers: 0x1a2038, hat: 'bowler', hatColor: 0x1d1a22, extras: ['mustache'], scale: 1.05, acc: ['tie'], tie: 0xc23a30, skin: 's1' },
  kid:      { torso: 0x3b6fc4, trousers: 0x3b6fc4, hat: 'flatcap', hatColor: 0xb8442e, scale: 0.8, acc: ['overalls'], skin: 's4', hair: 'curly' },
  judge:    { torso: 0x17141a, trousers: 0x17141a, hat: 'wig', hatColor: 0xf3efe8, scale: 1.05, acc: ['robe'], skin: 's2' },
  engineer: { torso: 0x3f7a62, trousers: 0x2a3d36, hat: 'none', extras: ['glasses'], acc: ['tie'], tie: 0xf0e6d0, skin: 's4', hair: 'bun', hairColor: 0x2a1a14 },
  rescuer:  { torso: 0x56607a, trousers: 0x2a2f3d, hat: 'cap', hatColor: 0x2b3a6e, skin: 's5' },
  official: { torso: 0xf1ece0, trousers: 0xe6dfcf, hat: 'topi', hatColor: 0xefe6cf, extras: ['mustache'], acc: ['buttons', 'bowtie'], tie: 0x22304a, skin: 's1', scale: 1.05 },
  clerk:    { torso: 0xdad4c4, trousers: 0x3a3440, hat: 'visor', hatColor: 0x2f8a5a, extras: ['glasses'], acc: ['vest', 'armbands'], skin: 's2', hair: 'short', hairColor: 0x3a2a1c },
  catcher:  { torso: 0x3d4f6e, trousers: 0x2b2a33, hat: 'nonla', hatColor: 0xe2c98c, acc: ['sash'], tie: 0xa8432f, skin: 's3', hair: 'none' },
  farmer:   { torso: 0x8a5a36, trousers: 0x3a2a22, hat: 'nonla', hatColor: 0xd9bd7c, acc: ['apron'], skin: 's4' },
  vendor:   { torso: 0x9c3b3b, trousers: 0x2b2a33, hat: 'headscarf', hatColor: 0x3a6a5a, skin: 's3', hair: 'bun', hairColor: 0x1d1612 },
  doctor:   { torso: 0xf4f4f0, trousers: 0x30343c, hat: 'none', extras: ['glasses'], acc: ['coat', 'tie'], tie: 0x3a5a9a, skin: 's5', hair: 'short', hairColor: 0x1d1612 },
};
export const OUTFIT_TYPES = Object.keys(OUTFITS);

function makeHat(kind, color) {
  const g = new THREE.Group(); const m = lam(color, 0.8);
  const dome = (r, sy, y, phiLen = Math.PI / 2) => { const d = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, phiLen), m); d.scale.set(1, sy, 1); d.position.y = y; addWithOutline(g, d, 1.04); return d; };
  if (kind === 'flatcap' || kind === 'cap') {
    const d = dome(0.7, kind === 'cap' ? 0.62 : 0.5, 0.12, Math.PI * 0.52); d.scale.z = 1.08;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.44), m); brim.position.set(0, 0.15, 0.72); brim.rotation.x = 0.18; addWithOutline(g, brim, 1.12);
  } else if (kind === 'bowler') { dome(0.52, 1.05, 0.36); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.06, 28), m); b.position.y = 0.36; addWithOutline(g, b, 1.05); }
  else if (kind === 'tophat') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.9, 24), m); c.position.y = 0.75; addWithOutline(g, c, 1.04); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 28), m); b.position.y = 0.32; addWithOutline(g, b, 1.05); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.505, 0.505, 0.14, 24), lam(0x8a2a2a)); band.position.y = 0.42; g.add(band); }
  else if (kind === 'topi') { const d = dome(0.66, 0.8, 0.22); d.scale.z = 1.12; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.95, 0.05, 28), m); b.position.y = 0.24; b.scale.z = 1.15; addWithOutline(g, b, 1.04); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.665, 0.665, 0.09, 24), lam(0x6e5a3a)); band.position.y = 0.3; g.add(band); const k = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m); k.position.y = 0.78; g.add(k); }
  else if (kind === 'nonla') { const c = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.62, 32, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide })); c.position.y = 0.42; addWithOutline(g, c, 1.03);
    for (let i = 1; i < 5; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.15 * (1 - i / 5) + 0.01, 0.008, 4, 40), lam(0xa88c52)); r.rotation.x = Math.PI / 2; r.position.y = 0.11 + 0.62 * (i / 5); g.add(r); } }
  else if (kind === 'visor') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 32), lam(0x2a2a30)); band.rotation.x = Math.PI / 2; band.position.y = -0.02; g.add(band);
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.04, 28, 1, false, -0.9, 1.8), new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.25 })); v.position.set(0, 0.0, 0.0); v.rotation.x = 0.15; addWithOutline(g, v, 1.03); }
  else if (kind === 'beret') { const d = dome(0.66, 0.35, 0.18); d.rotation.z = 0.2; }
  else if (kind === 'headscarf') { const d = dome(0.66, 0.8, -0.02, Math.PI * 0.55); d.scale.z = 1.05; const k = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), m); k.position.set(0, 0.0, -0.66); addWithOutline(g, k); }
  else if (kind === 'wig') {
    for (const [x, y, z, r] of [[0, 0.5, -0.05, 0.42], [-0.5, 0.18, 0, 0.3], [0.5, 0.18, 0, 0.3], [-0.52, -0.12, -0.05, 0.27], [0.52, -0.12, -0.05, 0.27], [-0.25, 0.46, -0.1, 0.3], [0.25, 0.46, -0.1, 0.3], [0, 0.2, -0.45, 0.4]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); s.position.set(x, y, z); addWithOutline(g, s, 1.06); }
  }
  return g;
}
function makeHair(kind, color) {
  const g = new THREE.Group(); if (!kind || kind === 'none') return g; const m = lam(color, 0.85);
  const ball = (x, y, z, r) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m); s.position.set(x, y, z); addWithOutline(g, s, 1.06); };
  if (kind === 'short') { const d = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.34), m); d.rotation.x = -0.3; addWithOutline(g, d, 1.03); }
  else if (kind === 'tuft') { ball(0, 0.62, 0.05, 0.12); ball(-0.1, 0.6, 0.12, 0.09); ball(0.11, 0.6, 0.1, 0.09); }
  else if (kind === 'curly') { for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; ball(Math.sin(a) * 0.42, 0.42 + Math.cos(a * 3) * 0.06, Math.cos(a) * 0.42 - 0.08, 0.2); } ball(0, 0.62, -0.05, 0.26); }
  else if (kind === 'bun') { const d = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.38), m); d.rotation.x = -0.3; addWithOutline(g, d, 1.03); ball(0, 0.45, -0.55, 0.22); }
  return g;
}

// ------------------------------------------------------------------ animation library
// Pose in character-local space (+Z forward, +Y up). Home: shoulders (+-0.34, 2.2), hips (+-0.16, 1.4). sq = squash(-)/stretch(+).
const S = Math.sin, C = Math.cos;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const backOut = (x) => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function basePose() { return { y: 0, lean: 0, twist: 0, nod: 0, roll: 0, hL: [-0.47, 1.3, 0.07], hR: [0.47, 1.3, 0.07], fL: [-0.2, 0, 0], fR: [0.2, 0, 0], liftL: 0, liftR: 0, crouch: 0, sq: 0, sit: 0 }; }
const ANIMS = {
  idle(t) {
    const p = basePose(), s = S(t * 2.1);
    p.y = s * 0.02; p.sq = s * 0.012; p.roll = S(t * 1.1) * 0.04; p.nod = S(t * 1.7) * 0.03;
    const w = S(t * 0.8), f1 = S(t * 0.37) * S(t * 0.53), f2 = S(t * 0.29 + 1.3) * S(t * 0.47);     // weight shift + slow independent fidgets
    p.hL = [-0.47 - 0.03 * s + 0.03 * f1, 1.3 + 0.03 * s + 0.05 * f1, 0.07 + 0.06 * w + 0.07 * f1];
    p.hR = [0.47 + 0.03 * s - 0.03 * f2, 1.3 - 0.03 * s + 0.05 * f2, 0.07 - 0.06 * w + 0.07 * f2];
    p.twist = 0.025 * w;
    return p;
  },
  talk(t) { return ANIMS.idle(t); },
  walk(t, k = 1) { const p = basePose(), ph = t * 7 * k; p.y = Math.abs(S(ph)) * 0.07; p.sq = -Math.abs(C(ph)) * 0.03 + 0.015; p.fL = [-0.2, 0, S(ph) * 0.5]; p.fR = [0.2, 0, -S(ph) * 0.5]; p.liftL = Math.max(0, C(ph)) * 0.3; p.liftR = Math.max(0, -C(ph)) * 0.3; p.hL = [-0.58, 1.4, -S(ph) * 0.4]; p.hR = [0.58, 1.4, S(ph) * 0.4]; p.twist = S(ph) * 0.08; p.roll = S(ph) * 0.04; return p; },
  sneak(t, k = 1) { const p = ANIMS.walk(t, 0.6 * k); p.crouch = 0.25; p.lean = 0.25; p.hL = [-0.5, 2.0, 0.6]; p.hR = [0.5, 2.0, 0.6]; p.nod = 0.1; return p; },
  wade(t, k = 1) { const p = ANIMS.walk(t, 0.55 * k); p.liftL *= 1.4; p.liftR *= 1.4; p.hL = [-0.9, 1.7 + S(t * 2) * 0.1, 0.1]; p.hR = [0.9, 1.7 + C(t * 2) * 0.1, 0.1]; p.lean = 0.12; p.nod = 0.15; return p; },
  run(t, k = 1) { const p = basePose(), ph = t * 11 * k; p.y = Math.abs(S(ph)) * 0.16 + 0.05; p.sq = Math.abs(S(ph)) * 0.06 - 0.02; p.lean = 0.28; p.fL = [-0.2, 0, S(ph) * 0.85]; p.fR = [0.2, 0, -S(ph) * 0.85]; p.liftL = Math.max(0, C(ph)) * 0.6; p.liftR = Math.max(0, -C(ph)) * 0.6; p.hL = [-0.5, 1.9, -S(ph) * 0.8]; p.hR = [0.5, 1.9, S(ph) * 0.8]; p.twist = S(ph) * 0.2; p.roll = S(ph) * 0.1; return p; },
  wave(t) { const p = ANIMS.idle(t); p.hR = [0.7 + S(t * 9) * 0.22, 3.2, 0.1]; p.roll += 0.05; return p; },
  point(t) { const p = ANIMS.idle(t); p.hR = [0.85, 2.55 + S(t * 6) * 0.05, 1.1]; p.hL = [-0.5, 1.6, 0.2]; p.twist = -0.15; p.nod = -0.05; return p; },
  present(t) { const p = ANIMS.idle(t); p.hR = [1.0 + S(t * 2) * 0.1, 2.35, 0.5]; p.hL = [-0.55, 1.6, 0.15]; p.twist = -0.2; return p; },
  hold(t) { const p = ANIMS.idle(t); p.hR = [0.42, 2.25 + S(t * 1.8) * 0.03, 0.85]; p.nod = 0.06; return p; },
  holdUp(t) { const p = ANIMS.idle(t); p.hR = [0.5, 3.5 + S(t * 3) * 0.05, 0.5]; p.hL = [-0.6, 1.5, 0.1]; p.lean = -0.06; p.nod = -0.15; p.sq = 0.03; return p; },
  carry(t) { const p = ANIMS.idle(t); p.hL = [-0.32, 1.9, 0.75]; p.hR = [0.32, 1.9, 0.75]; p.lean = -0.05; return p; },
  smug(t) { const p = ANIMS.idle(t); p.hL = [-0.5, 1.62, 0.2]; p.hR = [0.52, 1.62, 0.2]; p.lean = -0.07; p.nod = -0.1; p.roll = S(t * 0.9) * 0.05 + 0.05; return p; },
  armsCrossed(t) { const p = ANIMS.idle(t); p.hL = [0.25, 1.95, 0.42]; p.hR = [-0.25, 2.0, 0.45]; p.lean = -0.05; p.nod = -0.04; return p; },
  think(t) { const p = ANIMS.idle(t); p.hR = [0.12, 2.75, 0.55]; p.hL = [0.2, 1.95, 0.4]; p.nod = 0.12; p.roll = 0.12 + S(t * 0.8) * 0.03; return p; },
  shrug(t) { const p = ANIMS.idle(t); const k = 0.5 + 0.5 * S(t * 2.4); p.hL = [-0.95, 2.0 + k * 0.25, 0.35]; p.hR = [0.95, 2.0 + k * 0.25, 0.35]; p.y = k * 0.05; p.roll = 0.14; p.nod = -0.05; return p; },
  laugh(t) { const p = ANIMS.idle(t); const b = Math.abs(S(t * 9)); p.y = b * 0.08; p.sq = b * 0.05 - 0.02; p.nod = -0.25 + b * 0.1; p.lean = -0.12; p.hL = [-0.35, 1.7, 0.45]; p.hR = [0.35, 1.7, 0.45]; return p; },
  clap(t) { const p = ANIMS.idle(t); const k = Math.abs(S(t * 7)); p.hL = [-0.05 - k * 0.35, 2.3, 0.7]; p.hR = [0.05 + k * 0.35, 2.3, 0.7]; p.y = (1 - k) * 0.03; return p; },
  facepalm(t) { const p = ANIMS.idle(t); p.hR = [0.05, 3.0, 0.62]; p.nod = 0.3; p.lean = 0.08; p.roll = S(t * 1.5) * 0.06; return p; },
  count(t) { const p = ANIMS.idle(t); const f = Math.max(0, S(t * 8)); p.hL = [-0.25, 2.1, 0.75]; p.hR = [0.2 + f * 0.15, 2.2 + f * 0.08, 0.75]; p.nod = 0.22; p.lean = 0.08; return p; },
  write(t) { const p = ANIMS.idle(t); p.hR = [0.25 + S(t * 9) * 0.06, 1.95, 0.85 + C(t * 7) * 0.04]; p.hL = [-0.3, 1.9, 0.8]; p.lean = 0.22; p.nod = 0.3; return p; },
  sit(t) { const p = ANIMS.idle(t); p.sit = 1; p.crouch = 0.62; p.fL = [-0.22, 0, 0.75]; p.fR = [0.22, 0, 0.75]; p.hL = [-0.4, 1.25, 0.55]; p.hR = [0.4, 1.25, 0.55]; return p; },
  jump(t) { const p = basePose(); const c = (t * 1.6) % 1; // anticipation -> stretch up -> squash land
    if (c < 0.2) { const k = c / 0.2; p.crouch = 0.3 * k; p.sq = -0.12 * k; p.hL = [-0.6, 1.3, -0.2]; p.hR = [0.6, 1.3, -0.2]; }
    else if (c < 0.75) { const k = (c - 0.2) / 0.55; p.y = S(k * Math.PI) * 1.3; p.sq = 0.14 * (1 - Math.abs(k * 2 - 1)); p.hL = [-0.8, 3.2, 0]; p.hR = [0.8, 3.2, 0]; p.liftL = 0.3; p.liftR = 0.3; }
    else { const k = (c - 0.75) / 0.25; p.sq = -0.16 * (1 - k); p.crouch = 0.25 * (1 - k); p.hL = [-0.9, 2.2, 0]; p.hR = [0.9, 2.2, 0]; }
    return p; },
  cheer(t) { const p = ANIMS.jump(t); p.hL = [-0.7, 3.4, 0.2]; p.hR = [0.7, 3.4, 0.2]; return p; },
  shock(t) { const p = basePose(), j = Math.abs(S(t * 9)); p.y = j * 0.18; p.sq = j * 0.08; p.hL = [-0.9, 3.0 + S(t * 25) * 0.05, 0]; p.hR = [0.9, 3.0 + C(t * 25) * 0.05, 0]; p.liftL = j * 0.2; p.liftR = j * 0.2; p.lean = -0.12; p.nod = -0.2; return p; },
  panic(t) { const p = ANIMS.run(t, 0.7); p.hL = [-0.9, 2.8 + S(t * 14) * 0.5, 0.2]; p.hR = [0.9, 2.8 + C(t * 14) * 0.5, 0.2]; p.roll = S(t * 18) * 0.1; return p; },
  cower(t) { const p = basePose(); p.crouch = 0.45; p.lean = 0.35; p.sq = -0.05; p.hL = [-0.3, 3.05, 0.3]; p.hR = [0.3, 3.05, 0.3]; p.roll = S(t * 30) * 0.04; p.nod = 0.3; return p; },
  sweat(t) { const p = ANIMS.idle(t); p.hR = [0.3 + S(t * 6) * 0.15, 3.35, 0.45]; p.hL = [-0.5, 1.6, 0.2]; p.lean = 0.05; p.nod = 0.1; p.roll = S(t * 2) * 0.05; return p; },
  rage(t) { const p = ANIMS.idle(t); const s = S(t * 30) * 0.02; p.hL = [-0.7, 2.0 + s, 0.3]; p.hR = [0.7, 2.0 - s, 0.3]; p.sq = 0.04 + s; p.lean = 0.1; p.nod = 0.1; p.roll = s * 2; return p; },
  paint(t) { const p = ANIMS.idle(t); const s = S(t * 3.2); p.hR = [0.35, 2.5 + s * 0.65, 1.0]; p.hL = [-0.5, 1.6, 0.2]; p.lean = 0.15 + s * 0.03; p.twist = 0.1; return p; },
  scoop(t) { const p = ANIMS.idle(t); const s = S(t * 4); p.hR = [0.45, 1.0, 0.95]; p.hL = [-0.2 + s * 0.15, 1.1 + C(t * 4) * 0.2, 0.9]; p.lean = 0.22; p.nod = 0.15; p.y = -0.02; return p; },
  gavel(t) { const p = ANIMS.idle(t); const k = Math.pow(Math.max(0, S(t * 5)), 3); p.hR = [0.5, 2.9 - k * 1.45, 0.6]; p.hL = [-0.5, 1.7, 0.5]; p.lean = 0.05 + k * 0.1; p.nod = k * 0.2; return p; },
  dejected(t) { const p = basePose(); const s = S(t * 1.4); p.lean = 0.28; p.nod = 0.32; p.y = -0.04 + s * 0.015; p.sq = -0.03; p.hL = [-0.5, 1.2, 0.0]; p.hR = [0.5, 1.2, 0.0]; p.roll = 0.06; return p; },
};
export const ANIM_NAMES = Object.keys(ANIMS);
const LOCO = new Set(['walk', 'run', 'wade', 'panic', 'sneak', 'jump', 'cheer', 'shock', 'cower']);
const LEGACY_PROP = { scoop: 'bucket', paint: 'roller', gavel: 'gavel' };
function poseFor(name, t, k) { return (ANIMS[name] || ANIMS.idle)(t, k); }
const lerpArr = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
function blendPose(a, b, f) { const o = {}; for (const k of Object.keys(a)) o[k] = Array.isArray(a[k]) ? lerpArr(a[k], b[k], f) : a[k] + (b[k] - a[k]) * f; return o; }

// talk gestures (character-local hand targets), blended in by gesture amplitude
const GESTURES = {
  palm:  { hR: [0.78, 2.3, 0.8] },
  both:  { hL: [-0.9, 2.2, 0.65], hR: [0.9, 2.2, 0.65] },
  point: { hR: [0.55, 2.65, 1.25] },
  chop:  { hR: [0.45, 2.05, 0.95] },
  count: { hL: [-0.3, 2.25, 0.7], hR: [0.25, 2.4, 0.75] },
  shrug: { hL: [-1.0, 2.15, 0.35], hR: [1.0, 2.15, 0.35], roll: 0.14 },
  chest: { hR: [0.05, 2.25, 0.5] },
  up:    { hL: [-0.75, 3.2, 0.3], hR: [0.75, 3.2, 0.3] },
};
export const GESTURE_NAMES = Object.keys(GESTURES);

// ------------------------------------------------------------------ character
export class Character {
  constructor(spec) {
    const base = OUTFITS[spec.type] || OUTFITS.worker;
    const def = this.def = { ...base, ...spec, acc: spec.acc || base.acc || [], extras: spec.extras || base.extras || [] };
    def.scale = spec.scale || base.scale || 1;
    this.skin = new THREE.Color(SKIN[def.skin] || def.skin || SKIN.s2);
    this.root = new THREE.Group(); this.root.visible = false;
    this.seed = [...(spec.id || spec.type || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) * 0.37;
    this.extras = def.extras.join(',');

    const body = this.body = new THREE.Group(); this.root.add(body);
    const tmat = lam(def.torso, 0.8);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.55, 6, 14), tmat); torso.scale.set(1, 1, 0.8); torso.position.y = 1.9; addWithOutline(body, torso, 1.06);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 10), lam(this.skin.getHex(), 0.6)); neck.position.y = 2.45; body.add(neck);
    const A = new Set(def.acc), tieCol = def.tie || 0xc23a30, on = (geo, color, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, lam(color)); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; body.add(m); return m; };
    if (A.has('robe') || A.has('coat')) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, A.has('robe') ? 0.62 : 0.42, A.has('robe') ? 1.0 : 0.6, 16), tmat); sk.position.y = A.has('robe') ? 1.2 : 1.45; addWithOutline(body, sk, 1.04); }
    if (A.has('tie')) { on(new THREE.BoxGeometry(0.1, 0.42, 0.04), tieCol, 0, 2.02, 0.27); on(new THREE.BoxGeometry(0.12, 0.08, 0.05), tieCol, 0, 2.24, 0.27); }
    if (A.has('bowtie')) { for (const s of [-1, 1]) { const b = on(new THREE.ConeGeometry(0.08, 0.16, 4), tieCol, s * 0.08, 2.3, 0.28); b.rotation.z = s * Math.PI / 2; } on(new THREE.SphereGeometry(0.04, 8, 6), tieCol, 0, 2.3, 0.3); }
    if (A.has('vest')) { const v = on(new THREE.BoxGeometry(0.36, 0.5, 0.04), 0x5a4038, 0, 1.98, 0.255); v.scale.x = 1; on(new THREE.BoxGeometry(0.12, 0.46, 0.045), 0xe9dcc2, 0, 2.0, 0.26); }
    if (A.has('overalls')) on(new THREE.BoxGeometry(0.34, 0.3, 0.04), 0xe9c24a, 0, 2.0, 0.26);
    if (A.has('buttons')) for (let i = 0; i < 3; i++) on(new THREE.SphereGeometry(0.03, 8, 6), 0xd9a43a, 0, 1.75 + i * 0.16, 0.27);
    if (A.has('sash')) { const s = on(new THREE.TorusGeometry(0.34, 0.045, 6, 20), tieCol, 0, 1.55, 0); s.rotation.x = Math.PI / 2; s.scale.set(1, 0.8, 1); }
    if (A.has('apron')) on(new THREE.BoxGeometry(0.5, 0.75, 0.03), 0xd8c9a8, 0, 1.6, 0.27);
    if (A.has('badge')) on(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), 0xd9a43a, 0.16, 2.1, 0.27, Math.PI / 2);
    if (A.has('armbands')) this._armbands = true;
    // head
    this.head = new THREE.Group(); this.head.position.y = 2.98; body.add(this.head);
    this.headMat = rimify(new THREE.MeshStandardMaterial({ color: this.skin, roughness: 0.55, emissive: this.skin, emissiveIntensity: 0.18 }), 0.35);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.66, 36, 26), this.headMat); addWithOutline(this.head, hm, 1.035);
    const shellMat = () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, color: 0xffffff });
    this.eyeMat = shellMat(); this.mouthMat = shellMat();
    this.eyeShell = new THREE.Mesh(new THREE.SphereGeometry(0.665, 36, 26), this.eyeMat); this.mouthShell = new THREE.Mesh(new THREE.SphereGeometry(0.664, 36, 26), this.mouthMat);
    this.eyeShell.renderOrder = 2; this.mouthShell.renderOrder = 2; this.head.add(this.eyeShell, this.mouthShell);
    this.hatPivot = new THREE.Group(); this.head.add(this.hatPivot);
    this.hatPivot.add(makeHair(def.hair, def.hairColor || 0x2a1a14));
    const hat = makeHat(def.hat, def.hatColor ?? 0x333333); hat.position.y = 0.4; this.hatPivot.add(hat);
    // limbs (sleeves colour the upper arm through the torso colour; arms are thin ink hoses, hands are skin)
    this.armL = new Hose(0.055, def.sleeve ?? def.torso); this.armR = new Hose(0.055, def.sleeve ?? def.torso);
    this.legL = new Hose(0.065, def.trousers, 12, 6); this.legR = new Hose(0.065, def.trousers, 12, 6);
    for (const l of [this.armL, this.armR, this.legL, this.legR]) this.root.add(l.mesh);
    const hmat = lam(this.skin.getHex(), 0.6);
    this.handL = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), hmat); this.handR = this.handL.clone();
    const smat = lam(def.shoes ?? 0x1d1a22, 0.7);
    this.footL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), smat); this.footL.scale.set(0.9, 0.5, 1.55); this.footR = this.footL.clone();
    for (const m of [this.handL, this.handR, this.footL, this.footR]) { m.castShadow = true; this.root.add(m); }
    this.props = {};
    for (const k of PROP_KINDS) { const p = makeProp(k); p.visible = false; this.root.add(p); this.props[k] = p; }
    this._v = { a: new THREE.Vector3(), b: new THREE.Vector3() };
  }

  // st: { pos, rotY, scale, anim, prevAnim, animT, face, t, speed, camPos, lookAt:[x,y,z]|null, prop, propL,
  //       talk:{open, vowel, gest, gAmp, nod, raise} | null, listen:{nod} | null, enter:{type, t} | null }
  apply(st) {
    const root = this.root; root.visible = true;
    let sc = (st.scale || 1) * this.def.scale;
    let yOff = 0;
    if (st.enter && st.enter.t < 0.6) {
      const k = st.enter.t / 0.45;
      if (st.enter.type === 'pop') sc *= Math.max(0.001, backOut(k));
      else if (st.enter.type === 'drop') yOff = (1 - backOut(k)) * 6;
    }
    root.position.set(st.pos[0], st.pos[1] + yOff, st.pos[2]); root.rotation.y = st.rotY; root.scale.setScalar(sc);
    const t = st.t + this.seed, speed = st.speed || 1;
    const blend = clamp01(st.animT / 0.22);
    let pose = poseFor(st.anim, t, speed);
    if (st.prevAnim && blend < 1) { const b = blend * blend * (3 - 2 * blend); pose = blendPose(poseFor(st.prevAnim, t, speed), pose, b); }
    const loco = LOCO.has(st.anim);

    // talking: gestures + head bob; listening: nods
    const tk = st.talk;
    if (tk && !loco) {
      const G = GESTURES[tk.gest] || GESTURES.palm, a = clamp01(tk.gAmp);
      if (G.hL) pose.hL = lerpArr(pose.hL, G.hL, a); if (G.hR) pose.hR = lerpArr(pose.hR, G.hR, a);
      if (G.roll) pose.roll += G.roll * a;
      pose.lean += 0.05 * a; pose.sq += 0.02 * a;
    }
    if (tk) { pose.nod += -tk.open * 0.07 + (tk.nod || 0); pose.y += tk.open * 0.012; }
    if (st.listen) pose.nod += st.listen.nod || 0;

    const crouch = pose.crouch, PV = 1.4;
    this.body.position.set(0, pose.y - crouch + PV * (1 - Math.cos(pose.lean)), -PV * Math.sin(pose.lean));
    this.body.rotation.set(pose.lean, pose.twist, pose.roll * 0.5);
    const sq = pose.sq || 0; this.body.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);

    // eye-line: look at a target (speaker / listener) or the camera
    const yawTo = (p) => { const dx = p[0] - st.pos[0], dz = p[2] - st.pos[2]; let y = Math.atan2(dx, dz) - st.rotY; return Math.atan2(Math.sin(y), Math.cos(y)); };
    let yaw = 0, pitch = 0;
    const yCam = st.camPos ? yawTo(st.camPos) : 0;
    if (st.lookAt) { const yT = yawTo(st.lookAt); let d = Math.atan2(Math.sin(yT - yCam), Math.cos(yT - yCam)); yaw = yCam + Math.max(-0.55, Math.min(0.55, d)) * 0.75; }   // glance toward the target but keep the face readable
    else yaw = yCam;
    const tgt = st.lookAt || st.camPos;
    if (tgt) { const dx = tgt[0] - st.pos[0], dz = tgt[2] - st.pos[2], dy = (tgt[1] ?? 3) - (st.pos[1] + 3); pitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 0.4; }
    const yawC = Math.max(-0.75, Math.min(0.75, yaw));
    const rest = yaw - yawC;
    const dart = Math.sin(t * 0.53) > 0.93 ? Math.sign(Math.sin(t * 1.7)) : 0;
    const look = Math.max(-1, Math.min(1, Math.round(rest * 2) + dart));
    this.head.rotation.set(pose.nod + pitch, yawC * 0.6, pose.roll);
    this.body.rotation.y += yawC * 0.15;
    // secondary motion: hat lags behind head nod
    const pPrev = poseFor(st.anim, t - 0.12, speed);
    this.hatPivot.rotation.x = (pPrev.nod - pose.nod) * 0.6 * (tk ? 1.4 : 1); this.hatPivot.rotation.z = (pPrev.roll - pose.roll) * 0.6;

    // face layers
    const E = EXPR[st.face] || EXPR.neutral;
    const n = Math.floor(t / 3.1), off = hash(n + this.seed) * 2.6, ph = t - n * 3.1;
    const blink = ph > off && ph < off + 0.12;
    const em = eyesTex(this.extras, E.eyes, E.brows, blink, look, tk && tk.raise ? 1 : 0);
    if (this.eyeMat.map !== em) { this.eyeMat.map = em; this.eyeMat.needsUpdate = true; }
    const lvl = tk ? (tk.open < 0.12 ? 0 : tk.open < 0.4 ? 1 : tk.open < 0.7 ? 2 : 3) : 0;
    const mm = mouthTex(this.extras, E.mouth, lvl, tk ? tk.vowel : 'ah', E.drops || 0);
    if (this.mouthMat.map !== mm) { this.mouthMat.map = mm; this.mouthMat.needsUpdate = true; }

    // limbs
    const bodyM = new THREE.Matrix4().compose(this.body.position, new THREE.Quaternion().setFromEuler(this.body.rotation), this.body.scale);
    const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const sL = V([-0.37, 2.2, 0]).applyMatrix4(bodyM), sR = V([0.37, 2.2, 0]).applyMatrix4(bodyM);
    // hips ride with the body (bob, lean, crouch, squash) so the torso never separates from the legs
    const hL = V([-0.17, PV, pose.sit ? 0.15 : 0]).applyMatrix4(bodyM), hR = V([0.17, PV, pose.sit ? 0.15 : 0]).applyMatrix4(bodyM);
    const handL = V(pose.hL), handR = V(pose.hR);
    if (crouch) { handL.y -= crouch * 0.6; handR.y -= crouch * 0.6; }
    const air = Math.max(0, pose.y - 0.2);                        // airborne height (jump/cheer): feet leave the ground with the body
    const fL = V(pose.fL), fR = V(pose.fR); fL.y += pose.liftL + 0.07 + air * 0.92; fR.y += pose.liftR + 0.07 + air * 0.92;
    if (Math.abs(fL.x - fR.x) < 0.12) { fL.x -= 0.06; fR.x += 0.06; }      // keep the feet from crossing
    const LEG = 1.5, ARM = 1.55;
    const reach = (a, b, Lmax, out, fwd, hose, maxSlack, dyn) => {
      const d0 = b.distanceTo(a), L = dyn ? Math.min(Lmax, d0 * 1.1 + 0.05) : Lmax;     // arms: just enough slack for a soft elbow (no hula-hoop loops)
      const dir = b.clone().sub(a), d = dir.length();
      if (d > L) { b.copy(a).add(dir.setLength(L)); }
      const axis = b.clone().sub(a).normalize();
      // knee/elbow bulge direction = preferred direction made perpendicular to the limb axis
      const pref = new THREE.Vector3(out, 0, fwd).normalize();
      let bend = pref.sub(axis.clone().multiplyScalar(pref.dot(axis)));
      if (bend.lengthSq() < 1e-4) bend = new THREE.Vector3(1, 0, 0).sub(axis.clone().multiplyScalar(axis.x));
      bend.normalize();
      const dd = Math.min(d, L), slack = Math.min(maxSlack, Math.sqrt(Math.max(0, (L / 2) ** 2 - (dd / 2) ** 2)));
      const mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(bend, slack * 1.05 + 0.02);
      hose.update(a, b, mid);
    };
    reach(sL, handL, ARM, -0.45, -0.85, this.armL, 0.5, true); reach(sR, handR, ARM, 0.45, -0.85, this.armR, 0.5, true);
    reach(hL, fL, LEG, -0.15, 0.95, this.legL, 0.4); reach(hR, fR, LEG, 0.15, 0.95, this.legR, 0.4);
    this.handL.position.copy(handL); this.handR.position.copy(handR);
    this.footL.position.copy(fL); this.footR.position.copy(fR);
    this.footL.position.y = Math.max(0.07, fL.y - 0.02); this.footR.position.y = Math.max(0.07, fR.y - 0.02);

    // held props (right hand: st.prop, left hand: st.propL; legacy anims imply their prop)
    const pr = st.prop || LEGACY_PROP[st.anim], pl = st.propL;
    for (const [k, p] of Object.entries(this.props)) p.visible = false;
    if (pr && this.props[pr]) { const p = this.props[pr]; p.visible = true; p.position.copy(handR); p.rotation.set(0, 0, 0);
      if (pr === 'roller') p.rotation.set(0.5, 0, 0); if (pr === 'gavel') p.rotation.set(-0.4 - Math.max(0, Math.sin(t * 5)) * 0.6, 0, 0);
      const hand = p.getObjectByName('hand'); if (hand) hand.rotation.z = -t * 2; }
    if (pl && this.props[pl] && pl !== pr) { const p = this.props[pl]; p.visible = true; p.position.copy(handL); p.rotation.set(0, 0, 0); }
  }
  hide() { this.root.visible = false; }
}
