import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CORE_MESSAGE =
  'src/core là logic thuần: không dùng Phaser, DOM hay các lớp game/ui/debug/platform.';

const BROWSER_GLOBALS = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'requestAnimationFrame',
  'HTMLElement',
];

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', 'node_modules/', 'android/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // Ranh giới kiến trúc: xem docs/plan.md mục 3.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: CORE_MESSAGE }],
          patterns: [
            {
              group: ['phaser/*', '**/game/**', '**/ui/**', '**/debug/**', '**/platform/**'],
              message: CORE_MESSAGE,
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map((name) => ({ name, message: CORE_MESSAGE })),
      ],
    },
  },
  prettier,
]);
