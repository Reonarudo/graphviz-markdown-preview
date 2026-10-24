import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { createRuntime, type RenderResult } from '@reonarudo/graphviz-renderer';
import { createPreview, createRenderer } from '../src/preview';

const document = [
  '```graphviz {caption="Pipeline" class="wide"}',
  'digraph { a [style=filled fillcolor="red:blue" URL="javascript:alert(1)"] a -> b }',
  '```',
  '',
  '```dot',
  'digraph { left -> alone }',
  '```',
  '',
  '```graphviz',
  'digraph {',
  '  x -> ;',
  '}',
  '```',
  '',
  '```graphviz',
  'digraph { w [shape=bogus] }',
  '```'
].join('\n');

test('a Markdown document renders library diagrams beside delegated fences, through the real library', async () => {
  const runtime = await createRuntime();
  const logged: string[] = [];
  try {
    const preview = createPreview(runtime, (line) => logged.push(line));
    const html = preview.extendMarkdownIt(new MarkdownIt()).render(document);
    assert.equal((html.match(/<svg width="[\d.]+pt"[^>]*\bclass="graphviz/g) ?? []).length, 2);
    assert.match(html, /<figure class="graphviz-figure"><svg width="[\d.]+pt"[^>]*\bclass="graphviz wide"/);
    assert.match(html, /<figcaption>Pipeline<\/figcaption>/);
    assert.doesNotMatch(html, /javascript/);
    // Ids are the library's: deterministic, from the source's digest.
    assert.match(html, /<linearGradient id="graphviz-[0-9a-f]{8}-/);
    assert.match(html, /<pre><code class="language-dot">digraph \{ left -&gt; alone \}/);
    assert.match(html, /<div class="graphviz-error" role="alert"><pre>Graphviz error at line 2: syntax error near ';'/);
    assert.match(html, /2 │   x -&gt; ;/);
    assert.deepEqual(logged, ['digraph { w [shape=bogus] }: using box for unknown shape bogus']);
    // Rendering the same document again is served from the cache, so nothing is logged twice.
    preview.extendMarkdownIt(new MarkdownIt()).render(document);
    assert.equal(logged.length, 1);
  } finally {
    await runtime.dispose();
  }
});

test('the cache keeps timeouts and failures but retries an unavailable renderer', () => {
  const results: RenderResult[] = [
    { status: 'timeout', budget: 3000 },
    { status: 'unavailable', reason: 'down' },
    { status: 'success', output: '<svg class="graphviz"></svg>', notes: [] }
  ];
  let calls = 0;
  const fresh: string[] = [];
  const render = createRenderer({ render: () => results[calls++]! }, (source) => fresh.push(source));
  assert.equal(render({ source: 'dense' }).status, 'timeout');
  assert.equal(render({ source: 'dense' }).status, 'timeout');
  assert.equal(render({ source: 'other' }).status, 'unavailable');
  assert.equal(render({ source: 'other' }).status, 'success');
  assert.equal(render({ source: 'other' }).status, 'success');
  assert.equal(calls, 3);
  assert.deepEqual(fresh, ['dense', 'other', 'other']);
});
