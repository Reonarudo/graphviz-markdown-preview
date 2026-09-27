import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRuntime } from '../src/renderer';

test('a valid graph renders to inline SVG through the worker', async () => {
  const runtime = await createRuntime(resolve('dist'));
  try {
    const result = runtime.render('digraph { a -> b }');
    assert.equal(result.status, 'success');
    assert.ok(result.status === 'success' && /<svg width=/.test(result.output));
    assert.deepEqual(result.status === 'success' && result.errors, []);
  } finally {
    runtime.dispose();
  }
});

test('a syntax error comes back as a failure naming the line', async () => {
  const runtime = await createRuntime(resolve('dist'));
  try {
    const result = runtime.render('digraph {\n  a -> ;\n}');
    assert.equal(result.status, 'failure');
    assert.deepEqual(result.errors, [{ level: 'error', message: "syntax error in line 2 near ';'" }]);
  } finally {
    runtime.dispose();
  }
});

/** A deterministic graph dense enough that `dot` layout takes seconds, not milliseconds. */
function denseGraph(nodes: number, edgesPerNode: number): string {
  const edges: string[] = [];
  for (let i = 0; i < nodes; i++) {
    for (let k = 1; k <= edgesPerNode; k++) edges.push(`n${i} -> n${(i * 7 + k * 13) % nodes};`);
  }
  return `digraph { ${edges.join(' ')} }`;
}

test('a render over the time limit times out, and the next render still works', async () => {
  const runtime = await createRuntime(resolve('dist'), { timeout: 200 });
  try {
    assert.deepEqual(runtime.render(denseGraph(300, 8)), { status: 'timeout' });
    const next = runtime.render('digraph { a -> b }');
    assert.equal(next.status, 'success');
  } finally {
    runtime.dispose();
  }
});

test('DOT source over 64 KB is refused', async () => {
  const runtime = await createRuntime(resolve('dist'));
  try {
    const result = runtime.render(`digraph { ${'a -> b; '.repeat(8_200)} }`);
    assert.deepEqual(result, {
      status: 'failure',
      errors: [{ level: 'error', message: 'DOT source exceeds the 64 KB limit.' }]
    });
  } finally {
    runtime.dispose();
  }
});

test('warnings on a successful render survive the round trip', async () => {
  const runtime = await createRuntime(resolve('dist'));
  try {
    const result = runtime.render('digraph { a [shape=bogus] }');
    assert.equal(result.status, 'success');
    assert.deepEqual(result.errors, [{ level: 'warning', message: 'using box for unknown shape bogus' }]);
  } finally {
    runtime.dispose();
  }
});
