import { test, expect } from '@playwright/test';
import { seedKeys, open } from './helpers.js';

// `floors` past days ending yesterday. Every seventh is a messy day (500 kcal), the rest are on target.
async function seed(page, floors) {
  await page.evaluate((floors) => new Promise((res) => {
    const r = indexedDB.open('countmakan', 1);
    r.onsuccess = () => {
      const t = r.result.transaction('entries', 'readwrite');
      const mix = [[60, 225, 60], [100, 100, 40], [40, 225, 90], [40, 150, 60]];
      for (let k = 0; k < floors; k++) {
        const d = new Date(); d.setDate(d.getDate() - 1 - k);
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const miss = k % 7 === 6;
        const [protein, carbs, fat] = miss ? [10, 20, 10] : mix[k % mix.length];
        for (let n = 0; n < 1 + (k % 3); n++) {
          t.objectStore('entries').put({ id: `s${k}-${n}`, day, ts: d.toISOString(), source: 'text', items: [{ name: 'Meal', grams: 300, kcal: (miss ? 500 : 1800) / (1 + (k % 3)), protein: protein / (1 + (k % 3)), carbs: carbs / (1 + (k % 3)), fat: fat / (1 + (k % 3)), confidence: 0.9 }] });
        }
      }
      if (floors) {
        const d = new Date();
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        t.objectStore('entries').put({ id: 'today', day, ts: d.toISOString(), source: 'text', items: [{ name: 'Meal', grams: 300, kcal: 1120, protein: 38, carbs: 140, fat: 40, confidence: 0.9 }] });
      }
      t.oncomplete = res;
    };
  }), floors);
}

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const floors of [0, 3, 45, 120]) {
  test(`tower: ${floors} floors on Today`, async ({ page }) => {
    await seedKeys(page);
    await open(page);
    await seed(page, floors);
    await page.reload();
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    const scene = page.locator('#summary .scene');
    await expect(scene).toBeVisible();
    await expect(scene).toHaveAttribute('aria-label', new RegExp(`^${floors} floors?, .*Open tower$`));
    await expect(page.locator('#summary')).not.toContainText(/\b(null|undefined|NaN)\b/);
    await expect(page.locator('#tower')).toHaveCount(0);
    await expect(page.locator('#summary .floor').first()).toBeVisible();
    const ring = await page.locator('#summary .ring-wrap').boundingBox();
    const tower = await page.locator('#summary .scene-tower').boundingBox();
    expect(overlaps(ring, tower)).toBe(false);
    const pill = page.locator('#summary .hero-status');
    if (await pill.count()) expect(overlaps(await pill.boundingBox(), tower)).toBe(false);
    if (process.env.TOWER_SHOTS) await page.screenshot({ path: `${process.env.TOWER_SHOTS}/today-${floors}.png`, fullPage: true });
  });
}

test('tower: tap-in view opens at the top, closes with Escape and Back', async ({ page }) => {
  await seedKeys(page);
  await open(page);
  await seed(page, 45);
  await page.reload();
  await page.waitForSelector('body[data-ready]', { state: 'attached' });
  const view = page.locator('.tower-view');
  await page.locator('#summary .scene').click();
  await expect(view).toBeVisible();
  await expect(view.locator('.tower-sub')).toContainText('45 floors');
  await expect(view.locator('.floor:not(.tonight)')).toHaveCount(45);
  await expect(view.locator('.tower-scroll')).toHaveJSProperty('scrollTop', 0);
  if (process.env.TOWER_SHOTS) await page.screenshot({ path: `${process.env.TOWER_SHOTS}/view-top.png` });
  await view.locator('.tower-scroll').evaluate((n) => { n.scrollTop = n.scrollHeight; });
  if (process.env.TOWER_SHOTS) await page.screenshot({ path: `${process.env.TOWER_SHOTS}/view-ground.png` });
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();
  await page.locator('#summary .scene').click();
  await expect(view).toBeVisible();
  await page.goBack();
  await expect(view).toBeHidden();
  await page.locator('#summary .scene').click();
  await view.getByRole('button', { name: 'Close tower' }).click();
  await expect(view).toBeHidden();
});

test('tower: sprites load and the empty tap-in view invites a first meal', async ({ page }) => {
  const broken = [];
  page.on('response', (r) => { if (r.url().includes('/img/') && r.status() >= 400) broken.push(r.url()); });
  await seedKeys(page);
  await open(page);
  await seed(page, 3);
  await page.reload();
  await page.waitForSelector('body[data-ready]', { state: 'attached' });
  await expect(page.locator('#summary .floor img').first()).toBeVisible();
  expect(await page.locator('#summary .floor img').first().evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(broken).toEqual([]);
});

test('tower: empty tap-in view says how to start', async ({ page }) => {
  await seedKeys(page);
  await open(page);
  await page.locator('#summary .scene').click();
  await expect(page.locator('.tower-view .tower-empty')).toContainText('Log a meal to start building your tower');
});
