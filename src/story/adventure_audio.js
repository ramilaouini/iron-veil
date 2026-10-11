// Extended procedural soundtracks and SFX for Story/Adventure Mode.
// Generates rich multi-instrument synth music for every sector, mini-boss, and final boss,
// plus Mario/platformer/arcade sound effects (coins, springs, checkpoints, quests, lasers, breakables).

const NOTE = m => 440 * Math.pow(2, (m - 69) / 12);
const PENT = [0, 3, 5, 7, 10];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

export function registerAdventureAudio(am) {
  if (!am) return;

  // ------------------------------------------------------------------ Adventure SFX
  const advSfx = {
    shard: {
      gap: 30, max: 8, len: 160,
      fn: a => {
        const pitch = 880 + Math.random() * 440;
        a.tone({ type: 'sine', f0: pitch, f1: pitch * 1.5, dur: 0.12, gain: 0.18 });
        a.tone({ type: 'triangle', f0: pitch * 2, f1: pitch * 2, dur: 0.08, gain: 0.08, delay: 0.02 });
      }
    },
    spring: {
      gap: 80, max: 2, len: 350,
      fn: a => {
        a.tone({ type: 'sine', f0: 160, f1: 820, dur: 0.28, gain: 0.35, curve: 'exp' });
        a.noise({ dur: 0.1, gain: 0.15, f0: 1200, f1: 3000 });
      }
    },
    checkpoint: {
      gap: 200, max: 1, len: 800,
      fn: a => {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          a.tone({ type: 'triangle', f0: f, f1: f, dur: 0.45, gain: 0.2, delay: i * 0.08 });
          a.tone({ type: 'sine', f0: f * 1.5, dur: 0.3, gain: 0.06, delay: i * 0.08 });
        });
      }
    },
    terminal: {
      gap: 150, max: 1, len: 400,
      fn: a => {
        a.tone({ type: 'square', f0: 880, f1: 1320, dur: 0.08, gain: 0.12 });
        a.tone({ type: 'sine', f0: 1760, f1: 1760, dur: 0.15, gain: 0.1, delay: 0.08 });
      }
    },
    questComplete: {
      gap: 400, max: 1, len: 1200,
      fn: a => {
        [440, 554, 659, 880, 1108].forEach((f, i) => {
          a.tone({ type: 'triangle', f0: f, f1: f, dur: 0.5, gain: 0.25, delay: i * 0.1 });
          a.tone({ type: 'sawtooth', f0: f / 2, dur: 0.3, gain: 0.1, delay: i * 0.1 });
        });
        a.noise({ dur: 0.2, gain: 0.2, f0: 2500, f1: 5000, delay: 0.4 });
      }
    },
    crateBreak: {
      gap: 40, max: 3, len: 250,
      fn: a => {
        a.noise({ dur: 0.18, gain: 0.45, type: 'lowpass', f0: 1200, f1: 150 });
        a.tone({ type: 'square', f0: 180, f1: 45, dur: 0.14, gain: 0.3 });
      }
    },
    laserZap: {
      gap: 50, max: 4, len: 200,
      fn: a => {
        a.tone({ type: 'sawtooth', f0: 1200, f1: 220, dur: 0.12, gain: 0.22, curve: 'exp' });
        a.noise({ dur: 0.06, gain: 0.15, f0: 3500 });
      }
    },
    cageBreak: {
      gap: 200, max: 1, len: 600,
      fn: a => {
        a.tone({ type: 'sine', f0: 320, f1: 120, dur: 0.3, gain: 0.5 });
        a.noise({ dur: 0.35, gain: 0.4, type: 'bandpass', f0: 2800, f1: 600 });
        a.tone({ type: 'triangle', f0: 900, f1: 1400, dur: 0.25, gain: 0.2, delay: 0.1 });
      }
    },
    bossAlarm: {
      gap: 500, max: 1, len: 1400,
      fn: a => {
        for (let i = 0; i < 3; i++) {
          a.tone({ type: 'sawtooth', f0: 440, f1: 330, dur: 0.25, gain: 0.28, delay: i * 0.35 });
          a.tone({ type: 'square', f0: 880, f1: 660, dur: 0.15, gain: 0.12, delay: i * 0.35 });
        }
      }
    },
    victoryFanfare: {
      gap: 500, max: 1, len: 2200,
      fn: a => {
        const chord1 = [261.6, 329.6, 392.0, 523.2];
        const chord2 = [349.2, 440.0, 523.2, 698.4];
        const chord3 = [392.0, 493.8, 587.3, 783.9];
        const chord4 = [523.2, 659.2, 783.9, 1046.5];
        [chord1, chord2, chord3, chord4].forEach((ch, idx) => {
          ch.forEach(f => a.tone({ type: 'triangle', f0: f, f1: f, dur: idx === 3 ? 1.0 : 0.3, gain: 0.2, delay: idx * 0.32 }));
        });
        a.tone({ f0: 130, f1: 130, dur: 1.4, gain: 0.4, delay: 0.96 });
      }
    },
  };

  // Register SFX dynamically onto AudioManager
  try {
    for (const [k, v] of Object.entries(advSfx)) {
      if (!am.active.has(k)) {
        am.active.set(k, 0);
        am.lastPlayed.set(k, 0);
      }
      // Add definition to SFX table if accessible
      SFX_REGISTRY[k] = v;
    }
  } catch (e) {
    console.warn('Extended SFX registration', e);
  }

  // ------------------------------------------------------------------ Adventure Tracks
  TRACK_REGISTRY['story_neon'] = {
    bpm: 116,
    step(m, i, d, bar) {
      // Driving 80s/90s Synthwave for Sector 1 (Neon Outskirts)
      if (i % 4 === 0) m.kick(d, 0.7);
      if (i === 4 || i === 12) m.snare(d, 0.26);
      m.hat(d, i % 2 === 1 ? 0.09 : 0.04, i === 15);
      const root = [36, 36, 41, 39][bar % 4];
      const bassPattern = [0, 0, 12, 0, 7, 0, 10, 0, 0, 0, 12, 0, 5, 7, 3, 0];
      if (i % 2 === 0 || Math.random() < 0.2) m.bass(d, root + bassPattern[i], 0.13, 0.25, 'sawtooth');
      if (i === 0) {
        m.pad(d, root + 12, 3.2, 0.04);
        m.pad(d, root + 19, 3.2, 0.03);
      }
      // Melodic synth lead
      const melody = [60, 63, 67, 70, 67, 63, 65, 62];
      if (i % 2 === 0 && (bar % 2 === 1 || i % 4 === 0)) {
        m.lead(d, melody[(i / 2 + bar * 2) % melody.length], 0.22, 0.08, 'triangle', 4);
      }
    }
  };

  TRACK_REGISTRY['story_aqueduct'] = {
    bpm: 98,
    step(m, i, d, bar) {
      // Moody watery ambient electro-funk for Sector 2 (Aqueducts)
      if (i === 0 || i === 8 || i === 10) m.kick(d, 0.55);
      if (i === 4 || i === 12) m.snare(d, 0.2);
      if (i % 2 === 1) m.hat(d, 0.06);
      const root = [33, 33, 36, 38][bar % 4];
      if (i % 4 === 0 || i % 4 === 2) m.bass(d, root + (i === 6 ? 7 : 0), 0.25, 0.22, 'sine');
      if (i === 0) {
        m.pad(d, root + 24, 3.5, 0.035);
        m.bell(d, root + 36, 0.08);
      }
      if (i === 6 || i === 14) m.bell(d, root + 36 + PHRYG[(bar + i) % 7], 0.05);
      if (i === 10 && bar % 2) m.lead(d, root + 48 + PHRYG[Math.floor(Math.random() * 7)], 0.5, 0.06, 'sine', 6);
    }
  };

  TRACK_REGISTRY['story_foundry'] = {
    bpm: 130,
    step(m, i, d, bar) {
      // Industrial heavy metal-synth for Sector 3 (Foundry)
      if (i % 4 === 0) m.kick(d, 0.85);
      if (i === 4 || i === 12) m.snare(d, 0.35);
      m.hat(d, 0.07);
      if (i === 2 || i === 10) m.taiko(d, 0.6);
      const root = [34, 34, 32, 37][bar % 4];
      // Fast chugging metal bass
      m.bass(d, root + (i % 4 === 0 ? 0 : i % 2 === 0 ? 7 : 0), 0.09, 0.32, 'sawtooth');
      if (i === 0) m.pad(d, root + 12, 1.8, 0.05);
      // High screaming arpeggio
      const arp = [0, 12, 3, 12, 7, 12, 10, 12];
      m.lead(d, root + 36 + arp[i % 8], 0.08, 0.06, 'sawtooth');
    }
  };

  TRACK_REGISTRY['story_spire'] = {
    bpm: 122,
    step(m, i, d, bar) {
      // Grand celestial cathedral ascension synth for Sector 4 (Spire)
      if (i % 4 === 0) m.kick(d, 0.65);
      if (i === 4 || i === 12) m.snare(d, 0.25);
      if (i % 2 === 1) m.hat(d, 0.06);
      if (i === 0) m.taiko(d, 0.8);
      const root = [38, 41, 43, 45][bar % 4];
      if (i % 2 === 0) m.bass(d, root, 0.15, 0.22, 'sine');
      if (i === 0) {
        m.pad(d, root + 12, 3.2, 0.06);
        m.pad(d, root + 19, 3.2, 0.04);
        m.bell(d, root + 36, 0.09);
      }
      // Heroic triumphant fanfare lead
      const melody = [62, 65, 69, 72, 74, 72, 69, 65];
      if (i % 4 === 0) m.lead(d, melody[(i / 4 + bar) % melody.length], 0.45, 0.09, 'triangle', 4);
    }
  };

  TRACK_REGISTRY['story_boss'] = {
    bpm: 136,
    step(m, i, d, bar) {
      // High-intensity boss battle combat theme
      if (i % 4 === 0 || i === 2 || i === 10) m.kick(d, 0.9);
      if (i === 4 || i === 12) m.snare(d, 0.38);
      m.hat(d, 0.08, i % 4 === 2);
      if (i === 0 || i === 8) m.taiko(d, 0.7);
      const root = [31, 31, 29, 34][bar % 4];
      m.bass(d, root + (i % 2 ? 12 : 0), 0.1, 0.35, 'sawtooth');
      if (i === 0) m.pad(d, root + 12, 1.6, 0.06);
      // Urgent siren-like arpeggio
      const siren = [67, 70, 72, 75, 74, 72, 70, 67];
      m.lead(d, siren[i % 8], 0.1, 0.07, 'sawtooth');
    }
  };

  TRACK_REGISTRY['story_miniboss'] = {
    bpm: 126,
    step(m, i, d, bar) {
      if (i % 4 === 0) m.kick(d, 0.75);
      if (i === 4 || i === 12) m.snare(d, 0.3);
      m.hat(d, 0.07);
      if (i === 0) m.taiko(d, 0.65);
      const root = [33, 33, 36, 31][bar % 4];
      if (i % 2 === 0) m.bass(d, root + (i === 8 ? 7 : 0), 0.12, 0.28, 'square');
      if (i % 4 === 0) m.lead(d, root + 36 + PENT[Math.floor(Math.random() * 5)], 0.25, 0.07, 'triangle');
    }
  };
}

// Global registry caches so audio manager references them
export const SFX_REGISTRY = {};
export const TRACK_REGISTRY = {};
