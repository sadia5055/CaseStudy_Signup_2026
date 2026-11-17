import type { Lang } from '../i18n';
import type { SignupUser } from '../data/user';

/** Canadian numbers: the form sends E.164 (`+1XXXXXXXXXX`) whatever formatting was typed. */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
}

/**
 * Names of the fields whose values differ. Assertions use this instead of `toMatchObject`, whose failure
 * output prints both objects, which would put the generated email into logs and reports.
 */
export function mismatchedFields(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): string[] {
  return Object.keys(expected).filter((key) => actual[key] !== expected[key]);
}

/** Hop 1: what the browser must send for this user (subset; tracking fields are ignored). */
export function expectedRequest(user: SignupUser, lang: Lang) {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: toE164(user.phone),
    region: user.province,
    language: lang,
    leadDistributeConsentAgreement: user.consent,
  };
}

/** Hop 2: what the backend must report back for the same user. */
export function expectedAccount(user: SignupUser, lang: Lang) {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: toE164(user.phone),
    region: user.province,
    preferredLanguage: lang,
    leadDistributeConsentAgreement: user.consent,
  };
}
