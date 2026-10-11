// Core flow screens: splash, intro, title, main menu, selects, versus intro, dialogue, fight, pause, result, ending, credits, guide, confirm.
import { h, icon } from './dom.js';
import { CFG } from '../config.js';
import { ROSTER, BY_ID } from '../characters/roster.js';
import { stageThumb } from '../stages/stages.js';
import { portrait } from './portraits.js';
import { EMBLEM_SVG, Intro } from './intro.js';
import { storyRun, arcadeRun, CREDITS } from './story.js';
import { prettyKey, ACTIONS, ACTION_LABELS } from '../input/input.js';

export const MODES = [
  { id: 'story', label: 'Story Mode', desc: 'Three rivals and the Veil Sovereign. Dialogue, boss fight and a character ending.' },
  { id: 'arcade', label: 'Arcade', desc: 'Four random challengers, then the boss. Clearing Arcade unlocks cosmetics.' },
  { id: 'versus', label: 'Versus CPU', desc: 'Pick any two fighters, any arena and a difficulty.' },
  { id: 'twoPlayer', label: 'Local 2 Player', desc: 'Two players, one keyboard (or two gamepads).' },
  { id: 'training', label: 'Training', desc: 'Infinite health, dummy options, frame and damage readouts.' },
  { id: 'gallery', label: 'Character Gallery', desc: 'Bios, frame data and every animation clip for each fighter.' },
  { id: 'cosmetics', label: 'Cosmetics', desc: 'Equip skins, track achievements and records.' },
  { id: 'settings', label: 'Settings', desc: 'Audio, gameplay, accessibility and control rebinding.' },
  { id: 'credits', label: 'Credits', desc: 'Who and what made this.' },
];
const DIFFS = ['easy', 'normal', 'hard', 'expert'];
const cap = s => s[0].toUpperCase() + s.slice(1);

export function pcanvas(def, skin, w, h, mode) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(portrait(def, skin, w, h, mode), 0, 0); return c;
}
const thumbCache = new Map();
function thumb(ui, i) {
  let t = thumbCache.get(i);
  if (!t) { t = stageThumb(ui.game.stages[i], 290, 163); thumbCache.set(i, t); }
  const c = document.createElement('canvas'); c.width = 290; c.height = 163; c.getContext('2d').drawImage(t, 0, 0); return c;
}
const hint = (...pairs) => h('div', { class: 'hint-bar' }, pairs.map(([k, t]) => h('span', null, h('b', null, k), t)));
const btn = (label, onClick, o = {}) => h('button', { class: 'btn ' + (o.cls || ''), 'data-nav': true, 'data-nav-default': o.def, onClick, style: o.style, type: 'button' }, o.icon ? icon(o.icon, 22) : null, label, o.sub ? h('span', { class: 'sub' }, o.sub) : null);

export function registerScreens(ui) {
  const g = ui.game, S = g.save;
  const flow = ui.flow = { mode: 'versus', p1: { id: 'kael', skin: 0 }, p2: { id: 'nyra', skin: 0 }, stage: 0, difficulty: S.settings.difficulty, run: null, i: 0 };
  const equipped = id => S.equipped(id);
  const toMenu = () => { g.endMatch(); flow.run = null; ui.go('menu'); };
  ui.toMenu = toMenu;

  // ------------------------------------------------------------------ flow helpers
  function stageName(i) { return g.stages[i].name; }
  function buildCfg(fight) {
    if (flow.run) {
      const f = flow.run.fights[flow.i];
      return { mode: flow.mode, p1: { id: flow.p1.id, skin: flow.p1.skin }, p2: { id: f.opp, skin: 0, boss: f.boss }, stage: f.stage, difficulty: f.difficulty, finalFight: flow.i === flow.run.fights.length - 1 };
    }
    return { mode: flow.mode, p1: { ...flow.p1 }, p2: { ...flow.p2 }, stage: flow.stage, difficulty: flow.difficulty };
  }
  function launch() {
    const go = () => {
      const cfg = buildCfg();
      if (flow.mode === 'training') { g.startMatch(cfg); ui.go('fight', { cfg }); } else ui.go('vsintro', { cfg });
    };
    if (!S.settings.guideSeen) ui.push('guide', { onClose: () => { ui.back(); go(); } }); else go();
  }
  function nextFight() {
    const f = flow.run.fights[flow.i];
    if (flow.mode === 'story' && f.pre.length) ui.go('dialogue', { lines: f.pre, header: `FIGHT ${flow.i + 1} OF ${flow.run.fights.length}`, p1: flow.p1.id, p2: f.opp, next: launch });
    else launch();
  }
  ui.startMode = id => {
    if (['story', 'arcade', 'versus', 'twoPlayer', 'training'].includes(id)) { flow.mode = id; flow.run = null; ui.go('select', { mode: id }); }
    else ui.go(id === 'settings' ? 'settings' : id, { from: 'menu' });
  };
  ui.onMatchEnd = res => ui.push('result', { res });

  // ------------------------------------------------------------------ splash + intro + title
  ui.register('splash', () => {
    const start = () => { g.audio.init(); ui.startIntro(); };
    const el = h('div', { class: 'splash', onClick: start }, h('div', null, h('div', { html: EMBLEM_SVG }), h('p', null, 'PRESS ANY KEY OR CLICK TO BEGIN')));
    return { el, key: ev => { if (ev.code === 'F2' || ev.code === 'F3' || ev.code === 'F11') return true; start(); return true; } };
  });
  ui.intro = new Intro(g, document.getElementById('intro'));
  ui.startIntro = () => {
    ui.go('introScreen');
    const cv = document.getElementById('intro'); cv.classList.remove('hidden');
    ui.intro.start(() => { cv.classList.add('hidden'); ui.go('title'); });
  };
  ui.register('introScreen', () => {
    const skip = () => ui.intro.skip();
    return { el: h('div', { onClick: skip }), key: ev => { skip(); return true; }, exit: () => { document.getElementById('intro').classList.add('hidden'); ui.intro.running = false; } };
  });
  ui.register('title', () => {
    g.setPreview(2, null, null);
    const go = () => { ui.sfx('menuConfirm'); ui.go('menu'); };
    const el = h('div', { class: 'dim', onClick: go },
      h('div', { class: 'logo' }, h('div', { html: EMBLEM_SVG }), h('h1', null, 'IRON VEIL'), h('h2', null, 'BLOOD CIRCUIT')),
      h('div', { class: 'press' }, 'PRESS ENTER'), h('div', { class: 'ver' }, 'v1.0  -  offline  -  all assets generated locally'));
    if (g.audio.ready && g.audio.music) g.audio.music.play('menu');
    return { el, key: ev => { if (ev.code === 'F2' || ev.code === 'F3' || ev.code === 'F11') return true; go(); return true; } };
  });

  // ------------------------------------------------------------------ main menu
  ui.register('menu', () => {
    const info = h('div', { class: 'menu-info' }, h('h3'), h('p'));
    const col = h('div', { class: 'menu-col' });
    const setInfo = m => { info.firstChild.textContent = m.label; info.lastChild.textContent = m.desc; };
    MODES.forEach((m, i) => {
      const b = btn(m.label, () => ui.startMode(m.id), { def: i === 0, style: { animationDelay: i * 30 + 'ms' } });
      b.addEventListener('navfocus', () => setInfo(m)); col.append(b);
    });
    // live preview: the last fighter used, idling on the right
    const id = flow.p1.id, a = g.makeActor(id, equipped(id), 1); g.bg.offset = 300;
    g.setPreview(2, a, null);
    if (g.audio.ready && g.audio.music) g.audio.music.play('menu');
    setInfo(MODES[0]);
    const el = h('div', { class: 'dim' }, h('div', { class: 'menu-brand' }, h('h1', null, 'IRON VEIL'), h('h2', null, 'BLOOD CIRCUIT')), col, info,
      hint(['W S / Arrows', 'Move'], ['Enter', 'Select'], ['Esc', 'Back']));
    return { el, back: () => ui.go('title'), exit: () => { g.bg.offset = 0; } };
  });

  // ------------------------------------------------------------------ character select
  ui.register('select', ({ mode }) => {
    const dual = ['versus', 'twoPlayer', 'training'].includes(mode);
    let phase = 0;                                  // 0 = P1, 1 = P2
    const cur = [{ id: flow.p1.id, skin: equipped(flow.p1.id) }, { id: flow.p2.id, skin: 0 }];
    let diff = DIFFS.indexOf(flow.difficulty); if (diff < 0) diff = 1;
    const title = h('div', { class: 'seltop' });
    const grid = h('div', { class: 'sel-grid' });
    const info = h('div', { class: 'sel-info' });
    const tag = h('div', { class: 'slot-tag' });
    const cells = [];
    const pick = (id, i) => { cur[phase].id = id; cur[phase].skin = i === 'rnd' ? 0 : equipped(id); };
    ROSTER.forEach(c => {
      const cell = h('button', { class: 'cell', 'data-nav': true, 'data-nav-default': c.id === cur[0].id, type: 'button', onClick: () => confirm() }, pcanvas(c, 0, 112, 112, 'bust'), h('div', { class: 'nm' }, c.name.split(' ')[0]));
      cell.dataset.id = c.id; cell.addEventListener('navfocus', () => { cur[phase].id = c.id; cur[phase].skin = equipped(c.id); refresh(); }); cells.push(cell); grid.append(cell);
    });
    const rnd = h('button', { class: 'cell', 'data-nav': true, type: 'button', onClick: () => confirm(true) }, h('div', { class: 'q' }, '?'), h('div', { class: 'nm' }, 'Random'));
    rnd.dataset.id = 'rnd'; rnd.addEventListener('navfocus', () => { cur[phase].rnd = true; refresh(); }); grid.append(rnd);
    const diffRow = h('div', { class: 'diff-row' });
    function skinOK(p) { return S.isUnlocked(cur[p].id, cur[p].skin); }
    function refresh() {
      const rndNow = ui.top && ui.top.nav.cur === rnd, p = phase, c = BY_ID[cur[p].id];
      title.textContent = mode === 'twoPlayer' ? (p === 0 ? 'PLAYER 1 - CHOOSE FIGHTER' : 'PLAYER 2 - CHOOSE FIGHTER') : mode === 'training' ? (p === 0 ? 'CHOOSE YOUR FIGHTER' : 'CHOOSE DUMMY') : p === 0 ? 'CHOOSE YOUR FIGHTER' : 'CHOOSE OPPONENT';
      cells.forEach(e => { e.classList.toggle('p1', phase === 1 && e.dataset.id === cur[0].id); });
      info.innerHTML = '';
      if (rndNow) { info.append(h('h2', null, 'Random'), h('p', null, 'A fighter will be picked for you.')); g.setPreview(g.bg.stage, phase === 1 ? g.makeActor(cur[0].id, cur[0].skin, 1) : null, null); return; }
      const st = c.stats;
      const stat = (n, v, max) => h('div', { class: 'statrow' }, h('span', null, n), h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, v / max * 100) + '%' } })));
      info.append(h('div', { class: 'tt' }, c.title), h('h2', null, c.name), h('div', { class: 'tt', style: { color: 'var(--mute)' } }, c.style),
        h('p', null, c.quote ? '"' + c.quote + '"' : ''), stat('HEALTH', st.hp, 1100), stat('SPEED', st.walk, 5.2), stat('JUMP', st.jump, 17), stat('WEIGHT', st.weight, 1.5));
      const sr = h('div', { class: 'skin-row' });
      c.skins.forEach((sk, i) => {
        const un = S.isUnlocked(c.id, i);
        const e = h('div', { class: 'skin' + (cur[p].skin === i ? ' on' : ''), 'data-nav': true, onClick: () => { cur[p].skin = i; refresh(); } }, h('i', { class: 'sw', style: { background: sk.pal.glow } }), sk.name, un ? null : icon('lock', 14));
        sr.append(e);
      });
      info.append(sr);
      if (!skinOK(p)) info.append(h('p', { style: { color: '#ffb347' } }, 'LOCKED: ' + c.skins[cur[p].skin].unlock.label));
      info.append(h('p', { style: { color: 'var(--mute)', fontSize: '13px' } }, 'Q / E  change costume'));
      const a0 = phase === 0 ? g.makeActor(c.id, cur[0].skin, 1) : g.makeActor(cur[0].id, cur[0].skin, 1);
      const a1 = phase === 1 ? g.makeActor(c.id, cur[1].skin, -1) : null;
      if (!refresh.last || refresh.last !== c.id + cur[p].skin + p) { g.setPreview(g.bg.stage, a0, a1); refresh.last = c.id + cur[p].skin + p; }
      tag.innerHTML = ''; tag.append(h('b', null, p === 0 ? 'P1 ' : 'P2 '), mode === 'twoPlayer' ? '' : (p === 1 ? (mode === 'training' ? 'DUMMY' : 'CPU - ' + cap(DIFFS[diff])) : ''));
    }
    function drawDiff() {
      diffRow.innerHTML = '';
      if (mode === 'versus' || mode === 'arcade') { diffRow.append(h('span', { style: { color: 'var(--mute)', letterSpacing: '.14em', fontSize: '14px' } }, 'DIFFICULTY (TAB)'));
        DIFFS.forEach((d, i) => diffRow.append(h('span', { class: 'chip' + (i === diff ? ' on' : ''), 'data-nav': true, onClick: () => { diff = i; flow.difficulty = d; drawDiff(); refresh(); } }, d))); }
    }
    function confirm(random) {
      const p = phase, rndNow = random || ui.top.nav.cur === rnd;
      if (rndNow) { cur[p].id = ROSTER[(Math.random() * ROSTER.length) | 0].id; cur[p].skin = equipped(cur[p].id); }
      if (!skinOK(p)) { ui.toast('Locked: ' + BY_ID[cur[p].id].skins[cur[p].skin].unlock.label, 'info'); return; }
      ui.sfx('menuConfirm');
      if (dual && p === 0) { phase = 1; cur[1].skin = 0; refresh.last = null; const c1 = cells.find(e => e.dataset.id === cur[1].id); ui.top.nav.focus(c1 || cells[1]); refresh(); return; }
      flow.p1 = { ...cur[0] }; flow.p2 = { ...cur[1] }; flow.difficulty = DIFFS[diff];
      if (mode === 'story') { flow.run = storyRun(flow.p1.id); flow.i = 0; nextFight(); }
      else if (mode === 'arcade') { flow.run = arcadeRun(flow.p1.id); flow.i = 0; flow.run.fights.forEach(f => { f.difficulty = f.difficulty; }); applyArcadeDifficulty(); nextFight(); }
      else { flow.run = null; ui.go('stage', { mode }); }
    }
    function applyArcadeDifficulty() {
      // chosen difficulty shifts the ladder up/down one step
      const shift = diff - 1; flow.run.fights.forEach(f => { f.difficulty = DIFFS[Math.max(0, Math.min(3, DIFFS.indexOf(f.difficulty) + shift))]; });
    }
    const cycleSkin = d => { const p = phase, c = BY_ID[cur[p].id]; if (ui.top.nav.cur === rnd) return; cur[p].skin = (cur[p].skin + d + c.skins.length) % c.skins.length; refresh.last = null; refresh(); };
    const el = h('div', { class: 'dim' }, title, grid, info, tag, diffRow, hint(['Arrows', 'Move'], ['Enter', 'Confirm'], ['Q E', 'Costume'], ['Tab', 'Difficulty'], ['Esc', 'Back']));
    diffRow.style.top = '470px';
    drawDiff();
    return {
      el,
      enter() { refresh(); },
      key(ev) {
        if (ev.code === 'KeyQ') { cycleSkin(-1); return true; } if (ev.code === 'KeyE') { cycleSkin(1); return true; }
        if (ev.code === 'Tab' && (mode === 'versus' || mode === 'arcade')) { diff = (diff + 1) % 4; flow.difficulty = DIFFS[diff]; drawDiff(); refresh(); ui.sfx('menuMove'); return true; }
        return false;
      },
      back() { if (phase === 1) { phase = 0; refresh.last = null; ui.top.nav.focus(cells.find(e => e.dataset.id === cur[0].id)); refresh(); ui.sfx('menuBack'); } else { ui.sfx('menuBack'); ui.go('menu'); } },
    };
  });

  // ------------------------------------------------------------------ stage select
  ui.register('stage', ({ mode }) => {
    const grid = h('div', { class: 'stage-grid' }), info = h('div', { class: 'stage-info' }, h('h2'), h('p'));
    let choice = flow.stage;
    const set = i => { const st = g.stages[i]; info.firstChild.textContent = st.name; info.lastChild.textContent = st.blurb; g.setPreview(i, g.makeActor(flow.p1.id, flow.p1.skin, 1), g.makeActor(flow.p2.id, flow.p2.skin, -1)); g.bg.stage = i; };
    g.stages.forEach((st, i) => {
      const c = h('button', { class: 'stage-card', 'data-nav': true, 'data-nav-default': i === flow.stage, type: 'button', onClick: () => { flow.stage = i; ui.sfx('menuConfirm'); launch(); } }, thumb(ui, i), h('div', { class: 'nm' }, st.name));
      c.addEventListener('navfocus', () => { choice = i; set(i); }); grid.append(c);
    });
    const r = h('button', { class: 'stage-card', 'data-nav': true, type: 'button', onClick: () => { flow.stage = (Math.random() * g.stages.length) | 0; ui.sfx('menuConfirm'); launch(); } }, h('div', { class: 'q', style: { display: 'grid', placeItems: 'center', height: '100%', fontSize: '60px', color: 'var(--mute)', fontWeight: 900 } }, '?'), h('div', { class: 'nm' }, 'Random'));
    r.addEventListener('navfocus', () => { info.firstChild.textContent = 'Random'; info.lastChild.textContent = 'Any arena, chosen when the match starts.'; }); grid.append(r);
    const el = h('div', { class: 'dim' }, h('div', { class: 'seltop' }, 'CHOOSE ARENA'), grid, info, hint(['Arrows', 'Move'], ['Enter', 'Fight'], ['Esc', 'Back']));
    return { el, enter() { set(flow.stage); }, back: () => { ui.sfx('menuBack'); ui.go('select', { mode: flow.mode }); } };
  });

  // ------------------------------------------------------------------ versus intro
  ui.register('vsintro', ({ cfg }) => {
    const a = BY_ID[cfg.p1.id], b = BY_ID[cfg.p2.id];
    const sa = flow.mode === 'twoPlayer' ? 'PLAYER 1' : a.title, sb = cfg.p2.boss ? 'THE VEIL SOVEREIGN' : flow.mode === 'twoPlayer' ? 'PLAYER 2' : b.title;
    g.setPreview(cfg.stage, null, null); g.bg.stage = cfg.stage;
    const cb = pcanvas(b, cfg.p2.skin || 0, 380, 480, 'bust');
    if (cfg.p2.boss) { /* boss portrait uses base skin; gold tint overlay marks the Sovereign */ const x = cb.getContext('2d'); x.fillStyle = 'rgba(224,184,74,.18)'; x.fillRect(0, 0, 380, 480); }
    const el = h('div', { class: 'vs' },
      h('div', { class: 'side l' }, pcanvas(a, cfg.p1.skin, 380, 480, 'bust'), h('div', { class: 'tt' }, sa), h('h2', null, a.name)),
      h('div', { class: 'side r' }, cb, h('div', { class: 'tt' }, sb), h('h2', null, cfg.p2.boss ? 'Veil Sovereign' : b.name)),
      h('div', { class: 'big' }, 'VS'), h('div', { class: 'quote' }, g.stages[cfg.stage].name.toUpperCase() + (flow.mode === 'twoPlayer' ? '' : '  -  ' + cap(cfg.difficulty))));
    let done = false; const go = () => { if (done) return; done = true; g.startMatch(cfg); ui.go('fight', { cfg }); };
    const t = setTimeout(go, 2600);
    return { el, key(ev) { if (['Enter', 'Space', 'NumpadEnter', 'Escape'].includes(ev.code)) { go(); } return true; }, exit() { clearTimeout(t); } };
  });

  // ------------------------------------------------------------------ dialogue
  ui.register('dialogue', ({ lines, header, p1, p2, next }) => {
    let i = 0;
    const who = h('div', { class: 'who' }), txt = h('div', { class: 'txt' });
    const L = pcanvas(BY_ID[p1], equipped(p1), 220, 280, 'bust'), R = pcanvas(BY_ID[p2], 0, 220, 280, 'bust'); L.className = 'chr l'; R.className = 'chr r';
    const el = h('div', { class: 'dlg dim', onClick: () => adv() }, h('div', { class: 'head' }, header || ''), L, R, h('div', { class: 'bubble' }, who, txt), hint(['Enter', 'Continue'], ['Esc', 'Skip']));
    function show() {
      const [sp, text] = lines[i]; who.textContent = sp === 'narr' ? 'NARRATOR' : BY_ID[sp].name; txt.textContent = text;
      L.classList.toggle('dimmed', sp !== p1 && sp !== 'narr'); R.classList.toggle('dimmed', sp !== p2 && sp !== 'narr');
      g.setPreview(flow.run ? flow.run.fights[flow.i].stage : 0, null, null);
    }
    function adv() { ui.sfx('menuConfirm'); if (++i >= lines.length) next(); else show(); }
    show();
    return { el, key(ev) { if (['Enter', 'Space', 'NumpadEnter', 'ArrowRight'].includes(ev.code)) { adv(); return true; } if (ev.code === 'Escape') { next(); return true; } return true; } };
  });

  // ------------------------------------------------------------------ in-fight overlay (training toolbar)
  ui.register('fight', ({ cfg }) => {
    const el = h('div', { style: { pointerEvents: 'none' } });
    let keys = null;
    if (cfg.mode === 'training') {
      const dummies = [['stand', 'Stand'], ['crouch', 'Crouch'], ['block', 'Block'], ['blockLow', 'Block Low'], ['jump', 'Jump'], ['cpu', 'CPU'], ['record', 'Record'], ['playback', 'Playback']];
      const bar = h('div', { class: 'train-bar' }); const chips = [];
      const setDummy = (id, i) => { g.setDummy(id); chips.forEach((c, j) => c.classList.toggle('on', j === i)); ui.toast('Dummy: ' + dummies[i][1], 'info'); };
      dummies.forEach(([id, label], i) => { const c = h('span', { class: 'chip' + (i === 0 ? ' on' : ''), onClick: () => setDummy(id, i) }, h('b', null, i + 1), label); chips.push(c); bar.append(c); });
      const act = [['9', 'Reset positions', () => g.resetPositions()], ['0', 'Reset health', () => g.resetHealth()], ['-', 'Infinite health', () => ui.toast('Infinite health ' + (g.toggleInfHealth() ? 'ON' : 'OFF'), 'info')], ['=', 'Full meter', () => g.giveMeter()]];
      act.forEach(([k, l, fn]) => bar.append(h('span', { class: 'chip', onClick: fn }, h('b', null, k), l)));
      bar.append(h('span', { class: 'chip', onClick: () => g.requestPause() }, h('b', null, 'Esc'), 'Pause'));
      bar.style.pointerEvents = 'auto'; el.append(bar);
      keys = ev => {
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7 }[ev.code];
        if (n != null) setDummy(dummies[n][0], n);
        else if (ev.code === 'Digit9') g.resetPositions(); else if (ev.code === 'Digit0') g.resetHealth();
        else if (ev.code === 'Minus') act[2][2](); else if (ev.code === 'Equal') g.giveMeter();
      };
    }
    return { el, enter() { ui.trainingKeys = keys; }, exit() { ui.trainingKeys = null; }, back() { g.requestPause(); } };
  });

  // ------------------------------------------------------------------ pause
  ui.register('pause', () => {
    const resume = () => { ui.back(); g.setPaused(false); };
    const restart = () => { ui.back(); g.restartMatch(); };
    const el = h('div', { class: 'scrim' }, h('div', { class: 'pause-box panel' }, h('h1', null, 'Paused'),
      btn('Resume', resume, { def: true, icon: 'play' }), btn('Restart Match', restart),
      btn('Controls', () => ui.push('guide', { onClose: () => ui.back(), noMark: true })),
      btn('Settings', () => ui.push('settings', { from: 'pause' }), { icon: 'gear' }),
      btn('Quit to Main Menu', () => ui.push('confirm', { title: 'Quit match?', text: 'Progress in this match will be lost.', yes: 'Quit', onYes: () => { ui.back(); toMenu(); } }))));
    return { el, back: resume, key: ev => false };
  });

  // ------------------------------------------------------------------ result
  ui.register('result', ({ res }) => {
    const won = res.winner === 0 || (res.mode === 'twoPlayer' && res.winner >= 0);
    const human = res.mode === 'twoPlayer' ? (res.winner === 0 ? BY_ID[res.p1Id] : BY_ID[res.p2Id]) : BY_ID[res.p1Id];
    const run = flow.run, last = run && flow.i === run.fights.length - 1;
    const head = res.mode === 'twoPlayer' ? (res.winner === 0 ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS') : (won ? 'VICTORY' : 'DEFEAT');
    const row = (l, a, b) => h('tr', null, h('td', null, a), h('td', null, l), h('td', null, b));
    const s0 = res.stats[0], s1 = res.stats[1];
    const tbl = h('table', { class: 'stat-table' }, row('ROUNDS WON', res.wins[0], res.wins[1]), row('DAMAGE DEALT', Math.round(s0.dealt), Math.round(s1.dealt)), row('MAX COMBO', s0.maxCombo, s1.maxCombo), row('PARRIES', s0.parries, s1.parries), row('COUNTERS', s0.counters, s1.counters), row('HITS', s0.hits, s1.hits));
    const b = h('div', { class: 'btns' });
    const rematch = () => { ui.back(); g.restartMatch(); };
    if (run && won && !last) b.append(btn('Next Fight', () => { const f = run.fights[flow.i]; ui.back(); flow.i++; const go = () => nextFight(); if (flow.mode === 'story' && f.post.length) ui.go('dialogue', { lines: f.post, header: '', p1: flow.p1.id, p2: f.opp, next: go }); else go(); }, { def: true, icon: 'play' }));
    else if (run && won && last) b.append(btn(flow.mode === 'story' ? 'Ending' : 'Arcade Cleared', () => { g.endMatch(); ui.go('ending', { id: flow.p1.id, mode: flow.mode }); }, { def: true, icon: 'trophy' }));
    else if (run) b.append(btn('Retry Fight', rematch, { def: true }));
    else b.append(btn('Rematch', rematch, { def: true }));
    if (!run) b.append(btn('Change Fighters', () => { g.endMatch(); ui.go('select', { mode: flow.mode }); }));
    b.append(btn('Main Menu', toMenu));
    const el = h('div', { class: 'result scrim' }, h('div', { class: 'box panel' }, h('h1', { class: won ? 'win' : 'lose' }, head),
      h('div', { class: 'sub' }, `${human.name.toUpperCase()}  -  ${(res.time | 0)}s${res.flawless && won ? '  -  FLAWLESS' : ''}`), tbl, b));
    return { el, back: () => { } };
  });

  ui.register('ending', ({ id, mode }) => {
    const def = BY_ID[id];
    g.setPreview(2, null, null);
    const c = pcanvas(def, flow.p1.skin, 330, 420, 'bust'); c.style.cssText = 'position:absolute;left:120px;top:100px;border:2px solid var(--line)';
    const el = h('div', { class: 'dim' }, c, h('div', { style: { position: 'absolute', left: '500px', top: '140px', right: '90px' } },
      h('div', { class: 'tt', style: { color: 'var(--red)', letterSpacing: '.3em', fontWeight: 700 } }, mode === 'story' ? 'STORY COMPLETE' : 'ARCADE COMPLETE'), h('h1', { style: { fontSize: '56px', margin: '8px 0 16px' } }, def.name),
      h('p', { style: { fontSize: '26px', lineHeight: 1.5, color: '#dfe3ec' } }, def.ending), h('div', { style: { marginTop: '40px', width: '320px' } }, btn('Credits', () => ui.go('credits', { then: 'menu' }), { def: true }))));
    if (g.audio.ready) { g.audio.music.play('menu'); g.audio.play('roundWin'); }
    return { el, back: () => ui.go('credits', { then: 'menu' }) };
  });

  // ------------------------------------------------------------------ credits
  ui.register('credits', ({ then }) => {
    const roll = h('div', { class: 'roll' }); CREDITS.forEach(([a, b]) => roll.append(h('h3', null, a), h('p', null, b)));
    roll.append(h('h3', null, 'THANK YOU FOR PLAYING'));
    const done = () => { ui.go(then || 'menu'); };
    roll.addEventListener('animationend', done);
    const el = h('div', { class: 'credits', onClick: done }, roll, hint(['Esc', 'Back']));
    g.setPreview(2, null, null);
    return { el, back: done, key: () => false };
  });

  // ------------------------------------------------------------------ guide + confirm
  ui.register('guide', ({ onClose, noMark }) => {
    const b = S.settings.bindings, grid = h('div', { class: 'guide-grid' });
    for (const a of ['left', 'right', 'up', 'down', 'lp', 'hp', 'lk', 'hk', 'block', 'sp', 'ult', 'taunt'])
      grid.append(h('div', null, h('span', null, ACTION_LABELS[a]), h('b', null, prettyKey(b.p1[a]) + '  /  ' + prettyKey(b.p2[a]))));
    const el = h('div', { class: 'modal' }, h('div', { class: 'box panel' }, h('h2', null, 'Controls'),
      h('p', null, 'Player 1 / Player 2 keys. Single-player modes accept either set. Gamepad: face buttons attack, bumpers block/special, Start pauses.'), grid,
      h('p', null, 'Tap forward twice to dash. Block just before impact to parry. Block + Light Punch near an enemy to throw. Fill the meter, press Ultimate. Rebind anything in Settings.'),
      btn('Got it', () => { if (!noMark) S.setSetting('guideSeen', true); onClose && onClose(); }, { def: true })));
    return { el, back: () => { if (!noMark) S.setSetting('guideSeen', true); onClose && onClose(); } };
  });
  ui.register('confirm', ({ title, text, yes, onYes }) => {
    const el = h('div', { class: 'modal' }, h('div', { class: 'box panel', style: { width: '560px' } }, h('h2', null, title), h('p', null, text),
      h('div', { class: 'btns', style: { display: 'flex', gap: '10px', marginTop: '14px' } }, btn('Cancel', () => ui.back(), { def: true }), btn(yes || 'Confirm', () => { onYes && onYes(); }, { cls: 'primary' }))));
    return { el, back: () => ui.back() };
  });
}
