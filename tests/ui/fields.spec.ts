import { stubGeolocation, VIRGINIA_US } from '../../src/api/geolocation';
import { copies, otherLang } from '../../src/i18n';
import { SignupPage } from '../../src/pages/signup.page';
import { expect, test } from '../../src/fixtures';

test.describe('signup form: fields and labels', () => {
  test('F-01 shows every field under its localized label with the right control', async ({
    signupPage: p,
    copy,
    page,
  }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', copy.htmlLang);
    await expect(page).toHaveTitle(copy.title);
    await expect(page.getByRole('heading', { name: copy.heading })).toBeVisible();

    await expect(p.firstName).toHaveAttribute('type', 'text');
    await expect(p.lastName).toHaveAttribute('type', 'text');
    await expect(p.phone).toHaveAttribute('type', 'tel');
    await expect(p.province).toBeVisible();
    await expect(p.email).toBeVisible();
    await expect(p.password).toHaveAttribute('type', 'password');
    await expect(p.passwordConfirmation).toHaveAttribute('type', 'password');
    await expect(p.consent).toBeAttached();
    await expect(p.submit).toBeEnabled();
  });

  test('F-02 preselects the visitor’s province and leaves consent unchecked', async ({ signupPage: p }) => {
    // The fixture places the visitor in Ontario; the province default follows the location.
    await expect(p.phoneCountry).toHaveValue('CA');
    await expect(p.province).toHaveValue('ON');
    // A pre-checked marketing consent would be a compliance defect, so the default is asserted.
    await expect(p.consent).not.toBeChecked();
  });

  test('F-05 leaves the province unselected for a visitor outside Canada', async ({ page, copy }) => {
    // Seen in CI: a US runner got an empty province instead of Ontario.
    await stubGeolocation(page, VIRGINIA_US);
    const p = new SignupPage(page, copy);
    await p.goto();

    await expect(p.province).toHaveValue('');
    await expect(p.consent).not.toBeChecked();
  });

  test('F-03 states the password rule', async ({ signupPage: p, page, copy }) => {
    await expect(p.password).toBeVisible();
    await expect(page.getByText(copy.passwordHint)).toBeVisible();
  });

  test('F-04 switches to the other language', async ({ signupPage: p, page, lang }) => {
    await expect(p.submit).toBeVisible();
    const target = copies[otherLang(lang)];
    await p.switchLanguage();
    await expect(page).toHaveURL(new RegExp(`${target.path}$`));
    await expect(page.getByRole('heading', { name: target.heading })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', target.htmlLang);
  });
});
