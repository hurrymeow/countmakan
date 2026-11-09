// Macro tower. Pure functions: history in, floor data out. No stored state.
// Every finished day with logged food lays one floor. The floor is split left to right
// into protein, carbs and fat by each macro's share of that day's calories. Calories are judged by
// the Mon-Sun week, not the day: a closed week whose average over its logged days is within the goal
// band makes all its floors busy (more props, more people). Every other floor keeps the quiet look.
// Tonight's floor is today, live, and seals against the weekly budget.
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
export const BUSY_WALKERS = 5;
export const BUDGET_CLAMP = [0.7, 1.3];

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

// ---------- Weeks (Monday to Sunday) ----------
const pad = (n) => String(n).padStart(2, '0');
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Local noon keeps the date stable across daylight-saving changes.
const dayDate = (day) => new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 12);
export function addDays(day, n) { const d = dayDate(day); d.setDate(d.getDate() + n); return dayStr(d); }
// The Monday of the week `day` falls in.
export function weekStart(day) { return addDays(day, -((dayDate(day).getDay() + 6) % 7)); }

function dayKcal(entries) {
  const byDay = new Map();
  for (const e of entries) {
    if (!e.items?.length) continue;
    byDay.set(e.day, (byDay.get(e.day) || 0) + totals(e.items).kcal);
  }
  return byDay;
}

// Closed weeks only (those that ended before this week's Monday). Days with no log don't count.
// Returns { [weekStart]: { avg, days, hit } }.
export function weekScores(entries, target, today) {
  const now = weekStart(today);
  const sums = {};
  for (const [day, kcal] of dayKcal(entries)) {
    const w = weekStart(day);
    if (w >= now) continue;
    const s = sums[w] || (sums[w] = { sum: 0, days: 0 });
    s.sum += kcal; s.days++;
  }
  const out = {};
  for (const [w, { sum, days }] of Object.entries(sums)) out[w] = { avg: sum / days, days, hit: onTarget(sum / days, target) };
  return out;
}

// What today can hold so the running week lands on the target average, assuming every remaining day is logged.
// Clamped so it never suggests starving or a binge. `onTrack` is the budget within the goal band of the target.
export function weekBudget(entries, target, today) {
  if (!(target > 0)) return null;
  const start = weekStart(today);
  let logged = 0, before = 0;
  for (const [day, kcal] of dayKcal(entries)) if (day >= start && day < today) { logged++; before += kcal; }
  const left = 7 - Math.round((dayDate(today) - dayDate(start)) / 86400000);
  const raw = (target * (logged + left) - before) / left;
  const budget = Math.min(target * BUDGET_CLAMP[1], Math.max(target * BUDGET_CLAMP[0], raw));
  return { budget, onTrack: onTarget(budget, target) };
}

function floorFor(day, meals, targets, { live = false, busy = false, budget = 0 } = {}) {
  const t = totals(meals.flatMap((e) => e.items));
  const gate = live ? budget : targets.kcal;
  return {
    day, share: macroShare(t), shops: pickShops(day), busy, kcal: t.kcal, live, budget: live ? budget : 0,
    proteinHit: targets.protein > 0 && t.protein >= targets.protein,
    inBand: gate > 0 && onTarget(t.kcal, gate),
    walkers: live ? 0 : busy ? Math.min(BUSY_WALKERS, meals.length + 2) : Math.min(MAX_WALKERS, meals.length),
  };
}

// `today` is a YYYY-MM-DD string. Floors come oldest first. `tonight` is null until a meal is logged.
export function towerModel(entries, targets, today) {
  const byDay = new Map();
  for (const e of entries) {
    if (!e.items?.length) continue;
    byDay.set(e.day, (byDay.get(e.day) || []).concat([e]));
  }
  const scores = weekScores(entries, targets.kcal, today);
  const wb = weekBudget(entries, targets.kcal, today);
  const floors = [...byDay.keys()].filter((d) => d < today).sort()
    .map((d) => floorFor(d, byDay.get(d), targets, { busy: !!scores[weekStart(d)]?.hit }));
  const tonight = byDay.has(today) ? floorFor(today, byDay.get(today), targets, { live: true, budget: wb?.budget || 0 }) : null;
  const count = floors.length;
  const skyline = SKYLINE_AT.filter((n) => count >= n).length;
  const stage = count === 0 ? 0 : 1 + skyline + (count >= 100 ? 1 : 0);
  const built = MILESTONES.filter((m) => count >= m.at).map((m) => m.key);
  const next = MILESTONES.find((m) => count < m.at) || null;
  return { floors, tonight, count, stage, stageName: STAGE_NAME[stage], skyline, built, next, budget: wb, scores };
}

export const headerText = (m) => (m.count
  ? `${m.stageName} · ${m.count} ${m.count === 1 ? 'floor' : 'floors'}${m.next ? ` · ${m.next.name} at ${m.next.at}` : ''}`
  : 'No floors yet');

// Which beat to play, given what was already celebrated today and the state now.
// `done` is { day, protein, kcal } from storage (or null). `now` is { day, proteinHit, inBand }.
// Going over after dinner never replays a beat: a goal celebrates once per day.
export function celebrationFor(done, now) {
  const seen = done?.day === now.day ? done : { protein: false, kcal: false };
  const p = !!now.proteinHit && !seen.protein;
  const k = !!now.inBand && !seen.kcal;
  return p && k ? 'both' : p ? 'protein' : k ? 'calorie' : null;
}

// The week beat plays once, on the first render after the previous week closed as a hit.
// `done` is the stored celebration state. `scores` is from weekScores.
export function weekBeatFor(done, scores, today) {
  const last = addDays(weekStart(today), -7);
  return scores?.[last]?.hit && done?.week !== last ? last : null;
}

// ---------- Skyline ----------
// Neighbour roofs, clouds and stars sit at fixed altitudes (in floors), so how far they fall
// below the tower's roof line shows how tall the tower is. `dy` is in buffer rows, measured down
// from the tower's roof line. Negative means above it.
export const ROWS_PER_FLOOR = 1.5;
export const SCENE_BELOW_ROOF = 100; // buffer rows of scene under the roof line on Today. A roof at or past this is off screen.
const NEIGHBOURS = [
  { alt: 8, x: 0.05, w: 16 }, { alt: 13, x: 0.2, w: 14 }, { alt: 18, x: 0.37, w: 18 }, { alt: 23, x: 0.52, w: 15 },
  { alt: 28, x: 0.66, w: 17 }, { alt: 33, x: 0.8, w: 14 }, { alt: 38, x: 0.9, w: 16 },
];
const CLOUDS = [
  { alt: 42, x: 0.08, w: 22 }, { alt: 52, x: 0.6, w: 26 }, { alt: 86, x: 0.3, w: 24 }, { alt: 95, x: 0.72, w: 20 },
];
export function skylineFor(count) {
  const at = (o) => ({ ...o, dy: (count - o.alt) * ROWS_PER_FLOOR });
  const stars = Math.max(0, Math.min(1, (count - 30) / 70));
  return { roofs: NEIGHBOURS.map(at), clouds: CLOUDS.map(at), stars };
}
