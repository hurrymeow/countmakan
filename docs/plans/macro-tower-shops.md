# Macro tower with shop floors

## Goal
Show the tower as the backdrop of the calorie summary on Today. Each logged day becomes one floor of shops, split by that day's macro calorie share, with people walking about. Tap the scene to open the full tower and scroll down to the ground.

Mockups: `/mnt/project-files/shots/tower-display/` (`V-*` are the latest). Sliced art and a throwaway mock renderer: `/mnt/project-files/art/tower-shops/`.

## Decisions and why
- **Scene behind the ring, not a second card.** A separate tower card pushed meals a screen down, and Hari rejected it and the banner crop.
- **No captions or per-floor labels** on Today or in the tap-in view. Hari found them noisy. The tap-in header stays: "Your tower", then stage · N floors · next milestone.
- **Fixed floor height. Today frames only the top.** Floors never shrink. Today shows the roof, tonight's floor and the 3–4 newest floors, which fade into the card. The full height lives in the tap-in view.
- **One floor per day, split by calorie share.** Protein ×4, carbs ×4, fat ×9 kcal per gram. Shares are by calories, not grams, so fat isn't understated. Order left to right: protein, carbs, fat.
- **Shops per macro, 4 each, chosen per day by a hash of the date.** Protein: sports shop, boxing gym, pool hall, dojo. Carbs: office, bakery, noodle stall, pizza kitchen. Fat: butchery, fishmonger, cheese deli, nut bar. Variety stops the stack reading as stripes.
- **Narrow shops lead with their signature prop.** The door edge only shows when there's room, so a 10% share still reads as its shop.
- **Calorie gate stays, but off-band days are messy, not missing.** Inside ±10% of goal gives a clean floor. Outside it gives a dimmed floor with a broken ceiling, caution tape and boxes, and no walkers.
- **Tonight's floor** shows today's live split, faded, with a dashed amber outline. It changes as meals are logged.
- **Walkers:** 1–3 per clean floor, from a 2-frame walk cycle. Only floors on screen animate. `prefers-reduced-motion` stops them.
- **Gold and the material legend are dropped.** They don't fit a ratio floor.

## Tasks

### 1. Art into the repo
- Files: `img/tower/shops/*.png`, `tools/slice-tower.py`, source sheets in `tools/art-src/tower-shops-{1,2,3}.png` (copied from `/mnt/project-files/art/tower-shops/source-sheet*.png`).
- Slice with the magenta key, then despill the pink/purple fringe (the roof lights and trees show it). Crop the lobby to about 1.5 floors tall.
- Pieces per shop: `<kind>-edge`, `<kind>-sig`, `<kind>-mid`. Plus `mess-ceiling`, `mess-clutter`, `mess-tape`, `p-*` walkers, `roof-wide`, `lobby-wide`, `slab`. Remove the old floor sprites (`steel`, `brick`, `glass`, `gold`).
- Done when: the script regenerates every sprite from the sources, no edge pixel has a magenta hue, and the shop sprites total under ~1.5 MB after optimisation.

### 2. Model
- Files: `js/tower.js`, `tests/tower.test.js`.
- `towerModel(entries, targets, today)` returns floors oldest first: `{ day, share: { protein, carbs, fat }, messy, shops: [p, c, f], walkers }`, plus `tonight` (today's live share), `count`, `stage`, `next`.
- Every past day with logged items lays a floor. `messy` = calories outside ±10% (`onTarget`). Walkers = meals logged that day, max 3. Shops = a stable hash of `day` into each macro's list.
- Milestones and stages count all floors.
- Done when: unit tests cover share maths, the gate, stable shop picks, walker cap and an empty history.

### 3. Floor renderer
- Files: `js/tower-art.js` (rewrite as HTML builders), `css/` tower section.
- `floorHtml(floor, width, height)`: three clipped segments. Each segment is sig first, then mid tiles to fill, with the edge prepended when it fits. A slab goes between floors. The mess overlay goes on messy floors. Walkers are positioned absolutely with CSS walk and frame-swap animations.
- Done when: a floor renders correctly at 10%, 30% and 55% shares (screenshot spec).

### 4. Today scene
- Files: `js/app.js` (`renderSummary`, remove `renderTower` card), `index.html` (drop `#tower` card), CSS.
- The summary card's top becomes the scene: sky gradient, then the tower framed on its top (roof, tonight's floor, newest floors) at the right, fading into the card. The date sits top left. The ring sits on a frosted dark disc. The "Under / On / Over goal" pill sits under the ring. Goal and 7-day avg go on one line under the scene. Macro bars are unchanged.
- The whole scene is one button that opens the tap-in view (`aria-label`: "N floors, stage. Open tower").
- At 0–4 floors, show the ground under the tower.
- Done when: e2e screenshots at 0, 3, 45 and 120 floors show no overlap between the ring, pill and tower.

### 5. Tap-in tower view
- Files: `js/app.js` or a new `js/tower-view.js`, CSS.
- Full-screen overlay with the header described above and a close button. Floors fill the width (~104px tall at 390px). The roof is at the top, then tonight's floor, then newest to oldest, then the lobby and ground. It opens scrolled to the top.
- Use `content-visibility: auto` on floors. An IntersectionObserver toggles walker animation. Back/Escape closes it.
- Done when: it opens and closes with keyboard and back, and 120 floors scroll smoothly on a mid phone (no long tasks over 50 ms in a trace).

### 6. Ship
- Files: `sw.js` (bump the cache and add the new sprites), `tests/e2e/tower.spec.js`.
- Done when: unit tests, lint and e2e pass. PR on the existing tower branch `claude/project-thread-fmipj9`, rebased on main.

## Open questions
- Should a partially logged day (one 400 kcal meal) count as a messy floor? The plan assumes yes, because every logged day lays a floor.
- Do messy floors count towards milestones? The plan assumes yes.
- The dojo and pool sprites are drawn in perspective, unlike the flat shops. They're acceptable for now. Replace them if they jar in the real build.
