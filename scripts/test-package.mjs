// Unpack the VSIX and run the real-host test against what is inside it, so what is verified is
// exactly what ships, and a file the `.vscodeignore` trims by mistake fails here rather than for
// users. Takes a VSIX path (e.g. a downloaded release asset); without one, the VSIX that
// `npm run package` wrote for this version.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const local = JSON.parse(await readFile('package.json', 'utf8'));
const file = resolve(process.argv[2] || `${local.name}-${local.version}.vsix`);
const unpacked = await mkdtemp(join(tmpdir(), 'graphviz-vsix-'));
try {
  execFileSync('unzip', ['-q', file, '-d', unpacked]);
  const root = join(unpacked, 'extension');
  for (const path of [
    'dist/extension.js', 'media/preview.css', 'media/preview.js', 'media/icon.png', 'readme.md', 'LICENSE.txt', 'THIRD_PARTY_NOTICES.md',
    'node_modules/@reonarudo/graphviz-renderer/package.json',
    'node_modules/@reonarudo/graphviz-renderer/dist/index.js',
    'node_modules/@reonarudo/graphviz-renderer/dist/worker.js',
    'node_modules/@reonarudo/graphviz-renderer/vendor/viz/viz.cjs',
    'node_modules/@reonarudo/graphviz-renderer/licenses/GRAPHVIZ-EPL-2.0',
    'node_modules/@reonarudo/graphviz-renderer/THIRD_PARTY_NOTICES.md',
    'node_modules/@xmldom/xmldom/LICENSE'
  ]) assert.ok((await stat(join(root, path))).size > 0, path);
  assert.equal(execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).split('\n').some(
    (name) => /^extension\/(vendor\/|src\/|test\/|scripts\/|examples\/)|\.d\.ts$|\.map$/.test(name)), false,
  'no sources, tests, declarations or maps');
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.publisher, 'ReoX86');
  assert.equal(manifest.version, local.version);
  execFileSync(process.execPath, ['scripts/test-extension.mjs'], {
    stdio: 'inherit', env: { ...process.env, GRAPHVIZ_EXTENSION_PATH: root }
  });
  console.log(`Packaged extension layout and real extension-host rendering: PASS (${(await stat(file)).size} bytes)`);
} finally {
  await rm(unpacked, { recursive: true, force: true });
}
