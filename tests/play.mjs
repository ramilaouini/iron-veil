// Drives the real game in headless Chromium with real keyboard events; reports state + console errors.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (q, s) => { try { const p = q.url.split('?')[0]; const d = await readFile(join(root, p)); s.writeHead(200, { 'Content-Type': types[extname(p)] || 'text/plain' }); s.end(d); } catch { s.writeHead(404); s.end(); } }).listen(0);
const port = srv.address().port;
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); }); pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
await pg.goto(`http://localhost:${port}/tests/fight.html${process.argv[2] || ''}`); await pg.waitForTimeout(500);
const out = process.argv[3] || '/tmp/claude-0/shots/fight';
const script = process.argv[4] || 'basic';
const st = () => pg.evaluate(() => { const m = g.match; return { phase: m.phase, t: m.t, hp: m.f.map(f => f.hp), st: m.f.map(f => f.state), x: m.f.map(f => Math.round(f.x)), combo: m.combo.map(c => c.hits), wins: m.wins, fps: g.fps }; });
await pg.waitForTimeout(2500);  // intro
console.log('after intro', JSON.stringify(await st()));
await pg.screenshot({ path: out + '_a.png' });
if (script === 'basic') {
  await pg.keyboard.down('KeyD'); await pg.waitForTimeout(700); await pg.keyboard.up('KeyD');
  for (const k of ['KeyJ', 'KeyU', 'KeyK']) { await pg.keyboard.press(k); await pg.waitForTimeout(160); }
  await pg.screenshot({ path: out + '_b.png' });
  await pg.keyboard.press('KeyO'); await pg.waitForTimeout(350); await pg.screenshot({ path: out + '_c.png' });
  await pg.waitForTimeout(3000);
  console.log('later', JSON.stringify(await st()));
  await pg.screenshot({ path: out + '_d.png' });
}
console.log(logs.join('\n') || 'no console errors');
await b.close(); srv.close();
