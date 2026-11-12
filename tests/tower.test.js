import test from 'node:test';
import assert from 'node:assert/strict';
import { towerModel, macroShare, pickShops, celebrationFor, skylineFor, SCENE_BELOW_ROOF, SHOPS, weekStart, weekScores, weekBudget, weekBeatFor } from '../js/tower.js';

const T = { kcal: 1800, protein: 60, carbs: 225, fat: 60 };
const meal = (d, kcal, protein, carbs, fat) => ({ day: d, items: [{ name: 'x', kcal, protein, carbs, fat }] });

test('share follows calories, not grams', () => {
  const s = macroShare({ protein: 50, carbs: 50, fat: 50 });
  assert.ok(Math.abs(s.protein - 200 / 850) < 1e-9);
  assert.ok(Math.abs(s.fat - 450 / 850) < 1e-9);
  assert.ok(Math.abs(s.protein + s.carbs + s.fat - 1) < 1e-9);
});

test('zero macros split evenly', () => {
  assert.deepEqual(macroShare({ protein: 0, carbs: 0, fat: 0 }), { protein: 1 / 3, carbs: 1 / 3, fat: 1 / 3 });
});

test('no floor is ever messy, and every logged day still lays one', () => {
  const m = towerModel([meal('2026-10-01', 1800, 60, 225, 60), meal('2026-10-02', 500, 10, 60, 10), meal('2026-10-03', 2600, 60, 225, 60), meal('2026-10-04', 1900, 60, 225, 60)], T, '2026-10-05');
  assert.equal(m.count, 4);
  assert.ok(m.floors.every((f) => !('messy' in f)));
});

test('weekStart finds the Monday, across a Sunday and a year boundary', () => {
  assert.equal(weekStart('2026-11-09'), '2026-11-09'); // Monday
  assert.equal(weekStart('2026-11-15'), '2026-11-09'); // Sunday
  assert.equal(weekStart('2026-11-08'), '2026-11-02'); // Sunday of the week before
  assert.equal(weekStart('2027-01-01'), '2026-12-28'); // Friday, week began last year
  assert.equal(weekStart('2024-03-01'), '2024-02-26'); // leap year
});

test('weekScores judges closed weeks by the average of logged days', () => {
  const entries = [
    meal('2026-11-02', 2400, 60, 225, 60), meal('2026-11-03', 1400, 60, 225, 60), // average 1,900 over 2 logged days: hit
    meal('2026-11-09', 2600, 60, 225, 60), meal('2026-11-10', 2600, 60, 225, 60), // running week: not scored
    meal('2026-10-26', 800, 30, 100, 30), // week of 10-26: miss
  ];
  const s = weekScores(entries, 1800, '2026-11-11');
  assert.deepEqual(Object.keys(s).sort(), ['2026-10-26', '2026-11-02']);
  assert.equal(s['2026-11-02'].days, 2);
  assert.equal(s['2026-11-02'].avg, 1900);
  assert.equal(s['2026-11-02'].hit, true);
  assert.equal(s['2026-10-26'].hit, false);
  assert.deepEqual(weekScores([], 1800, '2026-11-11'), {});
});

test('a hit week makes all its floors busy, a missed week stays quiet', () => {
  const day = (d, k) => meal(d, k, 60, 225, 60);
  const hit = ['2026-11-02', '2026-11-03', '2026-11-04'].map((d, i) => day(d, [2200, 1700, 1600][i])); // avg 1,833
  const miss = ['2026-10-26', '2026-10-27'].map((d) => day(d, 900));
  const m = towerModel([...hit, ...miss, day('2026-11-09', 500)], T, '2026-11-10');
  assert.deepEqual(m.floors.map((f) => f.busy), [false, false, true, true, true, false]);
  assert.equal(m.floors.at(-1).day, '2026-11-09');
  assert.ok(m.floors.every((f) => !f.messy));
  // busy floors get more walkers than a quiet floor with the same meals
  assert.ok(m.floors[2].walkers > m.floors[0].walkers);
});

test('the running week stays quiet until it closes', () => {
  const m = towerModel([meal('2026-11-09', 1800, 60, 225, 60), meal('2026-11-10', 1800, 60, 225, 60)], T, '2026-11-11');
  assert.deepEqual(m.floors.map((f) => f.busy), [false, false]);
  const next = towerModel([meal('2026-11-09', 1800, 60, 225, 60), meal('2026-11-10', 1800, 60, 225, 60)], T, '2026-11-16');
  assert.deepEqual(next.floors.map((f) => f.busy), [true, true]);
});

test('weekBudget: worked example is 1,600', () => {
  const e = [meal('2026-11-09', 2400, 0, 0, 0), meal('2026-11-10', 2200, 0, 0, 0)];
  const b = weekBudget(e, 1800, '2026-11-11');
  assert.equal(b.budget, 1600);
  assert.equal(b.onTrack, false); // 1,600 is more than 10% under 1,800
});

test('weekBudget: Monday is the target, clamps hold, unlogged days drop out', () => {
  assert.equal(weekBudget([], 1800, '2026-11-09').budget, 1800);
  assert.equal(weekBudget([], 1800, '2026-11-09').onTrack, true);
  assert.equal(weekBudget([meal('2026-11-09', 6000, 0, 0, 0)], 1800, '2026-11-10').budget, 1260); // 70%
  assert.equal(weekBudget([meal('2026-11-09', 100, 0, 0, 0), meal('2026-11-10', 100, 0, 0, 0)], 1800, '2026-11-11').budget, 2340); // 130%
  // Only Mon logged out of Mon-Tue-Wed(today): (1800*(1+5) - 1800) / 5 = 1,800
  assert.equal(weekBudget([meal('2026-11-09', 1800, 0, 0, 0)], 1800, '2026-11-11').budget, 1800);
  assert.equal(weekBudget([], 0, '2026-11-11'), null);
});

test("tonight's floor seals against the budget, not the fixed target", () => {
  const e = [meal('2026-11-09', 2400, 60, 225, 60), meal('2026-11-10', 2200, 60, 225, 60), meal('2026-11-11', 1600, 60, 225, 60)];
  const m = towerModel(e, T, '2026-11-11');
  assert.equal(m.tonight.budget, 1600);
  assert.equal(m.tonight.inBand, true);
  assert.equal(towerModel([meal('2026-11-11', 1600, 60, 225, 60)], T, '2026-11-11').tonight.inBand, false); // budget is 1,800
});

test('weekBeatFor fires once for a hit last week', () => {
  const scores = { '2026-11-02': { hit: true }, '2026-10-26': { hit: false } };
  assert.equal(weekBeatFor(null, scores, '2026-11-10'), '2026-11-02');
  assert.equal(weekBeatFor({ week: '2026-11-02' }, scores, '2026-11-10'), null);
  assert.equal(weekBeatFor(null, scores, '2026-11-03'), null); // last week was a miss
});

test('floors run oldest first and today is not a floor', () => {
  const m = towerModel([meal('2026-10-03', 1800, 60, 225, 60), meal('2026-10-01', 1800, 60, 225, 60), meal('2026-10-04', 900, 30, 100, 30)], T, '2026-10-04');
  assert.deepEqual(m.floors.map((f) => f.day), ['2026-10-01', '2026-10-03']);
  assert.equal(m.tonight.day, '2026-10-04');
  assert.equal(m.tonight.walkers, 0);
});

test('shop picks are stable and come from each macro list', () => {
  const a = pickShops('2026-10-01');
  assert.deepEqual(a, pickShops('2026-10-01'));
  a.forEach((k, i) => assert.ok(SHOPS[i].includes(k)));
  const kinds = new Set(Array.from({ length: 60 }, (_, i) => pickShops(`2026-09-${i}`)[0]));
  assert.ok(kinds.size > 1);
});

test('quiet walkers equal meals, capped at 3', () => {
  const day = (n, kcal) => Array.from({ length: n }, () => meal('2026-10-01', kcal, 20, 75, 20));
  assert.equal(towerModel(day(2, 900), T, '2026-10-02').floors[0].walkers, 2);
  assert.equal(towerModel(day(5, 360), T, '2026-10-02').floors[0].walkers, 3);
  assert.equal(towerModel(day(1, 400), T, '2026-10-02').floors[0].walkers, 1);
});

test('an empty history has no floors and no tonight', () => {
  const m = towerModel([], T, '2026-10-31');
  assert.equal(m.count, 0);
  assert.equal(m.tonight, null);
  assert.equal(m.stageName, 'Empty lot');
});

test('milestones and stages count every floor, busy or not', () => {
  const entries = Array.from({ length: 60 }, (_, i) => meal(`2026-08-${String(i + 1).padStart(2, '0')}`, i % 2 ? 300 : 1800, 60, 225, 60)).filter((e) => +e.day.slice(8) <= 31);
  const more = Array.from({ length: 29 }, (_, i) => meal(`2026-09-${String(i + 1).padStart(2, '0')}`, 300, 10, 30, 10));
  const m = towerModel([...entries, ...more], T, '2026-12-31');
  assert.equal(m.count, 60);
  assert.deepEqual(m.built, ['lobby', 'garden', 'spire']);
  assert.equal(m.next.key, 'beacon');
});

test('a walker returns to the same spot and frame after one 8 s loop', async () => {
  const { walkersFor, walkerState, LOOP } = await import('../js/tower-art.js');
  assert.equal(LOOP, 8);
  for (const seed of [1, 7, 12345]) {
    for (const w of walkersFor(seed, 3, 67)) {
      for (const t of [0.3, 1.3, 3.7, 6.1]) {
        const a = walkerState(w, t, 67), b = walkerState(w, t + LOOP, 67);
        assert.ok(Math.abs(a.x - b.x) < 1e-6, `x ${a.x} vs ${b.x}`);
        assert.equal(a.frame, b.frame);
      }
    }
  }
});

test('walkers mix directions and speeds across floors', async () => {
  const { walkersFor } = await import('../js/tower-art.js');
  const all = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((s) => walkersFor(s, 3, 67));
  assert.ok(new Set(all.map((w) => w.dir)).size === 2);
  assert.ok(new Set(all.map((w) => w.laps)).size === 2);
});

test('proteinHit and inBand are set on past floors and on tonight', () => {
  const m = towerModel([
    meal('2026-10-01', 1800, 60, 225, 60), meal('2026-10-02', 1800, 59, 225, 60), meal('2026-10-03', 2600, 80, 225, 60),
    meal('2026-10-04', 1000, 70, 100, 30), meal('2026-10-05', 1700, 40, 225, 60),
  ], T, '2026-10-05');
  assert.deepEqual(m.floors.map((f) => f.proteinHit), [true, false, true, true]);
  assert.deepEqual(m.floors.map((f) => f.inBand), [true, true, false, false]);
  assert.equal(m.tonight.proteinHit, false);
  assert.equal(m.tonight.inBand, true);
  const m2 = towerModel([meal('2026-10-05', 900, 61, 100, 30)], T, '2026-10-05');
  assert.equal(m2.tonight.proteinHit, true);
  assert.equal(m2.tonight.inBand, false);
});

test('without targets nothing counts as a hit', () => {
  const m = towerModel([meal('2026-10-05', 900, 61, 100, 30)], { kcal: 0, protein: 0 }, '2026-10-05');
  assert.equal(m.tonight.proteinHit, false);
  assert.equal(m.tonight.inBand, false);
});

test('celebrationFor: first hit, both at once, already done, new day, going over', () => {
  const D = '2026-10-05';
  assert.equal(celebrationFor(null, { day: D, proteinHit: false, inBand: false }), null);
  assert.equal(celebrationFor(null, { day: D, proteinHit: true, inBand: false }), 'protein');
  assert.equal(celebrationFor(null, { day: D, proteinHit: false, inBand: true }), 'calorie');
  assert.equal(celebrationFor(null, { day: D, proteinHit: true, inBand: true }), 'both');
  assert.equal(celebrationFor({ day: D, protein: true, kcal: false }, { day: D, proteinHit: true, inBand: true }), 'calorie');
  assert.equal(celebrationFor({ day: D, protein: true, kcal: true }, { day: D, proteinHit: true, inBand: true }), null);
  assert.equal(celebrationFor({ day: '2026-10-04', protein: true, kcal: true }, { day: D, proteinHit: true, inBand: true }), 'both');
  // went over after dinner, then back into the band: no replay
  assert.equal(celebrationFor({ day: D, protein: true, kcal: true }, { day: D, proteinHit: true, inBand: false }), null);
  assert.equal(celebrationFor({ day: D, protein: true, kcal: true }, { day: D, proteinHit: true, inBand: true }), null);
});

test('skyline: a short tower has neighbours taller than it', () => {
  const s = skylineFor(3);
  assert.ok(s.roofs.some((r) => r.dy < 0));
  assert.equal(s.stars, 0);
});

test('skyline: a very tall tower has outgrown every neighbour', () => {
  const s = skylineFor(120);
  assert.ok(s.roofs.every((r) => r.dy >= SCENE_BELOW_ROOF));
  assert.equal(s.stars, 1);
});

test('skyline: neighbours sink as the tower grows, stars fade in from 30 to 100', () => {
  assert.ok(skylineFor(25).roofs.every((r, i) => r.dy > skylineFor(3).roofs[i].dy));
  assert.equal(skylineFor(30).stars, 0);
  assert.ok(Math.abs(skylineFor(65).stars - 0.5) < 1e-9);
  assert.equal(skylineFor(100).stars, 1);
});

test('stations: one per prop, shared by shop actions, and the activity loop is 12 s', async () => {
  const { stations, ALOOP } = await import('../js/tower-art.js');
  assert.equal(ALOOP, 12);
  const segs = [{ sx: 1, sw: 60, shop: 'sport' }, { sx: 61, sw: 10, shop: 'pool' }, { sx: 71, sw: 40, shop: 'noodle' }];
  const calm = stations(segs, 4, 0, false), busy = stations(segs, 4, 0, true);
  assert.equal(calm.length, 5); // props every 21 px from +10, stopping 7 px short of the shop edge
  assert.ok(busy.length > calm.length);
  assert.ok(calm.every((s) => s.dir === 1 || s.dir === -1));
  assert.deepEqual([...new Set(calm.map((s) => s.shop))].sort(), ['noodle', 'sport']); // residents dress for the shop they stand in
  assert.deepEqual(calm.slice(0, 2).map((s) => s.act).sort(), ['lift', 'run']);
});
