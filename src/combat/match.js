// Match: owns two fighters, projectiles, hit resolution, combo tracking and round/match flow.
// Pure simulation (no DOM). step(inputs) advances exactly one 60 Hz frame.
import { CFG } from '../config.js';
import { Fighter, S, EMPTY_INPUT } from './fighter.js';

const overlap = (a, b) => a.l < b.r && a.r > b.l && a.bottom < b.top && a.top > b.bottom;

export class Match {
  constructor(opts) {
    this.opts = {
      roundTime: CFG.DEFAULTS.roundTime, roundsToWin: CFG.DEFAULTS.roundsToWin, training: false, strict: false, record: false,
      ...opts,
    };
    const [a, b] = [this.opts.p1, this.opts.p2];
    this.f = [new Fighter(0, a.def, a.skin || 0), new Fighter(1, b.def, b.skin || 0)];
    this.f.forEach(f => { f.strict = this.opts.strict; f.meter = 0; });
    this.training = this.opts.training;
    this.train = { infHealth: true, infMeter: false };
    this.listeners = []; this.log = [];
    this.wins = [0, 0]; this.need = this.opts.roundsToWin; this.round = 0;
    this.paused = false; this.finished = false; this.matchWinner = -1; this.roundWinner = -2;
    this.combo = [{ hits: 0, damage: 0, timer: 0, tag: '' }, { hits: 0, damage: 0, timer: 0, tag: '' }];
    this.stats = { frames: 0 };
    this.frame = 0;
    this.startRound();
  }

  on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(l => l !== fn); }; }
  emit(type, data = {}) {
    data.type = type;
    if (this.opts.record) this.log.push(data);
    for (const l of this.listeners) l(data);
  }

  get timeLeft() { return Math.ceil(this.timer / CFG.FPS); }

  resetPositions() {
    const c = CFG.STAGE_W / 2;
    this.f[0].reset(c - 150, 1); this.f[1].reset(c + 150, -1);
  }

  startRound() {
    this.round++;
    const m0 = this.f[0].meter, m1 = this.f[1].meter;
    this.resetPositions();
    this.f[0].meter = m0; this.f[1].meter = m1;
    this.projectiles.length = 0;
    this.hitstop = 0; this.cinematic = null; this.slow = 0;
    this.timer = this.training ? Infinity : this.opts.roundTime * CFG.FPS;
    this.phase = this.training ? 'fight' : 'intro'; this.t = 0;
    this.roundResolved = false; this.roundWinner = -2;
    this.combo.forEach(c => { c.hits = 0; c.damage = 0; c.timer = 0; });
    this.emit('roundStart', { round: this.round });
    if (this.training) this.emit('fight');
  }
  get projectiles() { return this._projectiles || (this._projectiles = []); }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  beginCinematic(owner) {
    this.cinematic = { owner, len: owner.move.startup, t: 0 };
    this.emit('cinematic', { f: owner });
  }

  spawnProjectile(owner, p) {
    if (this.projectiles.length >= 12) return;
    const pr = {
      owner, x: owner.x + owner.facing * p.ox, y: p.y + owner.y * 0, vx: owner.facing * p.vx, life: p.life, age: 0,
      w: p.w, h: p.h, dmg: p.dmg, hitstun: p.hitstun, blockstun: p.blockstun, hitstop: p.hitstop, pushback: p.pushback || 8,
      knockdown: !!p.knockdown, color: p.color, kind: p.kind, alive: true, dir: owner.facing,
    };
    this.projectiles.push(pr);
    this.emit('projectile', { p: pr, f: owner });
  }

  // ---------------------------------------------------------------- stepping
  step(inputs) {
    if (this.paused || this.finished) return;
    this.frame++;
    if (this.slow > 0) this.slow--;
    const in0 = inputs[0] || EMPTY_INPUT, in1 = inputs[1] || EMPTY_INPUT;
    if (this.combo) for (const c of this.combo) if (c.timer > 0) { c.timer--; if (c.timer === 0) { c.hits = 0; c.damage = 0; c.tag = ''; } }

    // Global hit-stop freezes simulation but keeps buffering inputs so presses are not eaten.
    if (this.hitstop > 0) {
      this.hitstop--;
      if (this.phase === 'fight') { this.f[0]._readInput(in0, this); this.f[0].prev = { ...in0 }; this.f[1]._readInput(in1, this); this.f[1].prev = { ...in1 }; }
      return;
    }

    this.t++;
    switch (this.phase) {
      case 'intro':
        this._tickFighters(EMPTY_INPUT, EMPTY_INPUT);
        if (this.t >= CFG.INTRO_FRAMES) { this.phase = 'fight'; this.t = 0; this.emit('fight'); }
        break;
      case 'fight': this._fightStep(in0, in1); break;
      case 'ko':
        this._tickFighters(EMPTY_INPUT, EMPTY_INPUT); this._updateProjectiles(false); this._postSim();
        if (this.t >= CFG.KO_FRAMES) this._toRoundEnd();
        break;
      case 'roundEnd':
        this._tickFighters(EMPTY_INPUT, EMPTY_INPUT);
        if (this.t >= CFG.ROUND_END_FRAMES) {
          if (this.matchWinner >= 0) { this.phase = 'matchEnd'; this.t = 0; this.finished = true; this.emit('matchEnd', { winner: this.matchWinner }); }
          else this.startRound();
        }
        break;
      default: break;
    }
  }

  _tickFighters(i0, i1) {
    this.f[0].tick(i0, this.f[1], this);
    this.f[1].tick(i1, this.f[0], this);
  }

  _fightStep(in0, in1) {
    // Cinematic ultimate startup: only the owner advances, the world is frozen.
    if (this.cinematic) {
      const o = this.cinematic.owner;
      if (o.move && o.move.rank === 4 && o.moveFrame < o.move.startup) {
        this.cinematic.t++;
        o.tick(o.index === 0 ? in0 : in1, this.f[1 - o.index], this);
        return;
      }
      this.cinematic = null;
    }
    if (!this.training) this.timer--;
    this._tickFighters(in0, in1);
    this._updateProjectiles(true);
    this._resolveHits();
    this._postSim();
    this._trainingUpkeep();
    this._checkRoundEnd();
  }

  _trainingUpkeep() {
    if (!this.training) return;
    for (const f of this.f) {
      if (this.train.infHealth && f.comboHits === 0 && f.hp > 0 && f.hp < f.maxHp && !f.inHitstun && f.state !== S.KNOCKDOWN) f.hp = f.maxHp;
      if (this.train.infMeter) f.meter = CFG.METER_MAX;
      if (f.hp <= 0 && f.state === S.DEFEAT && f.t > 70) { const m = [this.f[0].meter, this.f[1].meter]; this.resetPositions(); this.f[0].meter = m[0]; this.f[1].meter = m[1]; this.projectiles.length = 0; }
    }
  }

  // ---------------------------------------------------------------- projectiles
  _updateProjectiles(allowHit) {
    const ps = this.projectiles;
    for (const p of ps) {
      if (!p.alive) continue;
      p.x += p.vx; p.age++; p.life--;
      if (p.life <= 0 || p.x < -100 || p.x > CFG.STAGE_W + 100) p.alive = false;
    }
    if (allowHit) {
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        if (!a.alive || !b.alive || a.owner === b.owner) continue;
        if (Math.abs(a.x - b.x) < (a.w + b.w) / 4 && Math.abs(a.y - b.y) < 70) { a.alive = false; b.alive = false; this.emit('projectileClash', { x: (a.x + b.x) / 2, y: a.y }); }
      }
      for (const p of ps) {
        if (!p.alive) continue;
        const opp = this.f[1 - p.owner.index];
        if (!opp.vulnerable || opp.state === S.DEFEAT || opp.state === S.VICTORY) continue;
        const box = { l: p.x - p.w / 2, r: p.x + p.w / 2, top: p.y + p.h / 2, bottom: p.y - p.h / 2 };
        if (overlap(box, opp.hurtBox())) {
          p.alive = false;
          const pm = { damage: p.dmg, level: 'mid', hitstun: p.hitstun, blockstun: p.blockstun, hitstop: p.hitstop, pushback: p.pushback, knockdown: p.knockdown, guardDmg: 18, chip: true, rank: 3, fx: 'energy', projectile: true };
          this._hitCore(p.owner, opp, pm, 0, 1, { x: Math.min(box.r, opp.x + 10), y: p.y, defMove: opp.move, defPhase: opp.phase, proj: p });
        }
      }
    }
    this._projectiles = ps.filter(p => p.alive);
  }

  // ---------------------------------------------------------------- hit detection
  _resolveHits() {
    const attempts = [];
    for (const att of this.f) {
      const mv = att.move, def = this.f[1 - att.index];
      if (!mv || mv.noHit || att.phase !== 'active') continue;
      if (def.state === S.DEFEAT || def.state === S.VICTORY) continue;
      const rel = att.moveFrame - mv.startup;
      const n = mv.interval ? Math.ceil(mv.active / mv.interval) : 1;
      const idx = mv.interval ? Math.min(n - 1, Math.floor(rel / mv.interval)) : 0;
      if (att.hitMask.has(idx)) continue;
      if (!def.vulnerable) continue;
      const box = att.attackBox();
      const hb = def.hurtBox();
      if (!overlap(box, hb)) continue;
      // Juggle limit: a launched opponent past the limit cannot be hit again.
      if (def.launched && def.juggle >= CFG.JUGGLE_MAX && !mv.throw) continue;
      if (mv.throw && (def.y > 0 || def.inHitstun || def.state === S.THROWN)) continue;
      const x = (Math.max(box.l, hb.l) + Math.min(box.r, hb.r)) / 2;
      const y = (Math.min(box.top, hb.top) + Math.max(box.bottom, hb.bottom)) / 2;
      attempts.push({ att, def, mv, idx, n, x, y, defMove: def.move, defPhase: def.phase });
    }
    // Simultaneous hits are both applied (trade); throws tech when both sides throw.
    if (attempts.length === 2 && attempts[0].mv.throw && attempts[1].mv.throw) { this._throwTech(); return; }
    for (const a of attempts) {
      if (a.mv.throw) this._throw(a);
      else this._hitCore(a.att, a.def, a.mv, a.idx, a.n, a);
    }
  }

  _throwTech() {
    for (const f of this.f) { f.move = null; f.force(S.IDLE); f.lag = 12; f.pushVel = -f.facing * 7; }
    this.emit('throwTech', { x: (this.f[0].x + this.f[1].x) / 2, y: 90 });
  }

  _throw({ att, def, mv, idx, x, y }) {
    att.hitMask.add(idx);
    att.contact = true;
    const dmg = Math.round(mv.damage * (att.stance > 0 ? 1.15 : 1));
    def.hp = Math.max(0, def.hp - dmg);
    def.move = null; def.crouching = false;
    def.force(S.THROWN); def.launched = true; def.y = 0.01; def.vy = 7; def.vx = att.facing * 4.5; def.heavyHit = true; def.juggle = CFG.JUGGLE_MAX; def.comboHits = 1; def.comboDamage = dmg;
    this._bookkeep(att, def, dmg, false, false, true);
    this.hitstop = mv.hitstop; this.emit('throw', { att, def, x, y, dmg });
    this.emit('hit', { att, def, x, y, dmg, heavy: true, fx: 'heavy', move: mv, combo: 1, counter: false, punish: false, throw: true });
    if (def.hp <= 0) this.hitstop = 16;
  }

  _bookkeep(att, def, dmg, counter, punish) {
    att.stats.dealt += dmg; att.stats.hits++; def.stats.taken += dmg;
    att.meter = Math.min(CFG.METER_MAX, att.meter + dmg * 0.1);
    def.meter = Math.min(CFG.METER_MAX, def.meter + dmg * 0.07);
    if (counter) att.stats.counters++;
    att.stats.maxCombo = Math.max(att.stats.maxCombo, def.comboHits);
    const c = this.combo[att.index];
    c.hits = def.comboHits; c.damage = def.comboDamage; c.timer = 100; c.tag = counter ? 'COUNTER' : punish ? 'PUNISH' : c.tag;
    this.combo[def.index].hits = 0; this.combo[def.index].timer = 0;
  }

  /* Core resolution order: counter stance -> parry -> block -> armor -> clean hit */
  _hitCore(att, def, mv, idx, n, info) {
    att.hitMask.add(idx);
    const x = info.x, y = info.y;
    const dmove = def.move;
    const fr = def.moveFrame;
    const guarding = (def.state === S.BLOCKING || def.state === S.BLOCKSTUN) && def.y === 0 &&
      (mv.level === 'low' ? def.crouching : mv.level === 'overhead' ? !def.crouching : true);

    // 1) Counter stance (Stillwater Counter / Mirror Guard)
    if (dmove && dmove.counter && fr >= dmove.counter.from && fr < dmove.counter.to && !mv.throw) {
      const c = dmove.counter;
      if (info.proj) info.proj.alive = false;
      att.hp = Math.max(0, att.hp - c.damage);
      att.move = null; att.force(S.HITSTUN); att.stun = c.hitstun; att.launched = true; att.y = 0.01; att.vy = 8.5; att.vx = def.facing * 3.5; att.heavyHit = true; att.juggle = 1; att.comboHits = 1; att.comboDamage = c.damage;
      def.moveFrame = dmove.startup + dmove.active; def.invuln = 8;
      if (dmove.stanceOnUse) def.stance = 300;
      def.stats.counters++;
      this._bookkeep(def, att, c.damage, true, false);
      this.hitstop = 12; this.emit('counter', { att: def, def: att, x, y, dmg: c.damage });
      if (att.hp <= 0) this.hitstop = 16;
      return;
    }

    // 2) Parry: only in the first frames after a fresh block press
    if (def.state === S.BLOCKING && def.parryWindow > 0 && def.y === 0) {
      def.parryWindow = 0; def.meter = Math.min(CFG.METER_MAX, def.meter + 8); def.stats.parries++;
      if (info.proj) info.proj.alive = false;
      else { att.move = null; att.force(S.STUNNED); att.stun = CFG.PARRY_PUNISH_STUN; att.vx = 0; att.pushVel = -att.facing * 3; att.heavyHit = false; }
      this.combo[def.index].tag = 'PARRY';
      this.hitstop = 8; this.emit('parry', { att, def, x, y });
      return;
    }

    // 3) Block
    if (guarding) {
      const gd = (mv.guardDmg ?? 12) * (def.stance > 0 ? 0.5 : 1);
      def.guard -= gd; def.guardDelay = CFG.GUARD_REGEN_DELAY;
      let chip = 0;
      if (mv.chip) { chip = Math.max(1, Math.round(mv.damage * CFG.CHIP_SPECIAL)); chip = Math.min(chip, Math.max(0, def.hp - 1)); def.hp -= chip; }
      def.stun = mv.blockstun; def.force(S.BLOCKSTUN); def.pushVel = att.facing * Math.max(4, mv.pushback * 0.9);
      att.contact = false; att.blockedContact = true;
      def.stats.blocks++;
      att.meter = Math.min(CFG.METER_MAX, att.meter + 2); def.meter = Math.min(CFG.METER_MAX, def.meter + 3);
      this._cornerPush(att, def, mv.pushback);
      this.hitstop = Math.max(4, mv.hitstop - 2);
      if (def.guard <= 0) {
        def.force(S.STUNNED); def.stun = 72; def.guard = CFG.MAX_GUARD * 0.4; def.move = null;
        this.emit('guardBreak', { att, def, x, y });
        this.hitstop = 12;
      } else this.emit('block', { att, def, x, y, chip, heavy: mv.rank >= 2, level: mv.level });
      return;
    }

    // 4) Super armor (Titan Rush): absorbs one hit at reduced damage, keeps going
    if (dmove && dmove.armor && fr >= dmove.armor[0] && fr < dmove.armor[1] && !mv.throw) {
      const dmg = Math.round(mv.damage * 0.45);
      def.hp = Math.max(1, def.hp - dmg); def.hurtFlash = 8;
      att.contact = true; att.pushVel = -att.facing * 3;
      this._bookkeep(att, def, dmg, false, false);
      this.hitstop = 6; this.emit('hit', { att, def, x, y, dmg, heavy: true, armor: true, fx: 'heavy', move: mv, combo: 1 });
      return;
    }

    // 5) Clean hit
    const isLast = idx === n - 1;
    let base = isLast && mv.finalDamage ? mv.finalDamage : mv.damage;
    let scale = Math.max(CFG.COMBO_SCALE_MIN, 1 - CFG.COMBO_SCALE_STEP * def.comboHits);
    if (mv.ultimate) scale = Math.max(scale, 0.6);
    const counter = info.defPhase === 'startup' || info.defPhase === 'active';
    const punish = info.defPhase === 'recovery' && !counter;
    let dmg = base * scale * (counter ? CFG.COUNTER_DMG : 1) * (punish ? CFG.PUNISH_DMG : 1) * (att.stance > 0 ? 1.15 : 1);
    dmg = Math.max(1, Math.round(dmg));
    def.hp = Math.max(0, def.hp - dmg);
    const lethal = def.hp <= 0;
    def.comboHits++; def.comboDamage += dmg; def.comboScale = scale;
    def.move = null; def.vx = 0; def.hurtFlash = 8;
    att.contact = !mv.projectile ? true : att.contact;
    att.blockedContact = false;
    const wasLaunched = def.launched;
    const heavy = mv.hitstop >= 8 || lethal || (isLast && (mv.finalKnockdown || mv.finalDamage > 100));
    def.heavyHit = heavy;
    let stun = Math.max(CFG.HITSTUN_MIN, Math.round(mv.hitstun - (def.comboHits - 1) * CFG.COMBO_HITSTUN_DECAY * (mv.interval ? 0 : 1))) + (counter ? 4 : 0);
    const kd = mv.knockdown || (isLast && mv.finalKnockdown) || lethal;
    if (wasLaunched || def.y > 0) {
      // Juggle: small pop, limited by CFG.JUGGLE_MAX
      def.juggle++; def.force(S.HITSTUN); def.launched = true; def.vy = Math.max(def.vy, 7); def.vx = att.facing * 1.8; if (def.y === 0) def.y = 0.01;
    } else if (mv.launch) {
      def.force(S.HITSTUN); def.launched = true; def.y = 0.01; def.vy = mv.launch; def.vx = att.facing * 2.2; def.juggle = 1; def.heavyHit = true;
    } else if (kd) {
      def.force(S.HITSTUN); def.launched = true; def.y = 0.01; def.vy = lethal ? 9 : 6.5; def.vx = att.facing * (lethal ? 5 : 3.4); def.juggle = CFG.JUGGLE_MAX;
    } else {
      def.force(S.HITSTUN); def.stun = stun; def.pushVel = att.facing * mv.pushback;
      if (def.crouching === false) def.crouching = false;
    }
    def.stun = stun;
    this._cornerPush(att, def, mv.pushback);
    this._bookkeep(att, def, dmg, counter, punish);
    this.hitstop = Math.max(this.hitstop, (mv.hitstop || 5) + (counter ? 3 : 0) + (lethal ? 10 : 0));
    if (def.hp <= 0 && !this.training) this.slow = 70;
    this.emit('hit', { att, def, x, y, dmg, heavy, fx: mv.fx, move: mv, combo: def.comboHits, counter, punish, projectile: !!mv.projectile, level: mv.level, last: isLast && !!mv.interval });
  }

  _cornerPush(att, def, pushback) {
    const lo = CFG.WALL_PAD + 4, hi = CFG.STAGE_W - CFG.WALL_PAD - 4;
    if (def.x <= lo + 40 || def.x >= hi - 40) att.pushVel = -att.facing * Math.max(3, pushback * 0.8);
  }

  // ---------------------------------------------------------------- post-sim
  _postSim() {
    const [a, b] = this.f;
    const lo = CFG.WALL_PAD, hi = CFG.STAGE_W - CFG.WALL_PAD;
    for (const f of this.f) f.x = Math.max(lo, Math.min(hi, f.x));
    if (a.y === 0 && b.y === 0 && a.state !== S.KNOCKDOWN && b.state !== S.KNOCKDOWN) {
      const dx = b.x - a.x; const ov = CFG.PUSH_W - Math.abs(dx);
      if (ov > 0) {
        const dir = dx === 0 ? (a.facing || 1) : Math.sign(dx);
        a.x -= dir * ov / 2; b.x += dir * ov / 2;
        // If one is against a wall, push the other fully
        if (a.x < lo) { b.x += lo - a.x; a.x = lo; } else if (a.x > hi) { b.x += hi - a.x; a.x = hi; }
        if (b.x < lo) { a.x += lo - b.x; b.x = lo; } else if (b.x > hi) { a.x += hi - b.x; b.x = hi; }
      }
    }
    // keep fighters on screen together (max separation)
    const maxSep = CFG.STAGE_W - 2 * CFG.WALL_PAD;
    if (Math.abs(a.x - b.x) > maxSep) { const m = (a.x + b.x) / 2; a.x = m - Math.sign(b.x - a.x) * maxSep / 2; b.x = m + Math.sign(b.x - a.x) * maxSep / 2; }
    for (const f of this.f) {
      if (f.comboHits === 0 && this.combo[1 - f.index].timer > 0 && this.combo[1 - f.index].timer > 40) this.combo[1 - f.index].timer = 40;
    }
  }

  // ---------------------------------------------------------------- round flow
  _checkRoundEnd() {
    if (this.roundResolved || this.training) return;
    const [a, b] = this.f;
    let winner = -2, reason = '';
    if (a.hp <= 0 && b.hp <= 0) { winner = -1; reason = 'doubleKO'; }
    else if (a.hp <= 0) { winner = 1; reason = 'ko'; }
    else if (b.hp <= 0) { winner = 0; reason = 'ko'; }
    else if (this.timer <= 0) {
      const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
      winner = Math.abs(ra - rb) < 1e-9 ? -1 : ra > rb ? 0 : 1; reason = 'timeout';
    }
    if (winner === -2) return;
    this.roundResolved = true; this.roundWinner = winner;
    this.phase = 'ko'; this.t = 0; this.cinematic = null;
    if (winner === -1) { this.wins[0]++; this.wins[1]++; } else this.wins[winner]++;
    const [wa, wb] = this.wins;
    if (wa >= this.need || wb >= this.need) { if (wa === wb) this.need = wa + 1; else this.matchWinner = wa > wb ? 0 : 1; }
    this.emit('ko', { winner, reason, timeout: reason === 'timeout' });
  }

  _toRoundEnd() {
    this.phase = 'roundEnd'; this.t = 0;
    for (const f of this.f) {
      const isWinner = f.hp > 0 && (this.roundWinner === -1 || f.index === this.roundWinner);
      if (isWinner || (f.hp > 0 && this.roundWinner >= 0)) {
        // Winner celebrates; a timed-out loser drops to the defeat pose (still standing HP > 0).
        f.move = null; f.y = 0; f.vy = 0; f.vx = 0; f.launched = false; f.crouching = false; f.force(isWinner ? S.VICTORY : S.DEFEAT);
      }
    }
    this.projectiles.length = 0;
    this.emit('roundEnd', { winner: this.roundWinner, wins: [...this.wins], matchWinner: this.matchWinner });
  }
}
