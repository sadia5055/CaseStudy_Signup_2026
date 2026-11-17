import { expect, test } from '../src/fixtures';

// NEGATIVE CONTROL. These scenarios leak on purpose, using the patterns the audit found (a plain fill,
// toMatchObject on an object holding the email, a raw attachment). `npm run test:security` runs them and
// requires the scanner to FIND the canaries; if it finds nothing, the scanner itself is broken and the
// security test fails. Never include this file in the real suite.

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run this through "npm run test:security"`);
  return value;
};
const email = need('CANARY_EMAIL');
const password = need('CANARY_PASSWORD');
const token = need('CANARY_TOKEN');

test.describe('leaky patterns', () => {
  test.use({ extraHTTPHeaders: { 'x-fake-mode': 'ok' } });

  test('L1 passes: plain fill puts the values into step titles', async ({ signupPage: p }) => {
    await p.email.fill(email);
    await p.password.fill(password);
    await p.passwordConfirmation.fill(password);
  });

  test('L2 fails (on purpose): toMatchObject prints the email', () => {
    expect({ email, region: 'ON' }).toMatchObject({ email, region: 'XX' });
  });

  // Playwright requires the first argument to be a destructuring pattern, even when empty.
  // eslint-disable-next-line no-empty-pattern
  test('L3 passes: raw attachment holds the email and token', async ({}, testInfo) => {
    await testInfo.attach('exchange-raw.json', {
      body: JSON.stringify({ email, token }),
      contentType: 'application/json',
    });
  });
});
