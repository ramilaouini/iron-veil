// Four procedurally painted arenas. Each is built from cached parallax layers (painted once) plus live animated
// overlays (clouds, lightning, steam, flames, rotating machinery, embers, rain...). All art is original and local.
import { CFG } from '../config.js';

const CX = CFG.STAGE_W / 2;             // world x at the centre of every layer
const LW = 2600, LH = 720;               // layer canvas size
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function layer(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c;
}
function lg(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function rg(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }

// Draw a parallax layer: f = parallax factor (0 = fixed to screen, 1 = moves with world).
function blit(ctx, img, cam, f, yOff = 0) {
  const zl = 1 + (cam.zoom - 1) * f;
  const pOff = cam && cam.parallax ? cam.parallax.getOffsets(f) : { x: 0, y: 0 };
  const sx = 640 - (img.width / 2) * zl - (cam.x - CX) * f * cam.zoom + pOff.x;
  const sy = 360 - 360 * zl + yOff * zl + pOff.y;
  // Subtle depth-of-field soft focus on far horizon layers (sky, distant clouds)
  const dof = f <= 0.12 && ctx.filter !== undefined && (!cam.quality || cam.quality !== 'low');
  if (dof) { ctx.save(); ctx.filter = 'blur(1px)'; }
  // Draw only the on-screen slice of the layer (big saving on software rasterisers / integrated GPUs).
  const x0 = Math.max(0, -sx), x1 = Math.min(1280, img.width * zl - sx + 0), y0 = Math.max(0, -sy), y1 = Math.min(720, img.height * zl + sy > 0 ? 720 : 0);
  const dx = Math.max(0, sx), dw = Math.min(1280, sx + img.width * zl) - dx;
  if (dw > 0) {
    const srcX = (dx - sx) / zl, srcW = dw / zl;
    const dy = Math.max(0, sy), dh = Math.min(720, sy + img.height * zl) - dy;
    if (dh > 0) ctx.drawImage(img, srcX, (dy - sy) / zl, srcW, dh / zl, dx, dy, dw, dh);
  }
  if (dof) ctx.restore();
}
export function floorScreenY(cam) {
  const py = cam && cam.parallax ? cam.parallax.getOffsets(0.85).y : 0;
  return 360 + (CFG.GROUND - 360) * cam.zoom + py;
}
export function worldToScreenX(x, cam) {
  const px = cam && cam.parallax ? cam.parallax.getOffsets(0.85).x : 0;
  return (x - cam.x) * cam.zoom + 640 + px;
}

function glowRect(ctx, x, y, w, h, col, a = 0.5, blur = 18) {
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.fillStyle = col; ctx.globalAlpha = a; ctx.fillRect(x, y, w, h); ctx.restore();
}

// ===================================================================================================
// 1. THE SUNKEN TEMPLE
// ===================================================================================================
function templeStage() {
  const R = rng(11), L = {};
  L.sky = layer(LW, LH, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, 500, [[0, '#050d14'], [0.45, '#10303a'], [0.8, '#2b4b4a'], [1, '#6b6a50']]); c.fillRect(0, 0, w, h);
    c.fillStyle = rg(c, w / 2, 420, 10, 700, [[0, 'rgba(255,230,160,0.38)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, w, h);
    // distant mountains and a broken spire
    c.fillStyle = '#0c1d26'; c.beginPath(); c.moveTo(0, 520);
    for (let x = 0; x <= w; x += 60) c.lineTo(x, 400 + Math.sin(x * 0.004) * 50 + R() * 40 + Math.abs(Math.sin(x * 0.0017)) * 60); c.lineTo(w, 560); c.lineTo(0, 560); c.fill();
    c.fillStyle = '#081821'; c.beginPath(); c.moveTo(1500, 520); c.lineTo(1520, 250); c.lineTo(1545, 300); c.lineTo(1560, 200); c.lineTo(1590, 520); c.fill();
  });
  L.clouds = layer(LW, 320, (c, w, h) => {
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, r = 60 + R() * 140; c.fillStyle = rg(c, x, y, 0, r, [[0, 'rgba(8,24,32,0.55)'], [1, 'rgba(8,24,32,0)']]); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    for (let i = 0; i < 30; i++) { const x = R() * w, y = R() * h * 0.8, r = 50 + R() * 90; c.fillStyle = rg(c, x, y, 0, r, [[0, 'rgba(70,110,110,0.22)'], [1, 'rgba(70,110,110,0)']]); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  });
  L.mid = layer(LW, LH, (c, w, h) => {
    // row of ruined colonnade, hazy
    for (let i = 0; i < 14; i++) {
      const x = 120 + i * 175 + R() * 30, top = 250 + R() * 120, wd = 52 + R() * 12;
      c.fillStyle = lg(c, x, 0, x + wd, 0, [[0, '#0e2227'], [0.5, '#17343a'], [1, '#0a1b20']]);
      c.beginPath(); c.moveTo(x, 560); c.lineTo(x, top + 12); c.lineTo(x + wd * 0.3, top); c.lineTo(x + wd * 0.55, top + 22); c.lineTo(x + wd * 0.8, top + 4); c.lineTo(x + wd, top + 16); c.lineTo(x + wd, 560); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)'; for (let g = 0; g < 4; g++) c.fillRect(x + 6 + g * 11, top + 20, 2, 560 - top);
      if (i % 3 === 1) { c.fillStyle = '#0d2026'; c.fillRect(x - 6, top - 18, wd + 12, 18); }
      if (i % 4 === 0) { c.strokeStyle = '#0f272d'; c.lineWidth = 26; c.beginPath(); c.arc(x + wd + 70, top + 38, 70, Math.PI, 0); c.stroke(); }
    }
    c.fillStyle = lg(c, 0, 420, 0, 600, [[0, 'rgba(60,100,100,0)'], [1, 'rgba(60,100,100,0.45)']]); c.fillRect(0, 420, w, 200);   // mist
  });
  L.near = layer(LW, LH, (c, w, h) => {
    // great hall wall with glyph circle and carved bands
    const x0 = 700, x1 = 1900;
    c.fillStyle = lg(c, 0, 150, 0, 600, [[0, '#142e34'], [1, '#1b3a3e']]); c.fillRect(x0, 160, x1 - x0, 440);
    c.fillStyle = '#0d1f24'; c.fillRect(x0 - 20, 150, x1 - x0 + 40, 26); c.fillRect(x0 - 20, 560, x1 - x0 + 40, 40);
    for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x0 + i * 100, 176, 3, 384); }
    // great arch
    c.fillStyle = '#071318'; c.beginPath(); c.moveTo(1130, 600); c.lineTo(1130, 330); c.arc(1300, 330, 170, Math.PI, 0); c.lineTo(1470, 600); c.fill();
    c.fillStyle = rg(c, 1300, 440, 10, 220, [[0, 'rgba(120,190,200,0.35)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(1100, 200, 400, 400);
    // carved glyph band
    c.strokeStyle = 'rgba(210,180,100,0.5)'; c.lineWidth = 2;
    for (let i = 0; i < 22; i++) { const gx = x0 + 30 + i * 52, gy = 200; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + 16, gy); c.lineTo(gx + 16, gy + 14); c.lineTo(gx + 4, gy + 14); c.lineTo(gx + 4, gy + 28); c.lineTo(gx + 22, gy + 28); c.stroke(); }
    // side pillars with broken tops
    for (const px of [610, 1990]) {
      c.fillStyle = lg(c, px, 0, px + 120, 0, [[0, '#0b1a1f'], [0.35, '#264648'], [1, '#08151a']]); c.beginPath(); c.moveTo(px, 600); c.lineTo(px, 120); c.lineTo(px + 40, 90); c.lineTo(px + 70, 130); c.lineTo(px + 120, 100); c.lineTo(px + 120, 600); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.3)'; for (let g = 0; g < 6; g++) c.fillRect(px + 12 + g * 17, 140, 3, 460);
      c.strokeStyle = 'rgba(210,180,100,0.45)'; c.lineWidth = 3; for (let g = 0; g < 5; g++) { c.strokeRect(px + 20, 230 + g * 62, 80, 36); }
    }
  });
  L.floor = layer(LW, 200, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#2f4d4c'], [0.12, '#1b3436'], [1, '#09171b']]); c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const y = 8 + i * i * 4.5 + i * 6; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    for (let x = -w; x < w * 2; x += 180) { c.beginPath(); c.moveTo(x, 0); c.lineTo(w / 2 + (x - w / 2) * 2.4, h); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, 0, w, 3);
    // standing water patches reflecting the glow
    for (let i = 0; i < 9; i++) { const x = R() * w, y = 30 + R() * 120; c.fillStyle = rg(c, x, y, 0, 130, [[0, 'rgba(130,200,200,0.28)'], [1, 'rgba(130,200,200,0)']]); c.save(); c.translate(x, y); c.scale(1, 0.14); c.translate(-x, -y); c.beginPath(); c.arc(x, y, 130, 0, 7); c.fill(); c.restore(); }
  });
  L.front = layer(LW, LH, (c, w, h) => {
    for (const [x, wd] of [[330, 150], [2120, 170]]) {
      c.fillStyle = lg(c, x, 0, x + wd, 0, [[0, '#02070a'], [0.6, '#08141a'], [1, '#02070a']]); c.beginPath(); c.moveTo(x, h); c.lineTo(x + 10, 60); c.lineTo(x + wd * 0.4, 20); c.lineTo(x + wd * 0.75, 90); c.lineTo(x + wd, 40); c.lineTo(x + wd - 8, h); c.fill();
    }
    c.strokeStyle = '#04100f'; c.lineWidth = 3;
    for (let i = 0; i < 16; i++) { const x = 300 + R() * 300 + (i % 2) * 1500, y = 0; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 15, 80, x - 15, 160, x + 4, 120 + R() * 220); c.stroke(); }
  });
  const dust = Array.from({ length: 50 }, () => ({ x: R() * 1400, y: R() * 700, v: 0.15 + R() * 0.4, s: 1 + R() * 2, ph: R() * 7 }));
  let flash = 0, nextBolt = 180;
  return {
    id: 'temple', name: 'The Sunken Temple', blurb: 'Flooded ruins under a storm that never breaks.', mood: 'temple', accent: '#7fd6d0', grade: 'rgba(20,50,60,0.12)', vignette: 'rgba(0,10,14,0.55)',
    update(t, fx) {
      if (--nextBolt <= 0) { flash = 1; nextBolt = 240 + Math.random() * 520; fx && fx.pulse('#9fe6ff', 0.18); }
      flash *= 0.9;
    },
    drawBack(ctx, cam, t) {
      blit(ctx, L.sky, cam, 0.08);
      // drifting cloud band (wraps)
      const off = (t * 0.25) % L.clouds.width; ctx.save(); ctx.globalAlpha = 0.9;
      for (const o of [-off, L.clouds.width - off]) ctx.drawImage(L.clouds, 640 - L.clouds.width / 2 + o * 0.5 - (cam.x - CX) * 0.1 * cam.zoom, 30, L.clouds.width, 320); ctx.restore();
      if (flash > 0.05) { ctx.fillStyle = `rgba(190,235,255,${flash * 0.35})`; ctx.fillRect(0, 0, 1280, 480); }
      blit(ctx, L.mid, cam, 0.28);
      blit(ctx, L.near, cam, 0.6);
      // glyph ring on the wall pulses
      const gx = 640 - (cam.x - CX) * 0.6 * cam.zoom + (1300 - LW / 2) * (1 + (cam.zoom - 1) * 0.6), gy = 330;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(230,200,110,${0.35 + 0.2 * Math.sin(t * 0.04)})`; ctx.lineWidth = 3;
      for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.arc(gx, gy, 50 + r * 18, t * 0.004 * (r % 2 ? -1 : 1), t * 0.004 * (r % 2 ? -1 : 1) + 4.2); ctx.stroke(); }
      ctx.restore();
      // light shafts (angle sways with mouse parallax)
      const mNorm = cam && cam.parallax ? cam.parallax.getMouseNorm() : { x: 0, y: 0 };
      const shaftTilt = mNorm.x * 65;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { const sx = 300 + i * 340 + Math.sin(t * 0.01 + i) * 20; ctx.fillStyle = lg(ctx, sx, 0, sx, 500, [[0, 'rgba(150,220,220,0.12)'], [1, 'rgba(150,220,220,0)']]); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + 70, 0); ctx.lineTo(sx + 200 + shaftTilt, 520); ctx.lineTo(sx + 60 + shaftTilt, 520); ctx.fill(); }
      ctx.restore();
    },
    drawFloor(ctx, cam) {
      const px = cam && cam.parallax ? cam.parallax.getOffsets(0.85).x : 0;
      const y = floorScreenY(cam), x = (CX - LW / 2 - cam.x) * cam.zoom + 640 + px;
      ctx.drawImage(L.floor, x, y, LW * cam.zoom, 200 * cam.zoom);
      ctx.fillStyle = lg(ctx, 0, y + 190 * cam.zoom, 0, 720, [[0, '#09171b'], [1, '#050c0f']]); ctx.fillRect(0, y + 190 * cam.zoom - 1, 1280, 720);
    },
    drawFront(ctx, cam, t) {
      blit(ctx, L.front, cam, 1.35);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const d of dust) { d.x -= d.v; d.y += Math.sin(t * 0.02 + d.ph) * 0.2; if (d.x < -10) d.x = 1290; ctx.fillStyle = `rgba(220,240,230,${0.25 + 0.15 * Math.sin(t * 0.03 + d.ph)})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, 7); ctx.fill(); }
      ctx.restore();
    },
  };
}

// ===================================================================================================
// 2. NEON UNDERCITY
// ===================================================================================================
function undercityStage() {
  const R = rng(23), L = {};
  const neon = ['#ff2e93', '#27e6ff', '#ffb21f', '#8a5bff', '#2dff9a'];
  const signs = [];
  L.sky = layer(LW, LH, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, 600, [[0, '#04040a'], [0.5, '#0b0e22'], [1, '#1a1430']]); c.fillRect(0, 0, w, h);
    // megastructure skyline
    for (let i = 0; i < 40; i++) {
      const x = i * 70 + R() * 30, bw = 50 + R() * 90, top = 120 + R() * 280;
      c.fillStyle = `rgb(${8 + R() * 8},${10 + R() * 10},${24 + R() * 16})`; c.fillRect(x, top, bw, 620 - top);
      for (let wy = top + 10; wy < 600; wy += 14) for (let wx = x + 6; wx < x + bw - 6; wx += 12) if (R() < 0.22) { c.fillStyle = R() < 0.5 ? 'rgba(39,230,255,0.55)' : R() < 0.5 ? 'rgba(255,178,31,0.5)' : 'rgba(255,46,147,0.45)'; c.fillRect(wx, wy, 5, 6); }
    }
    c.fillStyle = rg(c, w / 2, 540, 10, 700, [[0, 'rgba(255,46,147,0.20)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, w, h);
  });
  L.mid = layer(LW, LH, (c, w, h) => {
    // nearer buildings with neon signs; sign positions kept for flicker pass
    for (let i = 0; i < 12; i++) {
      const x = 80 + i * 205 + R() * 30, bw = 150 + R() * 50, top = 190 + R() * 140;
      c.fillStyle = lg(c, 0, top, 0, 600, [[0, '#0f1226'], [1, '#161a34']]); c.fillRect(x, top, bw, 620 - top);
      c.fillStyle = '#0a0c1a'; c.fillRect(x - 6, top - 10, bw + 12, 12);
      for (let wy = top + 24; wy < 560; wy += 34) for (let wx = x + 14; wx < x + bw - 24; wx += 30) { c.fillStyle = R() < 0.4 ? 'rgba(255,200,120,0.55)' : 'rgba(20,24,50,1)'; c.fillRect(wx, wy, 16, 20); }
      if (i % 2 === 0) { const col = neon[i % neon.length], sx = x + 16, sy = top + 50 + R() * 80, sw = 22, sh = 120; signs.push({ x: sx, y: sy, w: sw, h: sh, col, ph: R() * 9, bx: i }); }
      else { const col = neon[(i + 2) % neon.length]; signs.push({ x: x + 14, y: top + 20, w: bw - 28, h: 12, col, ph: R() * 9, bx: i }); }
    }
    c.fillStyle = lg(c, 0, 440, 0, 620, [[0, 'rgba(60,40,120,0)'], [1, 'rgba(60,40,120,0.35)']]); c.fillRect(0, 440, w, 200);
  });
  L.near = layer(LW, LH, (c, w, h) => {
    // big pipes and a catwalk
    for (let i = 0; i < 4; i++) { const y = 90 + i * 34; c.fillStyle = lg(c, 0, y, 0, y + 26, [[0, '#2a2e44'], [0.5, '#171a2b'], [1, '#0a0c16']]); c.fillRect(0, y, w, 26); for (let x = 60 + i * 40; x < w; x += 340) { c.fillStyle = '#10121e'; c.fillRect(x, y - 4, 16, 34); } }
    c.fillStyle = '#0b0c17'; c.fillRect(600, 330, 1400, 14); for (let x = 600; x < 2000; x += 60) { c.fillRect(x, 330, 4, 200); }
    c.fillStyle = '#12142a'; c.fillRect(600, 300, 1400, 5);
    // central billboard
    c.fillStyle = '#0a0b16'; c.fillRect(1000, 160, 600, 130); c.strokeStyle = '#2b2f55'; c.lineWidth = 4; c.strokeRect(1000, 160, 600, 130);
    // pillars
    for (const x of [520, 2000]) { c.fillStyle = lg(c, x, 0, x + 90, 0, [[0, '#0a0b16'], [0.5, '#232744'], [1, '#080912']]); c.fillRect(x, 0, 90, 620); for (let y = 40; y < 600; y += 70) { c.fillStyle = '#0c0d19'; c.fillRect(x - 6, y, 102, 10); } }
  });
  L.floor = layer(LW, 200, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#1e2036'], [0.1, '#111325'], [1, '#05060d']]); c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, 0, w, 3);
    c.strokeStyle = 'rgba(255,220,100,0.35)'; c.lineWidth = 4; c.setLineDash([60, 50]); c.beginPath(); c.moveTo(0, 90); c.lineTo(w, 90); c.stroke(); c.setLineDash([]);
    // neon reflections smeared downward
    for (let i = 0; i < 26; i++) { const x = R() * w, col = neon[i % neon.length]; c.fillStyle = lg(c, x, 0, x, 190, [[0, col.replace('#', '#') + '66'], [1, col + '00']]); c.fillRect(x, 0, 6 + R() * 28, 120 + R() * 70); }
    for (let i = 0; i < 12; i++) { const x = R() * w, y = 20 + R() * 130; c.fillStyle = 'rgba(160,190,255,0.10)'; c.save(); c.translate(x, y); c.scale(1, 0.12); c.beginPath(); c.arc(0, 0, 160, 0, 7); c.fill(); c.restore(); }
  });
  L.front = layer(LW, LH, (c, w, h) => {
    c.strokeStyle = '#030308'; c.lineWidth = 5;
    for (let i = 0; i < 12; i++) { const x = 100 + R() * 2400, sag = 40 + R() * 90; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 120, sag + 40, x + 260, 0); c.stroke(); }
    c.fillStyle = '#030308'; for (const x of [260, 2260]) { c.fillRect(x, 120, 16, 600); c.fillRect(x - 40, 110, 100, 12); }
    c.fillStyle = 'rgba(0,0,0,0.9)'; c.fillRect(0, 700, w, 20);
  });
  const rain = Array.from({ length: 110 }, () => ({ x: R() * 1400, y: R() * 720, v: 14 + R() * 10 }));
  const steam = Array.from({ length: 14 }, () => ({ x: 200 + R() * 880, y: 520 - R() * 30, life: R() * 100, s: 18 + R() * 20 }));
  return {
    id: 'undercity', name: 'Neon Undercity', blurb: 'Rain-slick lower district, humming with dead-signal neon.', mood: 'undercity', accent: '#ff2e93', grade: 'rgba(40,10,70,0.14)', vignette: 'rgba(2,0,10,0.6)',
    update() {},
    drawBack(ctx, cam, t) {
      blit(ctx, L.sky, cam, 0.06); blit(ctx, L.mid, cam, 0.3);
      // flickering neon signs (additive glow)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const zl = 1 + (cam.zoom - 1) * 0.3;
      for (const s of signs) {
        const fl = (Math.sin(t * 0.07 + s.ph) > -0.85 ? 1 : 0.15) * (0.75 + 0.25 * Math.sin(t * 0.3 + s.ph * 3));
        const sx = 640 - (LW / 2 - s.x) * zl - (cam.x - CX) * 0.3 * cam.zoom, sy = 360 - 360 * zl + s.y * zl;
        ctx.fillStyle = s.col; ctx.globalAlpha = 0.18 * fl; ctx.fillRect(sx - 8, sy - 8, s.w * zl + 16, s.h * zl + 16); ctx.globalAlpha = 0.85 * fl; ctx.fillRect(sx, sy, s.w * zl, s.h * zl);
      }
      ctx.restore();
      blit(ctx, L.near, cam, 0.62);
      // billboard animation: scrolling scanline glyphs
      const bx = 640 - (LW / 2 - 1000) * (1 + (cam.zoom - 1) * 0.62) - (cam.x - CX) * 0.62 * cam.zoom, by = 360 - 360 * (1 + (cam.zoom - 1) * 0.62) + 160 * (1 + (cam.zoom - 1) * 0.62);
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, 600 * cam.zoom, 130 * cam.zoom); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const gx = bx + ((i * 90 + t * 1.2) % (700 * cam.zoom)) - 60, col = neon[i % neon.length]; ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.fillRect(gx, by + 30 * cam.zoom, 40 * cam.zoom, 8); ctx.fillRect(gx, by + 60 * cam.zoom, 70 * cam.zoom, 8); ctx.fillRect(gx + 20, by + 90 * cam.zoom, 30 * cam.zoom, 8); }
      ctx.restore();
    },
    drawFloor(ctx, cam) {
      const px = cam && cam.parallax ? cam.parallax.getOffsets(0.85).x : 0;
      const y = floorScreenY(cam), x = (CX - LW / 2 - cam.x) * cam.zoom + 640 + px;
      ctx.drawImage(L.floor, x, y, LW * cam.zoom, 200 * cam.zoom);
      ctx.fillStyle = '#05060d'; ctx.fillRect(0, y + 190 * cam.zoom - 1, 1280, 720);
    },
    drawFront(ctx, cam, t) {
      const fy = floorScreenY(cam);
      // steam vents
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of steam) { s.life += 1; const k = (s.life % 120) / 120; ctx.globalAlpha = (1 - k) * 0.16; ctx.fillStyle = '#9aa7d8'; ctx.beginPath(); ctx.arc(s.x + Math.sin(s.life * 0.05) * 14, fy - 20 - k * 150, s.s + k * 36, 0, 7); ctx.fill(); }
      ctx.restore();
      blit(ctx, L.front, cam, 1.3);
      ctx.save(); ctx.strokeStyle = 'rgba(170,190,255,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (const r of rain) { r.y += r.v; r.x -= 3; if (r.y > 730) { r.y = -20; r.x = Math.random() * 1400; } ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + 3, r.y - 16); }
      ctx.stroke(); ctx.restore();
    },
  };
}

// ===================================================================================================
// 3. THE OBSIDIAN THRONE
// ===================================================================================================
function throneStage() {
  const R = rng(37), L = {};
  L.sky = layer(LW, LH, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, 720, [[0, '#020104'], [0.55, '#0e0508'], [1, '#2a080e']]); c.fillRect(0, 0, w, h);
    // eclipse disc behind the throne
    c.fillStyle = rg(c, w / 2, 250, 60, 420, [[0, 'rgba(255,60,60,0.55)'], [0.35, 'rgba(160,20,40,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, w, h);
    c.fillStyle = '#030204'; c.beginPath(); c.arc(w / 2, 250, 150, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,90,70,0.8)'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, 250, 152, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,90,70,0.25)'; c.lineWidth = 2; for (let r = 190; r < 340; r += 50) { c.beginPath(); c.arc(w / 2, 250, r, 0, 7); c.stroke(); }
  });
  L.mid = layer(LW, LH, (c, w, h) => {
    // colossal pillars receding into darkness with crimson light strips
    for (let i = 0; i < 9; i++) {
      const x = 80 + i * 300, wd = 110;
      c.fillStyle = lg(c, x, 0, x + wd, 0, [[0, '#050306'], [0.4, '#1a0d12'], [1, '#050306']]); c.fillRect(x, 0, wd, 620);
      glowRect(c, x + wd * 0.46, 40, 6, 540, '#ff2a40', 0.55, 22);
      c.fillStyle = '#0a0508'; c.fillRect(x - 12, 560, wd + 24, 60); c.fillRect(x - 8, 30, wd + 16, 24);
    }
    c.fillStyle = lg(c, 0, 360, 0, 620, [[0, 'rgba(120,10,30,0)'], [1, 'rgba(120,10,30,0.4)']]); c.fillRect(0, 360, w, 260);
  });
  L.throne = layer(LW, LH, (c, w, h) => {
    const cx = w / 2;
    // stairs
    for (let i = 0; i < 6; i++) { c.fillStyle = lg(c, 0, 520 + i * 18, 0, 538 + i * 18, [[0, `rgb(${30 - i * 3},${12 - i},${16 - i})`], [1, '#08040a']]); c.fillRect(cx - 330 + i * 16 - 20 + (5 - i) * 28 - 20, 480 + i * 22, 660 - i * 32 + 40 - (5 - i) * 56 + 40, 24); }
    // throne: tall angular back, spikes, arms
    c.fillStyle = '#0a0508'; c.strokeStyle = '#2a0c14'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - 110, 500); c.lineTo(cx - 130, 200); c.lineTo(cx - 90, 120); c.lineTo(cx - 60, 190); c.lineTo(cx - 40, 40); c.lineTo(cx, 150); c.lineTo(cx + 40, 40); c.lineTo(cx + 60, 190); c.lineTo(cx + 90, 120); c.lineTo(cx + 130, 200); c.lineTo(cx + 110, 500); c.closePath(); c.fill(); c.stroke();
    c.fillRect(cx - 160, 400, 60, 100); c.fillRect(cx + 100, 400, 60, 100); c.fillRect(cx - 120, 410, 240, 90);
    glowRect(c, cx - 2, 170, 4, 240, '#ff2a40', 0.8, 18);
    c.strokeStyle = 'rgba(255,42,64,0.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 100, 480); c.lineTo(cx - 100, 240); c.moveTo(cx + 100, 480); c.lineTo(cx + 100, 240); c.moveTo(cx - 100, 420); c.lineTo(cx + 100, 420); c.stroke();
    c.fillStyle = rg(c, cx, 420, 20, 260, [[0, 'rgba(255,40,60,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(cx - 300, 200, 600, 400);
  });
  L.near = layer(LW, LH, (c, w, h) => {
    // hanging banners and chains
    for (const x of [620, 1000, 1600, 1980]) {
      c.fillStyle = '#4a0a16'; c.beginPath(); c.moveTo(x, 40); c.lineTo(x + 100, 40); c.lineTo(x + 100, 340); c.lineTo(x + 50, 300); c.lineTo(x, 340); c.fill();
      c.strokeStyle = '#c8a24a'; c.lineWidth = 3; c.strokeRect(x + 8, 52, 84, 260); c.beginPath(); c.arc(x + 50, 150, 22, 0, 7); c.stroke(); c.beginPath(); c.moveTo(x + 50, 128); c.lineTo(x + 50, 172); c.stroke();
      c.strokeStyle = '#1a1a1e'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 50, 0); c.lineTo(x + 50, 40); c.stroke();
    }
    for (const x of [760, 1840]) { c.fillStyle = '#0d0809'; c.fillRect(x - 12, 470, 24, 130); c.beginPath(); c.moveTo(x - 36, 470); c.lineTo(x + 36, 470); c.lineTo(x + 22, 500); c.lineTo(x - 22, 500); c.fill(); }
  });
  L.floor = layer(LW, 200, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#2a0e14'], [0.1, '#13070a'], [1, '#030102']]); c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(0, 0, w, 3);
    c.strokeStyle = 'rgba(255,40,64,0.45)'; c.lineWidth = 2;
    for (let x = -w; x < w * 2; x += 220) { c.beginPath(); c.moveTo(x, 0); c.lineTo(w / 2 + (x - w / 2) * 2.6, h); c.stroke(); }
    for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, i * i * 7 + 4); c.lineTo(w, i * i * 7 + 4); c.strokeStyle = 'rgba(255,40,64,0.22)'; c.stroke(); }
    c.fillStyle = rg(c, w / 2, 0, 10, 700, [[0, 'rgba(255,50,70,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, w, h);   // glossy reflection of throne glow
  });
  L.front = layer(LW, LH, (c, w, h) => {
    for (const x of [200, 2250]) { c.fillStyle = lg(c, x, 0, x + 200, 0, [[0, '#010001'], [0.5, '#0a0407'], [1, '#010001']]); c.fillRect(x, 0, 200, h); glowRect(c, x + (x < 1000 ? 190 : 0), 0, 4, h, '#ff2a40', 0.5, 20); }
  });
  const embers = Array.from({ length: 70 }, () => ({ x: R() * 1400, y: R() * 720, v: 0.3 + R() * 0.9, s: 1 + R() * 2.2, ph: R() * 7 }));
  return {
    id: 'throne', name: 'The Obsidian Throne', blurb: 'A monarch\'s hall of black glass. Nobody leaves unchanged.', mood: 'throne', accent: '#ff2a40', grade: 'rgba(70,0,10,0.14)', vignette: 'rgba(8,0,2,0.62)',
    update() {},
    drawBack(ctx, cam, t) {
      blit(ctx, L.sky, cam, 0.05); blit(ctx, L.mid, cam, 0.25); blit(ctx, L.throne, cam, 0.45);
      // pulsing throne glow
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16 + 0.07 * Math.sin(t * 0.03);
      const gx = 640 - (cam.x - CX) * 0.45 * cam.zoom, gy = 330; ctx.fillStyle = rg(ctx, gx, gy, 20, 330, [[0, '#ff2a40'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, 0, 1280, 720); ctx.restore();
      blit(ctx, L.near, cam, 0.7);
      // brazier flames (animated)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const x of [760, 1840]) {
        const zl = 1 + (cam.zoom - 1) * 0.7, bx = 640 - (LW / 2 - x) * zl - (cam.x - CX) * 0.7 * cam.zoom, by = 360 - 360 * zl + 470 * zl;
        for (let i = 0; i < 6; i++) { const k = (t * 0.07 + i * 0.33) % 1; ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = i % 2 ? '#ff7a2a' : '#ff2a40'; ctx.beginPath(); ctx.ellipse(bx + Math.sin(t * 0.2 + i) * 4, by - k * 60 * zl, (14 - k * 10) * zl, (22 - k * 12) * zl, 0, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 0.25; ctx.fillStyle = rg(ctx, bx, by - 20, 4, 90 * zl, [[0, '#ff6a3a'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(bx - 100, by - 120, 200, 200);
      }
      ctx.restore();
    },
    drawFloor(ctx, cam) {
      const px = cam && cam.parallax ? cam.parallax.getOffsets(0.85).x : 0;
      const y = floorScreenY(cam), x = (CX - LW / 2 - cam.x) * cam.zoom + 640 + px;
      ctx.drawImage(L.floor, x, y, LW * cam.zoom, 200 * cam.zoom);
      ctx.fillStyle = '#030102'; ctx.fillRect(0, y + 190 * cam.zoom - 1, 1280, 720);
    },
    drawFront(ctx, cam, t) {
      blit(ctx, L.front, cam, 1.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) { e.y -= e.v; e.x += Math.sin(t * 0.02 + e.ph) * 0.4; if (e.y < -10) { e.y = 730; e.x = Math.random() * 1280; } ctx.fillStyle = `rgba(255,${100 + (e.ph * 20 | 0)},60,${0.35 + 0.3 * Math.sin(t * 0.1 + e.ph)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, 7); ctx.fill(); }
      ctx.restore();
    },
  };
}

// ===================================================================================================
// 4. VEIL REACTOR
// ===================================================================================================
function reactorStage() {
  const R = rng(51), L = {};
  L.sky = layer(LW, LH, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, 720, [[0, '#02070c'], [0.6, '#08202c'], [1, '#0b3340']]); c.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { const x = R() * w, y = R() * 560; c.fillStyle = 'rgba(80,220,255,0.12)'; c.fillRect(x, y, 2 + R() * 60, 1); }
  });
  L.mid = layer(LW, LH, (c, w, h) => {
    // far gantries / suspended platforms
    for (let i = 0; i < 7; i++) {
      const x = 80 + i * 360 + R() * 60, y = 190 + R() * 220, pw = 180 + R() * 100;
      c.fillStyle = '#0b1a24'; c.fillRect(x, y, pw, 16); c.fillStyle = '#12303d'; c.fillRect(x, y, pw, 4);
      c.strokeStyle = '#0a1620'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 20, y); c.lineTo(x + 20, 0); c.moveTo(x + pw - 20, y); c.lineTo(x + pw - 20, 0); c.stroke();
      for (let g = 0; g < 4; g++) { c.fillStyle = g % 2 ? 'rgba(80,230,255,0.7)' : 'rgba(255,90,160,0.6)'; c.fillRect(x + 14 + g * 30, y - 6, 8, 6); }
    }
    c.fillStyle = lg(c, 0, 420, 0, 620, [[0, 'rgba(20,100,130,0)'], [1, 'rgba(20,100,130,0.35)']]); c.fillRect(0, 420, w, 200);
  });
  L.near = layer(LW, LH, (c, w, h) => {
    // conduit pillars, consoles, railings
    for (const x of [560, 760, 1840, 2040]) { c.fillStyle = lg(c, x, 0, x + 70, 0, [[0, '#07131b'], [0.5, '#1d4252'], [1, '#07131b']]); c.fillRect(x, 0, 70, 620); c.fillStyle = '#081a22'; for (let y = 30; y < 600; y += 90) c.fillRect(x - 8, y, 86, 14); }
    c.fillStyle = '#0a1a22'; c.fillRect(900, 470, 800, 150); c.fillStyle = '#12303d'; c.fillRect(900, 470, 800, 8);
    for (let i = 0; i < 20; i++) { c.fillStyle = ['#27e6ff', '#ff5aa0', '#ffd13a'][i % 3]; c.globalAlpha = 0.8; c.fillRect(920 + i * 38, 490 + (i % 4) * 22, 14, 6); c.globalAlpha = 1; }
    c.strokeStyle = '#102a35'; c.lineWidth = 5; c.beginPath(); c.moveTo(560, 540); c.lineTo(2110, 540); c.stroke(); for (let x = 580; x < 2110; x += 70) { c.beginPath(); c.moveTo(x, 540); c.lineTo(x, 600); c.stroke(); }
  });
  L.floor = layer(LW, 200, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#183a47'], [0.1, '#0c2029'], [1, '#03090d']]); c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(0, 0, w, 3);
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 2;
    for (let i = 1; i < 7; i++) { c.beginPath(); c.moveTo(0, i * i * 4.2 + 3); c.lineTo(w, i * i * 4.2 + 3); c.stroke(); }
    for (let x = -w; x < w * 2; x += 90) { c.beginPath(); c.moveTo(x, 0); c.lineTo(w / 2 + (x - w / 2) * 2.8, h); c.stroke(); }
    c.strokeStyle = 'rgba(39,230,255,0.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 14); c.lineTo(w, 14); c.stroke();
    c.fillStyle = rg(c, w / 2, 0, 10, 600, [[0, 'rgba(60,220,255,0.28)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, w, h);
  });
  L.front = layer(LW, LH, (c, w, h) => {
    c.strokeStyle = '#02070a'; c.lineWidth = 7;
    for (let i = 0; i < 9; i++) { const x = 150 + R() * 2300; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 40, 140, x - 50, 200, x + 20, 100 + R() * 260); c.stroke(); }
    c.fillStyle = '#02070a'; c.fillRect(230, 0, 90, h); c.fillRect(2290, 0, 90, h);
    glowRect(c, 296, 0, 3, h, '#27e6ff', 0.5, 16); glowRect(c, 2290, 0, 3, h, '#27e6ff', 0.5, 16);
  });
  const sparks = [];
  return {
    id: 'reactor', name: 'Veil Reactor', blurb: 'The machine that feeds the network. It is awake.', mood: 'reactor', accent: '#27e6ff', grade: 'rgba(0,50,70,0.12)', vignette: 'rgba(0,6,10,0.6)',
    update(t, fx) { if (fx && t % 90 === 0) fx.pulse('#27e6ff', 0.1); },
    drawBack(ctx, cam, t) {
      blit(ctx, L.sky, cam, 0.05);
      // rotating reactor machinery around a pulsing core
      const cx = 640 - (cam.x - CX) * 0.2 * cam.zoom, cy = 300, z = 1 + (cam.zoom - 1) * 0.2, pulse = 0.5 + 0.5 * Math.sin(t * 0.045);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(z, z);
      const core = ctx.createRadialGradient(0, 0, 4, 0, 0, 120 + pulse * 20); core.addColorStop(0, '#ffffff'); core.addColorStop(0.2, '#7ff3ff'); core.addColorStop(0.55, 'rgba(30,140,230,0.55)'); core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, 150, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      const rings = [[260, 20, 36, 0.003, '#10303d'], [200, 14, 28, -0.005, '#0d2833'], [320, 26, 48, 0.0022, '#0a2029']];
      for (const [r, th, teeth, sp, col] of rings) {
        ctx.save(); ctx.rotate(t * sp); ctx.strokeStyle = col; ctx.lineWidth = th; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
        ctx.fillStyle = col; for (let i = 0; i < teeth; i++) { const a = i / teeth * 6.2832; ctx.save(); ctx.rotate(a); ctx.fillRect(r + th / 2 - 2, -5, 12, 10); ctx.restore(); }
        ctx.strokeStyle = 'rgba(60,220,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r - th / 2, 0, 7); ctx.stroke(); ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(110,240,255,${0.15 + pulse * 0.15})`; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832 + t * 0.002; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); ctx.lineTo(Math.cos(a) * 600, Math.sin(a) * 600); ctx.stroke(); }
      ctx.restore();
      blit(ctx, L.mid, cam, 0.3); blit(ctx, L.near, cam, 0.62);
      // energy pulses travelling along conduits
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#27e6ff'; ctx.lineWidth = 4; ctx.globalAlpha = 0.8;
      const zl = 1 + (cam.zoom - 1) * 0.62;
      for (const x of [560, 760, 1840, 2040]) { const sx = 640 - (LW / 2 - x - 35) * zl - (cam.x - CX) * 0.62 * cam.zoom; const y = (t * 3 + x) % 620; ctx.beginPath(); ctx.moveTo(sx, 360 - 360 * zl + y * zl); ctx.lineTo(sx, 360 - 360 * zl + (y + 60) * zl); ctx.stroke(); }
      ctx.restore();
    },
    drawFloor(ctx, cam, t) {
      const px = cam && cam.parallax ? cam.parallax.getOffsets(0.85).x : 0;
      const y = floorScreenY(cam), x = (CX - LW / 2 - cam.x) * cam.zoom + 640 + px;
      ctx.drawImage(L.floor, x, y, LW * cam.zoom, 200 * cam.zoom);
      ctx.fillStyle = '#03090d'; ctx.fillRect(0, y + 190 * cam.zoom - 1, 1280, 720);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.07 + 0.05 * Math.sin(t * 0.045); ctx.fillStyle = rg(ctx, 640, y, 10, 520, [[0, '#7ff3ff'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, y, 1280, 200); ctx.restore();
    },
    drawFront(ctx, cam, t) {
      blit(ctx, L.front, cam, 1.4);
      if (Math.random() < 0.05) sparks.push({ x: 300 + Math.random() * 700, y: 40 + Math.random() * 200, life: 8, pts: Array.from({ length: 6 }, () => Math.random() - 0.5) });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#9ff8ff'; ctx.lineWidth = 2;
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; if (--s.life <= 0) { sparks.splice(i, 1); continue; } ctx.globalAlpha = s.life / 8; ctx.beginPath(); ctx.moveTo(s.x, s.y); s.pts.forEach((p, j) => ctx.lineTo(s.x + (j + 1) * 14, s.y + p * 60)); ctx.stroke(); }
      ctx.restore();
    },
  };
}

export const STAGES = (() => {
  let cache = null;
  return { build() { if (!cache) cache = [templeStage(), undercityStage(), throneStage(), reactorStage()]; return cache; } };
})();

export function drawStageFull(stage, ctx, cam, t) {
  stage.drawBack(ctx, cam, t);
  stage.drawFloor(ctx, cam, t);
}

// Colour grading + vignette applied last, in screen space.
export function drawGrade(stage, ctx, pulseA = 0, pulseCol = '#fff') {
  ctx.fillStyle = stage.grade; ctx.fillRect(0, 0, 1280, 720);
  const g = ctx.createRadialGradient(640, 380, 260, 640, 380, 820); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, stage.vignette);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
  if (pulseA > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulseA; ctx.fillStyle = pulseCol; ctx.fillRect(0, 0, 1280, 720); ctx.restore(); }
}

export function stageThumb(stage, w = 320, h = 180) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const full = document.createElement('canvas'); full.width = 1280; full.height = 720; const fx = full.getContext('2d');
  const cam = { x: CX, zoom: 1 };
  stage.drawBack(fx, cam, 40); stage.drawFloor(fx, cam, 40); stage.drawFront(fx, cam, 40); drawGrade(stage, fx);
  x.drawImage(full, 0, 0, w, h); return c;
}
