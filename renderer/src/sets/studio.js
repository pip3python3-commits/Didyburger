// Generic "studio" world: soft cyclorama backdrop + floor + floating geometric props.
// Good for abstract / concept explainers. Colours per beat:  "setColors": {"backdrop":"#3d3a5c","floor":"#6b5a73"}
export default {
  name: 'studio',
  sky: false,
  build({ THREE, mulberry }) {
    const g = new THREE.Group(), r = mulberry(77);
    const floorM = new THREE.MeshStandardMaterial({ color: 0x6b5a73, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const backM = new THREE.MeshBasicMaterial({ color: 0x3d3a5c, side: THREE.BackSide, fog: false });
    const back = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 70, 48, 1, true), backM); back.position.y = 30; g.add(back);
    const mats = [0xe8a23a, 0x4a7fd6, 0xd6533f, 0x5bb59a, 0xb06bd0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    const shapes = [];
    for (let i = 0; i < 26; i++) {
      const k = i % 3, geo = k === 0 ? new THREE.BoxGeometry(1, 1, 1) : k === 1 ? new THREE.SphereGeometry(0.6, 16, 12) : new THREE.ConeGeometry(0.6, 1.2, 14);
      const m = new THREE.Mesh(geo, mats[i % mats.length]); const a = r() * Math.PI * 2, d = 14 + r() * 30;
      m.position.set(Math.sin(a) * d, 0.8 + r() * 6, -Math.abs(Math.cos(a)) * d - 6 + (r() - 0.5) * 20); const s = 1 + r() * 3.5; m.scale.setScalar(s); m.castShadow = true;
      g.add(m); shapes.push({ m, ph: r() * 6, y0: m.position.y, s });
    }
    return {
      group: g,
      update(st, t, beat) {
        const c = beat.setColors || {};
        back.material.color.set(c.backdrop || '#3d3a5c'); floorM.color.set(c.floor || '#6b5a73');
        for (const s of shapes) { s.m.position.y = s.y0 + Math.sin(t * 0.8 + s.ph) * 0.4; s.m.rotation.y = t * 0.3 + s.ph; }
      },
    };
  },
};
