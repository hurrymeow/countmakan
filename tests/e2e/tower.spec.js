import { test, expect } from '@playwright/test';
import { seedKeys, open, mockModels, photoEstimate, geminiBody, NASI } from './helpers.js';

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

for (const floors of [0, 3, 25, 45, 65, 120]) {
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
    await expect(page.locator('#summary .scene-tower canvas')).toBeVisible();
    const ring = await page.locator('#summary .ring-wrap').boundingBox();
    const tower = await page.locator('#summary .scene-tower').boundingBox();
    expect(overlaps(ring, tower)).toBe(false);
    const pill = page.locator('#summary .hero-status');
    if (await pill.count()) expect(overlaps(await pill.boundingBox(), tower)).toBe(false);
    if (process.env.TOWER_SHOTS) await page.screenshot({ path: `${process.env.TOWER_SHOTS}/today-${floors}.png`, fullPage: true });
  });
}

test('tower: the spire clears the date and the ring at 65 floors', async ({ page }) => {
  await seedKeys(page);
  await open(page);
  await seed(page, 65);
  await page.reload();
  await page.waitForSelector('body[data-ready]', { state: 'attached' });
  const canvas = page.locator('#summary .scene-tower canvas');
  await expect(canvas).toHaveAttribute('data-roof-top', '45');
  const c = await canvas.boundingBox();
  // The spire is a thin column at the centre of the canvas, rising above the roof.
  const spire = { x: c.x + c.width / 2 - 12, y: c.y, width: 24, height: 80 };
  expect(overlaps(spire, await page.locator('#summary .scene-date').boundingBox())).toBe(false);
  expect(overlaps(spire, await page.locator('#summary .ring-wrap').boundingBox())).toBe(false);
  expect(await page.locator('#summary .scene-sky').count()).toBe(1);
  if (process.env.TOWER_SHOTS) await page.screenshot({ path: `${process.env.TOWER_SHOTS}/today-65-spire.png`, fullPage: true });
});

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
  await expect(view.locator('.tower-stack canvas')).toHaveAttribute('data-floors', '45');
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

test('tower: overview rail jumps to the lobby', async ({ page }) => {
  await seedKeys(page);
  await open(page);
  await seed(page, 45);
  await page.reload();
  await page.waitForSelector('body[data-ready]', { state: 'attached' });
  const view = page.locator('.tower-view');
  await page.locator('#summary .scene').click();
  const rail = view.locator('.tower-rail');
  await expect(rail).toBeVisible();
  if (process.env.TOWER_SHOTS) await page.screenshot({ path: `${process.env.TOWER_SHOTS}/rail-top.png` });
  const b = await rail.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height - 2);
  const gap = await view.locator('.tower-scroll').evaluate((n) => n.scrollHeight - n.clientHeight - n.scrollTop);
  expect(gap).toBeLessThan(40);
  if (process.env.TOWER_SHOTS) await page.screenshot({ path: `${process.env.TOWER_SHOTS}/rail-ground.png` });
});

test('tower: overview rail is hidden on a short tower', async ({ page }) => {
  await seedKeys(page);
  await open(page);
  await seed(page, 3);
  await page.reload();
  await page.waitForSelector('body[data-ready]', { state: 'attached' });
  await page.locator('#summary .scene').click();
  await expect(page.locator('.tower-view .tower-stack')).toBeVisible();
  await expect(page.locator('.tower-view .tower-rail')).toBeHidden();
});

test('tower: Today canvas draws pixels and ground shows for a short tower', async ({ page }) => {
  await seedKeys(page);
  await open(page);
  await seed(page, 3);
  await page.reload();
  await page.waitForSelector('body[data-ready]', { state: 'attached' });
  const canvas = page.locator('#summary .scene-tower canvas');
  await expect(canvas).toHaveAttribute('data-floors', '3');
  expect(await canvas.evaluate((c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v) => v > 0))).toBe(true);
});

test.describe('motion', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('tower: walkers move between frames when motion is allowed', async ({ page }) => {
    await seedKeys(page);
    await open(page);
    await seed(page, 3);
    await page.reload();
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    const canvas = page.locator('#summary .scene-tower canvas');
    const grab = () => canvas.evaluate((c) => c.toDataURL());
    const a = await grab();
    await expect.poll(grab, { timeout: 5000 }).not.toBe(a);
  });
});

test.describe('goal beat', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('tower: logging a meal that crosses the protein goal plays one beat, a reload shows none', async ({ page }) => {
    await seedKeys(page);
    await mockModels(page, { 'gemini-3.8-flash': { status: 200, body: geminiBody(NASI) } });
    await open(page);
    await seed(page, 5); // tonight starts at 38 g protein of 60
    await page.reload();
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    await expect(page.locator('.scene-fx')).toHaveCount(0);
    await photoEstimate(page);
    await page.getByRole('button', { name: 'Save meal' }).click();
    const fx = page.locator('#summary .scene-fx');
    await expect(fx).toHaveCount(1);
    await expect(fx).toHaveCSS('pointer-events', 'none');
    await expect(fx).toHaveCount(0, { timeout: 8000 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('countmakan.celebrated')).protein)).toBe(true);
    await page.reload();
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    await expect(page.locator('#summary .scene-tower canvas')).toBeVisible();
    await expect(page.locator('.scene-fx')).toHaveCount(0);
  });
});

test('tower: reduced motion draws no beat', async ({ page }) => {
  await seedKeys(page);
  await mockModels(page, { 'gemini-3.8-flash': { status: 200, body: geminiBody(NASI) } });
  await open(page);
  await seed(page, 5);
  await page.reload();
  await page.waitForSelector('body[data-ready]', { state: 'attached' });
  await photoEstimate(page);
  await page.getByRole('button', { name: 'Save meal' }).click();
  await expect(page.locator('#summary .scene-tower canvas')).toBeVisible();
  await expect(page.locator('.scene-fx')).toHaveCount(0);
});

test('tower: empty tap-in view says how to start', async ({ page }) => {
  await seedKeys(page);
  await open(page);
  await page.locator('#summary .scene').click();
  await expect(page.locator('.tower-view .tower-empty')).toContainText('Log a meal to start building your tower');
});
