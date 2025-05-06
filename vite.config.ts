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
      entry: 'src/index.ts', // Entry point for your library
      name: 'ZustandForms', // Global variable name if your library is used in a non-ESM environment
      fileName: (format) => `index.${format}.js`, // Output file naming pattern
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled
      external: [], // Add any external dependencies here
      output: {
        globals: {}, // Global variables for external dependencies
      },
    },
  },

  test: {
    environment: 'jsdom', // Required for React testing
    globals: true, // Allows using `test`, `expect` globally
    setupFiles: 'tests/vitest.setup.ts', // Path to your setup file
  },
});
