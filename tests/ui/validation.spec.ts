import { trackCreationRequests } from '../../src/api/accounts';
import type { SignupUser } from '../../src/data/user';
import type { ErrorCopy } from '../../src/i18n';
import { expect, test } from '../../src/fixtures';

type FieldKey = 'firstName' | 'lastName' | 'phone' | 'email' | 'password' | 'passwordConfirmation';

interface Case {
  id: string;
  title: string;
  /** Overrides applied to an otherwise valid user. */
  user: Partial<SignupUser>;
  /** The complete set of fields that must be flagged, with the message each must show. */
  errors: Partial<Record<FieldKey, keyof ErrorCopy>>;
}

const tooLong = `Aa1${'x'.repeat(30)}`; // 33 characters
const blank = { firstName: '', lastName: '', phone: '', email: '', password: '' };

const cases: Case[] = [
  {
    id: 'N-01',
    title: 'empty form',
    user: blank,
    errors: {
      firstName: 'required',
      lastName: 'required',
      phone: 'invalidPhone',
      email: 'invalidEmail',
      password: 'passwordMin',
    },
  },
  {
    id: 'N-02a',
    title: 'name with digits',
    user: { firstName: '12345' },
    errors: { firstName: 'invalidName' },
  },
  {
    id: 'N-02b',
    title: 'whitespace-only name',
    user: { firstName: '   ' },
    errors: { firstName: 'required' },
  },
  ...['plainaddress', 'user@domain', 'user@@example.com'].map((email): Case => ({
    id: 'N-03',
    title: `malformed email "${email}"`,
    user: { email },
    errors: { email: 'invalidEmail' },
  })),
  ...['123', 'abcdefghij', '1234567890'].map((phone): Case => ({
    id: 'N-04',
    title: `invalid phone "${phone}"`,
    user: { phone },
    errors: { phone: 'invalidPhone' },
  })),
  {
    id: 'N-05a',
    title: 'password 11 characters',
    user: { password: 'Abcdefghi12' },
    errors: { password: 'passwordMin' },
  },
  {
    id: 'N-05b',
    title: 'password 33 characters',
    user: { password: tooLong },
    errors: { password: 'passwordMax' },
  },
  {
    id: 'N-05c',
    title: 'password without uppercase',
    user: { password: 'abcdefghij12' },
    errors: { password: 'passwordComposition' },
  },
  {
    id: 'N-05d',
    title: 'password without lowercase',
    user: { password: 'ABCDEFGHIJ12' },
    errors: { password: 'passwordComposition' },
  },
  {
    id: 'N-05e',
    title: 'password without digit',
    user: { password: 'Abcdefghijkl' },
    errors: { password: 'passwordComposition' },
  },
  {
    id: 'N-06a',
    title: 'confirmation differs',
    user: { password: 'Abcdefghij12', passwordConfirmation: 'Abcdefghij13' },
    errors: { passwordConfirmation: 'passwordMismatch' },
  },
  {
    id: 'N-06b',
    title: 'confirmation empty',
    user: { password: 'Abcdefghij12', passwordConfirmation: '' },
    errors: { passwordConfirmation: 'passwordMismatch' },
  },
];

test.describe('signup form: client-side validation', () => {
  for (const c of cases) {
    test(`${c.id} ${c.title}`, async ({ signupPage: p, newUser, page, copy }) => {
      const creationRequests = trackCreationRequests(page);

      await p.fillForm(newUser(c.user));
      await p.submit.click();

      const expected = Object.entries(c.errors) as [FieldKey, keyof ErrorCopy][];
      for (const [field, message] of expected) {
        await expect(p[field]).toHaveAttribute('aria-invalid', 'true');
        await expect(p[field]).toHaveAccessibleDescription(copy.errors[message]);
      }
      // Nothing else may be flagged: a rule that over-reaches is as wrong as one that is missing.
      await expect(p.invalidFields).toHaveCount(expected.length);
      // Client-side rejection means the browser never calls the backend.
      expect(creationRequests.count()).toBe(0);
    });
  }
});
