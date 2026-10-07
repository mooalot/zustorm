import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    dts({
      rollupTypes: true,
      tsconfigPath: './tsconfig.json',
    }),
  ], // Add any Vite plugins here
  build: {
    outDir: 'dist', // Output directory for build files
    lib: {
      entry: 'src/index.ts',
      // The package is "type": "module", so the CommonJS build needs the .cjs
      // extension for Node to load it as CommonJS.
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.es.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['react', 'zustand', 'react/jsx-runtime'],
    },
  },

  test: {
    environment: 'jsdom', // Required for React testing
    globals: true, // Allows using `test`, `expect` globally
    setupFiles: 'tests/vitest.setup.ts', // Path to your setup file
    typecheck: {
      include: ['tests/**/*.test-d.ts'],
      tsconfig: './tsconfig.tests.json',
    },
    coverage: {
      include: ['src/**'],
      exclude: ['src/types.ts'],
      reporter: ['text'],
    },
  },
});
