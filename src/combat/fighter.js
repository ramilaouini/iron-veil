// Fighter: per-fighter state machine. Pure logic (no DOM / canvas) so it is unit-testable in Node.
// Coordinates: x = world x (px), y = HEIGHT ABOVE FLOOR (px, up positive), facing = +1 right / -1 left.
import { CFG } from '../config.js';

export const S = {
  IDLE: 'IDLE', WALK_FORWARD: 'WALK_FORWARD', WALK_BACKWARD: 'WALK_BACKWARD', DASH: 'DASH', JUMPING: 'JUMPING',
  CROUCHING: 'CROUCHING', ATTACK_STARTUP: 'ATTACK_STARTUP', ATTACK_ACTIVE: 'ATTACK_ACTIVE', ATTACK_RECOVERY: 'ATTACK_RECOVERY',
  BLOCKING: 'BLOCKING', PARRYING: 'PARRYING', HITSTUN: 'HITSTUN', BLOCKSTUN: 'BLOCKSTUN', THROWING: 'THROWING', THROWN: 'THROWN',
  KNOCKDOWN: 'KNOCKDOWN', GETTING_UP: 'GETTING_UP', SPECIAL: 'SPECIAL', ULTIMATE: 'ULTIMATE', VICTORY: 'VICTORY', DEFEAT: 'DEFEAT', STUNNED: 'STUNNED',
};

// States from which a fighter may start new actions (movement, blocking, attacks).
const ACTIONABLE = new Set([S.IDLE, S.WALK_FORWARD, S.WALK_BACKWARD, S.CROUCHING, S.BLOCKING]);
const GROUNDED_FACING = new Set([S.IDLE, S.WALK_FORWARD, S.WALK_BACKWARD, S.CROUCHING, S.BLOCKING, S.DASH]);

// Legal state transitions (checked by Fighter.setState in dev/test mode to catch illegal flows).
const LEGAL = {
  IDLE: ['*'], WALK_FORWARD: ['*'], WALK_BACKWARD: ['*'], CROUCHING: ['*'], BLOCKING: ['*'],
  DASH: ['IDLE', 'HITSTUN', 'STUNNED', 'BLOCKSTUN', 'THROWN', 'DEFEAT', 'VICTORY', 'KNOCKDOWN'],
  JUMPING: ['IDLE', 'ATTACK_STARTUP', 'ATTACK_ACTIVE', 'ATTACK_RECOVERY', 'HITSTUN', 'STUNNED', 'THROWN', 'DEFEAT', 'VICTORY', 'KNOCKDOWN'],
  ATTACK_STARTUP: ['*'], ATTACK_ACTIVE: ['*'], ATTACK_RECOVERY: ['*'], SPECIAL: ['*'], ULTIMATE: ['*'],
  HITSTUN: ['HITSTUN', 'IDLE', 'KNOCKDOWN', 'DEFEAT', 'STUNNED', 'THROWN', 'CROUCHING'],
  BLOCKSTUN: ['BLOCKSTUN', 'IDLE', 'BLOCKING', 'CROUCHING', 'HITSTUN', 'STUNNED', 'DEFEAT', 'THROWN', 'KNOCKDOWN'],
  STUNNED: ['IDLE', 'HITSTUN', 'KNOCKDOWN', 'DEFEAT', 'THROWN', 'STUNNED'],
  THROWN: ['KNOCKDOWN', 'DEFEAT'],
  KNOCKDOWN: ['GETTING_UP', 'DEFEAT'],
  GETTING_UP: ['IDLE', 'DEFEAT', 'VICTORY'],
  THROWING: ['*'], PARRYING: ['*'],
  VICTORY: ['VICTORY'], DEFEAT: ['DEFEAT'],
};

export const EMPTY_INPUT = Object.freeze({ left: false, right: false, up: false, down: false, lp: false, hp: false, lk: false, hk: false, block: false, sp: false, ult: false, taunt: false });
const EDGE_KEYS = ['lp', 'hp', 'lk', 'hk', 'sp', 'ult', 'taunt'];

export class Fighter {
  constructor(index, def, skinIndex = 0) {
    this.index = index;
    this.def = def;
    this.skinIndex = skinIndex;
    this.reset(0, 1);
  }

  get pal() { return this.palOverride || this.def.skins[this.skinIndex].pal; }
  get maxHp() { return Math.round(this.def.stats.hp * (this.hpMul || 1)); }

  reset(x, facing) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0; this.facing = facing;
    this.hp = this.maxHp; this.guard = CFG.MAX_GUARD;
    this.meter = this.meter || 0;
    this.state = S.IDLE; this.t = 0;
    this.move = null; this.moveFrame = 0; this.hitMask = new Set(); this.contact = false; this.blockedContact = false;
    this.stun = 0; this.pushVel = 0; this.lag = 0; this.invuln = 0;
    this.crouching = false; this.launched = false; this.knockdownOnLand = false; this.heavyHit = false;
    this.parryWindow = 0; this.parryCool = 0; this.prevBlock = false;
    this.guardDelay = 0; this.stance = 0; this.taunt = 0;
    this.buffer = []; this.prev = { ...EMPTY_INPUT };
    this.lastTap = { left: -99, right: -99 }; this.frame = 0;
    this.comboHits = 0; this.comboDamage = 0; this.juggle = 0; this.comboScale = 1;
    this.jumpDirX = 0; this.dashDir = 0; this.dashDur = 0;
    this.walkDist = 0; this._px = x; this.idleT = 0; this.flash = 0; this.hurtFlash = 0; this.lastHit = null;
    this.anim = { name: 'idle', frame: 0 };
    this.stats = { dealt: 0, taken: 0, maxCombo: 0, blocks: 0, parries: 0, counters: 0, hits: 0 };
  }

  setState(s) {
    if (s === this.state) return;
    const allowed = LEGAL[this.state];
    if (allowed && !allowed.includes('*') && !allowed.includes(s)) {
      if (this.strict) throw new Error(`Illegal transition ${this.state} -> ${s}`);
      return; // refuse silently in production, keeps fighter in a consistent state
    }
    this.state = s; this.t = 0;
  }
  force(s) { this.state = s; this.t = 0; if (s !== S.JUMPING) this.jumpPre = false; } // used by the combat resolver for hits (always legal)

  get actionable() { return ACTIONABLE.has(this.state) && this.lag <= 0 && this.y === 0 && !this.taunt; }
  get airborne() { return this.y > 0; }
  get attacking() { return !!this.move; }
  get phase() {
    if (!this.move) return null;
    const m = this.move, f = this.moveFrame;
    if (f < m.startup) return 'startup';
    if (f < m.startup + m.active) return 'active';
    return 'recovery';
  }
  get moveLength() { return this.move ? this.move.startup + this.move.active + this.move.recovery : 0; }
  get inHitstun() { return this.state === S.HITSTUN || this.state === S.THROWN || this.state === S.STUNNED; }
  get vulnerable() { return this.invuln <= 0 && this.state !== S.KNOCKDOWN && this.state !== S.GETTING_UP && !(this.move && this.move.invuln && this.moveFrame >= this.move.invuln[0] && this.moveFrame < this.move.invuln[1]); }
  fwd(i) { return this.facing === 1 ? i.right : i.left; }
  back(i) { return this.facing === 1 ? i.left : i.right; }

  hurtBox() {
    const sc = this.def.prop.s, h = (this.crouching ? CFG.CROUCH_H : CFG.STAND_H) * sc, w = CFG.HURT_W * (0.85 + 0.15 * sc) * (sc > 1.1 ? 1.12 : 1);
    return { l: this.x - w / 2, r: this.x + w / 2, bottom: this.y, top: this.y + h };
  }
  attackBox(box = this.move && this.move.box) {
    if (!box) return null;
    const sc = this.def.prop.s, bx = box.x * sc, bw = box.w * sc;
    const l = this.facing === 1 ? this.x + bx : this.x - bx - bw;
    return { l, r: l + bw, top: this.y + box.y * sc, bottom: this.y + (box.y - box.h) * sc };
  }

  // ---- input handling -------------------------------------------------------------
  _readInput(inp, m) {
    this.frame++;
    for (const k of EDGE_KEYS) if (inp[k] && !this.prev[k]) this.buffer.push({ act: k, f: this.frame });
    this.buffer = this.buffer.filter(b => this.frame - b.f <= CFG.BUFFER);
    // Double-tap dash tracking
    for (const d of ['left', 'right']) if (inp[d] && !this.prev[d]) {
      if (this.frame - this.lastTap[d] <= 14 && this.actionable) this._dashDir = d;
      this.lastTap[d] = this.frame;
    }
  }

  _resolveAction(act, inp, opp) {
    const mv = this.def.moves;
    const down = inp.down, air = this.y > 0;
    switch (act) {
      case 'ult': return this.meter >= CFG.METER_MAX ? mv.ult : null;
      case 'sp': return down ? mv.sp2 : mv.sp1;
      case 'lp': if (air) return mv.ap; if (inp.block) return mv.th; return down ? mv.cl : mv.lp;
      case 'hp': if (air) return mv.ap; return down ? mv.up : mv.hp;
      case 'lk': if (air) return mv.ak; return down ? mv.ck : mv.lk;
      case 'hk': if (air) return mv.ak; return down ? mv.sw : mv.hk;
      default: return null;
    }
  }

  startMove(def, m) {
    this.moveSeq = (this.moveSeq || 0) + 1;
    this.move = def; this.moveFrame = 0; this.hitMask = new Set(); this.contact = false; this.blockedContact = false;
    this.crouching = !!def.crouch;
    this.state = def.rank === 4 ? S.ULTIMATE : def.rank === 3 ? S.SPECIAL : S.ATTACK_STARTUP; this.t = 0;
    this.buffer = [];
    if (def.rank === 4) {
      this.meter = 0;
      if (m) m.beginCinematic(this);
    }
    if (def.stanceOnUse) this.stance = 0; // set on counter
    if (m) m.emit('moveStart', { f: this, move: def });
  }

  // May the current move be cancelled into `next`?
  canCancel(next) {
    const cur = this.move;
    if (!cur || !next || cur.rank === 4) return false;
    if (!!next.air !== this.airborne) return false;
    if (next.rank === 4) return this.contact || this.blockedContact;
    if (cur.cancelFrom && this.moveFrame >= cur.cancelFrom[0] && this.moveFrame < cur.cancelFrom[1] && next.rank <= 2) return true;
    if (!(this.contact || this.blockedContact)) return false;
    if (this.moveFrame < cur.startup) return false;
    if (cur.air) return false;
    if (next.rank > cur.rank) return true;
    return cur.rank === 1 && next.rank === 1 && next.id !== cur.id;
  }

  // ---- main tick -------------------------------------------------------------------
  tick(inp, opp, m) {
    this._dashDir = null;
    this._readInput(inp, m);
    this.t++;
    if (this.parryWindow > 0) this.parryWindow--;
    if (this.parryCool > 0) this.parryCool--;
    if (this.invuln > 0) this.invuln--;
    if (this.lag > 0) this.lag--;
    if (this.stance > 0) this.stance--;
    if (this.flash > 0) this.flash--;
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.taunt > 0) this.taunt--;
    if (this.guardDelay > 0) this.guardDelay--;

    switch (this.state) {
      case S.VICTORY: case S.DEFEAT: this._physics(); break;
      case S.HITSTUN: case S.STUNNED: case S.THROWN: case S.BLOCKSTUN: this._tickStun(inp); break;
      case S.KNOCKDOWN: this._physics(); if (this.t >= CFG.KNOCKDOWN_FRAMES) { this.force(S.GETTING_UP); this._endCombo(); } break;
      case S.GETTING_UP: this._physics(); if (this.t >= CFG.GETUP_FRAMES) { this.force(S.IDLE); this.crouching = false; } break;
      case S.ATTACK_STARTUP: case S.ATTACK_ACTIVE: case S.ATTACK_RECOVERY: case S.SPECIAL: case S.ULTIMATE:
        this._tickMove(inp, opp, m); break;
      case S.DASH: this._tickDash(inp, opp, m); break;
      case S.JUMPING: this._tickJump(inp, opp, m); break;
      default: this._tickGround(inp, opp, m);
    }

    if (this.guardDelay <= 0 && this.state !== S.BLOCKSTUN && this.state !== S.BLOCKING && this.guard < CFG.MAX_GUARD) this.guard = Math.min(CFG.MAX_GUARD, this.guard + CFG.GUARD_REGEN);
    this.prev = { ...inp };
    if (this.state === S.WALK_FORWARD || this.state === S.WALK_BACKWARD) this.walkDist += Math.abs(this.x - this._px);
    this._px = this.x;
    this._updateAnim();
  }

  _tickGround(inp, opp, m) {
    this.vx = 0;
    if (GROUNDED_FACING.has(this.state) && opp) this.facing = opp.x >= this.x ? 1 : -1;
    // Attacks (buffered)
    if (this.actionable && this.buffer.length) {
      for (let i = 0; i < this.buffer.length; i++) {
        const def = this._resolveAction(this.buffer[i].act, inp, opp);
        if (def && !(def.air)) { this.buffer.splice(i, 1); this.startMove(def, m); return this._tickMove(inp, opp, m, true); }
      }
    }
    if (!this.actionable) {
      // lag (landing / post-taunt) - stand still
      if (this.taunt <= 0 && this.lag > 0) { this.crouching = false; }
      this.pushVel *= 0.8; this._applyPush(); return;
    }
    // Taunt
    if (this.buffer.some(b => b.act === 'taunt') && !inp.block) { this.taunt = 52; this.buffer = []; this.setState(S.IDLE); return; }
    // Jump
    if (inp.up && !this.prev.up || (inp.up && this.state !== S.JUMPING)) {
      this.jumpDirX = inp.right ? 1 : inp.left ? -1 : 0;
      this.crouching = false; this.state = S.JUMPING; this.t = 0; this.vy = 0; this.jumpPre = true;
      m && m.emit('jump', { f: this });
      return;
    }
    // Dash
    if (this._dashDir) {
      const dirSign = this._dashDir === 'right' ? 1 : -1;
      this.dashDir = dirSign === this.facing ? 1 : -1;
      this.dashDur = this.dashDir === 1 ? 16 : 18;
      this.state = S.DASH; this.t = 0; this.crouching = false;
      if (this.dashDir === -1) this.invuln = 6;
      m && m.emit('dash', { f: this });
      return;
    }
    // Block / parry
    if (inp.block) {
      if (!this.prev.block && this.parryCool <= 0) { this.parryWindow = CFG.PARRY_WINDOW; this.parryCool = CFG.PARRY_COOLDOWN; }
      this.crouching = !!inp.down;
      if (this.state !== S.BLOCKING) { this.state = S.BLOCKING; this.t = 0; }
      this.pushVel *= 0.8; this._applyPush();
      return;
    }
    if (this.state === S.BLOCKING) { this.state = S.IDLE; this.t = 0; }
    // Crouch
    if (inp.down) { if (this.state !== S.CROUCHING) { this.state = S.CROUCHING; this.t = 0; } this.crouching = true; this.pushVel *= 0.8; this._applyPush(); return; }
    this.crouching = false;
    // Walk
    const dir = inp.right ? 1 : inp.left ? -1 : 0;
    if (dir && !(inp.right && inp.left)) {
      const fwd = dir === this.facing;
      const sp = fwd ? this.def.stats.walk : this.def.stats.back;
      this.vx = dir * sp;
      const ns = fwd ? S.WALK_FORWARD : S.WALK_BACKWARD;
      if (this.state !== ns) { this.state = ns; this.t = 0; }
      this.idleT = 0;
    } else {
      if (this.state !== S.IDLE) { this.state = S.IDLE; this.t = 0; }
      this.idleT++;
    }
    this.vx += this.pushVel; this.pushVel *= 0.8;
    this.x += this.vx;
  }

  _applyPush() { this.x += this.pushVel; }

  _tickDash(inp, opp, m) {
    const sp = this.dashDir === 1 ? this.def.stats.dash : this.def.stats.dash * 0.85;
    const k = 1 - this.t / this.dashDur;
    this.vx = this.facing * this.dashDir * sp * (0.45 + 0.8 * k);
    this.x += this.vx;
    if (this.t >= this.dashDur) { this.vx = 0; this.state = S.IDLE; this.t = 0; }
    else if (this.t >= this.dashDur - 4 && this.buffer.length && this.dashDir === 1) {
      const def = this._resolveAction(this.buffer[0].act, inp, opp);
      if (def && !def.air) { this.buffer.shift(); this.state = S.IDLE; this.startMove(def, m); }
    }
  }

  _tickJump(inp, opp, m) {
    if (this.jumpPre) {
      if (this.t >= 3) { this.jumpPre = false; this.vy = this.def.stats.jump; this.y = 0.01; this.vx = this.jumpDirX * this.def.stats.walk * 1.25; }
      return;
    }
    // air attack from buffer
    if (this.buffer.length) {
      for (let i = 0; i < this.buffer.length; i++) {
        const def = this._resolveAction(this.buffer[i].act, inp, opp);
        if (def && def.air) { this.buffer.splice(i, 1); this.startMove(def, m); return; }
      }
    }
    this._airPhysics(m, () => { this.vx = 0; this.lag = 3; this.state = S.IDLE; this.t = 0; });
  }

  _airPhysics(m, onLand) {
    this.vy -= CFG.GRAVITY; this.y += this.vy; this.x += this.vx;
    if (this.y <= 0) { this.y = 0; this.vy = 0; m && m.emit('land', { f: this }); onLand(); }
  }

  _physics() {
    if (this.y > 0 || this.vy > 0) { this.vy -= CFG.GRAVITY; this.y += this.vy; this.x += this.vx; if (this.y <= 0) { this.y = 0; this.vy = 0; this.vx = 0; } }
    else { this.x += this.pushVel; this.pushVel *= 0.8; }
  }

  _tickMove(inp, opp, m, justStarted = false) {
    const mv = this.move;
    if (!mv) { this.state = S.IDLE; return; }
    if (!justStarted) this.moveFrame++;
    const f = this.moveFrame;
    const total = mv.startup + mv.active + mv.recovery;

    // Movement baked into move
    if (mv.move && f >= mv.move.from && f < mv.move.to) {
      let dir = this.facing;
      if (mv.move.byDir) dir = inp.right ? 1 : inp.left ? -1 : -this.facing;
      this.vx = dir * mv.move.vx;
    } else if (!this.airborne) this.vx = 0;

    // Spawns
    if (mv.projectile && f === mv.projectile.frame && m) m.spawnProjectile(this, mv.projectile);
    if (mv.shockwave && f === mv.startup && m) m.emit('shockwave', { f: this, x: this.x + this.facing * (mv.box.x + mv.box.w * 0.7), y: 0 });

    if (this.airborne || mv.air) {
      this.vy -= CFG.GRAVITY; this.y += this.vy; this.x += this.vx;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.vx = 0; this.move = null; this.lag = 5; this.state = S.IDLE; this.t = 0; m && m.emit('land', { f: this }); return; }
    } else { this.x += this.vx + this.pushVel; this.pushVel *= 0.8; }

    // Phase / state label
    if (mv.rank < 3) this.state = f < mv.startup ? S.ATTACK_STARTUP : f < mv.startup + mv.active ? S.ATTACK_ACTIVE : S.ATTACK_RECOVERY;

    // Cancel into next buffered action
    if (this.buffer.length && f > 0) {
      for (let i = 0; i < this.buffer.length; i++) {
        const def = this._resolveAction(this.buffer[i].act, inp, opp);
        if (def && this.canCancel(def)) { this.buffer.splice(i, 1); const keepAir = this.airborne; this.startMove(def, m); if (!keepAir) this.vx = 0; return; }
      }
    }

    if (f >= total) { this.move = null; this.vx = 0; this.crouching = false; this.state = this.airborne ? S.JUMPING : S.IDLE; this.t = 0; if (this.airborne) this.jumpPre = false; }
  }

  _tickStun(inp) {
    // Knockback / launched physics
    if (this.y > 0 || this.vy > 0 || this.launched) {
      this.vy -= CFG.GRAVITY; this.y += this.vy; this.x += this.vx;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.vx = 0; this.launched = false;
        if (this.hp <= 0) { this.force(S.DEFEAT); return; }
        this.force(S.KNOCKDOWN); this.knockdownOnLand = false; return;
      }
      return;
    }
    this.x += this.pushVel; this.pushVel *= 0.82;
    this.stun--;
    if (this.stun <= 0) {
      this.force(S.IDLE); this.crouching = false; this._endCombo();
    }
  }

  _endCombo() { this.comboHits = 0; this.comboDamage = 0; this.juggle = 0; this.comboScale = 1; }

  // ---- animation selection -----------------------------------------------------------
  _updateAnim() {
    let name = 'idle', frame = this.t;
    const mv = this.move;
    switch (this.state) {
      case S.WALK_FORWARD: name = 'walkF'; frame = this.t; break;
      case S.WALK_BACKWARD: name = 'walkB'; break;
      case S.DASH: name = this.dashDir === 1 ? 'dash' : 'backdash'; break;
      case S.JUMPING: name = this.jumpPre ? 'jumpStart' : this.vy > 1 ? 'jumpUp' : 'jumpDown'; break;
      case S.CROUCHING: name = this.t < 5 ? 'crouch' : 'crouchHold'; break;
      case S.BLOCKING: name = this.parryWindow > 0 ? 'parry' : this.crouching ? 'blockC' : 'blockS'; break;
      case S.BLOCKSTUN: name = this.crouching ? 'blockC' : 'blockS'; frame = this.t; break;
      case S.HITSTUN: name = this.heavyHit ? 'hitHeavy' : 'hit'; break;
      case S.STUNNED: name = this.guard <= 30 && this.stun > 30 ? 'guardBreak' : 'stunned'; break;
      case S.THROWN: name = 'thrown'; break;
      case S.KNOCKDOWN: name = 'knockdown'; break;
      case S.GETTING_UP: name = 'getup'; break;
      case S.VICTORY: name = 'victory'; break;
      case S.DEFEAT: name = 'defeat'; break;
      case S.ATTACK_STARTUP: case S.ATTACK_ACTIVE: case S.ATTACK_RECOVERY: case S.SPECIAL: case S.ULTIMATE:
        name = mv ? mv.anim : 'idle'; frame = this.moveFrame; break;
      default:
        if (this.taunt > 0) { name = 'taunt'; frame = 52 - this.taunt; }
        else if (this.lag > 0) name = 'land';
        else if (this.idleT % 420 > 360) { name = 'idle2'; frame = this.idleT % 420 - 360; }
    }
    if (this.anim.name !== name) { this.anim.prev = this.anim.name; this.anim.name = name; this.anim.blend = 0; }
    this.anim.frame = frame;
  }
}
