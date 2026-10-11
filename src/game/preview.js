// Drives a fighter through any animation clip or move outside of a real match
// (character select, gallery, cosmetics, the developer Animation Lab, versus screen).
import { Fighter } from '../combat/fighter.js';
import { CLIP_NAMES, MOVE_ANIMS } from '../characters/poses.js';
import { MOVE_ORDER } from '../characters/roster.js';

export const LOOP_CLIPS = ['idle', 'walkF', 'walkB', 'crouchHold', 'blockS', 'blockC', 'taunt', 'victory'];
export const ALL_CLIPS = [...CLIP_NAMES, ...MOVE_ORDER.map(m => 'move:' + m)];

export class Actor {
  constructor(def, skin = 0, facing = 1) {
    this.f = new Fighter(0, def, skin); this.f.reset(0, facing); this.f.facing = facing;
    this.clip = 'idle'; this.t = 0; this.paused = false; this.speed = 1; this.auto = true; this.autoI = 0; this.hold = 0; this.acc = 0;
    this.script = ['idle', 'move:lp', 'move:lk', 'idle', 'move:hp', 'walkF', 'move:sp1', 'idle', 'taunt', 'move:hk', 'blockS', 'idle', 'victory'];
  }
  setFighter(def, skin) { const facing = this.f.facing; this.f = new Fighter(0, def, skin); this.f.reset(0, facing); this.f.facing = facing; this.f._pose = null; this.play('idle'); }
  setSkin(skin) { this.f.skinIndex = skin; }
  play(clip) { this.clip = clip; this.t = 0; this.f._pose = null; this.hold = 0; }
  moveDef(clip) { return clip.startsWith('move:') ? this.f.def.moves[clip.slice(5)] : null; }
  clipLength(clip) {
    const m = this.moveDef(clip); if (m) return m.startup + m.active + m.recovery;
    if (clip === 'walkF' || clip === 'walkB') return 90;
    if (clip === 'hit' || clip === 'hitHeavy') return 40;
    if (clip === 'knockdown' || clip === 'getup') return 60;
    if (clip === 'taunt') return 52;
    if (clip === 'victory') return 120;
    return 90;
  }
  // Advance by one frame (call at 60 Hz). step() can be used when paused for frame-stepping.
  update() { if (!this.paused) this.step(); }
  step() {
    const f = this.f, clip = this.clip, m = this.moveDef(clip);
    this.t++;
    const len = this.clipLength(clip);
    if (this.t > len + (m ? 24 : 0)) {
      if (this.auto) { this.autoI = (this.autoI + 1) % this.script.length; this.play(this.script[this.autoI]); return this.step(); }
      this.t = 0;
    }
    f.move = null; f.vx = 0; f.vy = 0; f.y = 0; f.crouching = false; f.jumpPre = false; f.lag = 0; f.taunt = 0; f.hurtFlash = 0;
    f.state = 'IDLE'; f.launched = false;
    const t = this.t;
    if (m) {
      const fr = Math.min(t - 1, len - 1);
      if (t <= len) { f.move = m; f.moveFrame = fr; f.state = m.rank === 4 ? 'ULTIMATE' : m.rank === 3 ? 'SPECIAL' : 'ATTACK_ACTIVE'; f.crouching = !!m.crouch; f.anim = { name: m.anim, frame: fr }; if (m.air) { const k = fr / len; f.y = 60 * Math.sin(Math.min(1, k * 1.2) * Math.PI); } }
      else f.anim = { name: 'idle', frame: 0 };
      return;
    }
    switch (clip) {
      case 'walkF': f.state = 'WALK_FORWARD'; f.vx = f.def.stats.walk; f.walkDist += f.def.stats.walk; break;
      case 'walkB': f.state = 'WALK_BACKWARD'; f.vx = -f.def.stats.back; f.walkDist += f.def.stats.back; break;
      case 'crouch': case 'crouchHold': f.state = 'CROUCHING'; f.crouching = true; break;
      case 'blockS': f.state = 'BLOCKING'; break;
      case 'blockC': f.state = 'BLOCKING'; f.crouching = true; break;
      case 'parry': f.state = 'BLOCKING'; f.parryWindow = 3; break;
      case 'hit': case 'hitHeavy': f.state = 'HITSTUN'; f.heavyHit = clip === 'hitHeavy'; break;
      case 'stunned': case 'guardBreak': f.state = 'STUNNED'; f.guard = clip === 'guardBreak' ? 10 : 100; f.stun = 60; break;
      case 'thrown': f.state = 'THROWN'; break;
      case 'knockdown': f.state = 'KNOCKDOWN'; break;
      case 'getup': f.state = 'GETTING_UP'; break;
      case 'victory': f.state = 'VICTORY'; break;
      case 'defeat': f.state = 'DEFEAT'; break;
      case 'taunt': f.taunt = Math.max(1, 52 - t); break;
      case 'jumpStart': f.state = 'JUMPING'; f.jumpPre = true; break;
      case 'jumpUp': f.state = 'JUMPING'; f.vy = 8; f.y = 40 + 40 * Math.sin((t / len) * 3.14); break;
      case 'jumpDown': f.state = 'JUMPING'; f.vy = -8; f.y = 60 - 50 * (t / len); break;
      case 'land': f.lag = 3; break;
      case 'dash': f.state = 'DASH'; f.dashDir = 1; break;
      case 'backdash': f.state = 'DASH'; f.dashDir = -1; break;
      default: f.idleT = clip === 'idle2' ? 361 + t : t;
    }
    f.t = t;
    f.anim = { name: clip === 'idle2' ? 'idle2' : clip, frame: t };
  }
}
export { CLIP_NAMES, MOVE_ANIMS };
