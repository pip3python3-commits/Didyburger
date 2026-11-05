// Hand-held and set-dressing props. Each factory returns a THREE.Group whose origin is the grip point (for held props)
// or the floor contact point (for set dressing). Shared by rig.js (held) and the sets (dressing).
import * as THREE from 'three';

const M = new Map();
export function mat(color, rough = 0.7, metal = 0, extra = {}) {
  const k = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  return M.get(k);
}
const OUT = new THREE.MeshBasicMaterial({ color: 0x1a0f16, side: THREE.BackSide });
export function outlined(mesh, thick = 1.06) { const o = new THREE.Mesh(mesh.geometry, OUT); o.scale.setScalar(thick); mesh.add(o); mesh.castShadow = true; return mesh; }
const add = (g, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

function textCanvas(lines, w = 256, h = 320, bg = '#f3ead6', ink = '#2a1a24', font = 'bold 28px serif') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = ink; g.textAlign = 'center';
  let y = 44;
  for (const L of lines) {
    if (L === '---') { g.fillRect(24, y - 18, w - 48, 3); y += 18; continue; }
    if (L === '~') { for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(42,26,36,.55)'; g.fillRect(28, y - 14 + i * 16, w - 56 - (i * 37) % 60, 6); } g.fillStyle = ink; y += 50; continue; }
    g.font = font; g.fillText(L, w / 2, y); y += 38;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function paperMat(lines, opts = {}) { return new THREE.MeshStandardMaterial({ map: textCanvas(lines, opts.w, opts.h, opts.bg, opts.ink, opts.font), roughness: 0.9 }); }

const F = {
  stopwatch() { const g = new THREE.Group(); const b = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 24), mat(0xc9ccd4, 0.25, 0.8)), 0, 0.18, 0.06); b.rotation.x = Math.PI / 2; outlined(b);
    const f = add(g, new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), mat(0xfaf6ee, 0.5)), 0, 0.18, 0.1); void f;
    const h = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.13, 0.01), mat(0xc0302a)), 0, 0.22, 0.105); h.name = 'hand';
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), mat(0xc9ccd4, 0.25, 0.8)), 0, 0.42, 0.06); return g; },
  paper() { const g = new THREE.Group(); const p = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.01), paperMat(['NOTICE', '---', '~', '~'])), 0, 0.3, 0.12); outlined(p, 1.03); return g; },
  ledger() { const g = new THREE.Group(); const c = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.1), mat(0x6b2f22, 0.6)), 0, 0.3, 0.12); outlined(c, 1.04);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.08), mat(0xf1e6cc, 0.9)), 0.03, 0.3, 0.12); return g; },
  coin() { const g = new THREE.Group(); const c = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), mat(0xd9a43a, 0.3, 0.9)), 0, 0.12, 0.1); c.rotation.x = Math.PI / 2; outlined(c, 1.08); return g; },
  money() { const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const c = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 18), mat(0xd9a43a, 0.3, 0.9)), 0, 0.05 + i * 0.035, 0.12); outlined(c, 1.05); } return g; },
  tails() { const g = new THREE.Group(); const m = mat(0xc98d8a, 0.6);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const pts = []; for (let k = 0; k < 6; k++) pts.push(new THREE.Vector3(Math.sin(a) * (0.03 + k * 0.015), -k * 0.12, Math.cos(a) * (0.03 + k * 0.015) + Math.sin(k + i) * 0.03));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018, 5), m); add(g, tube, 0, 0, 0.1); }
    add(g, new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), mat(0x8a6a3a)), 0, 0, 0.1).rotation.x = Math.PI / 2; return g; },
  trap() { const g = new THREE.Group(); const w = mat(0x8c8f96, 0.4, 0.7); const base = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.4), mat(0x7a5232, 0.8)), 0, -0.35, 0.15); outlined(base);
    for (let i = 0; i <= 6; i++) add(g, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.4), w), -0.35 + i * 0.117, -0.2, 0.15);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.012, 0.4), w), 0, -0.05, 0.15); add(g, new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI), w), 0, -0.05, 0.15); return g; },
  lantern() { const g = new THREE.Group(); const fr = mat(0x3a2a22, 0.6, 0.3);
    add(g, new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), fr), 0, 0.05, 0.1);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 12), fr), 0, -0.05, 0.1);
    const gl = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffb04a, emissiveIntensity: 2.2, roughness: 0.3 })), 0, -0.24, 0.1); gl.castShadow = false;
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.06, 12), fr), 0, -0.42, 0.1); return g; },
  cane() { const g = new THREE.Group(); add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 8), mat(0x3b2316, 0.4)), 0, -0.7, 0.12); add(g, new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0xd9a43a, 0.3, 0.9)), 0, 0.06, 0.12); return g; },
  mug() { const g = new THREE.Group(); const c = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.22, 16), mat(0xf2efe8, 0.4)), 0, 0.1, 0.14); outlined(c); add(g, new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), mat(0xf2efe8, 0.4)), 0.12, 0.1, 0.14); return g; },
  net() { const g = new THREE.Group(); add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), mat(0x9a7448, 0.7)), 0, 0.5, 0.12);
    const r = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 20), mat(0x6a4a2a)), 0, 1.4, 0.12); r.rotation.x = 0.3;
    add(g, new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, wireframe: true })), 0, 1.15, 0.2).rotation.x = Math.PI; return g; },
  bucket() { const g = new THREE.Group(); const b = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.4, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide })), 0, 0, 0.12); outlined(b, 1.04); return g; },
  roller() { const g = new THREE.Group(); const r = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), mat(0x6b3a1a, 0.5)), 0, 0.2, 0); r.rotation.z = Math.PI / 2; add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), mat(0x2a1a24)), 0, -0.2, 0); return g; },
  gavel() { const g = new THREE.Group(); const h = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 12), mat(0x6b3d1e)), 0, 0.3, 0); h.rotation.z = Math.PI / 2; add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), mat(0x4a2b14)), 0, 0, 0); return g; },
  jar() { const g = new THREE.Group(); add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xcfe6e8, roughness: 0.1, transparent: true, opacity: 0.45 })), 0, 0.1, 0.18);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.3, 12), mat(0xc98d8a, 0.7)), 0, 0.0, 0.18); add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 16), mat(0x8a6a3a)), 0, 0.38, 0.18); return g; },
  pen() { const g = new THREE.Group(); const p = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.008, 0.35, 8), mat(0x1c1a22, 0.3)), 0, 0.12, 0.1); p.rotation.x = 0.4; return g; },
  fan() { const g = new THREE.Group(); const m = mat(0xe0c47a, 0.8); for (let i = 0; i < 7; i++) { const b = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.01), m), 0, 0.22, 0.1); b.rotation.z = (i - 3) * 0.22; b.geometry.translate(0, 0.0, 0); } return g; },
};
export const PROP_KINDS = Object.keys(F);
export function makeProp(kind) { return (F[kind] || F.coin)(); }
