import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { registerScreens } from './ui/screens_a.js';
import { registerScreensB, applyAccessibility } from './ui/screens_b.js';
import { ACTIONS } from './input/input.js';

const q = new URLSearchParams(location.search);
const fatal = document.getElementById('fatal');
function showFatal(e) { fatal.classList.remove('hidden'); fatal.innerHTML = '<div><h2>Something went wrong</h2><p>' + String(e && e.message || e) + '</p><p>Reload the page to continue. Your save is safe.</p></div>'; }
try {
  const game = new Game(document.getElementById('game'), { dev: q.has('dev'), unlockAll: q.has('unlock') });
  window.game = game;
  game.onError = showFatal;
  const ui = new UI(game, document.getElementById('ui'), document.getElementById('toasts'));
  window.ui = ui;
  registerScreens(ui); registerScreensB(ui); applyAccessibility(game);
  window.addEventListener('keydown', e => {
    if (e.code === 'Tab' || ((e.code === 'Enter' || e.code === 'Space') && e.target.tagName === 'BUTTON')) e.preventDefault();
    if (e.code === 'F3' && game.dev) { e.preventDefault(); game.toggleDebug(); }
    if (e.code === 'F11') { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); }
  });
  game.start();
  ui.go(q.has('skip') ? 'title' : 'splash');

  // touch controls (shown only on touch devices)
  if (matchMedia('(pointer: coarse)').matches) {
    const root = document.getElementById('touch'); root.classList.remove('hidden');
    const b = game.save.settings.bindings.p1;
    const mk = (label, act, x, y, s = 70) => {
      const el = document.createElement('div'); el.className = 'tb'; el.textContent = label; el.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px`;
      const send = t => window.dispatchEvent(new KeyboardEvent(t, { code: game.save.settings.bindings.p1[act], bubbles: true }));
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('on'); game.audio.init(); send('keydown'); });
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, () => { el.classList.remove('on'); send('keyup'); });
      root.append(el);
    };
    mk('<', 'left', 20, 560); mk('>', 'right', 170, 560); mk('^', 'up', 95, 490); mk('v', 'down', 95, 630, 60);
    mk('LP', 'lp', 1010, 520); mk('HP', 'hp', 1090, 480); mk('LK', 'lk', 1010, 610); mk('HK', 'hk', 1090, 570);
    mk('BLK', 'block', 930, 560, 60); mk('SP', 'sp', 1180, 440, 60); mk('ULT', 'ult', 1180, 520, 60);
    mk('II', 'pause', 1200, 10, 50);
    root.lastChild.addEventListener('pointerdown', () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })));
  }
} catch (e) { console.error(e); showFatal(e); }
