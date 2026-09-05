import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },

  // Base config for the whole app
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // ===== The core/render boundary. =====
  // src/core is the volleyball domain model: pure TypeScript, zero rendering
  // or UI imports. This is what makes the visual theme swappable and the
  // rules unit-testable headless in Vitest's node environment. Do not soften
  // this rule to fix an import error — move the code instead.
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', 'react', 'react-dom', 'react-dom/*', 'zustand', 'zustand/*'],
              message: 'src/core is the pure domain layer and must not import rendering or UI libraries. Put this in src/render or src/ui instead.',
            },
            {
              group: ['@/render/*', '@/ui/*', '@/app/*', '@/persistence/*'],
              message: 'src/core must not depend on render/ui/app/persistence. Those layers depend on core, not the other way around.',
            },
          ],
        },
      ],
    },
  },
);
