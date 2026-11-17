import { captureCreation } from '../src/api/accounts';
import { CreationResponse } from '../src/api/account.schema';
import { diagnosticExchange } from '../src/api/diagnostics';
import { expectedAccount, mismatchedFields } from '../src/api/expected';
import { expect, test } from '../src/fixtures';

// Security regression test. These scenarios push synthetic canary credentials through the REAL fixtures, page
// object and helpers, both when tests pass and when they fail. `npm run test:security` then scans every
// output for the canaries and fails if any is found. Three scenarios fail ON PURPOSE (C2, C3, C4): the point
// is to prove that failing output is clean, so the orchestrator expects exactly those outcomes.

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run this through "npm run test:security"`);
  return value;
};
const email = need('CANARY_EMAIL');
const password = need('CANARY_PASSWORD');

test.describe('a successful signup', () => {
  test.use({ extraHTTPHeaders: { 'x-fake-mode': 'ok' } });

  test('C1 passes: signup with canary credentials', async ({ signupPage: p, newUser, page, lang }) => {
    const user = newUser({ email, password, consent: true });
    await p.fillForm(user);
    const exchange = await captureCreation(page, () => p.submit.click());

    expect(exchange.status).toBe(201);
    const { account } = CreationResponse.parse(exchange.body);
    expect(mismatchedFields(account, expectedAccount(user, lang)), 'response fields that differ').toEqual([]);
  });

  test('C2 fails (on purpose): assertion mismatch after a real signup', async ({
    signupPage: p,
    newUser,
    page,
    lang,
  }) => {
    const user = newUser({ email, password });
    await p.fillForm(user);
    const exchange = await captureCreation(page, () => p.submit.click());
    const { account } = CreationResponse.parse(exchange.body);

    const wrong = { ...expectedAccount(user, lang), region: 'XX' };
    expect(mismatchedFields(account, wrong), 'response fields that differ from the form').toEqual([]);
  });
});

test.describe('a form that does not keep what is typed', () => {
  test.use({ extraHTTPHeaders: { 'x-fake-mode': 'sticky-clear' } });

  test('C3 fails (on purpose): the field never keeps the entered value', async ({
    signupPage: p,
    newUser,
  }) => {
    await p.fillForm(newUser({ email, password }));
  });
});

test.describe('a response that breaks the contract', () => {
  test.use({ extraHTTPHeaders: { 'x-fake-mode': 'bad-schema' } });

  test('C4 fails (on purpose): contract violation with canary values in the body', async ({
    signupPage: p,
    newUser,
    page,
  }) => {
    await p.fillForm(newUser({ email, password }));
    const exchange = await captureCreation(page, () => p.submit.click());
    CreationResponse.parse(exchange.body);
  });
});

test.describe('a redirect whose URL carries an auth code', () => {
  test.use({ extraHTTPHeaders: { 'x-fake-mode': 'redirect-code' } });

  test('C6 fails (on purpose): redirect assertion on a URL with a code in its query', async ({
    signupPage: p,
    newUser,
    page,
  }) => {
    await p.fillForm(newUser({ email, password }));
    await captureCreation(page, () => p.submit.click());
    await p.expectToLandOn('/somewhere-else', 4_000);
  });
});

test.describe('a backend rejection that echoes the email', () => {
  test.use({ extraHTTPHeaders: { 'x-fake-mode': 'echo-422' } });

  test('C5 passes: rejection body containing the canary email', async ({ signupPage: p, newUser, page }) => {
    await p.fillForm(newUser({ email, password }));
    const exchange = await captureCreation(page, () => p.submit.click());

    expect(exchange.status).toBe(422);
    expect(diagnosticExchange(exchange).response.error).toBe('invalid parameters');
  });
});
