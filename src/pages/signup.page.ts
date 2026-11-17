import { expect, type Locator, type Page } from '@playwright/test';
import type { SignupUser } from '../data/user';
import type { Copy } from '../i18n';

const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** UI driver for the signup page. Knows the DOM; knows nothing about the API. */
export class SignupPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly phoneCountry: Locator;
  readonly phone: Locator;
  readonly province: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly passwordConfirmation: Locator;
  readonly consent: Locator;
  readonly submit: Locator;
  /** Fields currently flagged invalid (`aria-invalid="true"`). */
  readonly invalidFields: Locator;
  /** Generic toast shown when the backend rejects or fails the request. */
  readonly backendError: Locator;

  constructor(
    private readonly page: Page,
    readonly copy: Copy,
  ) {
    const byLabel = (text: string) => page.getByLabel(text, { exact: true });
    this.firstName = byLabel(copy.labels.firstName);
    this.lastName = byLabel(copy.labels.lastName);
    this.phoneCountry = page.locator('select[name="phoneCountry"]');
    this.phone = byLabel(copy.labels.phone);
    this.province = byLabel(copy.labels.province);
    this.email = byLabel(copy.labels.email);
    this.password = byLabel(copy.labels.password);
    this.passwordConfirmation = byLabel(copy.labels.passwordConfirmation);
    this.consent = page.getByRole('checkbox', { name: copy.consentStart });
    this.submit = page.getByRole('button', { name: copy.submit });
    this.invalidFields = page.locator('form [aria-invalid="true"]');
    this.backendError = page.getByText(copy.backendError).first();
  }

  async goto(): Promise<void> {
    // The form is still re-initialised after hydration, once the geolocation lookup answers. Values
    // typed before that are wiped, which looks like a validation bug but is a timing issue
    // (docs/04-decisions.md, D11). Listen before navigating so the response cannot be missed.
    const geolocation = this.page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/geolocation/all',
    );
    await this.page.goto(this.copy.path);
    await geolocation;
    await this.waitUntilInteractive();
  }

  /** Next.js has no "ready" event; wait for React to own the root so input handlers are attached. */
  private async waitUntilInteractive(): Promise<void> {
    await this.page.waitForFunction(() => {
      const root = document.getElementById('__next');
      return root !== null && Object.keys(root).some((key) => key.startsWith('__reactContainer'));
    });
  }

  /** Fills a field and retries until the value is still there, then moves on. No fixed sleeps. */
  private async fill(field: Locator, value: string, normalise: (v: string) => string = (v) => v) {
    await expect(async () => {
      await field.fill(value);
      expect(normalise(await field.inputValue())).toBe(normalise(value));
    }).toPass();
  }

  async fillForm(user: SignupUser): Promise<void> {
    await this.fill(this.firstName, user.firstName);
    await this.fill(this.lastName, user.lastName);
    await this.fill(this.phone, user.phone, digitsOnly); // the phone input reformats what is typed
    await this.province.selectOption(user.province);
    await this.fill(this.email, user.email);
    await this.fill(this.password, user.password);
    await this.fill(this.passwordConfirmation, user.passwordConfirmation);
    await this.consent.setChecked(user.consent);
  }
}
