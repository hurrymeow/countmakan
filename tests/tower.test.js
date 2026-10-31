import test from 'node:test';
import assert from 'node:assert/strict';
import { towerModel, macroShare, pickShops, SHOPS } from '../js/tower.js';

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

test('the calorie gate marks floors messy but still lays them', () => {
  const m = towerModel([meal('2026-10-01', 1800, 60, 225, 60), meal('2026-10-02', 500, 10, 60, 10), meal('2026-10-03', 2600, 60, 225, 60), meal('2026-10-04', 1900, 60, 225, 60)], T, '2026-10-05');
  assert.equal(m.count, 4);
  assert.deepEqual(m.floors.map((f) => f.messy), [false, true, true, false]);
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

test('walkers equal meals, capped at 3, and none on messy floors', () => {
  const day = (n, kcal) => Array.from({ length: n }, () => meal('2026-10-01', kcal, 20, 75, 20));
  assert.equal(towerModel(day(2, 900), T, '2026-10-02').floors[0].walkers, 2);
  assert.equal(towerModel(day(5, 360), T, '2026-10-02').floors[0].walkers, 3);
  assert.equal(towerModel(day(1, 400), T, '2026-10-02').floors[0].walkers, 0);
});

test('an empty history has no floors and no tonight', () => {
  const m = towerModel([], T, '2026-10-31');
  assert.equal(m.count, 0);
  assert.equal(m.tonight, null);
  assert.equal(m.stageName, 'Empty lot');
});

test('milestones and stages count every floor, messy or not', () => {
  const entries = Array.from({ length: 60 }, (_, i) => meal(`2026-08-${String(i + 1).padStart(2, '0')}`, i % 2 ? 300 : 1800, 60, 225, 60)).filter((e) => +e.day.slice(8) <= 31);
  const more = Array.from({ length: 29 }, (_, i) => meal(`2026-09-${String(i + 1).padStart(2, '0')}`, 300, 10, 30, 10));
  const m = towerModel([...entries, ...more], T, '2026-12-31');
  assert.equal(m.count, 60);
  assert.deepEqual(m.built, ['lobby', 'garden', 'spire']);
  assert.equal(m.next.key, 'beacon');
});
