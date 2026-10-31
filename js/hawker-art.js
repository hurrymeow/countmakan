// Placeholder art for the hawker centre. Everything the scene draws comes from this file.
// To swap in real images, replace an entry with { src: 'img/hawker/rice-3.png' }.
// Stall art is 90 wide, standing on y = 150. Backdrops cover the 360 x 180 scene.

export const KINDS = ['rice', 'noodles', 'drink', 'dessert'];
export const KIND_LABEL = { rice: 'Rice', noodles: 'Noodles', drink: 'Drinks', dessert: 'Desserts' };
export const LEVEL_NAME = ['Empty lot', 'Cart', 'Stall', 'Busy stall', 'Famous stall'];
export const ERA_NAME = ['', 'Open-air lot', 'Hawker centre'];

const COLOR = { rice: '#f2b134', noodles: '#e5533d', drink: '#2fa8cc', dessert: '#d9569f' };
const DARK = { rice: '#9a6a0a', noodles: '#8f2a1c', drink: '#17627c', dessert: '#8a2a62' };

function goods(kind, x, y) {
  const bowl = `<path d="M${x - 7},${y} h14 a7,7 0 0 1 -14,0z" fill="#fff" stroke="#5a4636" stroke-width="1.5"/>`;
  if (kind === 'rice') return `${bowl}<path d="M${x - 6},${y} q6,-8 12,0z" fill="#fffdf0" stroke="#5a4636" stroke-width="1"/>`;
  if (kind === 'noodles') return `${bowl}<path d="M${x - 5},${y} q2,-5 5,0 t5,0" fill="none" stroke="#e0a800" stroke-width="2"/>`;
  if (kind === 'drink') return `<path d="M${x - 5},${y - 9} h10 l-2,16 h-6z" fill="#fff" stroke="#5a4636" stroke-width="1.5"/><rect x="${x - 4}" y="${y - 2}" width="8" height="7" fill="#c98a4b"/><path d="M${x + 1},${y - 9} l4,-6" stroke="#e5533d" stroke-width="2"/>`;
  return `<path d="M${x - 8},${y + 6} v-8 l16,2 v6z" fill="#ffd7ea" stroke="#5a4636" stroke-width="1.5"/><circle cx="${x + 2}" cy="${y - 4}" r="2.5" fill="#d9569f"/>`;
}

const person = (x, tone) => `<g><circle cx="${x}" cy="128" r="4" fill="${tone}"/><path d="M${x - 5},148 v-12 a5,5 0 0 1 10,0 v12z" fill="#4d6a8a"/></g>`;
const lantern = (x, y) => `<g><path d="M${x},${y - 6} v6" stroke="#5a4636"/><ellipse cx="${x}" cy="${y + 6}" rx="5" ry="6.5" fill="#ff4d3a" stroke="#8f1c10" stroke-width="1"/><rect x="${x - 2}" y="${y + 12}" width="4" height="3" fill="#ffd54a"/></g>`;
const steam = (x, y) => `<path d="M${x},${y} q-4,-5 0,-9 t0,-9 M${x + 7},${y + 2} q-4,-5 0,-9 t0,-9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
const star = (x, y, r) => `<path d="M${x},${y - r} l${r * 0.3},${r * 0.7} ${r * 0.8},0 -${r * 0.65},${r * 0.5} ${r * 0.25},${r * 0.8} -${r * 0.7},-${r * 0.5} -${r * 0.7},${r * 0.5} ${r * 0.25},-${r * 0.8} -${r * 0.65},-${r * 0.5} ${r * 0.8},0z" fill="#ffd54a" stroke="#b8860b" stroke-width="1"/>`;
const sparkle = (x, y) => `<path d="M${x},${y - 5} q1,4 5,5 q-4,1 -5,5 q-1,-4 -5,-5 q4,-1 5,-5z" fill="#fff8c4" stroke="#f0b400" stroke-width=".8"/>`;

function awning(c, x, y, w) {
  const n = 6, sw = w / n;
  let s = '';
  for (let i = 0; i < n; i++) s += `<path d="M${x + i * sw},${y} h${sw} l${i % 2 ? -2 : 2},12 h-${sw}z" fill="${i % 2 ? '#fff' : c}" stroke="#5a4636" stroke-width="1"/>`;
  return s;
}

const stall = {
  // Level 1: a push cart with an umbrella.
  1: (k) => `<path d="M45,96 L45,126" stroke="#5a4636" stroke-width="2"/><path d="M20,106 q25,-24 50,0z" fill="${COLOR[k]}" stroke="#5a4636" stroke-width="1.5"/>
    <rect x="22" y="126" width="46" height="18" rx="3" fill="${DARK[k]}" stroke="#5a4636" stroke-width="1.5"/>
    <rect x="20" y="122" width="50" height="6" rx="2" fill="#f4e4c8" stroke="#5a4636" stroke-width="1.5"/>
    ${goods(k, 45, 116)}<circle cx="32" cy="146" r="5" fill="#333"/><circle cx="58" cy="146" r="5" fill="#333"/>`,
  // Level 2: a proper booth with a striped awning.
  2: (k) => `<rect x="10" y="98" width="70" height="52" fill="#f4e4c8" stroke="#5a4636" stroke-width="1.5"/>
    <rect x="10" y="126" width="70" height="24" fill="${DARK[k]}" stroke="#5a4636" stroke-width="1.5"/>
    <rect x="6" y="122" width="78" height="6" rx="2" fill="#c98a4b" stroke="#5a4636" stroke-width="1.5"/>
    ${awning(COLOR[k], 6, 88, 78)}${goods(k, 30, 114)}${goods(k, 58, 114)}
    <rect x="30" y="68" width="30" height="14" rx="2" fill="${COLOR[k]}" stroke="#5a4636" stroke-width="1.5"/>`,
  // Level 3: taller, steaming, with a queue and a lantern.
  3: (k) => `<rect x="8" y="84" width="66" height="66" fill="#f4e4c8" stroke="#5a4636" stroke-width="1.5"/>
    <rect x="8" y="126" width="66" height="24" fill="${DARK[k]}" stroke="#5a4636" stroke-width="1.5"/>
    <rect x="4" y="122" width="74" height="6" rx="2" fill="#c98a4b" stroke="#5a4636" stroke-width="1.5"/>
    ${awning(COLOR[k], 4, 76, 74)}${goods(k, 26, 114)}${goods(k, 52, 114)}${steam(38, 112)}
    <rect x="22" y="48" width="38" height="18" rx="3" fill="${COLOR[k]}" stroke="#5a4636" stroke-width="1.5"/>
    ${lantern(14, 62)}${lantern(70, 62)}${person(82, '#e8b890')}${person(90, '#c98a4b')}`,
  // Level 4: gold-trimmed, starred, crowded.
  4: (k) => `<rect x="4" y="76" width="72" height="74" fill="#fff3d6" stroke="#b8860b" stroke-width="2"/>
    <rect x="4" y="128" width="72" height="22" fill="${DARK[k]}" stroke="#b8860b" stroke-width="2"/>
    <rect x="0" y="124" width="80" height="6" rx="2" fill="#ffd54a" stroke="#b8860b" stroke-width="1.5"/>
    ${awning(COLOR[k], 0, 68, 80)}${goods(k, 22, 114)}${goods(k, 40, 114)}${goods(k, 58, 114)}${steam(30, 112)}${steam(52, 112)}
    <path d="M10,60 h60 l-4,-16 h-52z" fill="#ffd54a" stroke="#b8860b" stroke-width="2"/>
    <rect x="18" y="46" width="44" height="12" rx="2" fill="${COLOR[k]}"/>${star(40, 34, 11)}
    ${lantern(8, 70)}${lantern(72, 70)}${person(84, '#e8b890')}${person(92, '#c98a4b')}${person(100, '#f0c8a0')}${sparkle(16, 30)}${sparkle(66, 24)}`,
};

const plot = () => '<rect x="6" y="140" width="70" height="10" rx="3" fill="none" stroke="#9a8a70" stroke-width="2" stroke-dasharray="6 4"/>';

// Art for one stall slot, drawn in a 0..90 box. Level 0 is an empty plot.
export function stallArt(kind, level) {
  return level ? stall[level](kind) : plot();
}

const bunting = (y, n, w) => {
  const cols = ['#e5533d', '#f2b134', '#2fa8cc', '#d9569f'];
  let s = `<path d="M0,${y} q${w / 2},14 ${w},0" fill="none" stroke="#5a4636" stroke-width="1.5"/>`;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = t * w, dy = 14 * 2 * t * (1 - t);
    s += `<path d="M${x - 5},${y + dy} h10 l-5,10z" fill="${cols[i % 4]}"/>`;
  }
  return s;
};

// Backdrops. `back` sits behind the stalls, `front` in front of them.
export const ERA = {
  1: {
    back: `<defs><linearGradient id="hk-sky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3f4"/><stop offset="1" stop-color="#fff0c9"/></linearGradient></defs>
      <rect width="360" height="180" fill="url(#hk-sky1)"/>
      <circle cx="300" cy="34" r="16" fill="#ffe27a"/>
      <path d="M0,120 q40,-30 80,-8 t90,-4 t100,-10 t90,6 v76 h-360z" fill="#9ccf8a"/>
      <rect y="150" width="360" height="30" fill="#d9c7a3"/><rect y="150" width="360" height="3" fill="#b9a67e"/>`,
    front: `${bunting(14, 12, 360)}`,
  },
  2: {
    back: `<defs><linearGradient id="hk-sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2f6b"/><stop offset="1" stop-color="#f6a45c"/></linearGradient></defs>
      <rect width="360" height="180" fill="url(#hk-sky2)"/>
      <path d="M0,116 h40 v-34 h28 v34 h30 v-52 h34 v52 h60 v-40 h30 v40 h50 v-60 h28 v60 h60 v70 h-360z" fill="#3a3f7a" opacity=".55"/>
      <rect y="150" width="360" height="30" fill="#cfc2a8"/>
      ${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 30},150 v30" stroke="#b5a688" stroke-width="1"/>`).join('')}
      <rect y="150" width="360" height="3" fill="#a99a7a"/>
      <path d="M-6,34 L180,2 L366,34 v12 h-372z" fill="#c4452f" stroke="#7a2616" stroke-width="2"/>
      <path d="M-6,46 h372 v8 h-372z" fill="#f2b134" stroke="#7a2616" stroke-width="1.5"/>
      <rect x="110" y="14" width="140" height="22" rx="4" fill="#fff3d6" stroke="#b8860b" stroke-width="2"/>
      <text x="180" y="30" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="13" letter-spacing="1.5" fill="#7a2616">HAWKER CENTRE</text>`,
    front: `${Array.from({ length: 9 }, (_, i) => lantern(24 + i * 39, 56)).join('')}`,  },
};

// Strung lights and sparkles for a well-rounded menu. Drawn over everything.
export const VARIETY = `<path d="M0,66 q90,22 180,0 t180,0" fill="none" stroke="#5a4636" stroke-width="1.5"/>
  ${Array.from({ length: 14 }, (_, i) => {
    const x = 12 + i * 26, y = 66 + Math.sin((i + 1) * 0.9) * 8 + 8;
    return `<circle cx="${x}" cy="${y}" r="4" fill="${['#ffd54a', '#ff7aa8', '#7ad7ff'][i % 3]}" stroke="#fff" stroke-width="1"><animate attributeName="opacity" values="1;.4;1" dur="${1.6 + (i % 3) * 0.4}s" repeatCount="indefinite"/></circle>`;
  }).join('')}`;
