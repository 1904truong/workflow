import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

const entries = [
  { name: 'background', input: resolve(__dirname, 'src/background/service-worker.ts') },
  { name: 'flow-content', input: resolve(__dirname, 'src/content/flow-content.ts') },
  { name: 'web-bridge', input: resolve(__dirname, 'src/content/web-bridge.ts') },
];

console.log('Building Flow Bridge Extension bundles...');

for (const entry of entries) {
  await build({
    configFile: false,
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../../packages/shared'),
      },
    },
    build: {
      emptyOutDir: false,
      outDir: distDir,
      rollupOptions: {
        input: { [entry.name]: entry.input },
        output: {
          format: 'iife',
          entryFileNames: `${entry.name}.js`,
          inlineDynamicImports: true,
        },
      },
    },
  });
  console.log(`✓ Built self-contained ${entry.name}.js`);
}

console.log('All extension bundles built successfully.');
