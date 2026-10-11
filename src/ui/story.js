// Story and arcade content: rival order, dialogue, boss encounter and per-fighter endings.
import { ROSTER, BY_ID } from '../characters/roster.js';

export const LORE = [
  'Beneath every forgotten temple, every drowned city and every dead machine runs the Veil.',
  'It is a current older than the orders that learned to wear it.',
  'Whoever commands the Veil commands what is left of the world.',
  'Every cycle, the orders meet in the Blood Circuit to decide who that will be.',
];

// Story: three rivals then the Veil Sovereign. `lines` are [speakerId|'narr', text].
const RIVALS = {
  kael: ['vex', 'bram', 'nyra'], nyra: ['sera', 'sora', 'kael'], bram: ['kael', 'vex', 'sora'],
  sora: ['nyra', 'bram', 'sera'], vex: ['sora', 'sera', 'bram'], sera: ['bram', 'kael', 'vex'],
};
const STAGE_ORDER = { kael: [0, 1, 3, 2], nyra: [1, 0, 3, 2], bram: [3, 1, 0, 2], sora: [0, 3, 1, 2], vex: [3, 1, 0, 2], sera: [2, 0, 3, 2] };
const BOSS_OF = id => (id === 'sera' ? 'kael' : 'sera');

export function storyRun(id) {
  const me = BY_ID[id], rivals = RIVALS[id], stages = STAGE_ORDER[id];
  const fights = rivals.map((r, i) => ({
    opp: r, stage: stages[i], boss: false, difficulty: ['easy', 'normal', 'hard'][i],
    pre: [[id, me.intro], [r, BY_ID[r].intro]],
    post: [[r, i === 2 ? 'You fight like someone with a reason. Go on. He is waiting.' : 'Then the Circuit has not changed. Keep walking.']],
  }));
  const boss = BOSS_OF(id);
  fights.push({
    opp: boss, stage: stages[3], boss: true, difficulty: 'expert',
    pre: [['narr', 'The Obsidian Throne is occupied. The Veil Sovereign wears a face you almost recognise.'], [boss, 'Every champion arrives believing they are the first. You are the ' + (Math.floor(Math.random() * 40) + 60) + 'th.'], [id, 'Then I am the last.']],
    post: [],
  });
  return { fights, ending: me.ending, final: true };
}

// Arcade: four random opponents then the boss. Opponent ladder shown between fights.
export function arcadeRun(id) {
  const others = ROSTER.map(c => c.id).filter(c => c !== id).sort(() => Math.random() - 0.5).slice(0, 4);
  const stages = [0, 1, 3, 0, 2].sort(() => Math.random() - 0.5);
  const diffs = ['easy', 'normal', 'normal', 'hard', 'expert'];
  const fights = others.map((o, i) => ({ opp: o, stage: stages[i], boss: false, difficulty: diffs[i], pre: [], post: [] }));
  fights.push({ opp: BOSS_OF(id), stage: 2, boss: true, difficulty: 'expert', pre: [], post: [] });
  return { fights, ending: null, final: true };
}

export const CREDITS = [
  ['IRON VEIL: BLOOD CIRCUIT', ''],
  ['Game Direction & Design', 'Independent studio build'],
  ['Combat Engine', 'Fixed-step 60 Hz fighter state machine, frame data, hit registry'],
  ['Character Art & Animation', 'Procedural layered-skeleton renderer, six original costumes'],
  ['Arenas & Effects', 'Layered parallax scenes, pooled particle system'],
  ['Audio', 'Web Audio API synthesis: every effect and track generated live'],
  ['Voice', 'Synthesized vocal-style cues and text callouts - no recorded speech'],
  ['Everything is original', 'No third-party art, music or code is used'],
];
