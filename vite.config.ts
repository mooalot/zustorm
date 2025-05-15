import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
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
      external: ['react', 'zustand', 'zod'],
      output: {
        globals: {
          react: 'React',
          zustand: 'Zustand',
          zod: 'Zod',
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
