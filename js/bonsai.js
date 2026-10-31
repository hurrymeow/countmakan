// Bonsai on Today. Pure functions: history in, SVG markup out. No DOM, no stored state.
// One leaf per logged day. Missing days pause growth and never undo it.
import { totals } from './schema.js';
import { daySeries, onTarget } from './charts.js';

const r1 = (n) => Math.round(n * 10) / 10;

export const SLOTS = 40;      // leaves on the plant; later days reuse slots, newest wins
const BRANCHES = 10;
const PER_BRANCH = SLOTS / BRANCHES;
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

// Fixed trunk curve. Branch positions are points on it.
const TRUNK = [[160, 172], [136, 124], [186, 84], [158, 28]];
const bez = (p, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u ** 3 * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t ** 3 * p[3][k]);
};
function branchGeom(b) {
  const t = 0.28 + (0.5 * b) / (BRANCHES - 1);
  const [x, y] = bez(TRUNK, t);
  const side = b % 2 ? 1 : -1;
  const len = 74 - b * 3.4;
  const end = [x + side * len, y - len * 0.45];
  const ctl = [x + side * len * 0.55, y - len * 0.2];
  return { x, y, side, end, ctl };
}
const quad = (g, t) => {
  const u = 1 - t;
  return {
    x: u * u * g.x + 2 * u * t * g.ctl[0] + t * t * g.end[0],
    y: u * u * g.y + 2 * u * t * g.ctl[1] + t * t * g.end[1],
    a: Math.atan2(2 * u * (g.ctl[1] - g.y) + 2 * t * (g.end[1] - g.ctl[1]), 2 * u * (g.ctl[0] - g.x) + 2 * t * (g.end[0] - g.ctl[0])),
  };
};

const LEAF = 'M0 0C5 -5 13 -5 18 0C13 5 5 5 0 0Z';
function flowerSvg(x, y) {
  const petals = [0, 1, 2, 3, 4].map((i) => {
    const a = (i * 2 * Math.PI) / 5;
    return `<circle class="bz-petal" cx="${r1(Math.cos(a) * 3.2)}" cy="${r1(Math.sin(a) * 3.2)}" r="2.2"/>`;
  }).join('');
  return `<g transform="translate(${r1(x)} ${r1(y)})">${petals}<circle class="bz-core" r="1.5"/></g>`;
}

export function bonsaiSvg(model) {
  const n = model.days;
  const slots = new Array(SLOTS).fill(null);
  model.leaves.forEach((l, i) => { slots[i % SLOTS] = l; });
  const trunkVis = n === 0 ? 0.12 : Math.min(1, 0.3 + 0.07 * n);
  const trunkW = r1(2.5 + (Math.min(n, 120) / 120) * 3.5);
  const [p0, p1, p2, p3] = TRUNK;
  const parts = [`<path class="bz-trunk" pathLength="1" stroke-dasharray="${trunkVis} 1" stroke-width="${trunkW}" d="M${p0}C${p1} ${p2} ${p3}"/>`];
  const leafParts = [];
  for (let b = 0; b < BRANCHES; b++) {
    const mine = [];
    for (let k = 0; k < PER_BRANCH; k++) {
      const leaf = slots[k * BRANCHES + b];
      if (leaf) mine.push({ leaf, k });
    }
    if (!mine.length) continue;
    const g = branchGeom(b);
    const reach = Math.min(1, (mine.length + 0.5) / PER_BRANCH);
    parts.push(`<path class="bz-branch" pathLength="1" stroke-dasharray="${r1(reach)} 1" d="M${r1(g.x)} ${r1(g.y)}Q${r1(g.ctl[0])} ${r1(g.ctl[1])} ${r1(g.end[0])} ${r1(g.end[1])}"/>`);
    for (const { leaf, k } of mine) {
      if (leaf.fallen) continue;
      const pt = quad(g, (k + 1) / PER_BRANCH);
      const flip = k % 2 ? 1 : -1;
      const ang = pt.a + flip * (0.6 + jitter(leaf.day) * 0.4);
      const scale = leaf.full ? 1.15 : 0.75;
      const cls = ['bz-leaf', leaf.full && 'full', leaf.protein && 'protein', leaf.brown && 'brown'].filter(Boolean).join(' ');
      leafParts.push(`<g transform="translate(${r1(pt.x)} ${r1(pt.y)}) rotate(${r1((ang * 180) / Math.PI)}) scale(${scale})"><path class="${cls}" d="${LEAF}"/><path class="bz-rib" d="M2 0H12"/></g>`);
      if (leaf.flower) {
        const tip = [pt.x + Math.cos(ang) * 18 * scale, pt.y + Math.sin(ang) * 18 * scale];
        leafParts.push(flowerSvg(tip[0], tip[1]));
      }
    }
  }
  const pot = '<path class="bz-pot" d="M112 172H208L198 196H122Z"/><path class="bz-pot" d="M108 172H212"/>';
  const label = n === 0 ? 'Bonsai. Log a meal to plant it.' : `Bonsai grown from ${n} logged ${n === 1 ? 'day' : 'days'}, ${model.full} on target.`;
  return `<svg class="bonsai" viewBox="0 0 320 200" role="img" aria-label="${label}">${parts.join('')}${leafParts.join('')}${pot}</svg>`;
}
