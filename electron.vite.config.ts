import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { build: { rollupOptions: { input: resolve('src/main/main.ts') } } },
  preload: {
    build: { rollupOptions: { input: resolve('src/main/preload.ts'), output: { format: 'cjs' } } },
  },
  renderer: {
    plugins: [react()],
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
  },
});
