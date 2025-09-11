// jest.config.js

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  // Preset dasar untuk ts-jest
  preset: 'ts-jest/presets/default-esm', // <-- PENTING: Gunakan preset ESM

  // Lingkungan tes
  testEnvironment: 'node',

  // Opsi resolver untuk modul, untuk menangani ekstensi .js di impor ESM
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Opsi transformer untuk memberitahu ts-jest agar menggunakan mode ESM
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  
  // Pengaturan lain yang sudah Anda miliki
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  verbose: true,
  forceExit: true,
};