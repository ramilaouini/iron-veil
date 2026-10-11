// Layered procedural fighter renderer. Each fighter is drawn from separate parts (cape/cloth, far arm, far leg, torso,
// near leg, head, near arm, weapon) using forward kinematics from a pose (see characters/poses.js).
// Every fighter has its own proportions, costume and silhouette-defining accessories - this is NOT a recolor.
import { samplePose } from '../characters/poses.js';

const PX = 0.92;                 // global draw scale (keeps visual height matched to hurtbox)
const D2R = Math.PI / 180;
const OUT = '#08080c';

const hexCache = new Map();
function rgb(hex) {
  let v = hexCache.get(hex); if (v) return v;
  const h = hex.replace('#', ''), n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  v = [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]; hexCache.set(hex, v); return v;
}
export function shade(hex, k) { // k>0 lighten toward white, k<0 darken toward black
  const [r, g, b] = rgb(hex), t = k > 0 ? 255 : 0, a = Math.abs(k);
  return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`;
}

export class FighterRenderer {
  constructor() { this.flat = null; this.flash = 0; this.time = 0; }

  // opts: { alpha, flat (silhouette color), time }
  draw(ctx, f, sx, sy, time, opts = {}) {
    const pose = opts.pose || samplePose(f, time);
    const facing = opts.facing ?? f.facing;
    this.time = time; this.flat = opts.flat || null;
    this.flash = opts.flat ? 0 : Math.min(1, (f.hurtFlash || 0) / 8) * 0.55;
    const d = f.def, p = d.prop, kl = p.s * PX, k = kl * 1.22, pal = f.pal;
    const T = p.thigh * kl, Sh = p.shin * kl, TL = p.torso * kl;
    // Hip placement: lowest foot is planted on the floor/physics height.
    const reach = (a, b) => T * Math.cos(a * D2R) + Sh * Math.cos(b * D2R);
    const H = Math.max(reach(pose.tf, pose.sf), reach(pose.tb, pose.sb)) + Math.max(0, pose.hy);
    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.translate(sx, sy);
    ctx.scale(facing, 1);
    // whole-body spin about the torso centre (Nyra spirals)
    if (pose.sp) { ctx.translate(0, -H - TL * 0.4); ctx.rotate(pose.sp * D2R); ctx.translate(0, H + TL * 0.4); }
    const hip = { x: pose.hx * k, y: -H };
    const vx = f.vx * f.facing, vy = f.vy;
    const sway = Math.max(-26, Math.min(26, -vx * 3.2)) + Math.sin(time * 0.09 + f.index * 2) * 3 + Math.min(18, Math.max(-18, -vy * 2.2));
    const lean = pose.ln * D2R;
    const sh = { x: hip.x + Math.sin(lean) * TL, y: hip.y - Math.cos(lean) * TL };           // shoulder centre
    const ctxo = { f, d, p, k, kl, pal, pose, hip, sh, T, Sh, TL, lean, sway, time, vx };
    const fn = DRAW[d.id];
    fn.behind(this, ctx, ctxo);
    this._leg(ctx, ctxo, 'b'); this._arm(ctx, ctxo, 'b', fn);
    fn.torso(this, ctx, ctxo);
    this._leg(ctx, ctxo, 'f');
    fn.head(this, ctx, ctxo);
    this._arm(ctx, ctxo, 'f', fn);
    fn.front && fn.front(this, ctx, ctxo);
    ctx.restore();
    f._tips = { fhand: ctxo.fhand, bhand: ctxo.bhand, ffoot: ctxo.ffoot, bfoot: ctxo.bfoot, blade: ctxo.blade, sh: ctxo.sh, hip: ctxo.hip, H, k };
  }

  // ---- colors -------------------------------------------------------------------
  c(hex, shadeK = 0) {
    if (this.flat) return this.flat;
    let col = shadeK ? shade(hex, shadeK) : hex;
    if (this.flash > 0) { const [r, g, b] = rgb(hex); const m = this.flash; return `rgb(${Math.round(r + (255 - r) * m)},${Math.round(g + (255 - g) * m)},${Math.round(b + (255 - b) * m)})`; }
    return col;
  }
  glow(hex) { return this.flat ? this.flat : hex; }

  // ---- primitives ---------------------------------------------------------------
  seg(ctx, x0, y0, x1, y1, w0, w1, fill, hl) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
    ctx.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
    ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
    ctx.arc(x0, y0, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
    if (hl && !this.flat) { // rim highlight along the lit edge
      ctx.beginPath(); ctx.moveTo(x0 - nx * w0 * 0.22, y0 - ny * w0 * 0.22); ctx.lineTo(x1 - nx * w1 * 0.22, y1 - ny * w1 * 0.22);
      ctx.strokeStyle = hl; ctx.globalAlpha *= 0.55; ctx.lineWidth = Math.max(1, Math.min(w0, w1) * 0.18); ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha /= 0.55; ctx.lineCap = 'butt';
    }
  }
  poly(ctx, pts, fill, stroke = true) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  ell(ctx, x, y, rx, ry, rot, fill, stroke = true) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, 6.2832);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); }
  }
  line(ctx, x0, y0, x1, y1, col, w) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt'; }
  glowLine(ctx, x0, y0, x1, y1, col, w) {
    if (this.flat) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35; this.line(ctx, x0, y0, x1, y1, col, w * 2.6); ctx.restore();
    this.line(ctx, x0, y0, x1, y1, col, w);
  }
  // Streaming cloth (cape, sash, ribbon): flows opposite to motion, with travelling wave.
  cloth(ctx, x, y, len, w0, w1, baseAng, wave, fill, trim) {
    const n = 7, pts = [], pts2 = [];
    let px = x, py = y, ang = baseAng;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      ang = baseAng + Math.sin(this.time * 0.12 - t * 3.2 + wave) * (0.18 + t * 0.22) + t * wave * 0.012;
      const w = w0 + (w1 - w0) * t;
      pts.push(px - Math.cos(ang + 1.5708) * w / 2, py - Math.sin(ang + 1.5708) * w / 2);
      pts2.unshift(px + Math.cos(ang + 1.5708) * w / 2, py + Math.sin(ang + 1.5708) * w / 2);
      px += Math.cos(ang) * len / (n - 1); py += Math.sin(ang) * len / (n - 1);
    }
    this.poly(ctx, [...pts, ...pts2], fill);
    if (trim && !this.flat) { ctx.beginPath(); ctx.moveTo(pts2[pts2.length - 2], pts2[pts2.length - 1]); for (let i = pts2.length - 4; i >= 0; i -= 2) ctx.lineTo(pts2[i], pts2[i + 1]); ctx.strokeStyle = trim; ctx.lineWidth = 1.6; ctx.stroke(); }
  }

  // ---- limbs ----------------------------------------------------------------------
  _leg(ctx, o, side) {
    const { pose, hip, T, Sh, pal, d, p, k } = o, front = side === 'f';
    const a = front ? pose.tf : pose.tb, b = front ? pose.sf : pose.sb, off = (front ? 1 : -1) * p.torsoW * 0.1 * k;
    const x0 = hip.x + off, y0 = hip.y;
    const kx = x0 + Math.sin(a * D2R) * T, ky = y0 + Math.cos(a * D2R) * T;
    const fx = kx + Math.sin(b * D2R) * Sh, fy = ky + Math.cos(b * D2R) * Sh;
    const th = p.limb * 1.5 * k, sk = p.limb * 1.15 * k;
    const dark = front ? 0 : -0.28;
    const L = LEGS[d.id];
    L(this, ctx, o, { x0, y0, kx, ky, fx, fy, th, sk, front, dark, a, b });
    o[side + 'foot'] = { x: fx, y: fy };
  }
  _arm(ctx, o, side, fn) {
    const { pose, sh, p, k, d } = o, front = side === 'f';
    const ua = front ? pose.uf : pose.ub, fa = front ? pose.ef : pose.eb;
    const off = (front ? 1 : -1) * p.shoulderW * 0.35 * k;
    const x0 = sh.x + off - Math.sin(o.lean) * 3 * k * 0, y0 = sh.y + 4 * k;
    const ul = p.uarm * o.kl, fl = p.farm * o.kl;
    const ex = x0 + Math.sin(ua * D2R) * ul, ey = y0 - Math.cos((180 - ua) * D2R) * 0;
    // angles: 0 = down, 90 = forward, 180 = up  ->  dy = +cos(a) (down positive)
    const ey2 = y0 + Math.cos(ua * D2R) * ul;
    const hx = ex + Math.sin(fa * D2R) * fl, hy = ey2 + Math.cos(fa * D2R) * fl;
    const ua_ = p.limb * 1.25 * k, fa_ = p.limb * 1.0 * k;
    const info = { x0, y0, ex, ey: ey2, hx, hy, uw: ua_, fw: fa_, front, dark: front ? 0 : -0.28, ua, fa };
    ARMS[d.id](this, ctx, o, info);
    o[side + 'hand'] = { x: hx, y: hy, ang: fa };
  }
}

// ---------------------------------------------------------------------------------------
// Per-fighter drawing. Each entry draws a distinct costume. `r` = renderer (helpers), `o` = frame context.
// ---------------------------------------------------------------------------------------
const bootShape = (r, ctx, o, g, col, toe, trimCol) => {
  const { k } = o, fwd = g.b + 90 > 180 ? 0 : 1;
  const ang = Math.abs(g.fy) < 1e-6 ? 0 : 0;
  const onGround = Math.abs(g.fy) < 4 || g.fy > -4;
  const fa = onGround ? 0 : (g.b - 90) * D2R + 1.5708 * 0;       // toe direction
  const dir = onGround ? { x: 1, y: 0 } : { x: Math.sin((g.b + 80) * D2R), y: -Math.cos((g.b + 80) * D2R) * -1 };
  const len = (toe || 20) * k, w = g.sk * 1.15;
  const ex = g.fx + (onGround ? len : Math.sin((g.b + 82) * D2R) * len), ey = g.fy + (onGround ? 0 : Math.cos((g.b + 82) * D2R) * len);
  r.seg(ctx, g.fx - 2 * k, g.fy - 1, ex, ey - 1 * k, w, w * 0.72, r.c(col), r.c(col, 0.3));
  if (trimCol) r.line(ctx, g.fx + 2 * k, g.fy - w * 0.35, g.fx + 2 * k, g.fy + w * 0.35, r.c(trimCol), 2);
};

const LEGS = {
  kael(r, ctx, o, g) {
    const { pal, k } = o, dk = g.dark;
    r.seg(ctx, g.x0, g.y0, g.kx, g.ky, g.th, g.th * 0.86, r.c(pal.armor2, dk - 0.15), r.c(pal.armor2, 0.25));      // cloth trousers
    r.seg(ctx, g.kx, g.ky, g.fx, g.fy, g.th * 0.84, g.sk * 0.9, r.c(pal.armor, dk), r.c(pal.armor2, 0.35));
    r.ell(ctx, g.kx + 1, g.ky, g.th * 0.52, g.th * 0.52, 0, r.c(pal.armor2, dk + 0.1));                                     // knee plate
    r.poly(ctx, [g.kx - 5 * k, g.ky + 6 * k, g.kx + 6 * k, g.ky + 6 * k, g.fx + 3 * k, g.fy - 6 * k, g.fx - 4 * k, g.fy - 6 * k], null, false);
    bootShape(r, ctx, o, g, pal.armor, 24, pal.trim);
  },
  nyra(r, ctx, o, g) {
    const { pal, k } = o, dk = g.dark;
    r.seg(ctx, g.x0, g.y0, g.kx, g.ky, g.th * 0.92, g.th * 0.7, r.c(pal.armor, dk), r.c(pal.armor2, 0.2));
    r.seg(ctx, g.kx, g.ky, g.fx, g.fy, g.th * 0.68, g.sk * 0.7, r.c(pal.armor, dk), r.c(pal.armor2, 0.2));
    r.line(ctx, g.kx, g.ky, g.fx, g.fy, r.c(pal.glow), 1.6);
    if (g.front) r.seg(ctx, g.kx + (g.fx - g.kx) * 0.3, g.ky + (g.fy - g.ky) * 0.3, g.fx, g.fy, g.sk * 0.9, g.sk * 0.75, r.c(pal.trim, dk), null); // silver greave (asymmetric: near leg only)
    bootShape(r, ctx, o, g, pal.armor2, 22, pal.glow);
  },
  bram(r, ctx, o, g) {
    const { pal, k } = o, dk = g.dark;
    r.seg(ctx, g.x0, g.y0, g.kx, g.ky, g.th * 1.15, g.th * 1.0, r.c(pal.cloth, dk - 0.1), r.c(pal.cloth, 0.2));
    r.seg(ctx, g.kx, g.ky, g.fx, g.fy, g.th * 0.98, g.sk * 1.05, r.c(pal.armor, dk), r.c(pal.armor, 0.3));
    r.ell(ctx, g.kx + 3 * k, g.ky, g.th * 0.7, g.th * 0.62, 0, r.c(pal.armor, dk + 0.05));
    r.line(ctx, g.kx - 4 * k, g.ky, g.kx + 9 * k, g.ky, r.c(pal.trim), 2);
    r.seg(ctx, g.fx - 6 * k, g.fy - 14 * k, g.fx + 6 * k, g.fy - 14 * k, 6 * k, 6 * k, r.c(pal.armor2, dk), null);                   // shin band
    bootShape(r, ctx, o, g, pal.armor2, 30, null);
  },
  sora(r, ctx, o, g) {
    const { pal, k } = o, dk = g.dark;
    r.seg(ctx, g.x0, g.y0, g.kx, g.ky, g.th * 1.0, g.th * 0.9, r.c(pal.armor2, dk), null);
    r.seg(ctx, g.kx, g.ky, g.fx, g.fy, g.th * 0.82, g.sk * 0.75, r.c(pal.armor, dk), r.c(pal.armor, 0.3));
    r.seg(ctx, g.kx + (g.fx - g.kx) * 0.55, g.ky + (g.fy - g.ky) * 0.55, g.fx, g.fy, g.sk * 0.95, g.sk * 0.8, r.c(pal.cloth, dk), null);     // wraps
    bootShape(r, ctx, o, g, pal.armor2, 20, pal.glow);
  },
  vex(r, ctx, o, g) {
    const { pal, k } = o, dk = g.dark;
    r.seg(ctx, g.x0, g.y0, g.kx, g.ky, g.th * 0.95, g.th * 0.78, r.c(pal.armor, dk), r.c(pal.armor2, 0.3));
    r.seg(ctx, g.kx, g.ky, g.fx, g.fy, g.th * 0.75, g.sk * 0.8, r.c(pal.armor2, dk), r.c(pal.armor2, 0.3));
    r.ell(ctx, g.kx, g.ky, g.th * 0.5, g.th * 0.5, 0, r.c(pal.armor, dk - 0.15));
    r.glowLine(ctx, g.x0 + (g.kx - g.x0) * 0.2, g.y0 + (g.ky - g.y0) * 0.2, g.x0 + (g.kx - g.x0) * 0.85, g.y0 + (g.ky - g.y0) * 0.85, r.glow(pal.glow), 1.6);
    r.glowLine(ctx, g.kx + (g.fx - g.kx) * 0.2, g.ky + (g.fy - g.ky) * 0.2, g.kx + (g.fx - g.kx) * 0.8, g.ky + (g.fy - g.ky) * 0.8, r.glow(pal.glow), 1.6);
    bootShape(r, ctx, o, g, pal.armor, 26, null);
  },
  sera(r, ctx, o, g) {
    const { pal, k } = o, dk = g.dark;
    r.seg(ctx, g.x0, g.y0, g.kx, g.ky, g.th * 0.95, g.th * 0.82, r.c(pal.armor2, dk - 0.05), null);
    r.seg(ctx, g.kx, g.ky, g.fx, g.fy, g.th * 0.8, g.sk * 0.85, r.c(pal.armor, dk), r.c(pal.armor, 0.35));
    r.poly(ctx, [g.kx - 6 * k, g.ky - 4 * k, g.kx + 9 * k, g.ky, g.kx + 6 * k, g.ky + 9 * k, g.kx - 5 * k, g.ky + 6 * k], r.c(pal.trim, dk), true);   // poleyn
    bootShape(r, ctx, o, g, pal.armor, 26, pal.glow);
  },
};

const hand = (r, ctx, o, i, kind) => {
  const { pal, k, d } = o, rad = (kind === 'fist' ? 8.2 : 6.2) * k * (d.id === 'bram' ? 1.55 : 1);
  r.ell(ctx, i.hx, i.hy, rad, rad * 0.95, 0, r.c(kind === 'glove' ? pal.armor2 : pal.skin, i.dark));
};

const ARMS = {
  kael(r, ctx, o, i) {
    const { pal, k } = o, dk = i.dark;
    r.seg(ctx, i.x0, i.y0, i.ex, i.ey, i.uw, i.uw * 0.9, r.c(pal.armor2, dk - 0.1), r.c(pal.armor2, 0.3));
    r.ell(ctx, i.x0, i.y0 - 1, 13 * k, 9 * k, (i.ua - 90) * D2R * 0.4, r.c(pal.armor, dk));                          // pauldron
    r.poly(ctx, [i.x0 - 10 * k, i.y0 - 2 * k, i.x0, i.y0 - 11 * k, i.x0 + 12 * k, i.y0 - 2 * k], r.c(pal.armor2, dk + 0.1), true);
    r.seg(ctx, i.ex, i.ey, i.hx, i.hy, i.fw * 1.05, i.fw * 0.9, r.c(pal.armor, dk), r.c(pal.armor2, 0.4));          // vambrace
    r.line(ctx, i.ex + (i.hx - i.ex) * 0.2, i.ey + (i.hy - i.ey) * 0.2, i.ex + (i.hx - i.ex) * 0.2 + 2, i.ey + (i.hy - i.ey) * 0.2, r.c(pal.cloth), 3);
    hand(r, ctx, o, i, 'glove');
  },
  nyra(r, ctx, o, i) {
    const { pal, k } = o, dk = i.dark;
    r.seg(ctx, i.x0, i.y0, i.ex, i.ey, i.uw * 0.85, i.uw * 0.7, r.c(pal.skin, dk), null);
    r.seg(ctx, i.ex, i.ey, i.hx, i.hy, i.fw * 0.95, i.fw * 0.8, r.c(pal.armor, dk), r.c(pal.armor2, 0.3));
    r.glowLine(ctx, i.ex, i.ey, i.hx, i.hy, r.glow(pal.glow), 1.5);
    if (i.front) { r.ell(ctx, i.x0 + 1, i.y0 - 3 * k, 15 * k, 11 * k, -0.5, r.c(pal.armor2, dk)); r.line(ctx, i.x0 - 12 * k, i.y0 - 1 * k, i.x0 + 12 * k, i.y0 - 8 * k, r.c(pal.trim), 2); }   // asymmetric single pauldron
    hand(r, ctx, o, i, 'skin');
  },
  bram(r, ctx, o, i) {
    const { pal, k } = o, dk = i.dark;
    r.seg(ctx, i.x0, i.y0, i.ex, i.ey, i.uw * 1.25, i.uw * 1.1, r.c(pal.skin, dk - 0.1), r.c(pal.skin, 0.2));
    r.seg(ctx, i.ex, i.ey, i.hx, i.hy, i.fw * 1.5, i.fw * 1.35, r.c(pal.armor, dk), r.c(pal.armor, 0.3));          // massive gauntlet
    r.line(ctx, i.ex + (i.hx - i.ex) * 0.35, i.ey + (i.hy - i.ey) * 0.35, i.ex + (i.hx - i.ex) * 0.35 + 3, i.ey + (i.hy - i.ey) * 0.35 - 3, r.c(pal.glow), 2.5);
    r.ell(ctx, i.hx, i.hy, 14 * k, 13 * k, 0, r.c(pal.armor2, dk));
    r.line(ctx, i.hx - 6 * k, i.hy - 3 * k, i.hx + 6 * k, i.hy - 3 * k, r.c(pal.armor, 0.3), 2);
    if (i.front) {                                                                                                    // shoulder guard
      r.ell(ctx, i.x0 + 2 * k, i.y0 - 6 * k, 25 * k, 17 * k, -0.2, r.c(pal.armor, dk));
      r.ell(ctx, i.x0 + 2 * k, i.y0 - 9 * k, 18 * k, 10 * k, -0.2, r.c(pal.armor2, dk));
      for (let s = -1; s <= 1; s++) r.poly(ctx, [i.x0 + s * 11 * k - 3, i.y0 - 17 * k, i.x0 + s * 11 * k, i.y0 - 30 * k, i.x0 + s * 11 * k + 3, i.y0 - 17 * k], r.c(pal.trim, dk), true);
    } else r.ell(ctx, i.x0, i.y0 - 4 * k, 20 * k, 14 * k, 0, r.c(pal.armor, dk));
  },
  sora(r, ctx, o, i) {
    const { pal, k } = o, dk = i.dark;
    r.seg(ctx, i.x0, i.y0, i.ex, i.ey, i.uw * 1.1, i.uw * 1.4, r.c(pal.cloth, dk), r.c(pal.cloth, 0.3));            // wide sleeve
    r.seg(ctx, i.ex, i.ey, i.hx, i.hy, i.fw * 1.6, i.fw * 1.05, r.c(pal.cloth, dk - 0.05), null);
    const cx = i.hx - (i.hx - i.ex) * 0.08, cy = i.hy - (i.hy - i.ey) * 0.08;
    r.ell(ctx, cx, cy, 6 * k, 6 * k, 0, r.c(pal.armor, dk));                                                        // cuff
    r.glowLine(ctx, i.ex + (i.hx - i.ex) * 0.5 - 4, i.ey + (i.hy - i.ey) * 0.5, i.ex + (i.hx - i.ex) * 0.5 + 4, i.ey + (i.hy - i.ey) * 0.5, r.glow(pal.glow), 1.5);
    hand(r, ctx, o, i, 'skin');
    // trailing sleeve cloth
    r.cloth(ctx, i.hx - (i.hx - i.ex) * 0.25, i.hy - (i.hy - i.ey) * 0.25, 22 * k, 11 * k, 3, Math.atan2(i.hy - i.ey, i.hx - i.ex) + Math.PI - o.sway * 0.01, o.sway, r.c(pal.cloth, dk), r.c(pal.trim));
  },
  vex(r, ctx, o, i) {
    const { pal, k } = o, dk = i.dark;
    r.seg(ctx, i.x0, i.y0, i.ex, i.ey, i.uw * 0.9, i.uw * 0.75, r.c(pal.armor, dk), r.c(pal.armor2, 0.3));
    r.ell(ctx, i.x0, i.y0, 10 * k, 10 * k, 0, r.c(pal.armor2, dk));                                                 // ball shoulder
    r.ell(ctx, i.ex, i.ey, 6 * k, 6 * k, 0, r.c(pal.armor2, dk - 0.1));
    r.seg(ctx, i.ex, i.ey, i.hx, i.hy, i.fw * 1.05, i.fw * 0.85, r.c(pal.armor2, dk), r.c(pal.trim, 0.1));
    r.glowLine(ctx, i.ex + (i.hx - i.ex) * 0.15, i.ey + (i.hy - i.ey) * 0.15, i.ex + (i.hx - i.ex) * 0.85, i.ey + (i.hy - i.ey) * 0.85, r.glow(pal.glow), 1.5);
    r.poly(ctx, [i.hx - 6 * k, i.hy - 6 * k, i.hx + 8 * k, i.hy - 5 * k, i.hx + 8 * k, i.hy + 5 * k, i.hx - 6 * k, i.hy + 6 * k], r.c(pal.armor, dk), true);   // blocky fist
  },
  sera(r, ctx, o, i) {
    const { pal, k } = o, dk = i.dark;
    r.seg(ctx, i.x0, i.y0, i.ex, i.ey, i.uw, i.uw * 0.9, r.c(pal.armor2, dk), null);
    r.seg(ctx, i.ex, i.ey, i.hx, i.hy, i.fw * 1.1, i.fw * 0.95, r.c(pal.armor, dk), r.c(pal.trim, 0.3));
    r.poly(ctx, [i.x0 - 10 * k, i.y0 - 3 * k, i.x0 + 2 * k, i.y0 - 12 * k, i.x0 + 12 * k, i.y0 - 2 * k, i.x0, i.y0 + 5 * k], r.c(pal.armor, dk + 0.05), true);   // winged pauldron
    r.line(ctx, i.x0 - 6 * k, i.y0 - 3 * k, i.x0 + 8 * k, i.y0 - 4 * k, r.c(pal.glow), 1.6);
    hand(r, ctx, o, i, 'glove');
    if (i.front) { // ceremonial blade held in the near hand, along the forearm direction
      const a = i.fa * D2R, bx = Math.sin(a), by = Math.cos(a), L = 66 * k;
      const gx = i.hx - bx * 6 * k, gy = i.hy - by * 6 * k;
      r.line(ctx, gx, gy, i.hx + bx * 4 * k, i.hy + by * 4 * k, r.c('#2a1a12'), 5 * k);                              // grip
      r.line(ctx, i.hx - by * 9 * k, i.hy + bx * 9 * k, i.hx + by * 9 * k, i.hy - bx * 9 * k, r.c('#c8a850'), 3.5);   // crossguard
      const tx = i.hx + bx * L, ty = i.hy + by * L;
      r.poly(ctx, [i.hx - by * 3.4 * k, i.hy + bx * 3.4 * k, tx, ty, i.hx + by * 3.4 * k, i.hy - bx * 3.4 * k], r.c('#dfe6ee'), true);
      r.glowLine(ctx, i.hx + bx * 10 * k, i.hy + by * 10 * k, tx - bx * 4, ty - by * 4, r.glow(pal.glow), 1.4);
      o.blade = { x: tx, y: ty, hx: i.hx, hy: i.hy };
    }
  },
};

// torso / head / background-cloth per fighter ------------------------------------------------
const torsoQuad = (o, wTop, wBot) => { // returns torso polygon from hip to shoulder, widths at each end
  const { hip, sh, lean } = o, nx = Math.cos(lean), ny = Math.sin(lean);
  return [hip.x - nx * wBot / 2, hip.y - ny * wBot / 2, hip.x + nx * wBot / 2, hip.y + ny * wBot / 2, sh.x + nx * wTop / 2, sh.y + ny * wTop / 2, sh.x - nx * wTop / 2, sh.y - ny * wTop / 2];
};
const along = (o, t, side = 0, w = 1) => { const { hip, sh, lean } = o; return { x: hip.x + (sh.x - hip.x) * t + Math.cos(lean) * side * w, y: hip.y + (sh.y - hip.y) * t + Math.sin(lean) * side * w }; };

const DRAW = {
  kael: {
    behind(r, ctx, o) {
      const { pal, k, hip, sh } = o;
      // long crimson sash trailing from the waist
      r.cloth(ctx, hip.x - 6 * k, hip.y - 4 * k, 70 * k, 15 * k, 8 * k, Math.PI + 0.3 + o.sway * 0.012, o.sway, r.c(pal.cloth), r.c(pal.cloth, 0.3));
      r.cloth(ctx, hip.x - 2 * k, hip.y - 2 * k, 52 * k, 11 * k, 5 * k, Math.PI - 0.1 + o.sway * 0.014, o.sway + 2, r.c(pal.cloth, -0.2), null);
    },
    torso(r, ctx, o) {
      const { pal, k, hip, sh, p } = o;
      r.poly(ctx, torsoQuad(o, p.torsoW * 0.95 * k, p.torsoW * 0.62 * k), r.c(pal.armor, -0.1));                         // undersuit
      const c1 = along(o, 0.35), c2 = along(o, 0.92);
      r.poly(ctx, [c1.x - 15 * k, c1.y, c1.x + 17 * k, c1.y - 2 * k, c2.x + 20 * k, c2.y, c2.x - 15 * k, c2.y + 3 * k], r.c(pal.armor), true);   // chest plate
      const m = along(o, 0.62);
      r.line(ctx, m.x - 14 * k, m.y, m.x + 15 * k, m.y - 1, r.c(pal.armor2, 0.25), 2);
      r.poly(ctx, [m.x - 4 * k, c2.y + 6 * k, m.x + 8 * k, c2.y + 3 * k, m.x + 4 * k, m.y + 4 * k], r.c(pal.armor2), true);
      r.glowLine(ctx, m.x - 6 * k, m.y + 8 * k, m.x + 8 * k, m.y + 6 * k, r.glow(pal.glow), 1.4);
      // belt + tassets (layered hip plates)
      const b = along(o, 0.08);
      r.poly(ctx, [b.x - 18 * k, b.y - 5 * k, b.x + 18 * k, b.y - 5 * k, b.x + 17 * k, b.y + 4 * k, b.x - 17 * k, b.y + 4 * k], r.c(pal.cloth, -0.3));
      for (let t = 0; t < 3; t++) r.poly(ctx, [b.x - 14 * k + t * 9 * k, b.y + 3 * k, b.x - 4 * k + t * 9 * k, b.y + 3 * k, b.x - 5 * k + t * 9 * k, b.y + 20 * k, b.x - 14 * k + t * 9 * k, b.y + 18 * k], r.c(pal.armor2, t * 0.07 - 0.1));
      r.ell(ctx, b.x + 1, b.y, 4.5 * k, 4.5 * k, 0, r.c(pal.trim));
      // sash diagonal across chest
      r.poly(ctx, [sh.x - 16 * k, sh.y + 4 * k, sh.x - 8 * k, sh.y + 2 * k, b.x + 18 * k, b.y - 3 * k, b.x + 10 * k, b.y - 1 * k], r.c(pal.cloth), true);
    },
    head(r, ctx, o) {
      const { pal, k, sh, pose } = o, hr = o.p.head * k, ha = (o.lean * 57.3 + pose.hd) * D2R;
      const nx = sh.x + Math.sin(ha) * 6 * k, ny = sh.y - Math.cos(ha) * 6 * k;
      const hx = nx + Math.sin(ha) * hr * 0.9, hy = ny - Math.cos(ha) * hr * 0.9;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
      r.line(ctx, -2 * k, hr * 0.9, -2 * k, hr * 0.2, r.c(pal.skin, -0.2), 7 * k);
      r.ell(ctx, 0, 0, hr * 0.95, hr, 0, r.c(pal.skin, -0.05));
      r.poly(ctx, [-hr * 0.95, -hr * 0.1, -hr * 0.4, -hr * 1.2, hr * 0.5, -hr * 1.1, hr * 0.98, -hr * 0.3, hr * 0.3, -hr * 0.55, -hr * 0.6, -hr * 0.35], r.c(pal.hair), true);   // hair
      r.poly(ctx, [-hr * 0.55, hr * 0.05, hr * 1.0, -hr * 0.1, hr * 1.05, hr * 0.5, hr * 0.4, hr * 1.2, hr * 0.05, hr * 1.35, -hr * 0.5, hr * 0.7], r.c('#aeb6c0'), true);   // angular mask
      r.line(ctx, hr * 0.1, hr * 0.1, hr * 0.95, hr * 0.15, r.c('#6a7280'), 1.6);
      r.poly(ctx, [hr * 0.15, -hr * 0.18, hr * 0.8, -hr * 0.25, hr * 0.78, -hr * 0.05, hr * 0.2, 0], r.c('#0b0b10'), false);
      r.glowLine(ctx, hr * 0.25, -hr * 0.12, hr * 0.78, -hr * 0.16, r.glow(pal.glow), 2);                                // eye slit
      ctx.restore();
    },
  },

  nyra: {
    behind(r, ctx, o) {
      const { pal, k, sh, pose } = o, ha = (o.lean * 57.3 + pose.hd) * D2R;
      const hx = sh.x + Math.sin(ha) * (6 + o.p.head * 1.8) * k, hy = sh.y - Math.cos(ha) * (6 + o.p.head * 1.8) * k;
      // long ponytail: strong secondary motion
      r.cloth(ctx, hx - 8 * k, hy + 2 * k, 78 * k, 9 * k, 2, Math.PI * 0.95 + o.sway * 0.02 + 0.35, o.sway * 1.4, r.c(pal.hair), r.c(pal.glow));
      r.cloth(ctx, o.hip.x - 4 * k, o.hip.y - 3 * k, 38 * k, 10 * k, 4, Math.PI - 0.2 + o.sway * 0.016, o.sway + 1, r.c(pal.cloth), r.c(pal.glow));
    },
    torso(r, ctx, o) {
      const { pal, k, hip, sh, p } = o;
      r.poly(ctx, torsoQuad(o, p.torsoW * 0.9 * k, p.torsoW * 0.7 * k), r.c(pal.skin, -0.1));                         // bare midriff
      const c = along(o, 0.55), up = along(o, 0.95), lo = along(o, 0.25);
      r.poly(ctx, [c.x - 12 * k, c.y, c.x + 13 * k, c.y - 2 * k, up.x + 14 * k, up.y, up.x - 11 * k, up.y + 2 * k], r.c(pal.armor), true);       // compact bustier
      r.poly(ctx, [lo.x - 14 * k, lo.y + 7 * k, lo.x + 15 * k, lo.y + 5 * k, lo.x + 12 * k, lo.y - 5 * k, lo.x - 12 * k, lo.y - 4 * k], r.c(pal.armor2, -0.1), true);  // sash/belt
      r.poly(ctx, [lo.x + 4 * k, lo.y - 3 * k, lo.x + 22 * k, lo.y + 16 * k, lo.x + 12 * k, lo.y + 22 * k, lo.x - 2 * k, lo.y + 3 * k], r.c(pal.cloth), true); // asymmetric hip flap (one side)
      r.glowLine(ctx, c.x - 8 * k, c.y + 3 * k, c.x + 9 * k, c.y + 1 * k, r.glow(pal.glow), 1.5);
      r.glowLine(ctx, c.x, c.y + 3 * k, c.x + 2 * k, lo.y + 2 * k, r.glow(pal.glow), 1.4);
      r.line(ctx, sh.x - 10 * k, sh.y + 2 * k, sh.x + 10 * k, sh.y + 1 * k, r.c(pal.trim), 2);
    },
    head(r, ctx, o) {
      const { pal, k, sh, pose } = o, hr = o.p.head * k, ha = (o.lean * 57.3 + pose.hd) * D2R;
      const hx = sh.x + Math.sin(ha) * (6 + hr * 0.9) , hy = sh.y - Math.cos(ha) * (6 * k + hr * 0.9);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
      r.line(ctx, -1 * k, hr * 0.9, -1 * k, hr * 0.1, r.c(pal.skin, -0.2), 5.5 * k);
      r.ell(ctx, 0, 0, hr * 0.9, hr * 1.02, 0, r.c(pal.skin));
      r.poly(ctx, [-hr * 1.0, hr * 0.2, -hr * 0.9, -hr * 0.8, -hr * 0.1, -hr * 1.25, hr * 0.9, -hr * 0.8, hr * 1.0, -hr * 0.2, hr * 0.5, -hr * 0.55, -hr * 0.2, -hr * 0.6], r.c(pal.hair), true);   // swept hair
      r.poly(ctx, [-hr * 0.2, -hr * 0.15, hr * 1.0, -hr * 0.2, hr * 1.0, hr * 0.12, -hr * 0.1, hr * 0.12], r.c(pal.armor), true);   // half-mask band across eyes
      r.glowLine(ctx, hr * 0.2, -hr * 0.05, hr * 0.85, -hr * 0.07, r.glow(pal.glow), 2.4);
      r.glowLine(ctx, -hr * 0.2, hr * 0.5, hr * 0.2, hr * 0.85, r.glow(pal.glow), 1.3);   // face marking
      ctx.restore();
    },
  },

  bram: {
    behind(r, ctx, o) {
      const { pal, k, hip, sh } = o;
      // backpack furnace + exhaust pipes
      const c = along(o, 0.55);
      r.poly(ctx, [c.x - 34 * k, c.y - 18 * k, c.x - 12 * k, c.y - 24 * k, c.x - 10 * k, c.y + 24 * k, c.x - 32 * k, c.y + 20 * k], r.c(pal.armor2, -0.1), true);
      r.glowLine(ctx, c.x - 28 * k, c.y - 8 * k, c.x - 28 * k, c.y + 12 * k, r.glow(pal.glow), 3);
      r.seg(ctx, c.x - 28 * k, c.y - 20 * k, c.x - 40 * k, c.y - 52 * k, 7 * k, 5 * k, r.c(pal.armor, -0.1), null);
      r.seg(ctx, c.x - 20 * k, c.y - 22 * k, c.x - 24 * k, c.y - 56 * k, 6 * k, 4.5 * k, r.c(pal.armor, -0.1), null);
      if (!r.flat) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.25; for (let i = 0; i < 3; i++) r.ell(ctx, c.x - 40 * k - i * 3, c.y - 56 * k - i * 12 - (o.time * 0.6 % 10), 4 + i * 2, 4 + i * 2, 0, pal.glow, false); ctx.restore(); }
    },
    torso(r, ctx, o) {
      const { pal, k, hip, sh, p } = o;
      r.poly(ctx, torsoQuad(o, p.torsoW * 1.0 * k, p.torsoW * 0.68 * k), r.c(pal.cloth));
      const c = along(o, 0.5), up = along(o, 0.98), lo = along(o, 0.1);
      r.poly(ctx, [c.x - 28 * k, c.y - 6 * k, c.x + 30 * k, c.y - 8 * k, up.x + 30 * k, up.y + 2 * k, up.x - 26 * k, up.y + 6 * k], r.c(pal.armor), true);   // slab chest plate
      r.line(ctx, c.x - 26 * k, c.y + 12 * k, c.x + 28 * k, c.y + 9 * k, r.c(pal.armor2), 3);
      for (let i = -2; i <= 2; i++) r.ell(ctx, c.x + i * 11 * k, c.y + 3 * k, 1.8 * k, 1.8 * k, 0, r.c(pal.trim, 0.2), false);       // rivets
      r.glowLine(ctx, c.x - 10 * k, c.y + 18 * k, c.x + 12 * k, c.y + 16 * k, r.glow(pal.glow), 2.2);
      r.poly(ctx, [lo.x - 30 * k, lo.y - 8 * k, lo.x + 30 * k, lo.y - 8 * k, lo.x + 28 * k, lo.y + 14 * k, lo.x - 28 * k, lo.y + 14 * k], r.c(pal.armor2, -0.15), true);  // belt block
      r.poly(ctx, [lo.x - 6 * k, lo.y - 6 * k, lo.x + 8 * k, lo.y - 6 * k, lo.x + 10 * k, lo.y + 12 * k, lo.x - 8 * k, lo.y + 12 * k], r.c(pal.trim, -0.1), true);
    },
    head(r, ctx, o) {
      const { pal, k, sh, pose } = o, hr = o.p.head * k, ha = (o.lean * 57.3 + pose.hd) * D2R;
      const hx = sh.x + Math.sin(ha) * (hr * 0.85 + 2 * k) + 5 * k, hy = sh.y - Math.cos(ha) * (hr * 0.85 + 2 * k);   // head sits low between shoulders
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
      r.ell(ctx, 0, 0, hr * 0.95, hr * 0.98, 0, r.c(pal.skin, -0.05));
      r.poly(ctx, [-hr * 0.95, -hr * 0.1, -hr * 0.7, -hr * 0.9, hr * 0.7, -hr * 0.95, hr * 0.98, -hr * 0.1, hr * 0.9, -hr * 0.3, -hr * 0.2, -hr * 0.35], r.c(pal.armor2), true);   // riveted skullcap
      r.line(ctx, -hr * 0.2, -hr * 0.9, hr * 0.2, -hr * 0.9, r.c(pal.trim), 2);
      r.poly(ctx, [hr * 0.1, hr * 0.15, hr * 1.0, hr * 0.05, hr * 0.9, hr * 0.9, hr * 0.2, hr * 1.2, -hr * 0.4, hr * 0.8], r.c(pal.hair), true);       // heavy beard
      r.poly(ctx, [hr * 0.3, -hr * 0.2, hr * 0.98, -hr * 0.22, hr * 0.98, hr * 0.0, hr * 0.3, hr * 0.0], r.c('#101014'), true);   // goggles
      r.glowLine(ctx, hr * 0.4, -hr * 0.11, hr * 0.92, -hr * 0.11, r.glow(pal.glow), 2.6);
      ctx.restore();
    },
  },

  sora: {
    behind(r, ctx, o) {
      const { pal, k, hip, sh } = o;
      // floating ribbons
      r.cloth(ctx, hip.x - 4 * k, hip.y - 8 * k, 70 * k, 9 * k, 3, Math.PI + 0.5 + o.sway * 0.012, o.sway * 1.2, r.c(pal.cloth), r.c(pal.glow));
      r.cloth(ctx, hip.x - 2 * k, hip.y - 4 * k, 58 * k, 8 * k, 3, Math.PI + 0.05 + o.sway * 0.016, o.sway + 5, r.c(pal.armor, 0.1), r.c(pal.trim));
      // halo ring behind shoulders
      if (!r.flat) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = pal.glow; ctx.globalAlpha *= 0.28 + 0.1 * Math.sin(o.time * 0.08); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(sh.x - 2 * k, sh.y - 20 * k, 30 * k, 30 * k, 0, 0, 6.28); ctx.stroke(); ctx.lineWidth = 1; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.ellipse(sh.x - 2 * k, sh.y - 20 * k, 38 * k, 38 * k, 0, o.time * 0.02, o.time * 0.02 + 6.28); ctx.stroke(); ctx.restore(); }
    },
    torso(r, ctx, o) {
      const { pal, k, hip, sh, p } = o;
      // layered robe: flared skirt panels with a front slit; hems swing with movement
      const lo = along(o, 0.02), fl = Math.max(-14, Math.min(14, o.sway * 0.5)), hem = lo.y + 44 * k;
      const panel = (x0, x1, h0, h1, col, tr) => { r.poly(ctx, [lo.x + x0 * k, lo.y - 3 * k, lo.x + x1 * k, lo.y - 3 * k, lo.x + x1 * k * 1.55 + fl, lo.y + h1 * k, lo.x + (x0 + (x1 - x0) * 0.5) * k + fl * 0.6, lo.y + (h1 + 6) * k, lo.x + x0 * k * 1.5 + fl, lo.y + h0 * k], col, true); if (tr && !r.flat) { r.line(ctx, lo.x + x0 * k * 1.5 + fl, lo.y + h0 * k, lo.x + (x0 + (x1 - x0) * 0.5) * k + fl * 0.6, lo.y + (h1 + 6) * k, tr, 1.6); r.line(ctx, lo.x + (x0 + (x1 - x0) * 0.5) * k + fl * 0.6, lo.y + (h1 + 6) * k, lo.x + x1 * k * 1.55 + fl, lo.y + h1 * k, tr, 1.6); } };
      panel(-20, -2, 40, 46, r.c(pal.armor, -0.1), r.c(pal.glow));           // back panel (dark)
      panel(-8, 14, 42, 48, r.c(pal.cloth, -0.08), r.c(pal.trim));            // centre panel
      panel(2, 22, 36, 42, r.c(pal.cloth), r.c(pal.glow));                    // front flap
      r.poly(ctx, torsoQuad(o, p.torsoW * 0.95 * k, p.torsoW * 0.7 * k), r.c(pal.cloth));
      const c = along(o, 0.5), up = along(o, 0.95);
      // crossed collar + armor strips
      r.poly(ctx, [up.x - 12 * k, up.y + 2 * k, up.x + 2 * k, up.y + 4 * k, c.x + 10 * k, c.y - 6 * k, c.x - 8 * k, c.y - 4 * k], r.c(pal.armor), true);
      r.poly(ctx, [up.x + 12 * k, up.y + 2 * k, up.x - 2 * k, up.y + 4 * k, c.x - 10 * k, c.y - 6 * k, c.x + 8 * k, c.y - 4 * k], r.c(pal.armor2), true);
      const b = along(o, 0.1);
      r.poly(ctx, [b.x - 17 * k, b.y - 4 * k, b.x + 17 * k, b.y - 4 * k, b.x + 17 * k, b.y + 5 * k, b.x - 17 * k, b.y + 5 * k], r.c(pal.armor, -0.05), true);
      r.glowLine(ctx, c.x - 4 * k, c.y + 6 * k, c.x + 4 * k, c.y + 6 * k, r.glow(pal.glow), 1.6); r.glowLine(ctx, c.x, c.y + 2 * k, c.x, c.y + 12 * k, r.glow(pal.glow), 1.6);
      r.glowLine(ctx, b.x - 10 * k, b.y, b.x + 10 * k, b.y, r.glow(pal.glow), 1.4);
    },
    head(r, ctx, o) {
      const { pal, k, sh, pose } = o, hr = o.p.head * k, ha = (o.lean * 57.3 + pose.hd) * D2R;
      const hx = sh.x + Math.sin(ha) * (6 * k + hr * 0.9), hy = sh.y - Math.cos(ha) * (6 * k + hr * 0.9);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
      r.line(ctx, -1 * k, hr * 0.9, -1 * k, hr * 0.1, r.c(pal.skin, -0.2), 5 * k);
      r.ell(ctx, 0, 0, hr * 0.88, hr, 0, r.c(pal.skin));
      r.poly(ctx, [-hr * 1.0, hr * 0.3, -hr * 0.9, -hr * 0.8, 0, -hr * 1.15, hr * 0.8, -hr * 0.8, hr * 0.95, -hr * 0.1, hr * 0.4, -hr * 0.5, -hr * 0.3, -hr * 0.45], r.c(pal.hair), true);
      r.ell(ctx, -hr * 0.4, -hr * 1.35, hr * 0.5, hr * 0.5, 0, r.c(pal.hair));              // top-knot
      r.line(ctx, -hr * 0.4, -hr * 0.9, -hr * 0.4, -hr * 1.1, r.c(pal.trim), 2.5);
      r.poly(ctx, [-hr * 0.95, -hr * 0.55, hr * 0.95, -hr * 0.65, hr * 0.95, -hr * 0.4, -hr * 0.95, -hr * 0.3], r.c(pal.cloth), true);   // headband
      r.glowLine(ctx, hr * 0.3, -hr * 0.06, hr * 0.7, -hr * 0.08, r.glow(pal.glow), 2);
      r.glowLine(ctx, hr * 0.05, -hr * 0.52, hr * 0.05, -hr * 0.44, r.glow(pal.glow), 2.2);
      ctx.restore();
    },
  },

  vex: {
    behind(r, ctx, o) {
      const { pal, k, hip, sh } = o, c = along(o, 0.6);
      // dorsal thruster + antenna cables
      r.poly(ctx, [c.x - 18 * k, c.y - 16 * k, c.x - 6 * k, c.y - 20 * k, c.x - 6 * k, c.y + 16 * k, c.x - 18 * k, c.y + 14 * k], r.c(pal.armor2, -0.2), true);
      r.glowLine(ctx, c.x - 14 * k, c.y - 10 * k, c.x - 14 * k, c.y + 8 * k, r.glow(pal.glow), 2);
      r.cloth(ctx, c.x - 16 * k, c.y - 14 * k, 34 * k, 3, 2, Math.PI + 0.6 + o.sway * 0.01, o.sway, r.c('#1c1c22'), null);
    },
    torso(r, ctx, o) {
      const { pal, k, hip, sh, p } = o;
      r.poly(ctx, torsoQuad(o, p.torsoW * 0.9 * k, p.torsoW * 0.6 * k), r.c(pal.armor, -0.2));
      const c = along(o, 0.58), up = along(o, 0.97), lo = along(o, 0.12);
      r.poly(ctx, [c.x - 18 * k, c.y - 5 * k, c.x + 18 * k, c.y - 5 * k, up.x + 20 * k, up.y + 2 * k, up.x - 18 * k, up.y + 3 * k], r.c(pal.armor), true);   // boxy chest
      r.poly(ctx, [c.x - 12 * k, c.y - 3 * k, c.x + 12 * k, c.y - 3 * k, c.x + 10 * k, c.y + 14 * k, c.x - 10 * k, c.y + 14 * k], r.c(pal.armor2, -0.2), true);   // core housing
      r.ell(ctx, c.x, c.y + 5 * k, 6 * k + Math.sin(o.time * 0.12) * 0.8, 6 * k + Math.sin(o.time * 0.12) * 0.8, 0, r.c(pal.glow), false);
      r.glowLine(ctx, c.x - 11 * k, c.y + 5 * k, c.x - 6 * k, c.y + 5 * k, r.glow(pal.glow), 1.4); r.glowLine(ctx, c.x + 6 * k, c.y + 5 * k, c.x + 12 * k, c.y + 5 * k, r.glow(pal.glow), 1.4);
      r.glowLine(ctx, c.x - 14 * k, up.y + 8 * k, c.x - 14 * k, c.y + 8 * k, r.glow(pal.glow), 1.2);
      r.poly(ctx, [lo.x - 18 * k, lo.y - 4 * k, lo.x + 18 * k, lo.y - 4 * k, lo.x + 14 * k, lo.y + 12 * k, lo.x - 14 * k, lo.y + 12 * k], r.c(pal.armor2), true);  // pelvis
      for (let i = -1; i <= 1; i++) r.line(ctx, lo.x + i * 7 * k, lo.y - 2 * k, lo.x + i * 7 * k, lo.y + 10 * k, r.c(pal.armor, -0.3), 1.6);
    },
    head(r, ctx, o) {
      const { pal, k, sh, pose } = o, hr = o.p.head * k, ha = (o.lean * 57.3 + pose.hd) * D2R;
      const hx = sh.x + Math.sin(ha) * (7 * k + hr * 0.8), hy = sh.y - Math.cos(ha) * (7 * k + hr * 0.8);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
      r.seg(ctx, -1 * k, hr * 1.0, -1 * k, hr * 0.1, 7 * k, 7 * k, r.c(pal.armor2, -0.3), null);   // neck piston
      r.poly(ctx, [-hr * 0.9, hr * 0.7, -hr * 1.0, -hr * 0.6, -hr * 0.4, -hr * 1.1, hr * 0.7, -hr * 1.0, hr * 1.1, -hr * 0.3, hr * 1.0, hr * 0.5, hr * 0.4, hr * 0.95], r.c(pal.armor), true);   // angular helm
      r.poly(ctx, [hr * 0.1, -hr * 0.4, hr * 1.1, -hr * 0.35, hr * 1.0, -hr * 0.05, hr * 0.0, -hr * 0.05], r.c('#08080c'), true);   // narrow visor
      r.glowLine(ctx, hr * 0.2, -hr * 0.22, hr * 0.98, -hr * 0.2, r.glow(pal.visor || pal.glow), 3);
      r.line(ctx, -hr * 0.7, -hr * 0.9, -hr * 1.0, -hr * 1.9, r.c(pal.trim), 1.8);                    // antenna
      r.ell(ctx, -hr * 1.0, -hr * 1.9, 1.8 * k, 1.8 * k, 0, r.glow(pal.glow), false);
      r.line(ctx, -hr * 0.2, hr * 0.4, hr * 0.8, hr * 0.5, r.c('#0a0a0e'), 1.6);
      ctx.restore();
    },
  },

  sera: {
    behind(r, ctx, o) {
      const { pal, k, hip, sh } = o;
      // great cape: anchored at shoulders, long and heavy
      r.cloth(ctx, sh.x - 6 * k, sh.y - 2 * k, 118 * k, 26 * k, 40 * k, Math.PI * 0.5 + 0.35 + o.sway * 0.01 + 0.3, o.sway * 0.9, r.c(pal.cloth), r.c(pal.trim));
      r.cloth(ctx, sh.x - 4 * k, sh.y, 94 * k, 18 * k, 28 * k, Math.PI * 0.5 + 0.2 + o.sway * 0.012 + 0.25, o.sway * 1.1 + 2, r.c(pal.cloth, -0.25), null);
    },
    torso(r, ctx, o) {
      const { pal, k, hip, sh, p } = o;
      r.poly(ctx, torsoQuad(o, p.torsoW * 0.9 * k, p.torsoW * 0.65 * k), r.c(pal.armor2, -0.1));
      const c = along(o, 0.5), up = along(o, 0.96), lo = along(o, 0.08);
      r.poly(ctx, [c.x - 15 * k, c.y - 4 * k, c.x + 16 * k, c.y - 5 * k, up.x + 18 * k, up.y + 2 * k, up.x - 14 * k, up.y + 4 * k], r.c(pal.armor), true);    // breastplate
      r.line(ctx, c.x, c.y - 4 * k, c.x + 1 * k, up.y + 6 * k, r.c(pal.armor2, 0.1), 2);
      // crest emblem: stylised veil-eye
      r.poly(ctx, [c.x - 7 * k, c.y + 7 * k, c.x, c.y + 1 * k, c.x + 8 * k, c.y + 7 * k, c.x, c.y + 13 * k], r.c(pal.cloth), true);
      r.ell(ctx, c.x + 0.5, c.y + 7 * k, 2.2 * k, 2.2 * k, 0, r.glow(pal.glow), false);
      // fauld + hanging tabard
      r.poly(ctx, [lo.x - 17 * k, lo.y - 4 * k, lo.x + 17 * k, lo.y - 4 * k, lo.x + 15 * k, lo.y + 8 * k, lo.x - 15 * k, lo.y + 8 * k], r.c(pal.armor, -0.1), true);
      r.poly(ctx, [lo.x - 6 * k, lo.y + 6 * k, lo.x + 8 * k, lo.y + 6 * k, lo.x + 10 * k + o.sway * 0.1, lo.y + 36 * k, lo.x - 5 * k + o.sway * 0.1, lo.y + 32 * k], r.c(pal.cloth), true);
      // scabbard on the far hip
      r.seg(ctx, lo.x - 12 * k, lo.y + 2 * k, lo.x - 34 * k, lo.y + 36 * k, 5 * k, 4 * k, r.c('#241a1c'), null);
      r.line(ctx, lo.x - 13 * k, lo.y + 3 * k, lo.x - 17 * k, lo.y + 9 * k, r.c('#c8a850'), 3);
    },
    head(r, ctx, o) {
      const { pal, k, sh, pose } = o, hr = o.p.head * k, ha = (o.lean * 57.3 + pose.hd) * D2R;
      const hx = sh.x + Math.sin(ha) * (6 * k + hr * 0.9), hy = sh.y - Math.cos(ha) * (6 * k + hr * 0.9);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
      // crest plume streaming behind
      r.cloth(ctx, -hr * 0.2, -hr * 1.1, 52 * k, 9 * k, 2, Math.PI + 0.45 + o.sway * 0.012 - ha, o.sway * 1.2, r.c(pal.cloth), r.c(pal.trim));
      r.ell(ctx, 0, hr * 0.15, hr * 0.9, hr * 0.95, 0, r.c(pal.skin));
      r.poly(ctx, [-hr * 1.05, hr * 0.5, -hr * 1.0, -hr * 0.7, -hr * 0.2, -hr * 1.2, hr * 0.8, -hr * 0.85, hr * 1.12, -hr * 0.1, hr * 1.0, hr * 0.7, hr * 0.5, hr * 1.05, -hr * 0.4, hr * 0.95], r.c(pal.armor), true);   // closed helm
      r.poly(ctx, [-hr * 0.1, -hr * 1.25, hr * 0.15, -hr * 1.55, hr * 0.5, -hr * 1.25, hr * 0.15, -hr * 0.95], r.c(pal.trim), true);        // crest mount
      r.poly(ctx, [hr * 0.2, -hr * 0.3, hr * 1.1, -hr * 0.28, hr * 1.1, -hr * 0.05, hr * 0.2, -hr * 0.04], r.c('#0a0a10'), true);   // visor slit
      r.glowLine(ctx, hr * 0.35, -hr * 0.17, hr * 1.0, -hr * 0.16, r.glow(pal.glow), 2);
      r.line(ctx, hr * 0.5, hr * 0.1, hr * 0.5, hr * 0.9, r.c(pal.armor2, -0.2), 1.4); r.line(ctx, hr * 0.8, hr * 0.1, hr * 0.8, hr * 0.8, r.c(pal.armor2, -0.2), 1.4);   // breaths
      ctx.restore();
    },
  },
};

export { PX };
