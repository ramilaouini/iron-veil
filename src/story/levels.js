// Level geometry, platforming physics, hazards, jump pads, collectibles,
// locked combat arenas, quest goals and parallax backgrounds for all 4 Sectors.
import { Enemy } from './enemies.js';

export function getLevelData(sectorId) {
  switch (sectorId) {
    case 1: return buildSector1();
    case 2: return buildSector2();
    case 3: return buildSector3();
    case 4: return buildSector4();
    default: return buildSector1();
  }
}

// ===================================================================================================
// SECTOR 1: THE NEON OUTSKIRTS
// ===================================================================================================
function buildSector1() {
  const width = 4200;
  return {
    id: 1,
    name: 'The Neon Outskirts',
    sub: 'Sector Zero: The Forgotten Perimeter',
    song: 'story_neon',
    width,
    groundY: 0,
    theme: 'neon',

    // Quests
    quests: [
      { id: 'boss', text: 'Defeat Vex the Crimson Outcast', current: 0, target: 1, done: false },
      { id: 'relics', text: 'Collect 3 Hidden Veil Relics', current: 0, target: 3, done: false },
      { id: 'nodes', text: 'Destroy 3 Circuit Relays', current: 0, target: 3, done: false },
      { id: 'combo', text: 'Achieve a 10+ Hit Combo', current: 0, target: 10, done: false },
    ],

    // Platforms: { x, y, w, h, oneWay }
    platforms: [
      // Ground segments with gaps
      { x: 0, y: 0, w: 1200, h: 40, ground: true },
      { x: 1350, y: 0, w: 1100, h: 40, ground: true },
      { x: 2600, y: 0, w: 1600, h: 40, ground: true },

      // Rooftops & Girders (One-Way)
      { x: 250, y: 140, w: 180, h: 16, oneWay: true },
      { x: 480, y: 220, w: 200, h: 16, oneWay: true },
      { x: 740, y: 310, w: 180, h: 16, oneWay: true },
      { x: 1000, y: 160, w: 160, h: 16, oneWay: true },

      // Mid-level platforms over chasm
      { x: 1240, y: 190, w: 140, h: 18, moving: { range: 100, speed: 1.2, axis: 'y' } },
      { x: 1440, y: 140, w: 180, h: 16, oneWay: true },
      { x: 1700, y: 240, w: 220, h: 16, oneWay: true },
      { x: 2000, y: 320, w: 190, h: 16, oneWay: true },

      // High vantage point
      { x: 2250, y: 180, w: 160, h: 16, oneWay: true },
      { x: 2480, y: 200, w: 140, h: 18, moving: { range: 80, speed: 1.5, axis: 'x' } },

      // Boss approach arena
      { x: 2750, y: 150, w: 240, h: 16, oneWay: true },
      { x: 3100, y: 210, w: 260, h: 16, oneWay: true },
      { x: 3450, y: 160, w: 220, h: 16, oneWay: true },
    ],

    // Jump Pads (Springs)
    springs: [
      { x: 920, y: 0, power: 17.5 },
      { x: 2200, y: 0, power: 18.0 },
      { x: 3000, y: 0, power: 17.5 },
    ],

    // Hazards (Spike/Electric pits)
    hazards: [
      { x: 1200, y: -20, w: 150, h: 30, damage: 18, type: 'electric' },
      { x: 2450, y: -20, w: 150, h: 30, damage: 18, type: 'electric' },
    ],

    // Floating Veil Shards (arcs)
    shards: generateShardArcs([
      { x: 260, y: 190, count: 4 },
      { x: 500, y: 270, count: 5 },
      { x: 760, y: 360, count: 4 },
      { x: 920, y: 100, count: 5, vertical: true },
      { x: 1450, y: 180, count: 5 },
      { x: 1720, y: 280, count: 5 },
      { x: 2020, y: 360, count: 4 },
      { x: 2800, y: 200, count: 6 },
      { x: 3120, y: 260, count: 6 },
    ]),

    // Hidden Relics (Quest)
    relics: [
      { x: 760, y: 350, found: false },
      { x: 2050, y: 360, found: false },
      { x: 3480, y: 200, found: false },
    ],

    // Circuit Nodes to destroy (Quest)
    nodes: [
      { x: 600, y: 0, hp: 30, destroyed: false },
      { x: 1850, y: 0, hp: 30, destroyed: false },
      { x: 3300, y: 0, hp: 30, destroyed: false },
    ],

    // Breakable supply crates
    crates: [
      { x: 380, y: 0, hp: 1, type: 'shards' },
      { x: 1050, y: 160, hp: 1, type: 'health' },
      { x: 1600, y: 0, hp: 1, type: 'meter' },
      { x: 2100, y: 320, hp: 1, type: 'health' },
      { x: 2900, y: 0, hp: 1, type: 'shards' },
    ],

    // Hologram Terminals (Orin the Guide)
    terminals: [
      { x: 180, y: 0, quoteIdx: 0, visited: false },
      { x: 1550, y: 0, quoteIdx: 1, visited: false },
      { x: 2700, y: 0, quoteIdx: 2, visited: false },
    ],

    // Rebel Cages (Scout Rescues)
    cages: [
      { x: 1120, y: 0, hp: 25, freed: false },
    ],

    // Checkpoints
    checkpoints: [
      { x: 100, y: 0, active: true },
      { x: 1400, y: 0, active: false },
      { x: 2650, y: 0, active: false },
    ],

    // Combat Arenas (Sector Lockdowns)
    arenas: [
      {
        id: 'mid',
        x0: 1750, x1: 2350,
        gateL: 1750, gateR: 2350,
        locked: false, cleared: false, spawned: false,
        isMiniBoss: true,
        spawnEnemyDefs: [
          { kind: 'miniboss', x: 2150, y: 0, hp: 650, name: 'Vanguard RX-9', title: 'Sector Enforcer', glow: '#ff3a3a' },
          { kind: 'drone', x: 1900, y: 160 },
          { kind: 'drone', x: 2250, y: 160 },
        ],
      },
      {
        id: 'boss',
        x0: 3400, x1: 4100,
        gateL: 3400, gateR: 4100,
        locked: false, cleared: false, spawned: false,
        isBoss: true,
        spawnEnemyDefs: [
          { kind: 'boss', x: 3850, y: 0, hp: 1050, name: 'Vex the Crimson Outcast', title: 'Prototype 00', bossId: 'vex', glow: '#ff2040' },
        ],
      },
    ],

    // Roaming Mobs
    initialEnemies: [
      { kind: 'grunt', x: 450, y: 0 },
      { kind: 'grunt', x: 680, y: 0 },
      { kind: 'drone', x: 800, y: 180 },
      { kind: 'brute', x: 1020, y: 0 },
      { kind: 'grunt', x: 1520, y: 0 },
      { kind: 'ninja', x: 1680, y: 0 },
      { kind: 'drone', x: 1950, y: 200 },
      { kind: 'brute', x: 2750, y: 0 },
      { kind: 'ninja', x: 2950, y: 0 },
      { kind: 'grunt', x: 3200, y: 0 },
    ],
  };
}

// ===================================================================================================
// SECTOR 2: THE SUNKEN AQUEDUCTS
// ===================================================================================================
function buildSector2() {
  const width = 4600;
  return {
    id: 2,
    name: 'The Sunken Aqueducts',
    sub: 'Sector Sub-B: The Drowned Conduits',
    song: 'story_aqueduct',
    width,
    groundY: 0,
    theme: 'aqueduct',

    quests: [
      { id: 'boss', text: 'Defeat Nyra the Shadow Lotus', current: 0, target: 1, done: false },
      { id: 'relics', text: 'Collect 3 Submerged Data Relics', current: 0, target: 3, done: false },
      { id: 'rescue', text: 'Rescue 2 Captured Rebel Scouts', current: 0, target: 2, done: false },
      { id: 'drones', text: 'Eliminate 8 Drone Units', current: 0, target: 8, done: false },
    ],

    platforms: [
      { x: 0, y: 0, w: 1000, h: 40, ground: true },
      { x: 1250, y: 0, w: 1200, h: 40, ground: true },
      { x: 2650, y: 0, w: 1950, h: 40, ground: true },

      // Water pipes and pump towers
      { x: 200, y: 150, w: 190, h: 16, oneWay: true },
      { x: 450, y: 240, w: 180, h: 16, oneWay: true },
      { x: 700, y: 320, w: 220, h: 16, oneWay: true },

      // Acid canal platforms
      { x: 1050, y: 170, w: 140, h: 18, moving: { range: 110, speed: 1.4, axis: 'y' } },
      { x: 1300, y: 220, w: 200, h: 16, oneWay: true },
      { x: 1600, y: 300, w: 240, h: 16, oneWay: true },
      { x: 1950, y: 180, w: 180, h: 16, oneWay: true },
      { x: 2250, y: 220, w: 150, h: 18, moving: { range: 90, speed: 1.6, axis: 'x' } },

      // Deep filtration arena
      { x: 2800, y: 160, w: 250, h: 16, oneWay: true },
      { x: 3150, y: 250, w: 220, h: 16, oneWay: true },
      { x: 3450, y: 190, w: 200, h: 16, oneWay: true },
      { x: 3800, y: 260, w: 220, h: 16, oneWay: true },
    ],

    springs: [
      { x: 800, y: 0, power: 18.0 },
      { x: 1800, y: 0, power: 17.5 },
      { x: 3050, y: 0, power: 18.0 },
    ],

    hazards: [
      { x: 1000, y: -20, w: 250, h: 30, damage: 22, type: 'acid' },
      { x: 2450, y: -20, w: 200, h: 30, damage: 22, type: 'acid' },
    ],

    shards: generateShardArcs([
      { x: 220, y: 200, count: 5 },
      { x: 470, y: 290, count: 5 },
      { x: 720, y: 370, count: 5 },
      { x: 1320, y: 270, count: 5 },
      { x: 1620, y: 350, count: 6 },
      { x: 2820, y: 210, count: 6 },
      { x: 3180, y: 300, count: 5 },
    ]),

    relics: [
      { x: 720, y: 360, found: false },
      { x: 1640, y: 340, found: false },
      { x: 3820, y: 300, found: false },
    ],

    nodes: [],

    crates: [
      { x: 350, y: 0, hp: 1, type: 'health' },
      { x: 850, y: 320, hp: 1, type: 'shards' },
      { x: 1450, y: 0, hp: 1, type: 'meter' },
      { x: 2050, y: 180, hp: 1, type: 'health' },
      { x: 2950, y: 0, hp: 1, type: 'shards' },
    ],

    terminals: [
      { x: 150, y: 0, quoteIdx: 0, visited: false },
      { x: 1450, y: 0, quoteIdx: 1, visited: false },
      { x: 2750, y: 0, quoteIdx: 3, visited: false },
    ],

    cages: [
      { x: 920, y: 0, hp: 30, freed: false },
      { x: 2150, y: 0, hp: 30, freed: false },
    ],

    checkpoints: [
      { x: 80, y: 0, active: true },
      { x: 1350, y: 0, active: false },
      { x: 2700, y: 0, active: false },
    ],

    arenas: [
      {
        id: 'mid',
        x0: 1750, x1: 2400,
        gateL: 1750, gateR: 2400,
        locked: false, cleared: false, spawned: false,
        isMiniBoss: true,
        spawnEnemyDefs: [
          { kind: 'miniboss', x: 2150, y: 0, hp: 750, name: 'Phantom Stalker Ren', title: 'Deep Shadowblade', glow: '#a030ff' },
          { kind: 'ninja', x: 1900, y: 0 },
          { kind: 'ninja', x: 2300, y: 0 },
        ],
      },
      {
        id: 'boss',
        x0: 3800, x1: 4500,
        gateL: 3800, gateR: 4500,
        locked: false, cleared: false, spawned: false,
        isBoss: true,
        spawnEnemyDefs: [
          { kind: 'boss', x: 4200, y: 0, hp: 1250, name: 'Nyra the Shadow Lotus', title: 'High Phantom', bossId: 'nyra', glow: '#c58bff' },
        ],
      },
    ],

    initialEnemies: [
      { kind: 'drone', x: 350, y: 180 },
      { kind: 'ninja', x: 550, y: 0 },
      { kind: 'grunt', x: 800, y: 0 },
      { kind: 'drone', x: 950, y: 190 },
      { kind: 'brute', x: 1400, y: 0 },
      { kind: 'drone', x: 1550, y: 220 },
      { kind: 'ninja', x: 1700, y: 0 },
      { kind: 'drone', x: 2850, y: 200 },
      { kind: 'brute', x: 3050, y: 0 },
      { kind: 'ninja', x: 3300, y: 0 },
      { kind: 'drone', x: 3600, y: 220 },
    ],
  };
}

// ===================================================================================================
// SECTOR 3: THE MAGMA FOUNDRY
// ===================================================================================================
function buildSector3() {
  const width = 5000;
  return {
    id: 3,
    name: 'The Magma Foundry',
    sub: 'Sector Core: The Heart of Steel',
    song: 'story_foundry',
    width,
    groundY: 0,
    theme: 'foundry',

    quests: [
      { id: 'boss', text: 'Defeat Bram the Forge Titan', current: 0, target: 1, done: false },
      { id: 'relics', text: 'Collect 3 Molten Core Relics', current: 0, target: 3, done: false },
      { id: 'valves', text: 'Destroy 4 Magma Coolant Valves', current: 0, target: 4, done: false },
      { id: 'shards', text: 'Gather 80 Molten Veil Shards', current: 0, target: 80, done: false },
    ],

    platforms: [
      { x: 0, y: 0, w: 1100, h: 40, ground: true },
      { x: 1350, y: 0, w: 1250, h: 40, ground: true },
      { x: 2800, y: 0, w: 2200, h: 40, ground: true },

      // Smelting conveyor platforms
      { x: 250, y: 160, w: 200, h: 16, oneWay: true },
      { x: 520, y: 250, w: 180, h: 16, oneWay: true },
      { x: 780, y: 330, w: 220, h: 16, oneWay: true },

      // Molten river crossing
      { x: 1150, y: 190, w: 150, h: 18, moving: { range: 120, speed: 1.8, axis: 'y' } },
      { x: 1450, y: 230, w: 220, h: 16, oneWay: true },
      { x: 1750, y: 310, w: 240, h: 16, oneWay: true },
      { x: 2050, y: 200, w: 190, h: 16, oneWay: true },
      { x: 2350, y: 220, w: 160, h: 18, moving: { range: 100, speed: 2.0, axis: 'x' } },

      // Heavy machinery platforms
      { x: 2950, y: 170, w: 240, h: 16, oneWay: true },
      { x: 3300, y: 260, w: 220, h: 16, oneWay: true },
      { x: 3650, y: 180, w: 240, h: 16, oneWay: true },
      { x: 4000, y: 270, w: 240, h: 16, oneWay: true },
    ],

    springs: [
      { x: 880, y: 0, power: 18.5 },
      { x: 1950, y: 0, power: 18.0 },
      { x: 3200, y: 0, power: 18.5 },
    ],

    hazards: [
      { x: 1100, y: -20, w: 250, h: 30, damage: 25, type: 'lava' },
      { x: 2600, y: -20, w: 200, h: 30, damage: 25, type: 'lava' },
    ],

    shards: generateShardArcs([
      { x: 270, y: 210, count: 5 },
      { x: 540, y: 300, count: 5 },
      { x: 800, y: 380, count: 5 },
      { x: 1470, y: 280, count: 6 },
      { x: 1770, y: 360, count: 6 },
      { x: 2980, y: 220, count: 6 },
      { x: 3330, y: 310, count: 6 },
      { x: 4020, y: 320, count: 6 },
    ]),

    relics: [
      { x: 800, y: 370, found: false },
      { x: 1800, y: 350, found: false },
      { x: 4030, y: 310, found: false },
    ],

    nodes: [
      { x: 650, y: 0, hp: 40, destroyed: false, label: 'Coolant Valve 1' },
      { x: 1650, y: 0, hp: 40, destroyed: false, label: 'Coolant Valve 2' },
      { x: 3100, y: 0, hp: 40, destroyed: false, label: 'Coolant Valve 3' },
      { x: 3800, y: 0, hp: 40, destroyed: false, label: 'Coolant Valve 4' },
    ],

    crates: [
      { x: 400, y: 0, hp: 1, type: 'meter' },
      { x: 1000, y: 0, hp: 1, type: 'health' },
      { x: 1600, y: 0, hp: 1, type: 'shards' },
      { x: 2200, y: 200, hp: 1, type: 'health' },
      { x: 3500, y: 0, hp: 1, type: 'shards' },
    ],

    terminals: [
      { x: 120, y: 0, quoteIdx: 0, visited: false },
      { x: 1500, y: 0, quoteIdx: 2, visited: false },
      { x: 2900, y: 0, quoteIdx: 4, visited: false },
    ],

    cages: [
      { x: 1850, y: 0, hp: 35, freed: false },
    ],

    checkpoints: [
      { x: 60, y: 0, active: true },
      { x: 1400, y: 0, active: false },
      { x: 2850, y: 0, active: false },
    ],

    arenas: [
      {
        id: 'mid',
        x0: 1850, x1: 2550,
        gateL: 1850, gateR: 2550,
        locked: false, cleared: false, spawned: false,
        isMiniBoss: true,
        spawnEnemyDefs: [
          { kind: 'miniboss', x: 2300, y: 0, hp: 900, name: 'Molten Juggernaut', title: 'Core Vanguard', glow: '#ff7010' },
          { kind: 'brute', x: 2000, y: 0 },
        ],
      },
      {
        id: 'boss',
        x0: 4150, x1: 4900,
        gateL: 4150, gateR: 4900,
        locked: false, cleared: false, spawned: false,
        isBoss: true,
        spawnEnemyDefs: [
          { kind: 'boss', x: 4600, y: 0, hp: 1450, name: 'Bram the Forge Titan', title: 'Architect of Steel', bossId: 'bram', glow: '#ff8a20' },
        ],
      },
    ],

    initialEnemies: [
      { kind: 'grunt', x: 420, y: 0 },
      { kind: 'brute', x: 680, y: 0 },
      { kind: 'drone', x: 820, y: 220 },
      { kind: 'grunt', x: 1050, y: 0 },
      { kind: 'brute', x: 1500, y: 0 },
      { kind: 'drone', x: 1720, y: 220 },
      { kind: 'ninja', x: 1980, y: 0 },
      { kind: 'brute', x: 3050, y: 0 },
      { kind: 'grunt', x: 3250, y: 0 },
      { kind: 'ninja', x: 3550, y: 0 },
      { kind: 'brute', x: 3850, y: 0 },
      { kind: 'drone', x: 4100, y: 240 },
    ],
  };
}

// ===================================================================================================
// SECTOR 4: THE OBSIDIAN SPIRE (FINAL ASCENSION)
// ===================================================================================================
function buildSector4() {
  const width = 5400;
  return {
    id: 4,
    name: 'The Obsidian Spire',
    sub: 'Apex Sector: The Throne of Ascension',
    song: 'story_spire',
    width,
    groundY: 0,
    theme: 'spire',

    quests: [
      { id: 'boss', text: 'Dethrone Veil Sovereign Malakor', current: 0, target: 1, done: false },
      { id: 'relics', text: 'Collect 3 Sovereign Crests', current: 0, target: 3, done: false },
      { id: 'sentinels', text: 'Vanquish 3 Elite Gatekeepers', current: 0, target: 3, done: false },
      { id: 'grade', text: 'Complete Sector with Grade A or S', current: 0, target: 1, done: false },
    ],

    platforms: [
      { x: 0, y: 0, w: 1200, h: 40, ground: true },
      { x: 1450, y: 0, w: 1300, h: 40, ground: true },
      { x: 3000, y: 0, w: 2400, h: 40, ground: true },

      // Crystalline ascending platforms
      { x: 260, y: 170, w: 200, h: 16, oneWay: true },
      { x: 540, y: 260, w: 220, h: 16, oneWay: true },
      { x: 840, y: 350, w: 220, h: 16, oneWay: true },

      // Floating crystal void bridges
      { x: 1250, y: 200, w: 160, h: 18, moving: { range: 130, speed: 2.0, axis: 'y' } },
      { x: 1550, y: 260, w: 240, h: 16, oneWay: true },
      { x: 1880, y: 340, w: 260, h: 16, oneWay: true },
      { x: 2200, y: 220, w: 200, h: 16, oneWay: true },
      { x: 2500, y: 250, w: 180, h: 18, moving: { range: 120, speed: 2.2, axis: 'x' } },

      // Royal throne approach
      { x: 3100, y: 180, w: 260, h: 16, oneWay: true },
      { x: 3450, y: 280, w: 260, h: 16, oneWay: true },
      { x: 3800, y: 200, w: 260, h: 16, oneWay: true },
      { x: 4150, y: 300, w: 280, h: 16, oneWay: true },
      { x: 4500, y: 200, w: 260, h: 16, oneWay: true },
    ],

    springs: [
      { x: 920, y: 0, power: 19.0 },
      { x: 2100, y: 0, power: 18.5 },
      { x: 3350, y: 0, power: 19.0 },
    ],

    hazards: [
      { x: 1200, y: -20, w: 250, h: 30, damage: 30, type: 'void' },
      { x: 2750, y: -20, w: 250, h: 30, damage: 30, type: 'void' },
    ],

    shards: generateShardArcs([
      { x: 280, y: 220, count: 6 },
      { x: 560, y: 310, count: 6 },
      { x: 860, y: 400, count: 6 },
      { x: 1580, y: 310, count: 6 },
      { x: 1900, y: 390, count: 7 },
      { x: 3120, y: 230, count: 6 },
      { x: 3470, y: 330, count: 6 },
      { x: 4180, y: 350, count: 7 },
    ]),

    relics: [
      { x: 860, y: 390, found: false },
      { x: 1920, y: 380, found: false },
      { x: 4180, y: 340, found: false },
    ],

    nodes: [],

    crates: [
      { x: 400, y: 0, hp: 1, type: 'meter' },
      { x: 1050, y: 0, hp: 1, type: 'health' },
      { x: 1700, y: 260, hp: 1, type: 'shards' },
      { x: 2350, y: 220, hp: 1, type: 'health' },
      { x: 3650, y: 0, hp: 1, type: 'meter' },
    ],

    terminals: [
      { x: 140, y: 0, quoteIdx: 0, visited: false },
      { x: 1600, y: 0, quoteIdx: 3, visited: false },
      { x: 3050, y: 0, quoteIdx: 4, visited: false },
    ],

    cages: [
      { x: 2000, y: 0, hp: 40, freed: false },
    ],

    checkpoints: [
      { x: 70, y: 0, active: true },
      { x: 1500, y: 0, active: false },
      { x: 3050, y: 0, active: false },
    ],

    arenas: [
      {
        id: 'mid',
        x0: 1950, x1: 2750,
        gateL: 1950, gateR: 2750,
        locked: false, cleared: false, spawned: false,
        isMiniBoss: true,
        spawnEnemyDefs: [
          { kind: 'miniboss', x: 2450, y: 0, hp: 1100, name: 'Chrono Sentinel', title: 'Apex Gatekeeper', glow: '#ffd700' },
          { kind: 'drone', x: 2150, y: 220 },
          { kind: 'ninja', x: 2600, y: 0 },
        ],
      },
      {
        id: 'boss',
        x0: 4400, x1: 5300,
        gateL: 4400, gateR: 5300,
        locked: false, cleared: false, spawned: false,
        isBoss: true,
        spawnEnemyDefs: [
          { kind: 'boss', x: 4950, y: 0, hp: 2000, name: 'Veil Sovereign Malakor', title: 'God of the Blood Circuit', bossId: 'malakor', glow: '#ffd466', isFinalBoss: true },
        ],
      },
    ],

    initialEnemies: [
      { kind: 'ninja', x: 450, y: 0 },
      { kind: 'brute', x: 700, y: 0 },
      { kind: 'drone', x: 880, y: 240 },
      { kind: 'ninja', x: 1100, y: 0 },
      { kind: 'brute', x: 1600, y: 0 },
      { kind: 'drone', x: 1780, y: 240 },
      { kind: 'ninja', x: 2050, y: 0 },
      { kind: 'brute', x: 3200, y: 0 },
      { kind: 'drone', x: 3400, y: 240 },
      { kind: 'ninja', x: 3700, y: 0 },
      { kind: 'brute', x: 4000, y: 0 },
      { kind: 'drone', x: 4250, y: 250 },
    ],
  };
}

// ------------------------------------------------------------------ Helpers
function generateShardArcs(configs) {
  const shards = [];
  configs.forEach(cfg => {
    for (let i = 0; i < cfg.count; i++) {
      if (cfg.vertical) {
        shards.push({ x: cfg.x, y: cfg.y + i * 45, collected: false });
      } else {
        // Mario-style parabolic coin arc
        const progress = i / (cfg.count - 1 || 1);
        const arcY = Math.sin(progress * Math.PI) * 45;
        shards.push({ x: cfg.x + i * 36, y: cfg.y + arcY, collected: false });
      }
    }
  });
  return shards;
}
