import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Fake browser: a decoded image of the given size, and canvases that record their size and encode calls.
let canvases;
function setup(width, height) {
  canvases = [];
  globalThis.window = { createImageBitmap: true };
  globalThis.createImageBitmap = async () => ({ width, height, close() { this.closed = true; } });
  globalThis.document = {
    createElement: () => {
      const c = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage() {} }),
        toDataURL: (type, q) => { c.dataUrl = { type, q }; return 'data:image/jpeg;base64,THUMB'; },
        toBlob: (cb, type, q) => { c.blob = { type, q }; cb(fakeBlob(type, 1000)); },
      };
      canvases.push(c);
      return c;
    },
  };
  globalThis.FileReader = class {
    readAsDataURL(blob) { this.result = `data:${blob.type};base64,B64-${blob.size}`; queueMicrotask(() => this.onload()); }
  };
}
const fakeBlob = (type, size) => ({ type, size });
const { prepareImage } = await import('../js/image.js');

const THUMB = 160;
const KEEP = 1600;
const MODEL = 1024;
const Q = 0.8;

beforeEach(() => setup(800, 600));

test('small native photo is sent and kept as is', async () => {
  const file = fakeBlob('image/jpeg', 200_000);
  const out = await prepareImage(file, THUMB, KEEP, MODEL, Q);
  assert.equal(out.keep, file);
  assert.equal(out.mime, 'image/jpeg');
  assert.equal(out.bytes, 200_000);
  assert.equal(out.base64, 'B64-200000');
  assert.equal(out.thumb, 'data:image/jpeg;base64,THUMB');
});

test('large photo is resized for the model and the diary, never upscaled', async () => {
  setup(4000, 3000);
  const file = fakeBlob('image/jpeg', 5_000_000);
  const out = await prepareImage(file, THUMB, KEEP, MODEL, Q);
  const sizes = canvases.map((c) => [c.width, c.height]);
  assert.deepEqual(sizes[0], [160, 120]); // thumb
  assert.deepEqual(sizes[1], [1024, 768]); // model
  assert.deepEqual(sizes[2], [1600, 1200]); // keep
  assert.equal(canvases[1].blob.q, Q);
  assert.equal(canvases[2].blob.q, 0.9);
  assert.notEqual(out.keep, file);
  assert.equal(out.mime, 'image/jpeg');
});

test('photo between model and keep size: model copy resized, original kept', async () => {
  setup(1400, 1000);
  const file = fakeBlob('image/png', 900_000);
  const out = await prepareImage(file, THUMB, KEEP, MODEL, Q);
  assert.deepEqual([canvases[1].width, canvases[1].height], [1024, 731]);
  assert.equal(out.keep, file);
});

test('file over 12 MB is re-encoded even when small in pixels', async () => {
  const file = fakeBlob('image/jpeg', 13 * 1024 * 1024);
  const out = await prepareImage(file, THUMB, KEEP, MODEL, Q);
  assert.notEqual(out.keep, file);
  assert.equal(out.bytes, 1000);
  assert.deepEqual([canvases[2].width, canvases[2].height], [800, 600]);
});

test('non-native format (HEIC) becomes JPEG for both model and diary', async () => {
  const file = fakeBlob('image/heic', 300_000);
  const out = await prepareImage(file, THUMB, KEEP, MODEL, Q);
  assert.equal(out.mime, 'image/jpeg');
  assert.equal(out.keep.type, 'image/jpeg');
  assert.equal(canvases[2].blob.q, 0.92);
});

test('encode failure rejects and still releases the bitmap', async () => {
  setup(4000, 3000);
  let bitmap;
  globalThis.createImageBitmap = async () => (bitmap = { width: 4000, height: 3000, close() { this.closed = true; } });
  const orig = globalThis.document.createElement;
  globalThis.document.createElement = () => {
    const c = orig();
    c.toBlob = (cb) => cb(null);
    return c;
  };
  await assert.rejects(prepareImage(fakeBlob('image/jpeg', 1), THUMB, KEEP, MODEL, Q), /Could not encode photo/);
  assert.equal(bitmap.closed, true);
});

test('falls back to <img> decoding when createImageBitmap throws', async () => {
  globalThis.createImageBitmap = async () => { throw new Error('unsupported'); };
  globalThis.URL.createObjectURL = () => 'blob:x';
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.Image = class { async decode() { this.width = 800; this.height = 600; } };
  const out = await prepareImage(fakeBlob('image/jpeg', 100), THUMB, KEEP, MODEL, Q);
  assert.equal(out.bytes, 100);
});
