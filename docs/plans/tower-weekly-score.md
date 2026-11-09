# Tower: score the week, not the day

Brainstorm: thread "Rethink broken floors for missed days" (2026-11-09). Builds on `docs/plans/tower-height-landmarks.md` (scaffolding, rail).

## Goal
- A miss should never feel permanent. Give Hari a way to fix the week while it is still running.
- Sport days and rest days have different intakes. Judge calories by the weekly average, not by each day.

## Decisions and why
- **A. Score each Mon–Sun week by its average (Hari, 2026-11-09).** Energy balance over a week is what matters for weight. Sport days then balance against rest days without a day-type toggle.
- **Week starts Monday (Hari).**
- **No more messy days.** Day floors never get scaffolding again. The per-day ±10% gate goes away for floors.
- **Missed weeks keep today's look (Hari).** The current rooms are the baseline "quiet" state. Hit weeks get a busier "happening" state. Nothing looks broken.
- **The running week shows the quiet state** until it closes. It gets upgraded on Monday if it lands.
- **E. Weekly budget for today (Hari).** Today's budget is what you need per day for the rest of the week to land the average.
- **Protein stays daily.** Its neon sign and beat are unchanged.
- **Hit rule:** the average kcal over the week's *logged* days is within ±10% of the kcal target (`onTarget`). Days with no log don't count. A week with no logged days is not scored.
- **Hari should set the kcal target to the weekly daily average**, not the rest-day number. Add one line of help text in the Goals section to say so.
- **Execution model:** Sonnet. It needs reading drawing code.

## Budget formula (E)
- Plain language: assume every remaining day gets logged. Take the calories the week can hold at the target average. Subtract what is already eaten Monday to yesterday. Split the rest evenly over today and the days left to Sunday.
- `budget = (target × (loggedDaysBeforeToday + daysLeftInclToday) − kcalBeforeToday) / daysLeftInclToday`
- Clamp it to 70–130% of target, so it never suggests starving or a binge.
- Worked check: target 1,800. Mon 2,400, Tue 2,200 (both sport), today is Wed. Days left Wed–Sun is 5. Budget = (1,800 × 7 − 4,600) / 5 = 8,000 / 5 = **1,600**.

## Tasks

### T1. Weekly scoring, busier hit weeks, budget (one PR)
Files: `js/tower.js`, `js/tower-art.js`, `js/app.js` (`renderSummary`, tower beat code around `CELEBRATED`), `js/charts.js` if a week helper fits there, `index.html` (Goals help line), `tests/tower.test.js`, `tests/e2e/tower.spec.js`.
- `js/tower.js`
  - Add pure `weekStart(day)` (Monday, from a YYYY-MM-DD string, local noon to dodge DST).
  - Add pure `weekScores(entries, target, today)` → map of weekStart → `{ avg, days, hit }`, closed weeks only.
  - `floorFor`: drop `messy`. Add `busy: true` when the floor's week is closed and hit.
  - Walkers: quiet floors keep today's count (meals, capped at 3). Busy floors get up to 5.
  - Add pure `weekBudget(entries, target, today)` → `{ budget, onTrack }`. `onTrack` is the budget within ±10% of target.
  - Update the header comment at the top of the file.
- `js/tower-art.js`
  - Remove `scaffold()` and every `fl.messy` branch. Quiet floors draw exactly as non-messy floors do today.
  - Busy floors: denser props (spacing ~14 px instead of 21, both prop slots), warm lamps lit, one extra small item per shop (plant, poster or crate). Keep it inside the existing pixel palette.
  - Rail: drop the grey messy band. Busy weeks draw at full saturation, quiet weeks at ~60% alpha.
- Tonight's floor and the roof flag
  - The live frame and flag seal when today's kcal is within ±10% of **the budget** instead of the fixed target.
  - The ring itself keeps the fixed target. Don't touch `ringSvg`.
- Celebrations
  - The daily kcal beat now fires against the budget, once per day as before.
  - Add a week beat. On the first render after a week closes as a hit, play the kcal beat once and upgrade that week's floors. Store it in `countmakan.celebrated` as `week: <weekStart>`. Keep the rule that a session's first render only records state, except for this week beat.
- Summary line (`renderSummary`, next to the "N-day avg" span)
  - When the week is off track, show "≈1,600/day to land the week". When it's on track, show nothing new.
  - Nothing goes on the tower scene itself (Hari wants it caption-free).
- Goals help: one line under the kcal box saying "Use your average day across sport and rest days."

Done-check
- Unit: weekStart for Mon, Sun and a year boundary. weekScores hit, miss and unlogged days. Budget worked example = 1,600 and the clamps. No floor ever has `messy`.
- E2E: seed one hit week and one missed week. Busy floors have more props or walkers than quiet ones. The budget line appears only when the week is off track.
- Screenshots in the PR: tap-in view with a hit week next to a missed week, and Today with the budget line. Put them in `/mnt/project-files/shots/tower-misses/`.

Don't touch: the ring, protein logic, the skyline, milestones, shop picking, `onTarget` tolerance.

## Open questions
- Should the budget also nudge sport days up? Today it's an even split, so the planned sport day reads as "over budget". Revisit if it nags.
- An average can hide a binge balanced by two starved days. The 70–130% clamp limits the suggestion, not what gets eaten. Add sport/rest targets (brainstorm option C) later if needed.
