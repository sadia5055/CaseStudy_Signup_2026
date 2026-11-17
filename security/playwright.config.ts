import { defineConfig, devices } from '@playwright/test';
import type { TestOptions } from '../src/fixtures';
// Importing the production config applies its settings (including PLAYWRIGHT_NO_COPY_PROMPT) and lets this
// config reuse them, so the security test cannot drift from what the real suite does.
import production from '../playwright.config';

const outDir = process.env.CANARY_OUT ?? 'security/.out';
const port = Number(process.env.FAKE_PORT ?? 4783);

export default defineConfig<TestOptions>({
  ...production,
  testDir: '.',
  testMatch: process.env.CANARY_SPEC ?? 'canary.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000, toPass: { timeout: 4_000 } },
  // The same reporters the CI run uses, so the same kinds of output are produced and scanned.
  reporter: [
    ['list'],
    ['github'],
    ['json', { outputFile: `${outDir}/results.json` }],
    ['html', { outputFolder: `${outDir}/report`, open: 'never' }],
  ],
  outputDir: `${outDir}/test-results`,
  use: { ...production.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: 'node fake-signup-server.mjs',
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
  projects: [{ name: 'en', use: { ...devices['Desktop Chrome'], lang: 'en', locale: 'en-CA' } }],
});
