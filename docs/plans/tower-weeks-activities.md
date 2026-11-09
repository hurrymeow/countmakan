# Tower: week header and in-room activities

Brainstorm: thread "Plan week labels and room activities" (2026-11-09). Builds on `docs/plans/tower-weekly-score.md` (#68).
Previews: `/mnt/project-files/shots/tower-activities/` (1B-* and 2/3-activities GIFs). Prototype code: `proto/tower-art.proto.js` there (see `actors()` and `pose()` at the end, plus the patched walker call in `floor()`), and `proto/weeks.html` for the header and seams.

## Goal
- Make the weekly score visible in the tap-in view, and show where each week starts.
- Make people in rooms do the shop's thing, not just walk across the floor.

## Decisions and why
- **B. Sticky week header (Hari, 2026-11-09).** One bar under the title shows the week in view. One label total keeps the floors caption-free, which Hari asked for earlier.
- **The header shows the average (my default, Hari didn't object).** Format: `2–8 Nov` on the left. `avg 1,800 · landed ★` (green) or `avg 2,350 · missed` on the right. The running week shows `This week` and `in progress`. A week with no score shows dates only.
- **Thin seams between weeks.** A 2 px line at the slab where a week starts. Gold for landed weeks, slab grey for the rest. No text on the floors.
- **R2. Walk-and-do loop (Hari).** Each person shuttles between two nearby props and does that shop's action at each. The headcount rule is unchanged (meals, capped at 3; up to 5 on busy weeks; 1 on tonight).
- **Today mode gets the same actors.** There's no separate code path. The actions are small at 2x, which is accepted.
- **Execution model:** Sonnet. Both tasks need reading drawing code.

## Tasks

### T1. Sticky week header and seams (one PR, with T2 if small enough; else separate)
Files: `js/tower-view.js`, `js/tower-art.js` (export row positions if needed), `css/app.css` (`.tower-*` block near line 480), `tests/e2e/tower.spec.js`.
- In `openTower`, after `sizeTower`, walk `layout.rows`. For each floor row whose `weekStart(day)` differs from the row above, record `{ week, y: (top + i * (H + 2)) * u, live, score: m.scores[week] }`.
- Seams: absolutely positioned divs inside `.tower-stack` at each `y`. Gold `#f2b84b` when `score.hit`, else `#5a5e70`. Pointer-events none, aria-hidden.
- Header: one `.tower-week` bar, `position: sticky; top: 0` inside `.tower-scroll`. Semi-opaque dark background, 13 px text. On scroll (reuse the existing scroll listener pattern, passive), show the last seam whose `y` is at or above the scroll top plus the bar height.
- Date label: same month `2–8 Nov`; spanning months `26 Oct–1 Nov`. Average rounded, en thousands separator.
- Screen reader: the bar is `aria-live="off"` text, not announced on every scroll.
- Hide the bar when the tower has no floors.
Done-check
- E2E: seed one hit week and one missed week. The bar reads the newest week at the top. After scrolling past a seam it reads the older week. Gold seam count equals hit weeks shown.
- Layout test: the bar doesn't overlap the rail or the close button at 390 px.
- Screenshot at the top and scrolled, in `/mnt/project-files/shots/tower-activities/pr/`.

### T2. Walk-and-do actors (R2)
Files: `js/tower-art.js`, `tests/tower.test.js` (if pure helpers are exported), `tests/e2e/tower.spec.js`.
- Stations: each prop drawn in `floor()` is a station. Its action is `ACTS[shop][slot % 2]`. It has a stand offset and a facing from `SPOT[action]`. Copy both tables from the prototype and tune the offsets so figures line up with props.
- Actions (16): lift, run, punch, swim, kick, sit (meditate or lounger), type, chat (speech bubble), knead, browse, slurp, toss, eat, chop, slice, scoop.
- Schedule: a 12 s loop (`ALOOP`). Act at station A for 33%, walk to B for 17%, act at B for 33%, walk back for 17%. B is the nearest other station within 60 px. With no B, stay at A.
- People pick stations from a seeded shuffle, so two people don't share one until stations run out.
- Gait while walking comes from the distance walked, like the current walker, so the feet don't slide.
- Everything is deterministic in `t` and the floor's day hash. No state.
- Keep the cheer beat as it is: during a beat, tonight's person uses the existing walker cheer pose.
- Remove `walkersFor`/`walkerState` only if nothing else uses them. Otherwise leave them.
- Reduced motion: the still frame shows everyone at station A, mid-action.
- Update the header comment at the top of `js/tower-art.js`.
Done-check
- Unit (if helpers are exported): the stations list matches the props per floor. The schedule loops exactly at 12 s.
- E2E: the tower still renders at 0, 3, 45 and 120 floors with no page errors.
- The FPS budget holds: still 20 fps, and only visible floors are drawn.
- A GIF of the tap-in view in the PR, in `/mnt/project-files/shots/tower-activities/pr/`.

Don't touch: weekly scoring, the budget, the ring, celebrations logic, the skyline, milestones, shop picking, headcount rules.

## Open questions
- Should the swimmer be clipped to the pool water? The prototype draws the head over the pool prop, which reads fine at 3x. Judge it in the PR GIF.
- R3 (queues, staff serving, small events) comes later if R2 lands well.
