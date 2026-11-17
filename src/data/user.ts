import { randomBytes } from 'node:crypto';
import { env } from '../config/env';

export type ProvinceCode = 'ON' | 'QC' | 'AB' | 'BC';

/** What a person types into the signup form. Phone is as typed, not normalised. */
export interface SignupUser {
  firstName: string;
  lastName: string;
  phone: string;
  province: ProvinceCode;
  email: string;
  password: string;
  passwordConfirmation: string;
  consent: boolean;
}

// One id per test run, so addresses from different runs and workers never collide.
const runId = Date.now().toString(36);

/** Unique disposable address: qa.auto.<run>.<worker>.<random>@<domain> */
export function uniqueEmail(workerIndex: number, domain: string = env.emailDomain): string {
  return `qa.auto.${runId}.${workerIndex}.${randomBytes(3).toString('hex')}@${domain}`;
}

/**
 * A valid user with unique data. The password is random per user (20 characters, meets the
 * 12–32 / upper / lower / digit rule), so no credential is stored in the repository.
 */
export function buildUser(workerIndex: number, overrides: Partial<SignupUser> = {}): SignupUser {
  const password = overrides.password ?? `Qa1-${randomBytes(8).toString('hex')}`;
  return {
    firstName: 'Quality',
    lastName: 'Tester',
    phone: '5145550123',
    province: 'ON',
    email: uniqueEmail(workerIndex),
    consent: false,
    ...overrides,
    password,
    passwordConfirmation: overrides.passwordConfirmation ?? password,
  };
}
