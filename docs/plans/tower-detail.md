# Tower detail: 2x pixels and chibi residents

## Goal
Make the tower readable at phone size. People, rooms, props and the tower shell all read as too chunky today.
Hari picked option C (2x pixel density everywhere) with R2 chibi residents on 2026-11-12.

Previews and prototype: project Library `shots/tower-residents/` (`3-closeup-now-A-B-C.png`, `5-resident-styles-lineup.png`, `6-resident-styles-in-room.png`).
Prototype code: `shots/tower-residents/proto/js/tower-art.proto.js` (look for `fig`, `outline`, `bevel`, `wallFine`, `person`).

## Decisions and why
- **2x buffer, same screen size.** The canvas buffer doubles. On-screen size stays the same, so each art pixel is half the size (1 CSS px on Today, 1.5 in the tap-in view). This is what "pixels too big" asks for.
- **Old 1x coordinates stay as the layout unit.** `drawTower` sets `ctx.setTransform(2,0,0,2,0,0)`, so existing floor, prop and roof code keeps working. Fine detail draws at 0.5 units (1 real px). This avoids a full rewrite of layout maths.
- **Chibi residents (R2).** About 22 px tall at 2x, with an 11 px head, two eyes with highlights, blush and a short body. Faces and hats read best at Today size. Hari chose this over the side-view, slim and soft-outline styles.
- **Jointed figures.** Each pose is a set of joints (hip, shoulder, hands, feet, optional knees). Limbs are thick lines between them, so new actions cost a few numbers, not a new sprite.
- **Roles show through clothes and tools.** One uniform per shop (see T1). One in three people in non-sport shops is a customer in casual clothes with a paper bag.
- **1 px dark outline (#15171f) on people and props.** It separates figures from busy walls. It's the main readability gain after resolution.
- **Sprites are cached.** Each pose is rendered once to a small canvas and keyed by style, act, phase, frame, look, direction and role. The outline pass runs once per key, not per frame.

## Tasks

### T1. 2x buffer and chibi residents (Sonnet, one PR)
Files: `js/tower-art.js`, `js/tower-view.js`, `tests/tower.test.js` (only if helpers are exported).
- `sizeTower`: buffer = layout × 2, CSS size unchanged. `drawTower` and the overlay canvas apply a scale-2 transform.
- Floor static cache: canvas at 2x with `scale(2,2)`. Draw it back at `W+2, H+2` units.
- **Tall canvas guard.** At 2x the tap-in canvas is about 112 px per floor, so it passes 16384 px near 146 floors. Split the tap-in tower into stacked canvases of at most 120 floors each, or render at 1x above a threshold. Pick the simpler one; stacking is preferred. Keep the rail and sticky week header working.
- Replace `pose()`/`walker()` drawing with a `fig()` + `outline()` sprite path, ported from the prototype (chibi branch only: `ky = 0.62`, head `[hx-5, 11, hy-11, 10]`).
- Keep every existing act from `ACTS`/`SPOT` and the walk cycle. Goal-beat cheering on the live floor uses the new figure with both arms up.
- Uniforms: sport red headband and tank top; boxing red gloves and shorts; pool blue swim cap (sunglasses when sitting); dojo white gi with black belt; office white shirt, red tie, navy pants and a briefcase when walking; bakery chef hat and apron; noodle white headband and dark apron; pizza red cap and apron; butcher white cap and striped apron; fish yellow apron and green boots; deli paper cap and dark apron; nut brown beanie and green apron.
- Tool positions follow the hand joint, not absolute y (dough, pizza, knife, bowl).
- Respect reduced motion as today.
- Done when: Today and tap-in show chibi residents at 2x and match `6-resident-styles-in-room.png` (R2). No console errors. A 200-floor test tower opens in the tap-in view without a blank canvas. `npm run check`, `npm test` and lint pass, plus the tower e2e specs only.
- Don't touch: floor logic in `js/tower.js`, celebration timing, the header or rail behaviour, or the shop split.

### T2. Rooms, props and tower shell at 2x (Sonnet, one PR, after T1 merges)
Files: `js/tower-art.js`.
- Walls: port `wallFine` (half-pixel brick, tile, stripe, check and wood panel patterns, skirting, ceiling shadow, framed pictures on plain walls).
- Floors: port fine floor tiles with highlight and grout. Slabs get a top highlight and rivets. Shop dividers get a light edge, and awnings a shadow line.
- Props: draw props into a per-floor 2x canvas, outline it, then composite. Add bevel shading (light top edge, dark bottom and right edge) via the prototype's `bevel` proxy, or inline in the `R` helper.
- Redraw the 12 main props and 12 alt props at 2x, using 0.5-unit detail where shapes read wrong at the new size. Priority: sport rack, office desk, bakery counter, butcher chiller, pool, noodle counter. Keep footprints, because actor `SPOT` offsets depend on them.
- Roof, garden, spire, beacon and lobby get the same bevel and outline treatment, plus a 2x redraw where they look blocky next to the new rooms.
- Done when: tap-in close-up matches `3-closeup-now-A-B-C.png` (C) or better, and no prop looks 1x next to the 2x residents. Same checks as T1.
- Don't touch: anything resident-related from T1, or the layout.

## Open questions
- Today's scene behind the calorie ring: chibi heads are about 11 CSS px there. Check that the ring text stays legible over busier walls. If not, dim the walls on Today only.
- Should customers outnumber staff on busy floors? The current split is 1 in 3. Hari to judge after T1.
