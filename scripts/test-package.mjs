// Package the VSIX, unpack it, and run the real-host test against the unpacked artifact, so what
// is verified is exactly what ships.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

execFileSync('npm', ['run', 'package'], { stdio: 'inherit' });
const vsix = (await readdir('.')).find((name) => name.endsWith('.vsix'));
if (!vsix) throw new Error('npm run package produced no .vsix');
const unpacked = await mkdtemp(join(tmpdir(), 'graphviz-vsix-'));
try {
  execFileSync('unzip', ['-q', vsix, '-d', unpacked]);
  execFileSync('node', ['scripts/test-extension.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, GRAPHVIZ_EXTENSION_PATH: join(unpacked, 'extension') }
  });
} finally {
  await rm(unpacked, { recursive: true, force: true });
}
