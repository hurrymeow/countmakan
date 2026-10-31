import test from 'node:test';
import assert from 'node:assert/strict';
import { hawkerModel, hawkerSvg, LEVEL_AT } from '../js/hawker.js';

const meal = (day, name) => ({ day, items: [{ name, kcal: 400 }] });
const many = (n, name, day = '2026-10-01') => Array.from({ length: n }, () => meal(day, name));

test('empty history gives empty lots in the first era', () => {
  const m = hawkerModel([]);
  assert.equal(m.era, 1);
  assert.deepEqual(m.stalls.map((s) => s.level), [0, 0, 0, 0]);
  assert.ok(hawkerSvg(m).includes('<svg'));
});

test('stalls level up by how often their kind is logged', () => {
  for (const [i, at] of LEVEL_AT.entries()) {
    assert.equal(hawkerModel(many(at, 'Nasi lemak')).stalls[0].level, i + 1);
    assert.equal(hawkerModel(many(at - 1, 'Nasi lemak')).stalls[0].level, i);
  }
});

test('other food kinds do not feed the four stalls', () => {
  assert.deepEqual(hawkerModel(many(3, 'Apple')).stalls.map((s) => s.count), [0, 0, 0, 0]);
});

test('the centre grows with logged days, not meals', () => {
  assert.equal(hawkerModel(many(30, 'Nasi lemak')).era, 1);
  const days = Array.from({ length: 14 }, (_, i) => meal(`2026-10-${String(i + 1).padStart(2, '0')}`, 'Laksa'));
  assert.equal(hawkerModel(days).era, 2);
});

test('variety bonus needs every stall at stall level', () => {
  const some = [...many(5, 'Nasi lemak'), ...many(5, 'Laksa'), ...many(5, 'Kopi')];
  assert.equal(hawkerModel(some).balanced, false);
  assert.equal(hawkerModel([...some, ...many(5, 'Chendol')]).balanced, true);
});

test('adding meals never lowers a level', () => {
  const a = hawkerModel(many(6, 'Nasi lemak'));
  const b = hawkerModel([...many(6, 'Nasi lemak'), ...many(10, 'Laksa')]);
  assert.ok(b.stalls[0].level >= a.stalls[0].level);
});
