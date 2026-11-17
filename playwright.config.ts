import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import type { TestOptions } from './src/fixtures';

// Playwright writes a snapshot of the page, including typed field values, into error-context.md when a test
// fails. This variable makes it skip the snapshot. It is not a documented option, so `npm run test:security`
// pins the behaviour and fails if a Playwright upgrade changes it (docs/07-security-remediation.md).
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

const isCI = Boolean(process.env.CI);

const languages = [
  { lang: 'en', locale: 'en-CA' },
  { lang: 'fr', locale: 'fr-CA' },
] as const;

// The signup page is customer-facing with a large share of mobile traffic, so phones and the
// Safari engine are first-class targets, not an afterthought.
const targets = [
  { suffix: '', device: 'Desktop Chrome' },
  { suffix: '-firefox', device: 'Desktop Firefox' },
  { suffix: '-webkit', device: 'Desktop Safari' },
  { suffix: '-android', device: 'Pixel 7' },
  { suffix: '-iphone', device: 'iPhone 14' },
] as const;

export default defineConfig<TestOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  // 0 locally so flakiness is visible; 1 in CI so a network blip is reported as "flaky", not hidden.
  retries: isCI ? 1 : 0,
  // QA is a shared environment: keep the number of simultaneous signups modest.
  workers: isCI ? 2 : 4,
  // Sign-up ends with a cross-origin Auth0 redirect that is slow on CI runners (P-01 waits up to 30 s).
  timeout: 60_000,
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
  // Project = language x device. Language is a project, not a branch in the specs, so
  // `--project="fr*"` runs French on every device and `--project=fr-iphone` runs one combination.
  // Plain `en` / `fr` are desktop Chrome.
  projects: targets.flatMap((target) =>
    languages.map(({ lang, locale }) => ({
      name: `${lang}${target.suffix}`,
      use: { ...devices[target.device], lang, locale },
    })),
  ),
});
