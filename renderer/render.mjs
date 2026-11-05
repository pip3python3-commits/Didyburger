#!/usr/bin/env node
// Deterministic headless frame renderer.
//   node renderer/render.mjs --timeline build/timeline.json --out build/frames --width 720 --height 1280 --fps 30 --workers 4
//   node renderer/render.mjs ... --from 0 --to 450          (render only frames [0,450) -- used by the CI matrix)
//   node renderer/render.mjs --timeline build/timeline.json --out build/stills --stills 0.5,6,12   (preview a few instants)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']] : a), []));
const timelinePath = args.timeline || 'build/timeline.json';
const outDir = path.resolve(ROOT, args.out || 'build/frames');
const workers = Math.max(1, +(args.workers || Math.max(1, Math.floor(os.cpus().length / 2))));
const paint = args.paint ?? '1', msaa = args.msaa ?? '4';
const stills = args.stills ? args.stills.split(',').map(Number) : null;
const timeline = JSON.parse(fs.readFileSync(path.resolve(ROOT, timelinePath), 'utf8'));
const FMT = timeline.format || {};
const W = +(args.width || FMT.width || 720), H = +(args.height || FMT.height || 1280);
const FPS = +(args.fps || FMT.fps || timeline.fps || 30);
const total = Math.ceil(timeline.duration * FPS);
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'renderer/index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const launchArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'];
const exe = process.env.CHROMIUM_PATH || undefined;

async function worker(id, frames) {
  const browser = await chromium.launch({ headless: true, args: launchArgs, executablePath: exe });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error(`[w${id}] pageerror:`, e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error(`[w${id}] console:`, m.text()); });
  await page.goto(`http://127.0.0.1:${port}/renderer/index.html?w=${W}&h=${H}&paint=${paint}&msaa=${msaa}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  await page.evaluate((tl) => window.init(tl), timeline);
  const t0 = Date.now(); let n = 0;
  for (const f of frames) {
    const t = stills ? f : f / FPS;
    await page.evaluate((tt) => window.renderFrame(tt), t);
    const name = stills ? `still_${String(t).replace('.', '_')}.png` : `f_${String(f).padStart(5, '0')}.jpg`;
    await page.screenshot(stills ? { path: path.join(outDir, name), type: 'png' } : { path: path.join(outDir, name), type: 'jpeg', quality: 95 });
    n++;
    if (!stills && n % 60 === 0) console.log(`[w${id}] ${n}/${frames.length} frames  ${(n / ((Date.now() - t0) / 1000)).toFixed(2)} fps`);
  }
  await browser.close();
}

const from = +(args.from ?? 0), to = Math.min(total, +(args.to ?? total));   // contiguous frame range [from, to) for CI matrix shards
const list = stills ? stills : Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
const shards = Array.from({ length: Math.min(workers, list.length) }, () => []);
list.forEach((f, i) => shards[i % shards.length].push(f));   // interleave so each worker gets an even load
console.log(`rendering ${list.length} ${stills ? 'stills' : 'frames'} @ ${W}x${H} with ${shards.length} worker(s)`);
const T0 = Date.now();
await Promise.all(shards.map((s, i) => worker(i, s)));
server.close();
console.log(`done in ${((Date.now() - T0) / 1000).toFixed(1)}s`);
