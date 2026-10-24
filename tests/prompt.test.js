import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_PROMPT, userText } from '../js/prompt.js';

test('photo with no notes asks for an estimate', () => {
  assert.equal(userText({ image: {}, text: '  ' }), 'Photo of a meal. Estimate it.');
});

test('photo with notes passes the notes through', () => {
  assert.equal(userText({ image: {}, text: ' no sugar ' }), 'Photo of a meal. Notes from the eater: no sugar');
});

test('text only is a meal description', () => {
  assert.equal(userText({ text: 'nasi lemak' }), 'Meal description: nasi lemak');
  assert.equal(userText({}), 'Meal description: ');
});

test('follow-up answers are appended in order', () => {
  const out = userText({ text: 'laksa', answers: [{ q: 'How much?', a: 'Half' }, { q: 'Sugar?', a: 'No' }] });
  assert.deepEqual(out.split('\n').slice(1), [
    'You asked: "How much?" The eater answered: "Half"',
    'You asked: "Sugar?" The eater answered: "No"',
  ]);
});

test('confirmed favourites are listed as references; empty list adds nothing', () => {
  const out = userText({ text: 'rice', refs: [{ name: 'Rice', grams: 200, kcal: 260 }] });
  assert.ok(out.endsWith('Portions this eater has confirmed before:\n- Rice: 200 g, 260 kcal'));
  assert.equal(userText({ text: 'rice', refs: [] }), 'Meal description: rice');
});

test('system prompt names every nutrient field the schema requires', () => {
  for (const k of ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'sugar', 'fibre', 'sodium', 'confidence', 'question', 'choices']) {
    assert.ok(SYSTEM_PROMPT.includes(`"${k}"`), k);
  }
});
