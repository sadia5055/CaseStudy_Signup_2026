export type Lang = 'en' | 'fr';

/** Validation messages shown under a field. */
export interface ErrorCopy {
  required: string;
  invalidName: string;
  invalidEmail: string;
  invalidPhone: string;
  passwordMin: string;
  passwordMax: string;
  passwordComposition: string;
  passwordMismatch: string;
}

/**
 * Every user-visible string the tests assert on, for one language.
 * Both languages implement this one type, so a missing translation is a compile error.
 */
export interface Copy {
  htmlLang: Lang;
  /** Signup page path, relative to the base URL. */
  path: string;
  /** Where a successful signup lands. */
  redirectPath: string;
  title: string;
  heading: string;
  labels: {
    firstName: string;
    lastName: string;
    phone: string;
    province: string;
    email: string;
    password: string;
    passwordConfirmation: string;
  };
  /** Start of the consent label; the full text is long and legal, so only its opening is pinned. */
  consentStart: string;
  submit: string;
  /**
   * Matches the password hint without pinning the full sentence: the French hint currently contains
   * a typo (see docs/05-bug-reports.md), and the test must not encode that as correct.
   */
  passwordHint: RegExp;
  /** Text of the header link that switches to the other language (wide screens). */
  languageToggle: string;
  /** Name of the other language as listed in the mobile menu's language picker, in this language. */
  otherLanguageName: string;
  errors: ErrorCopy;
  /** Generic message shown when the backend rejects or fails the request. */
  backendError: string;
}
