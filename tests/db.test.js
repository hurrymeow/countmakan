import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal in-memory IndexedDB: enough for open, one store, and put/get/delete/getAll.
function fakeIndexedDB() {
  const rows = new Map();
  const created = [];
  const store = {
    put: (v) => { rows.set(v.id, structuredClone(v)); return { result: v.id }; },
    get: (id) => ({ result: rows.has(id) ? structuredClone(rows.get(id)) : undefined }),
    delete: (id) => { rows.delete(id); return { result: undefined }; },
    getAll: () => ({ result: [...rows.values()].map((v) => structuredClone(v)) }),
    createIndex: (name) => created.push(`index:${name}`),
  };
  const db = {
    createObjectStore: (name, opts) => { created.push(`store:${name}:${opts.keyPath}`); return store; },
    transaction: () => {
      const t = { objectStore: () => store };
      queueMicrotask(() => setTimeout(() => t.oncomplete?.()));
      return t;
    },
  };
  let opens = 0;
  const indexedDB = {
    open: () => {
      opens++;
      const req = { result: db };
      setTimeout(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
      return req;
    },
  };
  return { indexedDB, created, opens: () => opens };
}

const fake = fakeIndexedDB();
globalThis.indexedDB = fake.indexedDB;
const { getEntry, putEntry, deleteEntry, putMany, allEntries } = await import('../js/db.js');

test('creates the entries store with day and ts indexes, and opens once', async () => {
  await putEntry({ id: 'a', ts: '2026-01-01T00:00:00Z', day: '2026-01-01' });
  await getEntry('a');
  assert.deepEqual(fake.created, ['store:entries:id', 'index:day', 'index:ts']);
  assert.equal(fake.opens(), 1);
});

test('putEntry then getEntry round-trips, and a missing id is undefined', async () => {
  const e = { id: 'b', ts: '2026-01-02T00:00:00Z', day: '2026-01-02', items: [{ name: 'Rice' }] };
  await putEntry(e);
  assert.deepEqual(await getEntry('b'), e);
  assert.equal(await getEntry('nope'), undefined);
});

test('putEntry overwrites an entry with the same id', async () => {
  await putEntry({ id: 'c', ts: '2026-01-03T00:00:00Z', text: 'old' });
  await putEntry({ id: 'c', ts: '2026-01-03T00:00:00Z', text: 'new' });
  assert.equal((await getEntry('c')).text, 'new');
});

test('deleteEntry removes the entry', async () => {
  await putEntry({ id: 'd', ts: '2026-01-04T00:00:00Z' });
  await deleteEntry('d');
  assert.equal(await getEntry('d'), undefined);
});

test('putMany stores every entry (backup restore path)', async () => {
  const list = [1, 2, 3].map((n) => ({ id: `m${n}`, ts: `2026-02-0${n}T00:00:00Z` }));
  await putMany(list);
  for (const e of list) assert.deepEqual(await getEntry(e.id), e);
});

test('allEntries returns newest first', async () => {
  const all = await allEntries();
  const ts = all.map((e) => e.ts);
  assert.deepEqual(ts, [...ts].sort().reverse());
  assert.ok(all.length >= 5);
});
