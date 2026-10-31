import test from 'node:test';
import assert from 'node:assert/strict';
import { towerModel, towerSvg, dayMaterial } from '../js/tower.js';

const T = { kcal: 1800, protein: 60, carbs: 225, fat: 60 };
const day = (d, kcal, protein, carbs, fat) => ({ day: d, items: [{ name: 'x', kcal, protein, carbs, fat }] });

test('picks the macro closest to target, gold when all four land', () => {
  assert.equal(dayMaterial({ kcal: 1800, protein: 60, carbs: 225, fat: 60 }, T), 'gold');
  assert.equal(dayMaterial({ kcal: 1800, protein: 60, carbs: 150, fat: 90 }, T), 'steel');
  assert.equal(dayMaterial({ kcal: 1800, protein: 40, carbs: 225, fat: 90 }, T), 'brick');
  assert.equal(dayMaterial({ kcal: 1800, protein: 40, carbs: 150, fat: 60 }, T), 'glass');
});

test('off days add nothing, and excess never earns a floor', () => {
  assert.equal(dayMaterial({ kcal: 1000, protein: 60, carbs: 225, fat: 60 }, T), null);
  assert.equal(dayMaterial({ kcal: 2600, protein: 200, carbs: 225, fat: 60 }, T), null);
});

test('only finished days count and missed days do not shrink the tower', () => {
  const entries = [day('2026-10-01', 1800, 60, 225, 60), day('2026-10-02', 500, 10, 10, 10), day('2026-10-03', 1800, 60, 150, 90), day('2026-10-04', 1800, 60, 225, 60)];
  const m = towerModel(entries, T, '2026-10-04');
  assert.deepEqual(m.floors, ['gold', 'steel']);
  assert.equal(m.count, 2);
  assert.ok(towerSvg(m).includes('<svg'));
});

test('milestones unlock by floor count', () => {
  const entries = Array.from({ length: 60 }, (_, i) => day(`2026-09-${String(i + 1).padStart(2, '0')}`.replace('2026-09-3', '2026-10-0').replace(/^2026-09-(\d{2})$/, (_, d) => (+d > 30 ? `2026-10-${String(d - 30).padStart(2, '0')}` : `2026-09-${d}`)), 1800, 60, 225, 60));
  const m = towerModel(entries, T, '2026-12-31');
  assert.equal(m.count, 60);
  assert.deepEqual(m.built, ['lobby', 'garden', 'spire']);
  assert.equal(m.next.key, 'beacon');
});

test('empty history renders an empty lot', () => {
  const m = towerModel([], T, '2026-10-31');
  assert.equal(m.count, 0);
  assert.ok(towerSvg(m).includes('Empty lot'));
});
