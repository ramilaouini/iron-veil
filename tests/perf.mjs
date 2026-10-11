import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (q, s) => { try { const p = q.url.split('?')[0]; const d = await readFile(join(root, p)); s.writeHead(200, { 'Content-Type': types[extname(p)] || 'text/plain' }); s.end(d); } catch { s.writeHead(404); s.end(); } }).listen(0);
const b = await chromium.launch({ args: ['--enable-gpu-rasterization'] }); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
for (const stage of [0, 1, 2, 3]) {
  await pg.goto(`http://localhost:${srv.address().port}/tests/fight.html?stage=${stage}`); await pg.waitForTimeout(2800);
  const r = await pg.evaluate(() => { g.running = false; const T = (fn, n = 60) => { const t = performance.now(); for (let i = 0; i < n; i++) fn(); return +((performance.now() - t) / n).toFixed(2); };
    return { tick: T(() => g.tick()), render: T(() => g.render()), stageBack: T(() => { g.stage.drawBack(g.ctx, g.cam, g.frame); }), floor: T(() => g.stage.drawFloor(g.ctx, g.cam, g.frame)), front: T(() => g.stage.drawFront(g.ctx, g.cam, g.frame)), fighters: T(() => { for (const f of g.match.f) g._drawFighter(g.ctx, f, g.cam, g.frame); }), hud: T(() => g.hud.draw(g.ctx, g.match, {})) }; });
  console.log('stage', stage, JSON.stringify(r));
}
await b.close(); srv.close();
