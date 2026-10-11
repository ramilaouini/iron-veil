// CPU opponent. Utility/FSM hybrid. Rules it follows:
//  - sees the opponent only through a reaction-delayed snapshot (never future inputs)
//  - produces ordinary input frames; the simulation enforces recovery, stun and cancel rules
//  - difficulty changes reaction time, block/parry skill, punish rate, combo use and mistakes (never damage)
import { EMPTY_INPUT } from '../combat/fighter.js';

export const PROFILES = {
  easy:   { react: 22, think: 14, block: 0.18, parry: 0.0,  punish: 0.20, combo: 0.20, special: 0.10, aggr: 0.40, antiair: 0.15, ult: 0.30, errors: 0.22 },
  normal: { react: 13, think: 8,  block: 0.50, parry: 0.04, punish: 0.55, combo: 0.50, special: 0.28, aggr: 0.55, antiair: 0.50, ult: 0.60, errors: 0.08 },
  hard:   { react: 7,  think: 5,  block: 0.74, parry: 0.22, punish: 0.88, combo: 0.80, special: 0.42, aggr: 0.62, antiair: 0.80, ult: 0.90, errors: 0.03 },
  expert: { react: 3,  think: 3,  block: 0.90, parry: 0.45, punish: 1.00, combo: 1.00, special: 0.50, aggr: 0.68, antiair: 0.95, ult: 1.00, errors: 0.00, adapt: true },
};

const COMBOS = {
  kael: [['lp', 'lk', 'hp', 'sp1'], ['cl', 'lk', 'hk'], ['lk', 'hp', 'sp2'], ['lp', 'hp', 'sp1']],
  nyra: [['lp', 'lk', 'hk'], ['cl', 'lk', 'hp', 'sp1'], ['lk', 'lp', 'hp', 'sp1']],
  bram: [['lp', 'hp', 'sp1'], ['hp', 'sp2'], ['lk', 'hk']],
  sora: [['lp', 'lk', 'hp', 'sp1'], ['lp', 'hp', 'sp1']],
  vex:  [['lp', 'lk', 'hp', 'sp2'], ['lp', 'hp', 'sp1']],
  sera: [['lp', 'lk', 'hk', 'sp1'], ['lk', 'lp', 'hp', 'sp1']],
};
const IDEAL = { kael: [90, 150], nyra: [70, 120], bram: [80, 140], sora: [200, 320], vex: [160, 250], sera: [110, 170] };
const ZONER = { sora: 'sp1', vex: 'sp1', kael: null };
// action id -> button + whether crouch is held
const ACT = {
  lp: ['lp', false], hp: ['hp', false], lk: ['lk', false], hk: ['hk', false],
  cl: ['lp', true], ck: ['lk', true], up: ['hp', true], sw: ['hk', true],
  sp1: ['sp', false], sp2: ['sp', true], ult: ['ult', false], th: ['lp', false, true],
};

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export class FightingAI {
  constructor(index, difficulty = 'normal', seed = 1234) {
    this.index = index; this.setDifficulty(difficulty); this.rand = mulberry32(seed + index * 77);
    this.reset();
  }
  setDifficulty(d) { this.diff = d; this.p = PROFILES[d] || PROFILES.normal; }
  reset() {
    this.hist = []; this.intent = 'wait'; this.intentT = 0; this.combo = null; this.comboI = 0; this.thinkT = 0;
    this.guard = null; this.reacted = ''; this.release = 0; this.pending = null; this.pressCool = 0;
    this.seen = { jump: 0, atk: 0, block: 0, total: 1 }; this.lastOppAnim = '';
    this.dashStep = 0;
  }

  _snap(opp, me) {
    return { x: opp.x, y: opp.y, state: opp.state, phase: opp.phase, mv: opp.move, mf: opp.moveFrame, seq: opp.moveSeq, air: opp.y > 0, crouch: opp.crouching, meter: opp.meter, hp: opp.hp, launched: opp.launched, anim: opp.anim.name };
  }

  update(me, opp, match) {
    const out = { ...EMPTY_INPUT };
    if (match.phase !== 'fight' || me.hp <= 0) { this.reset(); return out; }
    const p = this.p;
    this.hist.push(this._snap(opp, me)); if (this.hist.length > 60) this.hist.shift();
    const v = this.hist[Math.max(0, this.hist.length - 1 - p.react)];
    const toward = Math.sign(v.x - me.x) || me.facing;
    const dist = Math.abs(v.x - me.x);
    const go = (dir) => { if (dir > 0) out.right = true; else out.left = true; };
    const press = (id) => { const [b, down, blk] = ACT[id]; if (this.pressCool > 0) return false; out[b] = true; if (down) out.down = true; if (blk) out.block = true; this.pressCool = 2; return true; };
    if (this.pressCool > 0) this.pressCool--;

    // adaptation (expert): learn the opponent's habits from what is visible
    if (p.adapt && v.anim !== this.lastOppAnim) {
      this.lastOppAnim = v.anim; this.seen.total++;
      if (v.anim.startsWith('jump')) this.seen.jump++;
      if (v.anim.startsWith('block')) this.seen.block++;
      if (v.mv) this.seen.atk++;
    }

    // ---- in the middle of our own move: continue the combo
    if (me.move) {
      if (this.combo && this.comboI < this.combo.length) {
        const next = this.combo[this.comboI];
        const resolved = this._resolve(next, me);
        if ((me.contact || me.blockedContact) && me.moveFrame >= me.move.startup && resolved && me.canCancel(resolved)) {
          if (press(next)) this.comboI++;
        } else if (me.phase === 'recovery' && !me.contact && !me.blockedContact) { this.combo = null; }
        if (me.blockedContact && !me.contact && p.punish < 0.9 && this.rand() < 0.1) this.combo = null;
      }
      return out;
    }
    if (this.combo) { this.combo = null; }
    if (!me.actionable) { return out; }

    // ---- defense: react to a visible attack
    const oppAtk = v.mv && (v.phase === 'startup' || v.phase === 'active') && !v.mv.noHit;
    const reach = v.mv ? v.mv.box.x + v.mv.box.w : 0;
    const threat = oppAtk && dist < reach + 60 + (v.mv.move ? v.mv.move.vx * 8 : 0);
    if (threat) {
      if (this.reacted !== v.seq) {
        this.reacted = v.seq;
        const r = this.rand();
        if (r < p.block) {
          const est = v.mv.startup - v.mf - p.react;
          const tryParry = this.rand() < p.parry && est >= 1 && v.phase === 'startup' && !v.mv.throw;
          this.guard = { crouch: v.mv.level === 'low' || (v.crouch && v.mv.level !== 'overhead'), until: me.frame + 18 + (v.mv.startup + v.mv.active - v.mf), parry: tryParry, parryAt: me.frame + Math.max(0, est - 3) };
        } else if (this.rand() < 0.5 && !me.airborne) { this.guard = null; this.intent = 'retreat'; this.intentT = 14; }
      }
    }
    if (this.guard) {
      if (me.frame > this.guard.until) this.guard = null;
      else {
        out.block = true; out.down = this.guard.crouch;
        if (this.guard.parry) { if (me.frame < this.guard.parryAt) out.block = false; }
        return out;
      }
    }
    // after our block ends we are stunned/idle; punish window
    // ---- decision loop
    this.thinkT--;
    const [imin, imax] = IDEAL[me.def.id] || [100, 160];
    const myReachLp = me.def.moves.lp.box.x + me.def.moves.lp.box.w;
    const myReachHp = me.def.moves.hp.box.x + me.def.moves.hp.box.w;
    const myReachHk = me.def.moves.hk.box.x + me.def.moves.hk.box.w;
    if (this.thinkT <= 0) {
      this.thinkT = p.think + Math.floor(this.rand() * 3);
      const r = this.rand();
      if (this.rand() < p.errors) { this.intent = 'wait'; this.intentT = 14 + Math.floor(this.rand() * 14); }
      // Ultimate after a confirmed hit, or at close range
      else if (me.meter >= 100 && this.rand() < p.ult * 0.25 && dist < (me.def.moves.ult.box.x + me.def.moves.ult.box.w) - 20 && !v.air) { if (press('ult')) return out; }
      // Anti-air
      else if (v.air && dist < 190 && !v.launched && this.rand() < (p.adapt && this.seen.jump / this.seen.total > 0.2 ? 1 : p.antiair)) { if (press('up')) return out; }
      // Punish a visible recovery
      else if (v.phase === 'recovery' && dist < myReachHp + 20 && this.rand() < p.punish) {
        if (dist <= myReachLp + 8) { this._startCombo(me, true); if (this.combo) { press(this.combo[0]); this.comboI = 1; return out; } }
        else if (press('hp')) return out;
      }
      // Throw against a turtle (block hold)
      else if (v.state === 'BLOCKING' && dist < 95 && this.rand() < (p.adapt ? 0.5 : 0.25)) { if (press('th')) return out; }
      else if (dist <= myReachLp + 12) {
        // close range pressure
        if (this.rand() < p.aggr) {
          if (this.rand() < p.combo) { this._startCombo(me, false); press(this.combo[0]); this.comboI = 1; return out; }
          const pick = ['lp', 'lk', 'cl', 'ck', 'hp'][Math.floor(this.rand() * 5)]; if (press(pick)) return out;
        } else if (this.rand() < 0.4) { this.intent = 'retreat'; this.intentT = 12; }
        else { this.intent = 'wait'; this.intentT = 8; }
      } else if (dist <= myReachHk) {
        if (this.rand() < p.aggr) { if (this.rand() < p.special && me.def.moves.sp1.box.w > 0 && !ZONER[me.def.id]) { if (press('sp1')) return out; } const pick = this.rand() < 0.5 ? 'hp' : 'hk'; if (press(pick)) return out; }
        else { this.intent = 'approach'; this.intentT = 10; }
      } else if (ZONER[me.def.id] && dist > 250 && this.rand() < Math.max(0.25, p.special + 0.2)) { if (press('sp1')) return out; }
      else if (dist > imax) { this.intent = 'approach'; this.intentT = 14 + Math.floor(this.rand() * 12); if (this.diff !== 'easy' && dist > 340 && this.rand() < 0.3 * (p.react < 10 ? 1 : 0.4)) { this.dashStep = 1; } }
      else if (dist < imin) { this.intent = this.rand() < p.aggr ? 'wait' : 'retreat'; this.intentT = 10; }
      else { if (this.rand() < p.special && me.meter < 100 && me.def.moves.sp2.noHit !== true && this.rand() < 0.3 && me.def.id !== 'sora') { if (press('sp2')) return out; } this.intent = r < 0.5 ? 'approach' : 'wait'; this.intentT = 10; }
      // occasional jump-in
      if (this.diff !== 'easy' && this.intent === 'approach' && dist > 180 && dist < 330 && this.rand() < 0.08 + (p.adapt ? 0.05 : 0)) { out.up = true; go(toward); return out; }
    }
    // dash step (double tap forward)
    if (this.dashStep > 0) {
      this.dashStep++;
      if (this.dashStep === 2) go(toward); else if (this.dashStep === 3) { /* release */ } else if (this.dashStep === 4) { go(toward); this.dashStep = 0; }
      return out;
    }
    // execute intent
    this.intentT--;
    if (this.intent === 'approach') { if (dist > imin) go(toward); }
    else if (this.intent === 'retreat') go(-toward);
    if (me.x < 150 && this.intent === 'retreat') this.intent = 'approach';
    return out;
  }

  _resolve(id, me) { const m = me.def.moves; return { lp: m.lp, hp: m.hp, lk: m.lk, hk: m.hk, cl: m.cl, ck: m.ck, up: m.up, sw: m.sw, sp1: m.sp1, sp2: m.sp2, ult: m.ult, th: m.th }[id]; }

  _startCombo(me, punish) {
    const list = COMBOS[me.def.id] || [['lp', 'lk', 'hp']];
    let c = list[Math.floor(this.rand() * list.length)].slice();
    if (this.diff === 'easy') c = c.slice(0, 2);
    else if (this.diff === 'normal' && c.length > 3) c = c.slice(0, 3);
    if (me.meter >= 100 && this.p.ult >= 0.9 && this.rand() < 0.6) c.push('ult');
    this.combo = c; this.comboI = 0;
  }
}
