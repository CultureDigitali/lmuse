import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Flat config ESLint 9. Regole consigliate senza type-checking
// (il type-checking resta in `pnpm typecheck` con tsc).
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'reference/**',
      'release/**',
      '.test-profile/**',
      '.e2e-profile/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'native/**/*.mjs'],
    // `chrome` qui è l'API estensione usata dentro worker.evaluate(), cioè
    // codice che gira nel contesto del browser, non in Node.
    languageOptions: { globals: { ...globals.node, ...globals.browser, chrome: 'readonly' } },
    rules: { 'no-console': 'off' },
  },
);
