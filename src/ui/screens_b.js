// Settings, character gallery (with Animation Lab), cosmetics/achievements.
import { h, icon } from './dom.js';
import { ROSTER, BY_ID } from '../characters/roster.js';
import { ACHIEVEMENTS } from '../progression/save.js';
import { ACTIONS, ACTION_LABELS, prettyKey, DEFAULT_BINDINGS } from '../input/input.js';
import { CLIP_NAMES } from '../characters/poses.js';
import { pcanvas } from './screens_a.js';

const btn = (label, onClick, o = {}) => h('button', { class: 'btn ' + (o.cls || ''), 'data-nav': true, 'data-nav-default': o.def, onClick, type: 'button' }, o.icon ? icon(o.icon, 22) : null, label);

export function applyAccessibility(g) {
  const s = g.save.settings;
  document.body.classList.toggle('hc', !!s.highContrast); document.body.classList.toggle('big-text', !!s.bigText); document.body.classList.toggle('reduce-motion', s.motion === 0);
}

export function registerScreensB(ui) {
  const g = ui.game, S = g.save;

  // ------------------------------------------------------------------ settings
  ui.register('settings', ({ from }) => {
    const body = h('div', { class: 'tab-body' }), tabs = h('div', { class: 'tabs' });
    const apply = () => { g.applySettings(); applyAccessibility(g); };
    const row = (label, desc, control, onCycle, onClick) => {
      const r = h('div', { class: 'set-row', 'data-nav': true, 'data-cycle': true }, h('span', { class: 'lbl' }, label), control, h('span', { class: 'desc' }, desc || ''));
      r.addEventListener('cycle', e => onCycle && onCycle(e.detail)); r.addEventListener('click', e => { if (e.target.tagName !== 'INPUT') onClick && onClick(); }); return r;
    };
    const slider = (label, key, desc, min = 0, max = 1, step = 0.05, after) => {
      const inp = h('input', { type: 'range', min, max, step, value: S.settings[key], tabindex: -1 }), val = h('span', { class: 'val' }, Math.round(S.settings[key] * 100) + '%');
      const set = v => { v = Math.max(min, Math.min(max, +v)); inp.value = v; S.setSetting(key, +v); val.textContent = Math.round(v * 100) + '%'; apply(); after && after(v); };
      inp.addEventListener('input', () => set(inp.value));
      return row(label, desc, h('span', { class: 'row' }, inp, val), d => set(+inp.value + d * step));
    };
    const toggle = (label, key, desc) => {
      const t = h('span', { class: 'toggle' }); const draw = () => { t.textContent = S.settings[key] ? 'ON' : 'OFF'; t.classList.toggle('on', !!S.settings[key]); }; draw();
      const flip = () => { S.setSetting(key, !S.settings[key]); draw(); apply(); }; return row(label, desc, t, flip, flip);
    };
    const choice = (label, key, opts, desc, fmt = String) => {
      const t = h('span', { class: 'toggle' }); const draw = () => { t.textContent = fmt(S.settings[key]); }; draw();
      const step = d => { const i = opts.indexOf(S.settings[key]); S.setSetting(key, opts[(i + d + opts.length) % opts.length]); draw(); apply(); };
      return row(label, desc, t, step, () => step(1));
    };
    const action = (label, desc, fn) => row(label, desc, h('span', { class: 'toggle' }, 'GO'), null, fn);
    const warn = h('div', { class: 'warn' });
    const tabsDef = {
      Audio: () => [slider('Master volume', 'master'), slider('Music', 'music'), slider('Effects', 'sfx'), slider('Ambience', 'ambient'),
        action('Sound test', 'Plays a hit, a parry and a music sting', () => { g.audio.init(); g.audio.play('heavyPunch'); setTimeout(() => g.audio.play('parry'), 350); setTimeout(() => g.audio.play('roundWin'), 800); })],
      Gameplay: () => [choice('Default difficulty', 'difficulty', ['easy', 'normal', 'hard', 'expert'], 'CPU skill in Versus', s => s.toUpperCase()), choice('Round time', 'roundTime', [30, 60, 99], 'Seconds per round', s => s + 's'), choice('Rounds to win', 'roundsToWin', [1, 2, 3], 'First to N', String),
        choice('Quality', 'quality', ['high', 'low'], 'Low reduces particles for slow machines', s => s.toUpperCase()),
        action('Toggle fullscreen', 'Also F11', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => ui.toast('Fullscreen blocked by the browser', 'info')); })],
      Accessibility: () => [slider('Screen shake', 'shake', 'Hit shake strength'), slider('Motion', 'motion', '0 disables UI animation and halves camera motion', 0, 1, 0.5), slider('Background motion', 'bgMotion', 'Parallax 3D background depth strength', 0, 1, 0.05), toggle('Reduce flashing', 'reduceFlash', 'Dims full-screen flashes'), toggle('Reduce effects', 'reduceFx', 'Fewer particles'), toggle('High contrast UI', 'highContrast'), toggle('Large text', 'bigText')],
      Controls: () => controls(),
      Data: () => [action('Restore default settings', 'Keeps progress', () => ui.push('confirm', { title: 'Restore defaults?', text: 'Audio, gameplay, accessibility and controls return to defaults.', yes: 'Restore', onYes: () => { S.restoreDefaults(); apply(); ui.back(); show('Data'); ui.toast('Settings restored', 'info'); } })),
        action('Reset all progress', 'Deletes wins, unlocks and achievements', () => ui.push('confirm', { title: 'Reset progress?', text: 'All statistics, unlocked costumes and achievements will be erased. This cannot be undone.', yes: 'Erase', onYes: () => { S.resetProgress(); ui.back(); ui.toast('Progress reset', 'info'); } }))],
    };
    function controls() {
      const out = [];
      for (const p of ['p1', 'p2']) {
        out.push(h('h3', { style: { margin: '10px 12px', color: 'var(--red)' } }, p === 'p1' ? 'PLAYER 1' : 'PLAYER 2'));
        for (const a of ACTIONS) {
          const kb = h('button', { class: 'keybtn', tabindex: -1, type: 'button' }, prettyKey(S.settings.bindings[p][a]));
          const start = () => {
            kb.classList.add('listen'); kb.textContent = 'PRESS KEY'; warn.textContent = 'Press a key (Esc cancels)';
            g.input.captureHandler = code => {
              kb.classList.remove('listen');
              if (code !== 'Escape') {
                if (['Enter', 'Tab', 'F2', 'F3', 'F11'].includes(code)) warn.textContent = 'That key is reserved.';
                else {
                  const b = S.settings.bindings; let swap = null;
                  for (const q of ['p1', 'p2']) for (const x of ACTIONS) if (b[q][x] === code && !(q === p && x === a)) swap = [q, x];
                  const old = b[p][a]; if (swap) { b[swap[0]][swap[1]] = old; warn.textContent = `Swapped with ${swap[0].toUpperCase()} ${ACTION_LABELS[swap[1]]}.`; } else warn.textContent = '';
                  b[p][a] = code; S.setSetting('bindings', b); apply();
                }
              } else warn.textContent = '';
              show('Controls');
            };
          };
          kb.addEventListener('click', start);
          out.push(h('div', { class: 'set-row', 'data-nav': true, onClick: start }, h('span', { class: 'lbl' }, ACTION_LABELS[a]), kb));
        }
      }
      out.push(action('Reset controls to default', '', () => { S.setSetting('bindings', JSON.parse(JSON.stringify(DEFAULT_BINDINGS))); apply(); show('Controls'); }));
      return out;
    }
    let curTab = 'Audio'; const tabBtns = {};
    function show(name) {
      curTab = name; body.innerHTML = ''; warn.textContent = warn.textContent;
      for (const k in tabBtns) tabBtns[k].classList.toggle('primary', k === name);
      body.append(...tabsDef[name](), warn);
    }
    Object.keys(tabsDef).forEach(k => { const b = btn(k, () => show(k), { def: k === 'Audio' }); b.addEventListener('navfocus', () => { if (curTab !== k) show(k); }); tabBtns[k] = b; tabs.append(b); });
    show('Audio');
    const el = h('div', { class: 'dim' }, h('div', { class: 'title-h' }, 'Settings', h('small', null, 'CHANGES SAVE AUTOMATICALLY')), h('div', { class: 'settings' }, tabs, h('div', { class: 'panel', style: { flex: 1, padding: 0, display: 'flex' } }, body)),
      h('div', { class: 'hint-bar' }, h('span', null, h('b', null, 'Left Right'), 'Adjust'), h('span', null, h('b', null, 'Enter'), 'Toggle / Rebind'), h('span', null, h('b', null, 'Esc'), 'Back')));
    el.style.background = from === 'pause' ? 'rgba(0,0,0,.88)' : '';
    return { el, back: () => { if (g.input.captureHandler) return; if (from === 'pause') ui.back(); else ui.go('menu'); }, exit: () => { g.input.captureHandler = null; } };
  });

  // ------------------------------------------------------------------ gallery + animation lab
  ui.register('gallery', () => {
    let id = 'kael', skin = 0, clip = null, lab = false, actor = null;
    const list = h('div', { class: 'gal-list' }), side = h('div', { class: 'gal-side' }), labBar = h('div', { class: 'row panel hidden', style: { position: 'absolute', left: '56px', bottom: '52px', padding: '8px 12px', zIndex: 3 } });
    g.bg.offset = -292;
    const mk = () => { const a = g.makeActor(id, skin, 1); g.setPreview(2, a, null); actor = a; if (clip) { a.auto = false; a.play(clip); } };
    function drawLab() {
      labBar.innerHTML = ''; labBar.append(h('b', null, 'ANIMATION LAB'),
        h('span', { class: 'chip', onClick: () => { actor.paused = !actor.paused; drawLab(); } }, actor.paused ? 'Resume' : 'Pause'), h('span', { class: 'chip', onClick: () => { actor.paused = true; actor.step(); } }, 'Step'),
        ...[0.25, 0.5, 1].map(s => h('span', { class: 'chip' + (actor.speed === s ? ' on' : ''), onClick: () => { actor.speed = s; actor.update = function () { if (!this.paused) { this._a = (this._a || 0) + this.speed; while (this._a >= 1) { this._a--; this.step(); } } }; drawLab(); } }, s + 'x')),
        h('span', { class: 'chip' + (actor.auto ? ' on' : ''), onClick: () => { actor.auto = !actor.auto; drawLab(); } }, 'Auto cycle'), h('span', { style: { color: 'var(--mute)' } }, `clip ${actor.clip}  frame ${actor.t}`));
    }
    const mvOrder = ['lp', 'hp', 'lk', 'hk', 'cl', 'ck', 'up', 'sw', 'ap', 'ak', 'th', 'sp1', 'sp2', 'ult'];
    function draw() {
      const c = BY_ID[id]; side.innerHTML = '';
      const skins = h('div', { class: 'skin-row' }, ...c.skins.map((sk, i) => h('div', { class: 'skin' + (i === skin ? ' on' : ''), 'data-nav': true, onClick: () => { skin = i; mk(); draw(); } }, h('i', { class: 'sw', style: { background: sk.pal.glow } }), sk.name, S.isUnlocked(id, i) ? null : icon('lock', 14))));
      const rows = mvOrder.filter(k => c.moves[k]).map(k => { const m = c.moves[k]; return h('tr', { 'data-nav': true, class: clip === 'move:' + k ? 'sel' : '', onClick: () => { clip = 'move:' + k; actor.auto = false; actor.play(clip); draw(); } },
        h('td', null, m.name), h('td', null, k.toUpperCase()), h('td', null, m.startup), h('td', null, m.active), h('td', null, m.recovery), h('td', null, m.damage || m.finalDamage || '-'), h('td', null, m.level)); });
      const clips = h('div', { class: 'clip-row' }, ...CLIP_NAMES.map(n => h('span', { class: 'chip' + (clip === n ? ' on' : ''), 'data-nav': true, onClick: () => { clip = n; actor.auto = false; actor.play(n); draw(); } }, n)));
      side.append(h('div', { style: { color: 'var(--red)', letterSpacing: '.2em', fontWeight: 700 } }, c.title), h('h2', null, c.name), h('div', { style: { color: 'var(--mute)', letterSpacing: '.14em' } }, c.style.toUpperCase()), h('div', { class: 'bio' }, c.bio), skins,
        h('div', { class: 'moves' }, h('table', null, h('thead', null, h('tr', null, ['Move', 'Key', 'Start', 'Active', 'Recov', 'Dmg', 'Level'].map(t => h('th', null, t)))), h('tbody', null, rows))), clips);
      if (lab) drawLab();
    }
    ROSTER.forEach(c => { const cell = h('button', { class: 'cell', 'data-nav': true, 'data-nav-default': c.id === id, type: 'button', onClick: () => { id = c.id; skin = 0; clip = null; mk(); draw(); } }, pcanvas(c, 0, 74, 74, 'bust')); list.append(cell); });
    mk(); draw();
    const el = h('div', { class: 'dim' }, h('div', { class: 'title-h' }, 'Character Gallery', h('small', null, 'F2 - ANIMATION LAB')), list, side, labBar,
      h('div', { class: 'hint-bar' }, h('span', null, h('b', null, 'Enter'), 'Select / play'), h('span', null, h('b', null, 'F2'), 'Animation lab'), h('span', null, h('b', null, 'Esc'), 'Back')));
    const t = setInterval(() => { if (lab && actor) drawLab(); }, 200);
    return { el, key(ev) { if (ev.code === 'F2') { lab = !lab; labBar.classList.toggle('hidden', !lab); if (lab) drawLab(); return true; } return false; }, back: () => ui.go('menu'), exit() { clearInterval(t); g.bg.offset = 0; } };
  });

  // ------------------------------------------------------------------ cosmetics, achievements, records
  ui.register('cosmetics', () => {
    const chars = h('div', { class: 'cos-chars' }), side = h('div', { class: 'panel', style: { overflowY: 'auto' } });
    function draw() {
      chars.innerHTML = '';
      ROSTER.forEach(c => {
        const card = h('div', { class: 'cos-card' }, h('b', null, c.name), h('div', { class: 'skins' }));
        c.skins.forEach((sk, i) => {
          const un = S.isUnlocked(c.id, i), eq = S.equipped(c.id) === i;
          const t = h('button', { class: 'skin-tile' + (un ? '' : ' locked') + (eq ? ' eq' : ''), 'data-nav': true, type: 'button', onClick: () => { if (!un) { ui.toast('Locked: ' + sk.unlock.label, 'info'); return; } S.equip(c.id, i); ui.sfx('menuConfirm'); draw(); } },
            pcanvas(c, i, 110, 130, 'bust'), h('div', { class: 'nm' }, sk.name + (eq ? ' *' : '')), un ? null : h('div', { class: 'lk' }, h('span', null, 'LOCKED', h('br'), sk.unlock.label)));
          card.lastChild.append(t);
        });
        chars.append(card);
      });
      const st = S.data.stats;
      side.innerHTML = ''; side.append(h('h3', null, 'Achievements'), ...ACHIEVEMENTS.map(a => h('div', { class: 'ach' + (S.data.achievements[a.id] ? ' done' : '') }, icon(S.data.achievements[a.id] ? 'trophy' : 'lock', 18), h('div', null, a.name, h('small', null, a.desc)))),
        h('h3', { style: { marginTop: '14px' } }, 'Records'), h('div', { class: 'recs' }, `Matches ${st.played}  -  Wins ${st.won}  -  Losses ${st.lost}`, h('br'), `Best streak ${st.bestStreak}  -  Best combo ${st.maxCombo}`, h('br'), `Parries ${st.parries}  -  Counters ${st.counters}`));
    }
    draw(); g.setPreview(2, null, null);
    const el = h('div', { class: 'dim' }, h('div', { class: 'title-h' }, 'Cosmetics', h('small', null, 'ENTER EQUIPS THE SELECTED COSTUME  -  * = EQUIPPED')), h('div', { class: 'cos-grid' }, chars, side), h('div', { class: 'hint-bar' }, h('span', null, h('b', null, 'Enter'), 'Equip'), h('span', null, h('b', null, 'Esc'), 'Back')));
    return { el, back: () => ui.go('menu') };
  });
}
