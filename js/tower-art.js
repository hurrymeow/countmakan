// All tower artwork lives here. Placeholder SVG; swap this one file for real art.
// The scene is 360 x 200. The ground is y=180 and the tower is centred on x=180.
// Every export returns SVG markup, so the model in tower.js never touches colour or shape.
// Sprites are PNGs in img/tower/. The vector shapes below are the fallback for floors too short to show a sprite.

export const MATERIALS = ['steel', 'brick', 'glass', 'gold'];
export const MATERIAL_LABEL = { steel: 'Steel', brick: 'Brick', glass: 'Glass', gold: 'Gold' };
export const MATERIAL_HINT = { steel: 'protein', brick: 'carbs', glass: 'fat', gold: 'all four' };

export const GROUND_Y = 180;
export const CX = 180;
export const TOWER_W = 52;

const PAL = {
  steel: { base: '#5b8fd6', win: '#cfe3ff' },
  brick: { base: '#c9582b', win: '#ffd9a8' },
  glass: { base: '#2fb5a3', win: '#e0fff9' },
  gold: { base: '#f2b824', win: '#fff6cf' },
};

const IMG = 'img/tower/';
const image = (name, x, y, w, h, ratio = 'none') => `<image href="${IMG}${name}.png" x="${x}" y="${y.toFixed(2)}" width="${w}" height="${h.toFixed(2)}" preserveAspectRatio="${ratio}"/>`;
// Below this height a sprite turns to mush, so the floor falls back to a flat strip.
const SPRITE_MIN_H = 5;

// One floor. Tall floors use the sprite. Short ones get a dashed window strip.
export function floorArt(material, x, y, w, h) {
  if (h >= SPRITE_MIN_H) return image(material, x, y, w, h + 0.4);
  const p = PAL[material];
  const strip = h >= 2.4 ? `<line x1="${x + 5}" x2="${x + w - 5}" y1="${y + h / 2}" y2="${y + h / 2}" stroke="${p.win}" stroke-opacity=".8" stroke-width="${Math.min(4, h * 0.4).toFixed(2)}" stroke-dasharray="4 3"/>` : '';
  return `<rect x="${x}" y="${y.toFixed(2)}" width="${w}" height="${(h + 0.4).toFixed(2)}" fill="${p.base}"/>${strip}`;
}

export const MATERIAL_SWATCH = (m) => PAL[m].base;

// Sky and ground behind everything.
export const SKY = `<image href="${IMG}sky.png" width="360" height="200" preserveAspectRatio="none"/>`;
export const GROUND = `<rect y="${GROUND_Y}" width="360" height="20" fill="#16181d"/><rect y="${GROUND_Y}" width="360" height="2" fill="#2c303a"/>`;

// Skyline backdrop, three tiers that swap in as the tower grows. Tier 0 is bare sky.
const skyline = (n, h) => `<image href="${IMG}skyline${n}.png" y="${GROUND_Y - h}" width="360" height="${h}"/>`;
export const SKYLINE = ['', skyline(1, 143), skyline(2, 143), skyline(3, 173)];

// Milestones. `at` is the floor count that unlocks each. Listed in order.
export const MILESTONES = [
  { key: 'lobby', at: 5, name: 'Lobby' },
  { key: 'garden', at: 20, name: 'Rooftop garden' },
  { key: 'spire', at: 60, name: 'Spire' },
  { key: 'beacon', at: 100, name: 'Beacon' },
];
export const STAGE_NAME = ['Empty lot', 'Foundation', 'Low rise', 'Mid rise', 'High rise', 'Skyscraper'];

// Podium with entrance. Sits under the first floor once the lobby is built.
export const PODIUM_W = 72;
export const PODIUM_H = 46;
export const LOBBY = image('lobby', CX - PODIUM_W / 2, GROUND_Y - PODIUM_H, PODIUM_W, PODIUM_H);
// Used before the lobby: a plain slab.
export const FOUNDATION = `<rect x="${CX - TOWER_W / 2 - 3}" y="${GROUND_Y - 3}" width="${TOWER_W + 6}" height="3" fill="#8a8f9c"/>`;

// Roof pieces, stacked bottom to top. Each takes the y of its bottom edge and has a height `h`.
export const ROOF = { garden: { w: 52, h: 36, lap: 3 }, spire: { w: 12, h: 30, lap: 2 }, beacon: { w: 18, h: 18, lap: 5 } };
export const garden = (y) => image('garden', CX - ROOF.garden.w / 2, y - ROOF.garden.h, ROOF.garden.w, ROOF.garden.h);
export const spire = (y) => image('spire', CX - ROOF.spire.w / 2, y - ROOF.spire.h, ROOF.spire.w, ROOF.spire.h);
export const beacon = (y) => image('beacon', CX - ROOF.beacon.w / 2, y - ROOF.beacon.h, ROOF.beacon.w, ROOF.beacon.h, 'xMidYMid meet');
