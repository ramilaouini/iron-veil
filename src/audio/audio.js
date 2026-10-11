// Procedural audio: every sound is synthesized with Web Audio (no files, no network).
// AudioManager = context/buses/volume/throttling + SFX library. MusicEngine = generative per-mood music + ambience.

const rnd = (a, b) => a + Math.random() * (b - a);

export class AudioManager {
  constructor() {
    this.ctx = null; this.ready = false; this.muted = false;
    this.vol = { master: 0.8, music: 0.55, sfx: 0.9, ambient: 0.5 };
    this.active = new Map(); this.lastPlayed = new Map();
    this.music = null;
  }

  // Must be called from a user gesture (key / click) to satisfy autoplay policies.
  init() {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    try {
      const ctx = this.ctx = new AC();
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.18;
      this.master = ctx.createGain(); this.sfxBus = ctx.createGain(); this.musicBus = ctx.createGain(); this.ambBus = ctx.createGain();
      this.sfxBus.connect(this.master); this.musicBus.connect(this.master); this.ambBus.connect(this.master);
      this.master.connect(this.comp); this.comp.connect(ctx.destination);
      const len = ctx.sampleRate; this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ready = true; this.applyVolumes();
      this.music = new MusicEngine(this);
      return true;
    } catch (e) { console.warn('Audio init failed', e); return false; }
  }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  setMuted(m) { this.muted = m; this.applyVolumes(); }
  applyVolumes() {
    if (!this.ready) return; const t = this.ctx.currentTime, k = this.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(this.vol.master * k, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.03);
    this.ambBus.gain.setTargetAtTime(this.vol.ambient * 0.6, t, 0.03);
  }

  // ---- primitives (all nodes self-disconnect when finished) ------------------------
  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, gain = 0.3, attack = 0.003, delay = 0, dest = null, detune = 0, vib = 0, curve = 'exp' }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.detune.value = detune;
    if (f1 != null) { if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); else o.frequency.linearRampToValueAtTime(f1, t + dur); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxBus);
    let lfo = null;
    if (vib) { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = vib; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05); }
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* ignore */ } };
    return o;
  }
  noise({ dur = 0.1, gain = 0.3, type = 'bandpass', f0 = 1500, f1 = null, q = 1, attack = 0.002, delay = 0, dest = null }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = dur > 0.9;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.setValueAtTime(f0, t); f.Q.value = q;
    if (f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    s.onended = () => { try { s.disconnect(); f.disconnect(); g.disconnect(); } catch { /* ignore */ } };
  }

  // Throttled playback: limits concurrent voices per sound and minimum spacing between repeats.
  play(name, opt = {}) {
    if (!this.ready || this.muted || this.ctx.state !== 'running') return;
    const def = SFX[name]; if (!def) { console.warn('Unknown sfx', name); return; }
    const now = performance.now(), last = this.lastPlayed.get(name) || 0;
    if (now - last < (def.gap ?? 35)) return;
    const n = this.active.get(name) || 0; if (n >= (def.max ?? 3)) return;
    this.lastPlayed.set(name, now); this.active.set(name, n + 1);
    setTimeout(() => this.active.set(name, Math.max(0, (this.active.get(name) || 1) - 1)), (def.len ?? 300));
    try { def.fn(this, opt); } catch (e) { console.warn('sfx error', name, e); }
  }

  // Synthesized "voice-style" cue: formant-filtered sawtooth glides. Not recorded speech.
  voice(charIndex, kind = 'attack') {
    if (!this.ready || this.muted) return;
    const base = [118, 220, 82, 180, 95, 160][charIndex] || 140, ctx = this.ctx;
    const dur = kind === 'win' ? 0.55 : kind === 'ult' ? 0.5 : 0.22;
    const up = kind === 'hurt' ? 0.7 : kind === 'win' ? 1.25 : 1.4;
    const o = ctx.createOscillator(), g = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), t = ctx.currentTime;
    o.type = charIndex === 4 ? 'square' : 'sawtooth';
    o.frequency.setValueAtTime(base * (kind === 'hurt' ? 1.3 : 1), t); o.frequency.exponentialRampToValueAtTime(base * up, t + dur);
    f1.type = f2.type = 'bandpass'; f1.frequency.value = kind === 'hurt' ? 600 : 800; f2.frequency.value = kind === 'hurt' ? 1300 : 1200; f1.Q.value = f2.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { try { o.disconnect(); g.disconnect(); f1.disconnect(); f2.disconnect(); } catch { /* ignore */ } };
  }
}

// ------------------------------------------------------------------ SFX library
const SFX = {
  lightPunch:  { gap: 20, max: 4, len: 120, fn: a => { a.noise({ dur: 0.07, gain: 0.22, f0: 1800, f1: 700, q: 1.2 }); a.tone({ type: 'triangle', f0: 260, f1: 110, dur: 0.06, gain: 0.2 }); } },
  heavyPunch:  { gap: 30, max: 3, len: 260, fn: a => { a.noise({ dur: 0.14, gain: 0.38, type: 'lowpass', f0: 1500, f1: 260 }); a.tone({ f0: 130, f1: 42, dur: 0.2, gain: 0.5 }); a.tone({ type: 'square', f0: 500, f1: 120, dur: 0.04, gain: 0.12 }); } },
  lightKick:   { gap: 20, max: 4, len: 150, fn: a => { a.noise({ dur: 0.09, gain: 0.26, f0: 1200, f1: 500, q: 0.8 }); a.tone({ f0: 190, f1: 80, dur: 0.09, gain: 0.3 }); } },
  heavyKick:   { gap: 30, max: 3, len: 300, fn: a => { a.noise({ dur: 0.18, gain: 0.4, type: 'lowpass', f0: 1100, f1: 180 }); a.tone({ f0: 100, f1: 34, dur: 0.26, gain: 0.6 }); a.tone({ type: 'triangle', f0: 320, f1: 80, dur: 0.08, gain: 0.2 }); } },
  hit:         { gap: 30, max: 3, len: 200, fn: a => { a.noise({ dur: 0.1, gain: 0.3, f0: 1400, f1: 400, q: 0.9 }); a.tone({ f0: 160, f1: 60, dur: 0.12, gain: 0.35 }); } },
  heavyImpact: { gap: 60, max: 2, len: 450, fn: a => { a.noise({ dur: 0.3, gain: 0.5, type: 'lowpass', f0: 2200, f1: 120 }); a.tone({ f0: 90, f1: 28, dur: 0.45, gain: 0.8 }); a.tone({ type: 'sawtooth', f0: 220, f1: 50, dur: 0.18, gain: 0.18 }); } },
  block:       { gap: 30, max: 3, len: 180, fn: a => { a.tone({ type: 'square', f0: 760, f1: 520, dur: 0.07, gain: 0.12 }); a.tone({ type: 'square', f0: 1180, f1: 900, dur: 0.05, gain: 0.08 }); a.noise({ dur: 0.05, gain: 0.2, type: 'highpass', f0: 3200 }); a.tone({ f0: 110, f1: 70, dur: 0.1, gain: 0.3 }); } },
  parry:       { gap: 60, max: 2, len: 350, fn: a => { a.tone({ type: 'sine', f0: 1700, f1: 2800, dur: 0.14, gain: 0.3 }); a.tone({ type: 'triangle', f0: 1200, f1: 1200, dur: 0.22, gain: 0.18, delay: 0.02 }); a.noise({ dur: 0.04, gain: 0.3, type: 'highpass', f0: 6000 }); } },
  counter:     { gap: 80, max: 2, len: 400, fn: a => { a.tone({ type: 'sawtooth', f0: 160, f1: 900, dur: 0.2, gain: 0.25 }); a.noise({ dur: 0.2, gain: 0.3, f0: 2500, f1: 300 }); a.tone({ f0: 80, f1: 30, dur: 0.3, gain: 0.55, delay: 0.05 }); } },
  guardBreak:  { gap: 100, max: 1, len: 600, fn: a => { a.noise({ dur: 0.4, gain: 0.45, type: 'highpass', f0: 4000, f1: 800 }); a.tone({ type: 'square', f0: 900, f1: 90, dur: 0.4, gain: 0.2 }); a.tone({ f0: 70, f1: 26, dur: 0.5, gain: 0.6 }); } },
  throw:       { gap: 80, max: 1, len: 400, fn: a => { a.noise({ dur: 0.25, gain: 0.3, f0: 600, f1: 200 }); a.tone({ f0: 100, f1: 36, dur: 0.3, gain: 0.55, delay: 0.04 }); } },
  whoosh:      { gap: 25, max: 4, len: 200, fn: (a, o) => { const h = o.heavy; a.noise({ dur: h ? 0.2 : 0.11, gain: h ? 0.16 : 0.09, f0: h ? 500 : 1100, f1: h ? 1800 : 2600, q: 0.7 }); } },
  jump:        { gap: 80, max: 2, len: 200, fn: a => { a.noise({ dur: 0.12, gain: 0.1, f0: 500, f1: 1500 }); a.tone({ type: 'triangle', f0: 200, f1: 420, dur: 0.1, gain: 0.1 }); } },
  dash:        { gap: 80, max: 2, len: 250, fn: a => { a.noise({ dur: 0.18, gain: 0.2, f0: 900, f1: 2800, q: 0.6 }); a.tone({ type: 'sawtooth', f0: 300, f1: 120, dur: 0.12, gain: 0.07 }); } },
  land:        { gap: 80, max: 2, len: 160, fn: a => { a.noise({ dur: 0.07, gain: 0.18, type: 'lowpass', f0: 600, f1: 200 }); a.tone({ f0: 90, f1: 50, dur: 0.09, gain: 0.25 }); } },
  projectile:  { gap: 100, max: 2, len: 450, fn: a => { a.tone({ type: 'sawtooth', f0: 260, f1: 880, dur: 0.32, gain: 0.16, vib: 18 }); a.tone({ type: 'sine', f0: 130, f1: 440, dur: 0.3, gain: 0.25 }); a.noise({ dur: 0.25, gain: 0.1, f0: 1200, f1: 3000 }); } },
  projectileHit: { gap: 60, max: 2, len: 350, fn: a => { a.noise({ dur: 0.22, gain: 0.35, f0: 2800, f1: 300 }); a.tone({ type: 'sawtooth', f0: 600, f1: 90, dur: 0.22, gain: 0.2 }); a.tone({ f0: 80, f1: 30, dur: 0.3, gain: 0.5 }); } },
  special:     { gap: 100, max: 2, len: 500, fn: a => { a.tone({ type: 'sawtooth', f0: 180, f1: 640, dur: 0.28, gain: 0.18, vib: 10 }); a.noise({ dur: 0.3, gain: 0.2, f0: 600, f1: 3500, q: 0.6 }); a.tone({ f0: 70, f1: 38, dur: 0.35, gain: 0.4, delay: 0.05 }); } },
  ultStart:    { gap: 300, max: 1, len: 1200, fn: a => { a.tone({ type: 'sawtooth', f0: 70, f1: 880, dur: 1.0, gain: 0.22, curve: 'exp' }); a.tone({ type: 'sine', f0: 140, f1: 1760, dur: 1.0, gain: 0.2 }); a.noise({ dur: 1.0, gain: 0.25, type: 'bandpass', f0: 300, f1: 6000, q: 1.5 }); } },
  ultimate:    { gap: 300, max: 1, len: 900, fn: a => { a.tone({ f0: 70, f1: 24, dur: 0.8, gain: 0.8 }); a.noise({ dur: 0.6, gain: 0.5, type: 'lowpass', f0: 4000, f1: 150 }); a.tone({ type: 'sawtooth', f0: 440, f1: 55, dur: 0.5, gain: 0.2 }); } },
  ko:          { gap: 500, max: 1, len: 1400, fn: a => { a.tone({ f0: 60, f1: 20, dur: 1.2, gain: 0.9 }); a.noise({ dur: 0.9, gain: 0.5, type: 'lowpass', f0: 3000, f1: 80 }); a.tone({ type: 'sawtooth', f0: 330, f1: 40, dur: 1.0, gain: 0.18 }); } },
  roundStart:  { gap: 300, max: 1, len: 700, fn: a => { [196, 247, 294].forEach((f, i) => a.tone({ type: 'sawtooth', f0: f, f1: f * 0.98, dur: 0.5, gain: 0.14, delay: i * 0.14 })); a.tone({ f0: 65, f1: 40, dur: 0.6, gain: 0.5 }); } },
  fight:       { gap: 300, max: 1, len: 700, fn: a => { a.tone({ type: 'sawtooth', f0: 98, f1: 196, dur: 0.4, gain: 0.3 }); a.noise({ dur: 0.35, gain: 0.35, f0: 800, f1: 5000, q: 0.7 }); a.tone({ f0: 60, f1: 30, dur: 0.5, gain: 0.7 }); } },
  roundWin:    { gap: 400, max: 1, len: 1200, fn: a => { [330, 392, 494, 659].forEach((f, i) => a.tone({ type: 'triangle', f0: f, f1: f, dur: 0.5, gain: 0.2, delay: i * 0.13 })); a.tone({ f0: 82, f1: 82, dur: 0.9, gain: 0.3 }); } },
  roundLoss:   { gap: 400, max: 1, len: 1200, fn: a => { [330, 294, 247, 196].forEach((f, i) => a.tone({ type: 'sawtooth', f0: f, f1: f * 0.97, dur: 0.55, gain: 0.1, delay: i * 0.18 })); } },
  menuMove:    { gap: 25, max: 3, len: 90, fn: a => { a.tone({ type: 'triangle', f0: 900, f1: 1300, dur: 0.045, gain: 0.1 }); a.noise({ dur: 0.02, gain: 0.08, type: 'highpass', f0: 5000 }); } },
  menuConfirm: { gap: 40, max: 2, len: 250, fn: a => { a.tone({ type: 'triangle', f0: 520, f1: 520, dur: 0.1, gain: 0.16 }); a.tone({ type: 'triangle', f0: 780, f1: 780, dur: 0.16, gain: 0.16, delay: 0.07 }); a.tone({ f0: 100, f1: 70, dur: 0.12, gain: 0.2 }); } },
  menuBack:    { gap: 40, max: 2, len: 200, fn: a => { a.tone({ type: 'triangle', f0: 700, f1: 380, dur: 0.12, gain: 0.13 }); } },
  pause:       { gap: 100, max: 1, len: 300, fn: a => { a.tone({ type: 'sine', f0: 600, f1: 300, dur: 0.2, gain: 0.2 }); } },
  resume:      { gap: 100, max: 1, len: 300, fn: a => { a.tone({ type: 'sine', f0: 300, f1: 600, dur: 0.2, gain: 0.2 }); } },
  unlock:      { gap: 200, max: 1, len: 900, fn: a => { [523, 659, 784, 1047].forEach((f, i) => { a.tone({ type: 'triangle', f0: f, f1: f, dur: 0.35, gain: 0.16, delay: i * 0.09 }); a.tone({ type: 'sine', f0: f * 2, f1: f * 2, dur: 0.25, gain: 0.05, delay: i * 0.09 }); }); } },
  shockwave:   { gap: 120, max: 1, len: 500, fn: a => { a.tone({ f0: 70, f1: 25, dur: 0.5, gain: 0.7 }); a.noise({ dur: 0.35, gain: 0.35, type: 'lowpass', f0: 1800, f1: 100 }); } },
};

// ------------------------------------------------------------------ Music
const NOTE = m => 440 * Math.pow(2, (m - 69) / 12);
const PENT = [0, 3, 5, 7, 10];            // minor pentatonic
const PHRYG = [0, 1, 3, 5, 7, 8, 10];     // phrygian
const AEOL = [0, 2, 3, 5, 7, 8, 10];

export const MOODS = ['menu', 'temple', 'undercity', 'throne', 'reactor'];

class MusicEngine {
  constructor(am) { this.am = am; this.timer = null; this.mood = null; this.bus = null; this.ambNodes = []; this.step = 0; this.bar = 0; }

  play(mood) {
    const am = this.am; if (!am.ready) return;
    if (this.mood === mood && this.timer) return;
    this.stop(0.6);
    const ctx = am.ctx; this.mood = mood; this.cfg = TRACKS[mood] || TRACKS.menu;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.0001; this.bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2); this.bus.connect(am.musicBus);
    this.step = 0; this.bar = 0; this.next = ctx.currentTime + 0.1; this.state = {};
    this.timer = setInterval(() => this._schedule(), 70);
    this._startAmbience(mood);
  }

  stop(fade = 0.5) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const am = this.am; if (!am.ready) return; const t = am.ctx.currentTime;
    const old = this.bus, amb = this.ambNodes; this.bus = null; this.ambNodes = []; this.mood = null;
    if (old) { old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0.0001, t + fade); setTimeout(() => { try { old.disconnect(); } catch { /* ignore */ } }, fade * 1000 + 100); }
    for (const n of amb) { try { n.g.gain.setValueAtTime(n.g.gain.value, t); n.g.gain.linearRampToValueAtTime(0.0001, t + fade); setTimeout(() => { try { n.stop(); } catch { /* ignore */ } }, fade * 1000 + 100); } catch { /* ignore */ } }
  }

  _schedule() {
    const am = this.am; if (!am.ready || !this.bus || am.ctx.state !== 'running') return;
    const spb = 60 / this.cfg.bpm / 4;
    let guard = 0;
    while (this.next < am.ctx.currentTime + 0.3 && guard++ < 16) {
      this.cfg.step(this, this.step % 16, this.next - am.ctx.currentTime, this.bar);
      this.step++; if (this.step % 16 === 0) this.bar++;
      this.next += spb;
    }
  }

  // voices -------------------------------------------------------------------
  kick(d, g = 0.7) { this.am.tone({ f0: 140, f1: 38, dur: 0.22, gain: g, delay: d, dest: this.bus }); this.am.noise({ dur: 0.02, gain: 0.15, f0: 3000, delay: d, dest: this.bus }); }
  taiko(d, g = 0.8) { this.am.tone({ f0: 110, f1: 46, dur: 0.5, gain: g, delay: d, dest: this.bus }); this.am.noise({ dur: 0.1, gain: 0.25, type: 'lowpass', f0: 900, f1: 200, delay: d, dest: this.bus }); }
  hat(d, g = 0.1, open = false) { this.am.noise({ dur: open ? 0.14 : 0.04, gain: g, type: 'highpass', f0: 7000, delay: d, dest: this.bus }); }
  snare(d, g = 0.3) { this.am.noise({ dur: 0.14, gain: g, f0: 1800, q: 0.7, delay: d, dest: this.bus }); this.am.tone({ type: 'triangle', f0: 220, f1: 140, dur: 0.1, gain: g * 0.6, delay: d, dest: this.bus }); }
  wood(d, f = 900, g = 0.18) { this.am.tone({ type: 'square', f0: f, f1: f * 0.8, dur: 0.05, gain: g, delay: d, dest: this.bus }); }
  bass(d, midi, dur = 0.2, g = 0.3, type = 'sawtooth') { this.am.tone({ type, f0: NOTE(midi), f1: NOTE(midi), dur, gain: g, delay: d, dest: this.bus }); this.am.tone({ type: 'sine', f0: NOTE(midi - 12), dur, gain: g * 0.8, delay: d, dest: this.bus }); }
  lead(d, midi, dur = 0.4, g = 0.1, type = 'triangle', vib = 0) { this.am.tone({ type, f0: NOTE(midi), f1: NOTE(midi), dur, gain: g, delay: d, dest: this.bus, vib, attack: 0.02 }); }
  bell(d, midi, g = 0.1) { this.am.tone({ f0: NOTE(midi), dur: 1.6, gain: g, delay: d, dest: this.bus, attack: 0.004 }); this.am.tone({ f0: NOTE(midi) * 2.76, dur: 0.7, gain: g * 0.4, delay: d, dest: this.bus }); }
  pad(d, midi, dur = 3, g = 0.05) { const f = NOTE(midi); [-9, 0, 9].forEach(c => this.am.tone({ type: 'sawtooth', f0: f, dur, gain: g, delay: d, dest: this.bus, detune: c, attack: dur * 0.4 })); }

  _startAmbience(mood) {
    const am = this.am, ctx = am.ctx, cfg = AMBIENCE[mood]; if (!cfg) return;
    const src = ctx.createBufferSource(); src.buffer = am.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    f.type = cfg.type; f.frequency.value = cfg.f; f.Q.value = cfg.q || 1;
    g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(cfg.gain, ctx.currentTime + 2);
    lfo.frequency.value = cfg.lfo; lg.gain.value = cfg.f * 0.35; lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(am.ambBus); src.start(); lfo.start();
    const handle = { g, stop: () => { try { src.stop(); lfo.stop(); src.disconnect(); f.disconnect(); g.disconnect(); lfo.disconnect(); lg.disconnect(); } catch { /* ignore */ } } };
    this.ambNodes.push(handle);
    if (cfg.hum) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = cfg.hum; og.gain.value = 0.0001; og.gain.linearRampToValueAtTime(cfg.humGain, ctx.currentTime + 2);
      o.connect(og); og.connect(am.ambBus); o.start();
      this.ambNodes.push({ g: og, stop: () => { try { o.stop(); o.disconnect(); og.disconnect(); } catch { /* ignore */ } } });
    }
  }
}

const AMBIENCE = {
  menu: { type: 'lowpass', f: 500, lfo: 0.07, gain: 0.25, hum: 55, humGain: 0.09 },
  temple: { type: 'bandpass', f: 700, q: 0.6, lfo: 0.11, gain: 0.35 },       // wind
  undercity: { type: 'bandpass', f: 1800, q: 0.4, lfo: 0.3, gain: 0.22, hum: 60, humGain: 0.07 }, // rain + mains hum
  throne: { type: 'lowpass', f: 260, lfo: 0.05, gain: 0.45, hum: 41, humGain: 0.13 },
  reactor: { type: 'bandpass', f: 400, q: 2, lfo: 0.5, gain: 0.2, hum: 110, humGain: 0.07 },
};

// Each track: bpm + step(engine, stepIndex 0..15, delaySec, barIndex). Patterns are partly generative per bar.
const TRACKS = {
  menu: { bpm: 70, step(m, i, d, bar) {
    if (i === 0) { const root = [45, 45, 41, 43][bar % 4]; m.pad(d, root + 12, 3.6, 0.045); m.pad(d, root + 19, 3.6, 0.03); m.bass(d, root, 1.5, 0.18, 'sine'); }
    if (i % 4 === 0 && Math.random() < 0.55) m.bell(d, 57 + AEOL[Math.floor(Math.random() * 7)] + (Math.random() < 0.3 ? 12 : 0), 0.06);
    if (i === 8) m.taiko(d, 0.25);
  } },
  temple: { bpm: 84, step(m, i, d, bar) {
    if (i === 0 || i === 10) m.taiko(d, i === 0 ? 0.85 : 0.5);
    if (i === 6 && bar % 2) m.wood(d, 1100);
    if (i === 14) m.wood(d, 780, 0.12);
    if (i === 0) m.pad(d, [38, 38, 37, 36][bar % 4] + 12, 2.8, 0.04);
    if (i % 2 === 0 && Math.random() < 0.28) m.lead(d, 62 + PHRYG[Math.floor(Math.random() * 7)] + (bar % 2 ? 0 : 12), 0.7, 0.07, 'sine', 5);
    if (i === 0) m.bass(d, [26, 26, 25, 24][bar % 4], 1.4, 0.2, 'sine');
  } },
  undercity: { bpm: 108, step(m, i, d, bar) {
    if (i % 4 === 0) m.kick(d, 0.6);
    if (i === 4 || i === 12) m.snare(d, 0.22);
    if (i % 2 === 1) m.hat(d, 0.07, i === 15);
    const line = [0, 0, 7, 0, 10, 0, 7, 12, 0, 0, 7, 0, 5, 7, 3, 0];
    const root = [33, 33, 31, 36][bar % 4];
    if (i % 2 === 0 || Math.random() < 0.25) m.bass(d, root + line[i] % 12, 0.14, 0.2);
    if (i === 0) m.pad(d, root + 24, 1.8, 0.03);
    if (i % 8 === 6 && Math.random() < 0.6) m.lead(d, root + 36 + PENT[Math.floor(Math.random() * 5)], 0.2, 0.05, 'square');
  } },
  throne: { bpm: 66, step(m, i, d, bar) {
    if (i === 0) { m.taiko(d, 0.95); m.pad(d, 38, 3.8, 0.05); m.pad(d, 45, 3.8, 0.04); m.bass(d, 26, 3.6, 0.22, 'sawtooth'); }
    if (i === 8) m.taiko(d, 0.7);
    if (i === 12 && bar % 2) m.taiko(d, 0.45);
    if (i === 4 && bar % 4 === 3) m.lead(d, 62 + PHRYG[Math.floor(Math.random() * 7)], 1.4, 0.08, 'sawtooth', 3);
    if (i === 0 && bar % 4 === 0) m.bell(d, 74, 0.07);
  } },
  reactor: { bpm: 128, step(m, i, d, bar) {
    if (i % 4 === 0) m.kick(d, 0.65);
    if (i === 4 || i === 12) m.snare(d, 0.2);
    m.hat(d, i % 2 ? 0.08 : 0.04);
    const root = [36, 36, 34, 39][bar % 4];
    if (i % 2 === 0) m.bass(d, root, 0.11, 0.22, 'square');
    const arp = [0, 7, 12, 15, 12, 7, 3, 7];
    m.lead(d, root + 24 + arp[i % 8], 0.1, 0.045, 'sawtooth');
    if (i === 0) m.pad(d, root + 24, 1.9, 0.03);
  } },
};
