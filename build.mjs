import { join } from 'node:path';
import process from 'node:process';
import { build } from 'esbuild';

build({
  absWorkingDir: process.cwd(),
  bundle: true,
  logLevel: 'info',
  entryPoints: ['server/index.ts'],
  outfile: join(process.cwd(), './build/index.mjs'),
  minify: true,
  format: 'esm',
  target: 'esnext',
  platform: 'node',
  banner: {
    js:
      "import { fileURLToPath } from 'url';" +
      "import { dirname } from 'path';" +
      'const __filename = fileURLToPath(import.meta.url);' +
      'const __dirname = dirname(__filename);' +
      "import { createRequire } from 'module';" +
      'const require = createRequire(import.meta.url);',
  },
});
