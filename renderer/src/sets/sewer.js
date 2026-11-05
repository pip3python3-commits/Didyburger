// Brick sewer tunnel (barrel vault) with a flowing water channel, side walkways, pipes, drips, wall lanterns,
// a grate of daylight above (use fx.rays + fx.raysFrom:[0,9,-12]) and rat swarms. Tunnel runs along Z.
// beat.rats = {n, tailless, mode, speed}
import * as THREE from 'three';
import { T, P, m, tm, box, cyl, bake, rng } from './dress.js';
import { ratSwarm } from './rats.js';

export default {
  name: 'sewer',
  sky: false,
  build() {
    const g = new THREE.Group(), r = rng(7);
    const brick = tm(T.bricks('#8a5a44', '#4a3a32', [10, 14]), 0.9);
    // vault: half cylinder (inside faces)
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 120, 32, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: brick.map, roughness: 0.9, side: THREE.BackSide }));
    vault.rotation.x = Math.PI / 2; vault.rotation.z = 0; vault.position.set(0, 2.2, -40); vault.receiveShadow = true; g.add(vault);
    for (const s of [-1, 1]) box(g, 0.4, 2.4, 120, brick, s * 6.1, 1.2, -40);
    // walkways and channel
    for (const s of [-1, 1]) { box(g, 3.6, 0.6, 120, tm(T.stones('#7a6a5e', [3, 60]), 0.9), s * 4.2, 0.3, -40); box(g, 0.2, 0.15, 120, m(0x3a3430), s * 2.45, 0.66, -40); }
    box(g, 4.8, 0.2, 120, m(0x2a2420, 0.9), 0, -0.6, -40);
    // ribs every 6 m
    for (let z = 18; z > -100; z -= 6) { const rib = new THREE.Mesh(new THREE.TorusGeometry(6, 0.25, 6, 24, Math.PI), m(0x6a4232, 0.9)); rib.position.set(0, 2.2, z); g.add(rib); }
    // pipes along the walls
    for (const [x, y, rad, col] of [[-5.3, 3.4, 0.28, 0x5a6a6a], [-5.5, 4.2, 0.16, 0x8a5a3a], [5.4, 3.0, 0.32, 0x4a5a5a], [5.0, 5.2, 0.14, 0x6a6a72]]) { const p = cyl(g, rad, rad, 120, m(col, 0.5, { metalness: 0.4 }), x, y, -40, 12); p.rotation.x = Math.PI / 2; for (let z = 16; z > -100; z -= 9) { const c = cyl(g, rad * 1.25, rad * 1.25, 0.2, m(0x3a3a40, 0.5, { metalness: 0.5 }), x, y, z, 12); c.rotation.x = Math.PI / 2; } }
    // clutter: crates, barrels, baskets, a ladder up to the grate
    for (let k = 0; k < 10; k++) { const s = k % 2 ? 1 : -1, z = 10 - k * 9 - r() * 3; if (r() < 0.5) P.barrel(g, s * (5.1 - r() * 0.6), z, 0.8); else P.crate(g, s * (5.0 - r() * 0.5), z, 0.7, r()); g.children[g.children.length - 1].position.y = 0.6; }
    for (let y = 0.8; y < 8; y += 0.5) box(g, 1.0, 0.06, 0.06, m(0x5a5a60, 0.4, { metalness: 0.6 }), -2.9, y, -12);
    for (const s of [-1, 1]) box(g, 0.06, 7.6, 0.06, m(0x5a5a60, 0.4, { metalness: 0.6 }), -2.9 + s * 0.5, 4.4, -12);
    // daylight grate in the vault (bright emissive slot)
    const grate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 2.2), new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xfff0c0, emissiveIntensity: 1.8 })); grate.position.set(-2.4, 7.55, -12); g.add(grate);
    for (let k = -3; k <= 3; k++) box(g, 2.3, 0.12, 0.08, m(0x1d1a22), -2.4, 7.45, -12 + k * 0.3);
    // wall lanterns (emissive) + a few warm point lights
    for (let z = 12; z > -90; z -= 14) for (const s of [-1, 1]) { P.lanternRed(g, s * 5.6, 4.6, z - (s > 0 ? 7 : 0), 0.6, 0xe8a030); }
    // moss / slime streaks: dark green planes on the walls
    for (let k = 0; k < 26; k++) { const s = r() < 0.5 ? -1 : 1; const p = new THREE.Mesh(new THREE.PlaneGeometry(0.4 + r() * 0.8, 0.8 + r() * 1.6), m(0x3a5a2a, 0.9)); p.position.set(s * 5.88, 1.6 + r() * 1.2, 15 - r() * 100); p.rotation.y = -s * Math.PI / 2; g.add(p); }
    bake(g);
    const lights = []; for (const z of [8, -12, -30]) { const L = new THREE.PointLight(0xffb060, 34, 26, 1.5); L.position.set(0, 4.5, z); g.add(L); lights.push(L); }
    const day = new THREE.SpotLight(0xfff0d0, 45, 18, 0.5, 0.6, 1.2); day.position.set(-2.4, 7.5, -12); day.target.position.set(-2.4, 0, -12); g.add(day, day.target);
    // water: animated ripples in a custom shader
    const wu = { t: { value: 0 }, c1: { value: new THREE.Color('#141c18') }, c2: { value: new THREE.Color('#2e3a2c') } };
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 120, 1, 1), new THREE.ShaderMaterial({ uniforms: wu, fog: false,
      vertexShader: 'varying vec2 vUv; varying vec3 vW; varying vec3 vL; void main(){ vUv = uv; vL = position; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: 'uniform float t; uniform vec3 c1, c2; varying vec2 vUv; varying vec3 vW; varying vec3 vL; float h(vec2 p){ return sin(p.x*4.1 + sin(p.y*0.7)*1.5)*0.5 + sin(p.y*2.3 + t*4.0 + sin(p.x*3.0))*0.5; } void main(){ float a = h(vW.xz*vec2(1.3,0.6)); float b = h(vW.xz*vec2(2.7,1.4)+4.0); float k = smoothstep(0.7,1.0, a*0.6+b*0.4); vec3 c = mix(c1, c2, 0.5 + 0.5*b); float edge = smoothstep(1.7, 2.4, abs(vL.x)); c += vec3(1.0,0.75,0.45)*k*0.22; c = mix(c, c*0.6, edge); gl_FragColor = vec4(c,1.); }' }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.3, -40); g.add(water);
    // falling drips
    const drips = []; for (let k = 0; k < 14; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), m(0x9ab0a0, 0.2)); d.scale.y = 2; g.add(d); drips.push({ d, x: (r() - 0.5) * 7, z: 10 - r() * 60, o: r() * 3 }); }
    const ratsL = ratSwarm({ count: 90, area: [-5.8, -40, -2.6, 14], seed: 5, scale: 0.45 }); ratsL.group.position.y = 0.6; g.add(ratsL.group);
    const ratsR = ratSwarm({ count: 90, area: [2.6, -40, 5.8, 14], seed: 9, scale: 0.45 }); ratsR.group.position.y = 0.6; g.add(ratsR.group);
    return {
      group: g,
      update(st, t, beat) {
        wu.t.value = t;
        for (const d of drips) { const u = ((t * 0.9 + d.o) % 3) / 3; d.d.position.set(d.x, 7 - u * 7.3, d.z); }
        const R = beat.rats; for (const s of [ratsL, ratsR]) { s.group.visible = !!R; if (R) s.update(t, R); }
        for (const L of lights) L.visible = true;
      },
    };
  },
};
