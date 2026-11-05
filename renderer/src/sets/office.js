// French colonial municipal office, 1902: encaustic tile floor, wood wainscot, tall shuttered windows with light (fx.rays +
// fx.raysFrom:[0,6,-9.5]), ceiling fan, big desk with ledger, papers, coin stacks, a jar and a growing heap of rat tails
// (world.tails 0..1), map of Hanoi, bounty poster, cabinets, shelves, clock, plants. Desk at origin, room spans x +-9, z -10..+6.
import * as THREE from 'three';
import { T, P, m, tm, box, cyl, plane, bake, rng } from './dress.js';

function tileTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#e8dcc2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const x = i * 128, y = j * 128;
    g.fillStyle = '#2f5a6a'; g.beginPath(); g.moveTo(x + 64, y + 8); g.lineTo(x + 120, y + 64); g.lineTo(x + 64, y + 120); g.lineTo(x + 8, y + 64); g.closePath(); g.fill();
    g.fillStyle = '#c8553a'; g.beginPath(); g.arc(x + 64, y + 64, 26, 0, 7); g.fill();
    g.fillStyle = '#e8dcc2'; g.beginPath(); g.arc(x + 64, y + 64, 12, 0, 7); g.fill();
    g.fillStyle = '#d9a441'; for (const [a, b] of [[x, y], [x + 128, y], [x, y + 128], [x + 128, y + 128]]) { g.beginPath(); g.arc(a, b, 16, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeRect(x, y, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 8); t.anisotropy = 8; return t;
}

export default {
  name: 'office',
  sky: false,
  build() {
    const g = new THREE.Group(), r = rng(11);
    plane(g, 18, 16, new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.6 }), 0, 0, -2, 0, -Math.PI / 2);
    const wall = tm(T.plaster('#efe2c0', 31, [4, 2]), 0.9), wain = tm(T.wood('#6a3e24', [8, 1], 24), 0.7);
    box(g, 18, 9, 0.3, wall, 0, 4.5, -10); box(g, 0.3, 9, 16, wall, -9, 4.5, -2); box(g, 0.3, 9, 16, wall, 9, 4.5, -2);
    box(g, 18, 1.6, 0.1, wain, 0, 0.8, -9.8); box(g, 0.1, 1.6, 16, wain, -8.8, 0.8, -2); box(g, 0.1, 1.6, 16, wain, 8.8, 0.8, -2);
    box(g, 18, 0.5, 0.4, m(0xf3ead6, 0.7), 0, 8.8, -9.7);       // cornice
    plane(g, 18, 16, m(0xe8dcc2, 0.9), 0, 9, -2, 0, Math.PI / 2);
    // tall windows with shutters open + bright exterior
    for (const x of [-5.5, 0, 5.5]) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.4), new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffe8b0, emissiveIntensity: 1.25 })); glow.position.set(x, 4.6, -9.82); g.add(glow);
      for (const s of [-1, 1]) { const sh = box(g, 0.9, 4.4, 0.06, tm(T.shutter('#3f6a5a'), 0.8), x + s * 1.55, 4.6, -9.55); sh.rotation.y = s * 0.5; }
      box(g, 2.3, 0.15, 0.4, m(0xf3ead6, 0.7), x, 2.35, -9.75); box(g, 0.08, 4.4, 0.1, m(0xf3ead6), x, 4.6, -9.78); box(g, 2.0, 0.08, 0.1, m(0xf3ead6), x, 5.6, -9.78);
    }
    // desk with clutter
    const desk = new THREE.Group(); const dw = tm(T.wood('#6a3a1e', [2, 1], 40), 0.55);
    box(desk, 4.4, 0.18, 2.0, dw, 0, 1.4, 0, 0, true); box(desk, 1.2, 1.3, 1.8, dw, -1.55, 0.65, 0, 0, true); box(desk, 1.2, 1.3, 1.8, dw, 1.55, 0.65, 0, 0, true);
    for (const x of [-1.55, 1.55]) for (const y of [0.35, 0.8]) { box(desk, 1.0, 0.36, 0.04, dw, x, y, 0.91); cyl(desk, 0.05, 0.05, 0.06, m(0xd9a43a, 0.3, { metalness: 0.8 }), x, y, 0.95, 8).rotation.x = Math.PI / 2; }
    P.papers(desk, -0.9, 1.5, -0.2, 7, 3); P.coins(desk, 1.0, 1.49, 0.1, 7, 5);
    box(desk, 0.6, 0.12, 0.8, m(0x6b2f22, 0.6), -0.1, 1.55, 0.2); box(desk, 0.55, 0.08, 0.76, m(0xf1e6cc, 0.9), -0.1, 1.62, 0.2);   // open ledger
    cyl(desk, 0.12, 0.14, 0.18, m(0x1d1a22, 0.3), 1.7, 1.58, -0.5, 10); cyl(desk, 0.01, 0.01, 0.4, m(0xe8e2d4), 1.72, 1.8, -0.5, 6).rotation.z = 0.3;   // inkwell + quill
    // scales
    cyl(desk, 0.05, 0.08, 0.7, m(0xc9a040, 0.3, { metalness: 0.8 }), 0.4, 1.85, -0.6, 8); box(desk, 0.9, 0.04, 0.04, m(0xc9a040, 0.3, { metalness: 0.8 }), 0.4, 2.2, -0.6);
    for (const s of [-1, 1]) cyl(desk, 0.18, 0.12, 0.05, m(0xc9a040, 0.3, { metalness: 0.8 }), 0.4 + s * 0.42, 1.95, -0.6, 14);
    g.add(desk);
    // chair behind the desk
    const ch = new THREE.Group(); box(ch, 1.0, 0.12, 1.0, dw, 0, 1.0, 0); box(ch, 1.0, 1.4, 0.12, dw, 0, 1.75, -0.45); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(ch, 0.08, 1.0, 0.08, dw, a * 0.42, 0.5, b * 0.42); ch.position.set(0, 0, -1.9); g.add(ch);
    // wall dressing: map, poster, clock, cabinets, shelves, plants, flag-free coat rack
    const map = plane(g, 4.2, 3.1, new THREE.MeshStandardMaterial({ map: T.map(), roughness: 0.9 }), -6.2, 5.2, -9.82); void map;
    box(g, 4.4, 3.3, 0.08, m(0x5a3a22, 0.7), -6.2, 5.2, -9.86);
    const poster = plane(g, 1.7, 2.3, tm(T.poster(['AVIS', '---', '#PRIME', '1 CENT', 'PAR QUEUE', 'DE RAT', '~']), 0.9), 8.83, 4.6, -6, -Math.PI / 2); void poster;
    const clock = cyl(g, 0.6, 0.6, 0.1, m(0xf3ead6, 0.6), 3.0, 7.3, -9.8, 24); clock.rotation.x = Math.PI / 2; const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 24), m(0x5a3a22, 0.5)); ring.position.set(3.0, 7.3, -9.74); g.add(ring);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; box(g, 0.04, 0.12, 0.02, m(0x1d1a22), 3.0 + Math.sin(a) * 0.48, 7.3 + Math.cos(a) * 0.48, -9.72); }
    P.shelf(g, -8.4, -4, 2.8, 4.2, Math.PI / 2, 4); P.shelf(g, 8.4, 0.5, 2.8, 4.2, -Math.PI / 2, 8);
    for (const z of [-8.6, -7.4]) { box(g, 1.1, 2.6, 1.0, tm(T.wood('#5a3a26', [1, 1], 64), 0.6), 7.9, 1.3, z, 0, true); for (const y of [0.5, 1.2, 1.9]) cyl(g, 0.06, 0.06, 0.08, m(0xd9a43a, 0.3, { metalness: 0.8 }), 7.33, y, z, 8).rotation.z = Math.PI / 2; }
    P.plant(g, -7.8, -8.8, 1.3, 0x2f5a7a); P.plant(g, 7.6, 4.5, 1.2, 0xb5653a);
    // counting table with crates of tails at the side
    P.table(g, -4.8, 1.2, 2.6, 1.4, 1.2); P.crate(g, -6.6, 2.6, 0.9, 0.3); P.crate(g, -6.4, 3.8, 0.8, -0.2); P.basket(g, -3.3, 2.8, 0.9, 0xc98d8a);
    bake(g);
    // ceiling fan (dynamic)
    const fan = new THREE.Group(); fan.userData.dynamic = true; cyl(fan, 0.04, 0.04, 1.2, m(0x3a2a22, 0.5), 0, 0.6, 0, 8); cyl(fan, 0.25, 0.25, 0.25, m(0x6a4a2a, 0.5), 0, 0, 0, 12);
    for (let k = 0; k < 4; k++) { const b = box(fan, 2.2, 0.04, 0.38, m(0x6a3a1e, 0.6), 0, -0.05, 0); b.rotation.y = (k / 4) * Math.PI; b.geometry.translate(0, 0, 0); }
    fan.position.set(0, 7.6, -2); g.add(fan);
    // heap of rat tails on the desk/table (grows with world.tails)
    const N = 260, tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0.03, 0.22), new THREE.Vector3(0.0, 0.0, 0.45), new THREE.Vector3(0.1, 0.02, 0.62)]), 8, 0.025, 5);
    const tails = new THREE.InstancedMesh(tg, m(0xc98d8a, 0.6), N); tails.castShadow = true; tails.frustumCulled = false; g.add(tails);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), Pv = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1);
    const tailSpots = Array.from({ length: N }, (_, i) => { const onTable = i % 2; const k = i / N; return { x: (onTable ? -4.8 : 1.0) + (r() - 0.5) * (onTable ? 2.0 : 1.2) * (1 - k * 0.6), y: (onTable ? 1.32 : 1.52) + k * 0.6 * r(), z: (onTable ? 1.2 : 0.35) + (r() - 0.5) * (onTable ? 1.0 : 0.6) * (1 - k * 0.6), a: r() * 6.28, b: (r() - 0.5) * 0.6 }; });
    return {
      group: g,
      update(st, t, beat) {
        fan.rotation.y = t * 2.4;
        const n = Math.floor(N * (st.tails ?? 0));
        for (let i = 0; i < N; i++) { const s = tailSpots[i]; Pv.set(s.x, s.y, s.z); E.set(s.b, s.a, 0); Q.setFromEuler(E); SC.setScalar(i < n ? 1 : 0); M4.compose(Pv, Q, SC); tails.setMatrixAt(i, M4); }
        tails.instanceMatrix.needsUpdate = true;
      },
    };
  },
};
