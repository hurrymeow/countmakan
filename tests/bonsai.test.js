import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bonsaiModel, bonsaiSvg, weekTiles } from '../js/bonsai.js';

const TARGETS = { kcal: 2000, protein: 60, carbs: 225, fat: 60, sugar: 50, fibre: 25, sodium: 2000 };
const day = (d, over = {}) => ({ day: d, items: [{ kcal: 2000, protein: 70, carbs: 200, fat: 50, sugar: 20, fibre: 10, sodium: 1500, ...over }] });
const TODAY = '2026-10-20';

test('every logged day adds a leaf, empty days add nothing', () => {
  const m = bonsaiModel([day('2026-10-10'), day('2026-10-12'), { day: '2026-10-13', items: [] }], TARGETS, TODAY);
  assert.equal(m.days, 2);
});

test('within 10% of goal is a full leaf, under or over is not', () => {
  const m = bonsaiModel([day('2026-10-10'), day('2026-10-11', { kcal: 2150 }), day('2026-10-12', { kcal: 1500 }), day('2026-10-13', { kcal: 2600 })], TARGETS, TODAY);
  assert.deepEqual(m.leaves.map((l) => l.full), [true, true, false, false]);
});

test('protein and fibre add a tint and a flower, only on days at least half way to goal', () => {
  const m = bonsaiModel([day('2026-10-10', { fibre: 30 }), day('2026-10-11', { kcal: 800, fibre: 30 })], TARGETS, TODAY);
  assert.equal(m.leaves[0].protein, true);
  assert.equal(m.leaves[0].flower, true);
  assert.equal(m.leaves[1].protein, false);
  assert.equal(m.leaves[1].flower, false);
});

test('a sodium-over leaf is brown until three on-target days follow', () => {
  const bad = day('2026-10-01', { sodium: 3000 });
  const good = (d) => day(`2026-10-${d}`);
  const two = bonsaiModel([bad, good('02'), good('03')], TARGETS, TODAY);
  assert.equal(two.leaves[0].brown, true);
  const three = bonsaiModel([bad, good('02'), good('03'), good('04')], TARGETS, TODAY);
  assert.equal(three.leaves[0].brown, false);
  assert.equal(three.leaves[0].fallen, true);
});

test('today only earns a plain leaf, so mid-day totals cannot flicker', () => {
  const m = bonsaiModel([day(TODAY, { sodium: 9000 })], TARGETS, TODAY);
  assert.deepEqual(m.leaves[0], { day: TODAY, full: false, protein: false, flower: false, brown: false });
});

test('a missed day changes nothing about earlier leaves', () => {
  const a = bonsaiModel([day('2026-10-10'), day('2026-10-11')], TARGETS, '2026-10-12');
  const b = bonsaiModel([day('2026-10-10'), day('2026-10-11')], TARGETS, '2026-10-19');
  assert.deepEqual(a, b);
});

test('svg is stable between renders and grows with logging', () => {
  const m = bonsaiModel([day('2026-10-10'), day('2026-10-11')], TARGETS, TODAY);
  assert.equal(bonsaiSvg(m), bonsaiSvg(m));
  const more = bonsaiModel([day('2026-10-10'), day('2026-10-11'), day('2026-10-12')], TARGETS, TODAY);
  const count = (s) => (s.match(/<use href="#leaf/g) || []).length;
  assert.equal(count(bonsaiSvg(m)), 2);
  assert.equal(count(bonsaiSvg(more)), 3);
});

test('empty history still draws a pot', () => {
  const svg = bonsaiSvg(bonsaiModel([], TARGETS, TODAY));
  assert.match(svg, /href="#pot"/);
  assert.match(svg, /Log a meal/);
});

test('week tiles tick on-target days and never tick today', () => {
  const tiles = weekTiles([day('2026-10-19'), day(TODAY)], TARGETS, TODAY);
  assert.equal(tiles.length, 7);
  assert.equal(tiles[5].onTarget, true);
  assert.equal(tiles[6].logged, true);
  assert.equal(tiles[6].onTarget, false);
  assert.equal(tiles[6].today, true);
});
