import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'background': resolve(__dirname, 'src/background/service-worker.ts'),
        'flow-content': resolve(__dirname, 'src/content/flow-content.ts'),
        'web-bridge': resolve(__dirname, 'src/content/web-bridge.ts'),
      },
      output: {
        format: 'iife',
        entryFileNames: '[name].js',
        // Bundle everything into the entry file without shared chunks
        manualChunks: undefined,
        inlineDynamicImports: false,
      },
    },
  },
});
