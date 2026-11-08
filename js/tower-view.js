// Tap-in tower view: a full-screen dialog with every floor, newest at the top.
import { towerModel, headerText } from './tower.js';
import { animate, drawRail, RAIL_W } from './tower-art.js';

let dlg;
let opener;
let stop = () => {};
let unrail = () => {};
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
  dlg.showModal();
  scroll.scrollTop = 0;
  history.pushState({ tower: true }, '');
  stop();
  unrail();
  const rail = dlg.querySelector('.tower-rail');
  rail.hidden = !showRail;
  if (showRail) unrail = setupRail(rail, scroll, m);
  stop = animate(scroll.querySelector('canvas'), m, { W, mode: 'view', ground: true, goal: targets.kcal, scroller: scroll });
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
