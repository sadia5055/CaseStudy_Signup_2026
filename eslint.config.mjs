import js from '@eslint/js';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // scripts/ holds one-off discovery probes (plain JS, deliberate sleeps), not suite code.
  { ignores: ['node_modules', 'playwright-report', 'test-results', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
  { files: ['**/*.mjs'], ...tseslint.configs.disableTypeChecked },
  { files: ['tests/**/*.ts'], ...playwright.configs['flat/recommended'] },
);
