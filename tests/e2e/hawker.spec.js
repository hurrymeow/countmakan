import { test, expect } from '@playwright/test';
import { seedKeys, open } from './helpers.js';

// Meals of one name, spread over `days` consecutive days ending yesterday.
async function seed(page, plan) {
  await page.evaluate((plan) => new Promise((res) => {
    const r = indexedDB.open('countmakan', 1);
    r.onsuccess = () => {
      const t = r.result.transaction('entries', 'readwrite');
      let n = 0;
      for (const [name, count, days] of plan) {
        for (let i = 0; i < count; i++) {
          const d = new Date(); d.setDate(d.getDate() - 1 - (i % days));
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          t.objectStore('entries').put({ id: `s${n++}`, day, ts: d.toISOString(), source: 'text', items: [{ name, grams: 200, kcal: 450, protein: 15, carbs: 60, fat: 12, confidence: 0.9 }] });
        }
      }
      t.oncomplete = res;
    };
  }), plan);
}

const STAGES = {
  'first-cart': [['Nasi lemak', 1, 1]],
  'growing': [['Nasi lemak', 6, 5], ['Laksa', 2, 2]],
  'busy-centre': [['Nasi lemak', 16, 15], ['Laksa', 6, 6], ['Kopi', 2, 2]],
  'grand': [['Nasi lemak', 42, 20], ['Laksa', 16, 16], ['Kopi', 7, 7], ['Chendol', 5, 5]],
};

for (const [name, plan] of Object.entries(STAGES)) {
  test(`hawker centre: ${name}`, async ({ page }) => {
    await seedKeys(page);
    await open(page);
    await seed(page, plan);
    await page.reload();
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    await expect(page.locator('#hawker svg')).toBeVisible();
    await expect(page.locator('#hawker')).not.toContainText(/\b(null|undefined|NaN)\b/);
    await page.locator('nav').evaluate((n) => { n.style.display = 'none'; });
    await page.locator('#hawker').screenshot({ path: process.env.HAWKER_SHOTS ? `${process.env.HAWKER_SHOTS}/${name}.png` : undefined });
  });
}
