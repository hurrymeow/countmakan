// Tap-in tower view: a full-screen dialog with every floor, newest at the top.
import { towerModel, headerText } from './tower.js';
import { towerHtml, FLOOR_RATIO } from './tower-art.js';

let dlg;
let viewer;
let opener;

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'tower-view';
  dlg.setAttribute('aria-labelledby', 'tower-title');
  dlg.innerHTML = `<div class="tower-head"><div><h2 id="tower-title">Your tower</h2><div class="muted tower-sub"></div></div>
    <button type="button" class="tower-close" aria-label="Close tower">×</button></div><div class="tower-scroll"></div>`;
  document.body.append(dlg);
  dlg.querySelector('.tower-close').addEventListener('click', () => history.back());
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); history.back(); });
  window.addEventListener('popstate', () => { if (dlg.open) close(); });
}

function close() {
  viewer?.disconnect();
  dlg.close();
  opener?.focus?.();
}

// Opens at the top. Floors fill the width; only floors on screen animate their walkers.
export function openTower(entries, targets, today, from) {
  if (!dlg) build();
  opener = from;
  const m = towerModel(entries, targets, today);
  const W = Math.min(window.innerWidth, 480);
  const H = Math.round(W / FLOOR_RATIO);
  const scroll = dlg.querySelector('.tower-scroll');
  dlg.querySelector('.tower-sub').textContent = headerText(m);
  scroll.style.setProperty('--fh', `${H}px`);
  const empty = m.count === 0 ? '<p class="tower-empty"><strong>Log a meal to start building your tower.</strong><br>Every day you log adds a floor of shops.</p>' : '';
  scroll.innerHTML = `${empty}<div class="tower-stack" style="width:${W}px;margin:0 auto">${towerHtml(m, W, H, { ground: true })}</div>`;
  dlg.showModal();
  scroll.scrollTop = 0;
  history.pushState({ tower: true }, '');
  viewer = new IntersectionObserver((rows) => {
    for (const r of rows) r.target.classList.toggle('in-view', r.isIntersecting);
  }, { root: scroll, rootMargin: '100px' });
  scroll.querySelectorAll('.floor').forEach((f) => viewer.observe(f));
}
