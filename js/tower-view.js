// Tap-in tower view: a full-screen dialog with every floor, newest at the top.
import { towerModel, headerText, weekStart, addDays } from './tower.js';
import { animate, drawRail, RAIL_W } from './tower-art.js';

let dlg;
let opener;
let stop = () => {};
let unrail = () => {};
let unweek = () => {};
const RAIL_GAP = 8;

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'tower-view';
  dlg.setAttribute('aria-labelledby', 'tower-title');
  dlg.innerHTML = `<div class="tower-head"><div><h2 id="tower-title">Your tower</h2><div class="muted tower-sub"></div></div>
    <button type="button" class="tower-close" aria-label="Close tower">×</button></div><div class="tower-body"><div class="tower-scroll"></div><div class="tower-rail" aria-hidden="true" hidden><canvas></canvas><div class="tower-rail-box"></div></div></div>`;
  document.body.append(dlg);
  dlg.querySelector('.tower-close').addEventListener('click', () => history.back());
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); history.back(); });
  window.addEventListener('popstate', () => { if (dlg.open) close(); });
}

function close() {
  stop();
  unrail();
  unweek();
  dlg.close();
  opener?.focus?.();
}

// Opens at the top. One tall canvas; only the floors on screen are redrawn, and only while the dialog is open.
export function openTower(entries, targets, today, from) {
  if (!dlg) build();
  opener = from;
  const m = towerModel(entries, targets, today);
  const showRail = m.count >= 8;
  const W = Math.min(window.innerWidth, 480) - (showRail ? RAIL_W + RAIL_GAP : 0);
  const scroll = dlg.querySelector('.tower-scroll');
  dlg.querySelector('.tower-sub').textContent = headerText(m);
  const empty = m.count === 0 ? '<p class="tower-empty"><strong>Log a meal to start building your tower.</strong><br>Every day you log adds a floor of shops.</p>' : '';
  scroll.innerHTML = `${empty}<div class="tower-stack" style="width:${W}px;margin:0 auto"><canvas></canvas></div>`;
  scroll.insertAdjacentHTML('afterbegin', '<div class="tower-weekwrap" aria-hidden="true" hidden><div class="tower-week"><b></b><span></span></div></div>');
  dlg.showModal();
  scroll.scrollTop = 0;
  history.pushState({ tower: true }, '');
  stop();
  unrail();
  unweek();
  const rail = dlg.querySelector('.tower-rail');
  rail.hidden = !showRail;
  if (showRail) unrail = setupRail(rail, scroll, m);
  stop = animate(scroll.querySelector('canvas'), m, { W, mode: 'view', ground: true, goal: targets.kcal, scroller: scroll, onLayout: (lay) => { unweek = setupWeeks(scroll, m, lay); } });
}

// Rail: whole tower in miniature with a viewport box. Tap or drag sets the scroll position.
function setupRail(rail, scroll, m) {
  const cv = rail.querySelector('canvas'), box = rail.querySelector('.tower-rail-box');
  const { h } = drawRail(cv, m, scroll.clientHeight - 8);
  rail.style.height = `${h}px`;
  const sync = () => {
    const k = h / scroll.scrollHeight;
    box.style.top = `${scroll.scrollTop * k}px`;
    box.style.height = `${Math.max(6, scroll.clientHeight * k)}px`;
  };
  const seek = (e) => {
    const y = e.clientY - rail.getBoundingClientRect().top;
    scroll.scrollTop = (y / h) * scroll.scrollHeight - scroll.clientHeight / 2;
  };
  const down = (e) => { rail.setPointerCapture(e.pointerId); seek(e); };
  const move = (e) => { if (rail.hasPointerCapture(e.pointerId)) seek(e); };
  scroll.addEventListener('scroll', sync, { passive: true });
  rail.addEventListener('pointerdown', down);
  rail.addEventListener('pointermove', move);
  sync();
  return () => { scroll.removeEventListener('scroll', sync); rail.removeEventListener('pointerdown', down); rail.removeEventListener('pointermove', move); };
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (d) => [+d.slice(8), MON[+d.slice(5, 7) - 1]];
export function weekLabel(w) {
  const [d1, m1] = dm(w), [d2, m2] = dm(addDays(w, 6));
  return m1 === m2 ? `${d1}\u2013${d2} ${m1}` : `${d1} ${m1}\u2013${d2} ${m2}`;
}

// Week seams on the stack, and a sticky bar that names the week at the top of the view.
function setupWeeks(scroll, m, lay) {
  const stack = scroll.querySelector('.tower-stack');
  const wrap = scroll.querySelector('.tower-weekwrap');
  const bar = wrap.firstElementChild;
  const marks = [];
  let prev = null;
  lay.rows.forEach((r, i) => {
    if (r.kind !== 'floor') return;
    const w = weekStart(r.fl.day);
    if (w !== prev) marks.push({ w, y: (lay.top + i * (lay.H + 2)) * lay.u, live: !!r.fl.live, score: m.scores[w] });
    prev = w;
  });
  stack.querySelectorAll('.tower-seam').forEach((n) => n.remove());
  for (const mk of marks) {
    const seam = document.createElement('div');
    seam.className = `tower-seam${mk.score?.hit ? ' hit' : ''}`;
    seam.setAttribute('aria-hidden', 'true');
    seam.style.top = `${mk.y - 3}px`;
    stack.append(seam);
  }
  wrap.hidden = marks.length === 0;
  let shown = null;
  const sync = () => {
    if (!marks.length) return;
    const off = stack.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    const mk = [...marks].reverse().find((k) => off + k.y <= bar.offsetHeight) || marks[0];
    if (mk === shown) return;
    shown = mk;
    const s = mk.score;
    bar.firstElementChild.textContent = mk.live ? 'This week' : weekLabel(mk.w);
    const right = bar.lastElementChild;
    right.className = s?.hit ? 'ok' : '';
    right.textContent = mk.live ? 'in progress' : s ? `avg ${Math.round(s.avg).toLocaleString('en')} \u00b7 ${s.hit ? 'landed \u2605' : 'missed'}` : '';
  };
  sync();
  scroll.addEventListener('scroll', sync, { passive: true });
  return () => scroll.removeEventListener('scroll', sync);
}
