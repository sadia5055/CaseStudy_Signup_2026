import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import type { TestOptions } from './src/fixtures';

const isCI = Boolean(process.env.CI);

export default defineConfig<TestOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  // 0 locally so flakiness is visible; 1 in CI so a network blip is reported as "flaky", not hidden.
  retries: isCI ? 1 : 0,
  // QA is a shared environment: keep the number of simultaneous signups modest.
  workers: isCI ? 2 : 4,
  timeout: 45_000,
  // toPass() (used to fill fields that may be reset) has no timeout by default; bound it.
  expect: { timeout: 10_000, toPass: { timeout: 10_000 } },
  reporter: isCI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseURL,
    screenshot: 'only-on-failure',
    // Traces and videos are off on purpose: they embed request/response bodies, and the signup
    // response carries an access token. Failures attach a redacted exchange instead (src/api/accounts.ts).
    trace: 'off',
    video: 'off',
  },
  // Language is a project, not a branch in the specs: `--project=fr` runs French only.
  projects: [
    { name: 'en', use: { ...devices['Desktop Chrome'], lang: 'en', locale: 'en-CA' } },
    { name: 'fr', use: { ...devices['Desktop Chrome'], lang: 'fr', locale: 'fr-CA' } },
  ],
});
