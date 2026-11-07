# Pixel tower and walkers

## Goal
- Replace the Gemini sprite tower and walkers with pixel art drawn in code.
- Hari picked style **B Pixel** on 2026-11-07, from four previews.
- Reference: `/mnt/project-files/shots/tower-styles/` (`B-today.png`, `B-view.png`, `B-walk.gif`).
- Reference code: `/mnt/project-files/shots/tower-styles/preview.html`, style `B`. Port it. Don't redesign it.

## Decisions and why
- **Draw in code, on canvas.** The Gemini art mixes styles and its walk frames don't match. The dumbbells pop in and out between frames. Code-drawn pixels stay consistent and crisp at any size.
- **Low-res buffer, scaled up with no smoothing.** The scale is 2 on Today and 3 in the tap-in view, as in the preview. This gives a true pixel look and is cheap to draw.
- **One interior per macro for v1.** Protein is a gym rack with plates, carbs is desks with screens and plants, fat is a produce counter. The shop variants in `tower.js` (`floor.shops`) stay in the model, unused for now.
- **Walkers use one shared engine.** Each walker loops its floor a whole number of times per 8 s cycle. Its 4-frame gait is tied to the distance walked, so the feet never slide. Walkers mix directions, and some walk at twice the speed. This removes the conveyor-belt look.
- **Keep the floor rules.** Each floor is one day, split left to right by macro share. Messy floors show boxes and tape, no awning and no walkers. Tonight's floor has a dashed amber edge, and the part not yet logged is dimmed.
- **Delete the sprite PNGs.** That means `img/tower/shops/` and the precache list in `sw.js`. Offline needs no assets now.

## Tasks
One Sonnet execution thread, one PR.

1. **Renderer.** Rewrite `js/tower-art.js` as a canvas renderer: sky, roof, floor, walkers, from `preview.html` style B.
   - API: `drawTower(canvas, model, { W, mode: 'today'|'view', t, limit, ground })`. Plus an `animate(canvas, …)` that runs `requestAnimationFrame` only while the canvas is on screen.
   - Keep the lobby and ground for short towers, as pixel versions of the same idea.
   - Done when the Today and tap-in crops match `B-today.png` and `B-view.png` by eye.
2. **Today scene.** In `js/app.js` (around lines 233–263), swap the `.scene-tower` HTML for a canvas. Keep the ring, date, status pill, fade and aria-label as they are.
   - Done when `tests/e2e/tower.spec.js` passes. Keep its overlap check: the ring must not overlap the tower.
3. **Tap-in view.** In `js/tower-view.js`, use one tall canvas, or one canvas per screenful of floors. Animate only what is on screen. It still opens at the top and scrolls to the ground.
   - Done when the tap-in e2e passes and scrolling 120 floors stays smooth on the Playwright phone viewport.
4. **CSS and cleanup.** Drop the `.seg`, `.walker`, `.mess` and `.dim` rules from `css/app.css`, and the `tower-walk`, `tower-frames` and `tower-step` keyframes. Remove `img/tower/shops/` and the `TOWER_SPRITES` list in `sw.js`. Bump the SW cache version.
   - Keep `prefers-reduced-motion`: draw one still frame, with no loop.
5. **Tests.** Update `tests/tower.test.js` if any exports change. Add a unit test that a walker's position and frame at `t` and `t + 8s` match, so the loop is seamless.
   - Run lint, unit tests and the tower e2e specs only.
6. **Preview.** Attach Today screenshots at 3, 45 and 120 floors, and a walk GIF, to the PR before merge.

## Don't touch
- Floor logic in `js/tower.js` (shares, the messy gate, milestones, stage names).
- The ring, summary card layout and tap-in header text.

## Open questions
- Should the per-macro shop variants (boxing, pool, bakery, fish and so on) come back as pixel interiors? Not in this PR.
- Should the pixel scale on Today stay at 2? Judge it from the PR screenshots.
