// UI Screens for IRON VEIL: STORY ODYSSEY (Campaign Platformer Mode).
// Hero Select, Sector Map, Core Upgrade Shop, Level Victory, Game Over, and True Ending.
import { h, icon } from './dom.js';
import { ROSTER, BY_ID } from '../characters/roster.js';
import { pcanvas } from './screens_a.js';
import { HERO_LORE, SECTOR_LORE } from '../story/lore.js';

const btn = (label, onClick, o = {}) => h('button', {
  class: 'btn ' + (o.cls || ''),
  'data-nav': true,
  'data-nav-default': o.def,
  onClick,
  style: o.style,
  type: 'button'
}, o.icon ? icon(o.icon, 22) : null, label, o.sub ? h('span', { class: 'sub' }, o.sub) : null);

export function registerAdventureScreens(ui) {
  const g = ui.game;
  const S = g.save;

  // ------------------------------------------------------------------ Hero Select
  ui.register('storySelect', () => {
    let heroId = S.data.storyHero || 'kael';
    const grid = h('div', { class: 'sel-grid' });
    const info = h('div', { class: 'sel-info' });
    const cells = [];

    function refresh() {
      const c = BY_ID[heroId];
      const lore = HERO_LORE[heroId] || {};
      info.innerHTML = '';
      info.append(
        h('div', { class: 'tt' }, lore.title || c.title),
        h('h2', null, c.name),
        h('div', { class: 'tt', style: { color: 'var(--gold)', marginTop: '4px' } }, `TRAIT: ${lore.trait || 'Battle Prowess'}`),
        h('p', { style: { marginTop: '10px', fontSize: '15px', lineHeight: '1.5' } }, lore.prologue || c.bio),
        h('div', { style: { marginTop: '14px', color: 'var(--mute)', fontSize: '14px' } }, `MISSION MOTIVE: ${lore.motive || ''}`),
        h('div', { style: { marginTop: '28px', width: '280px' } },
          btn('Deploy to Sector Map', () => {
            S.data.storyHero = heroId;
            S.save();
            ui.go('storyMap');
          }, { def: true, icon: 'play' })
        )
      );
      g.setPreview(2, g.makeActor(heroId, S.equipped(heroId), 1), null);
    }

    ROSTER.forEach(c => {
      const cell = h('button', {
        class: 'cell',
        'data-nav': true,
        'data-nav-default': c.id === heroId,
        type: 'button',
        onClick: () => {
          heroId = c.id;
          refresh();
        }
      }, pcanvas(c, 0, 112, 112, 'bust'), h('div', { class: 'nm' }, c.name.split(' ')[0]));

      cell.addEventListener('navfocus', () => {
        heroId = c.id;
        refresh();
      });
      cells.push(cell);
      grid.append(cell);
    });

    const el = h('div', { class: 'dim' },
      h('div', { class: 'seltop' }, 'STORY MODE: SELECT YOUR HERO'),
      grid, info,
      h('div', { class: 'hint-bar' },
        h('span', null, h('b', null, 'Arrows'), 'Choose Hero'),
        h('span', null, h('b', null, 'Enter'), 'Confirm & View Map'),
        h('span', null, h('b', null, 'Esc'), 'Back to Main Menu')
      )
    );

    return {
      el,
      enter() { refresh(); },
      back() { ui.go('menu'); }
    };
  });

  // ------------------------------------------------------------------ Sector Map
  ui.register('storyMap', () => {
    const heroId = S.data.storyHero || 'kael';
    const unlocked = S.data.storyUnlocked || 1;
    const shards = S.data.storyShards || 0;
    const scores = S.data.storyScores || {};

    const grid = h('div', { class: 'stage-grid', style: 'grid-template-columns: repeat(2, 440px); gap: 20px;' });

    SECTOR_LORE.forEach((sec, idx) => {
      const isLocked = sec.id > unlocked;
      const score = scores[sec.id] || null;

      const card = h('div', {
        class: 'panel ' + (isLocked ? 'locked' : ''),
        style: 'cursor: pointer; border-left: 4px solid ' + (isLocked ? 'var(--mute)' : 'var(--red)'),
        'data-nav': true,
        'data-nav-default': sec.id === unlocked,
        onClick: () => {
          if (isLocked) {
            ui.toast('Sector locked! Complete the previous sector first.', 'info');
            return;
          }
          ui.sfx('menuConfirm');
          g.startAdventure({ heroId, sectorId: sec.id });
          ui.go('adventure');
        }
      },
        h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
          h('div', { style: 'color: var(--red); font-size: 13px; font-weight: 800; letter-spacing: .14em;' }, `SECTOR ${sec.id}`),
          score ? h('span', { class: 'chip on' }, `GRADE: ${score.grade}`) : isLocked ? h('span', { class: 'chip' }, 'LOCKED') : h('span', { class: 'chip' }, 'READY')
        ),
        h('h2', { style: 'font-size: 24px; margin: 6px 0;' }, sec.name),
        h('div', { style: 'color: var(--gold); font-size: 13px; margin-bottom: 6px;' }, `BOSS: ${sec.bossName}`),
        h('p', { style: 'font-size: 14px; color: #c3c9d6; line-height: 1.4;' }, sec.sub),
        score ? h('div', { style: 'font-size: 12px; color: var(--mute); margin-top: 8px;' }, `Best Time: ${Math.round(score.time)}s  -  Shards: ${score.shards}`) : null
      );
      grid.append(card);
    });

    const el = h('div', { class: 'dim' },
      h('div', { class: 'title-h' }, 'Campaign Map',
        h('small', null, `HERO: ${BY_ID[heroId].name.toUpperCase()}  |  VEIL SHARDS: ${shards}`)
      ),
      h('div', { style: 'position: absolute; right: 56px; top: 40px;' },
        btn('Core Upgrades', () => ui.push('storyUpgrades'), { icon: 'gear' })
      ),
      h('div', { style: 'position: absolute; left: 56px; top: 130px;' }, grid),
      h('div', { class: 'hint-bar' },
        h('span', null, h('b', null, 'Arrows'), 'Select Sector'),
        h('span', null, h('b', null, 'Enter'), 'Deploy to Level'),
        h('span', null, h('b', null, 'Esc'), 'Change Hero')
      )
    );

    return {
      el,
      back() { ui.go('storySelect'); }
    };
  });

  // ------------------------------------------------------------------ Core Upgrades Shop
  ui.register('storyUpgrades', () => {
    const s = S.data;
    s.storyUpgrades = s.storyUpgrades || { maxHpLvl: 0, atkLvl: 0, doubleJump: false, meterRegen: false, vampire: false };
    const upg = s.storyUpgrades;

    const list = h('div', { style: 'display: flex; flex-direction: column; gap: 12px;' });

    function draw() {
      list.innerHTML = '';
      const items = [
        {
          id: 'maxHpLvl',
          name: 'Vital Nanite Core (+100 Max HP)',
          cost: 100 + upg.maxHpLvl * 50,
          current: `Level ${upg.maxHpLvl}/5`,
          canBuy: upg.maxHpLvl < 5 && (s.storyShards || 0) >= (100 + upg.maxHpLvl * 50),
          buy: () => { s.storyShards -= (100 + upg.maxHpLvl * 50); upg.maxHpLvl++; }
        },
        {
          id: 'atkLvl',
          name: 'Kinetic Overchargers (+15% Attack Power)',
          cost: 120 + upg.atkLvl * 60,
          current: `Level ${upg.atkLvl}/5`,
          canBuy: upg.atkLvl < 5 && (s.storyShards || 0) >= (120 + upg.atkLvl * 60),
          buy: () => { s.storyShards -= (120 + upg.atkLvl * 60); upg.atkLvl++; }
        },
        {
          id: 'doubleJump',
          name: 'Aerial Thrusters (Unlock Double Jump!)',
          cost: 250,
          current: upg.doubleJump ? 'UNLOCKED' : 'LOCKED',
          canBuy: !upg.doubleJump && (s.storyShards || 0) >= 250,
          buy: () => { s.storyShards -= 250; upg.doubleJump = true; }
        },
        {
          id: 'meterRegen',
          name: 'Veil Siphon (Passive Meter Regeneration)',
          cost: 200,
          current: upg.meterRegen ? 'UNLOCKED' : 'LOCKED',
          canBuy: !upg.meterRegen && (s.storyShards || 0) >= 200,
          buy: () => { s.storyShards -= 200; upg.meterRegen = true; }
        },
        {
          id: 'vampire',
          name: 'Vampiric Circuit (Heal HP on 4-Hit Combos)',
          cost: 300,
          current: upg.vampire ? 'UNLOCKED' : 'LOCKED',
          canBuy: !upg.vampire && (s.storyShards || 0) >= 300,
          buy: () => { s.storyShards -= 300; upg.vampire = true; }
        },
      ];

      items.forEach(it => {
        const row = h('div', { class: 'panel', style: 'display: flex; justify-content: space-between; align-items: center; padding: 12px 18px;' },
          h('div', null,
            h('b', { style: 'font-size: 16px;' }, it.name),
            h('div', { style: 'font-size: 13px; color: var(--mute); margin-top: 4px;' }, `${it.current}  |  Cost: ${it.cost} Shards`)
          ),
          btn(it.current === 'UNLOCKED' ? 'ACTIVE' : `Upgrade (${it.cost})`, () => {
            if (!it.canBuy) {
              ui.toast('Not enough Veil Shards!', 'info');
              return;
            }
            it.buy();
            S.save();
            ui.sfx('unlock');
            draw();
          }, { disabled: !it.canBuy })
        );
        list.append(row);
      });
    }

    draw();

    const el = h('div', { class: 'modal' },
      h('div', { class: 'box panel', style: 'width: 780px;' },
        h('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;' },
          h('h2', null, 'Core Upgrade Shop'),
          h('div', { style: 'color: var(--gold); font-weight: 800; font-size: 18px;' }, `SHARDS: ${s.storyShards || 0}`)
        ),
        list,
        h('div', { style: 'margin-top: 20px;' },
          btn('Close', () => ui.back(), { def: true })
        )
      )
    );

    return {
      el,
      back() { ui.back(); }
    };
  });

  // ------------------------------------------------------------------ Level Victory Screen
  ui.register('storyVictory', ({ stats }) => {
    const isCampaignCleared = stats.sectorId === 4;

    const el = h('div', { class: 'result scrim' },
      h('div', { class: 'box panel', style: 'width: 700px; text-align: center;' },
        h('h1', { class: 'win' }, isCampaignCleared ? 'CAMPAIGN CONQUERED' : 'SECTOR CLEARED'),
        h('div', { class: 'sub' }, `BATTLE PERFORMANCE GRADE: ${stats.grade}`),
        h('table', { class: 'stat-table', style: 'margin: 20px auto; width: 80%;' },
          h('tr', null, h('td', null, 'Completion Time'), h('td', null, `${stats.time}s`)),
          h('tr', null, h('td', null, 'Hostiles Vanquished'), h('td', null, String(stats.kills))),
          h('tr', null, h('td', null, 'Veil Shards Harvested'), h('td', null, `+${stats.shards}`)),
          h('tr', null, h('td', null, 'Sector Quests Completed'), h('td', null, `${stats.questsDone} / 4`))
        ),
        h('div', { class: 'btns', style: 'margin-top: 14px;' },
          isCampaignCleared
            ? btn('View True Hero Ending', () => ui.go('storyEnding'), { def: true, icon: 'trophy' })
            : btn('Return to Sector Map', () => ui.go('storyMap'), { def: true, icon: 'play' }),
          btn('Main Menu', () => ui.toMenu())
        )
      )
    );

    return { el };
  });

  // ------------------------------------------------------------------ Game Over Screen
  ui.register('storyGameOver', () => {
    const el = h('div', { class: 'result scrim' },
      h('div', { class: 'box panel', style: 'width: 580px; text-align: center;' },
        h('h1', { class: 'lose' }, 'CIRCUIT OVERLOADED'),
        h('p', { style: 'color: #c3c9d6; font-size: 16px; margin: 12px 0 24px;' }, 'Your cybernetic frame fell in combat. The Veil reclaims what it made.'),
        h('div', { class: 'btns' },
          btn('Retry Sector', () => {
            const adv = g.adventure;
            if (adv) {
              g.startAdventure({ heroId: adv.heroId, sectorId: adv.sectorId });
              ui.go('adventure');
            } else {
              ui.go('storyMap');
            }
          }, { def: true }),
          btn('Return to Sector Map', () => ui.go('storyMap')),
          btn('Main Menu', () => ui.toMenu())
        )
      )
    );

    return { el };
  });

  // ------------------------------------------------------------------ True Hero Ending Screen
  ui.register('storyEnding', () => {
    const heroId = S.data.storyHero || 'kael';
    const def = BY_ID[heroId];
    const lore = HERO_LORE[heroId] || {};

    const el = h('div', { class: 'dim', style: 'display: grid; place-items: center; padding: 40px;' },
      h('div', { class: 'panel', style: 'max-width: 840px; padding: 40px; animation: rise .5s both;' },
        h('div', { style: 'color: var(--gold); letter-spacing: .3em; font-weight: 800; font-size: 16px;' }, 'THE BLOOD CIRCUIT IS BROKEN'),
        h('h1', { style: 'font-size: 46px; margin: 10px 0 20px;' }, `${def.name} - TRUE EPILOGUE`),
        h('p', { style: 'font-size: 20px; line-height: 1.6; color: #dfe3ec;' }, lore.victoryEpilogue || def.ending),
        h('div', { style: 'margin-top: 36px; display: flex; gap: 14px;' },
          btn('Rolling Credits', () => ui.go('credits', { then: 'menu' }), { def: true }),
          btn('Main Menu', () => ui.toMenu())
        )
      )
    );

    if (g.audio.ready) {
      g.audio.music.play('menu');
      g.audio.play('roundWin');
    }

    return { el, back: () => ui.toMenu() };
  });

  // ------------------------------------------------------------------ In-Game Adventure Screen
  ui.register('adventure', () => {
    const el = h('div', { style: 'pointer-events: none;' });

    return {
      el,
      back() {
        g.requestPause();
      }
    };
  });
}
