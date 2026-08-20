import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  
  plugins: [tsconfigPaths()],

  test: {
    
    
    globals: true,

    
    
    environment: 'node',

    
    
    reporters: ['verbose'],
    
    
    onConsoleLog(log) {
      if (log.includes('ExperimentalWarning')) return false;
    },

    
    
    
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    
    
    testTimeout: 10000, 
    

    
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'], 
      include: ['src/**/*.ts'], 
      exclude: [
        'src/**/*.test.ts', 
        'src/types/**',     
        'src/generated/**', 
        '**/node_modules/**',
      ],
    },
  },
});