// The editor: check, change, save or delete one meal.
import { totals, scaleItem, scaleBy, normalizeItem } from './schema.js';
import { saveFavs, favFromEntry, bumpFav } from './favs.js';
import { localDay } from './io.js';
import * as db from './db.js';
import * as health from './health.js';
import { $, el, fmt, uid, state, toast, macroLine, extraLine } from './ui.js';
import { renderHistory } from './history.js';
import { showTab, showStep, resetAdd, openPhoto, answerQuestion, renderFavs, renderToday, syncHealth, showSyncCard, onHealthSendCard } from './app.js';

// Portion buttons: share of the meal as first shown, short label, spoken label.
const PORTIONS = [[0.5, '½', 'Half'], [0.75, '¾', 'Three quarters'], [1, 'All', 'All of it'], [1.5, '1½', 'One and a half'], [2, '2×', 'Double']];
export const LOW_CONFIDENCE = 0.6;
const UNDO_MS = 8000;

export function draftSnap(d) {
  return JSON.stringify([d.items, d.ts]);
}

// Starts a new meal from a favourite or a past meal. No API call.
export function logAgain(src) {
  openEditor({
    id: uid(),
    ts: new Date().toISOString(),
    items: structuredClone(src.items),
    provider: src.provider || '',
    model: src.model || '',
    source: 'repeat',
    text: src.text || '',
    thumb: src.thumb || '',
    favId: state.favs.some((f) => f.id === src.id) ? src.id : src.favId,
    isNew: true,
  });
}

export function toggleFav() {
  const d = state.draft;
  const had = state.favs.some((f) => f.id === d.favId);
  const next = had ? state.favs.filter((f) => f.id !== d.favId) : [favFromEntry(d, d.favId || uid()), ...state.favs];
  try {
    state.favs = saveFavs(next);
  } catch {
    toast('The phone is full. Remove a favourite first.');
    return;
  }
  d.favId = had ? undefined : next[0].id;
  renderFavs();
  renderEditor();
  toast(had ? 'Removed from favourites.' : 'Saved as a favourite ★');
}

function toLocalInput(iso) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function openEditor(entry) {
  // base is the meal at "All". The portion buttons scale from it, so taps never compound.
  entry.portion = 1;
  entry.base = structuredClone(entry.items);
  state.draft = entry;
  state.draftSnap = draftSnap(entry);
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = entry.photo ? URL.createObjectURL(entry.photo) : '';
  showTab('today');
  renderEditor();
  showStep('editor');
}

export function closeEditor() {
  state.draft = null;
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = '';
  $('#editor').replaceChildren();
  resetAdd();
}

function field(id, label, value, onChange, cls = '') {
  return el('div', { class: cls },
    el('label', { for: id }, label),
    el('input', { id, type: 'number', inputmode: 'decimal', min: '0', step: 'any', value, onchange: (ev) => onChange(ev.target.value) }));
}

// Replacing a focused input fires blur, then change, which would re-enter here.
let rendering = false;
export function renderEditor() {
  if (rendering) return;
  rendering = true;
  try {
    drawEditor();
  } finally {
    rendering = false;
  }
}

function drawEditor() {
  const d = state.draft;
  const items = d.items.map((it, i) => {
    const update = (f) => (v) => {
      d.items[i] = f === 'grams' ? scaleItem(it, v) : normalizeItem({ ...it, [f]: v });
      d.base[i] = scaleBy(d.items[i], 1 / d.portion);
      renderEditor();
    };
    const id = (f) => `item-${i}-${f}`;
    return el('div', { class: 'item' },
      el('label', { for: id('name') }, 'Food'),
      el('input', { id: id('name'), value: it.name, onchange: (ev) => { d.items[i] = { ...d.items[i], name: ev.target.value }; d.base[i] = { ...d.base[i], name: ev.target.value }; } }),
      el('details', { class: 'item-note' },
        el('summary', {}, it.detail ? 'Note' : 'Add note'),
        el('input', { id: id('detail'), value: it.detail || '', 'aria-label': 'Note', placeholder: 'e.g. fried, with chilli', onchange: (ev) => {
          const detail = ev.target.value.trim();
          d.items[i] = { ...d.items[i], detail: detail || undefined };
          d.base[i] = { ...d.base[i], detail: detail || undefined };
        } })),
      it.confidence < LOW_CONFIDENCE ? el('span', { class: 'badge' }, 'Please check this') : null,
      el('div', { class: 'item-cals' },
        field(id('grams'), 'Grams', it.grams, update('grams')),
        field(id('kcal'), 'Calories', it.kcal, update('kcal'))),
      el('div', { class: 'item-macros' },
        field(id('protein'), 'Protein g', it.protein, update('protein'), 'm-protein'),
        field(id('carbs'), 'Carbs g', it.carbs, update('carbs'), 'm-carbs'),
        field(id('fat'), 'Fat g', it.fat, update('fat'), 'm-fat')),
      el('div', { class: 'item-macros' },
        field(id('sugar'), 'Sugar g', it.sugar, update('sugar')),
        field(id('fibre'), 'Fibre g', it.fibre, update('fibre')),
        field(id('sodium'), 'Sodium mg', it.sodium, update('sodium'))),
      el('button', { type: 'button', class: 'btn danger', 'aria-label': `Remove this food: ${it.name}`, onclick: () => { d.items.splice(i, 1); d.base.splice(i, 1); renderEditor(); } }, 'Remove this food'));
  });
  const t = totals(d.items);
  const isFav = state.favs.some((f) => f.id === d.favId);
  $('#editor').replaceChildren(...[
    el('h2', {}, d.isNew ? "Here's what we found" : 'Change this meal'),
    el('div', { class: 'editor-summary' },
      el('p', { class: 'total', id: 'editor-total' }, `Total: ${fmt(t.kcal)} calories`),
      el('p', { class: 'total-sub' }, macroLine(t)),
      el('p', { class: 'total-sub', id: 'editor-extra' }, extraLine(t)),
      el('div', { class: 'editor-actions' },
        el('button', { type: 'button', class: 'btn primary', id: 'save-meal', onclick: saveDraft }, d.isNew ? 'Save meal' : 'Save changes'),
        el('button', { type: 'button', class: 'btn', onclick: closeEditor }, d.isNew ? "Don't save" : 'Cancel'),
        items.length ? el('button', { type: 'button', class: 'btn fav-btn', id: 'fav-toggle', 'aria-pressed': String(isFav), 'aria-label': isFav ? 'Remove from favourites' : 'Save as a favourite', title: isFav ? 'Remove from favourites' : 'Save as a favourite', onclick: toggleFav }, isFav ? '★' : '☆') : null)),
    state.photoUrl || d.thumb
      ? el('button', { type: 'button', class: 'photo-zoom', 'aria-label': 'Show the full photo', onclick: () => openPhoto(state.photoUrl || d.thumb) },
        el('img', { class: 'editor-photo', src: state.photoUrl || d.thumb, alt: 'Your meal' }))
      : null,
    d.ask ? questionCard(d.ask) : null,
    el('p', { class: 'muted' }, 'If a portion looks wrong, change the grams. The other numbers update by themselves.'),
    items.length ? items : el('p', { class: 'empty' }, 'No food in this meal. Add one below.'),
    el('button', { type: 'button', class: 'btn', onclick: () => { const it = normalizeItem({ name: 'Food', confidence: 1 }); d.items.push(it); d.base.push(scaleBy(it, 1 / d.portion)); renderEditor(); } }, '+ Add another food'),
    items.length ? portionRow(d) : null,
    el('label', { for: 'entry-time' }, 'Time eaten'),
    el('input', { id: 'entry-time', type: 'datetime-local', value: toLocalInput(d.ts), onchange: (ev) => { if (ev.target.value) d.ts = new Date(ev.target.value).toISOString(); } }),
    d.isNew ? null : el('button', { type: 'button', class: 'btn', id: 'eat-again', onclick: () => logAgain(d) }, 'I ate this again'),
    d.isNew ? null : el('button', { type: 'button', class: 'btn danger', onclick: deleteDraft }, 'Delete this meal'),
    d.scan ? el('p', { class: 'muted scan-details', id: 'scan-details' }, `Scan: ${d.scan}`) : null,
  ].flat().filter(Boolean));
}

function portionRow(d) {
  return el('div', { class: 'portion' },
    el('p', { class: 'portion-label', id: 'portion-label' }, d.isNew ? 'How much did you eat?' : 'Change the amount'),
    el('div', { class: 'portion-btns', role: 'group', 'aria-labelledby': 'portion-label' },
      PORTIONS.map(([p, label, spoken]) => el('button', {
        type: 'button',
        class: 'btn',
        'aria-pressed': String(d.portion === p),
        'aria-label': spoken,
        onclick: () => {
          d.portion = p;
          d.items = d.base.map((it) => scaleBy(it, p));
          renderEditor();
        },
      }, label))));
}

function questionCard(ask) {
  const other = el('input', { id: 'ask-other', placeholder: 'Or type your answer', enterkeyhint: 'send' });
  other.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') answerQuestion(other.value); });
  return el('div', { class: 'ask', id: 'ask' },
    el('p', { class: 'ask-title' }, 'One quick question'),
    el('p', { class: 'ask-q' }, ask.question),
    el('div', { class: 'ask-choices' }, ask.choices.map((c) => el('button', { type: 'button', class: 'btn', onclick: () => answerQuestion(c) }, c))),
    el('label', { for: 'ask-other' }, 'Something else?'),
    other,
    el('button', { type: 'button', class: 'btn', onclick: () => answerQuestion(other.value) }, 'Send answer'),
    el('p', { class: 'muted' }, 'Not sure? Skip this and save.'));
}

async function saveDraft() {
  const d = state.draft;
  const sends = health.isOn() && (d.isNew || state.entries.find((x) => x.id === d.id)?.gh);
  // Ask for a fresh token now, while the Save tap still allows the popup.
  const token = sends && !health.validToken() ? health.getToken().catch(() => null) : null;
  // Commit an edit that is still focused, so its change event runs first.
  document.activeElement?.blur?.();
  const { isNew, ...entry } = state.draft;
  // Editor-only state. Not saved.
  for (const k of ['ask', 'base', 'portion']) delete entry[k];
  entry.day = localDay(entry.ts);
  entry.updatedAt = new Date().toISOString();
  const prev = state.entries.find((x) => x.id === entry.id);
  if (isNew ? health.isOn() : prev?.gh) {
    // Custom food logs can't be edited, so an edit replaces the old log.
    if (prev?.gh?.name) health.queueDelete(prev.gh.name, { ripeNow: true });
    entry.gh = { state: 'pending' };
  }
  await db.putEntry(entry);
  state.entries = await db.allEntries();
  if (isNew && state.favs[0]?.id !== entry.favId && state.favs.some((f) => f.id === entry.favId)) {
    try {
      state.favs = saveFavs(bumpFav(state.favs, entry.favId));
      renderFavs();
    } catch { /* Order is a nicety. Keep the old one if storage is full. */ }
  }
  closeEditor();
  renderToday();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(isNew ? 'Meal saved ✓' : 'Changes saved ✓');
  await token;
  await syncHealth();
  // Background sends can't open the sign-in popup, so ask for a tap.
  if (showSyncCard()) {
    toast(`${isNew ? 'Meal saved' : 'Changes saved'}. Not in Google Health yet.`, {
      action: 'Send', ms: 10000, onAction: onHealthSendCard,
    });
  }
}

async function deleteDraft() {
  const id = state.draft.id;
  const saved = state.entries.find((e) => e.id === id);
  if (saved?.gh?.name) {
    health.queueDelete(saved.gh.name);
    setTimeout(syncHealth, health.DELETE_DELAY_MS + 500);
  }
  await db.deleteEntry(id);
  state.entries = await db.allEntries();
  closeEditor();
  renderToday();
  toast('Meal deleted.', {
    action: 'Undo',
    ms: UNDO_MS,
    onAction: async () => {
      // If the remote delete already went out, send the meal again.
      const name = saved.gh?.name;
      await db.putEntry(name && !health.unqueueDelete(name) ? { ...saved, gh: { state: 'pending' } } : saved);
      state.entries = await db.allEntries();
      renderToday();
      if (!$('#tab-history').hidden) renderHistory();
      toast('Meal is back ✓');
      syncHealth();
    },
  });
}
