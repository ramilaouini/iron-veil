// Central input manager: configurable bindings, simultaneous keys, focus-loss safety, gamepads, menu edge events.
export const ACTIONS = ['left', 'right', 'up', 'down', 'lp', 'hp', 'lk', 'hk', 'block', 'sp', 'ult', 'taunt'];
export const ACTION_LABELS = { left: 'Move left', right: 'Move right', up: 'Jump', down: 'Crouch', lp: 'Light punch', hp: 'Heavy punch', lk: 'Light kick', hk: 'Heavy kick', block: 'Block / Parry', sp: 'Special', ult: 'Ultimate', taunt: 'Taunt' };

export const DEFAULT_BINDINGS = {
  p1: { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', lp: 'KeyJ', hp: 'KeyK', lk: 'KeyU', hk: 'KeyI', block: 'KeyL', sp: 'KeyO', ult: 'KeyP', taunt: 'KeyQ' },
  p2: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', lp: 'Numpad1', hp: 'Numpad2', lk: 'Numpad4', hk: 'Numpad5', block: 'Numpad6', sp: 'Numpad7', ult: 'Numpad8', taunt: 'Numpad9' },
};
export const MENU_KEYS = { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], confirm: ['Enter', 'Space', 'NumpadEnter'], back: ['Escape', 'Backspace'] };

export function prettyKey(code) {
  if (!code) return '-';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace(/^Numpad/, 'Num ').replace('Backquote', '`').replace('Semicolon', ';').replace('Comma', ',').replace('Period', '.').replace('Slash', '/');
}

export function validateBindings(b) {
  try {
    const out = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    if (!b || typeof b !== 'object') return out;
    for (const p of ['p1', 'p2']) if (b[p] && typeof b[p] === 'object') for (const a of ACTIONS) if (typeof b[p][a] === 'string' && b[p][a].length < 24) out[p][a] = b[p][a];
    return out;
  } catch { return JSON.parse(JSON.stringify(DEFAULT_BINDINGS)); }
}

// Returns list of conflicting [player, action] pairs that share the same code.
export function findConflicts(b) {
  const seen = new Map(), out = [];
  for (const p of ['p1', 'p2']) for (const a of ACTIONS) { const k = b[p][a]; if (seen.has(k)) out.push([p, a, ...seen.get(k)]); else seen.set(k, [p, a]); }
  return out;
}

export class InputManager {
  constructor(target = (typeof window !== 'undefined' ? window : null)) {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.down = new Set();
    this.menuQueue = [];
    this.gameplayKeys = new Set();
    this.captureHandler = null;   // for key rebinding
    this.padState = [{}, {}];
    this.padPrev = [{}, {}];
    this.target = target; this.enabledGameplay = false;
    this.rebuild();
    if (target && target.addEventListener) {
      target.addEventListener('keydown', e => this.onKeyDown(e));
      target.addEventListener('keyup', e => this.onKeyUp(e));
      target.addEventListener('blur', () => this.clear());
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    }
  }
  setBindings(b) { this.bindings = validateBindings(b); this.rebuild(); }
  rebuild() { this.gameplayKeys = new Set(); for (const p of ['p1', 'p2']) for (const a of ACTIONS) this.gameplayKeys.add(this.bindings[p][a]); }
  clear() { this.down.clear(); this.padState = [{}, {}]; }

  onKeyDown(e) {
    if (this.captureHandler) { e.preventDefault(); const h = this.captureHandler; this.captureHandler = null; h(e.code); return; }
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (this.enabledGameplay && (this.gameplayKeys.has(e.code) || e.code === 'Space' || e.code === 'Escape')) e.preventDefault();
    else if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) this.menuQueue.push({ code: e.code, key: e.key });
    this.down.add(e.code);
  }
  onKeyUp(e) { this.down.delete(e.code); }

  // Gameplay input for player index 0/1: merges keyboard and gamepad.
  read(i) {
    const b = this.bindings[i === 0 ? 'p1' : 'p2'], o = {};
    for (const a of ACTIONS) o[a] = this.down.has(b[a]) || !!this.padState[i][a];
    if (o.left && o.right) { o.left = o.right = false; }
    return o;
  }

  // Poll gamepads (called once per frame). Pad 0 -> P1, pad 1 -> P2 (single pad drives P1).
  pollPads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = [...navigator.getGamepads()].filter(Boolean);
    for (let i = 0; i < 2; i++) {
      const g = pads[i]; this.padPrev[i] = this.padState[i];
      if (!g) { this.padState[i] = {}; continue; }
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0, B = n => !!(g.buttons[n] && g.buttons[n].pressed);
      this.padState[i] = {
        left: ax < -0.5 || B(14), right: ax > 0.5 || B(15), up: ay < -0.6 || B(12), down: ay > 0.6 || B(13),
        lp: B(2), hp: B(3), lk: B(0), hk: B(1), block: B(4) || B(6), sp: B(5), ult: B(7), taunt: B(8),
        _start: B(9), _confirm: B(0), _back: B(1),
      };
      const s = this.padState[i], p = this.padPrev[i];
      if (s._start && !p._start) this.menuQueue.push({ code: 'Escape' });
      if (!this.enabledGameplay) {
        if (s._confirm && !p._confirm) this.menuQueue.push({ code: 'Enter' });
        if (s._back && !p._back) this.menuQueue.push({ code: 'Escape' });
        if (s.up && !p.up) this.menuQueue.push({ code: 'ArrowUp' });
        if (s.down && !p.down) this.menuQueue.push({ code: 'ArrowDown' });
        if (s.left && !p.left) this.menuQueue.push({ code: 'ArrowLeft' });
        if (s.right && !p.right) this.menuQueue.push({ code: 'ArrowRight' });
      }
    }
  }
  // Pull queued key-press events (menus, pause).
  drainMenu() { const q = this.menuQueue; this.menuQueue = []; return q; }
  static menuAction(code) { for (const k of Object.keys(MENU_KEYS)) if (MENU_KEYS[k].includes(code)) return k; return null; }
}
