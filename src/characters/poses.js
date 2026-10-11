// Pose library + sampler. A pose is a set of absolute joint angles (degrees, 0 = hanging straight down,
// positive = swinging toward the direction the fighter faces, 180 = straight up).
//   ln lean (torso, + forward)   hy hip offset (px, - lowers)   hx hip x shift   hd head tilt   sp whole-body spin (deg)
//   uf/ef  near arm: upper / fore      ub/eb  far arm      tf/sf  near leg: thigh / shin      tb/sb  far leg
// Every animation clip returns a full pose. Attacks are built from chamber -> strike -> recover blends driven by the
// move's real startup/active/recovery frames, so what you SEE is what the frame data does.

export const POSE_KEYS = ['ln', 'hy', 'hx', 'hd', 'sp', 'uf', 'ef', 'ub', 'eb', 'tf', 'sf', 'tb', 'sb'];

export const STANCE = { ln: 6, hy: 0, hx: 0, hd: 0, sp: 0, uf: 38, ef: 138, ub: 22, eb: 128, tf: 20, sf: 6, tb: -22, sb: -34 };

// Per-fighter base stance (silhouette starts here).
export const STANCES = {
  kael: { ...STANCE },
  nyra: { ...STANCE, ln: 12, hy: -4, uf: 55, ef: 150, ub: 30, eb: 140, tf: 34, sf: 8, tb: -30, sb: -58 },
  bram: { ...STANCE, ln: 16, hy: -2, uf: 28, ef: 110, ub: 18, eb: 100, tf: 24, sf: 12, tb: -20, sb: -28, hd: 6 },
  sora: { ...STANCE, ln: 2, uf: 50, ef: 115, ub: 8, eb: 175, tf: 14, sf: 2, tb: -20, sb: -26 },
  vex:  { ...STANCE, ln: 4, uf: 30, ef: 130, ub: 18, eb: 124, tf: 16, sf: 4, tb: -18, sb: -22 },
  sera: { ...STANCE, ln: 3, uf: 60, ef: 128, ub: 30, eb: 160, tf: 14, sf: 2, tb: -24, sb: -26 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const easeOut = t => 1 - (1 - t) * (1 - t);
export const easeIn = t => t * t;
export const easeIO = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const snap = t => (t < 0.5 ? 0 : 1);

export function blend(a, b, t) { const o = {}; for (const k of POSE_KEYS) o[k] = lerp(a[k] ?? 0, b[k] ?? a[k] ?? 0, t); return o; }
export function over(base, ov) { return { ...base, ...ov }; }

// ------------------------------------------------------------------ generic attack shapes
// { c: chamber (end of startup), s: strike (during active) } are overlays on the fighter's stance.
const SHAPES = {
  lp: { c: { ln: 2, uf: 8, ef: 150, hx: -4 }, s: { ln: 12, uf: 88, ef: 90, hx: 10, tf: 26, tb: -30 } },
  hp: { c: { ln: -10, hx: -10, uf: -35, ef: 60, ub: 40, eb: 140 }, s: { ln: 26, hx: 20, hy: -5, uf: 84, ef: 80, tf: 36, sf: 14, tb: -44, sb: -64, ub: 10, eb: 100 } },
  lk: { c: { ln: -4, tf: 55, sf: -15 }, s: { ln: -8, tf: 86, sf: 84, tb: -6, sb: -10 } },
  hk: { c: { ln: -14, hx: -8, tf: 78, sf: -35, tb: -4, sb: -8 }, s: { ln: -28, hx: 4, tf: 104, sf: 98, tb: -2, sb: -4, uf: -34, ef: 20, ub: 60, eb: 120 } },
  cl: { c: { ln: 14, hy: -34, uf: 10, ef: 140, tf: 88, sf: -40, tb: 74, sb: -62 }, s: { ln: 22, hy: -34, uf: 86, ef: 88, tf: 88, sf: -40, tb: 74, sb: -62 } },
  ck: { c: { ln: 12, hy: -40, tf: 88, sf: -40, tb: 74, sb: -62, hx: -4 }, s: { ln: 8, hy: -40, tf: 88, sf: -40, tb: 78, sb: 84 } },
  up: { c: { ln: 6, hy: -30, uf: -10, ef: 40, tf: 88, sf: -40, tb: 74, sb: -62 }, s: { ln: -10, hy: 6, uf: 172, ef: 176, tf: 40, sf: 20, tb: -30, sb: -34, ub: 120, eb: 150 } },
  sw: { c: { ln: 20, hy: -38, tf: 88, sf: -40, tb: 74, sb: -62, uf: -20, ef: 20 }, s: { ln: 30, hy: -44, tf: 88, sf: -40, tb: 100, sb: 96, uf: 100, ef: 60 } },
  ap: { c: { ln: 14, uf: 20, ef: 140, tf: 70, sf: -50, tb: 40, sb: -70 }, s: { ln: 22, uf: 84, ef: 86, tf: 70, sf: -50, tb: 40, sb: -70 } },
  ak: { c: { ln: 10, tf: 60, sf: -50, tb: 70, sb: -70 }, s: { ln: -20, tf: 98, sf: 96, tb: 60, sb: -80, uf: 30, ef: 130 } },
  th: { c: { ln: 12, uf: 70, ef: 80, ub: 70, eb: 80, tf: 28 }, s: { ln: 30, hy: -8, uf: 100, ef: 100, ub: 100, eb: 100, tf: 34, sf: 8, tb: -34, sb: -44 } },
  spA: { c: { ln: -6, uf: 20, ef: 100 }, s: { ln: 20, uf: 90, ef: 90 } },
  spB: { c: { ln: -4, uf: 30, ef: 110 }, s: { ln: 14, uf: 90, ef: 90 } },
  ult: { c: { ln: -12, uf: 150, ef: 170, ub: 150, eb: 170 }, s: { ln: 24, uf: 90, ef: 90 } },
};

// Character-specific attack art. These replace the generic shape for the named animation so each fighter swings differently.
const CHAR = {
  kael: {
    hp:  { c: { ln: -12, hx: -12, uf: -50, ef: 40, tf: 30, tb: -40 }, s: { ln: 28, hx: 22, uf: 88, ef: 88, hy: -6, tf: 40, sf: 12, tb: -46, sb: -68 } },
    spA: { c: { ln: -14, hx: -10, uf: -20, ef: 60, ub: 20, eb: 100, tf: 30, tb: -44, sb: -60 }, s: { ln: 34, hx: 26, hy: -10, uf: 92, ef: 92, ub: 60, eb: 120, tf: 52, sf: 18, tb: -58, sb: -82 } },
    spB: { c: { ln: -4, uf: 40, ef: 100, ub: 40, eb: 100, hy: -6 }, s: { ln: 10, uf: 90, ef: 90, ub: 90, eb: 90, hy: -4 } },
    ult: { c: { ln: -16, uf: 160, ef: 175, ub: 160, eb: 175, hy: -8 }, s: { ln: 34, hx: 20, uf: 92, ef: 92, ub: 80, eb: 100, tf: 50, tb: -60, sb: -80 } },
  },
  nyra: {
    hp:  { c: { ln: -10, sp: 0, uf: -60, ef: 20, hx: -6, tf: 40, tb: -50 }, s: { ln: 18, uf: 100, ef: 70, ub: 60, eb: 80, tf: 36, tb: -50, sb: -80, sp: 8 } },
    hk:  { c: { ln: -22, hx: -8, tf: 96, sf: -30, tb: -10, sb: -14, uf: 40, ef: 100 }, s: { ln: -46, hx: 4, tf: 128, sf: 122, tb: -4, sb: -6, uf: -40, ef: 10, ub: 80, eb: 110 } },
    lk:  { c: { ln: -2, tf: 62, sf: -20 }, s: { ln: -10, tf: 94, sf: 90, tb: -8, sb: -10 } },
    spA: { c: { ln: 10, hy: -8, uf: 30, ef: 120, tf: 60, sf: -30, tb: -40, sb: -70 }, s: { ln: 0, hy: 0, uf: 90, ef: 90, ub: -90, eb: -90, tf: 98, sf: 96, tb: -60, sb: -70 } },
    spB: { c: { ln: 20, hy: -14, uf: 20, ef: 90, tf: 50, tb: -50 }, s: { ln: 36, hy: -10, uf: -20, ef: 20, ub: 40, eb: 80, tf: 60, sf: 20, tb: -70, sb: -100 } },
    ult: { c: { ln: -10, uf: 170, ef: 175, ub: 170, eb: 175 }, s: { ln: 10, uf: 90, ef: 90, ub: -90, eb: -90, tf: 100, sf: 98, tb: -50 } },
  },
  bram: {
    lp:  { c: { ln: 8, uf: 10, ef: 100, hx: -6 }, s: { ln: 22, uf: 86, ef: 86, hx: 12 } },
    hp:  { c: { ln: -26, hx: -14, uf: 175, ef: 178, ub: 170, eb: 175, hy: 4 }, s: { ln: 52, hx: 22, hy: -16, uf: 60, ef: 30, ub: 56, eb: 28, tf: 40, sf: 16, tb: -40, sb: -60 } },
    hk:  { c: { ln: -6, tf: 70, sf: -10, hx: -6 }, s: { ln: -22, tf: 92, sf: 90, tb: -4, sb: -6, uf: -30, ef: 40 } },
    spA: { c: { ln: 28, hx: -10, hy: -10, uf: 20, ef: 120, ub: 20, eb: 120, tf: 30, tb: -40, sb: -70 }, s: { ln: 58, hx: 24, hy: -14, uf: 96, ef: 100, ub: 96, eb: 100, tf: 48, sf: 8, tb: -52, sb: -78 } },
    spB: { c: { ln: -30, hx: -10, uf: 178, ef: 178, ub: 178, eb: 178, hy: 6 }, s: { ln: 58, hx: 18, hy: -22, uf: 10, ef: -6, ub: 10, eb: -6, tf: 40, sf: 24, tb: -40, sb: -56 } },
    th:  { c: { ln: 20, uf: 80, ef: 90, ub: 80, eb: 90, hy: -6 }, s: { ln: 40, hy: -12, uf: 110, ef: 120, ub: 110, eb: 120, tf: 30, tb: -34 } },
    ult: { c: { ln: -34, uf: 178, ef: 178, ub: 178, eb: 178, hy: 8 }, s: { ln: 62, hx: 20, hy: -26, uf: 6, ef: -10, ub: 6, eb: -10, tf: 44, sf: 22, tb: -46, sb: -60 } },
  },
  sora: {
    lp:  { c: { ln: 0, uf: 30, ef: 110, hx: -2 }, s: { ln: 6, uf: 92, ef: 86, hx: 8 } },
    hp:  { c: { ln: -6, uf: 20, ef: 120, ub: 40, eb: 160, hx: -8 }, s: { ln: 14, uf: 86, ef: 80, ub: 60, eb: 100, hx: 18, tf: 26, tb: -34 } },
    spA: { c: { ln: -4, uf: 70, ef: 100, ub: 70, eb: 100, hy: -2 }, s: { ln: 8, uf: 90, ef: 90, ub: 92, eb: 92, hx: 6 } },
    spB: { c: { ln: 0, uf: 90, ef: 150, ub: 90, eb: 150, hy: -10 }, s: { ln: -4, uf: 100, ef: 160, ub: 80, eb: 150, hy: -12 } },
    ult: { c: { ln: -8, uf: 170, ef: 176, ub: 170, eb: 176, hy: 4 }, s: { ln: 10, uf: 92, ef: 90, ub: 98, eb: 96 } },
  },
  vex: {
    lp:  { c: { ln: 4, uf: 30, ef: 100 }, s: { ln: 8, uf: 90, ef: 90, hx: 8 } },
    hp:  { c: { ln: -4, uf: 70, ef: 20, hx: -8 }, s: { ln: 10, uf: 90, ef: 90, hx: 14, ub: 70, eb: 80 } },
    lk:  { c: { tf: 40, sf: 0 }, s: { tf: 90, sf: 90, ln: -4 } },
    spA: { c: { ln: -4, uf: 70, ef: 110, ub: 70, eb: 110, hx: -4, hy: -4 }, s: { ln: 10, uf: 90, ef: 90, ub: 90, eb: 90, hx: 6, hy: -6 } },
    spB: { c: { ln: 22, hy: -12, uf: -20, ef: 20, ub: -10, eb: 30, tf: 40, sf: 0, tb: -50, sb: -60 }, s: { ln: 52, hy: -16, uf: -50, ef: -20, ub: -40, eb: 0, tf: 70, sf: 40, tb: -70, sb: -96 } },
    ult: { c: { ln: -6, uf: 90, ef: 90, ub: -90, eb: -90, hy: -6 }, s: { ln: 14, uf: 90, ef: 90, ub: 90, eb: 90, hy: -4 } },
  },
  sera: {
    lp:  { c: { ln: 2, uf: 20, ef: 120 }, s: { ln: 8, uf: 96, ef: 96, hx: 10 } },
    hp:  { c: { ln: -14, hx: -10, uf: 150, ef: 120, ub: 40, eb: 130 }, s: { ln: 26, hx: 22, uf: 20, ef: 80, ub: 30, eb: 100, tf: 38, tb: -46, sb: -64 } },
    hk:  { c: { ln: -16, tf: 80, sf: -30, uf: 150, ef: 120 }, s: { ln: -24, tf: 100, sf: 96, uf: 40, ef: 90 } },
    spA: { c: { ln: -22, hx: -12, uf: 170, ef: 150, ub: 40, eb: 120, tf: 30, tb: -44 }, s: { ln: 34, hx: 22, hy: -10, uf: 12, ef: 82, ub: 30, eb: 100, tf: 52, sf: 20, tb: -60, sb: -84 } },
    spB: { c: { ln: -4, uf: 110, ef: 130, ub: 110, eb: 130, hy: -10 }, s: { ln: -6, uf: 100, ef: 140, ub: 100, eb: 140, hy: -12 } },
    ult: { c: { ln: -18, uf: 176, ef: 176, ub: 120, eb: 150 }, s: { ln: 30, hx: 20, uf: 16, ef: 84, ub: 40, eb: 100, tf: 50, tb: -58, sb: -80 } },
  },
};

// Ultimates are multi-pose sequences cycling during their active frames (per-hit variety).
const ULT_CYCLE = {
  kael: [{ ln: 30, uf: 90, ef: 90, ub: 30, eb: 130, tf: 44, tb: -52, sb: -70, hx: 18 }, { ln: -20, uf: 20, ef: 120, ub: 90, eb: 90, tf: 80, sf: 76, tb: -6, sb: -8, hx: 4 }, { ln: 22, uf: 160, ef: 40, ub: 70, eb: 90, hx: 14, tf: 40, tb: -50 }],
  nyra: [{ ln: 10, sp: 360, uf: 90, ef: 90, ub: -90, eb: -90, tf: 100, sf: 96, tb: -50, sb: -60 }, { ln: -30, sp: 0, tf: 120, sf: 114, tb: -4, sb: -4, uf: -30, ef: 20 }, { ln: 24, uf: 100, ef: 100, ub: 60, eb: 60, tf: 50, tb: -70, sb: -100, hx: 16 }],
  bram: [{ ln: 56, hx: 20, hy: -22, uf: 20, ef: 6, ub: 20, eb: 6, tf: 44, tb: -48, sb: -60 }, { ln: -20, uf: 120, ef: 140, ub: 120, eb: 140, hy: 4 }, { ln: 60, hx: 22, hy: -28, uf: 0, ef: -10, ub: 0, eb: -10, tf: 46, tb: -50, sb: -60 }],
  sora: [{ ln: 8, uf: 92, ef: 90, ub: 98, eb: 96, hx: 6, hy: 4 }, { ln: -6, uf: 120, ef: 150, ub: 60, eb: 100, hy: 8 }, { ln: 10, uf: 80, ef: 70, ub: 130, eb: 150, hy: 6, tf: 28, tb: -34 }],
  vex: [{ ln: 12, uf: 90, ef: 90, ub: 90, eb: 90, hx: 8, hy: -6 }, { ln: -4, uf: 60, ef: 120, ub: -60, eb: 120, hy: -4 }, { ln: 14, uf: 120, ef: 60, ub: 80, eb: 90, tf: 70, sf: 66, tb: -4, hy: -2 }],
  sera: [{ ln: 28, hx: 20, uf: 14, ef: 82, ub: 30, eb: 100, tf: 48, tb: -56, sb: -80 }, { ln: -14, uf: 160, ef: 120, ub: 40, eb: 120, tf: 10, tb: -30 }, { ln: 30, hx: 22, uf: 100, ef: 100, ub: 100, eb: 100, tf: 50, tb: -60, sb: -80 }],
};

// ------------------------------------------------------------------ looping / held clips
function walkPose(f, stance, dir) {
  const L = (f.def.prop.thigh + f.def.prop.shin) * f.def.prop.s, A = 0.42;
  const ph = (f.walkDist / (2 * L * Math.sin(A))) * Math.PI * dir; // distance-locked: feet do not skate
  const a = Math.sin(ph) * A * 57.3, ca = Math.cos(ph);
  const lift = k => Math.max(0, k) * 52;
  const p = { ...stance };
  p.tf = stance.tf * 0.3 + a * (dir > 0 ? 1 : 1); p.tb = stance.tb * 0.3 - a;
  p.sf = p.tf - 8 - lift(ca) * (dir > 0 ? 1 : 0.8); p.sb = p.tb - 8 - lift(-ca) * (dir > 0 ? 1 : 0.8);
  const swing = Math.sin(ph) * 16;
  p.uf = stance.uf - swing * 0.35; p.ub = stance.ub + swing * 0.35;
  p.hy = -Math.abs(Math.cos(ph)) * 2.5 + 1;
  p.ln = stance.ln + (dir > 0 ? 3 : -2);
  return p;
}

const HELD = {
  crouch: (st) => ({ ...st, ln: 14, hy: -2, uf: 40, ef: 120, ub: 30, eb: 120, tf: 88, sf: -40, tb: 74, sb: -62 }),
  blockS: (st) => ({ ...st, ln: 10, uf: 70, ef: 168, ub: 56, eb: 170, tf: 24, sf: 8, tb: -28, sb: -40, hd: 6 }),
  blockC: (st) => ({ ...st, ln: 22, hy: -2, uf: 70, ef: 168, ub: 56, eb: 170, tf: 88, sf: -40, tb: 74, sb: -62, hd: 8 }),
  parry: (st) => ({ ...st, ln: -8, uf: 120, ef: 100, ub: 100, eb: 160, tf: 30, tb: -30, hx: -6 }),
  hit: (st) => ({ ...st, ln: -16, hd: -14, uf: -10, ef: 60, ub: 10, eb: 80, tf: 10, tb: -34, sb: -44, hx: -8 }),
  hitHigh: (st) => ({ ...st, ln: -22, hd: -26, uf: -25, ef: 40, ub: -10, eb: 60, tf: 8, tb: -30, sb: -40, hx: -12 }),
  hitMid: (st) => ({ ...st, ln: -16, hd: -14, uf: -10, ef: 60, ub: 10, eb: 80, tf: 10, tb: -34, sb: -44, hx: -8 }),
  hitLow: (st) => ({ ...st, ln: 10, hy: -18, hd: 10, uf: 20, ef: 90, ub: 20, eb: 90, tf: 48, sf: -20, tb: 34, sb: -40, hx: -6 }),
  hitLaunch: (st) => ({ ...st, ln: -45, hy: 22, hd: -32, uf: 110, ef: 120, ub: 90, eb: 110, tf: 32, sf: -20, tb: -20, sb: -30, hx: -16 }),
  hitSpin: (st, t) => ({ ...st, sp: ((t || 0) * 24) % 360, ln: -18, uf: 40, ef: 70, ub: -40, eb: 70, tf: 20, tb: -20 }),
  hitHeavy: (st) => ({ ...st, ln: -30, hd: -26, uf: -40, ef: 20, ub: -20, eb: 30, tf: 4, tb: -44, sb: -60, hx: -14 }),
  stunned: (st) => ({ ...st, ln: 18, hd: 16, uf: 8, ef: 30, ub: 14, eb: 40, tf: 28, sf: 14, tb: -10, sb: -14, hy: -8 }),
  dizzy: (st, t) => ({ ...st, ln: Math.sin((t || 0) * 0.12) * 14, hd: Math.sin((t || 0) * 0.12 + 1) * 20, uf: 15 + Math.sin((t || 0) * 0.1) * 20, ef: 50, ub: 15 - Math.sin((t || 0) * 0.1) * 20, eb: 50, tf: 20, tb: -20, hy: -4 }),
  guardBreak: (st) => ({ ...st, ln: -24, hd: -22, uf: -50, ef: -20, ub: -30, eb: 0, tf: 14, tb: -40, sb: -50, hx: -12 }),
  thrown: (st) => ({ ...st, ln: -50, uf: -60, ef: -30, ub: -40, eb: -20, tf: 30, sf: -20, tb: 10, sb: -40, hx: -6 }),
  knockdown: (st) => ({ ...st, ln: -86, hy: -30, hx: -34, uf: -90, ef: -90, ub: -70, eb: -70, tf: 70, sf: 60, tb: 80, sb: 70 }),
  knockdownRoll: (st, t) => ({ ...st, ln: -86, sp: ((t || 0) * 18) % 360, hy: -30, hx: -34, uf: -90, ef: -90, ub: -70, eb: -70, tf: 70, sf: 60, tb: 80, sb: 70 }),
  wakeRoll: (st, t) => ({ ...st, ln: -40 + Math.sin((t || 0) * 0.2) * 20, hy: -14, uf: 30, ef: 90, ub: 30, eb: 90, tf: 58, sf: 20, tb: 38, sb: -20 }),
  jumpUp: (st) => ({ ...st, ln: 4, uf: 100, ef: 150, ub: 80, eb: 150, tf: 70, sf: -30, tb: 30, sb: -70 }),
  jumpDown: (st) => ({ ...st, ln: 2, uf: 70, ef: 140, ub: 50, eb: 140, tf: 36, sf: 10, tb: -14, sb: -34 }),
  jumpStart: (st) => ({ ...st, ln: 16, hy: -2, uf: -10, ef: 60, ub: -20, eb: 60, tf: 70, sf: 4, tb: 50, sb: -56 }),
  land: (st) => ({ ...st, ln: 16, uf: 30, ef: 100, ub: 20, eb: 100, tf: 58, sf: 8, tb: 38, sb: -46 }),
  dash: (st) => ({ ...st, ln: 24, hx: 6, uf: -30, ef: 20, ub: -10, eb: 30, tf: 62, sf: 0, tb: -52, sb: -90 }),
  backdash: (st) => ({ ...st, ln: -14, uf: 20, ef: 100, ub: 30, eb: 130, tf: 30, sf: 10, tb: -40, sb: -60 }),
  victory: (st, t, id) => victoryPose(st, t, id),
  defeat: (st) => HELD.knockdown(st),
  taunt: (st, t) => ({ ...st, ln: -6 + Math.sin((t || 0) * 0.3) * 2, uf: 170, ef: 176, ub: 20, eb: 130, hd: -6 }),
};

function victoryPose(st, t, id) {
  const k = easeOut(clamp((t || 0) / 18)), w = Math.sin((t || 0) * 0.08) * 3;
  const base = { ...st, ln: -4 + w * 0.2 };
  const raise = {
    kael: { uf: 176, ef: 176, ub: 40, eb: 140, hy: 0 },
    nyra: { uf: 120, ef: 150, ub: 60, eb: 100, ln: 8, tf: 40, tb: -20, sb: -40 },
    bram: { uf: 150, ef: 175, ub: 150, eb: 175, ln: -10 },
    sora: { uf: 100, ef: 150, ub: 100, eb: 150, hy: -10, tf: 70, sf: 0, tb: 40, sb: -50 },
    vex: { uf: 90, ef: 90, ub: 40, eb: 140, hd: 8 },
    sera: { uf: 168, ef: 170, ub: 40, eb: 130, ln: -6 },
  }[id] || {};
  return blend(base, { ...base, ...raise }, k);
}

// ------------------------------------------------------------------ sampler
// Returns the full pose to draw for fighter f this frame. `st` = stance.
export function samplePose(f, time) {
  const st = STANCES[f.def.id] || STANCE;
  const id = f.def.id, an = f.anim, name = an.name, t = an.frame;
  const breathe = Math.sin(time * 0.045 + (f.index || 0));
  let target;

  if (f.move && (f.state === 'ATTACK_STARTUP' || f.state === 'ATTACK_ACTIVE' || f.state === 'ATTACK_RECOVERY' || f.state === 'SPECIAL' || f.state === 'ULTIMATE')) {
    target = attackPose(f, st);
  } else switch (name) {
    case 'walkF': target = walkPose(f, st, 1); break;
    case 'walkB': target = walkPose(f, st, -1); break;
    case 'sprint': target = walkPose(f, st, 1.55); break;
    case 'prowl': target = walkPose(f, { ...st, ln: st.ln + 10, hy: -6 }, 0.8); break;
    case 'crouch': target = blend(st, HELD.crouch(st), easeOut(clamp(t / 5))); break;
    case 'crouchHold': target = HELD.crouch(st); target.hy += breathe * 0.8; break;
    case 'blockS': case 'blockC': target = HELD[name](st); if (f.state === 'BLOCKSTUN') { target.hx -= 5 * Math.max(0, 1 - t / 8); target.ln -= 6 * Math.max(0, 1 - t / 8); } break;
    case 'jumpUp': case 'jumpDown': case 'jumpStart': case 'land': case 'dash': case 'backdash': case 'parry':
    case 'hit': case 'hitHigh': case 'hitMid': case 'hitLow': case 'hitLaunch': case 'hitSpin': case 'hitHeavy':
    case 'stunned': case 'dizzy': case 'guardBreak': case 'thrown': case 'knockdown': case 'knockdownRoll': case 'wakeRoll':
      target = HELD[name] ? HELD[name](st, t) : HELD.hit(st); break;
    case 'getup': { const k = easeIO(clamp(t / 24)); target = blend(HELD.knockdown(st), HELD.crouch(st), k); break; }
    case 'victory': target = HELD.victory(st, t, id); break;
    case 'defeat': target = HELD.defeat(st); break;
    case 'taunt': target = HELD.taunt(st, t); break;
    case 'idle2': target = idle2(st, id, t); break;
    case 'idle3': target = idle3(st, id, t); break;
    default: // idle
      target = { ...st }; target.ln += breathe * 1.4; target.hy += breathe * 1.2 - 0.6; target.uf += breathe * 3; target.ub -= breathe * 3; target.hd = breathe * 1.2;
  }
  // Smooth transition between unrelated clips (no pose snapping).
  if (!f._pose) f._pose = target;
  const rate = f.state === 'HITSTUN' || f.state === 'KNOCKDOWN' || f.state === 'THROWN' || name === 'guardBreak' ? 0.72 : f.move ? 0.65 : 0.42;
  f._pose = blend(f._pose, target, rate);
  if (f.move) f._pose = blend(f._pose, target, 0.9);
  return f._pose;
}

function idle2(st, id, t) {
  const k = Math.sin(clamp((t || 0) / 60) * Math.PI);
  const o = { kael: { uf: 90, ef: 40, ln: 2 }, nyra: { tf: 10, tb: -10, sb: -30, hy: 4, uf: 20, ef: 90 }, bram: { uf: 140, ef: 150, ub: 140, eb: 150, ln: 0 }, sora: { uf: 80, ef: 160, ub: 80, eb: 160, hy: -6 }, vex: { hd: 14, uf: 100, ef: 90 }, sera: { uf: 160, ef: 140, ln: 0 } }[id] || {};
  return blend(st, { ...st, ...o }, k);
}

function idle3(st, id, t) {
  const k = Math.sin(clamp((t || 0) / 75) * Math.PI);
  const o = {
    kael: { uf: 110, ef: 120, ub: 20, eb: 110, ln: 8, hd: -8 },
    nyra: { uf: 70, ef: 160, ub: 10, eb: 150, ln: 18, hy: -8, tf: 42, tb: -36 },
    bram: { uf: 60, ef: 90, ub: 60, eb: 90, hx: 6, ln: 22, hy: -6 },
    sora: { uf: 130, ef: 160, ub: 130, eb: 160, hy: 8, hd: 12 },
    vex: { uf: -20, ef: 40, ub: 20, eb: 120, sp: Math.sin((t || 0) * 0.2) * 10, hd: -12 },
    sera: { uf: 140, ef: 160, ub: 40, eb: 140, ln: -4, hd: 8 },
  }[id] || {};
  return blend(st, { ...st, ...o }, k);
}

function attackPose(f, st) {
  const mv = f.move, an = mv.anim, fr = f.moveFrame;
  const shape = (CHAR[f.def.id] && CHAR[f.def.id][an]) || SHAPES[an] || SHAPES.lp;
  const C = over(st, shape.c), S = over(st, shape.s);
  const inv = f.def.id === 'vex' ? snap : (x => x);
  if (mv.ultimate || an === 'ult') return ultPose(f, st, C, S);

  if (fr < mv.startup) {
    // anticipation: ease into the chamber, last frames snap toward strike
    const k = fr / Math.max(1, mv.startup);
    if (k < 0.65) return blend(st, C, easeOut(k / 0.65));
    return blend(C, S, easeIn((k - 0.65) / 0.35) * 0.65);
  }
  if (fr < mv.startup + mv.active) {
    // active: strike frame with slight overshoot impact
    const k = (fr - mv.startup) / Math.max(1, mv.active);
    const overshootFactor = k < 0.25 ? 1.06 : 1.0;
    const strikeTarget = blend(C, S, overshootFactor);
    const p = blend(strikeTarget, S, Math.min(1, k * 3.5 + 0.3));
    return p;
  }
  // recovery: elastic follow-through and ease back into stance
  const recFr = fr - mv.startup - mv.active;
  const k = recFr / Math.max(1, mv.recovery);
  const bounce = Math.sin(k * Math.PI) * 0.08;
  const e = inv(easeIO(k));
  return blend(S, st, f.def.id === 'vex' ? easeIn(k) : Math.min(1, e + bounce));
}

function ultPose(f, st, C, S) {
  const mv = f.move, fr = f.moveFrame, cyc = ULT_CYCLE[f.def.id] || [S];
  if (fr < mv.startup) { const k = fr / mv.startup; return blend(st, C, easeOut(Math.min(1, k * 1.4))); }
  if (fr < mv.startup + mv.active) {
    const rel = fr - mv.startup, per = mv.interval || 8, idx = Math.floor(rel / per) % cyc.length, k = (rel % per) / per;
    const cur = over(st, cyc[idx]), prev = over(st, cyc[(idx + cyc.length - 1) % cyc.length]);
    const last = rel >= mv.active - per;
    const p = blend(prev, last ? over(st, S) : cur, easeOut(Math.min(1, k * 2.5)));
    if (cyc[idx].sp) p.sp = cyc[idx].sp * k;
    return p;
  }
  const k = (fr - mv.startup - mv.active) / mv.recovery;
  return blend(over(st, S), st, easeIO(k));
}

export const CLIP_NAMES = [
  'idle', 'idle2', 'idle3', 'walkF', 'walkB', 'sprint', 'prowl', 'dash', 'backdash',
  'jumpStart', 'jumpUp', 'jumpDown', 'land', 'crouch', 'crouchHold', 'blockS', 'blockC', 'parry',
  'hit', 'hitHigh', 'hitMid', 'hitLow', 'hitLaunch', 'hitSpin', 'hitHeavy',
  'knockdown', 'knockdownRoll', 'wakeRoll', 'getup', 'stunned', 'dizzy', 'guardBreak', 'thrown',
  'victory', 'defeat', 'taunt'
];
export const MOVE_ANIMS = ['lp', 'hp', 'lk', 'hk', 'cl', 'ck', 'up', 'sw', 'ap', 'ak', 'th', 'spA', 'spB', 'ult'];
