// Pooled particle system + screen effects (shake, flash, pulses, afterimages, floating text).
// Everything has a lifetime and recycles itself; the pool is fixed-size so nothing is unbounded.
const POOL = 700;
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const sprites = new Map();
function glowSprite(col) {
  let c = sprites.get(col); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d'), g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 48, 48); sprites.set(col, c); return c;
}

export class Effects {
  constructor() {
    this.p = Array.from({ length: POOL }, () => ({ on: false }));
    this.ghosts = []; this.texts = [];
    this.shakeAmp = 0; this.shakeT = 0; this.flashA = 0; this.flashCol = '#fff'; this.pulseA = 0; this.pulseCol = '#f33';
    this.settings = { shake: 1, reduceFx: false, reduceFlash: false };
    this.cursor = 0;
  }
  clear() { for (const q of this.p) q.on = false; this.ghosts.length = 0; this.texts.length = 0; this.shakeAmp = 0; this.flashA = 0; this.pulseA = 0; }
  get fxScale() { return this.settings.reduceFx ? 0.4 : 1; }
  get active() { let n = 0; for (const q of this.p) if (q.on) n++; return n; }

  spawn(o) {
    for (let i = 0; i < POOL; i++) {
      const q = this.p[(this.cursor + i) % POOL];
      if (!q.on) {
        this.cursor = (this.cursor + i + 1) % POOL;
        Object.assign(q, { on: true, type: 'spark', x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0.98, life: 20, size: 3, col: '#fff', add: true, rot: 0, len: 1, grow: 0, w: 3 }, o);
        q.max = q.life; return q;
      }
    }
    return null; // pool exhausted: drop (bounded by design)
  }

  // ---- screen-level --------------------------------------------------------------
  shake(a, t = 10) { const m = a * this.settings.shake * (this.settings.reduceFx ? 0.5 : 1); if (m > this.shakeAmp) { this.shakeAmp = m; this.shakeT = t; } }
  flash(col, a) { if (this.settings.reduceFlash) a *= 0.2; if (a > this.flashA) { this.flashA = a; this.flashCol = col; } }
  pulse(col, a) { if (this.settings.reduceFlash) a *= 0.3; this.pulseA = Math.max(this.pulseA, a); this.pulseCol = col; }
  get shakeOffset() { if (this.shakeAmp < 0.2) return { x: 0, y: 0 }; return { x: (Math.random() - 0.5) * 2 * this.shakeAmp, y: (Math.random() - 0.5) * 1.4 * this.shakeAmp }; }

  // ---- composite effects ---------------------------------------------------------
  burst(x, y, col, n, speed, o = {}) {
    n = Math.max(1, Math.round(n * this.fxScale));
    for (let i = 0; i < n; i++) {
      const sp = o.spread ?? 1.1, a = o.dir != null ? o.dir + rnd(-sp, sp) : rnd(0, TAU), v = rnd(speed * 0.4, speed);
      this.spawn({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.g ?? 0.25, drag: 0.93, life: rnd(8, 18) * (o.life || 1), size: rnd(1.5, 3.2) * (o.size || 1), col, len: o.len || 1 });
    }
  }
  star(x, y, col, r, life = 7) { this.spawn({ type: 'star', x, y, life, size: r, col, rot: rnd(0, TAU) }); }
  ring(x, y, col, r0, r1, life = 14, flat = 1, w = 3) { this.spawn({ type: 'ring', x, y, life, size: r0, grow: (r1 - r0) / life, col, len: flat, w }); }
  dust(x, y, n, spread = 40, col = 'rgba(190,180,170,0.5)') {
    n = Math.max(1, Math.round(n * this.fxScale));
    for (let i = 0; i < n; i++) this.spawn({ type: 'dust', x: x + rnd(-spread, spread), y, vx: rnd(-1.8, 1.8), vy: rnd(-1.8, -0.2), g: -0.01, drag: 0.94, life: rnd(18, 34), size: rnd(5, 12), grow: 0.35, col, add: false });
  }
  shield(x, y, dir, col, heavy) { this.spawn({ type: 'shield', x, y, life: heavy ? 14 : 10, size: heavy ? 62 : 48, col, rot: dir, grow: 1.2 }); }
  shards(x, y, col) { for (let i = 0, n = Math.round(18 * this.fxScale); i < n; i++) this.spawn({ type: 'shard', x, y, vx: rnd(-6, 6), vy: rnd(-9, -1), g: 0.4, drag: 0.99, life: rnd(30, 50), size: rnd(4, 10), col, rot: rnd(0, TAU), add: false }); }
  trail(x, y, col, size = 8) { this.spawn({ type: 'glow', x, y, life: 12, size, col, grow: -0.4, vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3) }); }
  ember(x, y, col, up = 1) { this.spawn({ type: 'glow', x, y, life: rnd(40, 80), size: rnd(1.5, 3.5), col, vx: rnd(-0.4, 0.4), vy: -rnd(0.4, 1.4) * up, grow: -0.02, drag: 1 }); }
  bolt(x0, y0, x1, y1, col, life = 8) {
    const pts = [[x0, y0]]; const n = 7; for (let i = 1; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + rnd(-22, 22), y0 + (y1 - y0) * t + rnd(-10, 10)]); } pts.push([x1, y1]);
    this.spawn({ type: 'bolt', x: x0, y: y0, life, pts, col, size: 4 });
  }
  slash(x, y, r, a0, a1, col, life = 9, w = 10) { this.spawn({ type: 'slash', x, y, life, size: r, rot: a0, grow: 0, len: a1, col, w }); }
  speedLines(x, y, dir, col, n = 8) { for (let i = 0, m = Math.round(n * this.fxScale); i < m; i++) this.spawn({ type: 'line', x: x + rnd(-70, 70), y: y + rnd(-90, 90), vx: -dir * rnd(14, 26), life: rnd(5, 9), size: rnd(1, 2.4), len: rnd(40, 110), col, drag: 1 }); }
  ghost(f, pose, col, life = 12) { if (this.ghosts.length < 14) this.ghosts.push({ x: f.x, y: f.y, facing: f.facing, pose: { ...pose }, f, col, life, max: life }); }
  text(x, y, str, col, size = 26, life = 40) { if (this.texts.length < 10) this.texts.push({ x, y, str, col, size, life, max: life }); }

  update() {
    for (const q of this.p) {
      if (!q.on) continue;
      q.x += q.vx; q.y += q.vy; q.vy += q.g; q.vx *= q.drag; if (q.type === 'spark') q.vy *= q.drag;
      q.size += q.grow; q.life--;
      if (q.life <= 0 || q.size <= 0.1) q.on = false;
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) if (--this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.y -= 0.6; if (--t.life <= 0) this.texts.splice(i, 1); }
    if (this.shakeT > 0) { this.shakeT--; this.shakeAmp *= 0.86; } else this.shakeAmp = 0;
    this.flashA *= 0.82; if (this.flashA < 0.01) this.flashA = 0;
    this.pulseA *= 0.9; if (this.pulseA < 0.01) this.pulseA = 0;
  }

  // World-space draw: x/y are already screen-ready (y grows downward).
  draw(ctx) {
    ctx.save(); ctx.lineCap = 'round';
    for (const q of this.p) {
      if (!q.on) continue;
      const k = q.life / q.max;
      ctx.globalCompositeOperation = q.add ? 'lighter' : 'source-over';
      switch (q.type) {
        case 'spark':
          ctx.globalAlpha = Math.min(1, k * 1.6); ctx.strokeStyle = q.col; ctx.lineWidth = q.size;
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 1.6 * q.len, q.y - q.vy * 1.6 * q.len); ctx.stroke(); break;
        case 'dust': ctx.globalAlpha = k * 0.55; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill(); break;
        case 'glow': {
          ctx.globalAlpha = Math.min(1, k * 1.4); const sp = glowSprite(q.col), r = q.size * 2.2; ctx.drawImage(sp, q.x - r, q.y - r, r * 2, r * 2); break;
        }
        case 'ring': ctx.globalAlpha = k; ctx.strokeStyle = q.col; ctx.lineWidth = q.w * k + 0.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.size, q.size * q.len, 0, 0, TAU); ctx.stroke(); break;
        case 'star': {
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.8); ctx.fillStyle = q.col; ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          const R = q.size * (0.6 + 0.4 * (1 - k)), r = R * 0.22; ctx.beginPath();
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r : R; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill(); ctx.restore(); break;
        }
        case 'shield': {
          ctx.globalAlpha = k; ctx.strokeStyle = q.col; ctx.lineWidth = 5 * k + 1;
          const a0 = q.rot > 0 ? -Math.PI * 0.38 : Math.PI * 0.62;       // arc opens toward the attacker
          ctx.beginPath(); ctx.arc(q.x, q.y, q.size, a0, a0 + Math.PI * 0.76); ctx.stroke();
          ctx.globalAlpha = k * 0.25; ctx.fillStyle = q.col; ctx.fill(); break;
        }
        case 'shard':
          ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = q.col; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + q.life * 0.2);
          ctx.beginPath(); ctx.moveTo(-q.size, 0); ctx.lineTo(0, -q.size * 0.4); ctx.lineTo(q.size, 0); ctx.lineTo(0, q.size * 0.3); ctx.closePath(); ctx.fill(); ctx.restore(); break;
        case 'bolt':
          ctx.globalAlpha = k; ctx.strokeStyle = q.col; ctx.lineWidth = q.size * k + 1; ctx.beginPath();
          q.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); break;
        case 'slash':
          ctx.globalAlpha = k; ctx.strokeStyle = q.col; ctx.lineWidth = q.w * k + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.2 - k * 0.2), q.rot, q.len); ctx.stroke(); break;
        case 'line': ctx.globalAlpha = k * 0.7; ctx.strokeStyle = q.col; ctx.lineWidth = q.size; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + Math.sign(q.vx) * -q.len, q.y); ctx.stroke(); break;
        default: break;
      }
    }
    ctx.restore();
  }
}
