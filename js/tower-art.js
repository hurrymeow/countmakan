// Tower rendering. Floor data in, pixels out. Everything is drawn in code on a low-res canvas
// that the browser scales up with no smoothing, so the pixels stay crisp at any size.
// Each floor is split left to right by macro share. Each macro gets one interior:
// protein is a gym rack, carbs are desks with screens, fat is a produce counter.
import { hash } from './tower.js';

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
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
};

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
function roof(ctx, x, y, W) {
  ctx.fillStyle = '#2a2d3d'; ctx.fillRect(x - 1, y - 3, W + 2, 3);
  ctx.fillStyle = '#5a5f78'; ctx.fillRect(x + 3, y - 9, 8, 6);
  ctx.fillStyle = '#3a3f55'; ctx.fillRect(x + 4, y - 8, 6, 1);
  ctx.fillStyle = '#4f7a3a';
  for (let i = W - 8; i > W * 0.5; i -= 7) {
    ctx.fillRect(x + i, y - 7, 4, 4);
    ctx.fillStyle = '#6a9b4d'; ctx.fillRect(x + i + 1, y - 7, 2, 1);
    ctx.fillStyle = '#4f7a3a';
  }
  return 3;
}

function prop(ctx, i, cx, b, r) {
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(cx + x, b + y, w, h); };
  if (i === 0) { // rack with plates, bench
    R('#2b2f3a', -5, -11, 1, 11); R('#2b2f3a', 4, -11, 1, 11); R('#2b2f3a', -5, -9, 10, 1);
    R('#c94f4f', -4, -8, 2, 3); R('#3a3f55', -1, -8, 2, 3); R('#c94f4f', 2, -8, 2, 3);
    R('#2b2f3a', -5, -4, 10, 1); R('#e7c34a', -3, -3, 2, 2); R('#e7c34a', 1, -3, 2, 2);
  } else if (i === 1) { // desk, screen, plant
    R('#6b4a3a', -6, -5, 12, 1); R('#6b4a3a', -6, -4, 1, 4); R('#6b4a3a', 5, -4, 1, 4);
    R('#1e2230', -3, -10, 6, 5); R('#7fd0ff', -2, -9, 4, 3); R('#1e2230', 0, -5, 1, 1);
    if (r > 0.5) { R('#8a5a3a', 7, -3, 3, 3); R('#3fae7a', 6, -6, 5, 3); R('#57c08a', 7, -7, 3, 1); }
  } else { // counter with produce
    R('#e8e2d0', -7, -5, 14, 5); R('#c9c2ae', -7, -1, 14, 1); R('#9fd3e8', -7, -8, 14, 3); R('#e8e2d0', -7, -9, 14, 1);
    R('#b8473a', -6, -7, 3, 2); R('#e7c34a', -2, -7, 3, 2); R('#e68a6a', 2, -7, 3, 2);
  }
}

function walker(ctx, w, st, x, y, W, H) {
  const { x: wx, frame: f } = st;
  const px = Math.round(x + wx), b = y + H - 3, d = w.dir;
  const top = b - 14 - (f % 2);
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
  R(SKIN[w.look], -1 - swing, top + 6, 1, 3);
  R(SKIN[w.look], -2, top, 4, 4); R('#2a1e18', -2, top, 4, 1); R('#2a1e18', -2, top + 1, 1, 2); R('#1a1a1a', 1, top + 2, 1, 1);
}

// One floor at (x, y), W by H, plus its slab. Returns the height used.
function floor(ctx, x, y, W, H, fl, t, goal) {
  const seed = hash(fl.day);
  const r = rng(seed);
  let sx = x;
  [fl.share.protein, fl.share.carbs, fl.share.fat].forEach((s, i) => {
    const sw = i === 2 ? x + W - sx : Math.round(W * s);
    ctx.fillStyle = mix(MAC[i], '#1a1c26', fl.messy ? 0.82 : 0.6); ctx.fillRect(sx, y, sw, H);
    ctx.fillStyle = mix(MAC[i], '#0d0e14', 0.75); // brick flecks
    for (let k = 0; k < (sw * H) / 14; k++) ctx.fillRect(sx + Math.floor(r() * sw), y + Math.floor(r() * H), 2, 1);
    if (!fl.messy) { // awning
      for (let k = 0; k < sw; k += 2) {
        ctx.fillStyle = (k / 2) % 2 ? '#e8e2d0' : MAC[i];
        ctx.fillRect(sx + k, y + 1, 2, 3); ctx.fillRect(sx + k + ((k / 2) % 2 ? 1 : 0), y + 4, 1, 1);
      }
    }
    // interior: back wall, shelf, tiled floor
    const ix = sx + 2, iw = sw - 4, iy = y + 6, ih = H - 8;
    ctx.fillStyle = mix(MAC[i], '#f3ead2', fl.messy ? 0.2 : 0.5); ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = mix(MAC[i], '#f3ead2', fl.messy ? 0.1 : 0.35); ctx.fillRect(ix, iy + Math.floor(ih * 0.3), iw, 1);
    for (let k = 2; k < iw - 2; k += 4) {
      ctx.fillStyle = ['#c94f4f', '#e7c34a', '#3a3f55', '#7fd0ff', '#57c08a'][Math.floor(r() * 5)];
      if (r() < 0.7) ctx.fillRect(ix + k, iy + Math.floor(ih * 0.3) - 2, 2, 2);
    }
    for (let k = 0; k < iw; k += 2) {
      ctx.fillStyle = (k / 2) % 2 ? mix(MAC[i], '#0d0e14', 0.5) : mix(MAC[i], '#0d0e14', 0.3);
      ctx.fillRect(ix + k, y + H - 4, 2, 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(ix + 2, iy + 1, 1, 4); ctx.fillRect(ix + 3, iy + 1, 1, 2); // glass glint
    if (sw > 14 && !fl.messy) for (let cx = sx + 9; cx < sx + sw - 8; cx += 22) prop(ctx, i, cx, y + H - 4, r());
    ctx.fillStyle = '#12141c'; ctx.fillRect(sx, y, 1, H);
    sx += sw;
  });
  if (fl.messy) { // boxes and tape
    ctx.fillStyle = '#8a6a3c'; ctx.fillRect(x + 6, y + H - 9, 6, 5); ctx.fillRect(x + 10, y + H - 13, 5, 4); ctx.fillRect(x + W - 16, y + H - 10, 7, 6);
    ctx.fillStyle = '#6b512d'; ctx.fillRect(x + 6, y + H - 7, 6, 1); ctx.fillRect(x + W - 16, y + H - 7, 7, 1);
    ctx.fillStyle = '#e7c34a';
    for (let k = 0; k < 14; k++) ctx.fillRect(x + Math.floor(W / 2) - 7 + k, y + 8 + Math.floor(k / 3), 1, 1);
  }
  ctx.fillStyle = '#12141c'; ctx.fillRect(x + W - 1, y, 1, H);
  if (fl.live) { // the part of the day not yet logged is dimmed, with a dashed amber edge
    const done = Math.round(W * (goal > 0 ? Math.min(1, Math.max(0, fl.kcal / goal)) : 1));
    ctx.fillStyle = 'rgba(13,14,20,.55)'; ctx.fillRect(x + done, y, W - done, H);
    ctx.fillStyle = '#ffd166';
    for (let k = 0; k < W; k += 3) { ctx.fillRect(x + k, y, 2, 1); ctx.fillRect(x + k, y + H - 1, 2, 1); }
    for (let k = 0; k < H; k += 3) { ctx.fillRect(x, y + k, 1, 2); ctx.fillRect(x + W - 1, y + k, 1, 2); }
  }
  const n = fl.live ? 1 : fl.walkers;
  if (!fl.messy && n > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y, W - 2, H); ctx.clip();
    for (const w of walkersFor(seed, n, W)) walker(ctx, w, walkerState(w, t, W), x, y, W, H);
    ctx.restore();
  }
  ctx.fillStyle = '#5a5e70'; ctx.fillRect(x - 1, y + H, W + 2, 2);
  ctx.fillStyle = '#3a3d4c'; ctx.fillRect(x - 1, y + H + 1, W + 2, 1);
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
function lobby(ctx, x, y, W, H) {
  ctx.fillStyle = '#23262f'; ctx.fillRect(x, y, W, H);
  ctx.fillStyle = '#12141c'; ctx.fillRect(x, y, 1, H); ctx.fillRect(x + W - 1, y, 1, H);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 4, y + 3, W - 8, 3);
  ctx.fillStyle = '#7a6230'; ctx.fillRect(x + 4, y + 6, W - 8, 1);
  const dw = Math.min(W - 12, 22), dx = x + Math.floor((W - dw) / 2);
  ctx.fillStyle = '#7fd0ff'; ctx.fillRect(dx, y + 9, dw, H - 9);
  ctx.fillStyle = '#12141c'; ctx.fillRect(dx + Math.floor(dw / 2), y + 9, 1, H - 9);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(dx + 2, y + 10, 1, 5);
  ctx.fillStyle = '#5a5e70'; ctx.fillRect(x - 1, y + H, W + 2, 2);
  ctx.fillStyle = '#16181d'; ctx.fillRect(0, y + H + 2, ctx.canvas.width, GROUND_H - 2);
  ctx.fillStyle = '#2d3244'; ctx.fillRect(0, y + H + 2, ctx.canvas.width, 1);
  return H + GROUND_H;
}

// ---------- layout and drawing ----------
const ROOF_TOP = 9; // room above the roof line for the rooftop props
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
  const top = ROOF_TOP + SKY_PAD;
  const lh = top + rows.reduce((a, r) => a + (r.kind === 'lobby' ? H + GROUND_H : H + 2), 0);
  canvas.width = lw; canvas.height = lh;
  canvas.style.width = `${lw * u}px`; canvas.style.height = `${lh * u}px`;
  canvas.style.imageRendering = 'pixelated';
  canvas.dataset.floors = String(rows.filter((r) => r.kind === 'floor' && !r.fl.live).length);
  return { u, lw, lh, H, rows, top };
}

// Draws the tower at time t (seconds). With `range` ([y0, y1] in buffer px) only floors in view are redrawn.
export function drawTower(canvas, m, opts = {}, layout = sizeTower(canvas, m, opts), t = 1.3) {
  const ctx = canvas.getContext('2d');
  const { lw, lh, H, rows, top } = layout;
  const [y0, y1] = opts.range || [0, lh];
  const goal = opts.goal;
  ctx.clearRect(0, Math.max(0, y0), lw, Math.min(lh, y1) - Math.max(0, y0));
  if (y0 <= top) roof(ctx, 0, ROOF_TOP, lw);
  let y = top;
  for (const row of rows) {
    const h = row.kind === 'lobby' ? H + GROUND_H : H + 2;
    if (y + h >= y0 && y <= y1) {
      if (row.kind === 'floor') floor(ctx, 0, y, lw, H, row.fl, t, goal);
      else if (row.kind === 'empty') emptyTonight(ctx, 0, y, lw, H);
      else lobby(ctx, 0, y, lw, H);
    }
    y += h;
  }
  return layout;
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Draws now, then loops on requestAnimationFrame only while the canvas is on screen.
// `opts.scroller` is the scrolling parent of a tall canvas, so only the floors in view are redrawn.
// Returns a stop function.
export function animate(canvas, m, opts = {}) {
  const layout = sizeTower(canvas, m, opts);
  const paint = (t) => {
    let range = null;
    if (opts.scroller) {
      const c = canvas.getBoundingClientRect(), s = opts.scroller.getBoundingClientRect();
      range = [Math.floor((s.top - c.top) / layout.u) - 8, Math.ceil((s.bottom - c.top) / layout.u) + 8];
    }
    drawTower(canvas, m, { ...opts, range }, layout, t);
  };
  paint(1.3);
  if (reduced()) return () => {};
  let raf = 0, visible = true, stopped = false;
  const start = performance.now();
  const frame = (now) => {
    raf = 0;
    if (stopped || !canvas.isConnected) return;
    paint((now - start) / 1000 + 1.3);
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
