import js from '@eslint/js';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // The probe scripts were used once during discovery (plain JS, deliberate sleeps); they are not suite code.
  {
    ignores: [
      'node_modules',
      'playwright-report',
      'test-results',
      'scripts/discovery*.mjs',
      'scripts/duplicate-id-probe.mjs',
      'security/.out',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly' },
    },
  },
  { files: ['tests/**/*.ts'], ...playwright.configs['flat/recommended'] },
);
