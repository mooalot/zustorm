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
      name: 'zustorm', // Library name
      entry: 'src/index.ts', // Entry point for your library
      fileName: (format) => `index.${format}.js`, // Output file naming pattern
    },
    rollupOptions: {
      external: ['react', 'zustand', 'zod', 'react/jsx-runtime'], // External dependencies
      output: {
        globals: {
          react: 'React',
          zustand: 'Zustand',
          zod: 'Zod',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
  },

  test: {
    environment: 'jsdom', // Required for React testing
    globals: true, // Allows using `test`, `expect` globally
    setupFiles: 'tests/vitest.setup.ts', // Path to your setup file
  },
});
