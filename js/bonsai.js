// Bonsai on Today. Pure functions: history in, SVG markup out. No DOM, no stored state.
// One leaf per logged day. Missing days pause growth and never undo it.
import { totals } from './schema.js';
import { daySeries, onTarget } from './charts.js';

const r1 = (n) => Math.round(n * 10) / 10;

export const SLOTS = 40;      // leaves on the plant; later days reuse slots, newest wins
// A sodium-over leaf is brown until this many on-target days have followed it.
export const BROWN_FOR = 3;
// Under half the goal earns the leaf only, no tint, flower or brown.
const LOW = 0.5;

// Logged days oldest first, each with the traits that decorate its leaf.
// Today is still in progress, so it only earns a plain leaf.
export function bonsaiModel(entries, targets, today) {
  const byDay = new Map();
  for (const e of entries) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(...(e.items || []));
  }
  const days = [...byDay.keys()].filter((d) => byDay.get(d).length).sort();
  const leaves = days.map((day) => {
    if (day >= today) return { day, full: false, protein: false, flower: false, brown: false };
    const t = totals(byDay.get(day));
    const enough = targets.kcal > 0 && t.kcal >= targets.kcal * LOW;
    return {
      day,
      full: onTarget(t.kcal, targets.kcal),
      protein: enough && targets.protein > 0 && t.protein >= targets.protein,
      flower: enough && targets.fibre > 0 && t.fibre >= targets.fibre,
      brown: enough && targets.sodium > 0 && t.sodium > targets.sodium,
    };
  });
  // A brown leaf falls off after three on-target days.
  leaves.forEach((l, i) => {
    if (!l.brown) return;
    const good = leaves.slice(i + 1).filter((x) => x.full).length;
    if (good >= BROWN_FOR) { l.brown = false; l.fallen = true; }
  });
  return { days: leaves.length, full: leaves.filter((l) => l.full).length, leaves };
}

// Seven tiles ending today. Filled when logged, ticked when on target. No streak count.
export function weekTiles(entries, targets, today) {
  return daySeries(entries, today, 7).map((s) => ({
    day: s.day,
    label: new Date(`${s.day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' }),
    logged: s.logged,
    onTarget: s.logged && s.day < today && onTarget(s.kcal, targets.kcal),
    today: s.day === today,
  }));
}

// Same day, same wobble, so the plant looks hand-drawn but never changes between renders.
function jitter(day) {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5..0.5
}

// Sprites live in index.html. Trunks are drawn 160px wide, base centred on the pot's soil.
// Anchors are where leaves cluster, in each trunk symbol's own coordinates.
const TRUNKS = [
  { id: 'trunk-1', view: 80, upTo: 3, anchors: [[46, 22], [34, 28], [51, 46]] },
  { id: 'trunk-2', view: 80, upTo: 14, anchors: [[18, 38], [65, 28], [38, 20], [30, 45], [52, 36]] },
  { id: 'trunk-3', view: 100, upTo: Infinity, anchors: [[15, 35], [80, 20], [18, 10], [70, 8], [42, 10], [28, 50], [65, 40], [30, 24], [60, 16]] },
];
const BOX = 160, CX = 120, SOIL_Y = 188;
const FULL = 22, SMALL = 15, FLOWER = 13;

const sprite = (id, x, y, size) => `<use href="#${id}" x="${r1(x - size / 2)}" y="${r1(y - size / 2)}" width="${size}" height="${size}"/>`;

export function bonsaiSvg(model) {
  const n = model.days;
  const trunk = TRUNKS.find((t) => n <= t.upTo);
  const k = BOX / trunk.view;
  const place = ([ax, ay]) => [CX - BOX / 2 + ax * k, SOIL_Y - BOX + ay * k];
  const slots = new Array(SLOTS).fill(null);
  model.leaves.forEach((l, i) => { slots[i % SLOTS] = l; });
  const A = trunk.anchors.length;
  const leaves = [];
  const extras = [];
  slots.forEach((leaf, i) => {
    if (!leaf || leaf.fallen) return;
    const [ax, ay] = place(trunk.anchors[i % A]);
    // Rings widen as an anchor fills up, so a branch tip looks like a growing cluster.
    const ring = Math.floor(i / A);
    const ang = i * 2.399963 + jitter(leaf.day);
    const rad = ring === 0 ? 0 : 7 + ring * 4.5;
    const x = ax + Math.cos(ang) * rad, y = ay + Math.sin(ang) * rad * 0.8;
    const size = leaf.full ? FULL : SMALL;
    const id = leaf.brown ? 'leaf-brown' : leaf.protein ? 'leaf-protein' : leaf.full ? 'leaf' : 'leaf-small';
    leaves.push(sprite(id, x, y, size));
    if (leaf.flower) extras.push(sprite('flower', x + size * 0.3, y - size * 0.35, FLOWER));
    if (leaf.full && jitter(leaf.day) > 0.25) extras.push(sprite('sparkle', x + size * 0.45, y - size * 0.55, 8));
  });
  const trunkUse = `<use href="#${trunk.id}" x="${CX - BOX / 2}" y="${SOIL_Y - BOX}" width="${BOX}" height="${BOX}"/>`;
  // The soil ellipse is 6 units above the pot rim, so drop the pot so the trunk grows out of it.
  const pot = '<use href="#pot" x="40" y="170" width="160" height="60"/>';
  const label = n === 0 ? 'Bonsai. Log a meal to plant it.' : `Bonsai grown from ${n} logged ${n === 1 ? 'day' : 'days'}, ${model.full} on target.`;
  return `<svg class="bonsai" viewBox="0 16 240 216" role="img" aria-label="${label}">${pot}${n ? trunkUse : ''}${leaves.join('')}${extras.join('')}</svg>`;
}
