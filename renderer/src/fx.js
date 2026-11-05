// Deterministic particle effects, positioned around the camera's focus. Driven per beat by  "fx": {...}
//   dust: 0..1 (floating motes, catch the light)   rain: 0..1   confetti: 0..1   coins: 0..1 (falling coins)
//   sparks: {at:[x,y,z], amt}   smoke: {at:[x,y,z], amt}   debris: {at:[x,y,z], t0: 0..1 (beat progress of the burst)}
//   paper: 0..1 (falling sheets)   steam: {at:[x,y,z]}
import * as THREE from 'three';

const hash = (n) => { const x = Math.sin(n * 91.345 + 47.853) * 43758.5453; return x - Math.floor(x); };
function softSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}

class PointCloud {
  constructor(n, size, color, additive = true, tex) {
    this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, color, sizeAttenuation: true, fog: false });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.g = g;
  }
  commit(count) { this.g.setDrawRange(0, count); this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true; }
}

export function createFX(scene) {
  const tex = softSprite();
  const dust = new PointCloud(260, 0.09, 0xfff2d0, true, tex);
  const sparks = new PointCloud(160, 0.16, 0xffc060, true, tex);
  const smoke = new PointCloud(90, 2.6, 0xffffff, false, tex);
  smoke.mat.opacity = 0.35;
  // rain streaks
  const RN = 700, rainPos = new Float32Array(RN * 6), rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.55, fog: false })); rain.frustumCulled = false;
  // instanced flat bits: confetti / coins / paper / debris
  const mkInst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m; };
  const confetti = mkInst(new THREE.PlaneGeometry(0.16, 0.24), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false }), 220);
  const pal = [0xff5470, 0xffd23f, 0x3ec1d3, 0x8a5cf6, 0x4ade80, 0xff8a3d].map((c) => new THREE.Color(c));
  for (let i = 0; i < 220; i++) confetti.setColorAt(i, pal[i % pal.length]);
  const coins = mkInst(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 0.3, roughness: 0.35, emissive: 0xc08a20, emissiveIntensity: 0.9 }), 120);
  const paper = mkInst(new THREE.PlaneGeometry(0.5, 0.65), new THREE.MeshStandardMaterial({ color: 0xf3ead6, side: THREE.DoubleSide, roughness: 0.9 }), 40);
  const debris = mkInst(new THREE.BoxGeometry(0.25, 0.18, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a6a5a, roughness: 0.9 }), 80);
  const all = [dust.points, sparks.points, smoke.points, rain, confetti, coins, paper, debris];
  all.forEach((o) => scene.add(o));
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1);

  function fallInst(mesh, n, center, t, amt, fall, spin, spread = 9, height = 10, phaseScale = 1) {
    const cnt = Math.floor(n * amt);
    for (let i = 0; i < n; i++) {
      if (i >= cnt) { M4.makeScale(0, 0, 0); mesh.setMatrixAt(i, M4); continue; }
      const hx = hash(i * 3.1), hz = hash(i * 7.7), hy = hash(i * 1.9);
      const cyc = height / fall, u = ((t * phaseScale + hy * cyc) % cyc) / cyc;
      P.set(center[0] + (hx - 0.5) * spread * 2 + Math.sin(t * 1.3 + i) * 0.4, center[1] + height * (1 - u) - 1, center[2] + (hz - 0.5) * spread * 1.4 + Math.cos(t * 1.1 + i) * 0.4);
      E.set(t * spin * (0.6 + hx), t * spin * (0.4 + hz), t * spin * 0.5 + i); Q.setFromEuler(E); M4.compose(P, Q, SC); mesh.setMatrixAt(i, M4);
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.visible = cnt > 0;
  }

  return {
    update(fx, t, focus, lt, dur) {
      fx = fx || {};
      const f = focus;
      // dust motes drifting in a box around the focus
      const dA = fx.dust ?? 0.35, dn = Math.floor(dust.n * dA);
      for (let i = 0; i < dn; i++) {
        const o = i * 3;
        dust.pos[o] = f[0] + (hash(i) - 0.5) * 22 + Math.sin(t * 0.3 + i) * 0.6;
        dust.pos[o + 1] = f[1] + ((hash(i + 11) * 9 + t * (0.08 + hash(i + 3) * 0.12)) % 9);
        dust.pos[o + 2] = f[2] + (hash(i + 23) - 0.5) * 22 + Math.cos(t * 0.27 + i) * 0.6;
        const b = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + hash(i) * 1.2) + i)); dust.col[o] = b; dust.col[o + 1] = b * 0.95; dust.col[o + 2] = b * 0.8;
      }
      dust.commit(dn); dust.points.visible = dn > 0;
      // sparks: burst fountain
      if (fx.sparks) {
        const c = fx.sparks.at || f, a = fx.sparks.amt ?? 1, sn = Math.floor(sparks.n * a);
        for (let i = 0; i < sn; i++) {
          const life = 0.9, ph = ((t + hash(i) * life) % life) / life, vx = (hash(i + 5) - 0.5) * 6, vz = (hash(i + 9) - 0.5) * 6, vy = 3 + hash(i + 2) * 5, tt = ph * life;
          const o = i * 3; sparks.pos[o] = c[0] + vx * tt; sparks.pos[o + 1] = c[1] + vy * tt - 9.8 * tt * tt; sparks.pos[o + 2] = c[2] + vz * tt;
          const k = 1 - ph; sparks.col[o] = k; sparks.col[o + 1] = k * 0.75; sparks.col[o + 2] = k * 0.35;
        }
        sparks.commit(sn); sparks.points.visible = true;
      } else sparks.points.visible = false;
      // smoke / steam: rising soft puffs
      const sm = fx.smoke || fx.steam;
      if (sm) {
        const c = sm.at || f, a = sm.amt ?? 1, n = Math.floor(smoke.n * a), steam = !!fx.steam;
        for (let i = 0; i < n; i++) {
          const life = 4, ph = ((t + hash(i) * life) % life) / life, o = i * 3;
          smoke.pos[o] = c[0] + (hash(i + 1) - 0.5) * 1.5 + Math.sin(t + i) * ph * 1.5; smoke.pos[o + 1] = c[1] + ph * 7; smoke.pos[o + 2] = c[2] + (hash(i + 4) - 0.5) * 1.5;
          const k = Math.sin(ph * Math.PI) * (steam ? 0.9 : 0.55); smoke.col[o] = k; smoke.col[o + 1] = k; smoke.col[o + 2] = k * (steam ? 1 : 0.95);
        }
        smoke.commit(n); smoke.points.visible = true;
      } else smoke.points.visible = false;
      // rain
      const rA = fx.rain ?? 0, rn = Math.floor(RN * rA);
      for (let i = 0; i < rn; i++) {
        const x = f[0] + (hash(i) - 0.5) * 40, z = f[2] + (hash(i + 7) - 0.5) * 40, y = f[1] + 14 - ((t * 22 + hash(i + 3) * 18) % 18), o = i * 6;
        rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + 0.08; rainPos[o + 4] = y - 0.9; rainPos[o + 5] = z;
      }
      rg.setDrawRange(0, rn * 2); rg.attributes.position.needsUpdate = true; rain.visible = rn > 0;
      fallInst(confetti, 220, f, t, fx.confetti ?? 0, 2.2, 3.5);
      fallInst(coins, 120, f, t, fx.coins ?? 0, 4.5, 4, 7);
      fallInst(paper, 40, f, t, fx.paper ?? 0, 1.4, 1.2);
      // debris burst from a point at beat progress t0
      if (fx.debris) {
        const c = fx.debris.at || f, t0 = (fx.debris.t0 ?? 0) * dur, tt = Math.max(0, lt - t0);
        for (let i = 0; i < 80; i++) {
          const vx = (hash(i + 1) - 0.5) * 10, vz = (hash(i + 2) - 0.5) * 10, vy = 4 + hash(i + 3) * 7;
          let y = c[1] + vy * tt - 9.8 * tt * tt; if (y < 0.1) y = 0.1;
          P.set(c[0] + vx * Math.min(tt, 1.4), y, c[2] + vz * Math.min(tt, 1.4)); E.set(tt * 6 * hash(i), tt * 5, 0); Q.setFromEuler(E); SC.setScalar(lt >= t0 ? 0.6 + hash(i + 9) : 0); M4.compose(P, Q, SC); debris.setMatrixAt(i, M4);
        }
        SC.set(1, 1, 1); debris.instanceMatrix.needsUpdate = true; debris.visible = true;
      } else debris.visible = false;
    },
  };
}
