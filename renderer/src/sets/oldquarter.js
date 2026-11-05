// Hanoi Old Quarter street, c. 1902: narrow tube-houses with tiled roofs, shutters, balconies, shop signs, lanterns, laundry,
// baskets, carrying poles, rickshaw, trees, a sewer manhole and bounty posters. Street runs along Z; camera usually looks -Z.
// beat.rats = {n, tailless, mode, speed};  beat.posters = true shows the bounty posters.
import * as THREE from 'three';
import { T, P, m, tm, box, cyl, plane, bake, rng, OUT } from './dress.js';
import { ratSwarm } from './rats.js';

const COLS = ['#d9a441', '#6fa8a0', '#d98f8a', '#e8d9b0', '#9fbf8a', '#c9b06a', '#8fb0c8', '#e0b878'];
const SIGNS = ['GẠO', 'TRÀ', 'VẢI LỤA', 'THUỐC BẮC', 'ĐỒ SỨ', 'CHÈ', 'TIỆM VÀNG', 'HÀNG MÃ', 'GIẤY', 'MUỐI'];

function shophouse(g, x, z, w, h, side, i, r) {
  const hs = new THREE.Group(); const col = COLS[i % COLS.length];
  const wall = tm(T.plaster(col, i + 3, [w / 4, h / 4]), 0.9);
  const fx = -side;                  // facade faces the street centre (+x for left side houses)
  box(hs, 2.5, h, w, wall, 0, h / 2, 0);
  // ground floor shop opening (dark interior + goods)
  box(hs, 0.2, 2.6, w * 0.8, m(0x2a1c18, 0.9), fx * 1.2, 1.3, 0);
  const shelfN = Math.floor(w / 1.3);
  for (let k = 0; k < shelfN; k++) { const zz = -w * 0.35 + k * (w * 0.7 / Math.max(1, shelfN - 1)); P.basket(hs, fx * 1.6, zz, 0.6, [0xd9c27a, 0x9a5a3a, 0xe8e2c8, 0x6a8a4a][(i + k) % 4]); }
  box(hs, 0.35, 0.6, w * 0.82, m(0x6a4228, 0.8), fx * 1.45, 0.3, 0);          // shop counter
  // shop sign board
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.75), tm(T.sign(SIGNS[i % SIGNS.length], ['#a8322a', '#1f3a5a', '#2a5a3a', '#5a2a4a'][i % 4], '#f3dfa0', 'bold 58px serif'), 0.6));
  sign.position.set(fx * 1.27, 3.05, 0); sign.rotation.y = fx * Math.PI / 2; hs.add(sign);
  // awning
  const aw = box(hs, 1.4, 0.06, w * 0.95, tm(T.wood('#7a5a3a', [3, 1], 20), 0.8), fx * 1.9, 2.75, 0); aw.rotation.z = fx * 0.25;
  // upper floors: shutters, balcony
  const floors = Math.max(1, Math.floor((h - 3) / 2.6));
  for (let f = 0; f < floors; f++) {
    const y = 4.4 + f * 2.6; const nW = w > 4 ? 2 : 1;
    for (let k = 0; k < nW; k++) {
      const zz = nW === 1 ? 0 : (k - 0.5) * w * 0.45;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.7), tm(T.shutter(['#3f7a6a', '#2f5a7a', '#7a3a2a', '#5a6a3a'][(i + f + k) % 4]), 0.8));
      sh.position.set(fx * 1.26, y, zz); sh.rotation.y = fx * Math.PI / 2; hs.add(sh);
      box(hs, 0.08, 0.1, 1.3, m(0xe8e0cc, 0.8), fx * 1.27, y + 0.95, zz); box(hs, 0.08, 0.1, 1.3, m(0xe8e0cc, 0.8), fx * 1.27, y - 0.92, zz);
    }
    if (f === 0 && r() < 0.75) {       // balcony with railing + plants
      box(hs, 0.9, 0.12, w * 0.85, m(0xd8cfb8, 0.8), fx * 1.65, y - 1.0, 0);
      for (let b = 0; b <= 10; b++) box(hs, 0.04, 0.7, 0.04, m(0x2a2a30, 0.5), fx * 2.05, y - 0.6, -w * 0.42 + b * (w * 0.84 / 10));
      box(hs, 0.05, 0.05, w * 0.86, m(0x2a2a30, 0.5), fx * 2.05, y - 0.25, 0);
      const bal = new THREE.Group(); bal.position.y = y - 0.94; hs.add(bal);
      if (r() < 0.7) P.plant(bal, fx * 1.6, -w * 0.3, 0.45); if (r() < 0.5) P.pot(bal, fx * 1.6, w * 0.3, 0.5, 0x2f6a8a);
    }
  }
  // tiled roof sloping toward the street
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, w + 0.3), tm(T.tiles('#b8583a', [2, w / 2]), 0.8));
  roof.position.set(fx * 0.25, h + 0.45, 0); roof.rotation.z = fx * 0.38; roof.castShadow = true; hs.add(roof);
  box(hs, 0.25, 0.25, w + 0.4, m(0x8a3a28, 0.7), -fx * 0.95, h + 0.95, 0);
  // red lanterns on some fronts
  if (r() < 0.6) P.lanternRed(hs, fx * 2.2, 2.35, -w * 0.3, 0.7); if (r() < 0.4) P.lanternRed(hs, fx * 2.2, 2.35, w * 0.3, 0.7, 0xe8a030);
  hs.position.set(x, 0, z); g.add(hs);
  return hs;
}

export default {
  name: 'oldquarter',
  sky: true,
  build() {
    const g = new THREE.Group(), r = rng(1902);
    // ground: dirt road with stone kerbs and gutters
    plane(g, 16, 200, tm(T.dirt('#a8865e', [6, 70]), 0.95), 0, 0, -60, 0, -Math.PI / 2);
    for (const s of [-1, 1]) { box(g, 1.2, 0.18, 200, tm(T.stones('#9a8a7a', [1, 80]), 0.9), s * 6.2, 0.09, -60); box(g, 0.25, 0.05, 200, m(0x4a3a30, 0.9), s * 5.5, 0.02, -60); }
    // manhole cover at the centre
    const mh = cyl(g, 0.9, 0.9, 0.06, m(0x3a3a40, 0.4, { metalness: 0.6 }), 0, 0.04, -3, 28);
    for (let k = -3; k <= 3; k++) box(g, 1.5 - Math.abs(k) * 0.15, 0.02, 0.06, m(0x2a2a30, 0.5, { metalness: 0.6 }), 0, 0.085, -3 + k * 0.22);
    void mh;
    // houses on both sides
    let i = 0;
    for (const side of [-1, 1]) { let z = 22; while (z > -110) { const w = 3.4 + r() * 2.2, h = 6.5 + r() * 5; shophouse(g, side * 8.3, z - w / 2, w, h, side, i++, r); z -= w + 0.05; } }
    // colonial building closing the vista
    const cb = new THREE.Group(); box(cb, 26, 13, 3, tm(T.plaster('#e8c86a', 77, [6, 3]), 0.9), 0, 6.5, 0);
    for (let k = -5; k <= 5; k++) { cyl(cb, 0.35, 0.4, 9, m(0xf3ead6, 0.7), k * 2.3, 4.5, 1.7, 12); }
    box(cb, 27, 0.8, 4, m(0xf3ead6, 0.7), 0, 9.4, 0.5); box(cb, 27, 0.5, 4, m(0xf3ead6, 0.7), 0, 13.2, 0.5);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1, 3, 1), m(0xf3ead6, 0.7)); ped.rotation.set(Math.PI / 2, 0, Math.PI / 2); ped.scale.set(0.45, 1, 1.4); ped.position.set(0, 14.6, 1); cb.add(ped);
    cb.position.set(0, 0, -112); g.add(cb);
    // street life: trees, lamp posts, rickshaws, carry poles, stools, crates, baskets, laundry across the street
    for (const [x, z] of [[-5.3, 8], [5.4, -18], [-5.4, -40], [5.2, -62]]) P.tree(g, x, z, 1.1);
    for (const z of [2, -26, -54]) { P.lampPost(g, -5.6, z, 6); P.lampPost(g, 5.6, z - 13, 6).rotation.y = Math.PI; }
    P.rickshaw(g, 3.8, -11, -0.3); P.rickshaw(g, -3.6, -36, 2.8);
    P.carryPole(g, -3.9, 4, 0.2, 0xe8d9a8); P.carryPole(g, 4.2, -30, -0.4, 0x6a9a4a);
    for (let k = 0; k < 14; k++) { const s = r() < 0.5 ? -1 : 1, z = 14 - r() * 90; const kind = r(); if (kind < 0.3) P.stool(g, s * (4.4 + r() * 0.8), z, 0.8, [0xc23a30, 0x3a6ac2][k % 2]); else if (kind < 0.55) P.crate(g, s * (4.6 + r()), z, 0.8, r() * 2); else if (kind < 0.8) P.basket(g, s * (4.3 + r()), z, 0.8, [0xe8e2c8, 0xd9a441, 0x8a5a3a][k % 3]); else P.pot(g, s * (4.6 + r()), z, 0.8, [0x2f5a7a, 0x7a3a2a][k % 2]); }
    for (const [z, y] of [[-8, 7.2], [-22, 7.8], [-47, 7.4]]) P.laundry(g, -6.6, 6.6, y, z, Math.floor(z));
    // overhead wires
    for (const z of [-4, -30, -58]) box(g, 13.5, 0.03, 0.03, m(0x1d1a22), 0, 8.6 + (z % 3) * 0.2, z);
    // bounty posters (shown when beat.posters)
    const posters = new THREE.Group(); posters.userData.dynamic = true;
    const pm = tm(T.poster(['AVIS', '---', '#PRIME', '1 CENT', 'PAR QUEUE', 'DE RAT', '~']), 0.9);
    for (const [x, z, ry] of [[-6.9, -5, Math.PI / 2], [6.9, -9, -Math.PI / 2], [-6.9, -15, Math.PI / 2], [6.9, 1.5, -Math.PI / 2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.75), pm); p.position.set(x, 4.0, z); p.rotation.y = ry; posters.add(p); const o = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.85), m(0x2a1a14)); o.position.set(x - Math.sign(x) * 0.005 * -1, 4.0, z); o.rotation.y = ry; posters.add(o); }
    g.add(posters);
    bake(g);
    const rats = ratSwarm({ count: 160, area: [-5, -26, 5, 10], seed: 3, scale: 0.45 }); g.add(rats.group);
    // houses sit at |x| = 8.3 with 2.5 depth -> facades at |x| ~ 7.05; nudge houses inward so facades meet the kerb
    return {
      group: g,
      update(st, t, beat) {
        posters.visible = !!beat.posters;
        const R = beat.rats; rats.group.visible = !!R; if (R) rats.update(t, R);
      },
    };
  },
};
