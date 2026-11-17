import { test as base, expect } from '@playwright/test';
import { stubGeolocation } from '../api/geolocation';
import { buildUser, type SignupUser } from '../data/user';
import { copies, type Copy, type Lang } from '../i18n';
import { SignupPage } from '../pages/signup.page';

export interface TestOptions {
  /** Set per Playwright project (see playwright.config.ts); never branch on it inside specs. */
  lang: Lang;
}

interface Fixtures {
  copy: Copy;
  /** Signup page for the project language, already loaded and interactive. */
  signupPage: SignupPage;
  /** Valid, unique user; override only what the test is about. */
  newUser: (overrides?: Partial<SignupUser>) => SignupUser;
}

export const test = base.extend<TestOptions & Fixtures>({
  lang: ['en', { option: true }],
  copy: async ({ lang }, use) => {
    await use(copies[lang]);
  },
  signupPage: async ({ page, copy }, use) => {
    // Pin the visitor's location (Ontario) so the page starts the same way on every machine.
    await stubGeolocation(page);
    const signupPage = new SignupPage(page, copy);
    await signupPage.goto();
    await use(signupPage);
  },
  // Playwright requires the first argument to be a destructuring pattern, even when empty.
  // eslint-disable-next-line no-empty-pattern
  newUser: async ({}, use, testInfo) => {
    await use((overrides) => buildUser(testInfo.workerIndex, overrides));
  },
});

export { expect };
