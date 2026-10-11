// Small DOM toolkit: element builder, spatial keyboard navigation, toasts and confirm dialogs.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

// Inline SVG icon set (original, drawn here - no emoji, no external files).
const ICONS = {
  sword: '<path d="M4 20 L16 8 M14 4 L20 4 L20 10 L10 20 M3 21 l3-3" />',
  fist: '<path d="M6 12 v-3 a2 2 0 0 1 4 0 v-1 a2 2 0 0 1 4 0 v1 a2 2 0 0 1 4 0 v5 a6 6 0 0 1-6 6 h-1 a5 5 0 0 1-5-5z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11 V8 a4 4 0 0 1 8 0 v3"/>',
  check: '<path d="M5 12 l5 5 L19 7"/>',
  star: '<path d="M12 3 l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8z"/>',
  arrowL: '<path d="M15 5 L8 12 l7 7"/>', arrowR: '<path d="M9 5 l7 7-7 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M5 5 l2 2 M17 17 l2 2 M19 5 l-2 2 M7 17 l-2 2"/>',
  play: '<path d="M7 4 L19 12 7 20z"/>', pause: '<path d="M8 5 v14 M16 5 v14"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
  trophy: '<path d="M7 4 h10 v5 a5 5 0 0 1-10 0z M7 6 H4 v2 a3 3 0 0 0 3 3 M17 6 h3 v2 a3 3 0 0 1-3 3 M12 14 v4 M8 20 h8"/>',
  eye: '<path d="M2 12 s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
};
export function icon(name, size = 20) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || ''; return s;
}

// ------------------------------------------------------------------------------------------------
// Spatial navigation over elements marked with [data-nav] inside a root. Works for lists, grids, rows.
export class Nav {
  constructor(root, opts = {}) { this.root = root; this.cur = null; this.onMove = opts.onMove || null; }
  items() { return [...this.root.querySelectorAll('[data-nav]')].filter(e => !e.disabled && e.offsetParent !== null && !e.closest('.hidden')); }
  focus(el, silent) {
    if (this.cur && this.cur !== el) this.cur.classList.remove('nav-focus');
    this.cur = el; if (!el) return;
    el.classList.add('nav-focus'); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    if (!silent && this.onMove) this.onMove(el);
    el.dispatchEvent(new CustomEvent('navfocus', { bubbles: false }));
  }
  first() { const it = this.items(); if (it.length) this.focus(this.root.querySelector('[data-nav-default]:not([disabled])') || it[0], true); }
  move(dir) {
    const items = this.items(); if (!items.length) return false;
    if (!this.cur || !items.includes(this.cur)) { this.focus(items[0]); return true; }
    const r = this.cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === this.cur) continue;
      const b = el.getBoundingClientRect(), ex = b.left + b.width / 2, ey = b.top + b.height / 2, dx = ex - cx, dy = ey - cy;
      let ok = false, primary = 0, secondary = 0;
      if (dir === 'up') { ok = dy < -4 && Math.abs(dy) >= Math.abs(dx) * 0.5; primary = -dy; secondary = Math.abs(dx); }
      if (dir === 'down') { ok = dy > 4 && Math.abs(dy) >= Math.abs(dx) * 0.5; primary = dy; secondary = Math.abs(dx); }
      if (dir === 'left') { ok = dx < -4 && Math.abs(dx) >= Math.abs(dy) * 0.5; primary = -dx; secondary = Math.abs(dy); }
      if (dir === 'right') { ok = dx > 4 && Math.abs(dx) >= Math.abs(dy) * 0.5; primary = dx; secondary = Math.abs(dy); }
      if (!ok) continue;
      const score = primary + secondary * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) { this.focus(best); return true; }
    return false;
  }
  // Left/right on a slider or cycler adjusts it instead of moving focus.
  adjust(dir) {
    const el = this.cur; if (!el) return false;
    if (el.matches('input[type=range]')) { const step = +(el.step || 1) * (dir === 'left' ? -1 : 1); el.value = Math.max(+el.min, Math.min(+el.max, +el.value + step)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    if (el.hasAttribute('data-cycle')) { el.dispatchEvent(new CustomEvent('cycle', { detail: dir === 'left' ? -1 : 1 })); return true; }
    return false;
  }
  activate() { if (this.cur) { this.cur.click(); return true; } return false; }
}

// ------------------------------------------------------------------------------------------------
export function toast(container, text, kind = 'info', ms = 3200) {
  const el = h('div', { class: 'toast ' + kind }, h('span', { class: 'toast-k' }, kind === 'achievement' ? 'ACHIEVEMENT' : kind === 'skin' ? 'COSMETIC UNLOCKED' : 'NOTICE'), h('span', { class: 'toast-t' }, text));
  container.append(el);
  while (container.children.length > 4) container.firstChild.remove();
  setTimeout(() => el.classList.add('out'), ms); setTimeout(() => el.remove(), ms + 500);
  return el;
}
