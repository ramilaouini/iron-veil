// Opening cinematic (skippable) and the Blood Circuit emblem. Reuses the arena renderers for moving environmental imagery.
import { CFG } from '../config.js';
import { LORE } from './story.js';

const CX = CFG.STAGE_W / 2;
const TAU = Math.PI * 2;

// Emblem: a ring of circuit ticks around a closed eye - the Veil watching the Circuit.
export function drawEmblem(ctx, cx, cy, r, t = 0, p = 1, col = '#ff3a3a') {
  ctx.save(); ctx.translate(cx, cy); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const draw = (frac, fn) => { ctx.save(); ctx.beginPath(); fn(); ctx.setLineDash([9999]); ctx.lineDashOffset = 9999 * (1 - Math.max(0, Math.min(1, frac))); ctx.stroke(); ctx.restore(); };
  ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.lineWidth = Math.max(2, r * 0.045);
  draw(p * 1.2, () => ctx.arc(0, 0, r, -1.57, -1.57 + TAU));
  ctx.lineWidth = Math.max(1.5, r * 0.025); ctx.strokeStyle = '#c8ced9'; ctx.shadowBlur = 0;
  draw(p * 1.3 - 0.2, () => ctx.arc(0, 0, r * 0.86, 1.57, 1.57 + TAU));
  ctx.save(); ctx.rotate(t * 0.12);
  for (let i = 0; i < 24; i++) { if (i / 24 > p) break; ctx.rotate(TAU / 24); ctx.beginPath(); ctx.moveTo(r * 1.06, 0); ctx.lineTo(r * (i % 3 === 0 ? 1.22 : 1.14), 0); ctx.strokeStyle = i % 3 === 0 ? col : '#8a92a3'; ctx.lineWidth = i % 3 === 0 ? 3 : 1.5; ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, r * 0.04);
  draw(p * 1.6 - 0.5, () => { ctx.moveTo(-r * 0.62, 0); ctx.quadraticCurveTo(0, -r * 0.5, r * 0.62, 0); ctx.quadraticCurveTo(0, r * 0.5, -r * 0.62, 0); });
  if (p > 0.7) { ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.globalAlpha = Math.min(1, (p - 0.7) / 0.3); ctx.beginPath(); ctx.moveTo(0, -r * 0.22); ctx.lineTo(r * 0.12, 0); ctx.lineTo(0, r * 0.22); ctx.lineTo(-r * 0.12, 0); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

export const EMBLEM_SVG = `<svg viewBox="-120 -120 240 240" class="emblem" aria-hidden="true">
  <circle r="86" fill="none" stroke="#ff3a3a" stroke-width="4"/>
  <circle r="74" fill="none" stroke="#c8ced9" stroke-width="2"/>
  <g stroke="#8a92a3" stroke-width="2">${Array.from({ length: 24 }, (_, i) => { const a = i / 24 * 6.283, r0 = 92, r1 = i % 3 === 0 ? 108 : 100; return `<line x1="${(Math.cos(a) * r0).toFixed(1)}" y1="${(Math.sin(a) * r0).toFixed(1)}" x2="${(Math.cos(a) * r1).toFixed(1)}" y2="${(Math.sin(a) * r1).toFixed(1)}" ${i % 3 === 0 ? 'stroke="#ff3a3a" stroke-width="3"' : ''}/>`; }).join('')}</g>
  <path d="M-54 0 Q0 -44 54 0 Q0 44 -54 0Z" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
  <path d="M0 -19 L10 0 L0 19 L-10 0Z" fill="#ff3a3a"/>
</svg>`;

export class Intro {
  constructor(game, canvas) { this.g = game; this.c = canvas; this.ctx = canvas.getContext('2d'); this.running = false; this.nodes = null; }

  start(onDone) {
    this.done = onDone; this.running = true; this.t0 = performance.now(); this.finishing = false;
    this.nodes = Array.from({ length: 22 }, (_, i) => ({ x: 140 + (i % 6) * 200 + Math.sin(i * 12.9) * 70, y: 170 + Math.floor(i / 6) * 120 + Math.cos(i * 7.3) * 50 }));
    this.edges = []; for (let i = 0; i < this.nodes.length; i++) for (let j = i + 1; j < this.nodes.length; j++) { const a = this.nodes[i], b = this.nodes[j]; if (Math.hypot(a.x - b.x, a.y - b.y) < 260 && this.edges.length < 46) this.edges.push([i, j]); }
    this.g.audio.init(); if (this.g.audio.ready) this.g.audio.music.play('menu');
    this._raf = requestAnimationFrame(() => this.frame());
  }
  skip() { if (this.running) this.finish(); }
  finish() { if (!this.running) return; this.running = false; cancelAnimationFrame(this._raf); this.ctx.clearRect(0, 0, 1280, 720); if (this.done) this.done(); }

  frame() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(() => this.frame());
    const t = (performance.now() - this.t0) / 1000, ctx = this.ctx, g = this.g, T = t * 60;
    ctx.setTransform(this.c.width / 1280, 0, 0, this.c.height / 720, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 720);
    const scene = (stage, a, camStart, camEnd, k) => {
      ctx.save(); ctx.globalAlpha = a; const cam = { x: camStart + (camEnd - camStart) * k, zoom: 1.0 + 0.08 * k };
      const st = g.stages[stage]; st.drawBack(ctx, cam, T); st.drawFloor(ctx, cam, T); st.drawFront(ctx, cam, T); ctx.restore();
    };
    const fadeIO = (s, e, f = 0.7) => Math.max(0, Math.min(1, Math.min((t - s) / f, (e - t) / f)));
    // 0-4.4 temple, 4.2-7.2 undercity, 7-9.8 throne
    if (t < 4.6) scene(0, fadeIO(0, 4.6), 800, 1100, t / 4.6);
    if (t > 4.2 && t < 7.4) scene(1, fadeIO(4.2, 7.4), 1100, 800, (t - 4.2) / 3.2);
    if (t > 7.1 && t < 10.2) scene(2, fadeIO(7.1, 10.2), 900, 1000, (t - 7.1) / 3.1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; if (t < 10) ctx.fillRect(0, 0, 1280, 720);
    // lore captions
    const caps = [[0.9, 3.0, LORE[0]], [2.9, 5.0, LORE[1]], [5.0, 7.3, LORE[2]], [7.4, 10.0, LORE[3]]];
    ctx.textAlign = 'center'; ctx.font = '600 28px "Segoe UI",Arial,sans-serif';
    for (const [s, e, txt] of caps) { const a = fadeIO(s, e, 0.5); if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = '#e6e9f0'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10; ctx.fillText(txt, 640, 640 - (1 - a) * -10); ctx.shadowBlur = 0; ctx.globalAlpha = 1; } }
    // Veil network reveal on black
    if (t > 9.8 && t < 13.4) {
      const a = fadeIO(9.8, 13.4, 0.6), k = Math.min(1, (t - 9.8) / 2.2);
      ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, 1280, 720);
      ctx.save(); ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(255,58,58,0.55)'; ctx.lineWidth = 2;
      this.edges.forEach(([i, j], n) => { if (n / this.edges.length > k) return; const A = this.nodes[i], B = this.nodes[j]; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); const u = ((t * 0.6 + n * 0.17) % 1); ctx.fillStyle = '#ffd0d0'; ctx.beginPath(); ctx.arc(A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u, 2.5, 0, 7); ctx.fill(); });
      this.nodes.forEach((n, i) => { if (i / this.nodes.length > k) return; ctx.fillStyle = '#ff3a3a'; ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(n.x, n.y, 4 + Math.sin(T * 0.1 + i) * 1.2, 0, 7); ctx.fill(); });
      ctx.shadowBlur = 0; ctx.font = '700 22px "Segoe UI",Arial,sans-serif'; ctx.fillStyle = '#c8ced9'; ctx.textAlign = 'center'; ctx.globalAlpha = a * Math.min(1, (t - 10.5)); ctx.fillText('THE VEIL CONNECTS ALL THINGS', 640, 80);
      ctx.restore();
    }
    // emblem + title
    if (t > 13.0) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 720);
      const p = Math.min(1, (t - 13.0) / 1.6); drawEmblem(ctx, 640, 270, 110, t * 60, p);
      if (t > 14.4) {
        const a = Math.min(1, (t - 14.4) / 0.5), sc = 1 + (1 - a) * 0.5; ctx.save(); ctx.globalAlpha = a; ctx.translate(640, 470); ctx.scale(sc, sc); ctx.textAlign = 'center';
        ctx.font = '900 92px "Bahnschrift","Arial Narrow",Impact,sans-serif'; ctx.fillStyle = '#f3f4f8'; ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 28; ctx.fillText('IRON VEIL', 0, 0);
        ctx.shadowBlur = 0; ctx.font = '800 34px "Bahnschrift","Arial Narrow",Arial,sans-serif'; ctx.fillStyle = '#ff4a4a'; ctx.fillText('B L O O D   C I R C U I T', 0, 50); ctx.restore();
        if (a >= 1 && t < 14.5) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(0, 0, 1280, 720); }
      }
    }
    // fade in from black / out to menu
    if (t < 1.0) { ctx.fillStyle = `rgba(0,0,0,${1 - t})`; ctx.fillRect(0, 0, 1280, 720); }
    if (t > 16.0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - 16) / 0.8)})`; ctx.fillRect(0, 0, 1280, 720); }
    ctx.font = '600 13px Arial'; ctx.fillStyle = 'rgba(200,206,216,0.6)'; ctx.textAlign = 'right'; ctx.fillText('PRESS ENTER OR CLICK TO SKIP', 1260, 704);
    if (t > 16.8) this.finish();
  }
}
