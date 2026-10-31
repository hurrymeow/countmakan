// Tower rendering. Floor data in, HTML out. Sprites live in img/tower/shops/.
// A floor is three clipped segments (protein, carbs, fat). Each segment leads with its shop's
// signature prop so a narrow share still reads as that shop, then adds the door edge when
// there is room, then tiles the middle piece to fill.
import { hash } from './tower.js';

const DIR = 'img/tower/shops/';
// Native sprite sizes [w, h] per shop and piece.
const flat = { edge: [131, 108], sig: [298, 108], mid: [302, 108] };
const tall = (sig, h = 111) => ({ edge: [133, h], sig: [sig, h], mid: [40, h] });
export const SIZES = {
  sport: flat, office: flat, butch: { edge: [131, 108], sig: [106, 108], mid: [302, 108] },
  boxing: tall(306), pool: tall(306), dojo: tall(305), bakery: tall(306), noodle: tall(305), pizza: tall(298, 112),
  fish: tall(306), deli: tall(305), nut: tall(306),
};
export const SPRITES = [
  ...Object.keys(SIZES).flatMap((k) => ['edge', 'sig', 'mid'].map((p) => `${k}-${p}`)),
  'mess-ceiling', 'mess-clutter', 'mess-tape', 'roof-wide', 'lobby-wide', 'slab', 'sky',
  ...Object.keys({ gym: 0, office: 0, shopper: 0, old: 0, kid: 0, rider: 0 }).map((n) => `w-${n}`),
];
// Floor aspect: the tower floors are drawn about 3.6 times wider than tall.
export const FLOOR_RATIO = 3.64;

// Walk strips: [cell width, frame count], drawn 96px tall. Each is one person, frames side by side.
export const WALKERS = { gym: [46, 4], office: [49, 4], shopper: [44, 4], old: [45, 4], kid: [39, 2], rider: [46, 4] };
const WALKER_NAMES = Object.keys(WALKERS);
const STRIP_H = 96;
const img = (name, style = '', cls = '') => `<img src="${DIR}${name}.png" alt=""${cls ? ` class="${cls}"` : ''} style="${style}" draggable="false">`;

function segmentHtml(kind, w, H) {
  const sz = SIZES[kind];
  const s = H / sz.sig[1];
  const pieces = ['sig'];
  let used = sz.sig[0] * s;
  if (used + sz.edge[0] * s < w) { pieces.unshift('edge'); used += sz.edge[0] * s; }
  while (used < w) { pieces.push('mid'); used += sz.mid[0] * s; }
  return `<div class="seg" style="width:${w}px">${pieces.map((p) => img(`${kind}-${p}`, `height:${H}px`)).join('')}</div>`;
}

// Walkers cross the whole floor, entering and leaving at its edges, so none pop in or out.
// They all walk the same way at the same pace and start evenly spread, so they never overlap.
const WALK_SPEED = 28; // px per second, about one stride per frame swap
const WALK_PAD = 60;
function walkersHtml(floor, seed, H, W) {
  const n = floor.walkers;
  const route = W + WALK_PAD + 12;
  const dur = route / WALK_SPEED;
  let out = '';
  for (let i = 0; i < n; i++) {
    const name = WALKER_NAMES[(seed + i * 3) % WALKER_NAMES.length];
    const [cw, frames] = WALKERS[name];
    const h = H * 0.45;
    const k = h / STRIP_H;
    const delay = -((i + ((seed % 7) / 7)) / n) * dur;
    out += `<div class="walker" style="width:${(cw * k).toFixed(1)}px;height:${h.toFixed(1)}px;--n:${frames};--sw:${(cw * frames * k).toFixed(1)}px;animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s"><span style="background-image:url(${DIR}w-${name}.png)"></span></div>`;
  }
  return out;
}

function messHtml(seed, H) {
  const px = (n) => n.toFixed(1);
  return `<span class="dim"></span>`
    + img('mess-ceiling', `left:${18 + (seed % 40)}%;top:0;height:${px(H * 0.32)}px`, 'mess')
    + img('mess-clutter', `left:${8 + (seed % 30)}%;bottom:2px;height:${px(H * 0.45)}px`, 'mess')
    + img('mess-clutter', `left:${58 + (seed % 20)}%;bottom:2px;height:${px(H * 0.38)}px;transform:scaleX(-1)`, 'mess')
    + img('mess-tape', `left:40%;top:${px(H * 0.35)}px;height:${px(H * 0.3)}px`, 'mess');
}

export const slabHtml = (W, H) => `<span class="slab" style="width:${W + 8}px;height:${Math.max(4, Math.round(H * 0.09))}px"></span>`;

// One floor at width W and height H, with the slab below it.
export function floorHtml(floor, W, H) {
  const seed = hash(floor.day);
  const cls = ['floor', floor.live ? 'tonight' : '', floor.messy ? 'messy' : ''].filter(Boolean).join(' ');
  const keys = ['protein', 'carbs', 'fat'];
  let used = 0;
  const segs = keys.map((k, i) => {
    const w = i === 2 ? W - used : Math.round(W * floor.share[k]);
    used += w;
    return segmentHtml(floor.shops[i], w, H);
  }).join('');
  const body = segs + (floor.messy ? messHtml(seed, H) : walkersHtml(floor, seed, H, W));
  return `<div class="${cls}" style="width:${W}px;height:${H}px;--w:${W}px">${body}</div>${slabHtml(W, H)}`;
}

// Tonight before any meal is logged: an empty dashed floor.
export const emptyTonightHtml = (W, H) => `<span class="floor tonight empty" style="width:${W}px;height:${H}px"></span>${slabHtml(W, H)}`;

export const roofHtml = (W) => `<div class="roof">${img('roof-wide', `width:${W}px`)}</div>`;
export const lobbyHtml = (W) => `<div class="roof">${img('lobby-wide', `width:${W}px;display:block`)}</div>`;

// Roof, tonight, then floors newest first. `limit` caps how many past floors are drawn.
export function towerHtml(m, W, H, { limit = Infinity, ground = false } = {}) {
  const newest = m.floors.slice(-Math.min(limit, m.floors.length)).reverse();
  const parts = [roofHtml(Math.round(W * 1.0)), m.tonight ? floorHtml(m.tonight, W, H) : emptyTonightHtml(W, H), ...newest.map((f) => floorHtml(f, W, H))];
  if (ground) parts.push(lobbyHtml(W), '<span class="ground"></span>');
  return parts.join('');
}
