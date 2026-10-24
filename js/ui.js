// Shared by every view: app state, DOM helpers and the toast.
import { DEFAULT_TARGETS } from './config.js';
import { PROVIDERS } from './keys.js';

export const $ = (sel) => document.querySelector(sel);

export const state = {
  keys: {},
  targets: { ...DEFAULT_TARGETS },
  entries: [],
  photo: null, // { mime, base64, bytes, keep, thumb }
  order: [], // saved provider order, as step ids. Empty means the default CHAIN order.
  photoUrl: '', // object URL for the open entry's full photo
  draft: null, // entry being edited
  draftSnap: '', // draft as opened, to tell if anything changed
  step: 'add',
  favs: [],
  answers: [], // [{ q, a }] for the follow-up question
  abort: null, // AbortController for the running estimate
  health: { waiting: 0, needsSignIn: false, error: '' },
  healthRange: 7, // Days for "Send past meals". Null means all.
  healthBusy: false,
};

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : String(k));
  return n;
}

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en');
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const MACRO_KEYS = ['protein', 'carbs', 'fat'];
export const MACRO_NAMES = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };
export const dot = (m) => el('span', { class: `dot ${m}`, 'aria-hidden': 'true' });
// "● Protein 12 g · ● Carbs 30 g · ● Fat 8 g", each macro in its own colour.
export const macroLine = (t) => MACRO_KEYS.flatMap((m, i) => [i ? ' · ' : '', el('span', { class: 'nowrap' }, dot(m), `${MACRO_NAMES[m]} ${fmt(t[m])} g`)]);
export const extraLine = (t) => `Sugar ${fmt(t.sugar)} g · Fibre ${fmt(t.fibre)} g · Sodium ${fmt(t.sodium)} mg`;
export const hasKeys = () => PROVIDERS.some((p) => state.keys[p]);

export function setStatus(node, msg, isError = false) {
  node.textContent = msg;
  node.classList.toggle('error', isError);
}

// ---------- Toast ----------
let toastTimer;
export function toast(text, { action, onAction, ms = 4000 } = {}) {
  clearTimeout(toastTimer);
  $('#toast-text').textContent = text;
  const btn = $('#toast-action');
  btn.hidden = !action;
  btn.textContent = action || '';
  btn.onclick = action
    ? () => {
      hideToast();
      onAction();
    }
    : null;
  // An open sheet sits in the top layer, so the toast moves inside it to stay visible.
  const host = $('#sheet').open ? $('#sheet') : document.body;
  if ($('#toast').parentNode !== host) host.append($('#toast'));
  $('#toast').hidden = false;
  toastTimer = setTimeout(hideToast, ms);
}

export function hideToast() {
  clearTimeout(toastTimer);
  $('#toast').hidden = true;
}
