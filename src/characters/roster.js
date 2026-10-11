// Fighter definitions: stats, proportions, palettes (skins), and full move tables.
// Box coords: x = offset forward of fighter origin, y = height of box TOP above floor, w/h in px.
// Frame counts are 60 Hz sim frames.

const BASE = (id, name, o) => ({
  id, name, rank: 1, level: 'mid', anim: id,
  startup: 6, active: 3, recovery: 10, damage: 30,
  box: { x: 20, y: 140, w: 60, h: 30 },
  pushback: 4, hitstun: 14, blockstun: 9, hitstop: 5,
  guardDmg: 12, sfx: 'lightPunch', fx: 'spark',
  ...o,
});

// Default normals (tuned around Kael). Each fighter overrides numbers per move, so frame data differs.
function normals(ov = {}) {
  const d = {
    lp: BASE('lp', 'Light Punch', { startup: 5, active: 3, recovery: 8, damage: 32, level: 'high', box: { x: 18, y: 150, w: 56, h: 30 }, hitstun: 14, blockstun: 9, sfx: 'lightPunch' }),
    hp: BASE('hp', 'Heavy Punch', { rank: 2, startup: 11, active: 4, recovery: 17, damage: 75, level: 'mid', box: { x: 20, y: 150, w: 72, h: 36 }, pushback: 9, hitstun: 22, blockstun: 12, hitstop: 8, guardDmg: 20, sfx: 'heavyPunch', fx: 'heavy' }),
    lk: BASE('lk', 'Light Kick', { startup: 7, active: 3, recovery: 10, damage: 38, level: 'mid', box: { x: 20, y: 105, w: 66, h: 34 }, hitstun: 15, blockstun: 10, sfx: 'lightKick' }),
    hk: BASE('hk', 'Heavy Kick', { rank: 2, startup: 14, active: 4, recovery: 21, damage: 82, level: 'mid', box: { x: 20, y: 125, w: 86, h: 40 }, pushback: 12, hitstun: 24, blockstun: 13, hitstop: 9, guardDmg: 22, sfx: 'heavyKick', fx: 'heavy' }),
    cl: BASE('cl', 'Crouch Jab', { crouch: true, startup: 5, active: 3, recovery: 9, damage: 26, level: 'mid', box: { x: 18, y: 100, w: 54, h: 28 }, hitstun: 13, blockstun: 8 }),
    ck: BASE('ck', 'Low Kick', { crouch: true, startup: 8, active: 3, recovery: 12, damage: 34, level: 'low', box: { x: 20, y: 36, w: 70, h: 30 }, hitstun: 14, blockstun: 10, sfx: 'lightKick' }),
    up: BASE('up', 'Rising Strike', { rank: 2, crouch: true, startup: 9, active: 5, recovery: 26, damage: 70, level: 'mid', box: { x: 10, y: 205, w: 62, h: 120 }, pushback: 4, hitstun: 30, blockstun: 16, hitstop: 9, launch: 12.5, guardDmg: 22, sfx: 'heavyPunch', fx: 'heavy' }),
    sw: BASE('sw', 'Sweep', { rank: 2, crouch: true, startup: 12, active: 4, recovery: 26, damage: 60, level: 'low', box: { x: 10, y: 34, w: 100, h: 30 }, pushback: 8, hitstun: 30, blockstun: 12, hitstop: 8, knockdown: true, guardDmg: 20, sfx: 'heavyKick', fx: 'heavy' }),
    ap: BASE('ap', 'Jump Punch', { air: true, startup: 4, active: 10, recovery: 4, damage: 44, level: 'overhead', box: { x: 14, y: 90, w: 60, h: 60 }, hitstun: 17, blockstun: 12, sfx: 'lightPunch' }),
    ak: BASE('ak', 'Jump Kick', { air: true, startup: 5, active: 12, recovery: 4, damage: 52, level: 'overhead', box: { x: 14, y: 40, w: 72, h: 60 }, hitstun: 18, blockstun: 12, sfx: 'lightKick' }),
    th: BASE('th', 'Throw', { rank: 2, throw: true, startup: 6, active: 2, recovery: 26, damage: 90, level: 'throw', box: { x: 0, y: 150, w: 82, h: 120 }, hitstun: 0, blockstun: 0, hitstop: 8, guardDmg: 0, knockdown: true, sfx: 'heavyPunch', fx: 'heavy' }),
  };
  for (const k of Object.keys(ov)) {
    const o = ov[k];
    d[k] = { ...d[k], ...o, box: o.box ? { ...d[k].box, ...o.box } : d[k].box };
  }
  return d;
}

const SK = (name, pal, unlock) => ({ name, pal, unlock });
const P = (skin, armor, armor2, cloth, trim, glow, hair, extra = {}) => ({ skin, armor, armor2, cloth, trim, glow, hair, ...extra });

export const ROSTER = [
  {
    id: 'kael', name: 'Kael Voss', title: 'The Iron Wraith', style: 'Balanced Martial Artist',
    bio: 'Former wall-guard of the Cinder Gate. Kael wears the plate of a dead order and fights with the discipline that outlived it. He entered the Blood Circuit to find who sold the Veil to the Foundry.',
    quote: 'Discipline outlasts fury.', intro: 'The Gate is closed. You are the last thing outside it.',
    ending: 'Kael seals the Veil conduit with his own armor. The Cinder Gate stands again - with one man behind it.',
    stats: { hp: 1000, walk: 3.6, back: 2.8, jump: 14.5, dash: 9, weight: 1 },
    prop: { s: 1, torso: 54, torsoW: 36, shoulderW: 14, thigh: 50, shin: 52, uarm: 34, farm: 34, head: 15, limb: 11 },
    skins: [
      SK('Iron Wraith', P('#c9a789', '#3a3d45', '#6d737d', '#a3122c', '#9aa3ad', '#ff3a3a', '#1a1a20'), null),
      SK('Whiteout Sentinel', P('#d8c3b0', '#cfd6de', '#8fa3b8', '#5b8dc9', '#ffffff', '#8fd3ff', '#e8eef5'), { type: 'wins', n: 3, label: 'Win 3 matches as Kael' }),
      SK('Eclipse Ronin', P('#b89475', '#16161b', '#2c2c35', '#101014', '#c9a24a', '#e8c15a', '#0d0d10'), { type: 'arcade', label: 'Complete Arcade as Kael' }),
    ],
    moves: {
      ...normals({}),
      sp1: BASE('sp1', 'Iron Breaker', { rank: 3, anim: 'spA', startup: 12, active: 5, recovery: 22, damage: 130, level: 'mid', box: { x: 22, y: 160, w: 90, h: 70 }, pushback: 14, hitstun: 28, blockstun: 12, hitstop: 11, move: { vx: 6.5, from: 6, to: 17 }, knockdown: true, chip: true, guardDmg: 28, sfx: 'special', fx: 'heavy' }),
      sp2: BASE('sp2', 'Veil Pulse', { rank: 3, anim: 'spB', startup: 13, active: 1, recovery: 22, damage: 70, level: 'mid', box: { x: 0, y: 0, w: 0, h: 0 }, projectile: { frame: 13, vx: 9, life: 16, w: 82, h: 80, y: 140, ox: 70, dmg: 70, hitstun: 22, blockstun: 13, hitstop: 8, color: '#ff4040', kind: 'burst', pushback: 10 }, sfx: 'projectile', fx: 'energy' }),
      ult: BASE('ult', 'Wraith Requiem', { rank: 4, anim: 'ult', ultimate: true, startup: 30, active: 40, recovery: 30, damage: 48, finalDamage: 130, interval: 8, level: 'mid', box: { x: 20, y: 170, w: 130, h: 120 }, pushback: 1, hitstun: 20, blockstun: 10, hitstop: 5, move: { vx: 4, from: 30, to: 62 }, invuln: [0, 30], knockdown: false, finalKnockdown: true, guardDmg: 40, sfx: 'ultimate', fx: 'heavy' }),
    },
  },
  {
    id: 'nyra', name: 'Nyra Vex', title: 'The Ashen Dancer', style: 'Fast Rushdown',
    bio: 'A courier of the Ash Lantern troupe who learned that the Veil bends around anything moving fast enough. Nyra never stands still, because standing still is how her troupe died.',
    quote: 'Catch me. Go on.', intro: 'The lanterns are lit. Try to keep up.',
    ending: 'Nyra burns the Circuit ledgers. Without names to hunt, her troupe finally rests.',
    stats: { hp: 920, walk: 4.9, back: 3.8, jump: 16.5, dash: 12, weight: 0.92 },
    prop: { s: 0.96, torso: 48, torsoW: 28, shoulderW: 11, thigh: 56, shin: 58, uarm: 32, farm: 32, head: 14, limb: 9 },
    skins: [
      SK('Ashen Dancer', P('#c79a86', '#26222e', '#4b4458', '#2a2236', '#c4c9d4', '#b46bff', '#1c1424'), null),
      SK('Neon Phantom', P('#cfae9a', '#2b2e33', '#4a4f57', '#1f2226', '#9ee8ff', '#22e6ff', '#10151a'), { type: 'wins', n: 3, label: 'Win 3 matches as Nyra' }),
      SK('Scarlet Mirage', P('#c99f8a', '#b01e32', '#d9dce3', '#7d1020', '#e6e9ef', '#ffd0d8', '#2a0c12'), { type: 'arcade', label: 'Complete Arcade as Nyra' }),
    ],
    moves: {
      ...normals({
        lp: { startup: 4, damage: 26, recovery: 7, hitstun: 13, blockstun: 8, box: { w: 50 } },
        hp: { startup: 9, recovery: 14, damage: 62, box: { w: 66 } },
        lk: { startup: 5, active: 3, recovery: 8, damage: 34, hitstun: 14, blockstun: 9, box: { w: 76 } },
        hk: { startup: 11, recovery: 18, damage: 74, box: { y: 150, w: 100, h: 34 }, pushback: 11 },
        cl: { startup: 4, damage: 22 },
        ck: { startup: 6, damage: 30, box: { w: 80 } },
        up: { startup: 8, recovery: 22, damage: 62, launch: 13.5 },
        sw: { startup: 10, recovery: 22, damage: 52, box: { w: 110 } },
        ap: { damage: 40 }, ak: { damage: 46, box: { w: 84 } },
        th: { damage: 70, startup: 7 },
      }),
      sp1: BASE('sp1', 'Ash Spiral', { rank: 3, anim: 'spA', startup: 10, active: 14, recovery: 22, damage: 38, interval: 5, finalDamage: 54, level: 'mid', box: { x: 0, y: 160, w: 100, h: 100 }, pushback: 2, hitstun: 18, blockstun: 10, hitstop: 4, move: { vx: 3.2, from: 10, to: 24 }, finalKnockdown: true, chip: true, guardDmg: 16, sfx: 'special', fx: 'spark' }),
      sp2: BASE('sp2', 'Phantom Step', { rank: 3, anim: 'spB', evade: true, noHit: true, startup: 2, active: 14, recovery: 10, damage: 0, box: { x: 0, y: 0, w: 0, h: 0 }, move: { vx: 11, from: 2, to: 13, byDir: true }, invuln: [2, 14], cancelFrom: [9, 20], sfx: 'dash', fx: 'trail' }),
      ult: BASE('ult', 'Cinder Flurry', { rank: 4, anim: 'ult', ultimate: true, startup: 26, active: 44, recovery: 28, damage: 40, finalDamage: 125, interval: 6, level: 'mid', box: { x: 10, y: 170, w: 120, h: 130 }, pushback: 0, hitstun: 16, blockstun: 9, hitstop: 4, move: { vx: 6, from: 26, to: 40 }, invuln: [0, 26], finalKnockdown: true, guardDmg: 35, sfx: 'ultimate', fx: 'spark' }),
    },
  },
  {
    id: 'bram', name: 'Bram Korr', title: 'The Titan', style: 'Heavy Grappler',
    bio: 'Foundry-forged, Foundry-owned. Bram was a hydraulic press operator until the Veil fused his shoulder plate to bone. He fights slowly because he never has to hurry.',
    quote: 'Stand still. It is quicker.', intro: 'Every wall in the Circuit is thinner than I am.',
    ending: 'Bram folds the Reactor core in his hands. For the first time, the Foundry is quiet.',
    stats: { hp: 1150, walk: 2.5, back: 2.0, jump: 12.5, dash: 6.5, weight: 1.12 },
    prop: { s: 1.18, torso: 62, torsoW: 58, shoulderW: 22, thigh: 52, shin: 52, uarm: 38, farm: 38, head: 17, limb: 17 },
    skins: [
      SK('Titan Foundry', P('#b88d6e', '#6c727a', '#3d4148', '#4a3a2c', '#c0c6cd', '#ff8a2a', '#2a2018'), null),
      SK('Obsidian Colossus', P('#a8806a', '#17171b', '#34343c', '#2a1e14', '#c28a43', '#ffb347', '#0b0b0d'), { type: 'wins', n: 3, label: 'Win 3 matches as Bram' }),
      SK('Frostbreaker', P('#c8b2a4', '#bcc9d6', '#7f93a8', '#35557a', '#f0f6ff', '#6ec6ff', '#d6dde6'), { type: 'arcade', label: 'Complete Arcade as Bram' }),
    ],
    moves: {
      ...normals({
        lp: { startup: 7, recovery: 11, damage: 42, hitstun: 15, blockstun: 10, box: { w: 70, h: 40 }, guardDmg: 16 },
        hp: { startup: 15, active: 5, recovery: 26, damage: 105, box: { w: 96, h: 50 }, pushback: 14, hitstun: 26, blockstun: 14, hitstop: 11, guardDmg: 34 },
        lk: { startup: 9, recovery: 13, damage: 46, box: { w: 76 } },
        hk: { startup: 18, active: 5, recovery: 28, damage: 98, box: { w: 100, h: 50 }, pushback: 15, hitstun: 28, blockstun: 14, hitstop: 11, knockdown: true, guardDmg: 32 },
        cl: { startup: 7, recovery: 12, damage: 34 },
        ck: { startup: 10, recovery: 15, damage: 42 },
        up: { startup: 12, recovery: 30, damage: 90, launch: 12 },
        sw: { startup: 15, recovery: 32, damage: 74, box: { w: 112 } },
        ap: { damage: 54, startup: 6 }, ak: { damage: 62, startup: 7 },
        th: { startup: 5, active: 3, damage: 150, box: { w: 112, h: 140 }, recovery: 34 },
      }),
      sp1: BASE('sp1', 'Titan Rush', { rank: 3, anim: 'spA', startup: 16, active: 16, recovery: 30, damage: 115, level: 'mid', box: { x: 10, y: 190, w: 100, h: 150 }, pushback: 14, hitstun: 28, blockstun: 14, hitstop: 12, move: { vx: 8, from: 16, to: 32 }, armor: [4, 32], knockdown: true, chip: true, guardDmg: 40, sfx: 'special', fx: 'heavy' }),
      sp2: BASE('sp2', 'Groundbreaker', { rank: 3, anim: 'spB', startup: 20, active: 5, recovery: 36, damage: 155, level: 'overhead', box: { x: 30, y: 240, w: 120, h: 240 }, pushback: 10, hitstun: 36, blockstun: 16, hitstop: 14, knockdown: true, shockwave: true, chip: true, guardDmg: 45, sfx: 'special', fx: 'heavy' }),
      ult: BASE('ult', 'Foundry Collapse', { rank: 4, anim: 'ult', ultimate: true, startup: 34, active: 30, recovery: 40, damage: 80, finalDamage: 190, interval: 14, level: 'mid', box: { x: 10, y: 200, w: 140, h: 170 }, pushback: 0, hitstun: 26, blockstun: 12, hitstop: 7, move: { vx: 3, from: 34, to: 55 }, invuln: [0, 34], finalKnockdown: true, shockwave: true, guardDmg: 50, sfx: 'ultimate', fx: 'heavy' }),
    },
  },
  {
    id: 'sora', name: 'Sora Ren', title: 'The Storm Monk', style: 'Technical Zoner',
    bio: 'Keeper of the Stillwater Shrine, Sora believes a fight is a conversation conducted at the right distance. The storm she carries answers only when she is calm.',
    quote: 'Breathe. Then answer.', intro: 'Silence is the first strike.',
    ending: 'Sora returns the storm to the shrine. The Veil settles like a held breath, released.',
    stats: { hp: 980, walk: 3.4, back: 3.2, jump: 14, dash: 8, weight: 0.98 },
    prop: { s: 1, torso: 52, torsoW: 30, shoulderW: 12, thigh: 50, shin: 52, uarm: 35, farm: 36, head: 14, limb: 9 },
    skins: [
      SK('Storm Monk', P('#d0b49c', '#27385a', '#1b2540', '#e8edf4', '#9fb4d0', '#34e6ff', '#14202e'), null),
      SK('Tempest Adept', P('#cdb199', '#18284a', '#c0cbdd', '#1d3b78', '#dfe7f2', '#7fb5ff', '#0e1626'), { type: 'wins', n: 3, label: 'Win 3 matches as Sora' }),
      SK('Sunken Oracle', P('#c7a98f', '#12433f', '#b99a4a', '#d9c98f', '#c8a850', '#ffd75e', '#0b2b28'), { type: 'arcade', label: 'Complete Arcade as Sora' }),
    ],
    moves: {
      ...normals({
        lp: { startup: 5, recovery: 9, damage: 28, box: { w: 76 } },
        hp: { startup: 12, recovery: 18, damage: 68, box: { w: 100 }, pushback: 11 },
        lk: { damage: 34 },
        hk: { startup: 14, damage: 78, box: { w: 90 } },
        up: { launch: 12.5 },
        th: { damage: 80 },
      }),
      sp1: BASE('sp1', 'Storm Disc', { rank: 3, anim: 'spA', startup: 14, active: 1, recovery: 24, damage: 70, level: 'mid', box: { x: 0, y: 0, w: 0, h: 0 }, projectile: { frame: 14, vx: 8.5, life: 110, w: 70, h: 70, y: 140, ox: 60, dmg: 70, hitstun: 24, blockstun: 13, hitstop: 8, color: '#38e8ff', kind: 'disc', pushback: 9 }, sfx: 'projectile', fx: 'energy' }),
      sp2: BASE('sp2', 'Stillwater Counter', { rank: 3, anim: 'spB', counter: { from: 5, to: 34, damage: 110, hitstun: 36 }, startup: 4, active: 30, recovery: 22, damage: 0, noHit: true, box: { x: 0, y: 0, w: 0, h: 0 }, sfx: 'parry', fx: 'energy' }),
      ult: BASE('ult', 'Tempest Verdict', { rank: 4, anim: 'ult', ultimate: true, startup: 30, active: 48, recovery: 30, damage: 38, finalDamage: 130, interval: 8, level: 'mid', box: { x: 30, y: 200, w: 330, h: 150 }, pushback: 0, hitstun: 18, blockstun: 10, hitstop: 4, invuln: [0, 30], finalKnockdown: true, guardDmg: 35, sfx: 'ultimate', fx: 'energy' }),
    },
  },
  {
    id: 'vex', name: 'VEX-09', title: 'The Null Machine', style: 'Precision Fighter',
    bio: 'Combat unit nine of a program that was cancelled and never told. VEX-09 measures everything - spacing, frames, you - and punishes whatever deviates from the plan.',
    quote: 'Deviation detected. Correcting.', intro: 'Parameters acquired. Outcome: unfavorable to you.',
    ending: 'VEX-09 finds its program log. The final line reads: "Release unit". It does not comply - it chooses.',
    stats: { hp: 1000, walk: 3.7, back: 3.0, jump: 14, dash: 11, weight: 1.02 },
    prop: { s: 1.04, torso: 56, torsoW: 30, shoulderW: 13, thigh: 52, shin: 54, uarm: 36, farm: 36, head: 13, limb: 10 },
    skins: [
      SK('Null Machine', P('#4a4d55', '#2a2c33', '#575b66', '#1a1b20', '#8a8f9c', '#ff2d3d', '#101014', { visor: '#ff2d3d' }), null),
      SK('Ghost Protocol', P('#a9b3bf', '#c7ced8', '#8e98a6', '#dfe4ea', '#ffffff', '#22e6ff', '#93a0ae', { visor: '#22e6ff' }), { type: 'wins', n: 3, label: 'Win 3 matches as VEX-09' }),
      SK('Blackout Unit', P('#222328', '#111114', '#26272d', '#0a0a0c', '#4a4c55', '#ffb020', '#0a0a0c', { visor: '#ffb020' }), { type: 'arcade', label: 'Complete Arcade as VEX-09' }),
    ],
    moves: {
      ...normals({
        lp: { startup: 5, damage: 30, box: { w: 62 } },
        hp: { startup: 10, recovery: 16, damage: 74, box: { w: 80 } },
        lk: { startup: 7, damage: 36, box: { w: 72 } },
        hk: { startup: 13, recovery: 20, damage: 84, box: { w: 92 } },
        ck: { startup: 7, damage: 36 },
        up: { launch: 12.5 },
      }),
      sp1: BASE('sp1', 'Null Cannon', { rank: 3, anim: 'spA', startup: 26, active: 1, recovery: 26, damage: 125, level: 'mid', box: { x: 0, y: 0, w: 0, h: 0 }, projectile: { frame: 26, vx: 14, life: 70, w: 100, h: 90, y: 150, ox: 70, dmg: 125, hitstun: 30, blockstun: 16, hitstop: 12, color: '#ff2d3d', kind: 'cannon', pushback: 13, knockdown: true }, sfx: 'projectile', fx: 'energy' }),
      sp2: BASE('sp2', 'Vector Dash', { rank: 3, anim: 'spB', startup: 9, active: 7, recovery: 20, damage: 58, level: 'mid', box: { x: 20, y: 160, w: 76, h: 70 }, pushback: 8, hitstun: 22, blockstun: 11, hitstop: 7, move: { vx: 15, from: 9, to: 16 }, chip: true, guardDmg: 22, sfx: 'dash', fx: 'spark' }),
      ult: BASE('ult', 'System Overload', { rank: 4, anim: 'ult', ultimate: true, startup: 26, active: 48, recovery: 30, damage: 34, finalDamage: 135, interval: 6, level: 'mid', box: { x: 10, y: 190, w: 150, h: 150 }, pushback: 0, hitstun: 15, blockstun: 9, hitstop: 4, move: { vx: 5, from: 26, to: 46 }, invuln: [0, 26], finalKnockdown: true, guardDmg: 38, sfx: 'ultimate', fx: 'spark' }),
    },
  },
  {
    id: 'sera', name: 'Seraphine Drake', title: 'The Veil Knight', style: 'Stance Technician',
    bio: 'Last knight of an order that swore to guard the Veil and not to use it. Seraphine broke the second oath so she could keep the first. Her blade is ceremonial; her patience is not.',
    quote: 'Every guard is a promise.', intro: 'I kept the oath. Now I will keep you from the throne.',
    ending: 'Seraphine lays the ceremonial blade across the throne. The order is gone, and the Veil is guarded anyway.',
    stats: { hp: 1000, walk: 3.5, back: 3.1, jump: 14.5, dash: 8.5, weight: 1 },
    prop: { s: 1.02, torso: 54, torsoW: 32, shoulderW: 14, thigh: 51, shin: 53, uarm: 34, farm: 35, head: 14, limb: 10 },
    skins: [
      SK('Veil Knight', P('#d1b6a0', '#b8bec8', '#2a2b33', '#9c1128', '#e4e8ee', '#ff3355', '#2a1c1c'), null),
      SK('Dawnguard', P('#d8c0aa', '#f0f2f6', '#c7a24a', '#3a62b8', '#e8c860', '#7ab8ff', '#e8d9a8'), { type: 'wins', n: 3, label: 'Win 3 matches as Seraphine' }),
      SK('Night Sovereign', P('#c4a690', '#1c1a26', '#8c8fa0', '#4a2a78', '#b9b9d0', '#b57bff', '#14101c'), { type: 'arcade', label: 'Complete Arcade as Seraphine' }),
    ],
    moves: {
      ...normals({
        lp: { startup: 5, damage: 30, box: { w: 70 } },
        hp: { startup: 12, recovery: 18, damage: 78, box: { w: 96 }, pushback: 10 },
        lk: { damage: 36 },
        hk: { startup: 15, recovery: 22, damage: 80, box: { w: 90 } },
        sw: { damage: 62, box: { w: 112 } },
      }),
      sp1: BASE('sp1', 'Veil Rend', { rank: 3, anim: 'spA', startup: 16, active: 6, recovery: 26, damage: 125, level: 'mid', box: { x: 10, y: 190, w: 150, h: 130 }, pushback: 13, hitstun: 28, blockstun: 13, hitstop: 11, knockdown: true, chip: true, guardDmg: 30, sfx: 'special', fx: 'heavy' }),
      sp2: BASE('sp2', 'Mirror Guard', { rank: 3, anim: 'spB', counter: { from: 4, to: 30, damage: 90, hitstun: 32 }, stanceOnUse: true, startup: 4, active: 26, recovery: 20, damage: 0, noHit: true, box: { x: 0, y: 0, w: 0, h: 0 }, sfx: 'parry', fx: 'energy' }),
      ult: BASE('ult', 'Dawnbreaker Sequence', { rank: 4, anim: 'ult', ultimate: true, startup: 30, active: 44, recovery: 30, damage: 42, finalDamage: 135, interval: 9, level: 'mid', box: { x: 20, y: 200, w: 160, h: 150 }, pushback: 0, hitstun: 18, blockstun: 10, hitstop: 5, move: { vx: 4.5, from: 30, to: 60 }, invuln: [0, 30], finalKnockdown: true, guardDmg: 40, sfx: 'ultimate', fx: 'heavy' }),
    },
  },
];

export const BY_ID = Object.fromEntries(ROSTER.map(c => [c.id, c]));
export const MOVE_ORDER = ['lp', 'hp', 'lk', 'hk', 'cl', 'ck', 'up', 'sw', 'ap', 'ak', 'th', 'sp1', 'sp2', 'ult'];
