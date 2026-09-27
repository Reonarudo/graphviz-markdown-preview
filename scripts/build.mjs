import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/extension.ts', 'src/worker.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  // `vscode` is provided by the host. The Graphviz WebAssembly module stays external and is
  // shipped as `vendor/viz/viz.cjs`, so the same relative require resolves from `src/` in
  // development and from `dist/` in the packaged extension.
  external: ['vscode', '../vendor/viz/viz.cjs'],
  sourcemap: false
});
