module.exports = {
  parser: '@typescript-eslint/parser',

  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:prettier/recommended',
  ],

  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',

    '@typescript-eslint/no-unused-vars': 'warn',

    // Anda bisa menambahkan aturan custom lainnya di sini
    // 'nama-aturan': 'off' | 'warn' | 'error'
  },

  env: {
    node: true,
    es2021: true,
  },
};
