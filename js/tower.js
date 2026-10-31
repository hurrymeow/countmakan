// Macro tower. Pure functions: history in, floor data out. No stored state.
// Every finished day with logged food lays one floor. The floor is split left to right
// into protein, carbs and fat by each macro's share of that day's calories. A day outside
// the goal band still lays a floor, but it renders messy. Tonight's floor is today, live.
import { totals } from './schema.js';
import { onTarget } from './charts.js';

export const SHOPS = [
  ['sport', 'boxing', 'pool', 'dojo'],
  ['office', 'bakery', 'noodle', 'pizza'],
  ['butch', 'fish', 'deli', 'nut'],
];
export const MILESTONES = [
  { key: 'lobby', at: 5, name: 'Lobby' },
  { key: 'garden', at: 20, name: 'Rooftop garden' },
  { key: 'spire', at: 60, name: 'Spire' },
  { key: 'beacon', at: 100, name: 'Beacon' },
];
export const STAGE_NAME = ['Empty lot', 'Foundation', 'Low rise', 'Mid rise', 'High rise', 'Skyscraper'];
export const SKYLINE_AT = [3, 14, 45];
export const MAX_WALKERS = 3;

// Kcal per gram, so shares follow calories and fat is not understated.
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

export function macroShare(t) {
  const kc = { protein: t.protein * KCAL_PER_G.protein, carbs: t.carbs * KCAL_PER_G.carbs, fat: t.fat * KCAL_PER_G.fat };
  const sum = kc.protein + kc.carbs + kc.fat;
  if (!(sum > 0)) return { protein: 1 / 3, carbs: 1 / 3, fat: 1 / 3 };
  return { protein: kc.protein / sum, carbs: kc.carbs / sum, fat: kc.fat / sum };
}

// Stable string hash (FNV-1a), so a day always gets the same shops.
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// One shop per macro, picked from the day's hash.
export function pickShops(day) {
  const h = hash(day);
  return SHOPS.map((list, i) => list[Math.floor(h / 4 ** i) % list.length]);
}

function floorFor(day, meals, targets, live = false) {
  const t = totals(meals.flatMap((e) => e.items));
  const messy = !live && targets.kcal > 0 && !onTarget(t.kcal, targets.kcal);
  return {
    day, share: macroShare(t), shops: pickShops(day), messy, kcal: t.kcal, live,
    walkers: messy || live ? 0 : Math.min(MAX_WALKERS, meals.length),
  };
}

// `today` is a YYYY-MM-DD string. Floors come oldest first. `tonight` is null until a meal is logged.
export function towerModel(entries, targets, today) {
  const byDay = new Map();
  for (const e of entries) {
    if (!e.items?.length) continue;
    byDay.set(e.day, (byDay.get(e.day) || []).concat([e]));
  }
  const floors = [...byDay.keys()].filter((d) => d < today).sort().map((d) => floorFor(d, byDay.get(d), targets));
  const tonight = byDay.has(today) ? floorFor(today, byDay.get(today), targets, true) : null;
  const count = floors.length;
  const skyline = SKYLINE_AT.filter((n) => count >= n).length;
  const stage = count === 0 ? 0 : 1 + skyline + (count >= 100 ? 1 : 0);
  const built = MILESTONES.filter((m) => count >= m.at).map((m) => m.key);
  const next = MILESTONES.find((m) => count < m.at) || null;
  return { floors, tonight, count, stage, stageName: STAGE_NAME[stage], skyline, built, next };
}

export const headerText = (m) => (m.count
  ? `${m.stageName} · ${m.count} ${m.count === 1 ? 'floor' : 'floors'}${m.next ? ` · ${m.next.name} at ${m.next.at}` : ''}`
  : 'Log a full day to lay the first floor.');
