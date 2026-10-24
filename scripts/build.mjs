import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/extension.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // `vscode` is provided by the host. The renderer library is not bundled: it ships installed in
  // the VSIX's `node_modules`, where its worker and engine sit where it expects them (ADR 0010).
  external: ['vscode', '@reonarudo/graphviz-renderer'],
  sourcemap: false
});
