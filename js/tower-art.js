// All tower artwork lives here. Placeholder SVG; swap this one file for real art.
// The scene is 360 x 200. The ground is y=180 and the tower is centred on x=180.
// Every export returns SVG markup, so the model in tower.js never touches colour or shape.

export const MATERIALS = ['steel', 'brick', 'glass', 'gold'];
export const MATERIAL_LABEL = { steel: 'Steel', brick: 'Brick', glass: 'Glass', gold: 'Gold' };
export const MATERIAL_HINT = { steel: 'protein', brick: 'carbs', glass: 'fat', gold: 'all four' };

export const GROUND_Y = 180;
export const CX = 180;
export const TOWER_W = 56;
export const PODIUM_W = 84;
export const PODIUM_H = 14;

const PAL = {
  steel: { base: '#5b8fd6', win: '#cfe3ff' },
  brick: { base: '#c9582b', win: '#ffd9a8' },
  glass: { base: '#2fb5a3', win: '#e0fff9' },
  gold: { base: '#f2b824', win: '#fff6cf' },
};

// One floor. Short floors get a dashed window strip, taller ones a lighter band.
export function floorArt(material, x, y, w, h) {
  const p = PAL[material];
  const strip = h >= 2.4 ? `<line x1="${x + 5}" x2="${x + w - 5}" y1="${y + h / 2}" y2="${y + h / 2}" stroke="${p.win}" stroke-opacity=".8" stroke-width="${Math.min(4, h * 0.4).toFixed(2)}" stroke-dasharray="4 3"/>` : '';
  return `<rect x="${x}" y="${y.toFixed(2)}" width="${w}" height="${(h + 0.4).toFixed(2)}" fill="${p.base}"/>${strip}`;
}

export const MATERIAL_SWATCH = (m) => PAL[m].base;

// Sky and ground behind everything.
export const SKY = `<defs><linearGradient id="tw-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1b2a4a"/><stop offset="1" stop-color="#e8946a"/></linearGradient></defs><rect width="360" height="200" fill="url(#tw-sky)"/><circle cx="300" cy="46" r="14" fill="#ffe9b0" opacity=".9"/>`;
export const GROUND = `<rect y="${GROUND_Y}" width="360" height="20" fill="#16181d"/><rect y="${GROUND_Y}" width="360" height="2" fill="#2c303a"/>`;

// Skyline backdrop, three tiers that stack as the tower grows. Tier 0 is bare sky.
const bldg = (x, w, h, c) => `<rect x="${x}" y="${GROUND_Y - h}" width="${w}" height="${h}" fill="${c}"/>`;
export const SKYLINE = [
  '',
  bldg(8, 22, 26, '#3a3550') + bldg(36, 18, 38, '#3a3550') + bldg(300, 26, 30, '#3a3550') + bldg(332, 20, 22, '#3a3550'),
  bldg(60, 16, 60, '#2e2a42') + bldg(80, 24, 48, '#2e2a42') + bldg(262, 18, 66, '#2e2a42') + bldg(284, 14, 44, '#2e2a42'),
  bldg(110, 12, 84, '#241f38') + bldg(126, 18, 70, '#241f38') + bldg(228, 16, 88, '#241f38') + bldg(246, 12, 62, '#241f38')
    + '<circle cx="62" cy="118" r="5" fill="#241f38"/><rect x="60" y="118" width="4" height="30" fill="#241f38"/>',
];

// Milestones. `at` is the floor count that unlocks each. Listed in order.
export const MILESTONES = [
  { key: 'lobby', at: 5, name: 'Lobby' },
  { key: 'garden', at: 20, name: 'Rooftop garden' },
  { key: 'spire', at: 60, name: 'Spire' },
  { key: 'beacon', at: 100, name: 'Beacon' },
];
export const STAGE_NAME = ['Empty lot', 'Foundation', 'Low rise', 'Mid rise', 'High rise', 'Skyscraper'];

// Podium with entrance. Sits under the first floor once the lobby is built.
export const LOBBY = `<g><rect x="${CX - PODIUM_W / 2}" y="${GROUND_Y - PODIUM_H}" width="${PODIUM_W}" height="${PODIUM_H}" fill="#8a8f9c"/><rect x="${CX - PODIUM_W / 2 - 3}" y="${GROUND_Y - PODIUM_H - 2}" width="${PODIUM_W + 6}" height="3" fill="#b9bdc9"/><rect x="${CX - 9}" y="${GROUND_Y - 11}" width="18" height="11" fill="#ffe7a3"/><rect x="${CX - 12}" y="${GROUND_Y - 13}" width="24" height="3" fill="#d8dce6"/></g>`;
// Used before the lobby: a plain slab.
export const FOUNDATION = `<rect x="${CX - TOWER_W / 2 - 3}" y="${GROUND_Y - 3}" width="${TOWER_W + 6}" height="3" fill="#8a8f9c"/>`;

// Roof pieces. `y` is the top of the top floor.
export const garden = (y) => `<g><rect x="${CX - TOWER_W / 2 - 2}" y="${y - 3}" width="${TOWER_W + 4}" height="3" fill="#b9bdc9"/><circle cx="${CX - 18}" cy="${y - 8}" r="6" fill="#3fae5a"/><circle cx="${CX - 4}" cy="${y - 10}" r="7" fill="#2f9a4b"/><circle cx="${CX + 12}" cy="${y - 8}" r="6" fill="#3fae5a"/><rect x="${CX + 20}" y="${y - 9}" width="4" height="6" fill="#6b4a2a"/></g>`;
export const spire = (y) => `<g><polygon points="${CX - 10},${y} ${CX + 10},${y} ${CX + 2},${y - 20} ${CX - 2},${y - 20}" fill="#cfd5e3"/><rect x="${CX - 1}" y="${y - 34}" width="2" height="16" fill="#cfd5e3"/></g>`;
export const beacon = (y) => `<g><circle cx="${CX}" cy="${y - 36}" r="9" fill="#ffd54a" opacity=".25"/><circle cx="${CX}" cy="${y - 36}" r="3.5" fill="#ffd54a"/></g>`;
