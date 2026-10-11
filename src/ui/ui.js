// UI manager: a stack of DOM screens layered over the canvas, with spatial keyboard/gamepad navigation.
import { Nav, h, toast } from './dom.js';
import { InputManager } from '../input/input.js';

export class UI {
  constructor(game, root, toastRoot) {
    this.game = game; this.root = root; this.toastRoot = toastRoot;
    this.screens = {}; this.stack = []; this.trainingKeys = null;
    root.addEventListener('mouseover', e => { const t = this.top; const el = e.target.closest && e.target.closest('[data-nav]'); if (t && el && t.nav && t.el.contains(el) && t.nav.cur !== el) t.nav.focus(el); });
    window.addEventListener('pointerdown', () => game.audio.init(), { passive: true });
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
    game.onPauseRequest = () => { if (!this.is('pause')) this.push('pause'); };
    game.onToast = n => this.toast(n.text, n.kind);
    game.onMatchEnd = res => this.onMatchEnd && this.onMatchEnd(res);
  }
  register(name, factory) { this.screens[name] = factory; }
  get top() { return this.stack[this.stack.length - 1] || null; }
  is(name) { return this.top && this.top.name === name; }
  has(name) { return this.stack.some(s => s.name === name); }

  _mount(name, params, overlay) {
    const factory = this.screens[name]; if (!factory) throw new Error('Unknown screen ' + name);
    const s = factory(params || {}, this); s.name = name; s.params = params || {}; s.overlay = overlay;
    s.el.classList.add('screen'); if (overlay) s.el.classList.add('overlay');
    s.nav = new Nav(s.el, { onMove: () => this.game.audio.ready && this.game.audio.play('menuMove') });
    this.root.append(s.el);
    this.stack.push(s);
    if (s.enter) s.enter();
    s.nav.first();
    return s;
  }
  // Replace the whole stack with a new screen.
  go(name, params) {
    while (this.stack.length) this._pop(true);
    this._mount(name, params, false);
  }
  // Layer a screen above the current one (pause, settings, modals).
  push(name, params) {
    const t = this.top; if (t) t.el.classList.add('under');
    return this._mount(name, params, true);
  }
  _pop() { const s = this.stack.pop(); if (!s) return; if (s.exit) s.exit(); s.el.remove(); }
  back() {
    if (this.stack.length < 2) return false;
    this._pop(); const t = this.top; t.el.classList.remove('under'); if (t.resume) t.resume(); if (t.nav) { t.nav.cur = null; t.nav.first(); }
    return true;
  }
  toast(text, kind) { toast(this.toastRoot, text, kind); if (kind === 'achievement' || kind === 'skin') this.game.audio.ready && this.game.audio.play('unlock'); }
  sfx(n) { if (this.game.audio.ready) this.game.audio.play(n); }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    try { this.update(); } catch (e) { console.error('[IronVeil] UI error', e); if (this.game.onError) this.game.onError(e); }
  }

  update() {
    const g = this.game, q = g.input.drainMenu();
    if (g.input.captureHandler) return;
    for (const ev of q) {
      // in a match (and not paused) only a few keys matter
      if (g.view === 'fight' && !g.paused && !this.has('pause') && !this.has('result') && !this.has('modal')) {
        if (ev.code === 'Escape' || ev.code === 'KeyP' && false) g.requestPause();
        else if (this.trainingKeys) this.trainingKeys(ev);
        continue;
      }
      const t = this.top; if (!t) continue;
      if (t.key && t.key(ev) === true) continue;
      const act = InputManager.menuAction(ev.code), nav = t.nav;
      if (!act) continue;
      if (act === 'up' || act === 'down') nav.move(act);
      else if (act === 'left' || act === 'right') { if (!nav.adjust(act)) nav.move(act); }
      else if (act === 'confirm') { if (nav.cur) { this.sfx('menuConfirm'); nav.activate(); } }
      else if (act === 'back') { if (t.back) t.back(); else if (this.back()) this.sfx('menuBack'); }
    }
  }
}
