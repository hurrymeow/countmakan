// Hawker centre on Today. Pure functions: history in, SVG markup out. No stored state.
// Each food kind has a stall that levels up with how often it is logged.
// The centre moves through eras with the number of logged days. Nothing ever shrinks.
import { foodKind } from './food-icons.js';
import { KINDS, KIND_LABEL, LEVEL_NAME, ERA_NAME, ERA, VARIETY, stallArt } from './hawker-art.js';

// Logs of one kind needed to reach each level: cart, stall, busy, famous.
export const LEVEL_AT = [1, 5, 15, 40];
// Logged days needed to reach each era after the first.
export const ERA_AT = [14];

const levelFor = (n) => LEVEL_AT.filter((t) => n >= t).length;

export function hawkerModel(entries) {
  const counts = Object.fromEntries(KINDS.map((k) => [k, 0]));
  const days = new Set();
  for (const e of entries) {
    if (!e.items?.length) continue;
    days.add(e.day);
    const kind = foodKind(e.items, e.text);
    if (kind in counts) counts[kind]++;
  }
  const stalls = KINDS.map((kind) => {
    const level = levelFor(counts[kind]);
    const next = LEVEL_AT[level];
    return { kind, label: KIND_LABEL[kind], count: counts[kind], level, name: LEVEL_NAME[level], toNext: next ? next - counts[kind] : 0 };
  });
  const era = 1 + ERA_AT.filter((t) => days.size >= t).length;
  return { days: days.size, era, eraName: ERA_NAME[era], stalls, balanced: stalls.every((s) => s.level >= 2) };
}

// Slots sit 90 apart, centred in the 360 wide scene.
export function hawkerSvg(m) {
  const era = ERA[m.era];
  const stalls = m.stalls.map((s, i) => `<g transform="translate(${i * 90 + 2},0)">${stallArt(s.kind, s.level)}</g>`).join('');
  return `<svg class="hawker" viewBox="0 0 360 180" role="img" aria-label="${m.eraName}, ${m.stalls.map((s) => `${s.label} ${s.name.toLowerCase()}`).join(', ')}">${era.back}${stalls}${era.front}${m.balanced ? VARIETY : ''}</svg>`;
}
