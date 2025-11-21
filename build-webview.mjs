import * as esbuild from 'esbuild';
import { copyFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  // Bundle the webview JavaScript
  await esbuild.build({
    entryPoints: [join(__dirname, 'media', 'main.js')],
    bundle: true,
    outfile: join(__dirname, 'out', 'webview.js'),
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    external: ['vscode'],
    sourcemap: true,
  });

  // Copy WASM files and workers to out directory
  const duckdbDist = join(__dirname, 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
  const outDir = join(__dirname, 'out');
  
  await mkdir(outDir, { recursive: true });
  
  const filesToCopy = [
    'duckdb-eh.wasm',
    'duckdb-browser-eh.worker.js',
  ];

  for (const file of filesToCopy) {
    await copyFile(
      join(duckdbDist, file),
      join(outDir, file)
    );
  }

  console.log('Webview build complete!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
