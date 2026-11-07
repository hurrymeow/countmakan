import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// The cloud sandbox ships Chromium here. Elsewhere, Playwright's own browser is used.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const PORT = 4173;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 30000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 390, height: 844 },
    // The tower loop would race the fake clock some specs install. Specs that test motion opt back in.
    reducedMotion: 'reduce',
    launchOptions: existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {},
  },
  webServer: {
    command: `node serve.mjs`,
    cwd: import.meta.dirname,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
  },
});
