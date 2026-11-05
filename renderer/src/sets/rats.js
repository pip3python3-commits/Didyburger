// Instanced rat swarm (one draw call per body part, any count). Cartoon rats: grey-brown body, pink ears/nose/tail, eyes.
// swarm.update(t, {n: 0..1 visible fraction, tailless: 0..1 fraction without tails, mode: 'scurry'|'flee'|'mill'|'pile', speed})
import * as THREE from 'three';

const hash = (n) => { const x = Math.sin(n * 78.233 + 12.9898) * 43758.5453; return x - Math.floor(x); };
export function ratSwarm({ count = 120, area = [-10, -10, 10, 10], seed = 1, scale = 1, color = 0x8a7a72 }) {
  const g = new THREE.Group(); g.userData.dynamic = true;
  const parts = {
    body: [new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.85 })],
    head: [new THREE.ConeGeometry(0.2, 0.42, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.85 })],
    ear: [new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8a0a0, roughness: 0.7 })],
    eye: [new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0x140a0a })],
    nose: [new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshStandardMaterial({ color: 0xe87a8a })],
    tail: [(() => { const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.7) * 0.08, 0.05 + Math.sin(i * 0.5) * 0.06, -i * 0.11)); return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.022, 5); })(), new THREE.MeshStandardMaterial({ color: 0xd99a98, roughness: 0.6 })],
    stub: [new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ color: 0xc0504a, roughness: 0.6 })],
  };
  const per = { body: 1, head: 1, ear: 2, eye: 2, nose: 1, tail: 1, stub: 1 };
  const inst = {};
  for (const [k, [geo, mat]] of Object.entries(parts)) { const im = new THREE.InstancedMesh(geo, mat, count * per[k]); im.castShadow = k === 'body' || k === 'head'; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(im); inst[k] = im; }
  const R = Array.from({ length: count }, (_, i) => ({ x: area[0] + hash(i * 3 + seed) * (area[2] - area[0]), z: area[1] + hash(i * 7 + seed * 2) * (area[3] - area[1]), a: hash(i * 11 + seed) * 6.28, sp: 0.6 + hash(i * 13) * 0.8, ph: hash(i * 17) * 10, s: (0.8 + hash(i * 19) * 0.45) * scale, tl: hash(i * 23 + seed) }));
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), SC = new THREE.Vector3(), Z = new THREE.Matrix4().makeScale(0, 0, 0);
  const W = area[2] - area[0], D = area[3] - area[1];
  const local = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => { E.set(rx, 0, 0); Q.setFromEuler(E); P.set(x, y, z); SC.set(sx, sy, sz); return L.compose(P, Q, SC); };
  return {
    group: g,
    update(t, o = {}) {
      const nVis = Math.floor(count * (o.n ?? 1)), mode = o.mode || 'scurry', spd = o.speed ?? 1, tailless = o.tailless ?? 0;
      for (let i = 0; i < count; i++) {
        const r = R[i];
        if (i >= nVis) { for (const k of Object.keys(inst)) for (let j = 0; j < per[k]; j++) inst[k].setMatrixAt(i * per[k] + j, Z); continue; }
        let x = r.x, z = r.z, a = r.a, hop = 0;
        const tt = t * spd * r.sp + r.ph;
        if (mode === 'scurry' || mode === 'flee') {
          const dir = mode === 'flee' ? 0 : r.a; const v = mode === 'flee' ? 4 : 1.6;
          x = area[0] + (((r.x - area[0]) + Math.sin(dir) * tt * v) % W + W) % W; z = area[1] + (((r.z - area[1]) + Math.cos(dir) * tt * v) % D + D) % D; a = dir + Math.sin(tt * 3) * 0.25; hop = Math.abs(Math.sin(tt * 14)) * 0.08;
        } else if (mode === 'mill') { a = r.a + Math.sin(tt * 0.7) * 1.2; x = r.x + Math.sin(tt * 0.5) * 0.4; z = r.z + Math.cos(tt * 0.4) * 0.4; hop = Math.abs(Math.sin(tt * 9)) * 0.03; }
        else if (mode === 'pile') { const k = i / count, ring = Math.sqrt(k) * Math.min(W, D) * 0.45; x = (area[0] + area[2]) / 2 + Math.sin(i * 2.4) * ring; z = (area[1] + area[3]) / 2 + Math.cos(i * 2.4) * ring; hop = (1 - Math.sqrt(k)) * 1.6 * scale; a = i; }
        E.set(0, a, 0); Q.setFromEuler(E); P.set(x, hop, z); SC.setScalar(r.s); M.compose(P, Q, SC);
        const put = (k, j, l) => inst[k].setMatrixAt(i * per[k] + j, new THREE.Matrix4().multiplyMatrices(M, l));
        const wig = Math.sin(tt * 9) * 0.05;
        put('body', 0, local(0, 0.26, 0, 1, 0.8, 1.35));
        put('head', 0, local(0, 0.3 + wig, 0.48, 1, 1, 1, Math.PI / 2));
        put('ear', 0, local(-0.13, 0.48, 0.38, 1, 1.2, 0.5)); put('ear', 1, local(0.13, 0.48, 0.38, 1, 1.2, 0.5));
        put('eye', 0, local(-0.09, 0.38 + wig, 0.56)); put('eye', 1, local(0.09, 0.38 + wig, 0.56));
        put('nose', 0, local(0, 0.3 + wig, 0.69));
        const hasTail = r.tl >= tailless;
        put('tail', 0, hasTail ? local(0, 0.18, -0.38, 1, 1, 1, Math.sin(tt * 6) * 0.15) : new THREE.Matrix4().makeScale(0, 0, 0));
        put('stub', 0, hasTail ? new THREE.Matrix4().makeScale(0, 0, 0) : local(0, 0.24, -0.42));
      }
      for (const im of Object.values(inst)) im.instanceMatrix.needsUpdate = true;
    },
  };
}
