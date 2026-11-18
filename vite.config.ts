import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// cache key for painted texture tiles: changes whenever the painters change
const texHash = createHash('sha1')
  .update(readFileSync('src/render/texgen.ts'))
  .update(readFileSync('src/render/textures.ts'))
  .digest('hex')
  .slice(0, 10);

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { __TEX_HASH__: JSON.stringify(texHash) },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
