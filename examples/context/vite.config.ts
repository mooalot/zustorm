import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'zustand-forms': path.resolve(__dirname, '../../src'),
    },
  },
  server: {
    fs: {
      allow: ['../..'], // Allow accessing parent folders
    },
  },
});
