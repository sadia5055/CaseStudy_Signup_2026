import { captureCreation } from '../../src/api/accounts';
import { CreationResponse } from '../../src/api/account.schema';
import { expectedAccount, expectedRequest } from '../../src/api/expected';
import { passwordKeyPaths } from '../../src/api/redact';
import { env } from '../../src/config/env';
import { expect, test } from '../../src/fixtures';
import { SignupPage } from '../../src/pages/signup.page';

const AUTH_REDIRECT_TIMEOUT_MS = 30_000;

// These tests create real accounts in the QA environment (allowed by the assessment). Each uses its
// own unique address, so they are independent and safe to run in parallel.
test.describe('signup: account creation', () => {
  test('P-01 creates an account and the API returns what was entered', async ({
    signupPage: p,
    newUser,
    page,
    lang,
    copy,
  }) => {
    const user = newUser({ consent: true });

    await p.fillForm(user);
    const exchange = await captureCreation(page, () => p.submit.click());

    expect(exchange.status).toBe(201);
    // Hop 1: form -> request payload.
    expect(exchange.request).toMatchObject(expectedRequest(user, lang));
    // Hop 2: contract, then request values -> response body.
    const { account } = CreationResponse.parse(exchange.body);
    expect(account).toMatchObject(expectedAccount(user, lang));
    // The password must not come back, under any key.
    expect(passwordKeyPaths(exchange.body)).toEqual([]);

    // After the 201 the app signs the user in through Auth0 (a cross-origin round trip to
    // auth.qa.nesto.ca) before landing on the quote page. That hop took over 10 s on CI runners.
    await expect(page).toHaveURL(new RegExp(`${copy.redirectPath}$`), { timeout: AUTH_REDIRECT_TIMEOUT_MS });
  });

  test('P-02 keeps accents, normalises the phone, and records declined consent', async ({
    signupPage: p,
    newUser,
    page,
    lang,
  }) => {
    const user = newUser({
      firstName: 'Éloïse',
      lastName: 'Gagné-Côté',
      phone: '(514) 555-0123',
      province: 'QC',
      consent: false,
    });

    await p.fillForm(user);
    const exchange = await captureCreation(page, () => p.submit.click());

    expect(exchange.status).toBe(201);
    expect(exchange.request).toMatchObject(expectedRequest(user, lang));
    const { account } = CreationResponse.parse(exchange.body);
    expect(account).toMatchObject(expectedAccount(user, lang));
    expect(account.phone).toBe('+15145550123');
    expect(account.leadDistributeConsentAgreement).toBe(false);
  });

  test('I-02 rejects a second signup with the same email', async ({
    signupPage: p,
    newUser,
    page,
    browser,
    copy,
  }) => {
    const user = newUser();
    await p.fillForm(user);
    const first = await captureCreation(page, () => p.submit.click());
    expect(first.status).toBe(201);

    // Fresh browser context: the first signup logged this one in, and a logged-in session may not
    // show the signup form.
    const context = await browser.newContext({ baseURL: env.baseURL });
    try {
      const second = new SignupPage(await context.newPage(), copy);
      await second.goto();
      await second.fillForm(user);
      const duplicate = await captureCreation(second.page, () => second.submit.click());

      // Current behaviour is 400 "bad format"; whether that is intended is an open question
      // (docs/01-discovery.md, #1), so only "client error, not created" is asserted.
      expect(duplicate.status).toBeGreaterThanOrEqual(400);
      expect(duplicate.status).toBeLessThan(500);
      await expect(second.backendError).toBeVisible();
      await expect(second.page).toHaveURL(new RegExp(`${copy.path}$`));
    } finally {
      await context.close();
    }
  });
});
