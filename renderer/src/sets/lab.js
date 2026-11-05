// "Sprout Labs": a small hardware-startup workshop.
//  Zones (author coordinates, set origin):
//    SCREEN : big wall screen centred at (0, 7.6, -13.8), 14 x 7.875 units, shows beat.visual (see visuals.js)
//    BENCH  : electronics workbench at x=-17 against the back wall (boards, scope, iron, laptop), stand at z~-7
//    GREEN  : plant shelves + the Sprout prototype at x=+17, stand at z~-7
//  Per-beat colours:  "setColors": {"wall":"#..", "floor":"#..", "accent":"#.."}
import { drawVisual } from '../visuals.js';

export default {
  name: 'lab',
  sky: false,
  build({ THREE, mulberry, canvasTex, plankTex }) {
    const g = new THREE.Group(), rnd = mulberry(4242), LEDS = [];
    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
    const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true; if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; (o.parent || g).add(m); return m; };

    // ---------------- room shell
    const floorTex = canvasTex(512, 512, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { const v = 0.9 + rnd() * 0.1; c.fillStyle = `rgba(0,0,0,${(1 - v) * 0.9})`; c.fillRect(x + 2, y + 2, 60, 60); }
      c.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i <= w; i += 64) { c.fillRect(i, 0, 3, h); c.fillRect(0, i, w, 3); }
    }, [14, 10]);
    const floorM = std('#7a8a9a', { map: floorTex, roughness: 0.9 });
    const floor = add(new THREE.PlaneGeometry(64, 44), floorM, 0, 0, 3, { cast: false, rx: -Math.PI / 2 });
    const wallTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,0.06)'; for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 2, h); }, [10, 2]);
    const wallM = std('#5c8f8a', { map: wallTex, roughness: 0.95 });
    const back = add(new THREE.PlaneGeometry(64, 20), wallM, 0, 10, -14.2, { cast: false });
    const sideM = wallM;
    add(new THREE.PlaneGeometry(44, 20), sideM, -30, 10, 3, { cast: false, ry: Math.PI / 2 });
    add(new THREE.PlaneGeometry(44, 20), sideM, 30, 10, 3, { cast: false, ry: -Math.PI / 2 });
    const trimM = std('#2c2440');
    add(new THREE.BoxGeometry(64, 0.6, 0.3), trimM, 0, 0.3, -14.05, { cast: false });          // skirting
    const accentM = std('#f29a3a', { roughness: 0.6 });
    add(new THREE.BoxGeometry(64, 0.35, 0.2), accentM, 0, 3.0, -14.08, { cast: false });       // accent stripe
    // rug
    const rug = add(new THREE.CircleGeometry(7, 40), std('#c25a4a', { roughness: 1 }), 0, 0.02, -4, { cast: false, rx: -Math.PI / 2 });
    rug.scale.set(1.5, 1, 1);

    // ---------------- screen
    const SW = 14, SH = SW * 9 / 16;
    const cnv = document.createElement('canvas'); cnv.width = 1280; cnv.height = 720;
    const ctx = cnv.getContext('2d');
    const scrTex = new THREE.CanvasTexture(cnv); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.anisotropy = 8;
    scrTex.minFilter = THREE.LinearMipmapLinearFilter; scrTex.generateMipmaps = true;
    add(new THREE.BoxGeometry(SW + 0.8, SH + 0.8, 0.4), std('#16131f', { roughness: 0.4 }), 0, 7.6, -13.95);
    const screen = add(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false, fog: false }), 0, 7.6, -13.72, { cast: false, recv: false });
    add(new THREE.BoxGeometry(1.2, 2.6, 0.3), std('#16131f'), 0, 2.4, -13.9);                  // mount

    // ---------------- workbench zone (x ~ -17)
    const BX = -17, wood = std('#b07a4a', { map: plankTex('#b07a4a', '#8a5a34') });
    add(new THREE.BoxGeometry(10, 0.3, 3), wood, BX, 2.0, -12.2);
    for (const dx of [-4.6, 4.6]) for (const dz of [-1.2, 1.2]) add(new THREE.BoxGeometry(0.25, 2, 0.25), trimM, BX + dx, 1, -12.2 + dz);
    add(new THREE.BoxGeometry(10, 0.2, 2.6), wood, BX, 0.6, -12.2);
    // pegboard + tools
    const peg = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#d9c7a0'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(60,40,30,0.35)'; for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); } });
    add(new THREE.PlaneGeometry(10, 5), std('#ffffff', { map: peg }), BX, 5.4, -14.0, { cast: false });
    const toolM = [std('#d6533f'), std('#4a7fd6'), std('#f2d04a'), std('#3f3a50')];
    for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(0.25, 1 + rnd() * 1.4, 0.15), toolM[i % 4], BX - 4.2 + i * 1.05, 5.6 + rnd() * 0.6, -13.85);
    // PCBs with chips
    const pcbM = std('#2f8a4a', { roughness: 0.5 }), chipM = std('#1a1820', { roughness: 0.4 }), padM = std('#e0b050', { metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group(); b.position.set(BX - 3 + i * 2.6, 2.2, -11.6 + (i % 2) * 0.5); b.rotation.y = (rnd() - 0.5) * 0.6; g.add(b);
      add(new THREE.BoxGeometry(1.9, 0.08, 1.3), pcbM, 0, 0, 0, { parent: b });
      add(new THREE.BoxGeometry(0.6, 0.12, 0.6), chipM, -0.3, 0.09, 0, { parent: b });
      for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.2, 0.1, 0.12), chipM, 0.45, 0.08, -0.4 + k * 0.27, { parent: b });
      add(new THREE.BoxGeometry(1.7, 0.03, 0.08), padM, 0, 0.05, 0.58, { parent: b });
      const led = add(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4a3a' }), 0.7, 0.12, 0.4, { parent: b, cast: false }); led.userData.led = i; LEDS.push(led);
    }
    // oscilloscope with live trace
    const scope = new THREE.Group(); scope.position.set(BX + 3.4, 2.15, -12.6); scope.rotation.y = -0.25; g.add(scope);
    add(new THREE.BoxGeometry(2.4, 1.6, 1.4), std('#3a5a8a'), 0, 0.8, 0, { parent: scope });
    const scnv = document.createElement('canvas'); scnv.width = 256; scnv.height = 160; const sctx = scnv.getContext('2d');
    const scopeTex = new THREE.CanvasTexture(scnv); scopeTex.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshBasicMaterial({ map: scopeTex, toneMapped: false }), -0.25, 0.85, 0.71, { parent: scope, cast: false });
    for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 10), std('#ddd'), 0.8, 0.4 + k * 0.28, 0.72, { parent: scope, rx: Math.PI / 2 });
    // laptop
    const lap = new THREE.Group(); lap.position.set(BX - 2.6, 2.17, -12.9); lap.rotation.y = 0.35; g.add(lap);
    add(new THREE.BoxGeometry(1.8, 0.08, 1.2), std('#c8c8d0', { metalness: 0.3 }), 0, 0, 0, { parent: lap });
    const lid = add(new THREE.BoxGeometry(1.8, 1.15, 0.06), std('#c8c8d0', { metalness: 0.3 }), 0, 0.58, -0.6, { parent: lap }); lid.rotation.x = -0.25;
    const lcnv = canvasTex(128, 80, (c, w, h) => { c.fillStyle = '#1b1830'; c.fillRect(0, 0, w, h); const cl = ['#6fb1ff', '#f2d04a', '#3ec1a8', '#ef6f9a', '#f4ecff']; for (let i = 0; i < 9; i++) { c.fillStyle = cl[i % 5]; c.fillRect(8 + (i % 3) * 8, 6 + i * 8, 30 + ((i * 37) % 60), 4); } });
    add(new THREE.PlaneGeometry(1.6, 0.95), new THREE.MeshBasicMaterial({ map: lcnv, toneMapped: false }), 0, 0.58, -0.565, { parent: lap, cast: false }).rotation.x = -0.25;
    // soldering station + multimeter
    add(new THREE.BoxGeometry(0.9, 0.5, 0.7), std('#d6533f'), BX + 0.6, 2.4, -12.9);
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), std('#ccc', { metalness: 0.7 }), BX + 0.9, 2.95, -12.6, { rz: 0.6 });
    add(new THREE.BoxGeometry(0.7, 1.0, 0.25), std('#f2d04a'), BX + 1.8, 2.65, -11.4, { rx: -0.3 });
    // stool
    add(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16), std('#d6533f'), BX + 1, 1.9, -9.5);
    add(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 8), trimM, BX + 1, 0.9, -9.5);

    // ---------------- greenhouse zone (x ~ +17)
    const GX = 17;
    const winTex = canvasTex(256, 192, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fd8ff'); gr.addColorStop(1, '#fff3c8'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#7fbf6a'; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 16) c.lineTo(x, h * 0.72 - Math.sin(x * 0.03) * 14); c.lineTo(w, h); c.fill(); c.fillStyle = '#2c2440'; c.fillRect(w / 2 - 3, 0, 6, h); c.fillRect(0, h / 2 - 3, w, 6); });
    const win = add(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false }), GX, 8.2, -14.05, { cast: false, recv: false });
    add(new THREE.BoxGeometry(9.6, 0.4, 0.6), std('#f4ecff'), GX, 5.05, -13.9);
    const shelfM = std('#e8dcc4');
    for (const y of [2.2, 4.3]) add(new THREE.BoxGeometry(5, 0.2, 1.6), shelfM, GX + 6.8, y, -12.8);
    for (const dx of [-2.4, 2.4]) add(new THREE.BoxGeometry(0.2, 4.4, 1.6), shelfM, GX + 6.8 + dx, 2.2, -12.8);
    const potM = std('#c96b3c'), leafMs = [std('#4fae5a'), std('#7fd36b'), std('#3a8a4a')];
    const leaves = [];
    function plant(x, y, z, s, seed, droopKey) {
      const r = mulberry(seed), p = new THREE.Group(); p.position.set(x, y, z); p.scale.setScalar(s); g.add(p);
      add(new THREE.CylinderGeometry(0.55, 0.4, 0.8, 14), potM, 0, 0.4, 0, { parent: p });
      add(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 14), std('#4a3022'), 0, 0.78, 0, { parent: p, cast: false });
      const n = 6 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const piv = new THREE.Group(); piv.position.y = 0.8; piv.rotation.y = (i / n) * Math.PI * 2 + r(); p.add(piv);
        const leaf = add(new THREE.SphereGeometry(0.35, 8, 6), leafMs[i % 3], 0, 0.5, 0.25, { parent: piv });
        leaf.scale.set(0.6, 1.6, 0.25); const base = 0.35 + r() * 0.5; piv.rotation.x = base;
        leaves.push({ piv, base, ph: r() * 6, droopKey });
      }
      return p;
    }
    for (let i = 0; i < 3; i++) plant(GX + 5.2 + i * 1.6, 2.3, -12.6, 0.8, 50 + i);
    for (let i = 0; i < 3; i++) plant(GX + 5.2 + i * 1.6, 4.4, -12.6, 0.7, 60 + i);
    // Sprout prototype on a pedestal
    add(new THREE.BoxGeometry(2.6, 2.4, 2.6), std('#f4ecff'), GX, 1.2, -10.5);
    const proto = plant(GX, 2.4, -10.5, 1.3, 7, 'proto');
    add(new THREE.BoxGeometry(0.9, 0.6, 0.5), std('#3a5a8a'), GX + 0.95, 2.75, -10.1);          // controller box on the pot
    const protoLed = add(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#3ec1a8' }), GX + 0.95, 2.85, -9.84, { cast: false });
    add(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 16), new THREE.MeshStandardMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.6, roughness: 0.1 }), GX - 2.2, 3.2, -10.8);   // water tank
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(GX - 2.2, 4.0, -10.8), new THREE.Vector3(GX - 1.3, 4.6, -10.6), new THREE.Vector3(GX - 0.4, 3.9, -10.4)]), 16, 0.06, 6);
    add(tube, std('#3ec1a8'), 0, 0, 0);
    // Gerald, the office fern (big, by the screen)
    const gerald = plant(-10.5, 0, -12, 2.0, 99, 'gerald');
    void proto; void gerald;

    // ---------------- ceiling lamps (emissive)
    const lampM = new THREE.MeshBasicMaterial({ color: '#fff4d6' });
    for (const x of [-17, 0, 17]) {
      add(new THREE.CylinderGeometry(0.03, 0.03, 4, 4), trimM, x, 16, -6, { cast: false });
      add(new THREE.ConeGeometry(1.3, 1.1, 20, 1, true), std('#2c2440', { side: THREE.DoubleSide }), x, 13.6, -6, { cast: false });
      add(new THREE.SphereGeometry(0.45, 12, 8), lampM, x, 13.2, -6, { cast: false, recv: false });
    }
    // boxes + cable reels for clutter
    const boxM = [std('#d8a860'), std('#c49250')];
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(1.6, 1.2, 1.4), boxM[i % 2], -27 + (i % 2) * 1.8, 0.6 + Math.floor(i / 2) * 1.2, -11 + (i % 2) * 0.3, { ry: rnd() * 0.3 });
    add(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 18), std('#4a7fd6'), 26, 0.3, -9, { rx: Math.PI / 2 });

    // ---------------- state
    let lastKey = '';
    function drawScope(t) {
      const w = 256, h = 160; sctx.fillStyle = '#0d1a14'; sctx.fillRect(0, 0, w, h);
      sctx.strokeStyle = 'rgba(80,200,140,0.25)'; sctx.lineWidth = 1; for (let x = 0; x < w; x += 32) { sctx.beginPath(); sctx.moveTo(x, 0); sctx.lineTo(x, h); sctx.stroke(); } for (let y = 0; y < h; y += 32) { sctx.beginPath(); sctx.moveTo(0, y); sctx.lineTo(w, y); sctx.stroke(); }
      sctx.strokeStyle = '#7dffb0'; sctx.lineWidth = 3; sctx.beginPath();
      for (let x = 0; x < w; x++) { const ph = x * 0.08 + t * 6; const y = h / 2 - (Math.sin(ph) > 0 ? 40 : -40) * 0.9; x ? sctx.lineTo(x, y) : sctx.moveTo(x, y); }
      sctx.stroke(); scopeTex.needsUpdate = true;
    }
    return {
      group: g,
      update(st, t, beat) {
        const c = beat.setColors || {};
        wallM.color.set(c.wall || '#5c8f8a'); floorM.color.set(c.floor || '#8a96a6'); accentM.color.set(c.accent || '#f29a3a');
        // screen
        const v = beat.visual || { t: 'logo' };
        const p = beat._p ?? 1;
        const settled = v.full || p > 0.9;
        const key = JSON.stringify(v).length + ':' + beat.id + ':' + (settled ? 'S' + Math.floor(t * 4) : Math.floor(t * 24));
        if (key !== lastKey) { drawVisual(ctx, 1280, 720, v, p, t); scrTex.needsUpdate = true; lastKey = key; }
        drawScope(t);
        // plants sway; droop if world.droop (0..1) for Gerald
        const droop = st.droop || 0;
        for (const L of leaves) { const d = L.droopKey === 'gerald' ? droop : L.droopKey === 'proto' ? (st.protoDroop || 0) : 0; L.piv.rotation.x = L.base + Math.sin(t * 1.3 + L.ph) * 0.04 + d * 1.1; }
        protoLed.material.color.set(Math.floor(t * 2) % 2 ? '#3ec1a8' : '#1f6a5a');
        for (const o of LEDS) o.material.color.set(Math.floor(t * 3 + o.userData.led) % 2 ? '#ff4a3a' : '#5a1a14');
        void win; void screen; void back; void floor;
      },
    };
  },
};
