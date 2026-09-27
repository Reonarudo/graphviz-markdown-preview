import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, type RenderResult } from '../src/renderer';

/** A stand-in for the worker runtime that records every source it is asked to lay out. */
function stubRuntime(result: (source: string) => RenderResult = (source) =>
  ({ status: 'success', output: `<svg>${source}</svg>`, errors: [] })) {
  const seen: string[] = [];
  return { seen, render: (source: string) => { seen.push(source); return result(source); } };
}

test('a repeated source is laid out and cleaned once, then served from the cache', () => {
  const runtime = stubRuntime();
  let cleaned = 0;
  const render = createRenderer(runtime, (svg) => { cleaned++; return svg.replace('<svg>', '<svg class="clean">'); });
  const expected = { status: 'success', output: '<svg class="clean">a</svg>', errors: [] };
  assert.deepEqual(render('a'), expected);
  assert.deepEqual(render('a'), expected);
  assert.deepEqual(runtime.seen, ['a']);
  assert.equal(cleaned, 1);
});

test('a timed-out source is not laid out again while it stays cached', () => {
  const runtime = stubRuntime(() => ({ status: 'timeout' }));
  const render = createRenderer(runtime);
  assert.deepEqual(render('dense'), { status: 'timeout' });
  assert.deepEqual(render('dense'), { status: 'timeout' });
  assert.deepEqual(runtime.seen, ['dense']);
});

test('an unavailable renderer is retried on the next render instead of being cached', () => {
  let starts = 0;
  const runtime = stubRuntime(() => ++starts === 1
    ? { status: 'unavailable', reason: 'boom' }
    : { status: 'success', output: '<svg></svg>', errors: [] });
  const render = createRenderer(runtime);
  assert.deepEqual(render('a'), { status: 'unavailable', reason: 'boom' });
  assert.equal(render('a').status, 'success');
});

test('the cache keeps the 96 most recently used sources', () => {
  const runtime = stubRuntime();
  const render = createRenderer(runtime);
  for (let i = 0; i < 96; i++) render(`g${i}`);
  render('g0'); // touched, so g1 is now the least recently used
  render('g96'); // the 97th source evicts g1
  runtime.seen.length = 0;
  render('g0');
  render('g2');
  render('g1');
  assert.deepEqual(runtime.seen, ['g1']);
});
