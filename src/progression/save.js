// Versioned, validated offline save data: settings, statistics, cosmetics and achievements.
import { ROSTER } from '../characters/roster.js';
import { DEFAULT_BINDINGS, validateBindings } from '../input/input.js';
import { CFG } from '../config.js';

export const SAVE_KEY = 'ironveil.save';
export const SAVE_VERSION = 1;

export const ACHIEVEMENTS = [
  { id: 'first_victory', name: 'First Victory', desc: 'Win your first match.' },
  { id: 'streak5', name: 'Five Consecutive Wins', desc: 'Win five matches in a row.' },
  { id: 'counter_specialist', name: 'Counter Specialist', desc: 'Land 10 counter hits (total).' },
  { id: 'combo_initiate', name: 'Combo Initiate', desc: 'Land a 4-hit combo.' },
  { id: 'combo_master', name: 'Combo Master', desc: 'Land an 8-hit combo.' },
  { id: 'perfect_defense', name: 'Perfect Defense', desc: 'Parry 10 attacks (total).' },
  { id: 'flawless', name: 'Flawless', desc: 'Win a match without losing a round.' },
  { id: 'arcade_champion', name: 'Arcade Champion', desc: 'Complete Arcade mode.' },
  { id: 'master_of_veil', name: 'Master of the Veil', desc: 'Win a match with all six fighters.' },
];

export function defaultSave() {
  const unlocked = {}, equipped = {};
  for (const c of ROSTER) { unlocked[c.id] = [0]; equipped[c.id] = 0; }
  return {
    version: SAVE_VERSION,
    settings: {
      master: 0.8, music: 0.55, sfx: 0.9, ambient: 0.5, shake: 1, reduceFx: false, reduceFlash: false, motion: 1, bgMotion: 1,
      difficulty: CFG.DEFAULTS.difficulty, roundTime: CFG.DEFAULTS.roundTime, roundsToWin: CFG.DEFAULTS.roundsToWin,
      quality: 'high', guideSeen: false, highContrast: false, bigText: false, bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
    },
    stats: { played: 0, won: 0, lost: 0, streak: 0, bestStreak: 0, winsBy: {}, playsBy: {}, maxCombo: 0, parries: 0, counters: 0, trainingSeconds: 0, arcadeClears: {}, storyClears: {}, totalDamage: 0 },
    skins: { unlocked, equipped },
    achievements: {},
  };
}

const clamp01 = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const num = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

// Rebuilds a safe save from arbitrary parsed JSON. Never throws.
export function validateSave(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) return d;
  try {
    const s = raw.settings || {}, o = d.settings;
    o.master = clamp01(s.master, o.master); o.music = clamp01(s.music, o.music); o.sfx = clamp01(s.sfx, o.sfx); o.ambient = clamp01(s.ambient, o.ambient);
    o.shake = num(s.shake, o.shake, 0, 1); o.motion = num(s.motion, o.motion, 0, 1); o.bgMotion = num(s.bgMotion, o.bgMotion, 0, 1);
    o.highContrast = bool(s.highContrast, false); o.bigText = bool(s.bigText, false); o.reduceFx = bool(s.reduceFx, false); o.reduceFlash = bool(s.reduceFlash, false); o.guideSeen = bool(s.guideSeen, false);
    o.difficulty = ['easy', 'normal', 'hard', 'expert'].includes(s.difficulty) ? s.difficulty : o.difficulty;
    o.roundTime = [30, 60, 99].includes(s.roundTime) ? s.roundTime : o.roundTime;
    o.roundsToWin = [1, 2, 3].includes(s.roundsToWin) ? s.roundsToWin : o.roundsToWin;
    o.quality = ['low', 'high'].includes(s.quality) ? s.quality : o.quality;
    o.bindings = validateBindings(s.bindings);
    const st = raw.stats || {}, t = d.stats;
    for (const k of ['played', 'won', 'lost', 'streak', 'bestStreak', 'maxCombo', 'parries', 'counters', 'trainingSeconds', 'totalDamage']) t[k] = num(st[k], 0, 0, 1e9);
    for (const k of ['winsBy', 'playsBy', 'arcadeClears', 'storyClears']) if (st[k] && typeof st[k] === 'object') for (const c of ROSTER) t[k][c.id] = num(st[k][c.id], 0, 0, 1e7);
    const sk = raw.skins || {};
    for (const c of ROSTER) {
      const list = sk.unlocked && Array.isArray(sk.unlocked[c.id]) ? sk.unlocked[c.id] : [0];
      d.skins.unlocked[c.id] = [...new Set([0, ...list.filter(i => Number.isInteger(i) && i >= 0 && i < c.skins.length)])];
      const eq = sk.equipped ? sk.equipped[c.id] : 0;
      d.skins.equipped[c.id] = d.skins.unlocked[c.id].includes(eq) ? eq : 0;
    }
    if (raw.achievements && typeof raw.achievements === 'object') for (const a of ACHIEVEMENTS) if (raw.achievements[a.id] === true) d.achievements[a.id] = true;
    return d;
  } catch { return defaultSave(); }
}

export class SaveManager {
  constructor(storage, opts = {}) {
    this.storage = storage || null; this.unlockAll = !!opts.unlockAll;
    this.data = this.load();
  }
  load() {
    try {
      const txt = this.storage && this.storage.getItem(SAVE_KEY);
      if (!txt) return defaultSave();
      return validateSave(JSON.parse(txt));
    } catch { return defaultSave(); }
  }
  save() { try { if (this.storage) this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); return true; } catch { return false; } }
  get settings() { return this.data.settings; }
  setSetting(k, v) { this.data.settings[k] = v; this.save(); }
  restoreDefaults() { this.data.settings = defaultSave().settings; this.data.settings.guideSeen = true; this.save(); }
  resetProgress() { const keep = this.data.settings; this.data = defaultSave(); this.data.settings = keep; this.save(); }

  isUnlocked(charId, skin) { return this.unlockAll || this.data.skins.unlocked[charId].includes(skin); }
  equip(charId, skin) {
    if (!this.isUnlocked(charId, skin)) return false;
    this.data.skins.equipped[charId] = skin; this.save(); return true;
  }
  equipped(charId) { return this.data.skins.equipped[charId] || 0; }
  unlock(charId, skin) { const l = this.data.skins.unlocked[charId]; if (!l.includes(skin)) { l.push(skin); return true; } return false; }

  // Called when a match ends. result: { p1Id, p2Id, winner (0|1|-1), vsCPU, mode, stats:[{maxCombo,parries,counters,dealt}], flawless }
  // Returns notifications: [{kind:'skin'|'achievement', text}]
  recordMatch(r) {
    const notes = [], st = this.data.stats;
    const human = r.humanIndex ?? 0;
    const hid = human === 0 ? r.p1Id : r.p2Id;
    st.played++; st.playsBy[hid] = (st.playsBy[hid] || 0) + 1;
    const won = r.winner === human;
    if (r.winner >= 0 && r.countsAsWin !== false) {
      if (won) { st.won++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); st.winsBy[hid] = (st.winsBy[hid] || 0) + 1; }
      else { st.lost++; st.streak = 0; }
    }
    for (const s of r.stats) { st.maxCombo = Math.max(st.maxCombo, s.maxCombo || 0); st.parries += s.parries || 0; st.counters += s.counters || 0; st.totalDamage += s.dealt || 0; }
    if (r.mode === 'arcade' && r.arcadeCleared && won) st.arcadeClears[hid] = (st.arcadeClears[hid] || 0) + 1;
    if (r.mode === 'story' && r.storyCleared && won) { st.storyClears[hid] = (st.storyClears[hid] || 0) + 1; st.arcadeClears[hid] = (st.arcadeClears[hid] || 0) + 1; }
    notes.push(...this.checkUnlocks());
    const give = (id) => { if (!this.data.achievements[id]) { this.data.achievements[id] = true; notes.push({ kind: 'achievement', text: ACHIEVEMENTS.find(a => a.id === id).name }); } };
    if (st.won >= 1) give('first_victory');
    if (st.bestStreak >= 5) give('streak5');
    if (st.counters >= 10) give('counter_specialist');
    if (st.maxCombo >= 4) give('combo_initiate');
    if (st.maxCombo >= 8) give('combo_master');
    if (st.parries >= 10) give('perfect_defense');
    if (won && r.flawless) give('flawless');
    if (Object.values(st.arcadeClears).some(v => v > 0)) give('arcade_champion');
    if (ROSTER.every(c => (st.winsBy[c.id] || 0) > 0)) give('master_of_veil');
    this.save();
    return notes;
  }

  checkUnlocks() {
    const notes = [], st = this.data.stats;
    for (const c of ROSTER) c.skins.forEach((sk, i) => {
      if (!sk.unlock) return;
      const ok = sk.unlock.type === 'wins' ? (st.winsBy[c.id] || 0) >= sk.unlock.n : (st.arcadeClears[c.id] || 0) > 0;
      if (ok && this.unlock(c.id, i)) notes.push({ kind: 'skin', text: `${c.name}: ${sk.name} unlocked` });
    });
    return notes;
  }
}
