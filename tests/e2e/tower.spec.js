import { test, expect } from '@playwright/test';
import { seedKeys, open } from './helpers.js';

// `floors` on-target days ending yesterday, cycling materials, with a missed day every seventh.
async function seed(page, floors) {
  await page.evaluate((floors) => new Promise((res) => {
    const r = indexedDB.open('countmakan', 1);
    r.onsuccess = () => {
      const t = r.result.transaction('entries', 'readwrite');
      const mix = [[60, 225, 60], [60, 150, 90], [40, 225, 90], [40, 150, 60]];
      let built = 0;
      for (let k = 0; built < floors; k++) {
        const d = new Date(); d.setDate(d.getDate() - 1 - k);
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const miss = k % 7 === 6;
        const [protein, carbs, fat] = miss ? [10, 20, 10] : mix[built % mix.length];
        if (!miss) built++;
        t.objectStore('entries').put({ id: `s${k}`, day, ts: d.toISOString(), source: 'text', items: [{ name: 'Meal', grams: 300, kcal: miss ? 500 : 1800, protein, carbs, fat, confidence: 0.9 }] });
      }
      t.oncomplete = res;
    };
  }), floors);
}

for (const floors of [3, 14, 45, 120]) {
  test(`tower: ${floors} floors`, async ({ page }) => {
    await seedKeys(page);
    await open(page);
    await seed(page, floors);
    await page.reload();
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    await expect(page.locator('#tower svg')).toBeVisible();
    await expect(page.locator('#tower')).toContainText(`${floors} floors`);
    await expect(page.locator('#tower')).not.toContainText(/\b(null|undefined|NaN)\b/);
    await page.locator('nav').evaluate((n) => { n.style.display = 'none'; });
    await page.locator('#tower').screenshot({ path: process.env.TOWER_SHOTS ? `${process.env.TOWER_SHOTS}/${floors}-days.png` : undefined });
  });
}
