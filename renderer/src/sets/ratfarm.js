// Rat farm on the outskirts of Hanoi: flooded rice paddies with sprout rows, earth dikes, bamboo, palms, a thatched shed with
// rows of cages full of rats, baskets, lanterns, distant hills. Shed at origin, paddies toward -Z. beat.rats = {...} for the cages.
import * as THREE from 'three';
import { T, P, m, tm, box, cyl, plane, bake, rng } from './dress.js';
import { ratSwarm } from './rats.js';

function thatch() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#b8955a'; g.fillRect(0, 0, 256, 256); const r = rng(3);
  for (let i = 0; i < 1400; i++) { const x = r() * 256, y = r() * 256; g.strokeStyle = `rgba(${r() < 0.5 ? '90,60,30' : '230,200,140'},${0.15 + r() * 0.3})`; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + 18 + r() * 20); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t; }

export default {
  name: 'ratfarm',
  sky: true,
  build() {
    const g = new THREE.Group(), r = rng(21);
    plane(g, 220, 220, tm(T.dirt('#8a7a4a', [40, 40]), 0.95), 0, -0.02, -40, 0, -Math.PI / 2);
    // paddies: reflective water panels separated by dikes, with sprout rows (instanced)
    const water = new THREE.MeshStandardMaterial({ color: 0x7a9ab0, roughness: 0.08, metalness: 0.35 });
    const sprout = new THREE.ConeGeometry(0.06, 0.6, 4); const sm = m(0x6aa83a, 0.7);
    const pads = [];
    for (let i = -3; i <= 3; i++) for (let j = 0; j < 4; j++) { const x = i * 16, z = -16 - j * 16; if (Math.abs(x) < 10 && j === 0) continue; pads.push([x, z]); plane(g, 14.6, 14.6, water, x, 0.05, z, 0, -Math.PI / 2); box(g, 15.4, 0.35, 0.8, tm(T.dirt('#7a6a3a', [6, 1]), 0.95), x, 0.17, z + 7.7); box(g, 0.8, 0.35, 15.4, tm(T.dirt('#7a6a3a', [1, 6]), 0.95), x + 7.7, 0.17, z); }
    const SN = pads.length * 120, sp = new THREE.InstancedMesh(sprout, sm, SN); let k = 0; const M4 = new THREE.Matrix4();
    for (const [x, z] of pads) for (let a = 0; a < 12; a++) for (let b = 0; b < 10; b++) { M4.makeTranslation(x - 6 + a * 1.1 + (r() - 0.5) * 0.2, 0.3, z - 6 + b * 1.3 + (r() - 0.5) * 0.2); sp.setMatrixAt(k++, M4); }
    sp.receiveShadow = true; g.add(sp);
    // shed: posts, thatched roof, raised floor
    const post = m(0x5a3a22, 0.9);
    box(g, 12, 0.3, 7, tm(T.wood('#7a5432', [4, 1], 24), 0.85), 0, 0.5, 0);
    for (const x of [-5.6, 0, 5.6]) for (const z of [-3.2, 3.2]) cyl(g, 0.15, 0.18, 5.2, post, x, 2.6, z, 8);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 5.6, 3.2, 4, 1), new THREE.MeshStandardMaterial({ map: thatch(), roughness: 1 })); roof.rotation.y = Math.PI / 4; roof.scale.set(1.6, 1, 0.95); roof.position.set(0, 6.6, 0); roof.castShadow = true; g.add(roof);
    for (let i = 0; i < 4; i++) P.cage(g, -4.2 + i * 2.8, -1.8, 1.0); for (let i = 0; i < 4; i++) P.cage(g, -4.2 + i * 2.8, 1.6, 1.0);
    g.children.slice(-8).forEach((c) => (c.position.y = 0.65));
    for (let i = 0; i < 4; i++) { const c = new THREE.Group(); P.cage(c, 0, 0, 1.0); c.position.set(-4.2 + i * 2.8, 1.75, -1.8); g.add(c); }
    P.basket(g, 6.6, 2.4, 1.0, 0xd9c27a); P.basket(g, 7.4, 1.0, 0.9, 0xc98d8a); P.crate(g, -7.0, 2.2, 0.9, 0.3); P.carryPole(g, 7.2, -2.6, 1.2, 0xc98d8a); P.stool(g, 5.6, 4.0, 0.8, 0x8a5a34);
    for (const [x, z] of [[-11, -4], [-13, 6], [12, 7], [14, -3], [-24, -10], [26, -12]]) P.bamboo(g, x, z, 1.1);
    for (const [x, z] of [[-16, 2], [18, 1], [-30, -30], [34, -40]]) { const t = P.tree(g, x, z, 1.2, [0x2e6a34, 0x3f7a3a]); t.scale.y = 1.3; }
    // distant hills
    for (let i = 0; i < 9; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(30 + r() * 25, 16, 10), m(['#5a7a6a', '#6a8a7a', '#4a6a5a'][i % 3], 1)); h.scale.y = 0.35; h.position.set(-160 + i * 40, -4, -150 - r() * 30); g.add(h); }
    P.lanternRed(g, -5.6, 4.6, 3.4, 0.7, 0xe8a030); P.lanternRed(g, 5.6, 4.6, 3.4, 0.7, 0xe8a030);
    bake(g);
    const swarms = []; for (let i = 0; i < 4; i++) for (const [z, y] of [[-1.8, 0.75], [1.6, 0.75], [-1.8, 1.85]]) { const s = ratSwarm({ count: 9, area: [-4.2 + i * 2.8 - 0.6, z - 0.3, -4.2 + i * 2.8 + 0.6, z + 0.3], seed: i * 7 + Math.floor(z * 3), scale: 0.55 }); s.group.position.y = y; g.add(s.group); swarms.push(s); }
    const free = ratSwarm({ count: 120, area: [-12, -14, 12, 8], seed: 44, scale: 0.9 }); g.add(free.group);
    return {
      group: g,
      update(st, t, beat) {
        const R = beat.rats || {};
        for (const s of swarms) { s.update(t, { n: R.caged ?? 1, mode: 'mill', tailless: R.tailless ?? 0 }); }
        free.group.visible = !!R.free; if (R.free) free.update(t, { n: R.free, mode: R.mode || 'scurry', tailless: R.tailless ?? 0, speed: R.speed });
      },
    };
  },
};
