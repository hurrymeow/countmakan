// Tower rendering. Floor data in, pixels out. Everything is drawn in code on a low-res canvas
// that the browser scales up with no smoothing, so the pixels stay crisp at any size.
// Each floor is split left to right by macro share. Each shop has its own wall, floor and two props,
// with one small moving detail. Goal beats (neon, flag, fireworks) are drawn here too.
import { hash, skylineFor } from './tower.js';

// Floor aspect: width over height, in the low-res buffer.
export const FLOOR_RATIO = 2.4;
export const LOOP = 8; // seconds. Every walker returns to its start, so the loop is seamless.
const MAC = ['#3987e5', '#d95926', '#199e70'];
const FIG_H = 14;
const SKIN = ['#f1c7a3', '#d9a07a', '#a8714f', '#7a4e33', '#e8b48f', '#c58c64'];
const SHIRT = ['#e9e4d8', '#5b8def', '#e07a4f', '#3fb68b', '#c9b458', '#b07ad9'];
const PANTS = ['#2b2f3a', '#3c4a63', '#4a3b33', '#23262e', '#5a5f6b', '#2f3d33'];

function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => {
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
};
const AMBER = '#ffd166';

// ---------- walkers ----------
// Each walker loops the floor a whole number of times per LOOP. Its gait is tied to the
// distance walked, so the feet never slide. Directions and speeds are mixed.
export function walkersFor(seed, n, W, figH = FIG_H) {
  const r = rng(seed * 13);
  const out = [];
  for (let i = 0; i < n; i++) {
    const dir = r() < 0.5 ? 1 : -1;
    const laps = r() < 0.35 ? 2 : 1;
    const route = W + figH * 1.6;
    const v = (route * laps) / LOOP;
    const cycles = Math.max(1, Math.round((v * LOOP) / (figH * 0.85)));
    out.push({ dir, route, v, cycles, off: i / n + r() * 0.15, look: Math.floor(r() * 6), laps });
  }
  return out;
}
// Position along the floor and gait frame (0..3) at time t. Repeats exactly every LOOP seconds.
export function walkerState(w, t, W, figH = FIG_H) {
  const u = (((t / LOOP) * w.laps + w.off) % 1 + 1) % 1;
  const d = u * w.route - figH * 0.8;
  const phase = 2 * Math.PI * w.cycles * (t / LOOP) + w.off * 9;
  const frame = ((Math.floor(phase / (Math.PI / 2)) % 4) + 4) % 4;
  return { x: w.dir > 0 ? d : W - d, frame };
}

// ---------- pieces ----------
// `flag` is 0..1: how far up the pole it has climbed. 0 hides it. `built` lists the milestones reached.
function roof(ctx, x, y, W, flag = 0, t = 0, built = []) {
  ctx.fillStyle = '#2a2d3d'; ctx.fillRect(x - 1, y - 3, W + 2, 3);
  ctx.fillStyle = '#5a5f78'; ctx.fillRect(x + 3, y - 9, 8, 6);
  ctx.fillStyle = '#3a3f55'; ctx.fillRect(x + 4, y - 8, 6, 1);
  const fp = x + Math.floor(W * 0.35);
  if (built.includes('garden')) garden(ctx, x, y, W, fp);
  else {
    ctx.fillStyle = '#4f7a3a';
    for (let i = W - 8; i > W * 0.5; i -= 7) {
      ctx.fillRect(x + i, y - 7, 4, 4);
      ctx.fillStyle = '#6a9b4d'; ctx.fillRect(x + i + 1, y - 7, 2, 1);
      ctx.fillStyle = '#4f7a3a';
    }
  }
  if (built.includes('spire')) spire(ctx, x + Math.floor(W / 2), y, built.includes('beacon'), t);
  if (flag > 0) {
    const px = fp;
    ctx.fillStyle = '#9aa0b0'; ctx.fillRect(px, y - 14, 1, 11);
    const fy = Math.round(y - 7 - 7 * Math.min(1, flag)), wv = Math.floor(t * 6) % 2;
    ctx.fillStyle = AMBER; ctx.fillRect(px + 1, fy, 6, 3); ctx.fillRect(px + 7, fy + wv, 1, 2);
    ctx.fillStyle = '#c9a23a'; ctx.fillRect(px + 1, fy + 2, 6, 1);
    ctx.fillStyle = '#12141c'; ctx.fillRect(px + 3, fy + 1, 1, 1); ctx.fillRect(px + 4, fy, 1, 1);
  }
  return 3;
}

// Roof garden: a pergola with a bench on the left, three trees on the right. Both stay clear of the flag pole.
function garden(ctx, x, y, W, fp) {
  const px = x + 14, pw = Math.max(8, fp - 3 - px);
  ctx.fillStyle = '#7a5a3c'; ctx.fillRect(px, y - 11, 1, 8); ctx.fillRect(px + pw - 1, y - 11, 1, 8); ctx.fillRect(px, y - 12, pw, 1);
  ctx.fillStyle = '#4f7a3a';
  for (let k = 1; k < pw - 1; k += 2) ctx.fillRect(px + k, y - 13, 1, 1);
  ctx.fillStyle = '#6a9b4d'; ctx.fillRect(px + 2, y - 11, 1, 2); ctx.fillRect(px + pw - 3, y - 11, 1, 1);
  ctx.fillStyle = '#b08a5a'; ctx.fillRect(px + 2, y - 6, pw - 4, 1);
  ctx.fillStyle = '#5a4630'; ctx.fillRect(px + 2, y - 5, 1, 2); ctx.fillRect(px + pw - 3, y - 5, 1, 2);
  for (const f of [0.62, 0.77, 0.9]) {
    const tx = x + Math.floor(W * f);
    ctx.fillStyle = '#5a4630'; ctx.fillRect(tx, y - 7, 1, 4);
    ctx.fillStyle = '#4f7a3a'; ctx.fillRect(tx - 2, y - 12, 5, 5);
    ctx.fillStyle = '#6a9b4d'; ctx.fillRect(tx - 1, y - 12, 2, 1); ctx.fillRect(tx - 2, y - 11, 1, 1);
  }
}

// Spire: a stepped base, a mast and a red tip, centred on the roof. The beacon adds a pulsing light.
function spire(ctx, cx, y, beacon, t) {
  ctx.fillStyle = '#5a5f78'; ctx.fillRect(cx - 5, y - 6, 10, 3);
  ctx.fillStyle = '#3a3f55'; ctx.fillRect(cx - 5, y - 4, 10, 1);
  ctx.fillStyle = '#6b7090'; ctx.fillRect(cx - 3, y - 10, 6, 4);
  ctx.fillStyle = '#3a3f55'; ctx.fillRect(cx - 3, y - 8, 6, 1);
  ctx.fillStyle = '#9aa0b0'; ctx.fillRect(cx, y - 34, 1, 24);
  ctx.fillRect(cx - 1, y - 20, 3, 1);
  ctx.fillStyle = '#e0453a'; ctx.fillRect(cx, y - 38, 1, 4);
  if (!beacon) return;
  const k = reduced() ? 1 : 0.5 + 0.5 * Math.sin(t * 4);
  ctx.fillStyle = `rgba(255,70,60,${(0.12 + 0.28 * k).toFixed(2)})`; ctx.fillRect(cx - 3, y - 42, 7, 7);
  ctx.fillStyle = `rgba(255,70,60,${(0.3 + 0.4 * k).toFixed(2)})`; ctx.fillRect(cx - 2, y - 41, 5, 5);
  ctx.fillStyle = k > 0.5 ? '#ff6b5e' : '#e0453a'; ctx.fillRect(cx - 1, y - 40, 3, 3);
  ctx.fillStyle = '#ffd9d4'; ctx.fillRect(cx, y - 39, 1, 1);
}

// ---------- 12 interiors ----------
// Each shop: wall colour, wall pattern, floor pattern, props. Macro colour still tints the wall so the split reads.
const SHOP = {
  sport: { wall: '#cfe0f5', floor: ['#3a4a66', '#2e3b52'], pat: 'stripe' },
  boxing: { wall: '#e8d6c8', floor: ['#7a2f2f', '#5e2424'], pat: 'brick' },
  pool: { wall: '#d6f0f7', floor: ['#3fb6e0', '#2e9cc6'], pat: 'tile' },
  dojo: { wall: '#efe6cf', floor: ['#c8b77a', '#b3a265'], pat: 'panel' },
  office: { wall: '#f2e6d6', floor: ['#5a4a3e', '#4a3c32'], pat: 'plain' },
  bakery: { wall: '#f7e3c4', floor: ['#c9a27a', '#b38d66'], pat: 'check' },
  noodle: { wall: '#f0d2b8', floor: ['#4a3b33', '#3a2e28'], pat: 'brick' },
  pizza: { wall: '#f3d9c0', floor: ['#e8e2d0', '#3a3d4c'], pat: 'tile' },
  butch: { wall: '#e9efe6', floor: ['#c9d1cc', '#aeb7b1'], pat: 'tile' },
  fish: { wall: '#d4ece6', floor: ['#5c7f86', '#4a6a70'], pat: 'stripe' },
  deli: { wall: '#efe7d2', floor: ['#2b2f3a', '#e8e2d0'], pat: 'check' },
  nut: { wall: '#ecdcc0', floor: ['#7a5a3c', '#6b4d33'], pat: 'panel' },
};

function wall(ctx, s, i, ix, iy, iw, ih, r, dim) {
  const base = mix(mix(s.wall, MAC[i], 0.38), '#1a1c26', dim);
  ctx.fillStyle = base; ctx.fillRect(ix, iy, iw, ih);
  const dk = mix(base, '#000000', 0.12);
  ctx.fillStyle = dk;
  if (s.pat === 'stripe') for (let k = 0; k < iw; k += 4) ctx.fillRect(ix + k, iy, 1, ih);
  if (s.pat === 'brick') for (let yy = 0; yy < ih - 4; yy += 3) { ctx.fillRect(ix, iy + yy, iw, 1); for (let k = (yy / 3) % 2 ? 2 : 0; k < iw; k += 5) ctx.fillRect(ix + k, iy + yy, 1, 3); }
  if (s.pat === 'tile') for (let yy = 0; yy < ih - 4; yy += 4) for (let k = 0; k < iw; k += 4) { ctx.fillRect(ix + k, iy + yy, 4, 1); ctx.fillRect(ix + k, iy + yy, 1, 4); }
  if (s.pat === 'check') { ctx.fillRect(ix, iy + Math.floor(ih * 0.55), iw, ih); ctx.fillStyle = base; for (let k = 0; k < iw; k += 2) ctx.fillRect(ix + k + ((k / 2) % 2), iy + Math.floor(ih * 0.55), 1, 1); }
  if (s.pat === 'panel') { ctx.fillRect(ix, iy + Math.floor(ih * 0.5), iw, 1); for (let k = 3; k < iw; k += 6) ctx.fillRect(ix + k, iy + Math.floor(ih * 0.5), 1, ih); }
}
function floorTiles(ctx, s, ix, b, iw) {
  for (let k = 0; k < iw; k += 2) { ctx.fillStyle = s.floor[(k / 2) % 2]; ctx.fillRect(ix + k, b, 2, 2); }
}
// ceiling lamp with a soft warm cone
function lamp(ctx, cx, iy, ih, warm, on = 1) {
  ctx.fillStyle = '#2b2f3a'; ctx.fillRect(cx, iy, 1, 2);
  ctx.fillStyle = warm; ctx.fillRect(cx - 1, iy + 2, 3, 1);
  if (on) { ctx.fillStyle = 'rgba(255,230,160,.10)'; for (let k = 0; k < ih - 4; k++) ctx.fillRect(cx - 1 - (k >> 1), iy + 3 + k, 3 + k, 1); }
}

function prop(ctx, shop, cx, b, r, t, slot = 0) {
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(cx + x, b + y, w, h); };
  const k = r();
  if (slot % 2) return alt(R, shop, k, t);
  switch (shop) {
    case 'sport': // rack, bench, kettlebells
      R('#2b2f3a', -5, -11, 1, 11); R('#2b2f3a', 4, -11, 1, 11); R('#2b2f3a', -5, -9, 10, 1);
      R('#c94f4f', -4, -8, 2, 3); R('#3a3f55', -1, -8, 2, 3); R('#c94f4f', 2, -8, 2, 3);
      R('#2b2f3a', -5, -4, 10, 1); R('#e7c34a', -3, -3, 2, 2); R('#e7c34a', 1, -3, 2, 2);
      if (k > 0.4) { R('#1e2230', 8, -3, 3, 3); R('#1e2230', 9, -4, 1, 1); }
      break;
    case 'boxing': { // swinging bag on a chain, ring rope behind
      const sw = Math.round(Math.sin(t * 3 + k * 6) * 1.2);
      R('#e8e2d0', -9, -9, 18, 1); R('#c94f4f', -9, -6, 18, 1);
      R('#5a5f6b', sw, -17, 1, 4); R('#b8473a', -1 + sw, -13, 4, 8); R('#8a2f28', -1 + sw, -13, 1, 8); R('#e8e2d0', -1 + sw, -10, 4, 1);
      if (k > 0.5) { R('#c94f4f', 6, -2, 2, 2); R('#c94f4f', 9, -2, 2, 2); }
      break; }
    case 'pool': { // water with lane rope, ladder, wave shimmer
      R('#2e9cc6', -10, -3, 20, 3); R('#7fd0ff', -10, -3, 20, 1);
      for (let x = -10; x < 10; x += 3) R(((x + Math.floor(t * 6)) % 6 === 0) ? '#ffffff' : '#c94f4f', x, -2, 1, 1);
      R('#c9c2ae', 7, -9, 1, 7); R('#c9c2ae', 9, -9, 1, 7); R('#c9c2ae', 7, -7, 3, 1); R('#c9c2ae', 7, -5, 3, 1);
      R('#e7c34a', -6, -10, 4, 4); R('#c94f4f', -6, -10, 4, 1); // ring buoy on wall
      R('#a8dff0', -5, -9, 2, 2);
      break; }
    case 'dojo': // hanging scroll, wooden dummy, mat
      R('#e8e2d0', -8, -14, 4, 8); R('#2a1e18', -7, -12, 2, 1); R('#2a1e18', -7, -10, 2, 2); R('#6b4a3a', -9, -14, 6, 1);
      R('#8a5a3a', 3, -11, 2, 11); R('#8a5a3a', 1, -9, 6, 1); R('#8a5a3a', 1, -6, 6, 1); R('#6b4a3a', 3, -12, 2, 1);
      R('#d6c48a', -9, -1, 18, 1);
      break;
    case 'office': // desk, screen, plant
      R('#6b4a3a', -6, -5, 12, 1); R('#6b4a3a', -6, -4, 1, 4); R('#6b4a3a', 5, -4, 1, 4);
      R('#1e2230', -3, -10, 6, 5); R(Math.floor(t * 2 + k * 9) % 3 ? '#7fd0ff' : '#a8e6ff', -2, -9, 4, 3); R('#1e2230', 0, -5, 1, 1);
      if (k > 0.4) { R('#8a5a3a', 7, -3, 3, 3); R('#3fae7a', 6, -6, 5, 3); R('#57c08a', 7, -7, 3, 1); }
      else { R('#e8e2d0', 7, -12, 6, 4); R('#c94f4f', 8, -11, 1, 2); R('#3fae7a', 10, -10, 1, 1); R('#5b8def', 11, -11, 1, 2); } // chart on wall
      break;
    case 'bakery': // glass case with loaves, oven glow
      R('#8a5a3a', -9, -5, 12, 5); R('#c9e8f0', -9, -9, 12, 4); R('#e8e2d0', -9, -10, 12, 1);
      R('#d9a05a', -8, -8, 3, 2); R('#b97a3a', -4, -8, 3, 2); R('#e8c07a', 0, -8, 2, 2); R('#d9a05a', -7, -4, 4, 1);
      R('#5a5f6b', 5, -10, 6, 10); R('#2b2f3a', 6, -8, 4, 3);
      R(Math.sin(t * 7 + k) > 0 ? '#ff9a3a' : '#ffb84d', 6, -7, 4, 2);
      break;
    case 'noodle': { // lanterns, counter, steaming bowls
      R('#c94f4f', -8, -15, 3, 3); R('#e7c34a', -8, -15, 3, 1); R('#c94f4f', 5, -15, 3, 3); R('#e7c34a', 5, -15, 3, 1);
      R('#6b4a3a', -9, -5, 18, 5); R('#8a5a3a', -9, -5, 18, 1);
      R('#e8e2d0', -6, -7, 4, 2); R('#e8e2d0', 2, -7, 4, 2);
      const st = Math.floor(t * 4 + k * 4) % 2;
      R('rgba(255,255,255,.55)', -5 + st, -10, 1, 2); R('rgba(255,255,255,.55)', 3 + (1 - st), -10, 1, 2);
      R('rgba(255,255,255,.35)', -4 - st, -12, 1, 2); R('rgba(255,255,255,.35)', 4 - st, -12, 1, 2);
      break; }
    case 'pizza': { // brick oven with fire, pizza on peel
      R('#8a4a3a', -9, -12, 11, 12); R('#6b3a2d', -9, -12, 11, 1); R('#1a1214', -7, -8, 7, 5);
      const f = Math.floor(t * 8 + k * 5) % 3;
      R('#ff7a2a', -6, -5, 5, 2); R('#ffd166', -5 + (f === 1 ? 1 : 0), -6, 2, 1); R('#ff9a3a', -3 - (f === 2 ? 1 : 0), -7, 1, 2);
      R('#6b4a3a', 4, -4, 8, 1); R('#e7c34a', 5, -6, 6, 2); R('#c94f4f', 6, -6, 1, 1); R('#c94f4f', 9, -6, 1, 1);
      break; }
    case 'butch': // hooks with cuts, chopping block
      R('#5a5f6b', -9, -15, 18, 1);
      for (let x = -7; x < 9; x += 5) { R('#9aa0b0', x, -14, 1, 2); R('#c45a5a', x - 1, -12, 3, 4); R('#e8b4a8', x - 1, -12, 1, 2); }
      R('#8a5a3a', -4, -5, 8, 5); R('#6b4a3a', -4, -5, 8, 1); R('#c9c2ae', 1, -7, 3, 2);
      break;
    case 'fish': { // tank with a swimming fish, ice counter
      R('#1e5e78', -9, -14, 9, 7); R('#3fb6e0', -9, -14, 9, 1);
      const fx = -8 + Math.floor((t * 3 + k * 7) % 7);
      R('#ff9a3a', fx, -11, 2, 1); R('#ff9a3a', fx + (fx % 2 ? 2 : -1), -11, 1, 1);
      R('#57c08a', -8, -9, 1, 2); R('#57c08a', -3, -10, 1, 3);
      R('#e8f4f7', -9, -4, 18, 4); R('#c9dde3', -9, -1, 18, 1);
      R('#9aa0b0', -7, -5, 4, 1); R('#c9c2ae', -2, -5, 4, 1); R('#9aa0b0', 3, -5, 4, 1);
      break; }
    case 'deli': // cheese wheels, hanging sausages, counter
      R('#6b4a3a', -9, -15, 18, 1);
      for (let x = -7; x < 9; x += 3) R('#a8483a', x, -14, 1, 4);
      R('#6b4a3a', -9, -9, 9, 1); R('#e7c34a', -8, -11, 3, 2); R('#f0d27a', -4, -11, 3, 2);
      R('#e8e2d0', 1, -5, 9, 5); R('#c9e8f0', 1, -7, 9, 2); R('#e7a0a0', 2, -6, 2, 1); R('#e7c34a', 6, -6, 2, 1);
      break;
    case 'nut': // jar shelves, bins with scoops
      R('#6b4a3a', -9, -11, 18, 1); R('#6b4a3a', -9, -15, 18, 1);
      for (let x = -8; x < 9; x += 3) { R('#c9e8f0', x, -14, 2, 3); R(['#b97a3a', '#e8c07a', '#8a5a3a'][(x + 9) % 3], x, -13, 2, 2); }
      for (let x = -8; x < 9; x += 6) { R('#8a5a3a', x, -4, 5, 4); R(['#d9a05a', '#e8d6a0', '#7a4e33'][Math.abs(x) % 3], x, -5, 5, 1); }
      break;
  }
}

// Second prop per shop, so a wide shop doesn't repeat itself.
function alt(R, shop, k, t) {
  switch (shop) {
    case 'sport': R('#1e2230', -6, -2, 12, 2); R('#3a3f55', -5, -3, 10, 1); R('#5a5f6b', 4, -10, 1, 8); R('#1e2230', 3, -11, 4, 2); R(Math.floor(t * 3) % 2 ? '#57c08a' : '#3fae7a', 4, -11, 2, 1); break; // treadmill
    case 'boxing': R('#c9c2ae', -6, -13, 2, 13); for (const y of [-11, -8, -5]) R('#e8e2d0', -4, y, 12, 1); R('#c94f4f', -6, -14, 2, 1); break; // ring corner
    case 'pool': R('#e8e2d0', -6, -3, 9, 1); R('#9aa0b0', -6, -2, 1, 2); R('#9aa0b0', 2, -2, 1, 2); R('#9aa0b0', 0, -12, 1, 9); R('#c94f4f', -4, -13, 9, 2); R('#e8e2d0', -2, -13, 2, 2); R('#e8e2d0', 2, -13, 2, 2); break; // lounger and umbrella
    case 'dojo': R('#6b4a3a', -4, -3, 8, 1); R('#6b4a3a', -3, -2, 1, 2); R('#6b4a3a', 2, -2, 1, 2); R('#8a5a3a', -1, -5, 2, 2); R('#3fae7a', -3, -8, 6, 3); R('#57c08a', -2, -9, 3, 1); break; // bonsai table
    case 'office': R('#7fd0ff', 5, -9, 3, 4); R('#e8e2d0', 5, -5, 3, 5); R('#e8e2d0', -7, -13, 9, 6); R('#9aa0b0', -7, -7, 9, 1); R('#5b8def', -6, -11, 4, 1); R('#c94f4f', -6, -9, 6, 1); break; // whiteboard, cooler
    case 'bakery': R('#9aa0b0', -1, -2, 1, 2); R('#e8e2d0', -4, -3, 7, 1); R('#f0b0c0', -3, -6, 5, 3); R('#e8e2d0', -3, -7, 5, 1); R('#c94f4f', -1, -8, 1, 1); R('#8a5a3a', 5, -11, 5, 4); R('#e8e2d0', 6, -10, 3, 1); break; // cake, menu
    case 'noodle': R('#1e2230', -7, -13, 8, 6); R('#e8e2d0', -6, -12, 2, 1); R('#e8e2d0', -6, -10, 4, 1); R('#e7c34a', -2, -12, 2, 1); for (const x of [-5, 0, 5]) { R('#c94f4f', x, -4, 3, 1); R('#5a5f6b', x + 1, -3, 1, 3); } break; // menu, stools
    case 'pizza': R('#c94f4f', -5, -5, 10, 1); R('#e8e2d0', -4, -5, 1, 1); R('#e8e2d0', -2, -5, 1, 1); R('#e8e2d0', 0, -5, 1, 1); R('#e8e2d0', 2, -5, 1, 1); R('#6b4a3a', -1, -4, 2, 4); R('#e7c34a', -2, -6, 4, 1); R('#6b4a3a', 7, -6, 1, 6); R('#6b4a3a', 7, -3, 3, 1); break; // table, chair
    case 'butch': R('#e8f4f7', -7, -8, 14, 8); R('#c9e8f0', -6, -7, 12, 3); R('#c45a5a', -5, -6, 3, 1); R('#b8473a', -1, -6, 3, 1); R('#e8b4a8', 3, -6, 2, 1); R('#9aa0b0', -7, -1, 14, 1); break; // chiller
    case 'fish': R('#8a6a3c', -6, -4, 10, 4); R('#6b512d', -6, -2, 10, 1); R('#9aa0b0', -5, -5, 3, 1); R('#c9c2ae', -1, -5, 3, 1); R('#9aa0b0', -4, -6, 3, 1); R('#3a5a60', 5, -14, 1, 6); R('#3a5a60', 3, -12, 5, 1); R('#3a5a60', 4, -10, 3, 1); break; // crate, net
    case 'deli': R('#2b2f3a', -4, -14, 9, 14); R('#7fd0ff', -3, -13, 7, 12); for (const y of [-12, -9, -6, -3]) { R('#c94f4f', -2, y, 1, 2); R('#e7c34a', 0, y, 1, 2); R('#57c08a', 2, y, 1, 2); } break; // drinks fridge
    case 'nut': R('#c9a77a', -4, -6, 7, 6); R('#a8865a', -4, -6, 7, 1); R('#d9a05a', -3, -7, 5, 1); R('#9aa0b0', 2, -9, 1, 3); R('#9aa0b0', 1, -9, 3, 1); R('#3a3f55', 6, -9, 4, 9); R('#e7c34a', 7, -7, 2, 1); break; // sack, scale
  }
}

// Neon dumbbell sign on the protein awning. on: 0 off, 1 on. Glow halo when on.
function neon(ctx, cx, y, on) {
  ctx.fillStyle = '#12141c'; ctx.fillRect(cx - 6, y - 4, 13, 6);
  const c = on ? '#8fd8ff' : '#2d4058';
  if (on) { ctx.fillStyle = 'rgba(127,208,255,.22)'; ctx.fillRect(cx - 8, y - 6, 17, 10); ctx.fillStyle = 'rgba(127,208,255,.12)'; ctx.fillRect(cx - 10, y - 7, 21, 12); }
  ctx.fillStyle = c;
  ctx.fillRect(cx - 4, y - 3, 1, 4); ctx.fillRect(cx - 3, y - 2, 1, 2); ctx.fillRect(cx - 2, y - 1, 5, 1); ctx.fillRect(cx + 3, y - 2, 1, 2); ctx.fillRect(cx + 4, y - 3, 1, 4);
}

function walker(ctx, w, st, x, y, W, H, cheer = 0, t = 0) {
  const { x: wx } = st;
  const f = cheer ? 1 : st.frame; // cheering feet stay together
  const px = Math.round(x + wx), b = y + H - 3, d = w.dir;
  const top = b - 14 - (f % 2) - (cheer ? Math.abs(Math.round(Math.sin(t * 12) * 2)) : 0);
  const R = (c, dx, dy, ww, hh) => { ctx.fillStyle = c; ctx.fillRect(px + (d > 0 ? dx : -dx - ww + 1), dy, ww, hh); };
  const P = PANTS[w.look];
  if (f % 2 === 0) { // contact frames: legs spread
    R(P, -2, b - 5, 1, 3); R(P, -3, b - 2, 1, 2); R(P, 1, b - 5, 1, 3); R(P, 2, b - 2, 1, 2);
    R('#1a1a1a', -4, b - 1, 2, 1); R('#1a1a1a', 2, b - 1, 2, 1);
  } else { // passing frames: legs together
    R(P, -1, b - 6, 2, 6); R(mix(P, '#000000', 0.4), 0, b - 3, 1, 3); R('#1a1a1a', -1, b - 1, 3, 1);
  }
  R(SHIRT[w.look], -2, top + 5, 4, 5); R(mix(SHIRT[w.look], '#000000', 0.25), -2, top + 9, 4, 1);
  const swing = f === 0 ? 1 : f === 2 ? -1 : 0;
  if (cheer) { R(SKIN[w.look], -3, top, 1, 5); R(SKIN[w.look], 2, top, 1, 5); } // both arms up
  else R(SKIN[w.look], -1 - swing, top + 6, 1, 3);
  R(SKIN[w.look], -2, top, 4, 4); R('#2a1e18', -2, top, 4, 1); R('#2a1e18', -2, top + 1, 1, 2); R('#1a1a1a', 1, top + 2, 1, 1);
}

// One small extra item at the end of a busy shop: a plant, a wall poster or a crate.
function extra(ctx, cx, b, k) {
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(cx + x, b + y, w, h); };
  if (k < 0.34) { R('#8a5a3a', -1, -3, 3, 3); R('#3fae7a', -2, -6, 5, 3); R('#57c08a', -1, -7, 3, 1); }
  else if (k < 0.67) { R('#e8e2d0', -2, -11, 5, 6); R('#c94f4f', -1, -10, 3, 2); R('#5b8def', -1, -7, 3, 1); }
  else { R('#a8794a', -3, -4, 6, 4); R('#c9a35e', -3, -4, 6, 1); R('#6b4a3a', -3, -2, 6, 1); }
}

// The still part of a floor: walls, floors, lamps and slab. Props, neon, walkers and the live dim move or change,
// so floor() draws them each frame on top of this cached copy.
function floorStatic(ctx, x, y, W, H, fl) {
  const seed = hash(fl.day);
  const r = rng(seed);
  const segs = [];
  let sx = x;
  [fl.share.protein, fl.share.carbs, fl.share.fat].forEach((s, i) => {
    const sw = i === 2 ? x + W - sx : Math.round(W * s);
    if (sw > 0) {
      const shop = fl.shops[i], S = SHOP[shop];
      ctx.fillStyle = mix(MAC[i], '#1a1c26', 0.6); ctx.fillRect(sx, y, sw, H);
      const style = (seed >>> (i * 3)) % 3; // awning: stripes, pale stripes or solid with scallops
      for (let k = 0; k < sw; k += 2) {
        const odd = (k / 2) % 2;
        const c = style === 0 ? (odd ? '#e8e2d0' : MAC[i]) : style === 1 ? (odd ? mix(MAC[i], '#ffffff', 0.4) : MAC[i]) : MAC[i];
        ctx.fillStyle = c; ctx.fillRect(sx + k, y + 1, 2, 3);
        ctx.fillStyle = style === 2 ? mix(MAC[i], '#000000', 0.3) : c; ctx.fillRect(sx + k + (odd ? 1 : 0), y + 4, 1, 1);
      }
      const ix = sx + 2, iw = sw - 4, iy = y + 6, ih = H - 8;
      ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih + 2); ctx.clip();
      wall(ctx, S, i, ix, iy, iw, ih, r, 0);
      floorTiles(ctx, S, ix, y + H - 4, iw);
      const nLamps = Math.max(1, Math.floor(iw / (fl.busy ? 11 : 16)));
      for (let l = 0; l < nLamps; l++) lamp(ctx, ix + Math.floor((iw * (l + 0.5)) / nLamps), iy, ih, AMBER, r() > 0.2 || fl.busy);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(ix + 1, iy + 1, 1, 4); ctx.fillRect(ix + 2, iy + 1, 1, 2); // glass glint
      segs.push({ sx, sw, i, shop });
    }
    ctx.fillStyle = '#12141c'; ctx.fillRect(sx, y, 1, H);
    sx += sw;
  });
  ctx.fillStyle = '#12141c'; ctx.fillRect(x + W - 1, y, 1, H);
  ctx.fillStyle = '#5a5e70'; ctx.fillRect(x - 1, y + H, W + 2, 2);
  ctx.fillStyle = '#3a3d4c'; ctx.fillRect(x - 1, y + H + 1, W + 2, 1);
  return segs;
}

// Tonight's frame. Unlogged part is dimmed. The edge is dashed amber, and solid green once the day is in the band.
// `done` is the lit fraction (0..1). `sealed` goes 0..1 as the dashes fill in.
function liveFrame(ctx, x, y, W, H, done, sealed) {
  const d = Math.round(W * Math.min(1, Math.max(0, done)));
  if (d < W) { ctx.fillStyle = 'rgba(13,14,20,.55)'; ctx.fillRect(x + d, y, W - d, H); }
  ctx.fillStyle = sealed >= 1 ? '#7be0a8' : AMBER;
  const len = sealed > 0.5 ? 3 : 2;
  for (let k = 0; k < W; k += 3) { ctx.fillRect(x + k, y, len, 1); ctx.fillRect(x + k, y + H - 1, len, 1); }
  for (let k = 0; k < H; k += 3) { ctx.fillRect(x, y + k, 1, len); ctx.fillRect(x + W - 1, y + k, 1, len); }
}

// The still part is drawn once per floor and size, then copied each frame. Props, walkers and the live frame redraw.
// `fx` (optional, from a beat) overrides what a floor shows: neon, surge, cheer, done, sealed.
const statics = new WeakMap();
function floor(ctx, x, y, W, H, fl, t, goal, fx = null) {
  let c = statics.get(fl);
  if (!c || c.W !== W || c.H !== H) {
    const cv = document.createElement('canvas');
    cv.width = W + 2; cv.height = H + 2;
    c = { cv, W, H, segs: floorStatic(cv.getContext('2d'), 1, 0, W, H, fl) };
    statics.set(fl, c);
  }
  ctx.drawImage(c.cv, x - 1, y);
  const seed = hash(fl.day);
  {
    for (const sg of c.segs) {
      const sx = sg.sx - 1 + x;
      if (sg.sw > 14) { // props, clipped to the shop
        ctx.save(); ctx.beginPath(); ctx.rect(sx + 2, y + 6, sg.sw - 4, H - 6); ctx.clip();
        let slot = seed % 2;
        for (let cx = sx + 10; cx < sx + sg.sw - 7; cx += fl.busy ? 14 : 21) prop(ctx, sg.shop, cx, y + H - 4, rng(seed + cx - x), t, slot++);
        if (fl.busy) extra(ctx, sx + sg.sw - 6, y + H - 4, rng(seed + sg.sx)());
        ctx.restore();
      }
      if (sg.i === 0 && sg.sw >= 15) { // protein shop: neon sign, and the blue surge during the beat
        const on = fx?.neon ?? (fl.proteinHit ? 1 : null);
        const mid = sx + Math.floor(sg.sw / 2);
        if (fx?.surge && fx.surge.a > 0 && fx.surge.fade > 0) {
          const hh = Math.round(H * fx.surge.a);
          ctx.fillStyle = `rgba(127,208,255,${(0.35 * fx.surge.fade).toFixed(2)})`; ctx.fillRect(sx + 1, y + H - hh, sg.sw - 1, hh);
        }
        if (on !== null) neon(ctx, mid, y + 4, on);
      }
    }
  }
  const n = fl.live ? 1 : fl.walkers;
  if (n > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y, W - 2, H); ctx.clip();
    for (const w of walkersFor(seed, n, W)) walker(ctx, w, walkerState(w, t, W), x, y, W, H, fl.live && fx?.cheer ? 1 : 0, t);
    ctx.restore();
  }
  if (fl.live) {
    const gl = fl.budget || goal;
    const frac = gl > 0 ? fl.kcal / gl : 1;
    liveFrame(ctx, x, y, W, H, fx?.done ?? (fl.inBand ? 1 : frac), fx?.sealed ?? (fl.inBand ? 1 : 0));
  }
  return H + 2;
}

// Tonight before any meal is logged: an empty dashed floor.
function emptyTonight(ctx, x, y, W, H) {
  ctx.fillStyle = 'rgba(255,209,102,.06)'; ctx.fillRect(x, y, W, H);
  ctx.fillStyle = '#ffd166';
  for (let k = 0; k < W; k += 3) { ctx.fillRect(x + k, y, 2, 1); ctx.fillRect(x + k, y + H - 1, 2, 1); }
  for (let k = 0; k < H; k += 3) { ctx.fillRect(x, y + k, 1, 2); ctx.fillRect(x + W - 1, y + k, 1, 2); }
  ctx.fillStyle = '#5a5e70'; ctx.fillRect(x - 1, y + H, W + 2, 2);
  ctx.fillStyle = '#3a3d4c'; ctx.fillRect(x - 1, y + H + 1, W + 2, 1);
  return H + 2;
}

// Lobby for short towers: dark front, glass doors, a lit sign. Then pavement.
const GROUND_H = 8;
function lobby(ctx, x, y, W, H, built = false) {
  ctx.fillStyle = '#23262f'; ctx.fillRect(x, y, W, H);
  ctx.fillStyle = '#12141c'; ctx.fillRect(x, y, 1, H); ctx.fillRect(x + W - 1, y, 1, H);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 4, y + 3, W - 8, 3);
  ctx.fillStyle = '#7a6230'; ctx.fillRect(x + 4, y + 6, W - 8, 1);
  const dw = Math.min(W - 12, 22), dx = x + Math.floor((W - dw) / 2);
  ctx.fillStyle = '#7fd0ff'; ctx.fillRect(dx, y + 9, dw, H - 9);
  ctx.fillStyle = '#12141c'; ctx.fillRect(dx + Math.floor(dw / 2), y + 9, 1, H - 9);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(dx + 2, y + 10, 1, 5);
  if (built) {
    // Canopy over the doors, with posts and a small sign.
    const cw = dw + 8, cx0 = dx - 4;
    for (let k = 0; k < cw; k += 3) { ctx.fillStyle = (k / 3) % 2 ? '#f2e6d6' : '#d9483b'; ctx.fillRect(cx0 + k, y + 7, Math.min(3, cw - k), 3); }
    ctx.fillStyle = '#8f2a22'; ctx.fillRect(cx0, y + 10, cw, 1);
    ctx.fillStyle = '#5a5e70'; ctx.fillRect(cx0, y + 10, 1, H - 10); ctx.fillRect(cx0 + cw - 1, y + 10, 1, H - 10);
    ctx.fillStyle = '#12141c'; ctx.fillRect(dx + Math.floor(dw / 2) - 4, y + 4, 9, 1);
  }
  ctx.fillStyle = '#5a5e70'; ctx.fillRect(x - 1, y + H, W + 2, 2);
  ctx.fillStyle = '#16181d'; ctx.fillRect(0, y + H + 2, ctx.canvas.width, GROUND_H - 2);
  ctx.fillStyle = '#2d3244'; ctx.fillRect(0, y + H + 2, ctx.canvas.width, 1);
  return H + GROUND_H;
}

// ---------- layout and drawing ----------
const ROOF_TOP = 15; // room above the roof line for the rooftop props and the flag
const SPIRE_TOP = 45; // with a spire built the mast and beacon need more headroom
export const roofTopFor = (m) => (m.built?.includes('spire') ? SPIRE_TOP : ROOF_TOP);
const SKY_PAD = 3; // matches the gap the roof slab leaves above the first floor

function prepare(m, { limit = Infinity, ground = false }) {
  const newest = m.floors.slice(-Math.min(limit, m.floors.length)).reverse();
  const rows = [m.tonight ? { kind: 'floor', fl: m.tonight } : { kind: 'empty' }, ...newest.map((fl) => ({ kind: 'floor', fl }))];
  if (ground) rows.push({ kind: 'lobby' });
  return rows;
}

// Size the canvas to the tower. `W` is the CSS width in px, `u` the pixel scale (2 on Today, 3 in the tap-in view).
// Returns the layout, which drawTower and animate reuse.
export function sizeTower(canvas, m, { W, mode = 'today', limit, ground } = {}) {
  const u = mode === 'view' ? 3 : 2;
  const lw = Math.max(40, Math.round(W / u));
  const H = Math.round(lw / FLOOR_RATIO);
  const rows = prepare(m, { limit, ground });
  const roofTop = roofTopFor(m);
  const top = roofTop + SKY_PAD;
  const lh = top + rows.reduce((a, r) => a + (r.kind === 'lobby' ? H + GROUND_H : H + 2), 0);
  canvas.width = lw; canvas.height = lh;
  canvas.style.width = `${lw * u}px`; canvas.style.height = `${lh * u}px`;
  canvas.style.imageRendering = 'pixelated';
  canvas.dataset.roofTop = String(roofTop);
  canvas.dataset.floors = String(rows.filter((r) => r.kind === 'floor' && !r.fl.live).length);
  return { u, lw, lh, H, rows, top, roofTop };
}

// Draws the tower at time t (seconds). With `range` ([y0, y1] in buffer px) only floors in view are redrawn.
export function drawTower(canvas, m, opts = {}, layout = sizeTower(canvas, m, opts), t = 1.3) {
  const ctx = canvas.getContext('2d');
  const { lw, lh, H, rows, top, roofTop } = layout;
  const [y0, y1] = opts.range || [0, lh];
  const goal = opts.goal;
  ctx.clearRect(0, Math.max(0, y0), lw, Math.min(lh, y1) - Math.max(0, y0));
  if (y0 <= top) roof(ctx, 0, roofTop, lw, opts.fx?.flag ?? (m.tonight?.inBand ? 1 : 0), t, m.built);
  let y = top;
  for (const row of rows) {
    const h = row.kind === 'lobby' ? H + GROUND_H : H + 2;
    if (y + h >= y0 && y <= y1) {
      if (row.kind === 'floor') floor(ctx, 0, y, lw, H, row.fl, t, goal, row.fl.live ? opts.fx : null);
      else if (row.kind === 'empty') emptyTonight(ctx, 0, y, lw, H);
      else lobby(ctx, 0, y, lw, H, m.built?.includes('lobby'));
    }
    y += h;
  }
  return layout;
}

// ---------- effects ----------
// Fireworks: deterministic in t. bursts: [{t0, x, apex, col}]
function fireworks(ctx, bursts, t) {
  for (const b of bursts) {
    const a = t - b.t0;
    if (a < 0) continue;
    const rise = 0.5;
    if (a < rise) {
      const yy = Math.round(b.y0 + (b.apex - b.y0) * (a / rise));
      ctx.fillStyle = '#fff3c4'; ctx.fillRect(b.x, yy, 1, 2);
      ctx.fillStyle = 'rgba(255,209,102,.5)'; ctx.fillRect(b.x, yy + 2, 1, 3);
      continue;
    }
    const e = a - rise;
    if (e > 1.6) continue;
    const r = rng(b.seed || 7);
    const N = 22;
    if (e < 0.12) { ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x - 1, b.apex - 1, 3, 3); }
    for (let k = 0; k < N; k++) {
      const ang = (k / N) * Math.PI * 2 + r() * 0.2, sp = 18 + r() * 8;
      const dist = sp * (1 - Math.exp(-e * 3)) ;
      const px = Math.round(b.x + Math.cos(ang) * dist), py = Math.round(b.apex + Math.sin(ang) * dist + 6 * e * e);
      const fade = e > 1.0 ? (Math.floor(e * 20 + k) % 2 ? 0 : 1) : 1; // twinkle out
      if (!fade) continue;
      ctx.fillStyle = e < 0.9 ? b.col : mix(b.col, '#1a1c26', 0.4);
      ctx.fillRect(px, py, 1, 1);
      if (e < 0.6) { ctx.fillStyle = mix(b.col, '#1a1c26', 0.5); ctx.fillRect(Math.round(b.x + Math.cos(ang) * dist * 0.7), Math.round(b.apex + Math.sin(ang) * dist * 0.7), 1, 1); }
    }
  }
}
function sparkles(ctx, x0, w, yb, t, t0, col, n = 8) {
  const a = t - t0; if (a < 0 || a > 1.6) return;
  const r = rng(99);
  for (let k = 0; k < n; k++) {
    const sx = x0 + Math.floor(r() * w), d = r() * 0.5, life = a - d;
    if (life < 0 || life > 1) continue;
    const yy = Math.round(yb - life * 22);
    ctx.fillStyle = col; ctx.fillRect(sx, yy, 1, 1);
    if (life < 0.6) { ctx.fillRect(sx - 1, yy, 3, 1); ctx.fillRect(sx, yy - 1, 1, 3); }
  }
}
function confetti(ctx, W, Hh, t, t0, dur = 2.5) {
  const a = t - t0; if (a < 0 || a > dur + 1.5) return;
  const r = rng(5);
  const cols = [MAC[0], MAC[1], MAC[2], AMBER, '#e9e4d8'];
  for (let k = 0; k < 60; k++) {
    const x = r() * W, d = r() * dur, sp = 18 + r() * 14, ph = r() * 6, c = cols[k % 5];
    const life = a - d; if (life < 0) continue;
    const yy = Math.round(-4 + life * sp), xx = Math.round(x + Math.sin(life * 4 + ph) * 3);
    if (yy > Hh) continue;
    ctx.fillStyle = c; ctx.fillRect(xx, yy, Math.floor(life * 6 + ph) % 2 ? 2 : 1, Math.floor(life * 6 + ph) % 2 ? 1 : 2);
  }
}
function searchlights(ctx, x, y, t, t0, alpha = 1) {
  const a = t - t0; if (a < 0) return;
  const k = Math.min(1, a / 0.4) * alpha;
  for (const [ox, ph] of [[0, 0], [1, 1.8]]) {
    const ang = -Math.PI / 2 + Math.sin(a * 1.4 + ph) * 0.55;
    for (let d = 0; d < 70; d++) {
      const spread = 1 + d * 0.16;
      const cx = x[ox] + Math.cos(ang) * d, cy = y + Math.sin(ang) * d;
      ctx.fillStyle = `rgba(255,214,120,${(0.16 * k * (1 - d / 70)).toFixed(3)})`;
      ctx.fillRect(Math.round(cx - spread), Math.round(cy), Math.round(spread * 2), 1);
    }
  }
}
// ---------- goal beats ----------
// A beat plays once when a meal crosses a goal. `kind` is 'protein', 'calorie' or 'both'.
export const BEAT_DUR = { protein: 2.5, calorie: 3, both: 4.5 };
const TAIL = 1.8; // seconds the fireworks and confetti keep falling after the tower is back to its end state
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const calStart = (kind) => (kind === 'both' ? 1.6 : 0.3);

export function startBeat(kind, done0 = 0.8) {
  const start = performance.now();
  return { kind, done0, dur: BEAT_DUR[kind], t: () => (performance.now() - start) / 1000 };
}

// What tonight's floor and the roof look like `t` seconds into the beat. Null once it is over: the end state takes over.
export function beatState(kind, t, done0 = 0.8) {
  if (t >= BEAT_DUR[kind]) return null;
  const prot = kind !== 'calorie', cal = kind !== 'protein', c0 = calStart(kind);
  const s = {};
  if (prot) {
    s.surge = { a: seg(t, 0.4, 0.9), fade: 1 - seg(t, 0.9, 1.5) };
    let on = 0;
    for (const [tt, v] of [[0.9, 1], [0.98, 0], [1.06, 1], [1.12, 0], [1.24, 1]]) if (t >= tt) on = v;
    s.neon = on;
  }
  if (cal) {
    s.done = done0 + (1 - done0) * seg(t, c0, c0 + 0.5);
    s.sealed = seg(t, c0 + 0.5, c0 + 0.7);
    s.flag = seg(t, c0 + 0.9, c0 + 1.9);
  }
  s.cheer = (prot && t > 1.0 && t < 2.4) || (cal && t > c0 + 0.7 && t < c0 + 2.2);
  return s;
}

// One overlay canvas over the whole scene, at the tower's pixel scale. It holds the effects that leave the tower:
// sparkles, fireworks, searchlights, confetti and the ring pulse. It removes itself when the beat ends.
// Returns a stop function.
export function playOverlay(scene, towerCanvas, ringEl, m, beat) {
  const u = 2;
  const ov = document.createElement('canvas');
  const sr = scene.getBoundingClientRect();
  ov.width = Math.ceil(sr.width / u); ov.height = Math.ceil(sr.height / u);
  ov.className = 'scene-fx'; ov.setAttribute('aria-hidden', 'true');
  scene.append(ov);
  const ctx = ov.getContext('2d');
  const tr = towerCanvas.getBoundingClientRect(), rr = ringEl.getBoundingClientRect();
  const tx = (tr.left - sr.left) / u, ty = (tr.top - sr.top) / u, tw = towerCanvas.width;
  const rt = Number(towerCanvas.dataset.roofTop) || ROOF_TOP;
  const roofY = ty + rt, floorY = ty + rt + SKY_PAD, fh = Math.round(tw / FLOOR_RATIO);
  const rx = (rr.left - sr.left + rr.width / 2) / u, ry = (rr.top - sr.top + rr.height / 2) / u, R = rr.width / 2 / u;
  const prot = beat.kind !== 'calorie', cal = beat.kind !== 'protein', both = beat.kind === 'both', c0 = calStart(beat.kind);
  const pw = Math.round(tw * (m.tonight?.share.protein ?? 0.33));
  const cols = ['#3987e5', AMBER, '#199e70', '#d95926', '#b07ad9'];
  const bursts = cal ? [
    { t0: c0 + 0.7, x: Math.round(tx + tw * 0.24), y0: roofY - 2, apex: Math.max(6, roofY - 34), col: cols[1], seed: 3 },
    { t0: c0 + 1.0, x: Math.round(tx + tw * 0.76), y0: roofY - 2, apex: Math.max(4, roofY - 40), col: cols[0], seed: 5 },
    { t0: c0 + 1.3, x: Math.round(rx), y0: ry - R, apex: Math.max(5, ry - R - 14), col: cols[2], seed: 8 },
  ] : [];
  if (both) bursts.push({ t0: c0 + 1.6, x: Math.round(tx + tw / 2), y0: roofY - 2, apex: Math.max(4, roofY - 46), col: cols[3], seed: 9 },
    { t0: c0 + 1.9, x: Math.round(rx - R * 0.6), y0: ry, apex: Math.max(5, ry - R - 24), col: cols[4], seed: 12 });
  let raf = 0, stopped = false, last = 0;
  const stop = () => { stopped = true; cancelAnimationFrame(raf); ov.remove(); };
  const frame = (now) => {
    raf = 0;
    if (stopped) return;
    const t = beat.t();
    if (t > beat.dur + TAIL || !ov.isConnected) { stop(); return; }
    if (now - last >= 33) {
      last = now;
      ctx.clearRect(0, 0, ov.width, ov.height);
      if (both) searchlights(ctx, [tx + 14, tx + tw - 14], roofY, t, 1.8, t > beat.dur ? Math.max(0, 1 - (t - beat.dur) / TAIL) : 1);
      if (prot) sparkles(ctx, tx + 2, pw - 4, floorY + fh - 6, t, 1.0, '#8fd8ff', 10);
      if (cal) {
        fireworks(ctx, bursts, t);
        const p = seg(t, c0 + 0.5, c0 + 1.1);
        if (p > 0 && p < 1) {
          ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,209,102,${(0.8 * (1 - p)).toFixed(2)})`;
          ctx.beginPath(); ctx.arc(rx, ry, R + 2 + p * 10, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (both) confetti(ctx, ov.width, ov.height, t, c0 + 0.9, 1.8);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}

const FRAME_MS = 50; // 20 fps is plenty for a 4-frame pixel gait
// ---------- Skyline backdrop ----------
// Drawn once behind the Today tower. `roofY` is the tower's roof line in buffer rows. Windows are dim so the ring stays the focal point.
export function drawSkyline(canvas, count, roofY) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const sky = skylineFor(count);
  if (sky.stars > 0) {
    const r = rng(77);
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 40; k++) {
      const sx = Math.floor(r() * w), sy = Math.floor(r() * h * 0.6), tw = r();
      ctx.globalAlpha = sky.stars * (0.35 + 0.5 * tw);
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
  for (const c of sky.clouds) {
    const cy = Math.round(roofY + c.dy), cx = Math.round(c.x * w);
    if (cy < -8 || cy > h) continue;
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#b9c2ec';
    ctx.fillRect(cx + 3, cy, c.w - 6, 3); ctx.fillRect(cx, cy + 2, c.w, 3); ctx.fillRect(cx + 7, cy - 2, Math.floor(c.w / 2), 3);
  }
  const r = rng(31);
  for (const b of sky.roofs) {
    const by = Math.round(roofY + b.dy), bx = Math.round(b.x * w);
    if (by >= h) continue;
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#1a1e3c'; ctx.fillRect(bx, by, b.w, h - by);
    ctx.fillStyle = '#262b52'; ctx.fillRect(bx, by, b.w, 1);
    ctx.globalAlpha = 0.25; ctx.fillStyle = AMBER;
    for (let wy = by + 3; wy < h - 1; wy += 4) for (let wx = bx + 2; wx < bx + b.w - 2; wx += 3) if (r() > 0.45) ctx.fillRect(wx, wy, 1, 2);
  }
  ctx.globalAlpha = 1;
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Draws now, then loops on requestAnimationFrame only while the canvas is on screen.
// `opts.scroller` is the scrolling parent of a tall canvas, so only the floors in view are redrawn.
// Returns a stop function.
// `opts.beat` (from startBeat) plays a goal beat on tonight's floor and the roof flag.
export function animate(canvas, m, opts = {}) {
  const layout = sizeTower(canvas, m, opts);
  const paint = (t) => {
    const fx = opts.beat ? beatState(opts.beat.kind, opts.beat.t(), opts.beat.done0) : null;
    let range = null;
    if (opts.scroller) {
      const c = canvas.getBoundingClientRect(), s = opts.scroller.getBoundingClientRect();
      range = [Math.floor((s.top - c.top) / layout.u) - 8, Math.ceil((s.bottom - c.top) / layout.u) + 8];
    }
    drawTower(canvas, m, { ...opts, range, fx }, layout, t);
  };
  paint(1.3);
  if (reduced()) return () => {};
  let raf = 0, visible = true, stopped = false, last = 0;
  const start = performance.now();
  const frame = (now) => {
    raf = 0;
    if (stopped || !canvas.isConnected) return;
    if (now - last >= FRAME_MS) { last = now; paint((now - start) / 1000 + 1.3); }
    if (visible) raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver((rows) => {
    visible = rows[rows.length - 1].isIntersecting;
    if (visible && !raf && !stopped) raf = requestAnimationFrame(frame);
  });
  io.observe(canvas);
  raf = requestAnimationFrame(frame);
  return () => { stopped = true; io.disconnect(); cancelAnimationFrame(raf); };
}

// ---------- overview rail ----------
export const RAIL_W = 20;
const RAIL_TICKS = [5, 20, 60, 100];
// Draws the whole tower as thin bands, newest at the top: one band per floor split by macro share, busy (hit) weeks full colour, quiet weeks faded.
// Returns { h, top, bandH }; h is the drawn height in CSS px.
export function drawRail(canvas, m, avail) {
  const rows = (m.tonight ? 1 : 0) + m.floors.length + 1; // tonight, floors, ground
  const cap = m.built.includes('beacon') || m.built.includes('spire') ? 8 : 0;
  const bandH = Math.max(1, Math.min(4, Math.floor((avail - cap) / rows)));
  const h = cap + rows * bandH;
  canvas.width = RAIL_W; canvas.height = h;
  canvas.style.width = `${RAIL_W}px`; canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, RAIL_W, h);
  if (cap) {
    ctx.fillStyle = '#9aa0b4'; ctx.fillRect(9, 0, 2, cap);
    if (m.built.includes('beacon')) { ctx.fillStyle = '#ff4d4d'; ctx.fillRect(8, 0, 4, 3); } else { ctx.fillStyle = '#d94a4a'; ctx.fillRect(9, 0, 2, 2); }
  }
  const draw = (fl, row) => {
    const y = cap + row * bandH, hh = Math.max(1, bandH - (bandH > 2 ? 1 : 0));
    ctx.globalAlpha = fl.busy || fl.live ? 1 : 0.6;
    const w0 = Math.round(RAIL_W * fl.share.protein), w1 = Math.round(RAIL_W * (fl.share.protein + fl.share.carbs));
    ctx.fillStyle = MAC[0]; ctx.fillRect(0, y, w0, hh);
    ctx.fillStyle = MAC[1]; ctx.fillRect(w0, y, w1 - w0, hh);
    ctx.fillStyle = MAC[2]; ctx.fillRect(w1, y, RAIL_W - w1, hh);
    ctx.globalAlpha = 1;
  };
  let row = 0;
  if (m.tonight) { draw(m.tonight, row); ctx.fillStyle = 'rgba(13,14,20,.45)'; ctx.fillRect(0, cap, RAIL_W, bandH); row++; }
  for (let i = m.floors.length - 1; i >= 0; i--) draw(m.floors[i], row++);
  ctx.fillStyle = '#5a5e70'; ctx.fillRect(0, cap + row * bandH, RAIL_W, bandH);
  ctx.fillStyle = '#f2b84b'; // amber ticks at milestone floors, counted from the ground
  for (const n of RAIL_TICKS) {
    if (n > m.count) continue;
    const y = cap + ((m.tonight ? 1 : 0) + (m.count - n)) * bandH;
    ctx.fillRect(0, y, 5, 1); ctx.fillRect(RAIL_W - 5, y, 5, 1);
  }
  return { h, top: cap, bandH };
}
