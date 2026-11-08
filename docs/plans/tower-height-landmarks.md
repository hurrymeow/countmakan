# Tower: height, landmarks, overview rail, scaffolding

Brainstorm: `/mnt/project-files/brainstorm/tower-next.md`. Previews: `/mnt/project-files/shots/tower-next/` (`2-today-height-and-landmarks.png`, `3-view-rail-and-scaffold.png`).

## Goal
- Make tower height readable at a glance, with no captions.
- Draw the milestones the header already names.
- Let the tap-in view show where you are in a tall tower.
- Make off-band days read as "still building", not broken.

## Decisions and why
- **A. Skyline you outgrow (Today only).** On Today, a 3-floor tower and a 120-floor tower look the same. Neighbour roofs, clouds and stars sit at fixed altitudes, so their position shows the tower's height. Hari rejected captions, so height has to be visual.
- **B. Milestone set pieces.** Lobby canopy at 5 floors, roof garden at 20, spire at 60, beacon at 100. `headerText` already promises these.
- **C. Overview rail in the tap-in view.** At 100+ floors the scroll has no orientation. A thin rail gives the whole tower, milestone ticks and a viewport box.
- **D. Scaffolding on messy floors.** Today a messy floor is a flat colour block. Scaffolding reads as a day off, not a failure. No repair rule, so the goal logic stays the same.
- **Execution model:** Sonnet (Hari, 2026-11-08). Every task needs reading drawing code.

## Tasks

### T1. Skyline and set pieces (A + B), one PR
Files: `js/tower-art.js`, `js/app.js` (`fillScene`), `css/*.css` (`.scene`), `tests/tower.test.js`, `tests/e2e/tower.spec.js`.
- Add a pure `skylineFor(count)` in `js/tower-art.js` or `js/tower.js`. It returns neighbour roofs, clouds and star alpha, each as an altitude in floors. Roof y = tower top + (count − altitude) × ~1.1 buffer px. Neighbours: about 7 roofs between 8 and 38 floors. Clouds at about 40–52 and 85–96 floors. Stars fade in from 30 to 100 floors.
- Draw the skyline on a backdrop canvas in `.scene`, behind `.scene-tower`. Use the same pixel scale (u = 2). Draw it once per render, with no animation. Dim the neighbour windows to about 25% alpha so the ring stays the focal point.
- Make `roof()` take `m.built`:
  - garden: 3 trees, a pergola and a bench. These replace the plant row.
  - spire: a stepped base, a mast and a red tip.
  - beacon: a spire plus a pulsing red light. The light is static when the user prefers reduced motion.
  - lobby: a canopy and a sign over the doors in `lobby()`.
- Make the roof headroom depend on what is built. `ROOF_TOP` stays at 15 rows without a spire and grows to about 45 rows with one. The flag stays at 0.35 W, so it does not clash with the centred spire.
- The spire may rise into the date row on the right. It must not overlap the ring or the date text.
- Done-check:
  - Unit tests for `skylineFor`: at 3 floors, at least one neighbour roof sits above the tower top. At 120 floors, every neighbour roof sits below the scene.
  - The e2e `today-*` tests still pass, including the ring and pill overlap checks.
  - Add an e2e check that the spire canvas box does not overlap `.scene-date` or `.ring-wrap` at 65 floors.
  - `TOWER_SHOTS` screenshots at 3, 25, 65 and 120 floors go in the PR.

### T2. Overview rail and scaffolding (C + D), one PR
Files: `js/tower-view.js`, `js/tower-art.js` (`floorStatic` messy branch, plus a new `drawRail`), `css/*.css` (`.tower-view`), `tests/e2e/tower.spec.js`.
- Rail: a canvas about 20px wide, fixed to the right of `.tower-scroll`. The tower width becomes `min(innerWidth, 480) − rail width − gap`.
  - Draw one band per floor, newest at the top, split by macro share. Messy floors are grey. Band height is `min(4px, available height / rows)`.
  - Add a small spire or beacon cap when that milestone is built.
  - Add amber ticks at 5, 20, 60 and 100 floors, counted from the ground.
  - Draw a white viewport box and update it on scroll.
  - Tap or drag on the rail sets `scrollTop`. Use pointer events with `touch-action: none` on the rail.
  - Mark the rail `aria-hidden`, because the scroll area stays keyboard-scrollable.
  - Hide the rail when `count < 8`.
- Scaffolding: replace the flat block in the messy branch of `floorStatic`.
  - Bare concrete with faint vertical lines.
  - Poles every 16 px, 3 plank rows and diagonal braces.
  - A green tarp over the middle 40%, plus a cone and a cement bag.
  - Messy floors keep zero walkers.
- Done-check:
  - Add an e2e test at 45 floors. The rail is visible. Tapping near the rail's bottom scrolls the view to the lobby (the ground is in view).
  - The existing tap-in tests still pass: Escape, Back and empty state.
  - Screenshots of the rail and of one messy floor go in the PR.

## Not in scope
- E (crane beat per meal) and F (time-of-day sky).
- Any change to the floor logic, the calorie band or the walker counts.
- Captions or per-floor labels. Hari does not want them.

## Open questions
- Should the skyline also go behind the tap-in view? The default is no. Its gradient stays.
- T1 and T2 both touch `js/tower-art.js`, in different functions. They can run in parallel. The second to merge rebases.
