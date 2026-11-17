import { expect, test, type Locator, type Page } from '@playwright/test';
import { GEOLOCATION_PATH } from '../api/geolocation';
import type { SignupUser } from '../data/user';
import type { Copy } from '../i18n';

const digitsOnly = (value: string) => value.replace(/\D/g, '');

/**
 * Sets an input's value from inside the page. Playwright renders the argument of `fill`, `type` and the
 * keyboard methods into report step titles (`Fill "<value>"`), whereas `evaluate` shows only "Evaluate".
 * Used for the account email and passwords, so they never reach a report (docs/07-security-remediation.md).
 * It fires the events a browser fires for typed text (beforeinput, input, change); the caller adds a real click
 * before and a real Tab after, so focus, blur and the browser's own change handling also happen.
 */
function setInputValue(element: HTMLElement, value: string): void {
  const input = element as HTMLInputElement;
  input.focus();
  input.dispatchEvent(
    new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }),
  );
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

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
    readonly page: Page,
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

  /** Pixels by which the page is wider than the viewport; 0 means no horizontal scrolling. */
  async horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  /** Every control a user must reach to complete the form. */
  get controls(): Locator[] {
    return [
      this.firstName,
      this.lastName,
      this.phone,
      this.province,
      this.email,
      this.password,
      this.passwordConfirmation,
      this.consent,
      this.submit,
    ];
  }

  /**
   * Waits until the page is on `path`. A failure prints the path only: `toHaveURL` would print the full URL,
   * and after signup the app passes through an OAuth login whose URLs carry `code`, `state` and client ids.
   */
  async expectToLandOn(path: string, timeout?: number): Promise<void> {
    await expect
      .poll(() => new URL(this.page.url()).pathname, { message: `the page did not land on ${path}`, timeout })
      .toBe(path);
  }

  /**
   * Switches to the other language. Wide screens show a header link; narrow screens hide it behind
   * the hamburger menu, where it is a "Language" picker. The branch follows what is visible, not
   * the device name, so it also holds for tablets and resized windows.
   */
  async switchLanguage(): Promise<void> {
    const burger = this.page.getByTestId('open-burger-menu');
    const headerLink = this.page.getByRole('link', { name: this.copy.languageToggle, exact: true });
    await expect(burger.or(headerLink)).toBeVisible();
    if (await burger.isVisible()) {
      await burger.click();
      await this.page.getByRole('button', { name: 'Menu', exact: true }).click();
      await this.page.getByRole('menuitemradio', { name: this.copy.otherLanguageName, exact: true }).click();
    } else {
      await headerLink.click();
    }
  }

  async goto(): Promise<void> {
    // The form is still re-initialised after hydration, once the geolocation lookup answers. Values
    // typed before that are wiped, which looks like a validation bug but is a timing issue
    // (docs/04-decisions.md, D11). Listen before navigating so the response cannot be missed.
    const geolocation = this.page.waitForResponse((res) => new URL(res.url()).pathname === GEOLOCATION_PATH);
    await this.page.goto(this.copy.path);
    await geolocation;
    await this.waitUntilInteractive();
  }

  /** Next.js has no "ready" event; wait for React to own the root so input handlers are attached. */
  private async waitUntilInteractive(): Promise<void> {
    await this.page.waitForFunction(() => {
      const root = document.getElementById('__next');
      if (root === null || !Object.keys(root).some((key) => key.startsWith('__reactContainer'))) return false;
      // Hydration is not finished while the inputs still share one generated id ("field-1" on all
      // of them). That state is visible when the geolocation answer arrives before React is done,
      // as it does with a stubbed response (35% of WebKit loads); real latency hides it.
      const ids = [...document.querySelectorAll('form input')].map((input) => input.id).filter(Boolean);
      return ids.length > 0 && new Set(ids).size === ids.length;
    });
  }

  /**
   * Retries `enter` until the field still holds `value` (the form can reset after load, see D11).
   * The comparison is reduced to a boolean first, so a failure message never contains the value.
   */
  private async enterUntilKept(
    label: string,
    field: Locator,
    value: string,
    enter: () => Promise<void>,
    normalise: (v: string) => string = (v) => v,
  ) {
    await expect(async () => {
      await enter();
      const kept = normalise(await field.inputValue()) === normalise(value);
      expect(kept, `${label} did not keep the value that was entered`).toBe(true);
    }).toPass();
  }

  /** Types a non-sensitive value (fixed test data). No fixed sleeps. */
  private async fill(label: string, field: Locator, value: string, normalise?: (v: string) => string) {
    await this.enterUntilKept(label, field, value, () => field.fill(value), normalise);
  }

  /** Enters a sensitive value (the generated email or a password) without recording it in the report. */
  private async fillSecret(label: string, field: Locator, value: string) {
    await test.step(`Enter ${label} (value not recorded)`, async () => {
      await this.enterUntilKept(label, field, value, async () => {
        await field.click(); // real pointer and focus events
        await field.evaluate(setInputValue, value);
        await field.press('Tab'); // real blur, as a user moving on
      });
    });
  }

  async fillForm(user: SignupUser): Promise<void> {
    await this.fill('first name', this.firstName, user.firstName);
    await this.fill('last name', this.lastName, user.lastName);
    await this.fill('phone', this.phone, user.phone, digitsOnly); // the phone input reformats what is typed
    await this.province.selectOption(user.province);
    await this.fillSecret('email', this.email, user.email);
    await this.fillSecret('password', this.password, user.password);
    await this.fillSecret('password confirmation', this.passwordConfirmation, user.passwordConfirmation);
    await this.consent.setChecked(user.consent);
  }
}
