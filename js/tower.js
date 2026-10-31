// Macro tower on Today. Pure functions: history in, SVG markup out. No stored state.
// A finished day with calories in the goal band adds one floor. The floor's material is
// the macro closest to its target, or gold when all four land. Off days add nothing and
// take nothing away, and totals above target never count for more.
import { totals } from './schema.js';
import { onTarget } from './charts.js';
import {
  MATERIALS, MATERIAL_LABEL, MATERIAL_HINT, MATERIAL_SWATCH, GROUND_Y, CX, TOWER_W, PODIUM_H,
  floorArt, SKY, GROUND, SKYLINE, MILESTONES, STAGE_NAME, LOBBY, FOUNDATION, garden, spire, beacon,
} from './tower-art.js';

// Floors needed for each skyline tier after the bare one.
export const SKYLINE_AT = [3, 14, 45];
// Tallest the floors stack before they start to shrink to fit the scene.
const MAX_FLOOR_H = 12;
const TOWER_SPACE = 118;

const MACRO_MATERIAL = { protein: 'steel', carbs: 'brick', fat: 'glass' };

// Which material a day earns, or null when calories miss the band.
export function dayMaterial(t, targets) {
  if (!(targets.kcal > 0) || !onTarget(t.kcal, targets.kcal)) return null;
  const hit = ['kcal', 'protein', 'carbs', 'fat'].every((k) => onTarget(t[k], targets[k]));
  if (hit) return 'gold';
  let best = null;
  let gap = Infinity;
  for (const m of Object.keys(MACRO_MATERIAL)) {
    if (!(targets[m] > 0)) continue;
    const g = Math.abs(t[m] - targets[m]) / targets[m];
    if (g < gap) { gap = g; best = m; }
  }
  return best ? MACRO_MATERIAL[best] : null;
}

// `today` is a YYYY-MM-DD string. Today is skipped because the day is not over.
export function towerModel(entries, targets, today) {
  const byDay = new Map();
  for (const e of entries) {
    if (!e.items?.length || e.day >= today) continue;
    byDay.set(e.day, (byDay.get(e.day) || []).concat(e.items));
  }
  const floors = [...byDay.keys()].sort()
    .map((d) => dayMaterial(totals(byDay.get(d)), targets))
    .filter(Boolean);
  const n = floors.length;
  const counts = Object.fromEntries(MATERIALS.map((m) => [m, floors.filter((f) => f === m).length]));
  const built = MILESTONES.filter((m) => n >= m.at);
  const next = MILESTONES.find((m) => n < m.at) || null;
  const skyline = SKYLINE_AT.filter((t) => n >= t).length;
  const stage = n === 0 ? 0 : 1 + skyline + (n >= 100 ? 1 : 0);
  return { floors, count: n, counts, built: built.map((m) => m.key), next, skyline, stageName: STAGE_NAME[stage], days: byDay.size };
}

export function towerSvg(m) {
  const lobby = m.built.includes('lobby');
  const base = lobby ? PODIUM_H : 0;
  const fh = Math.min(MAX_FLOOR_H, TOWER_SPACE / Math.max(m.count, 1));
  const x = CX - TOWER_W / 2;
  const floors = m.floors.map((mat, i) => floorArt(mat, x, GROUND_Y - base - (i + 1) * fh, TOWER_W, fh)).join('');
  const top = GROUND_Y - base - m.count * fh;
  const roof = m.count === 0 ? '' : [
    m.built.includes('garden') ? garden(top) : '',
    m.built.includes('spire') ? spire(top) : '',
    m.built.includes('beacon') ? beacon(top) : '',
  ].join('');
  const label = m.count ? `Tower with ${m.count} ${m.count === 1 ? 'floor' : 'floors'}, ${m.stageName.toLowerCase()}` : 'Empty lot';
  return `<svg class="tower" viewBox="0 0 360 200" role="img" aria-label="${label}">${SKY}${SKYLINE[m.skyline]}${GROUND}${m.count ? (lobby ? LOBBY : FOUNDATION) : ''}${floors}${roof}</svg>`;
}

export const legend = (m) => MATERIALS.map((k) => ({ key: k, label: MATERIAL_LABEL[k], hint: MATERIAL_HINT[k], count: m.counts[k], color: MATERIAL_SWATCH(k) }));
