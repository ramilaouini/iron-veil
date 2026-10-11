// Game: owns the loop, camera, input->match wiring, effects/audio/HUD hooks and all rendering of the canvas.
// DOM menus live in ui/screens.js and talk to this class through a small API (startMatch, pause, preview...).
import { CFG } from '../config.js';
import { Match } from '../combat/match.js';
import { EMPTY_INPUT, S } from '../combat/fighter.js';
import { ROSTER, BY_ID } from '../characters/roster.js';
import { FightingAI } from '../ai/ai.js';
import { InputManager } from '../input/input.js';
import { AudioManager } from '../audio/audio.js';
import { SaveManager } from '../progression/save.js';
import { Effects } from '../effects/effects.js';
import { STAGES, floorScreenY, drawGrade } from '../stages/stages.js';
import { FighterRenderer } from '../render/fighter_renderer.js';
import { samplePose } from '../characters/poses.js';
import { HUD } from '../ui/hud.js';
import { Actor } from './preview.js';
import { ParallaxCamera } from '../render/parallax.js';
import { CinematicsManager } from '../render/cinematics.js';
import { AdventureMode } from '../story/adventure.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mixWhite = (hex, k) => { const h = hex.replace('#', ''); const n = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return `rgb(${n.map(v => Math.round(v + (255 - v) * k)).join(',')})`; };

export function bossPalette(def) {
  const p = def.skins[0].pal;
  return { ...p, armor: '#14110f', armor2: '#2b2418', cloth: '#1a1208', trim: '#e0b84a', glow: '#ffd466', hair: '#0d0b09', visor: '#ffd466' };
}

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.dev = !!opts.dev; this.debug = false;
    let storage = null; try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }
    this.save = new SaveManager(storage, { unlockAll: !!opts.unlockAll });
    this.input = new InputManager(window);
    this.audio = new AudioManager();
    this.fx = new Effects(); this.hud = new HUD();
    this.stages = STAGES.build();
    this.renderer = new FighterRenderer();
    this.parallax = new ParallaxCamera(this);
    this.cinematics = new CinematicsManager(this);
    this.cam = { x: CFG.STAGE_W / 2, zoom: 1, parallax: this.parallax };
    this.view = 'bg'; this.bg = { stage: 2, actors: [null, null], zoom: 1, camX: CFG.STAGE_W / 2 };
    this.match = null; this.adventure = null; this.ai = [null, null]; this.cfg = null; this.paused = false;
    this.time = 0; this.acc = 0; this.last = 0; this.frame = 0; this.errors = 0; this.running = false;
    this.dummy = 'stand'; this.recBuf = []; this.recording = false; this.playIdx = 0;
    this.afterglow = [0, 0]; this.matchClock = 0; this.fps = 60; this._fpsT = 0; this._fpsN = 0;
    this.onMatchEnd = null; this.onPauseRequest = null; this.onError = null; this.onToast = null;
    this.applySettings();
    this._bindFocus();
    this.resize(); window.addEventListener('resize', () => this.resize());
  }

  // ---------------------------------------------------------------- settings / lifecycle
  applySettings() {
    const s = this.save.settings;
    this.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, ambient: s.ambient });
    this.fx.settings.shake = s.shake * s.motion; this.fx.settings.reduceFx = s.reduceFx || s.quality === 'low'; this.fx.settings.reduceFlash = s.reduceFlash;
    this.input.setBindings(s.bindings);
    if (this.ai[1]) this.ai[1].setDifficulty(this.cfg?.difficulty || s.difficulty);
  }
  _bindFocus() {
    window.addEventListener('blur', () => { if (this.view === 'fight' && !this.paused && this.match && !this.match.finished) this.requestPause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.view === 'fight' && !this.paused) this.requestPause(); });
  }
  requestPause() { this.setPaused(true); if (this.onPauseRequest) this.onPauseRequest(); }
  setPaused(p) {
    if (!this.match) return;
    this.paused = p; if (p) this.match.pause(); else this.match.resume();
    this.input.enabledGameplay = this.view === 'fight' && !p; this.input.clear();
    this.audio.play(p ? 'pause' : 'resume');
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    const sc = Math.min(W / CFG.W, H / CFG.H);
    this.scale = sc; this.canvas.width = Math.round(CFG.W * dpr * Math.min(sc, 1.5)); this.canvas.height = Math.round(CFG.H * dpr * Math.min(sc, 1.5));
    
    this.pxk = this.canvas.width / CFG.W;
    document.documentElement.style.setProperty('--ui-scale', sc);
  }

  start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame(t => this.loop(t)); }

  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(t => this.loop(t));
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.25) dt = 1 / 60;                     // tab switches / hitches
    this.acc = Math.min(this.acc + dt, 0.1);         // cap catch-up
    this._fpsT += dt; this._fpsN++; if (this._fpsT > 0.5) { this.fps = Math.round(this._fpsN / this._fpsT); this._fpsT = 0; this._fpsN = 0; }
    try {
      this.input.pollPads();
      this.parallax.update(dt);
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 5) { this.tick(); this.acc -= 1 / 60; steps++; }
      this.render();
      this.errors = 0;
    } catch (e) {
      this.errors++; console.error('[IronVeil] frame error', e);
      if (this.onError) this.onError(e);
      if (this.errors > 3) { this.running = false; }
    }
  }

  // ---------------------------------------------------------------- match setup
  startMatch(cfg) {
    this.endMatch(true);
    const s = this.save.settings;
    const a = BY_ID[cfg.p1.id], b = BY_ID[cfg.p2.id];
    this.cfg = { rounds: s.roundsToWin, roundTime: s.roundTime, difficulty: s.difficulty, ...cfg };
    const m = new Match({ p1: { def: a, skin: cfg.p1.skin || 0 }, p2: { def: b, skin: cfg.p2.skin || 0 }, roundTime: this.cfg.roundTime, roundsToWin: this.cfg.rounds, training: cfg.mode === 'training', record: false });
    if (cfg.p2.boss) { m.f[1].palOverride = bossPalette(b); m.f[1].hpMul = 1.2; m.f[1].reset(m.f[1].x, m.f[1].facing); m.labels = [a.name, 'VEIL SOVEREIGN']; }
    if (cfg.p1.boss) { m.f[0].palOverride = bossPalette(a); }
    this.match = m; this.mode = cfg.mode; this.paused = false;
    this.ai = [null, null];
    if (cfg.mode !== 'twoPlayer') { this.ai[1] = new FightingAI(1, this.cfg.difficulty, (Math.random() * 1e6) | 0); }
    this.dummy = 'stand'; this.recBuf = []; this.recording = false; this.playIdx = 0; this.matchClock = 0;
    this.fx.clear(); this.hud.reset(); this.trail = [0, 0];
    m.on(e => this._onEvent(e));
    this.stageIdx = clamp(cfg.stage ?? 0, 0, this.stages.length - 1); this.stage = this.stages[this.stageIdx];
    this.view = 'fight'; this.input.enabledGameplay = true; this.input.clear();
    this.cam = { x: CFG.STAGE_W / 2, zoom: 1.12 };
    if (this.audio.ready) this.audio.music.play(this.stage.mood);
    return m;
  }

  endMatch(silent = false) {
    this.match = null; this.paused = false; this.view = 'bg'; this.input.enabledGameplay = false; this.input.clear(); this.fx.clear(); this.hud.reset(); this.ai = [null, null];
  }

  startAdventure(opts) {
    this.endMatch(true);
    this.adventure = new AdventureMode(this, opts);
    this.view = 'adventure';
    this.input.enabledGameplay = true;
    this.input.clear();
    this.paused = false;
    this.adventure.onLevelVictory = stats => {
      if (window.ui) window.ui.go('storyVictory', { stats });
    };
    this.adventure.onGameOver = stats => {
      if (window.ui) window.ui.go('storyGameOver', { stats });
    };
    return this.adventure;
  }

  endAdventure() {
    this.adventure = null;
    this.view = 'bg';
    this.input.enabledGameplay = false;
    this.input.clear();
  }

  restartMatch() { if (this.cfg) { const c = this.cfg; this.startMatch({ ...c }); } }

  // ---------------------------------------------------------------- per-frame sim
  tick() {
    this.frame++;
    if (this.view === 'bg') { this._tickBg(); return; }
    if (this.view === 'adventure' && this.adventure) {
      if (!this.paused) this.adventure.step();
      return;
    }
    const m = this.match; if (!m) return;
    if (this.paused) return;
    // slow motion: during the KO slow window every other frame is simulated
    if (m.slow > 0 && (this.frame & 1)) { this.fx.update(); this.hud.update(m); return; }
    const inputs = this._gatherInputs(m);
    m.step(inputs);
    this.matchClock++;
    this._tickVisuals(m);
    this.fx.update(); this.hud.update(m); this._updateCamera(m);
    this.stage.update(this.frame, this.fx);
    if (this.mode === 'training' && m.phase === 'fight') this.save.data.stats.trainingSeconds += 1 / 60;
  }

  _tickBg() {
    for (const a of this.bg.actors) if (a) a.update();
    this.fx.update(); this.bgStage && this.bgStage.update(this.frame, null);
    if (this.bg.stage != null) this.stages[this.bg.stage].update(this.frame, null);
    // gentle camera drift on menus
    this.bg.camX = CFG.STAGE_W / 2 + Math.sin(this.frame * 0.004) * 120;
  }

  _merged() {
    const a = this.input.read(0), b = this.input.read(1), o = {};
    for (const k in a) o[k] = a[k] || b[k];
    if (o.left && o.right) o.left = o.right = false;
    return o;
  }

  _gatherInputs(m) {
    if (m.phase !== 'fight') return [EMPTY_INPUT, EMPTY_INPUT];
    if (this.mode === 'twoPlayer') return [this.input.read(0), this.input.read(1)];
    const p1 = this._merged();
    if (this.mode === 'training') return this._trainingInputs(m, p1);
    return [p1, this.ai[1].update(m.f[1], m.f[0], m)];
  }

  _trainingInputs(m, p1) {
    const d = this.dummy, f1 = m.f[1];
    let dummy = EMPTY_INPUT;
    if (d === 'crouch') dummy = { ...EMPTY_INPUT, down: true };
    else if (d === 'block') dummy = { ...EMPTY_INPUT, block: true };
    else if (d === 'blockLow') dummy = { ...EMPTY_INPUT, block: true, down: true };
    else if (d === 'jump') dummy = { ...EMPTY_INPUT, up: this.frame % 100 === 0 };
    else if (d === 'cpu') dummy = this.ai[1].update(f1, m.f[0], m);
    else if (d === 'record') { dummy = p1; this.recBuf.push({ ...p1 }); if (this.recBuf.length > 900) this.recBuf.shift(); return [EMPTY_INPUT, dummy]; }
    else if (d === 'playback') { if (this.recBuf.length) { dummy = this.recBuf[this.playIdx % this.recBuf.length]; this.playIdx++; } }
    return [p1, dummy];
  }

  // ---------------------------------------------------------------- training controls (UI/hotkeys call these)
  setDummy(mode) {
    this.dummy = mode; this.playIdx = 0;
    if (mode === 'record') { this.recBuf = []; this.resetPositions(); }
    if (mode === 'playback') this.resetPositions();
    if (this.ai[1] && mode === 'cpu') this.ai[1].reset();
  }
  resetPositions() { const m = this.match; if (!m) return; const mt = [m.f[0].meter, m.f[1].meter]; m.resetPositions(); m.f[0].meter = mt[0]; m.f[1].meter = mt[1]; m.projectiles.length = 0; this.playIdx = 0; }
  resetHealth() { const m = this.match; if (!m) return; for (const f of m.f) { f.hp = f.maxHp; f.guard = 100; f.meter = 0; } }
  toggleInfHealth() { if (this.match) this.match.train.infHealth = !this.match.train.infHealth; return this.match?.train.infHealth; }
  giveMeter() { if (this.match) this.match.f.forEach(f => { f.meter = 100; }); }

  // ---------------------------------------------------------------- camera
  _updateCamera(m) {
    const [a, b] = m.f; let tx = (a.x + b.x) / 2, sep = Math.abs(a.x - b.x);
    let tz = clamp(1280 / (sep + 700), 0.74, 1.1), rate = 0.1;
    if (m.cinematic) { const o = m.cinematic.owner; tx = o.x + o.facing * 70; tz = 1.5; rate = 0.22; }
    else if (m.phase === 'ko' || (m.phase === 'roundEnd')) { const w = m.roundWinner >= 0 ? m.f[m.roundWinner] : null; if (w) { tx = (tx + w.x) / 2; tz = Math.max(tz, 1.05); } }
    else if (m.phase === 'intro') { const k = m.t / CFG.INTRO_FRAMES; tz = 1.18 - 0.1 * Math.min(1, k * 1.5); }
    this.cam.x += (tx - this.cam.x) * rate; this.cam.zoom += (tz - this.cam.zoom) * (rate * 0.8);
    const half = 640 / this.cam.zoom;
    if (CFG.STAGE_W >= half * 2) this.cam.x = clamp(this.cam.x, half - 40, CFG.STAGE_W - half + 40); else this.cam.x = CFG.STAGE_W / 2;
  }

  // ---------------------------------------------------------------- match events -> presentation
  _onEvent(e) {
    const a = this.audio, fx = this.fx, h = this.hud, m = this.match;
    const wy = (y) => -y;
    switch (e.type) {
      case 'roundStart': this.fx.clear(); h.reset(); h.announce(`ROUND ${e.round}`, m.wins[0] === m.need - 1 && m.wins[1] === m.need - 1 ? 'FINAL ROUND' : '', '#fff', 80); a.play('roundStart'); break;
      case 'fight': h.announce(this.mode === 'training' ? 'TRAINING' : 'FIGHT!', '', '#ff5a4a', 50); a.play('fight'); fx.flash('#fff', 0.18); break;
      case 'moveStart': {
        const mv = e.move, f = e.f;
        if (mv.rank >= 3 && mv.rank < 4) { h.callSpecial(f.index, mv.name); a.voice(ROSTER.indexOf(f.def), 'attack'); }
        if (mv.rank === 4) { h.banner(f.index, mv.name, f.pal.glow); h.callSpecial(f.index, mv.name); a.play('ultStart'); a.voice(ROSTER.indexOf(f.def), 'ult'); fx.pulse(f.pal.glow, 0.35); }
        else a.play('whoosh', { heavy: mv.rank >= 2 });
        if (mv.sfx === 'projectile' || mv.sfx === 'special') { /* sound plays on projectile spawn / impact */ }
        else if (mv.sfx === 'dash') a.play('dash');
        break;
      }
      case 'jump': a.play('jump'); fx.dust(e.f.x, 0, 4, 20); break;
      case 'land': a.play('land'); fx.dust(e.f.x, 0, 5, 24); break;
      case 'dash': a.play('dash'); fx.dust(e.f.x - e.f.facing * 20, 0, 6, 12); fx.speedLines(e.f.x, wy(80), e.f.facing, 'rgba(255,255,255,0.8)', 3); break;
      case 'projectile': a.play('special'); a.play('projectile'); break;
      case 'projectileClash': fx.ring(e.x, wy(e.y), '#fff', 8, 60, 14, 1, 4); fx.burst(e.x, wy(e.y), '#fff', 16, 9); a.play('parry'); break;
      case 'shockwave': fx.ring(e.x, 0, '#e8d8b8', 20, 260, 22, 0.18, 8); fx.ring(e.x, 0, '#fff', 10, 180, 16, 0.14, 4); fx.dust(e.x, 0, 14, 90); fx.shake(9, 14); a.play('shockwave'); fx.pulse(e.f.pal.glow, 0.2); break;
      case 'hit': this._hitFx(e); break;
      case 'block': {
        const d = e.def, dir = e.att.facing, col = '#bcd8ff';
        fx.shield(e.x, wy(e.y), dir, col, e.heavy); fx.burst(e.x, wy(e.y), '#dfe9ff', e.heavy ? 12 : 7, 7, { dir: dir > 0 ? Math.PI : 0, spread: 0.9 }); fx.shake(e.heavy ? 3 : 1.5, 6);
        a.play('block'); if (e.chip) fx.text(d.x, wy(150), '-' + e.chip, '#9db4d6', 20, 30); break;
      }
      case 'parry': {
        fx.star(e.x, wy(e.y), '#e8ffff', 80, 9); fx.ring(e.x, wy(e.y), '#7ff3ff', 8, 110, 14, 1, 5); fx.burst(e.x, wy(e.y), '#9ff8ff', 18, 11, { len: 1.4 });
        fx.flash('#bdf8ff', 0.22); fx.shake(2, 6); a.play('parry'); h.popup(e.def.index, 'PARRY', '#7ff3ff'); break;
      }
      case 'counter': {
        fx.star(e.x, wy(e.y), mixWhite(e.att.pal.glow, 0.5), 100, 10); fx.ring(e.x, wy(e.y), e.att.pal.glow, 10, 130, 16, 1, 6); fx.burst(e.x, wy(e.y), e.att.pal.glow, 22, 12);
        fx.flash('#fff', 0.3); fx.shake(8, 10); a.play('counter'); h.popup(e.att.index, 'COUNTER STANCE', e.att.pal.glow); break;
      }
      case 'guardBreak': fx.shards(e.def.x, wy(110), '#cfe4ff'); fx.ring(e.def.x, wy(100), '#fff', 10, 150, 16, 1, 6); fx.flash('#fff', 0.25); fx.shake(7, 10); a.play('guardBreak'); h.popup(e.att.index, 'GUARD BREAK', '#ffd466'); break;
      case 'throw': fx.dust(e.def.x, 0, 12, 50); fx.ring(e.def.x, 0, '#fff', 10, 120, 14, 0.2, 5); fx.shake(7, 10); a.play('throw'); break;
      case 'throwTech': fx.ring(e.x, wy(e.y), '#fff', 8, 90, 12, 1, 4); a.play('parry'); h.announce('', '', '#fff', 1); break;
      case 'ko': {
        fx.flash('#fff', 0.5); fx.shake(12, 20); a.play('ko');
        h.announce(e.timeout ? 'TIME OVER' : e.winner === -1 ? 'DOUBLE KO' : 'K.O.', '', e.timeout ? '#ffd466' : '#ff4a3a', 110);
        fx.pulse('#ff3030', 0.3);
        if (e.winner >= 0 && this.match) {
          const w = e.winner;
          if (this.match.wins[w] >= this.match.roundsToWin - 1 || this.match.f[1 - w].hp <= 0) {
            this.cinematics.startFinisher(this.match.f[w], this.match.f[1 - w]);
          }
        }
        break;
      }
      case 'roundEnd': {
        const w = e.winner, mm = this.match;
        const name = w >= 0 ? (mm.labels ? mm.labels[w] : mm.f[w].def.name) : '';
        h.announce(w < 0 ? 'DRAW' : e.matchWinner >= 0 ? `${name.toUpperCase()} WINS` : `${name.toUpperCase()} TAKES THE ROUND`, w >= 0 ? `"${mm.f[w].def.quote}"` : '', '#ffd466', 150);
        if (w >= 0) { a.play('roundWin'); a.voice(ROSTER.indexOf(mm.f[w].def), 'win'); for (let i = 0; i < 18; i++) fx.ember(mm.f[w].x + (Math.random() - 0.5) * 120, wy(10 + Math.random() * 60), mm.f[w].pal.glow, 1.5); }
        else a.play('roundLoss'); break;
      }
      case 'matchEnd': this._finishMatch(e); break;
      default: break;
    }
  }

  _hitFx(e) {
    const fx = this.fx, a = this.audio, att = e.att, def = e.def, mv = e.move, pal = att.pal;
    const x = e.x, y = -e.y, dir = att.facing, rank = mv.rank || 1;
    const hot = mixWhite(pal.glow, 0.55), core = '#fff6e0';
    const dmgPct = e.dmg / def.maxHp;
    // hit-level layered impact
    if (e.armor) { fx.burst(x, y, '#ffd8a0', 8, 7); fx.star(x, y, '#ffd8a0', 40, 6); a.play('heavyImpact'); fx.shake(4, 6); return; }
    if (e.heavy) {
      fx.star(x, y, core, 74, 9); fx.ring(x, y, hot, 8, 90, 13, 1, 5); fx.burst(x, y, hot, 20, 12, { dir: dir > 0 ? 0 : Math.PI, spread: 1.4, len: 1.3 });
      fx.dust(def.x, 0, 7, 36); fx.shake(mv.ultimate ? (e.last ? 14 : 5) : 6, 10); a.play('heavyImpact');
      if (def.hp <= 0 || e.last) { fx.flash('#fff', e.last ? 0.45 : 0.25); fx.pulse(pal.glow, 0.3); }
    } else {
      fx.star(x, y, core, 44, 6); fx.burst(x, y, hot, 9, 8, { dir: dir > 0 ? 0 : Math.PI, spread: 1.2 }); fx.shake(1.8, 5);
    }
    a.play(e.counter ? 'counter' : mv.sfx === 'projectile' || mv.projectile ? 'projectileHit' : (mv.sfx === 'lightKick' ? 'lightKick' : mv.sfx === 'heavyKick' ? 'heavyKick' : mv.sfx === 'heavyPunch' ? 'heavyPunch' : mv.sfx === 'ultimate' ? 'hit' : mv.sfx === 'special' ? 'heavyImpact' : 'lightPunch'));
    if (!e.heavy && dmgPct > 0.04) a.play('hit');
    if (e.throw) { a.play('throw'); }
    if (e.counter) { fx.ring(x, y, '#ff8a3a', 10, 100, 12, 1, 5); fx.flash('#ffb060', 0.18); }
    if (e.punish) fx.ring(x, y, '#ffd466', 10, 80, 12, 1, 4);
    if (e.heavy && Math.random() < 0.5) a.voice(ROSTER.indexOf(def.def), 'hurt');
    // per-character ultimate signature
    if (mv.ultimate) this._ultSignature(att, def, e);
    fx.pulse(pal.glow, e.heavy ? 0.14 : 0.05);
    if (e.dmg > 0) fx.text(def.x + (Math.random() - 0.5) * 40, -190 - (def.crouching ? -40 : 0), String(e.dmg), e.heavy ? '#ffd466' : '#fff', e.heavy ? 30 : 22, 36);
  }

  _ultSignature(att, def, e) {
    this.cinematics.startUltimate(att, def);
    const fx = this.fx, id = att.def.id, x = def.x, pal = att.pal, y = -110;
    switch (id) {
      case 'kael': fx.slash(x, y, 90, att.facing > 0 ? -2.4 : -0.7, att.facing > 0 ? -0.6 : -2.5, '#ff5a4a', 10, 14); fx.burst(x, y, '#ff3a3a', 10, 12); break;
      case 'nyra': fx.ring(x, y, '#c58bff', 6, 80, 10, 1, 4); fx.slash(x, y, 70, 0, 4.2, '#b46bff', 9, 8); break;
      case 'bram': fx.ring(x, 0, '#ff9a3a', 20, 200, 18, 0.18, 8); fx.dust(x, 0, 10, 80); fx.shake(8, 10); break;
      case 'sora': fx.bolt(x + (Math.random() - 0.5) * 120, -520, x, 0, '#7ff3ff', 9); fx.ring(x, 0, '#7ff3ff', 10, 150, 14, 0.2, 5); break;
      case 'vex': fx.burst(x, y, '#ff2d3d', 14, 14, { len: 1.6 }); fx.ring(x, y, '#ff2d3d', 6, 70, 8, 1, 3); break;
      case 'sera': fx.slash(x, y, 100, att.facing > 0 ? -1.2 : -2.0, att.facing > 0 ? 0.8 : -4.0, '#ffe08a', 10, 12); fx.burst(x, y, '#fff2b0', 10, 11); break;
      default: break;
    }
  }

  // per-frame particle sources: swing trails, afterimages, projectile trails, ambience on fighters
  _tickVisuals(m) {
    const fx = this.fx;
    for (const f of m.f) {
      const mv = f.move;
      if (mv && !mv.noHit && f.phase === 'active' && f._tips) {
        const t = f._tips, foot = ['lk', 'hk', 'ck', 'sw', 'ak'].includes(mv.id), tip = foot ? t.ffoot : (t.blade || t.fhand);
        if (tip && (mv.box.w > 0)) {
          const wx = f.x + f.facing * tip.x / 1, wy = -(f.y - tip.y);
          const heavy = mv.rank >= 2;
          fx.trail(wx, wy, mixWhite(f.pal.glow, 0.35), heavy ? 12 : 7);
          if (heavy) fx.trail(wx - f.facing * 14, wy, f.pal.glow, 8);
        }
      }
      // ghost afterimages for dashes, evades, ultimates of fast fighters
      const fast = f.state === S.DASH || (mv && (mv.evade || (mv.ultimate && ['nyra', 'vex', 'sera'].includes(f.def.id)) || (mv.id === 'sp2' && f.def.id === 'vex')));
      if (fast && this.frame % 3 === 0 && f._pose) fx.ghost(f, f._pose, f.pal.glow, 10);
      if (mv && mv.ultimate && f.moveFrame > mv.startup && this.frame % 5 === 0) fx.burst(f.x, -90, f.pal.glow, 4, 6);
      if (f.state === S.ULTIMATE && f.moveFrame < mv.startup && this.frame % 2 === 0) fx.ember(f.x + (Math.random() - 0.5) * 80, -(Math.random() * 160), f.pal.glow, 2);
      if (f.stance > 0 && this.frame % 6 === 0) fx.ember(f.x + (Math.random() - 0.5) * 50, -(20 + Math.random() * 140), f.pal.glow, 1);
      if (f.state === S.VICTORY && this.frame % 6 === 0) fx.ember(f.x + (Math.random() - 0.5) * 100, -(10 + Math.random() * 60), f.pal.glow, 1.4);
    }
    for (const p of m.projectiles) {
      if (this.frame % 2 === 0) fx.trail(p.x - p.dir * 14, -p.y + (Math.random() - 0.5) * 16, p.color, p.kind === 'cannon' ? 14 : 9);
      if (p.kind === 'disc' && this.frame % 3 === 0) fx.burst(p.x, -p.y, '#bffaff', 2, 3);
    }
    if (m.phase === 'ko' || m.phase === 'roundEnd') { const w = m.f.find(f => f.state === S.VICTORY); if (w && this.frame % 8 === 0) fx.ember(w.x + (Math.random() - 0.5) * 160, -(Math.random() * 60), w.pal.glow, 2); }
  }

  _finishMatch(e) {
    const m = this.match, cfg = this.cfg;
    const humanIndex = 0;
    const w = e.winner;
    const res = {
      winner: w, mode: cfg.mode, cfg, p1Id: m.f[0].def.id, p2Id: m.f[1].def.id, humanIndex,
      stats: m.f.map(f => ({ ...f.stats })), wins: [...m.wins], time: this.matchClock / 60,
      flawless: w === 0 ? m.wins[1] === 0 : w === 1 ? m.wins[0] === 0 : false,
    };
    if (cfg.mode === 'training') return;
    // Local two-player matches don't count toward single-player progression
    if (cfg.mode === 'twoPlayer') res.notes = []; else res.notes = this.save.recordMatch({ ...res, countsAsWin: true, arcadeCleared: cfg.finalFight, storyCleared: cfg.finalFight });
    for (const n of res.notes) if (this.onToast) this.onToast(n);
    this.matchResult = res;
    if (this.onMatchEnd) this.onMatchEnd(res);
  }

  // ---------------------------------------------------------------- previews (menus)
  setPreview(stageIdx, a0, a1) {
    this.view = 'bg'; this.bg.stage = clamp(stageIdx ?? 2, 0, this.stages.length - 1); this.bg.actors = [a0 || null, a1 || null];
  }
  makeActor(id, skin, facing = 1) { return new Actor(BY_ID[id], skin, facing); }

  // ---------------------------------------------------------------- rendering
  render() {
    const ctx = this.ctx, k = this.pxk;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (this.view === 'adventure' && this.adventure) this.adventure.render(ctx);
    else if (this.view === 'fight' && this.match) this._renderFight(ctx);
    else this._renderBg(ctx);
    if (this.dev) this._devOverlay(ctx);
  }

  _toScreen(cam) { return { sx: x => (x - cam.x) * cam.zoom + 640, gy: floorScreenY(cam), z: cam.zoom }; }

  _drawFighter(ctx, f, cam, time, opts = {}) {
    const { sx, gy, z } = this._toScreen(cam);
    const shake = this.match && this.match.hitstop > 0 && f.hurtFlash > 0 ? (Math.random() - 0.5) * 5 : 0;
    ctx.save(); ctx.translate(sx(f.x) + shake, gy - f.y * z); ctx.scale(z, z);
    this.renderer.draw(ctx, f, 0, 0, time, opts);
    ctx.restore();
  }

  _shadow(ctx, f, cam) {
    const { sx, gy, z } = this._toScreen(cam), k = clamp(1 - f.y / 380, 0.25, 1), w = 52 * f.def.prop.s * z * (0.7 + 0.3 * k);
    ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.42 * k})`; ctx.beginPath(); ctx.ellipse(sx(f.x), gy + 4 * z, w, 9 * z * k, 0, 0, 6.3); ctx.fill(); ctx.restore();
  }

  _renderFight(ctx) {
    const m = this.match, cam = this.cam, st = this.stage, { sx, gy, z } = this._toScreen(cam), fx = this.fx;
    cam.parallax = this.parallax;
    cam.quality = this.save.settings.quality;
    const off = fx.shakeOffset;
    ctx.save();
    if (this.parallax.tiltX) {
      ctx.translate(640, 360);
      ctx.rotate(this.parallax.tiltX * 0.002);
      ctx.translate(-640, -360);
    }
    ctx.translate(off.x, off.y);
    st.drawBack(ctx, cam, this.frame); st.drawFloor(ctx, cam, this.frame);
    // ultimate cinematic: darken the world except the owner
    for (const f of m.f) this._shadow(ctx, f, cam);
    // afterimage ghosts
    for (const g of fx.ghosts) { ctx.save(); ctx.translate(sx(g.x), gy - g.y * z); ctx.scale(z, z); this.renderer.draw(ctx, g.f, 0, 0, this.frame, { pose: g.pose, facing: g.facing, flat: g.col, alpha: 0.4 * g.life / g.max }); ctx.restore(); }
    // draw order: the fighter in the middle of an attack is drawn on top
    const order = m.f[0].move && !m.f[1].move ? [1, 0] : m.f[1].move && !m.f[0].move ? [0, 1] : [0, 1];
    const cin = m.cinematic;
    if (cin) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, 1280, 720); ctx.restore(); for (const f of m.f) this._shadow(ctx, f, cam); }
    for (const i of order) { if (cin && m.f[i] !== cin.owner) { ctx.save(); ctx.globalAlpha = 0.35; this._drawFighter(ctx, m.f[i], cam, this.frame); ctx.restore(); } else this._drawFighter(ctx, m.f[i], cam, this.frame); }
    if (cin) { const o = cin.owner; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.2 * Math.sin(this.frame * 0.5); const g = ctx.createRadialGradient(sx(o.x), gy - 90 * z, 10, sx(o.x), gy - 90 * z, 260 * z); g.addColorStop(0, o.pal.glow); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720); ctx.restore(); if (this.frame % 2 === 0) this.fx.speedLines(o.x, -100, o.facing, o.pal.glow, 3); }
    // projectiles
    this._drawProjectiles(ctx, m, cam);
    // world-space particles
    ctx.save(); ctx.translate(640 - cam.x * z, gy); ctx.scale(z, z); fx.draw(ctx);
    for (const t of fx.texts) { ctx.globalAlpha = Math.min(1, t.life / 12); ctx.font = `900 ${t.size}px "Bahnschrift","Arial Narrow",Arial,sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#08080c'; ctx.strokeText(t.str, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.str, t.x, t.y); }
    ctx.restore();
    st.drawFront(ctx, cam, this.frame);
    if (this.debug) this._drawDebug(ctx, m, cam);
    ctx.restore();
    this.cinematics.update();
    this.cinematics.draw(ctx, cam);
    drawGrade(st, ctx, fx.pulseA, fx.pulseCol);
    if (fx.flashA > 0.01) { ctx.save(); ctx.globalAlpha = fx.flashA; ctx.fillStyle = fx.flashCol; ctx.fillRect(0, 0, 1280, 720); ctx.restore(); }
    this.hud.draw(ctx, m, { dummy: this.dummy, rec: this.dummy === 'record' });
    if (this.dummy === 'record' && m.training) { ctx.save(); ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(1230, 120, 8, 0, 7); ctx.fill(); ctx.font = '800 14px Arial'; ctx.textAlign = 'right'; ctx.fillText('REC ' + (this.recBuf.length / 60).toFixed(1) + 's', 1212, 125); ctx.restore(); }
  }

  _drawProjectiles(ctx, m, cam) {
    const { sx, gy, z } = this._toScreen(cam), t = this.frame;
    for (const p of m.projectiles) {
      const x = sx(p.x), y = gy - p.y * z, r = p.w / 2 * z;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 2, x, y, r * 1.6); g.addColorStop(0, '#fff'); g.addColorStop(0.35, p.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g;
      if (p.kind === 'burst') {
        ctx.translate(x, y); ctx.scale(p.dir, 1); ctx.beginPath(); ctx.moveTo(-r, -r * 0.9); ctx.quadraticCurveTo(r * 1.1, -r * 0.5, r * 1.4, 0); ctx.quadraticCurveTo(r * 1.1, r * 0.5, -r, r * 0.9); ctx.quadraticCurveTo(-r * 0.3, 0, -r, -r * 0.9); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.5); ctx.quadraticCurveTo(r * 0.9, -r * 0.3, r * 1.2, 0); ctx.stroke();
      } else if (p.kind === 'disc') {
        ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, 7); ctx.fill(); ctx.translate(x, y); ctx.rotate(t * 0.4 * p.dir);
        ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, 7); ctx.stroke();
        for (let i = 0; i < 3; i++) { ctx.rotate(2.094); ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 1.4); ctx.stroke(); }
      } else {
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.7, 0, 0, 7); ctx.fill(); ctx.translate(x, y); ctx.scale(p.dir, 1);
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(r * 0.3, 0, r * 0.9, r * 0.28, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.6, (i - 1.5) * 9); ctx.lineTo(-r * 2.4, (i - 1.5) * 14); ctx.stroke(); }
      }
      ctx.restore();
    }
  }

  _renderBg(ctx) {
    const st = this.stages[this.bg.stage ?? 2], zoom = this.bg.actors[0] && this.bg.actors[1] ? 1.18 : this.bg.actors[0] ? 1.2 : 1;
    const cam = { x: this.bg.actors[0] ? CFG.STAGE_W / 2 + (this.bg.actors[1] ? 0 : 0) : this.bg.camX, zoom, parallax: this.parallax, quality: this.save.settings.quality };
    const { sx, gy, z } = this._toScreen(cam);
    ctx.save();
    if (this.parallax.tiltX) {
      ctx.translate(640, 360);
      ctx.rotate(this.parallax.tiltX * 0.004);
      ctx.translate(-640, -360);
    }
    st.drawBack(ctx, cam, this.frame); st.drawFloor(ctx, cam, this.frame);
    const [a, b] = this.bg.actors;
    const cx = CFG.STAGE_W / 2;
    if (a) { a.f.x = b ? cx - 200 : cx + (this.bg.offset || 0); a.f.facing = 1; if (b) { b.f.x = cx + 200; b.f.facing = -1; } }
    for (const ac of [a, b]) if (ac) this._shadow(ctx, ac.f, cam);
    for (const ac of [a, b]) if (ac) this._drawFighter(ctx, ac.f, cam, this.frame);
    st.drawFront(ctx, cam, this.frame);
    ctx.restore();
    drawGrade(st, ctx);
  }

  // ---------------------------------------------------------------- debug overlay
  toggleDebug() { this.debug = !this.debug; return this.debug; }
  _drawDebug(ctx, m, cam) {
    const { sx, gy, z } = this._toScreen(cam);
    ctx.save(); ctx.lineWidth = 1.5; ctx.font = '600 12px monospace';
    for (const f of m.f) {
      const hb = f.hurtBox();
      ctx.strokeStyle = '#3cff6a'; ctx.strokeRect(sx(hb.l), gy - hb.top * z, (hb.r - hb.l) * z, (hb.top - hb.bottom) * z);
      ctx.fillStyle = '#3cff6a22'; ctx.fillRect(sx(hb.l), gy - hb.top * z, (hb.r - hb.l) * z, (hb.top - hb.bottom) * z);
      if (f.move && !f.move.noHit && f.move.box.w > 0) {
        const ab = f.attackBox(), active = f.phase === 'active';
        ctx.strokeStyle = active ? '#ff3a3a' : '#ff3a3a55'; ctx.fillStyle = active ? '#ff3a3a44' : 'transparent';
        ctx.strokeRect(sx(ab.l), gy - ab.top * z, (ab.r - ab.l) * z, (ab.top - ab.bottom) * z); if (active) ctx.fillRect(sx(ab.l), gy - ab.top * z, (ab.r - ab.l) * z, (ab.top - ab.bottom) * z);
      }
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(sx(f.x) - 6, gy - f.y * z); ctx.lineTo(sx(f.x) + 6, gy - f.y * z); ctx.moveTo(sx(f.x), gy - f.y * z - 6); ctx.lineTo(sx(f.x), gy - f.y * z + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx(f.x), gy - f.y * z - 30); ctx.lineTo(sx(f.x) + f.facing * 26, gy - f.y * z - 30); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(`${f.state} ${f.anim.name}${f.move ? ' ' + f.phase + ' ' + f.moveFrame + '/' + f.moveLength : ''}`, sx(f.x) - 50, gy - (f.y + (f.crouching ? 125 : 190)) * z);
    }
    ctx.strokeStyle = '#ffd24a'; for (const p of m.projectiles) ctx.strokeRect(sx(p.x - p.w / 2), gy - (p.y + p.h / 2) * z, p.w * z, p.h * z);
    ctx.restore();
  }
  _devOverlay(ctx) {
    ctx.save(); ctx.font = '600 12px monospace'; ctx.fillStyle = '#9fe'; ctx.textAlign = 'right';
    ctx.fillText(`FPS ${this.fps}  fx ${this.fx.active}  frame ${this.frame}  ${this.debug ? 'DEBUG' : ''}`, 1270, 712); ctx.restore();
  }
}
