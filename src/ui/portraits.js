// Portrait generation: bust crops of each fighter in each skin, rendered from the real fighter renderer
// onto a themed backdrop. Cached by (fighter, skin, size). Used by select screens, versus screen and HUD icons.
import { FighterRenderer, PX } from '../render/fighter_renderer.js';
import { Fighter } from '../combat/fighter.js';
import { shade } from '../render/fighter_renderer.js';

const R = new FighterRenderer();
const cache = new Map();

const POSES = { kael: { uf: 90, ef: 150 }, nyra: { ln: 14 }, bram: { ln: 10 }, sora: {}, vex: {}, sera: {} };

export function portrait(def, skin = 0, w = 300, h = 400, mode = 'bust') {
  const key = `${def.id}:${skin}:${w}:${h}:${mode}`;
  let c = cache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), pal = def.skins[skin].pal;
  // backdrop: coloured light + circuit rings + emblem
  const bg = x.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, shade(pal.glow, -0.82)); bg.addColorStop(1, '#050507'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const rgl = x.createRadialGradient(w * 0.5, h * 0.38, 4, w * 0.5, h * 0.38, h * 0.65); rgl.addColorStop(0, pal.glow + '66'); rgl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rgl; x.fillRect(0, 0, w, h);
  x.strokeStyle = pal.glow + '55'; x.lineWidth = 2;
  for (let r = 0.3; r < 1.1; r += 0.18) { x.beginPath(); x.arc(w * 0.5, h * 0.38, h * r * 0.8, 0, 7); x.stroke(); }
  x.save(); x.translate(w * 0.5, h * 0.38); x.rotate(0.3); x.strokeStyle = pal.glow + '44'; x.lineWidth = 1;
  for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(h * 0.35, 0); x.lineTo(h * 0.85, 0); x.stroke(); } x.restore();
  // fighter
  const f = new Fighter(0, def, skin); f.reset(0, 1); f._pose = null; f.anim = { name: 'idle', frame: 0 };
  const sc = (h / 175) * (mode === 'bust' ? 1.0 : 0.62) / def.prop.s * (def.id === 'bram' ? 0.95 : 1);
  const s = def.prop.s * sc;
  x.save();
  const feetY = mode === 'bust' ? h * 0.08 + 192 * def.prop.s * sc * 0.95 + (def.id === 'bram' ? 0 : 0) : h * 0.97;
  x.translate(w * (mode === 'bust' ? 0.46 : 0.5), feetY); x.scale(sc, sc);
  R.draw(x, f, 0, 0, 40, {});
  x.restore();
  // bottom fade + frame
  const fade = x.createLinearGradient(0, h * 0.72, 0, h); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,0.85)'); x.fillStyle = fade; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(200,205,215,0.55)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3);
  cache.set(key, c); return c;
}

export function icon(def, skin = 0, size = 64) {
  const key = `icon:${def.id}:${skin}:${size}`; let c = cache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const p = portrait(def, skin, 240, 240, 'bust');
  x.drawImage(p, 20, 6, 200, 200, 0, 0, size, size); cache.set(key, c); return c;
}
