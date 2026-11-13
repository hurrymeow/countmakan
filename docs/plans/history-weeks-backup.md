# History by week, backup reminder, ring check

Brainstorm: thread "Suggest next app improvements" (2026-11-13). Hari picked 1, 2 and 3.

## Goal
- History shows the same Mon–Sun weekly average the tower scores by.
- History stays fast as months of meals pile up.
- Meals stop being one lost phone away from gone.
- The Today ring stays readable over the 2x tower art.

## Decisions and why
- **Weeks reuse the tower's rule.** A week lands when the average kcal over its logged days is within ±10% of the kcal target (`weekScores` in `js/tower.js`). A second rule in History would contradict the tower.
- **Keep the "Last 7 days" chart on top.** It answers "how was this week by day". The week list below answers "how am I doing over time".
- **This week and last week start open. Older weeks start folded** and build their day cards only when first opened. The last-7-days chart only ever points into those two open weeks, so tapping a bar still scrolls to a rendered day.
- **The running week says "So far"**, not landed or missed. That matches the tower, which only upgrades a week once it closes.
- **The backup reminder reuses `countmakan.lastBackup`.** `onExport` in `js/app.js` already writes it, and Settings already shows it.
- **The reminder shows after 30 days without a backup.** If there has never been a backup, it shows once the oldest meal is 7 days old. Weekly is too naggy for parents. A month of meals is the most worth losing.
- **"Later" snoozes for 7 days.** It doesn't dismiss for good, because the risk doesn't go away.
- **The ring already has a dark plate** (`.scene .ring-wrap`, `rgb(14 14 24 / .72)` plus blur), and the tower sits to its right. So T3 measures first and changes CSS only if contrast fails. In the brainstorm I wrongly described T3 as adding a plate.
- **Execution:** T1 Sonnet (layout choices in `js/history.js`). T2 and T3 Haiku (exact strings below). T2 and T3 can share one PR.

## Tasks

### T1. History grouped by Mon–Sun week (Sonnet, own PR)
Files: `js/history.js` (`renderHistory`), `js/tower.js` (export a helper only if `weekScores` needs a variant), `css/app.css`, `tests/history.test.js` (new) or `tests/tower.test.js`, `tests/e2e/features.spec.js` or a new `tests/e2e/history.spec.js`.
- Group the day cards by `weekStart(day)` from `js/tower.js`, newest week first.
- Each week is a `<details class="week">` with a `<summary>` reading, for example: "10–16 Nov · avg 1,820 · Landed". Use "Missed" for a closed week outside ±10%. Use "So far" for the running week. Leave off the avg for a week with no logged days. Don't render a week with no meals at all.
- The summary status uses the existing pill tones (`good`, or plain). Never use the `over` red for a missed week, because the tower deliberately doesn't make misses look broken.
- Open this week and last week. Fill an older week's day cards on its first `toggle` to open.
- Add `loading="lazy"` to meal thumbnails in `entryRow`.
- Keep `id="day-YYYY-MM-DD"` on day cards so the chart's scroll still works.
- Don't touch: the tower, `weekChartSvg`, the editor, the Today list.
- Done-check: unit tests for grouping and status (landed, missed, so far, and a week split across a month boundary). An e2e test that opens a folded week and finds its meals. Lint, check and unit tests pass, plus the touched specs. One screenshot of History at 390 px with 3+ weeks of fixture data, posted before merge.

### T2. Backup reminder on Today (Haiku, shared PR with T3)
Files: `index.html` (one card in the Today tab, just above `#favs`), `js/app.js` (render plus two handlers), `css/app.css` only if the existing `.card` styles don't fit, `tests/e2e/features.spec.js`.
- Show the card when there are meals and either: `countmakan.lastBackup` is older than 30 days, or there is no lastBackup and the oldest entry's `day` is 7+ days ago. Hide it while `countmakan.backupSnooze` is in the future.
- Copy: title "Save a copy of your meals". Body "Your meals are only on this phone. Last copy: {d MMM}." or "Your meals are only on this phone. You haven't saved a copy yet."
- Buttons: "Save a copy" (primary) calls the existing `onExport`, then hides the card. "Later" sets `countmakan.backupSnooze` to now + 7 days and hides the card.
- Wrap every localStorage read and write in try/catch, as the `INSTALL_DECLINED` code does.
- Don't touch: `buildExport`, the import flow, Settings layout.
- Done-check: e2e covering shown (old lastBackup), hidden (recent lastBackup), Later hides it, and Save hides it and updates the Settings row. Lint, check and unit tests pass, plus the touched spec. One screenshot of Today with the card at 390 px.

### T3. Ring legibility check (Haiku, shared PR with T2)
Files: `css/app.css` only (`.scene .ring-wrap`, `.ring-center`, `.ring-unit`).
- First, screenshot Today at 360 px and 390 px with 3, 45 and 120 floors (fixtures from `tests/e2e/tower.spec.js`).
- If the big number and "calories" both read clearly on all six, make no change. Report that with the shots.
- Otherwise, apply exactly these: set the `.scene .ring-wrap` background to `rgb(14 14 24 / .85)`, and add `text-shadow: 0 1px 3px rgb(0 0 0 / .6)` to `.ring-center`. Re-shoot the same six.
- Don't touch: the tower art, the ring SVG, the layout or sizes.
- Done-check: the before and after shots are posted. Lint passes.

## Open questions
- None blocking. The tower's customer-to-staff ratio is still Hari's call and stays out of this plan.
