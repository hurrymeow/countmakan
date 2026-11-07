# Tower celebrations and varied rooms

## Goal
- Hitting the protein or calorie goal should feel like a win on the tower itself.
- Rooms should stop looking the same. Today there is one interior per macro, with one prop repeated.
- Hari picked option **B** (short animation plus lasting marks) on 2026-11-07. The 12 rooms were the second ask in the same thread.
- References are in `/mnt/project-files/shots/tower-yay/`:
  - GIFs `1-protein-hit.gif`, `2-calorie-hit.gif`, `3-both-goals.gif`.
  - Stills `4-after-state.png` and `6-twelve-rooms.png`, plus `5-varied-rooms.gif`.
  - Brainstorm: `/mnt/project-files/brainstorm/tower-yay.md`.
- Reference code is `/mnt/project-files/shots/tower-yay/proto.js`. Port it. Don't redesign it.

## Decisions and why
- **The celebration belongs to the building, not a modal.** A modal blocks logging and is generic. The tower is the thing Hari likes.
- **Three sizes of beat.** Protein is small, calories medium, both large. Scaling them keeps a daily beat from going stale.
  - **Protein:** a blue surge rises up the gym shop. Then the neon dumbbell sign flickers on, with sparkles, and tonight's walkers cheer.
  - **Calories:** the dimmed part of tonight wipes away and the dashed edge turns solid green. Then the ring pulses, three fireworks go off, and a flag climbs the roof.
  - **Both:** everything above, plus searchlights, five fireworks and confetti.
- **Each beat plays once per goal per day.** It fires on the render after a meal log crosses the goal. Reopening the app shows the end state with no replay. That keeps it special and avoids nagging.
- **The marks last.** A protein-hit floor keeps its lit neon sign forever, so history is easy to scan. The flag and the solid edge show only while tonight is in the calorie band.
- **No sad animation.** If calories go over after dinner, the flag and solid edge drop silently. The beat does not replay that day, even if the user comes back into the band.
- **Effects get one overlay canvas over the whole scene**, with `pointer-events: none`. That lets the fireworks burst above the ring. It sits at the same pixel scale as the tower.
- **12 interiors come from `floor.shops`**, which the model already picks: 4 shops per macro, by day hash.
  - Each shop gets its own wall pattern, floor, a main prop and a second prop. It also gets one small loop: bag swing, oven fire, steam, fish, pool shimmer or screen flicker.
  - The macro colour still tints each wall, so the split still reads.
- **Small moving details redraw per frame.** The static cache in `floor()` stays for everything else, so the animation stays cheap.
- **Reduced motion:** skip the beat and draw the end state.
- **No haptics.** `navigator.vibrate` does nothing on iOS Safari.

## Tasks
One Sonnet execution thread, one PR.

1. **Goal state in the model.** In `js/tower.js` `floorFor`, add `proteinHit` (protein ≥ target, when a target exists) and `inBand` (`onTarget` on kcal). Set both on past floors and on tonight. Leave shares, the messy gate, milestones and stage names as they are.
   - Done when unit tests cover both fields for past floors and tonight.
2. **12 interiors.** In `js/tower-art.js` `floorStatic`, swap the single `prop()` per macro for the per-shop walls, floors, main and second props and ceiling lamps from `proto.js` (`SHOP`, `wall`, `floorTiles`, `lamp`, `prop`, `alt`). Alternate the main and second prop across a wide shop. Pick the awning style from the day hash.
   - Split each shop's moving bit out of the static layer into a per-frame draw. Clip it to the shop.
   - Messy floors keep their current look. Shops show boxes and tape, with no awning and no walkers.
   - Done when the tap-in view at 45 floors matches `5-varied-rooms.gif` by eye and stays smooth on the Playwright phone viewport.
3. **Lasting marks.** Neon sign on the protein awning of every `proteinHit` floor, past ones included. On tonight, while `inBand`, the dashed edge turns solid green, the dim is gone, and a roof flag shows. Port `neon`, the roof flag and the sealed edge from `proto.js`.
   - Done when the Today screenshot matches `4-after-state.png` by eye.
4. **Beats.**
   - Add a pure function, e.g. `celebrationFor(prev, now)` in `js/tower.js`, that returns `null`, `'protein'`, `'calorie'` or `'both'`.
   - Store what has been celebrated per day in `localStorage` key `countmakan.celebrated` as `{ day, protein, kcal }`.
   - In `js/app.js` `renderSummary`/`fillScene`, play the beat on an overlay canvas over `.scene`, then remove the overlay. Port `fireworks`, `sparkles`, `confetti`, `searchlights`, the ring pulse and the walker cheer pose. Use the timings in `/mnt/project-files/shots/tower-yay/scene.html`: protein about 2.5 s, calories about 3 s, both about 4.5 s.
   - The ring pulse can be drawn on the overlay. Leave the SVG ring alone.
   - Done when logging a meal that crosses a goal plays the beat once, and a reload shows only the end state.
5. **Reduced motion and cleanup.** With `prefers-reduced-motion`, draw no beat, only marks. Stop the overlay `requestAnimationFrame` when it ends or when the scene re-renders.
6. **Tests.**
   - Unit tests for `celebrationFor`: first hit, both at once, already celebrated, a new day, going over.
   - Unit tests for `proteinHit` and `inBand`.
   - An e2e test: log a meal that crosses the protein goal, check that the overlay canvas appears then goes away, and that a reload has no overlay. Keep the ring overlap check.
   - Run lint, unit tests and the tower e2e specs only.
7. **Preview.** Attach a Today GIF of each beat and a tap-in screenshot at 45 floors to the PR before merge.

## Don't touch
- The macro split, the messy gate, milestones and the stage logic in `js/tower.js`. Only add the two fields and `celebrationFor`.
- The ring SVG, the summary card layout, the bars, and the tap-in header text.
- The walker engine (`walkersFor`, `walkerState`). Add only a cheer pose to the draw.

## Open questions
- Milestone set pieces (lobby 5, garden 20, spire 60, beacon 100) are not drawn yet. They are a likely follow-up, not this PR.
- Should a protein-hit floor in the tap-in view get anything beyond the neon sign? Judge it from the PR screenshot.
