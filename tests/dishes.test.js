import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISHES, dishLines } from '../js/dishes.js';
import { SYSTEM_PROMPT } from '../js/prompt.js';

test('the table holds all 45 dishes from the paper, once each', () => {
  assert.equal(DISHES.length, 45);
  assert.equal(new Set(DISHES.map((d) => d.name.toLowerCase())).size, 45);
  assert.equal(new Set(DISHES.map((d) => d.paper)).size, 45);
});

// Spot checks against Tables 4-6 of the paper, where those rows agree with Tables 1-3.
test('per-plate values match the paper', () => {
  const by = Object.fromEntries(DISHES.map((d) => [d.paper, d]));
  assert.deepEqual(
    (({ grams, kcal, protein, fat, carbs, sodium }) => ({ grams, kcal, protein, fat, carbs, sodium }))(by['Nasi Lemak']),
    { grams: 395, kcal: 741, protein: 36, fat: 36, carbs: 70, sodium: 459 },
  );
  assert.equal(by['Laska'].kcal, 881);
  assert.equal(by['Roti Prata'].kcal, 511);
  assert.equal(by['Mee Siam'].kcal, 798);
});

test('every dish has sane numbers', () => {
  for (const d of DISHES) {
    assert.ok(d.grams > 100 && d.grams < 800, d.name);
    assert.ok(d.kcal > 250 && d.kcal < 1200, d.name);
    // Atwater check: macros should explain the measured energy within 25%.
    const atwater = d.protein * 4 + d.carbs * 4 + d.fat * 9;
    assert.ok(Math.abs(atwater - d.kcal) / d.kcal < 0.25, `${d.name}: ${atwater} vs ${d.kcal}`);
  }
});

test('the system prompt lists every dish', () => {
  for (const line of dishLines()) assert.ok(SYSTEM_PROMPT.includes(line));
  assert.match(SYSTEM_PROMPT, /confirmed beats this table/);
});
