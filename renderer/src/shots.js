// Shot presets: turn  {type, f:[x,y,z] | "actorId", az, dist, h, fov, move}  into a {from,to} camera move.
// Characters face +Z, so az=0 is a straight-on front view; positive az swings the camera toward +X.
const D2R = Math.PI / 180;
const PRESETS = {
  wide:   { dist: 26, h: 5.5, fov: 62, ty: 3 },
  medium: { dist: 9,  h: 3.2, fov: 48, ty: 3 },
  close:  { dist: 5.5, h: 3.1, fov: 40, ty: 3 },
  low:    { dist: 11, h: 0.9, fov: 60, ty: 4.5 },     // heroic low angle
  high:   { dist: 22, h: 16,  fov: 55, ty: 0 },       // looking down on the scene
  prop:   { dist: 7,  h: 2.5, fov: 44, ty: 2.5 },     // product-shot style on an object
};
export const SHOT_TYPES = Object.keys(PRESETS);
export const SHOT_MOVES = ['push', 'pull', 'orbit', 'drift', 'crane', 'static'];

export function buildCam(s, fPos) {
  const p = { ...PRESETS[s.type || 'medium'], ...s };
  const f = fPos || s.f || [0, 0, 0];
  const az = (p.az || 0) * D2R, move = p.move || 'push', amt = p.amount ?? 0.22;
  const at = (dist, a, h, fov, tyAdd = 0) => ({
    p: [f[0] + Math.sin(a) * dist, f[1] + h, f[2] + Math.cos(a) * dist],
    t: [f[0], f[1] + p.ty + tyAdd, f[2]],
    fov,
  });
  const from = at(p.dist, az, p.h, p.fov);
  let to;
  switch (move) {
    case 'push':  to = at(p.dist * (1 - amt), az, p.h, p.fov); break;
    case 'pull':  to = at(p.dist * (1 + amt), az, p.h, p.fov); break;
    case 'orbit': to = at(p.dist, az + (p.orbit ?? 28) * D2R, p.h, p.fov); break;
    case 'drift': to = at(p.dist, az + 8 * D2R, p.h, p.fov); break;
    case 'crane': to = at(p.dist, az, p.h + (p.rise ?? 5), p.fov, -(p.rise ?? 5) * 0.35); break;
    default:      to = at(p.dist, az, p.h, p.fov);
  }
  return { from, to, ease: p.ease || 'inOut', shake: p.shake ?? 0.03 };
}

// Expand shorthand in a beat: actor {id,pos,to,rot,anim,face} -> tl ; shot -> cam.
export function normalizeBeat(b) {
  for (const a of b.actors || []) {
    if (!a.tl) {
      const k0 = { at: 0, anim: a.anim || 'idle', face: a.face || 'neutral', pos: a.pos || [0, 0, 0], rot: a.rot ?? 0 };
      if (a.scale) k0.scale = a.scale;
      if (a.speed) k0.speed = a.speed;
      a.tl = [k0];
      if (a.to) a.tl.push({ at: 1, pos: a.to });
      for (const extra of a.then || []) a.tl.push(extra);      // e.g. then:[{at:0.5, anim:'shock', face:'shock'}]
    }
  }
  if (!b.cam && b.shot) {
    let f = b.shot.f;
    if (typeof f === 'string') {
      const a = (b.actors || []).find((x) => x.id === f);
      const k = a && a.tl.find((q) => q.pos);
      const e = a && [...a.tl].reverse().find((q) => q.pos);
      f = k ? [(k.pos[0] + e.pos[0]) / 2, (k.pos[1] + e.pos[1]) / 2, (k.pos[2] + e.pos[2]) / 2] : [0, 0, 0];
    }
    b.cam = buildCam(b.shot, f);
  }
  if (!b.cam) throw new Error(`beat '${b.id}' needs "cam" or "shot"`);
  return b;
}
