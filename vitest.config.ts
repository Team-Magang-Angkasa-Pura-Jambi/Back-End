// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Supaya bisa pakai describe, it, expect tanpa import manual
    environment: 'node',
  },
});
