// Diagram / code / chart "screen" visuals drawn on a 2D canvas (used as a texture on the lab's wall screen).
//   drawVisual(ctx, W, H, spec, p, t)   p = beat progress 0..1 (drives the reveal), t = absolute time (tiny idle motion)
// spec.t: big | list | code | blocks | layers | timing | states | memory | bits | chart | table | logo
// spec.full = true -> everything already revealed (used for "hold" beats).
// Layout keeps the bottom ~18% clear so burned-in captions never sit on top of diagram text.

export const PAL = {
  bg: '#1b1830', bg2: '#262140', grid: 'rgba(255,255,255,0.045)', ink: '#f4ecff', dim: '#9a93bd', line: '#d8d0f0',
  c: ['#f29a3a', '#4a8fe8', '#3ec1a8', '#ef6f9a', '#f2d04a', '#a67be8', '#7fd36b', '#ff7a5c'],
};
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const FONT = '"Nunito","DejaVu Sans",Arial,sans-serif';
const MONO = '"DejaVu Sans Mono","Liberation Mono",monospace';

// item i of n fades/slides in during the first ~80% of the beat
function rev(spec, p, i, n) {
  if (spec.full) return 1;
  const span = 0.8, w = Math.min(0.35, span / Math.max(1, n) * 1.6);
  const s = (n <= 1 ? 0 : (i / (n - 1)) * (span - w));
  return smooth((p - s) / w);
}
function col(i) { return PAL.c[((i % PAL.c.length) + PAL.c.length) % PAL.c.length]; }
function colOf(spec, i) { return spec.colors && spec.colors[i] ? spec.colors[i] : col(i); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fitText(g, text, maxW, size, weight = 800, font = FONT) {
  let s = size; g.font = `${weight} ${s}px ${font}`;
  while (s > 10 && g.measureText(text).width > maxW) { s -= 1; g.font = `${weight} ${s}px ${font}`; }
  return s;
}
function wrap(g, text, maxW) {
  const words = String(text).split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function arrow(g, x1, y1, x2, y2, color, wdt = 4, head = 14, f = 1) {
  const x = x1 + (x2 - x1) * f, y = y1 + (y2 - y1) * f;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = wdt; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x, y); g.stroke();
  if (f > 0.98) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45)); g.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45)); g.closePath(); g.fill();
  }
}
function background(g, W, H, t) {
  g.fillStyle = PAL.bg; g.fillRect(0, 0, W, H);
  const grd = g.createRadialGradient(W * 0.5, H * 0.35, 40, W * 0.5, H * 0.5, W * 0.75);
  grd.addColorStop(0, 'rgba(90,70,160,0.25)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = PAL.grid; g.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
}
function header(g, W, H, spec, p) {
  if (!spec.title) return 0.07 * H;
  const a = spec.full ? 1 : smooth(p / 0.12);
  g.globalAlpha = a;
  const s = fitText(g, spec.title, W * 0.86, Math.round(H * 0.075), 900);
  g.fillStyle = PAL.ink; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillText(spec.title, W * 0.06, H * 0.06 + s);
  g.fillStyle = colOf(spec, 0); rr(g, W * 0.06, H * 0.075 + s, Math.min(W * 0.3, g.measureText(spec.title).width) * a, 7, 3); g.fill();
  g.globalAlpha = 1;
  return H * 0.11 + s;
}

// ------------------------------------------------------------------ types
const T = {};

T.logo = (g, W, H, s, p, t) => {   // idle screen: company mark
  const cx = W / 2, cy = H * 0.42;
  g.save(); g.translate(cx, cy); const b = 1 + Math.sin(t * 1.4) * 0.02; g.scale(b, b);
  g.fillStyle = '#7fd36b';
  for (const k of [-1, 1]) { g.save(); g.rotate(k * 0.6); g.beginPath(); g.ellipse(k * 40, -40, 34, 70, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  g.strokeStyle = '#7fd36b'; g.lineWidth = 10; g.beginPath(); g.moveTo(0, 60); g.lineTo(0, -10); g.stroke();
  g.fillStyle = '#c96b3c'; rr(g, -60, 60, 120, 70, 12); g.fill();
  g.restore();
  g.fillStyle = PAL.ink; g.textAlign = 'center'; fitText(g, s.text || 'SPROUT', W * 0.7, 72, 900); g.fillText(s.text || 'SPROUT', cx, H * 0.74);
  if (s.sub) { g.fillStyle = PAL.dim; fitText(g, s.sub, W * 0.7, 34, 700); g.fillText(s.sub, cx, H * 0.80); }
};

T.big = (g, W, H, s, p, t) => {
  const a = s.full ? 1 : smooth(p / 0.15), k = s.full ? 1 : 0.8 + 0.2 * (1 - Math.pow(1 - a, 3));
  g.save(); g.translate(W / 2, H * 0.42); g.scale(k, k); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = String(s.text).split('\n');
  const size = Math.min(...lines.map((l) => fitText(g, l, W * 0.84, lines.length > 1 ? 120 : 170, 900)));
  g.font = `900 ${size}px ${FONT}`;
  lines.forEach((l, i) => { g.fillStyle = i === 0 ? colOf(s, 0) : PAL.ink; g.fillText(l, 0, (i - (lines.length - 1) / 2) * size * 1.08); });
  g.restore(); g.globalAlpha = 1;
  if (s.sub) { const b = s.full ? 1 : smooth((p - 0.25) / 0.2); g.globalAlpha = b; g.fillStyle = PAL.dim; g.textAlign = 'center'; fitText(g, s.sub, W * 0.8, 44, 700); g.fillText(s.sub, W / 2, H * 0.72); g.globalAlpha = 1; }
};

T.list = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), items = s.items || [], n = items.length;
  const avail = H * 0.80 - y0, rowH = Math.min(92, avail / Math.max(1, n));
  items.forEach((it, i) => {
    const a = rev(s, p, i, n); if (a <= 0) return;
    const y = y0 + rowH * i + rowH * 0.5, x = W * 0.08 + (1 - a) * 40;
    g.globalAlpha = a;
    g.fillStyle = colOf(s, i); g.beginPath(); g.arc(x + 18, y, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = PAL.bg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 22px ${FONT}`; g.fillText(s.bullets === false ? '' : String(i + 1), x + 18, y + 1);
    g.fillStyle = PAL.ink; g.textAlign = 'left'; fitText(g, it, W * 0.8, Math.min(46, rowH * 0.6), 800); g.fillText(it, x + 52, y + 2);
    g.globalAlpha = 1;
  });
};

const KW = /\b(int|void|if|else|while|for|return|static|volatile|const|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|bool|char|float|struct|typedef|enum|switch|case|break|default|unsigned|sizeof|true|false|NULL|do|extern|inline)\b/;
T.code = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), lines = s.lines || [], n = lines.length;
  const lh = Math.min(40, (H * 0.80 - y0) / Math.max(1, n)), fs = Math.round(lh * 0.74);
  const x0 = W * 0.07;
  rr(g, W * 0.045, y0 - 10, W * 0.91, lh * n + 20, 14); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fill();
  g.textBaseline = 'middle'; g.textAlign = 'left';
  const chars = lines.reduce((a, l) => a + l.length + 4, 0);
  let budget = s.full ? 1e9 : Math.floor(smooth(p / 0.75) * chars * 1.02);
  lines.forEach((raw, i) => {
    const hl = raw.startsWith('>'); const line = hl ? raw.slice(1) : raw;
    const y = y0 + lh * i + lh / 2;
    if (hl && budget > 0) { g.fillStyle = 'rgba(242,154,58,0.22)'; g.fillRect(W * 0.05, y - lh / 2, W * 0.9, lh); g.fillStyle = col(0); g.fillRect(W * 0.05, y - lh / 2, 6, lh); }
    const show = Math.max(0, Math.min(line.length, budget)); budget -= line.length + 4;
    if (show <= 0) return;
    g.font = `600 ${fs}px ${MONO}`; g.fillStyle = PAL.dim; g.textAlign = 'right'; g.fillText(String(i + 1), x0 + 26, y); g.textAlign = 'left';
    // tokenize
    let x = x0 + 44; const txt = line.slice(0, show);
    const re = /(\/\/.*$|\/\*.*?\*\/|"[^"]*"?|'[^']*'?|#\w+|0x[0-9A-Fa-f_]+|\b\d+[uUlL]*\b|\b[A-Za-z_]\w*\b|\s+|.)/g; let m;
    while ((m = re.exec(txt))) {
      const tok = m[0]; let c = PAL.ink;
      if (tok.startsWith('//') || tok.startsWith('/*')) c = '#7f9a7a';
      else if (tok[0] === '"' || tok[0] === "'") c = '#f2d04a';
      else if (tok[0] === '#') c = '#ef6f9a';
      else if (/^(0x|\d)/.test(tok)) c = '#f29a3a';
      else if (KW.test(tok) && tok.match(KW)[0] === tok) c = '#6fb1ff';
      else if (/^[A-Z_][A-Z0-9_]{2,}$/.test(tok)) c = '#3ec1a8';
      else if (/^\w+$/.test(tok) && txt[re.lastIndex] === '(') c = '#c9a7ff';
      g.fillStyle = c; g.fillText(tok, x, y); x += g.measureText(tok).width;
    }
    if (!s.full && show < line.length && Math.floor(t * 4) % 2 === 0) { g.fillStyle = PAL.ink; g.fillRect(x + 2, y - fs / 2, fs * 0.5, fs); }
  });
};

// nodes: [{name, to:[{n, label}], c}] ; layout row / grid / explicit pos [0..1, 0..1]
T.blocks = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), nodes = s.nodes || [], n = nodes.length;
  const top = y0 + 10, bot = H * 0.80, left = W * 0.06, right = W * 0.94;
  let cols = s.cols || (n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4); const rows = Math.ceil(n / cols);
  const cw = (right - left) / cols, rh = (bot - top) / rows;
  const bw = Math.min(cw * (n <= 4 && rows === 1 ? 0.6 : 0.72), 290), bh = Math.min(rh * 0.6, 110);
  const pos = {};
  nodes.forEach((nd, i) => {
    let cx, cy;
    if (nd.pos) { cx = left + nd.pos[0] * (right - left); cy = top + nd.pos[1] * (bot - top); }
    else { const r = Math.floor(i / cols), c = i % cols; const inRow = Math.min(cols, n - r * cols); cx = left + (c + 0.5 + (cols - inRow) / 2) * cw; cy = top + (r + 0.5) * rh; }
    pos[nd.name] = { cx, cy, i, w: nd.w ? nd.w * (right - left) : bw, h: bh };
  });
  // edges first
  const edges = []; nodes.forEach((nd) => (nd.to || []).forEach((e) => edges.push([nd.name, e.n, e.label, e.both])));
  const ne = n + edges.length;
  edges.forEach(([a, b, label, both], k) => {
    const A = pos[a], B = pos[b]; if (!A || !B) return;
    const f = rev(s, p, n + k, ne); if (f <= 0) return;
    const dx = B.cx - A.cx, dy = B.cy - A.cy;
    const clip = (P, sx, sy) => { const tx = Math.abs(sx) > 1e-6 ? (P.w / 2 + 8) / Math.abs(sx) : 1e9, ty = Math.abs(sy) > 1e-6 ? (P.h / 2 + 8) / Math.abs(sy) : 1e9; const k2 = Math.min(tx, ty); return [P.cx + sx * k2, P.cy + sy * k2]; };
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const [x1, y1] = clip(A, ux, uy), [x2, y2] = clip(B, -ux, -uy);
    arrow(g, x1, y1, x2, y2, PAL.line, 4, 16, f);
    if (both && f > 0.98) arrow(g, x2, y2, x1, y1, PAL.line, 4, 16, 1);
    if (label && f > 0.6) {
      g.globalAlpha = smooth((f - 0.6) / 0.4); g.font = `800 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - (Math.abs(uy) < 0.5 ? 18 : 0), lw = g.measureText(label).width + 16;
      g.fillStyle = PAL.bg; rr(g, mx - lw / 2, my - 15, lw, 30, 8); g.fill(); g.fillStyle = '#f2d04a'; g.fillText(label, mx, my); g.globalAlpha = 1;
    }
  });
  nodes.forEach((nd, i) => {
    const P = pos[nd.name], a = rev(s, p, i, ne); if (a <= 0) return;
    const k = 0.85 + 0.15 * a; g.save(); g.translate(P.cx, P.cy); g.scale(k, k); g.globalAlpha = a;
    const c = nd.c || colOf(s, i);
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, -P.w / 2 + 5, -P.h / 2 + 7, P.w, P.h, 16); g.fill();
    g.fillStyle = c; rr(g, -P.w / 2, -P.h / 2, P.w, P.h, 16); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, -P.w / 2 + 6, -P.h / 2 + 5, P.w - 12, P.h * 0.3, 10); g.fill();
    g.fillStyle = '#1b1830'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = String(nd.name).split('\n'); const fs = Math.min(...lines.map((l) => fitText(g, l, P.w - 20, Math.min(40, P.h * 0.42), 900)));
    g.font = `900 ${fs}px ${FONT}`; lines.forEach((l, j) => g.fillText(l, 0, (j - (lines.length - 1) / 2) * fs * 1.05 + 2));
    if (nd.sub) { g.fillStyle = PAL.ink; g.font = `700 ${Math.round(fs * 0.55)}px ${FONT}`; g.fillText(nd.sub, 0, P.h / 2 + 22); }
    g.restore(); g.globalAlpha = 1;
  });
};

T.layers = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), L = s.items || [], n = L.length;
  const bot = H * 0.80, gap = 10, lh = Math.min(96, (bot - y0 - gap * (n - 1)) / n);
  const tot = n * lh + (n - 1) * gap, start = y0 + (bot - y0 - tot) / 2;
  // reveal bottom-up (hardware first)
  L.forEach((it, i) => {
    const a = rev(s, p, n - 1 - i, n); if (a <= 0) return;
    const y = start + i * (lh + gap) - (1 - a) * 30, inset = (it.indent || 0) * W * 0.06;
    const x = W * 0.12 + inset, w = W * 0.76 - inset * 2 * 0 - (it.w ? (1 - it.w) * W * 0.76 : 0);
    g.globalAlpha = a; const c = it.c || colOf(s, n - 1 - i);
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x + 5, y + 6, w, lh, 14); g.fill();
    g.fillStyle = c; rr(g, x, y, w, lh, 14); g.fill();
    g.fillStyle = '#1b1830'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, it.name, w - 40, Math.min(44, lh * 0.5), 900); g.fillText(it.name, x + w / 2, y + lh / 2 + (it.sub ? -lh * 0.13 : 2));
    if (it.sub) { g.fillStyle = 'rgba(27,24,48,0.8)'; fitText(g, it.sub, w - 40, Math.min(26, lh * 0.28), 700); g.fillText(it.sub, x + w / 2, y + lh * 0.72); }
    g.globalAlpha = 1;
  });
};

// rows: [{name, wave:"0011=0", labels:["A5"]}]  0 low, 1 high, = bus/data cell, z = mid (hi-Z), | = marker column
T.timing = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), rows = s.rows || [], n = rows.length;
  const bot = H * 0.80, rh = Math.min(110, (bot - y0) / Math.max(1, n)), lx = W * 0.05, x0 = W * 0.2, x1 = W * 0.95;
  const len = Math.max(...rows.map((r) => r.wave.length)), cw = (x1 - x0) / len;
  const sweep = s.full ? 1 : smooth(p / 0.8);
  const xs = x0 + (x1 - x0) * sweep;
  // marker columns
  rows.forEach((r) => [...r.wave].forEach((ch, i) => { if (ch === '|') { g.strokeStyle = 'rgba(242,208,74,0.6)'; g.setLineDash([8, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + i * cw + cw / 2, y0); g.lineTo(x0 + i * cw + cw / 2, bot); g.stroke(); g.setLineDash([]); } }));
  rows.forEach((r, ri) => {
    const yc = y0 + rh * ri + rh / 2, hi = yc - rh * 0.28, lo = yc + rh * 0.28, c = r.c || colOf(s, ri);
    g.fillStyle = PAL.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, r.name, x0 - lx - 14, 36, 900); g.fillText(r.name, lx, yc);
    g.save(); g.beginPath(); g.rect(x0 - 2, yc - rh / 2, xs - x0 + 2, rh); g.clip();
    g.strokeStyle = c; g.lineWidth = 5; g.lineJoin = 'round';
    let prevY = null, li = 0; g.beginPath();
    const w = r.wave.replace(/\|/g, (m, i) => r.wave[i - 1] || '0');
    for (let i = 0; i < w.length;) {
      let ch = w[i], j = i + 1;
      if (ch === '=' || ch === '+') {
        while (j < w.length && w[j] === ch) j++;
        const xa = x0 + i * cw, xb = x0 + j * cw;
        g.stroke();
        g.fillStyle = c + '55'; g.beginPath(); g.moveTo(xa, yc); g.lineTo(xa + 8, hi); g.lineTo(xb - 8, hi); g.lineTo(xb, yc); g.lineTo(xb - 8, lo); g.lineTo(xa + 8, lo); g.closePath(); g.fill(); g.stroke();
        const lab = (r.labels || [])[li++]; if (lab) { g.fillStyle = PAL.ink; g.textAlign = 'center'; fitText(g, lab, xb - xa - 18, 28, 800); g.fillText(lab, (xa + xb) / 2, yc + 1); }
        g.beginPath(); prevY = null; i = j; continue;
      }
      const xa = x0 + i * cw, xb = xa + cw;
      const y = ch === '1' ? hi : ch === 'z' ? yc : lo;
      if (prevY === null) g.moveTo(xa, y); else g.lineTo(xa, y);
      g.lineTo(xb, y); prevY = y; i = j;
    }
    g.stroke(); g.restore();
  });
  if (!s.full && sweep < 1) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(xs - 2, y0, 3, bot - y0); }
};

// states: [{name, to:[{n,label}]}], on: highlighted state name
T.states = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), st = s.states || [], n = st.length;
  const cx = W / 2, cy = (y0 + H * 0.80) / 2, rx = Math.min(W * 0.36, 120 + n * 60), ry = (H * 0.80 - y0) / 2 - 60;
  const R = Math.min(78, 300 / Math.sqrt(n + 1));
  const P = {};
  st.forEach((sd, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (n === 2 ? Math.PI / 2 : 0); P[sd.name] = sd.pos ? { x: W * 0.06 + sd.pos[0] * W * 0.88, y: y0 + sd.pos[1] * (H * 0.8 - y0) } : { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }; });
  const edges = []; st.forEach((sd) => (sd.to || []).forEach((e) => edges.push([sd.name, e.n, e.label])));
  const ne = n + edges.length;
  edges.forEach(([a, b, label], k) => {
    const A = P[a], B = P[b], f = rev(s, p, n + k, ne); if (!A || !B || f <= 0) return;
    g.strokeStyle = PAL.line; g.fillStyle = PAL.line; g.lineWidth = 4;
    if (a === b) { g.beginPath(); g.arc(A.x, A.y - R - 22, 26, 0.75 * Math.PI, 2.25 * Math.PI); g.stroke(); if (label) { g.fillStyle = '#f2d04a'; g.font = `800 22px ${FONT}`; g.textAlign = 'center'; g.fillText(label, A.x, A.y - R - 62); } return; }
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, bend = 34;
    const sx = A.x + ux * R + nx * 10, sy = A.y + uy * R + ny * 10, ex = B.x - ux * (R + 6) + nx * 10, ey = B.y - uy * (R + 6) + ny * 10;
    const mx = (sx + ex) / 2 + nx * bend, my = (sy + ey) / 2 + ny * bend;
    g.beginPath(); g.moveTo(sx, sy);
    const steps = 24; for (let i = 1; i <= steps * f; i++) { const u = i / steps; g.lineTo((1 - u) * (1 - u) * sx + 2 * (1 - u) * u * mx + u * u * ex, (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * my + u * u * ey); } g.stroke();
    if (f > 0.98) { const a2 = Math.atan2(ey - my, ex - mx); g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 16 * Math.cos(a2 - 0.45), ey - 16 * Math.sin(a2 - 0.45)); g.lineTo(ex - 16 * Math.cos(a2 + 0.45), ey - 16 * Math.sin(a2 + 0.45)); g.closePath(); g.fill(); }
    if (label && f > 0.7) { g.globalAlpha = smooth((f - 0.7) / 0.3); g.font = `800 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; const lw = g.measureText(label).width + 14, lx = 0.25 * sx + 0.5 * mx + 0.25 * ex, ly = 0.25 * sy + 0.5 * my + 0.25 * ey; g.fillStyle = PAL.bg; rr(g, lx - lw / 2, ly - 14, lw, 28, 8); g.fill(); g.fillStyle = '#f2d04a'; g.fillText(label, lx, ly); g.globalAlpha = 1; }
  });
  st.forEach((sd, i) => {
    const a = rev(s, p, i, ne); if (a <= 0) return; const Q = P[sd.name], on = s.on === sd.name;
    g.globalAlpha = a; const c = sd.c || colOf(s, i);
    if (on) { g.fillStyle = 'rgba(242,208,74,0.35)'; g.beginPath(); g.arc(Q.x, Q.y, R + 14 + Math.sin(t * 6) * 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = c; g.beginPath(); g.arc(Q.x, Q.y, R * (0.8 + 0.2 * a), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b1830'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = String(sd.name).split('\n'); const fs = Math.min(...lines.map((l) => fitText(g, l, R * 1.75, 32, 900)));
    g.font = `900 ${fs}px ${FONT}`; lines.forEach((l, j) => g.fillText(l, Q.x, Q.y + (j - (lines.length - 1) / 2) * fs * 1.05 + 2));
    g.globalAlpha = 1;
  });
};

// regions: [{addr, name, size(weight), c}] drawn top = high address
T.memory = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), R = s.regions || [], n = R.length;
  const bot = H * 0.80, x = W * 0.34, w = W * 0.4, tot = R.reduce((a, r) => a + (r.size || 1), 0);
  let y = y0;
  R.forEach((r, i) => {
    const h = (bot - y0) * (r.size || 1) / tot, a = rev(s, p, i, n);
    if (a > 0) {
      g.globalAlpha = a; g.fillStyle = r.c || colOf(s, i); g.fillRect(x, y + 2, w * (0.6 + 0.4 * a), h - 4);
      g.fillStyle = '#1b1830'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, r.name, w - 20, Math.min(36, h * 0.55), 900); g.fillText(r.name, x + w / 2, y + h / 2);
      if (r.addr) { g.fillStyle = PAL.dim; g.textAlign = 'right'; g.font = `700 26px ${MONO}`; g.fillText(r.addr, x - 14, y + 16); }
      if (r.note) { g.fillStyle = PAL.ink; g.textAlign = 'left'; fitText(g, r.note, W * 0.24, 28, 800); g.fillText(r.note, x + w + 16, y + h / 2); }
      g.globalAlpha = 1;
    }
    y += h;
  });
  g.strokeStyle = PAL.line; g.lineWidth = 3; g.strokeRect(x, y0, w, bot - y0);
};

// bits: {bits:"00100000", names:["", "", "LED", ...] (MSB first), hl:[5], label:"PORTB"}
T.bits = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), bits = String(s.bits || '00000000'), n = bits.length;
  const cw = Math.min(120, (W * 0.88) / n), x0 = (W - cw * n) / 2, y = y0 + (H * 0.8 - y0) * 0.35, h = cw * 1.05;
  const hl = new Set(s.hl || []);
  for (let i = 0; i < n; i++) {
    const bitNo = n - 1 - i, a = rev(s, p, i, n); if (a <= 0) continue;
    const v = bits[i], x = x0 + i * cw, on = v === '1';
    g.globalAlpha = a;
    g.fillStyle = hl.has(bitNo) ? '#f29a3a' : on ? '#3ec1a8' : '#3a3460'; rr(g, x + 4, y, cw - 8, h, 10); g.fill();
    g.fillStyle = on || hl.has(bitNo) ? '#1b1830' : PAL.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(cw * 0.5)}px ${MONO}`; g.fillText(v, x + cw / 2, y + h / 2 + 2);
    g.fillStyle = PAL.dim; g.font = `700 ${Math.round(Math.min(24, cw * 0.32))}px ${MONO}`; g.fillText(String(bitNo), x + cw / 2, y - 18);
    const nm = (s.names || [])[i]; if (nm) { g.fillStyle = hl.has(bitNo) ? '#f29a3a' : PAL.ink; fitText(g, nm, cw * 1.6, 24, 800); g.save(); g.translate(x + cw / 2, y + h + 34); g.fillText(nm, 0, 0); g.restore(); }
    g.globalAlpha = 1;
  }
  const a2 = s.full ? 1 : smooth((p - 0.6) / 0.2);
  if (s.label && a2 > 0) { g.globalAlpha = a2; g.fillStyle = PAL.ink; g.textAlign = 'center'; g.font = `800 34px ${MONO}`; fitText(g, s.label, W * 0.86, 34, 800, MONO); g.fillText(s.label, W / 2, y + h + 96); g.globalAlpha = 1; }
};

// series: [{name, v:[...], type:'line'|'bar', c}] ; xl: x labels ; ymax optional
T.chart = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p) + 10, S = s.series || [];
  const x0 = W * 0.1, x1 = W * 0.92, yb = H * 0.74;
  const all = S.flatMap((q) => q.v); const ymax = s.ymax ?? Math.max(...all) * 1.1, ymin = s.ymin ?? Math.min(0, ...all);
  const Y = (v) => yb - (v - ymin) / (ymax - ymin) * (yb - y0);
  g.strokeStyle = PAL.dim; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, yb); g.lineTo(x1, yb); g.stroke();
  const grow = s.full ? 1 : smooth(p / 0.75);
  S.forEach((q, si) => {
    const c = q.c || colOf(s, si), m = q.v.length, dx = (x1 - x0) / m;
    if (q.type === 'bar') {
      q.v.forEach((v, i) => { const k = clamp01(grow * m - i); if (k <= 0) return; const bw = dx * 0.7 / S.length, bx = x0 + dx * i + dx * 0.15 + si * bw; const top = Y(ymin + (v - ymin) * smooth(k)); g.fillStyle = c; rr(g, bx, top, bw - 4, yb - top, 6); g.fill(); });
    } else {
      g.strokeStyle = c; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath();
      const upto = grow * (m - 1);
      for (let i = 0; i <= Math.floor(upto); i++) { const x = x0 + dx * (i + 0.5), y = Y(q.v[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      const fi = Math.floor(upto), fr = upto - fi; if (fi < m - 1) { g.lineTo(x0 + dx * (fi + 0.5 + fr), Y(q.v[fi] + (q.v[fi + 1] - q.v[fi]) * fr)); }
      g.stroke();
    }
    if (q.name) { g.fillStyle = c; g.font = `800 26px ${FONT}`; g.textAlign = 'right'; g.fillText('\u25A0 ' + q.name, x1, y0 + 10 + si * 34); }
  });
  if (s.xl) { g.fillStyle = PAL.dim; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; const m = s.xl.length, dx = (x1 - x0) / m; s.xl.forEach((l, i) => g.fillText(l, x0 + dx * (i + 0.5), yb + 26)); }
  if (s.yl) { g.save(); g.translate(x0 - 40, (y0 + yb) / 2); g.rotate(-Math.PI / 2); g.fillStyle = PAL.dim; g.font = `800 24px ${FONT}`; g.textAlign = 'center'; g.fillText(s.yl, 0, 0); g.restore(); }
  if (s.line != null) { const y = Y(s.line); g.strokeStyle = '#f2d04a'; g.setLineDash([10, 10]); g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]); }
};

T.table = (g, W, H, s, p, t) => {
  const y0 = header(g, W, H, s, p), rows = s.rows || [], n = rows.length, cols = Math.max(...rows.map((r) => r.length));
  const bot = H * 0.80, rh = Math.min(78, (bot - y0) / Math.max(1, n)), x0 = W * 0.06, tw = W * 0.88, cw = tw / cols;
  rows.forEach((r, i) => {
    const a = rev(s, p, i, n); if (a <= 0) return; const y = y0 + i * rh;
    g.globalAlpha = a;
    g.fillStyle = i === 0 ? colOf(s, 0) : i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.11)'; rr(g, x0, y + 3, tw, rh - 6, 10); g.fill();
    r.forEach((cell, j) => {
      g.fillStyle = i === 0 ? '#1b1830' : j === 0 ? '#f2d04a' : PAL.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, cell, cw - 20, Math.min(34, rh * 0.48), i === 0 ? 900 : 800); g.fillText(cell, x0 + cw * (j + 0.5), y + rh / 2 + 1);
    });
    g.globalAlpha = 1;
  });
};

export function drawVisual(ctx, W, H, spec, p, t) {
  background(ctx, W, H, t);
  const f = T[spec && spec.t] || T.logo;
  ctx.save(); f(ctx, W, H, spec || {}, p, t); ctx.restore();
  // scanline sheen
  const sh = ((t * 0.12) % 1.6) - 0.3;
  const grd = ctx.createLinearGradient(W * sh, 0, W * (sh + 0.25), H); grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.035)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
}
export const VISUAL_TYPES = ['big', 'list', 'code', 'blocks', 'layers', 'timing', 'states', 'memory', 'bits', 'chart', 'table', 'logo'];
