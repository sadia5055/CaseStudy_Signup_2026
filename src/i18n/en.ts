import type { Copy } from './copy';

export const en: Copy = {
  htmlLang: 'en',
  path: '/signup',
  redirectPath: '/getaquote',
  title: 'nesto | Signup',
  heading: 'Create a nesto account',
  labels: {
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone number',
    province: 'Province of purchase',
    email: 'Email',
    password: 'Password',
    passwordConfirmation: 'Confirm password',
  },
  consentStart: 'By checking this box, you agree to be contacted by nesto’s partners',
  submit: 'Create your account',
  passwordHint: /12.*32.*(uppercase).*(lowercase).*(number)/i,
  languageToggle: 'FR',
  otherLanguageName: 'French',
  errors: {
    required: 'The field is required',
    invalidName: 'Invalid name',
    invalidEmail: 'Invalid email',
    invalidPhone: 'Invalid value',
    // The app says "letters" for a rule that counts characters; pinned as observed (bug report #3).
    passwordMin: 'Minimum of 12 letters required',
    passwordMax: 'Maximum of 32 letters required',
    passwordComposition:
      'Password must contain at least one uppercase letter, one lowercase letter and one number',
    passwordMismatch: 'Passwords do not match',
  },
  backendError:
    'Something went wrong! Please try again and if you continue to have trouble feel free to contact your advisor',
};
