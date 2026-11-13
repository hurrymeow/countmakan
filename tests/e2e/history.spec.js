import { test, expect } from '@playwright/test';
import { seedKeys, open } from './helpers.js';

// One meal a day for the 4 weeks before today's week, plus today. Every week ends up with meals whatever day the suite runs.
async function seed(page) {
  await page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('countmakan', 1);
    r.onsuccess = () => {
      const t = r.result.transaction('entries', 'readwrite');
      for (let k = 0; k < 30; k++) {
        const d = new Date(); d.setDate(d.getDate() - k);
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        t.objectStore('entries').put({ id: `h${k}`, day, ts: d.toISOString(), source: 'text', items: [{ name: `Meal ${k}`, grams: 300, kcal: k % 14 < 7 ? 1800 : 900, protein: 60, carbs: 200, fat: 60, confidence: 0.9 }] });
      }
      t.oncomplete = res;
    };
  }));
}

test('history groups days by week, folds older weeks and fills them on open', async ({ page }) => {
  await seedKeys(page);
  await open(page);
  await seed(page);
  await page.reload();
  await page.waitForSelector('body[data-ready]', { state: 'attached' });
  await page.locator('nav button[data-tab=history]').click();
  const weeks = page.locator('#history details.week');
  expect(await weeks.count()).toBeGreaterThanOrEqual(4);
  await expect(weeks.first().locator('.week-status')).toHaveText('So far');
  await expect(weeks.first()).toHaveJSProperty('open', true);
  await expect(weeks.nth(1)).toHaveJSProperty('open', true);
  const old = weeks.nth(3);
  await expect(old).toHaveJSProperty('open', false);
  await expect(old.locator('.card')).toHaveCount(0);
  await old.locator('summary').click();
  await expect(old.locator('.card').first()).toBeVisible();
  await expect(old.locator('.entry').first()).toBeVisible();
  await expect(page.locator('#history')).not.toContainText(/\b(null|undefined|NaN)\b/);
});
