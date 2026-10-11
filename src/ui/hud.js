// Canvas HUD: health (with trailing damage bar), guard, ultimate meters, timer, round pips, combo counters,
// announcements and training diagnostics. All vector-drawn; no emoji, no external images.
import { CFG } from '../config.js';
import { icon } from './portraits.js';

const FONT = '"Bahnschrift","Arial Narrow","Franklin Gothic Medium","Segoe UI",Arial,sans-serif';
const font = (px, w = 800) => `${w} ${px}px ${FONT}`;

export class HUD {
  constructor() { this.reset(); }
  reset() {
    this.hp = [1, 1]; this.lag = [1, 1]; this.lagDelay = [0, 0]; this.ann = null; this.callout = [{ t: 0, s: '' }, { t: 0, s: '' }];
    this.popups = [{ t: 0, s: '', c: '' }, { t: 0, s: '', c: '' }]; this.comboPop = [0, 0]; this.lastCombo = [0, 0]; this.ultFlash = [0, 0]; this.ultBanner = null;
  }
  announce(text, sub = '', col = '#fff', len = 70) { this.ann = { text, sub, col, t: 0, len }; }
  callSpecial(i, name) { this.callout[i] = { t: 80, s: name.toUpperCase() }; }
  popup(i, s, c) { this.popups[i] = { t: 60, s, c }; }
  banner(owner, name, col) { this.ultBanner = { owner, name, col, t: 0, len: 56 }; }

  update(m) {
    for (let i = 0; i < 2; i++) {
      const f = m.f[i], v = f.hp / f.maxHp;
      this.hp[i] += (v - this.hp[i]) * 0.5;              // bar fill responds immediately
      if (this.lag[i] > v) { if (this.lagDelay[i] > 0) this.lagDelay[i]--; else this.lag[i] = Math.max(v, this.lag[i] - 0.006); } else { this.lag[i] = v; this.lagDelay[i] = 26; }
      if (this.lag[i] <= this.hp[i] + 0.002 || v < this.lag[i] - 0.0001) { if (v > this.lag[i]) this.lag[i] = v; }
      if (f.meter >= CFG.METER_MAX && this.ultFlash[i] === 0) this.ultFlash[i] = 1;
      if (f.meter < CFG.METER_MAX) this.ultFlash[i] = 0;
      if (this.callout[i].t > 0) this.callout[i].t--;
      if (this.popups[i].t > 0) this.popups[i].t--;
      const c = m.combo[i];
      if (c.hits > this.lastCombo[i]) this.comboPop[i] = 10;
      this.lastCombo[i] = c.hits; if (this.comboPop[i] > 0) this.comboPop[i]--;
    }
    if (this.ann) { this.ann.t++; if (this.ann.t > this.ann.len) this.ann = null; }
    if (this.ultBanner) { this.ultBanner.t++; if (this.ultBanner.t > this.ultBanner.len) this.ultBanner = null; }
  }

  draw(ctx, m, opts = {}) {
    const t = performance.now() / 1000;
    ctx.save();
    this._bars(ctx, m, t, opts);
    this._combo(ctx, m);
    this._ann(ctx);
    this._ult(ctx);
    if (m.training) this._training(ctx, m, opts);
    ctx.restore();
  }

  _bars(ctx, m, t, opts) {
    for (let i = 0; i < 2; i++) {
      const f = m.f[i], left = i === 0, x0 = left ? 64 : 1280 - 64, dir = left ? 1 : -1, W = 480, y = 34, H = 30, sl = 18;
      const pal = f.pal;
      // plate
      ctx.save();
      const edge = (px, py) => [x0 + dir * px, py];
      const poly = (w, h, yy, inset = 0) => { ctx.beginPath(); ctx.moveTo(x0 + dir * inset, yy); ctx.lineTo(x0 + dir * (w - inset), yy); ctx.lineTo(x0 + dir * (w - inset - sl), yy + h); ctx.lineTo(x0 + dir * (inset - sl * 0 + 0), yy + h); ctx.closePath(); };
      // backing
      ctx.fillStyle = 'rgba(6,6,10,0.82)'; poly(W + 8, H + 8, y - 4, -4); ctx.fill();
      ctx.strokeStyle = 'rgba(200,206,216,0.85)'; ctx.lineWidth = 2; poly(W + 8, H + 8, y - 4, -4); ctx.stroke();
      // lag bar (what was just lost)
      ctx.save(); poly(W, H, y); ctx.clip();
      ctx.fillStyle = '#f0d9a0'; ctx.fillRect(left ? x0 : x0 - W * this.lag[i], y, W * this.lag[i], H);
      const hpv = this.hp[i], low = hpv < 0.3;
      const g = ctx.createLinearGradient(0, y, 0, y + H);
      if (left) { g.addColorStop(0, low ? '#ff6a4a' : '#ff4a4a'); g.addColorStop(1, low ? '#8a1010' : '#9e1224'); }
      else { g.addColorStop(0, '#53e6ff'); g.addColorStop(1, '#0f6e8e'); }
      ctx.fillStyle = g; ctx.globalAlpha = low ? 0.78 + 0.22 * Math.sin(t * 14) : 1;
      ctx.fillRect(left ? x0 : x0 - W * hpv, y, W * hpv, H);
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#fff'; ctx.fillRect(Math.min(x0, x0 + dir * W), y, W, H * 0.4); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; for (let k = 1; k < 10; k++) { const px = x0 + dir * W * k / 10; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + H); ctx.stroke(); }
      ctx.restore();
      // identity: icon + name
      const ic = icon(f.def, f.skinIndex, 64), ix = left ? x0 - 56 : x0 + 56 - 56 + 0;
      ctx.save(); const cx = left ? 38 : 1242, cy = 52; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 7); ctx.clip(); ctx.drawImage(ic, cx - 30, cy - 30, 60, 60); ctx.restore();
      ctx.strokeStyle = pal.glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(left ? 38 : 1242, 52, 30, 0, 7); ctx.stroke();
      ctx.font = font(22, 800); ctx.textAlign = left ? 'left' : 'right'; ctx.fillStyle = '#f3f4f8'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      const nm = (m.labels ? m.labels[i] : f.def.name).toUpperCase(); ctx.fillText(nm, x0 + dir * 6, y + H + 38);
      ctx.font = font(12, 600); ctx.fillStyle = '#9ea6b5'; ctx.fillText(`${f.def.title.toUpperCase()}  /  ${(f.palOverride ? 'BOSS' : f.def.skins[f.skinIndex].name).toUpperCase()}`, x0 + dir * 6, y + H + 54);
      ctx.shadowBlur = 0;
      // guard bar
      const gw = 190, gy = y + H + 10, gp = Math.max(0, f.guard / CFG.MAX_GUARD);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(left ? x0 + 6 : x0 - 6 - gw, gy, gw, 5);
      ctx.fillStyle = gp < 0.25 ? (Math.sin(t * 16) > 0 ? '#ff8a3a' : '#ffd0a0') : '#9db4d6'; ctx.fillRect(left ? x0 + 6 : x0 - 6 - gw * gp, gy, gw * gp, 5);
      ctx.font = font(10, 700); ctx.fillStyle = '#7d869a'; ctx.textAlign = left ? 'left' : 'right'; ctx.fillText('GUARD', left ? x0 + 6 + gw + 6 : x0 - 6 - gw - 6, gy + 6); if (!left) ctx.textAlign = 'right';
      // round pips (diamonds)
      for (let r = 0; r < m.need; r++) {
        const px = x0 + dir * (W - 14 - r * 22) - dir * 0, py = y + H + 30; const won = r < m.wins[i];
        ctx.save(); ctx.translate(left ? x0 + W - 30 - r * 22 : x0 - W + 30 + r * 22, y + H + 14); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = won ? '#ffd466' : 'rgba(0,0,0,0.5)'; ctx.strokeStyle = won ? '#fff0b0' : '#6d7586'; ctx.lineWidth = 2; ctx.fillRect(-6, -6, 12, 12); ctx.strokeRect(-6, -6, 12, 12); ctx.restore();
      }
      // special callout under name
      if (this.callout[i].t > 0) { const c = this.callout[i]; ctx.font = font(18, 800); ctx.globalAlpha = Math.min(1, c.t / 20); ctx.fillStyle = pal.glow; ctx.textAlign = left ? 'left' : 'right'; ctx.shadowColor = pal.glow; ctx.shadowBlur = 10; ctx.fillText(c.s, x0 + dir * 6, y + H + 78); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      ctx.restore();
      // ultimate meter (bottom)
      this._ultMeter(ctx, m, i, t);
    }
    // timer hexagon
    const cx = 640, cy = 52, r = 34;
    ctx.save(); ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath();
    ctx.fillStyle = 'rgba(6,6,10,0.88)'; ctx.fill(); ctx.strokeStyle = '#c8ced9'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = m.timeLeft <= 10 && !m.training ? (Math.sin(t * 12) > 0 ? '#ff5a5a' : '#fff') : '#fff'; ctx.font = font(m.training ? 34 : 36, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m.training ? '∞' : String(Math.max(0, m.timeLeft)), cx, cy + 2); ctx.textBaseline = 'alphabetic';
    ctx.font = font(11, 700); ctx.fillStyle = '#8f98aa'; ctx.fillText(m.training ? 'TRAINING' : `ROUND ${m.round}`, cx, cy + 56);
    ctx.restore();
  }

  _ultMeter(ctx, m, i, t) {
    const f = m.f[i], left = i === 0, w = 300, h = 12, y = 684, x0 = left ? 64 : 1280 - 64, dir = left ? 1 : -1, p = Math.min(1, f.meter / CFG.METER_MAX), full = p >= 1;
    ctx.save();
    ctx.fillStyle = 'rgba(6,6,10,0.8)'; ctx.fillRect(left ? x0 : x0 - w, y, w, h);
    const g = ctx.createLinearGradient(x0, 0, x0 + dir * w, 0); g.addColorStop(0, '#ffb23a'); g.addColorStop(1, full ? '#fff2a0' : '#ff5a2a');
    ctx.fillStyle = g; ctx.globalAlpha = full ? 0.75 + 0.25 * Math.sin(t * 10) : 1; ctx.fillRect(left ? x0 : x0 - w * p, y, w * p, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#c8ced9'; ctx.lineWidth = 2; ctx.strokeRect(left ? x0 : x0 - w, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; for (let k = 1; k < 4; k++) { const px = x0 + dir * w * k / 4; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke(); }
    ctx.font = font(13, 800); ctx.textAlign = left ? 'left' : 'right'; ctx.fillStyle = full ? '#ffe9a0' : '#8f98aa';
    ctx.fillText(full ? 'ULTIMATE READY' : 'VEIL METER', x0, y - 6);
    ctx.restore();
  }

  _combo(ctx, m) {
    for (let i = 0; i < 2; i++) {
      const c = m.combo[i]; if (c.hits < 2 && !c.tag) continue; if (c.timer <= 0) continue;
      const left = i === 0, x = left ? 70 : 1210, y = 250, a = Math.min(1, c.timer / 25), pop = 1 + this.comboPop[i] * 0.05;
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = left ? 'left' : 'right'; ctx.translate(x, y); ctx.scale(pop, pop);
      if (c.hits >= 2) {
        ctx.font = font(78, 900); ctx.lineWidth = 6; ctx.strokeStyle = '#08080c'; ctx.fillStyle = c.hits >= 6 ? '#ffd466' : '#fff'; ctx.strokeText(String(c.hits), 0, 0); ctx.fillText(String(c.hits), 0, 0);
        ctx.font = font(24, 800); ctx.strokeText('HIT COMBO', 0, 28); ctx.fillStyle = '#ff6a5a'; ctx.fillText('HIT COMBO', 0, 28);
        ctx.font = font(18, 700); ctx.fillStyle = '#d0d5df'; ctx.strokeText(`DAMAGE ${Math.round(c.damage)}`, 0, 52); ctx.fillText(`DAMAGE ${Math.round(c.damage)}`, 0, 52);
      }
      if (c.tag) { ctx.font = font(26, 900); ctx.fillStyle = c.tag === 'COUNTER' ? '#ff8a3a' : c.tag === 'PUNISH' ? '#ffd466' : '#7ff3ff'; ctx.strokeStyle = '#08080c'; ctx.lineWidth = 5; const yy = c.hits >= 2 ? 82 : 0; ctx.strokeText(c.tag + '!', 0, yy); ctx.fillText(c.tag + '!', 0, yy); }
      ctx.restore();
    }
  }

  _ann(ctx) {
    const a = this.ann; if (!a) return;
    const k = a.t / a.len, inK = Math.min(1, a.t / 8), out = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
    ctx.save(); ctx.globalAlpha = out; ctx.textAlign = 'center';
    const sc = 1 + (1 - inK) * 0.9;
    // banner strip
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 262 + (1 - inK) * 30, 1280, 100 * inK);
    ctx.translate(640, 340); ctx.scale(sc, sc);
    ctx.font = font(86, 900); ctx.lineWidth = 8; ctx.strokeStyle = '#08080c'; ctx.strokeText(a.text, 0, 0); ctx.fillStyle = a.col; ctx.shadowColor = a.col; ctx.shadowBlur = 24; ctx.fillText(a.text, 0, 0); ctx.shadowBlur = 0;
    if (a.sub) { ctx.font = font(22, 700); ctx.fillStyle = '#d6dae4'; ctx.fillText(a.sub, 0, 34); }
    ctx.restore();
  }

  _ult(ctx) {
    const b = this.ultBanner; if (!b) return;
    const k = b.t / b.len, a = k < 0.15 ? k / 0.15 : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1, left = b.owner === 0;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 150, 1280, 70);
    ctx.fillStyle = b.col; ctx.fillRect(0, 150, 1280, 3); ctx.fillRect(0, 217, 1280, 3);
    ctx.font = font(52, 900); ctx.textAlign = left ? 'left' : 'right'; const x = left ? 80 + (1 - a) * -80 : 1200 + (1 - a) * 80;
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(b.name.toUpperCase(), x, 205); ctx.fillStyle = '#fff'; ctx.shadowColor = b.col; ctx.shadowBlur = 20; ctx.fillText(b.name.toUpperCase(), x, 205);
    ctx.restore();
  }

  _training(ctx, m, opts) {
    const f0 = m.f[0], f1 = m.f[1], mv = f0.move;
    const lines = [
      `P1 STATE  ${f0.state}`, `P1 ANIM   ${f0.anim.name}  f${f0.anim.frame}`,
      mv ? `MOVE  ${mv.name}   S${mv.startup} A${mv.active} R${mv.recovery}   [${f0.phase ? f0.phase.toUpperCase() : ''} ${f0.moveFrame}/${f0.moveLength}]` : 'MOVE  -',
      `COMBO ${m.combo[0].hits}   DMG ${Math.round(m.combo[0].damage)}   MAX ${f0.stats.maxCombo}`,
      `DUMMY ${opts.dummy ? opts.dummy.toUpperCase() : ''}   HP ${f1.hp}/${f1.maxHp}`,
    ];
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(16, 112, 430, 20 + lines.length * 18); ctx.strokeStyle = 'rgba(200,206,216,0.5)'; ctx.strokeRect(16.5, 112.5, 430, 20 + lines.length * 18);
    ctx.font = font(13, 600); ctx.fillStyle = '#d9e2f2'; ctx.textAlign = 'left'; lines.forEach((l, i) => ctx.fillText(l, 28, 136 + i * 18)); ctx.restore();
  }
}
