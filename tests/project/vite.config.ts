import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      zustorm: path.resolve(__dirname, '../../src'),
    },
  },
  server: {
    fs: {
      allow: ['../..'], // Allow accessing parent folders
    },
  },
});
