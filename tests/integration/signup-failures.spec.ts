import type { Route } from '@playwright/test';
import { ACCOUNTS_PATH, captureCreation } from '../../src/api/accounts';
import { diagnosticExchange } from '../../src/api/diagnostics';
import { uniqueEmail } from '../../src/data/user';
import { expect, test } from '../../src/fixtures';

// When signup fails, the user must be told and must not be sent on to the next step.
test.describe('signup: backend failures', () => {
  test('I-01a shows an error when the backend really rejects the email (422)', async ({
    signupPage: p,
    newUser,
    page,
    copy,
  }) => {
    // Not a mock: the QA backend rejects placeholder domains such as example.com (docs/01-discovery.md).
    const user = newUser({ email: uniqueEmail(test.info().workerIndex, 'example.com') });

    await p.fillForm(user);
    const exchange = await captureCreation(page, () => p.submit.click());

    expect(exchange.status).toBe(422);
    expect(diagnosticExchange(exchange).response.error).toBe('invalid parameters');
    await expect(p.backendError).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${copy.path}$`));
  });

  // Failures that cannot be triggered on demand are simulated. Only failures are ever simulated:
  // the success path in signup-create.spec.ts always hits the real backend.
  const simulated: { id: string; title: string; respond: (route: Route) => Promise<void> }[] = [
    {
      id: 'I-01b',
      title: 'server error (500)',
      respond: (route) => route.fulfill({ status: 500, json: { error: 'internal error' } }),
    },
    { id: 'I-01c', title: 'network failure', respond: (route) => route.abort('failed') },
  ];

  for (const failure of simulated) {
    test(`${failure.id} shows an error on ${failure.title} and stays on the form`, async ({
      signupPage: p,
      newUser,
      page,
      copy,
    }) => {
      await page.route(
        (url) => url.pathname === ACCOUNTS_PATH,
        (route) => (route.request().method() === 'POST' ? failure.respond(route) : route.fallback()),
      );

      await p.fillForm(newUser());
      await p.submit.click();

      await expect(p.backendError).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${copy.path}$`));
    });
  }
});
