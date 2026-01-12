import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  /* =====================================================
   * 1. GLOBAL IGNORES (WAJIB & FINAL)
   * ===================================================== */
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',

      // 🔥 generated code (PRISMA & LAINNYA)
      'src/generated/**',
      'generated/**',
      'prisma/generated/**',

      // 🔥 declaration files
      '**/*.d.ts',

      // config
      'eslint.config.js',
    ],
  },

  /* =====================================================
   * 2. BASE JAVASCRIPT RULES
   * ===================================================== */
  js.configs.recommended,

  {
    plugins: {
      prettier: prettierPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      /* formatting */
      'prettier/prettier': 'error',

      /* best practice JS */
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',

      /* matikan default unused (diganti plugin) */
      'no-unused-vars': 'off',
    },
  },

  /* =====================================================
   * 3. TYPESCRIPT (SOURCE CODE SAJA)
   * ===================================================== */
  {
    files: ['src/**/*.ts', 'prisma/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      /* =================================================
       * A. MATIKAN RULE TYPE-SAFETY YANG BERISIK
       * ================================================= */
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',

      /* =================================================
       * B. UNUSED IMPORTS (AUTO-FIX UTAMA)
       * ================================================= */
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^(_|req|res|next|err)$',
        },
      ],

      /* =================================================
       * C. RULE MODERN TS (AMAN DI AUTO-FIX)
       * ================================================= */
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],

      /* stylistic dimatikan (dipegang Prettier) */
      quotes: 'off',
      '@typescript-eslint/quotes': 'off',
    },
  },

  /* =====================================================
   * 4. PRETTIER (HARUS PALING BAWAH)
   * ===================================================== */
  prettierConfig,
);
