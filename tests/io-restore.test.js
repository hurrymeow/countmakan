import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport, parseImport, localDay, EXPORT_VERSION } from '../js/io.js';

const item = { name: 'Rice', grams: 200, kcal: 260, protein: 5, carbs: 57, fat: 0.5, sugar: 0, fibre: 1, sodium: 2, confidence: 0.9 };
const entry = (over = {}) => ({ id: 'e1', ts: '2026-03-05T12:30:00.000Z', day: 'x', items: [item], provider: 'gemini', model: 'm', source: 'photo', text: 'lunch', thumb: 'data:image/jpeg;base64,AA', ...over });
const restore = (entries) => parseImport(JSON.stringify({ app: 'countmakan', version: 2, entries }));

test('export strips full photos but keeps thumbnails', () => {
  const out = buildExport([entry({ photo: new Blob(['x']) })], { kcal: 1800 });
  assert.equal(out.version, EXPORT_VERSION);
  assert.equal('photo' in out.entries[0], false);
  assert.equal(out.entries[0].thumb, 'data:image/jpeg;base64,AA');
});

test('restore keeps valid entries and drops malformed ones without failing the file', () => {
  const { entries } = restore([
    entry(),
    null,
    entry({ id: 5 }),
    entry({ id: 'no-ts', ts: undefined }),
    entry({ id: 'bad-ts', ts: 'not a date' }),
    entry({ id: 'e2' }),
  ]);
  assert.deepEqual(entries.map((e) => e.id), ['e1', 'e2']);
});

test('restore recomputes day from ts instead of trusting the file', () => {
  const { entries } = restore([entry({ day: '1999-01-01' })]);
  assert.equal(entries[0].day, localDay('2026-03-05T12:30:00.000Z'));
});

test('restore fills defaults for missing optional fields', () => {
  const { entries } = restore([{ id: 'min', ts: '2026-03-05T12:30:00Z' }]);
  assert.deepEqual(entries[0], {
    id: 'min',
    ts: '2026-03-05T12:30:00.000Z',
    day: localDay('2026-03-05T12:30:00Z'),
    items: [],
    provider: 'manual',
    model: '',
    source: 'text',
    text: '',
    thumb: '',
  });
});

test('restore rejects non-image thumbs and wrong-typed fields', () => {
  const { entries } = restore([entry({ thumb: 'javascript:alert(1)', provider: 7, text: {}, items: 'x' })]);
  assert.equal(entries[0].thumb, '');
  assert.equal(entries[0].provider, 'manual');
  assert.equal(entries[0].text, '');
  assert.deepEqual(entries[0].items, []);
});

test('restore drops non-object items and names blank ones', () => {
  const { entries } = restore([entry({ items: [item, null, 'junk', { name: '' }] })]);
  assert.equal(entries[0].items.length, 2);
  assert.equal(entries[0].items[1].name, 'Unknown item');
  assert.equal(entries[0].items[0].name, 'Rice');
});

test('restore ignores targets that are not an object', () => {
  assert.equal(parseImport(JSON.stringify({ app: 'countmakan', entries: [], targets: 'x' })).targets, null);
  assert.deepEqual(parseImport(JSON.stringify({ app: 'countmakan', entries: [], targets: { kcal: 1 } })).targets, { kcal: 1 });
});

test('full export then restore keeps every entry id', () => {
  const list = [entry({ id: 'a' }), entry({ id: 'b', ts: '2026-03-06T01:00:00Z' })];
  const { entries } = parseImport(JSON.stringify(buildExport(list, {})));
  assert.deepEqual(entries.map((e) => e.id), ['a', 'b']);
});
