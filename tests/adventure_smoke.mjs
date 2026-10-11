import { getLevelData } from '../src/story/levels.js';
import { HERO_LORE, GUIDES, SECTOR_LORE } from '../src/story/lore.js';
import { Enemy } from '../src/story/enemies.js';
import { ROSTER } from '../src/characters/roster.js';
import { Fighter } from '../src/combat/fighter.js';

console.log('Testing Sector Levels Data...');
for (let id = 1; id <= 4; id++) {
  const lvl = getLevelData(id);
  console.log(`Sector ${id}: ${lvl.name} - ${lvl.width}px wide, ${lvl.platforms.length} platforms, ${lvl.shards.length} shards, ${lvl.quests.length} quests`);
  if (!lvl.name || !lvl.platforms.length || !lvl.quests.length) {
    throw new Error(`Sector ${id} data validation failed!`);
  }
}

console.log('Testing Hero Lore and Motives...');
for (const hero of ROSTER) {
  const lore = HERO_LORE[hero.id];
  if (!lore || !lore.title || !lore.trait || !lore.prologue) {
    throw new Error(`Hero lore missing for ${hero.id}`);
  }
  console.log(`Hero ${hero.name}: ${lore.title} | ${lore.trait}`);
}

console.log('Testing Enemy AI & Combat State Machine...');
const grunt = new Enemy('grunt', 200, 0);
const drone = new Enemy('drone', 300, 150);
const brute = new Enemy('brute', 400, 0);
const boss = new Enemy('boss', 500, 0, { name: 'Vex', isBoss: true });

const dummyPlayer = { x: 230, y: 0 };
const dummyLevel = { getFloorY: () => 0, projectiles: [] };

grunt.step(dummyPlayer, dummyLevel, null, null);
console.log('Grunt state after step:', grunt.state);

drone.step(dummyPlayer, dummyLevel, null, null);
console.log('Drone pos:', drone.x.toFixed(1), drone.y.toFixed(1));

// Test brute shield block
const dmgBlocked = brute.takeDamage(20, 200, false);
console.log('Brute damage from front (shield):', dmgBlocked, '(expected 0)');
if (dmgBlocked !== 0) throw new Error('Brute shield failed to block frontal light attack');

// Test boss damage and phase shift
boss.takeDamage(700, 200, true);
console.log('Boss HP after heavy hit:', boss.hp, 'Phase:', boss.phase);

console.log('ALL ADVENTURE TESTS PASSED SUCCESSFULLY!');
