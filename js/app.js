import { CHAIN, DEFAULT_TARGETS, THUMB_MAX_PX, KEEP_MAX_PX, MODEL_MAX_PX, MODEL_JPEG_QUALITY, PROVIDER_LABELS, OPTIONAL_PROVIDERS } from './config.js';
import { estimate, testKey, applyOrder, stepId } from './chain.js';
import { totals } from './schema.js';
import { loadFavs, saveFavs, favRefs, mergeFavs, favKcal } from './favs.js';
import { parseSetupFragment, buildSetupLink, loadKeys, saveKeys, maskKey, PROVIDERS } from './keys.js';
import { buildExport, parseImport, localDay } from './io.js';
import { prepareImage } from './image.js';
import { describeFailure, scanSummary, MSG } from './messages.js';
import * as db from './db.js';
import * as health from './health.js';
import { ringSvg, macroSplit, dailyAverage, isOver, onTarget } from './charts.js';
import { suggestTargets, goalHint, ACTIVITY, GOAL_CHOICES } from './suggest.js';
import { $, el, fmt, uid, MACRO_KEYS, MACRO_NAMES, dot, hasKeys, state, setStatus, toast } from './ui.js';
import { LOW_CONFIDENCE, draftSnap, openEditor, closeEditor, logAgain } from './editor.js';
import { entryRow, renderHistory } from './history.js';

const GOALS = ['kcal', 'protein', 'carbs', 'fat', 'sugar', 'fibre', 'sodium'];
const GOAL_LABELS = {
  kcal: 'Calories', protein: 'Protein (g)', carbs: 'Carbs (g)', fat: 'Fat (g)',
  sugar: 'Sugar limit (g)', fibre: 'Fibre (g)', sodium: 'Sodium limit (mg)',
};
const SLOW_MS = 30000;

const ORDER_KEY = 'countmakan.order';
const chain = () => applyOrder(CHAIN, state.order);

function loadOrder() {
  try {
    const ids = JSON.parse(localStorage.getItem(ORDER_KEY));
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function saveOrder(ids) {
  state.order = ids;
  try {
    if (ids.length) localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    else localStorage.removeItem(ORDER_KEY);
  } catch {
    // Storage blocked. The order still holds until the app closes.
  }
}

function loadTargets() {
  try {
    return { ...DEFAULT_TARGETS, ...JSON.parse(localStorage.getItem('countmakan.targets')) };
  } catch {
    return { ...DEFAULT_TARGETS };
  }
}

// ---------- Setup link ----------
function consumeSetupLink() {
  const keys = parseSetupFragment(location.hash);
  if (!keys) return false;
  state.keys = saveKeys({ ...loadKeys(), ...keys });
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

// ---------- Tabs ----------
export function showTab(name) {
  for (const b of document.querySelectorAll('nav button')) {
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== `tab-${name}`;
  if (name === 'history') renderHistory();
  if (name === 'settings') renderSettings();
}

// ---------- Today: which step is showing ----------
// One step at a time: add, compose, loading, failure or editor.
const SHEET_STEPS = { compose: 'Add a meal', failure: 'Something went wrong', editor: 'Check your meal' };
export function showStep(step) {
  state.step = step;
  for (const id of ['add', 'compose', 'loading', 'failure', 'editor']) $(`#${id}`).hidden = id !== step;
  showSheet(SHEET_STEPS[step]);
  $('#favs').hidden = step !== 'add' || !hasKeys() || !state.favs.length;
  // While waiting, the rest of the app can't be tapped or reached by keyboard.
  const busy = step === 'loading';
  document.body.classList.toggle('is-busy', busy);
  for (const n of [$('header.top'), $('main')]) n.inert = busy;
  if (step === 'add') $('#add').hidden = !hasKeys();
  // Summary and meal list only on the home step, so each step has one job.
  // Before setup, an empty dashboard only adds noise. Restored meals still show.
  const home = step === 'add' && (hasKeys() || state.entries.length > 0);
  $('#summary').hidden = !home;
  $('#health-sync').hidden = !home || !showSyncCard();
  $('#meals').hidden = !home;
  $('#not-set-up').hidden = hasKeys();
  $('#welcome').hidden = !hasKeys() || state.entries.length > 0 || step !== 'add';
}

// ---------- Sheet: compose, failure and editor ----------
// Modal, so the tab bar can't be reached until the meal is saved or cancelled.
function showSheet(label) {
  const sheet = $('#sheet');
  if (!label) {
    if (sheet.open) sheet.close();
    document.body.append($('#toast'));
    return;
  }
  sheet.setAttribute('aria-label', label);
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}

function sheetDirty() {
  // Commit an edit that is still focused, so its change event runs first.
  document.activeElement?.blur?.();
  if (state.step === 'compose') return $('#meal-text').value.trim() !== '';
  if (state.step === 'editor') return state.draft.isNew || draftSnap(state.draft) !== state.draftSnap;
  return false;
}

// Back, Esc, a tap above the sheet or a swipe down. Asks first if work would be lost.
function dismissSheet() {
  const step = state.step;
  if (!SHEET_STEPS[step]) return;
  if (sheetDirty() && !confirm(step === 'editor' && state.draft.isNew ? "Don't save this meal?" : 'Discard your changes?')) {
    if (!$('#sheet').open) $('#sheet').showModal();
    return;
  }
  if (step === 'editor') closeEditor();
  else resetAdd();
}

export function openPhoto(src) {
  $('#photo-view-img').src = src;
  $('#photo-view').showModal();
}

// Any tap closes it. Back and Escape close it natively.
function initPhotoView() {
  const view = $('#photo-view');
  view.addEventListener('click', () => view.close());
  view.addEventListener('close', () => $('#photo-view-img').removeAttribute('src'));
}

function initSheet() {
  const sheet = $('#sheet');
  sheet.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    dismissSheet();
  });
  // Android may close it without a cancel event after repeated Back presses.
  sheet.addEventListener('close', () => { if (!sheet.open && SHEET_STEPS[state.step]) dismissSheet(); });
  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) dismissSheet(); });
  const grab = $('#sheet-grab');
  let startY = null;
  grab.addEventListener('pointerdown', (ev) => {
    startY = ev.clientY;
    grab.setPointerCapture(ev.pointerId);
  });
  grab.addEventListener('pointermove', (ev) => {
    if (startY !== null) sheet.style.translate = `0 ${Math.max(0, ev.clientY - startY)}px`;
  });
  const end = (ev) => {
    if (startY === null) return;
    const dy = ev.clientY - startY;
    startY = null;
    sheet.style.translate = '';
    if (ev.type === 'pointerup' && dy > 80) dismissSheet();
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
}

export function resetAdd() {
  state.photo = null;
  state.draft = null;
  state.answers = [];
  $('#preview-img').removeAttribute('src');
  $('#meal-text').value = '';
  $('#compose-error').textContent = '';
  showStep('add');
}

// ---------- Summary ----------
// Protein is a floor, so reaching it is a win rather than over.
function bar(m, value, target) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const reached = target && value >= target;
  const tag = !reached ? null
    : m === 'protein' ? el('span', { class: 'hit-tag' }, ' · ✓ hit')
      : value > target ? el('span', { class: 'over-tag' }, ' · over') : null;
  return el('div', {},
    el('div', { class: 'bar-label' },
      el('span', {}, dot(m), MACRO_NAMES[m]),
      el('span', {}, `${fmt(value)} g of ${fmt(target)} g`, tag)),
    el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { class: m, style: `width:${pct}%` })));
}

// Sugar, fibre and sodium. Neutral, so the macro colours stay unique.
// isMin marks a goal to reach (fibre), so going past it is not shown as over.
function limitBar(label, value, target, unit, isMin = false) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = !isMin && target && value > target;
  return el('div', {},
    el('div', { class: 'bar-label' },
      el('span', {}, label),
      el('span', {}, `${fmt(value)} ${unit} of ${fmt(target)} ${unit}`, over ? el('span', { class: 'over-tag' }, ' · over') : null)),
    el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: `width:${pct}%` })));
}

// On target gets a tick and green, so a planned bigger day still feels like a win.
function statusPill(text, tone) {
  const pill = el('div', { class: `hero-status${tone ? ` ${tone}` : ''}` }, text);
  if (tone === 'good') pill.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>');
  return pill;
}

function renderSummary() {
  const today = localDay(new Date());
  const t = totals(state.entries.filter((e) => e.day === today).flatMap((e) => e.items));
  const goal = state.targets.kcal;
  const over = isOver(t.kcal, goal);
  const status = over ? 'Over goal' : onTarget(t.kcal, goal) ? 'On target' : 'Under goal';
  // Fewer than 3 logged days is too few to average.
  const avg = dailyAverage(state.entries, today);
  const ring = el('div', { class: 'ring-wrap' },
    el('div', { class: 'ring-center' },
      el('div', { class: `big-num${over ? ' over' : ''}` }, fmt(t.kcal)),
      el('div', { class: 'ring-unit' }, 'calories')));
  ring.insertAdjacentHTML('afterbegin', ringSvg(t.kcal, goal, macroSplit(t)));
  $('#summary').replaceChildren(...[
    el('div', { class: 'muted' }, new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })),
    el('div', { class: 'hero' }, ring,
      el('div', { class: 'hero-text' },
        t.kcal > 0 ? statusPill(status, over ? 'over' : status === 'On target' ? 'good' : '') : null,
        el('div', { class: 'stat-label' }, status === 'On target' ? `±10% of ${fmt(goal)} goal` : `Goal ${fmt(goal)}`),
        avg?.days >= 3 ? el('div', { class: 'stat-label' }, `${avg.days}-day avg ${fmt(avg.kcal)}`) : null)),
    el('div', { class: 'bars' }, MACRO_KEYS.map((m) => bar(m, t[m], state.targets[m]))),
    el('div', { class: 'bars' },
      limitBar('Sugar', t.sugar, state.targets.sugar, 'g'),
      limitBar('Fibre', t.fibre, state.targets.fibre, 'g', true),
      limitBar('Sodium', t.sodium, state.targets.sodium, 'mg')),
  ].filter(Boolean));
}

// ---------- Meal lists ----------
export function renderToday() {
  const today = localDay(new Date());
  const list = state.entries.filter((e) => e.day === today);
  $('#today-list').replaceChildren(...(list.length ? list.map(entryRow) : [el('li', { class: 'empty' }, 'No meals yet today. Your first one will show up here.')]));
  renderFavs();
  renderSummary();
  if (!$('#add').hidden || !$('#welcome').hidden || !$('#not-set-up').hidden) showStep('add');
}

// ---------- Favourites ----------
function favRow(f) {
  const kcal = favKcal(f);
  const more = f.items.length - 1;
  return el('li', {},
    el('button', { type: 'button', class: 'chip', 'aria-label': `${f.name}, ${fmt(kcal)} calories. Tap to add it again.`, onclick: () => logAgain(f) },
      el('span', { class: 'name' }, more ? `${f.items[0].name} +${more}` : f.items[0].name),
      el('span', { class: 'cal' }, fmt(kcal))));
}

export function renderFavs() {
  $('#fav-list').replaceChildren(...state.favs.map(favRow));
}

// ---------- Add a meal ----------
async function onPhoto(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  try {
    state.photo = await prepareImage(file, THUMB_MAX_PX, KEEP_MAX_PX, MODEL_MAX_PX, MODEL_JPEG_QUALITY);
  } catch {
    showStep(state.photo ? 'compose' : 'add');
    toast(MSG.photo);
    return;
  }
  $('#preview-img').src = `data:${state.photo.mime};base64,${state.photo.base64}`;
  openCompose(true);
}

function openCompose(withPhoto) {
  if (!withPhoto) {
    state.photo = null;
    $('#preview-img').removeAttribute('src');
  }
  $('#compose-title').textContent = withPhoto ? 'Is this the right photo?' : 'What did you eat?';
  $('#preview-img').hidden = !withPhoto;
  $('#choose-another').hidden = !withPhoto;
  $('#meal-text-label').textContent = withPhoto ? 'Anything to add? (optional)' : 'Describe your food';
  $('#meal-text').placeholder = withPhoto ? 'For example: half a plate of rice' : 'For example: nasi goreng with a fried egg';
  $('#compose-error').textContent = '';
  showStep('compose');
  if (!withPhoto) $('#meal-text').focus();
}

function setLoading(text, hint) {
  $('#loading-text').textContent = text;
  $('#loading-hint').textContent = hint;
}

// Each step reflects a real event: request sent, waiting for the answer, answer shown.
function setStep(id, status, label) {
  const li = $(`#step-${id}`);
  li.className = status;
  if (label) li.querySelector('.label').textContent = label;
}

// Keeps the phone from locking mid-wait, which can pause the request.
async function keepAwake() {
  try {
    return await navigator.wakeLock?.request('screen');
  } catch {
    return null; // Not supported, or refused. The wait still works.
  }
}

// Count calories on the compose step starts fresh. Try again keeps any follow-up answer.
function onEstimate() {
  state.answers = [];
  runEstimate();
}

async function runEstimate() {
  const text = $('#meal-text').value.trim();
  if (!state.photo && !text) {
    showStep('compose');
    $('#compose-error').textContent = 'Please type what you ate.';
    return;
  }
  const photo = !!state.photo;
  const img = $('#loading-img');
  if (photo) img.src = `data:${state.photo.mime};base64,${state.photo.base64}`;
  else img.removeAttribute('src');
  $('#loading-photo').hidden = !photo;
  setLoading('Counting calories…', 'This usually takes under 30 seconds.');
  setStep('sent', 'now', photo ? 'Sending your photo' : 'Sending your description');
  setStep('look', 'todo', photo ? 'Looking at your food' : 'Reading your description');
  setStep('done', 'todo');
  $('#elapsed').textContent = '0';
  showStep('loading');
  $('#cancel-estimate').focus();

  const abort = new AbortController();
  state.abort = abort;
  const started = performance.now();
  const tick = setInterval(() => { $('#elapsed').textContent = String(Math.round((performance.now() - started) / 1000)); }, 1000);
  const slow = setTimeout(() => setLoading('Still working…', "Sorry for the wait. It's still going."), SLOW_MS);
  const lock = await keepAwake();
  try {
    const input = {
      text,
      image: photo ? { mime: state.photo.mime, base64: state.photo.base64 } : null,
      answers: state.answers,
      refs: favRefs(state.favs),
    };
    const out = await estimate(input, state.keys, {
      chain: chain(),
      signal: abort.signal,
      onAttempt: (_step, i) => {
        setStep('sent', 'done', photo ? 'Photo sent' : 'Description sent');
        setStep('look', 'now');
        if (i > 0) {
          setStep('look', 'now', 'Trying another way…');
          setLoading('Still working…', 'This can take up to a minute.');
        }
      },
    });
    const scan = scanSummary(out.attempts, { photoBytes: photo ? state.photo.bytes : 0, usage: out.usage });
    console.info(`Scan: ${scan}`);
    if (!out.items.length) {
      showFailure({ text: MSG.noFood, details: `${out.model}: returned no items\n${scan}` });
      return;
    }
    // One follow-up round at most, and only when something is uncertain.
    const unsure = out.items.some((i) => i.confidence < LOW_CONFIDENCE);
    const ask = out.question && unsure && !state.answers.length ? { question: out.question, choices: out.choices || [] } : null;
    openEditor({
      id: uid(),
      ts: state.draft?.isNew ? state.draft.ts : new Date().toISOString(),
      items: out.items,
      ask,
      provider: out.provider,
      model: out.model,
      usage: out.usage,
      ms: Math.round(performance.now() - started),
      scan,
      source: photo ? 'photo' : 'text',
      text,
      thumb: state.photo?.thumb || '',
      photo: state.photo?.keep || null,
      isNew: true,
    });
  } catch (e) {
    if (abort.signal.aborted) return; // Stop already moved the screen back.
    const failure = describeFailure(e, navigator.onLine);
    console.info(`Scan failed:\n${failure.details}`);
    showFailure(failure);
  } finally {
    clearTimeout(slow);
    clearInterval(tick);
    lock?.release().catch(() => {});
    if (state.abort === abort) state.abort = null;
  }
}

function cancelEstimate() {
  state.abort?.abort();
  state.abort = null;
  // Stopping a follow-up goes back to the first answer, which is still there.
  if (state.answers.length && state.draft) {
    state.answers = [];
    showStep('editor');
    return;
  }
  showStep('compose');
}

export function answerQuestion(a) {
  const answer = String(a || '').trim();
  if (!answer) return;
  state.answers = [{ q: state.draft.ask.question, a: answer }];
  runEstimate();
}

function showFailure({ text, details }) {
  $('#failure-text').textContent = text;
  $('#failure-details').textContent = details;
  $('#failure details').open = false;
  showStep('failure');
}

// ---------- Google Health ----------
export const showSyncCard = () => health.isOn() && state.health.needsSignIn && state.health.waiting > 0;
const changes = (n) => (n === 1 ? '1 meal is' : `${n} meals are`);
const meals = (n) => (n === 1 ? '1 meal' : `${n} meals`);
const RANGES = [[7, '7 days'], [30, '30 days'], [null, 'All']];

export async function syncHealth() {
  if (!health.isOn()) return;
  state.health = await health.sync({
    entries: state.entries,
    save: async (e) => {
      if (!(await db.getEntry(e.id))) return false;
      await db.putEntry(e);
      return true;
    },
    onProgress: (waiting) => {
      state.health = { ...state.health, waiting };
      renderHealth();
    },
  });
  state.entries = await db.allEntries();
  renderHealth();
}

function renderHealth() {
  const { waiting, error } = state.health;
  $('#health-sync-text').textContent = `${changes(waiting)} not in Google Health yet.`;
  $('#health-sync').hidden = $('#summary').hidden || !showSyncCard();
  const connected = health.isConnected();
  const on = health.isOn();
  const failed = state.entries.filter((e) => e.gh?.state === 'failed').length;
  const held = health.waitingCount(state.entries);
  const lines = !connected
    ? ['Send each new meal to the Google Health app.']
    : on
      ? [state.healthBusy && waiting ? `Sending. ${changes(waiting)} left.` : 'On. New meals also go to the Google Health app.',
        !state.healthBusy && waiting ? `${changes(waiting)} waiting to send.` : '',
        failed ? `${meals(failed)} could not be sent.` : '',
        error ? `Last try failed: ${error}` : '']
      : ['Off. New meals stay in this app only.',
        held ? `${held === 1 ? '1 change waits' : `${held} changes wait`} until you turn it back on.` : ''];
  $('#health-status').textContent = lines.filter(Boolean).join(' ');
  const row = $('#health-row-status');
  row.textContent = !connected ? 'Not connected' : !on ? 'Off' : waiting ? `${meals(waiting)} waiting` : 'On';
  row.classList.toggle('warn', connected && on && waiting > 0);
  $('#health-on-row').hidden = !connected;
  $('#health-on').checked = on;
  $('#health-signin').hidden = !showSyncCard() || state.healthBusy;
  $('#health-connect').hidden = connected;
  $('#health-disconnect').hidden = !connected;
  renderPastMeals(on);
}

function renderPastMeals(on) {
  const all = health.unsent(state.entries, null).length;
  $('#health-past').hidden = !on || (!all && !state.healthBusy);
  if ($('#health-past').hidden) return;
  const n = health.unsent(state.entries, state.healthRange).length;
  $('#health-range').replaceChildren(...RANGES.map(([days, label]) => el('button', {
    type: 'button',
    class: 'btn',
    'aria-pressed': String(state.healthRange === days),
    onclick: () => { state.healthRange = days; renderHealth(); },
  }, label)));
  const span = state.healthRange ? `in the last ${state.healthRange} days` : 'in total';
  $('#health-past-text').textContent = n ? `${meals(n)} ${span} not sent yet.` : `No unsent meals ${span}.`;
  const btn = $('#health-past-btn');
  btn.textContent = state.healthBusy ? 'Sending…' : n ? `Send ${meals(n)}` : 'Send past meals';
  btn.disabled = state.healthBusy || !n;
}

// Signs in only when the token has run out. A tap counts as the user gesture for the popup.
async function sendNow() {
  if (!health.validToken()) {
    try {
      await health.getToken();
    } catch (e) {
      toast(`Google Health: ${e.message}`);
      return false;
    }
  }
  await syncHealth();
  return true;
}

async function onHealthSignIn(okText) {
  try {
    await health.getToken();
  } catch (e) {
    toast(`Google Health: ${e.message}`);
    return;
  }
  await syncHealth();
  toast(state.health.error ? `Google Health: ${state.health.error}` : okText);
}

export async function onHealthSendCard() {
  if (!(await sendNow())) return;
  toast(state.health.error ? `Google Health: ${state.health.error}` : 'Sent to Google Health ✓');
}

async function onHealthToggle(ev) {
  const on = ev.target.checked;
  health.setPaused(!on);
  if (!on) {
    state.health = { waiting: 0, needsSignIn: false, error: '' };
    renderHealth();
    toast('Google Health sync is off.');
    return;
  }
  renderHealth();
  if (health.waitingCount(state.entries) && !(await sendNow())) return;
  toast(state.health.error ? `Google Health: ${state.health.error}` : 'Google Health sync is on ✓');
}

async function onSendPastMeals() {
  const list = health.unsent(state.entries, state.healthRange);
  if (!list.length || state.healthBusy) return;
  state.healthBusy = true;
  await db.putMany(list.map((e) => ({ ...e, gh: { state: 'pending' } })));
  state.entries = await db.allEntries();
  renderHealth();
  try {
    if (!(await sendNow())) return;
    // A sync already running holds the old list, so one more pass picks up the rest.
    if (state.health.waiting && !state.health.error && !state.health.needsSignIn) await syncHealth();
  } finally {
    state.healthBusy = false;
    renderHealth();
  }
  const { waiting, error } = state.health;
  const ids = new Set(list.map((e) => e.id));
  const sent = state.entries.filter((e) => ids.has(e.id) && e.gh?.state === 'done').length;
  const failed = state.entries.filter((e) => ids.has(e.id) && e.gh?.state === 'failed').length;
  if (error) toast(`Google Health: ${error}`);
  else if (waiting) toast(`${changes(waiting)} still waiting. Try again soon.`);
  else if (failed) toast(`Sent ${meals(sent)}. ${meals(failed)} could not be sent.`);
  else toast(`Sent ${meals(sent)} to Google Health ✓`);
}

function onHealthDisconnect() {
  health.disconnect();
  state.health = { waiting: 0, needsSignIn: false, error: '' };
  renderHealth();
  toast('Google Health is off.');
}

// ---------- Settings ----------
function renderSettings() {
  $('#key-gemini').value = state.keys.gemini || '';
  $('#key-deepseek').value = state.keys.deepseek || '';
  $('#key-results').replaceChildren(...PROVIDERS.map((p) => el('li', {}, `${PROVIDER_LABELS[p]}: ${maskKey(state.keys[p])}`)));
  $('#targets').replaceChildren(...GOALS.map((m) => el('div', {},
    el('label', { for: `t-${m}` }, GOAL_LABELS[m]),
    el('input', { id: `t-${m}`, type: 'number', inputmode: 'numeric', min: '0', value: state.targets[m] }))));
  syncSaveTargets();
  renderRowStatus();
  if (!localStorage.getItem('countmakan.targets')) $('#goals').open = true;
  health.preload().catch(() => {});
  renderHealth();
  if (!state.keys.gemini) $('#gemini-guide').open = true;
  if (state.keys.deepseek) $('#deepseek-section').open = true;
  renderChain();
}

// Provider order: tried top to bottom. Up and down buttons move a step.
function renderChain() {
  const list = chain();
  const move = (i, by) => {
    const ids = list.map(stepId);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    saveOrder(ids);
    renderChain();
    // Keep focus on the moved step. At the top or bottom its other button takes it.
    const moved = ids[i + by];
    ($(`#chain [data-move="${by}"][data-step="${moved}"]:not([disabled])`) || $(`#chain [data-step="${moved}"]:not([disabled])`))?.focus();
  };
  $('#chain').replaceChildren(...list.map((s, i) => {
    const name = `${PROVIDER_LABELS[s.provider]} · ${s.model}`;
    return el('li', { class: 'chain-step' },
      el('span', {}, `${name}${keyNote(s.provider)}`),
      el('span', { class: 'chain-btns' },
        el('button', { type: 'button', class: 'btn', 'data-move': '-1', 'data-step': stepId(s), 'aria-label': `Move ${name} up`, disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        el('button', { type: 'button', class: 'btn', 'data-move': '1', 'data-step': stepId(s), 'aria-label': `Move ${name} down`, disabled: i === list.length - 1, onclick: () => move(i, 1) }, '↓')));
  }));
  $('#reset-order').hidden = !state.order.length;
}

function keyNote(p) {
  if (state.keys[p]) return '';
  return OPTIONAL_PROVIDERS.includes(p) ? ' (optional, no key)' : ' (no key)';
}

// Not-set-up card: jump straight to Setup with the key guide open.
function openOwnKeySetup() {
  showTab('settings');
  $('#setup').open = true;
  $('#gemini-guide').open = true;
  $('#setup').scrollIntoView({ block: 'start' });
}

// First key, from Setup or a setup link: goals come next, with Suggest open. Close keeps the defaults.
function openGoalSetup() {
  showTab('settings');
  $('#goals').open = true;
  $('#suggest').open = true;
  $('#goals').scrollIntoView({ block: 'start' });
  toast("You're all set. Now set your daily goals, or close to keep the defaults.", { ms: 6000 });
}

function readKeyInputs() {
  return { gemini: $('#key-gemini').value, deepseek: $('#key-deepseek').value };
}

async function onTestKeys() {
  const keys = readKeyInputs();
  const out = $('#key-results');
  out.replaceChildren(el('li', {}, 'Testing…'));
  const rows = await Promise.all(PROVIDERS.map(async (p) => {
    if (!keys[p]) return el('li', {}, `${PROVIDER_LABELS[p]}: not set${OPTIONAL_PROVIDERS.includes(p) ? ' (optional)' : ''}`);
    const r = await testKey(p, keys[p].trim());
    return el('li', {}, `${r.ok ? '✓' : '✕'} ${PROVIDER_LABELS[p]}: ${r.message}`);
  }));
  out.replaceChildren(...rows);
}

async function onMakeLink() {
  const link = buildSetupLink(location.href, readKeyInputs());
  try {
    await navigator.clipboard.writeText(link);
    toast('Setup link copied. Send it privately.');
  } catch {
    prompt('Copy this setup link:', link);
  }
}

function onSaveTargets() {
  for (const m of GOALS) {
    const v = Number($(`#t-${m}`).value);
    if (v > 0) state.targets[m] = v;
  }
  localStorage.setItem('countmakan.targets', JSON.stringify(state.targets));
  for (const i of document.querySelectorAll('#targets input')) i.classList.remove('suggested');
  renderSummary();
  syncSaveTargets();
  toast('Goals saved ✓');
}

// Save only shows when a box differs from the saved goals.
// Mirrors onSaveTargets: a blank or zero box is ignored, so it doesn't count as a change.
function syncSaveTargets() {
  const dirty = GOALS.some((m) => {
    const v = Number($(`#t-${m}`).value);
    return v > 0 && v !== state.targets[m];
  });
  const btn = $('#save-targets');
  btn.hidden = !dirty;
  const t = state.targets;
  $('#goals-meta').replaceChildren(
    el('span', { class: 'goal-tile' }, el('b', {}, fmt(t.kcal)), el('span', {}, 'kcal')),
    ...MACRO_KEYS.map((m) => el('span', { class: `goal-tile ${m}` }, el('b', {}, `${t[m]}g`), el('span', {}, MACRO_NAMES[m]))));
}

// ---------- Suggest goals ----------
const PROFILE_FIELDS = ['sex', 'age', 'height', 'weight', 'activity', 'goal'];
const SUGGEST_NAMES = { kcal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', sugar: 'Sugar', fibre: 'Fibre', sodium: 'Sodium' };

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem('countmakan.profile')) || {};
  } catch {
    return {};
  }
}

function readProfile() {
  return Object.fromEntries(PROFILE_FIELDS.map((f) => [f, $(`#p-${f}`).value]));
}

function renderSuggestForm() {
  const opts = (map) => [el('option', { value: '' }, 'Choose'), ...Object.entries(map).map(([k, v]) => el('option', { value: k }, v.label))];
  $('#p-activity').replaceChildren(...opts(ACTIVITY));
  $('#p-goal').replaceChildren(...opts(GOAL_CHOICES));
  const p = loadProfile();
  for (const f of PROFILE_FIELDS) if (p[f] != null) $(`#p-${f}`).value = p[f];
  updateGoalHint();
}

// Shows a BMI hint and pre-picks the goal only while the user hasn't chosen one.
function updateGoalHint() {
  const w = Number($('#p-weight').value);
  const h = Number($('#p-height').value);
  if (!(w > 0 && h > 0)) {
    $('#p-hint').textContent = '';
    return;
  }
  const hint = goalHint(w, h);
  $('#p-hint').textContent = hint.text;
  if (!$('#p-goal').value) $('#p-goal').value = hint.goal;
}

// Fills the goal boxes but does not save. The user can change any number, then taps Save goals.
function onSuggest() {
  const profile = readProfile();
  try {
    const { targets, reasons } = suggestTargets(profile);
    localStorage.setItem('countmakan.profile', JSON.stringify(profile));
    for (const m of GOALS) {
      const input = $(`#t-${m}`);
      input.value = targets[m];
      input.classList.add('suggested');
    }
    syncSaveTargets();
    $('#suggest-reasons').replaceChildren(...GOALS.map((m) => el('li', {}, `${SUGGEST_NAMES[m]} ${fmt(targets[m])} ${m === 'kcal' ? 'kcal' : m === 'sodium' ? 'mg' : 'g'}: ${reasons[m]}`)));
    setStatus($('#suggest-status'), 'Numbers filled in above. Change any of them, then tap Save goals.');
    $('#targets').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    $('#suggest-reasons').replaceChildren();
    setStatus($('#suggest-status'), e.message, true);
  }
}

function onExport() {
  const data = buildExport(state.entries, state.targets, state.favs);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `makan-meter-${localDay(new Date())}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus($('#io-status'), `Saved a copy of ${data.entries.length} meals.`);
  localStorage.setItem('countmakan.lastBackup', new Date().toISOString());
  renderRowStatus();
}

// Settings rows show where each one stands. Amber means it needs doing.
function renderRowStatus() {
  const last = localStorage.getItem('countmakan.lastBackup');
  const backup = $('#backup-status');
  backup.textContent = last
    ? `Saved ${new Date(last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : state.entries.length ? 'Never saved' : 'No meals yet';
  backup.classList.toggle('warn', !last && state.entries.length > 0);
  const setup = $('#setup-status');
  setup.textContent = hasKeys() ? 'Key saved' : 'No key';
  setup.classList.toggle('warn', !hasKeys());
}

async function onImport(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const { entries, targets, favourites } = parseImport(await file.text());
    await db.putMany(entries);
    if (favourites.length) state.favs = saveFavs(mergeFavs(state.favs, favourites));
    if (targets) {
      state.targets = { ...state.targets, ...targets };
      localStorage.setItem('countmakan.targets', JSON.stringify(state.targets));
    }
    state.entries = await db.allEntries();
    renderToday();
    renderSettings();
    setStatus($('#io-status'), `Restored ${entries.length} meals.`);
  } catch {
    setStatus($('#io-status'), "That file isn't a Makan Meter copy. Choose another file.", true);
  }
}

// ---------- Install ----------
// Chrome's menu install says "already installed" for any page on an origin that has an
// installed app (turisfasih on hurrymeow.github.io). The page prompt checks scope correctly.
let installEvent = null;
const INSTALL_DECLINED = 'countmakan.installDeclined';
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches;

function renderInstall() {
  let declined = false;
  try { declined = localStorage.getItem(INSTALL_DECLINED) === '1'; } catch { /* storage blocked */ }
  // iOS never fires beforeinstallprompt, so show the manual steps instead.
  const ios = !installEvent && isIOS();
  $('#install').hidden = !(installEvent || ios) || declined || isStandalone();
  $('#install-yes').hidden = ios;
  $('#install-text').textContent = ios
    ? 'Tap the Share button in Safari, then "Add to Home Screen".'
    : 'Open it like any other app. It works without internet too.';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  renderInstall();
});
window.addEventListener('appinstalled', () => { installEvent = null; renderInstall(); });

async function onInstall() {
  const e = installEvent;
  installEvent = null;
  renderInstall();
  if (e) await e.prompt().catch(() => {});
}

function onDeclineInstall() {
  try { localStorage.setItem(INSTALL_DECLINED, '1'); } catch { /* storage blocked */ }
  renderInstall();
}

// ---------- Share ----------
// Installed apps hide the address bar, so this is the only way to find the link.
async function onShareApp() {
  const url = new URL('./', location.href).href;
  if (navigator.share) {
    try { await navigator.share({ title: document.title, url }); return; }
    catch (err) { if (err && err.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied.'); }
  catch { toast(url); }
}

// ---------- Boot ----------
async function boot() {
  const fromLink = consumeSetupLink();
  state.keys = loadKeys();
  state.targets = loadTargets();
  state.order = loadOrder();
  state.entries = await db.allEntries();
  state.favs = loadFavs();

  for (const b of document.querySelectorAll('nav button')) b.addEventListener('click', () => showTab(b.dataset.tab));
  for (const id of ['#camera', '#upload', '#replace']) $(id).addEventListener('change', onPhoto);
  $('#type-meal').addEventListener('click', () => openCompose(false));
  $('#cancel-compose').addEventListener('click', resetAdd);
  $('#estimate').addEventListener('click', onEstimate);
  $('#cancel-estimate').addEventListener('click', cancelEstimate);
  $('#retry').addEventListener('click', () => runEstimate());
  $('#start-over').addEventListener('click', resetAdd);
  initSheet();
  initPhotoView();
  $('#save-keys').addEventListener('click', () => {
    const first = !hasKeys();
    state.keys = saveKeys(readKeyInputs());
    renderSettings();
    showStep('add');
    if (first && hasKeys() && !localStorage.getItem('countmakan.targets')) openGoalSetup();
    else toast('Keys saved ✓');
  });
  $('#test-keys').addEventListener('click', onTestKeys);
  $('#make-link').addEventListener('click', onMakeLink);
  $('#reset-order').addEventListener('click', () => { saveOrder([]); renderChain(); toast('Provider order reset.'); });
  $('#own-key').addEventListener('click', openOwnKeySetup);
  $('#save-targets').addEventListener('click', onSaveTargets);
  $('#targets').addEventListener('input', syncSaveTargets);
  $('#suggest-btn').addEventListener('click', onSuggest);
  $('#p-weight').addEventListener('input', updateGoalHint);
  $('#p-height').addEventListener('input', updateGoalHint);
  renderSuggestForm();
  $('#export').addEventListener('click', onExport);
  $('#import').addEventListener('change', onImport);
  $('#install-yes').addEventListener('click', onInstall);
  renderInstall();
  $('#install-no').addEventListener('click', onDeclineInstall);
  $('#share-app').addEventListener('click', onShareApp);
  $('#health-connect').addEventListener('click', () => onHealthSignIn('Connected to Google Health ✓'));
  $('#health-disconnect').addEventListener('click', onHealthDisconnect);
  $('#health-on').addEventListener('change', onHealthToggle);
  $('#health-past-btn').addEventListener('click', onSendPastMeals);
  $('#health-sync-btn').addEventListener('click', onHealthSendCard);
  $('#health-signin').addEventListener('click', onHealthSendCard);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncHealth(); });
  renderInstall();

  showStep('add');
  renderToday();
  document.body.dataset.ready = '1';
  if (health.isOn()) {
    health.preload().catch(() => {});
    syncHealth();
  }
  if (fromLink && !localStorage.getItem('countmakan.targets')) openGoalSetup();
  else if (fromLink) toast("You're all set. Take a photo of your food to start.", { ms: 6000 });

  watchForUpdates();
}

// ---------- Updates ----------
// A new deploy ships a new sw.js. It installs, takes over at once and fires
// controllerchange. The open page still runs the old code, so offer a reload.
// The installed app can sit in the background for days, so check on return.
const UPDATE_CHECK_MS = 30 * 60 * 1000;
function watchForUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  // The first install also fires controllerchange. That is not an update.
  let hadController = !!sw.controller;
  sw.addEventListener('controllerchange', () => {
    if (hadController) $('#update').hidden = false;
    hadController = true;
  });
  $('#update-btn').addEventListener('click', () => location.reload());
  sw.register('sw.js').then((reg) => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, UPDATE_CHECK_MS);
  }).catch(() => {});
}

boot();
