// History tab, and the meal rows it shares with Today.
import { totals, mealTitle } from './schema.js';
import { foodIconSvg } from './food-icons.js';
import { weekChartSvg, daySeries } from './charts.js';
import { localDay } from './io.js';
import { $, el, fmt, state, macroLine } from './ui.js';
import { openEditor } from './editor.js';
import { showTab } from './app.js';

function foodIcon(items, text) {
  const n = el('span', { class: 'ph', 'aria-hidden': 'true' });
  n.innerHTML = foodIconSvg(items, text);
  return n;
}

export function entryRow(e) {
  const t = totals(e.items);
  const { title, more } = mealTitle(e.items, e.text);
  const time = new Date(e.ts).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  return el('li', {},
    el('button', { type: 'button', class: 'entry', 'aria-label': `${title}${more ? ` and ${more} more` : ''}, ${fmt(t.kcal)} calories, at ${time}. Tap to see all items.`, onclick: () => openEditor(structuredClone(e)) },
      e.thumb ? el('img', { src: e.thumb, alt: '' }) : foodIcon(e.items, e.text),
      el('span', { class: 'meta' }, el('span', { class: 'name' }, title), el('span', { class: 'time' }, more ? `${time} · +${more} more` : time)),
      el('span', { class: 'cal' }, fmt(t.kcal), el('small', {}, ' kcal'))));
}

// Last 7 days as bars against the calorie goal. Tap a bar for that day.
function weekCard() {
  const today = localDay(new Date());
  const series = daySeries(state.entries, today, 7).map((d) => ({
    ...d, label: new Date(`${d.day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' }),
  }));
  const goal = state.targets.kcal;
  const logged = series.filter((d) => d.logged);
  const avg = logged.length ? logged.reduce((a, d) => a + d.kcal, 0) / logged.length : 0;
  const summary = logged.length
    ? `About ${fmt(avg)} calories a day, on ${logged.length} day${logged.length > 1 ? 's' : ''} with meals.`
    : 'No meals in the last 7 days.';
  const caption = el('p', { class: 'wk-caption', 'aria-live': 'polite' }, summary);
  const describe = (d) => {
    const date = new Date(`${d.day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    if (!d.logged) return `${date}: no meals saved.`;
    const diff = d.kcal - goal;
    return `${date}: ${fmt(d.kcal)} calories, ${diff > 0 ? `${fmt(diff)} over` : `${fmt(-diff)} under`} your goal.`;
  };
  const chart = el('div', { class: 'wk-wrap' });
  chart.innerHTML = weekChartSvg(series, goal, today);
  let active = null;
  const select = (hit) => {
    active?.classList.remove('active');
    active = hit;
    hit?.classList.add('active');
    caption.textContent = hit ? describe(series[hit.dataset.i]) : summary;
  };
  for (const hit of chart.querySelectorAll('.wk-hit')) {
    hit.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') select(hit); });
    hit.addEventListener('click', () => {
      select(hit);
      document.getElementById(`day-${series[hit.dataset.i].day}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  chart.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') select(null); });
  return el('div', { class: 'card' },
    el('h2', {}, 'Last 7 days'),
    chart,
    caption);
}

export function renderHistory() {
  const byDay = new Map();
  for (const e of state.entries) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  }
  const cards = [...byDay.entries()].map(([day, list]) => {
    const t = totals(list.flatMap((e) => e.items));
    const label = new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return el('div', { class: 'card', id: `day-${day}` },
      el('div', { class: 'day-head' }, el('h2', {}, label), el('span', { class: 'day-total' }, `${fmt(t.kcal)} calories`)),
      el('div', { class: 'muted' }, macroLine(t)),
      el('ul', { class: 'entries' }, list.map(entryRow)));
  });
  $('#history').replaceChildren(...(cards.length
    ? [weekCard(), ...cards]
    : [el('div', { class: 'card empty' },
      el('p', {}, 'No meals saved yet. Once you save some, you\'ll see a chart of your week here.'),
      el('button', { type: 'button', class: 'btn primary', id: 'history-add', onclick: () => showTab('today') }, 'Add your first meal'))]));
}
