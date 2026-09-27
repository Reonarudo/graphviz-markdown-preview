import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import MarkdownIt from 'markdown-it';
import { createPreview } from '../src/preview';

const document = [
  '```graphviz {caption="Pipeline"}',
  'digraph { a [style=filled fillcolor="red:blue" URL="javascript:alert(1)"] a -> b }',
  '```',
  '',
  '```graphviz',
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

test('a Markdown document renders sanitized, namespaced diagrams beside delegated fences', async () => {
  const logged: string[] = [];
  const preview = await createPreview(resolve('dist'), (line) => logged.push(line));
  try {
    const html = preview.extendMarkdownIt(new MarkdownIt()).render(document);
    const diagrams = html.match(/<svg class="graphviz"/g) ?? [];
    assert.equal(diagrams.length, 3);
    assert.match(html, /<figure class="graphviz-figure"><svg class="graphviz"[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(html, /<figcaption>Pipeline<\/figcaption>/);
    assert.doesNotMatch(html, /javascript/);
    // The two identical diagrams share a cache entry but not their ids.
    const gradients = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(gradients).size, 2);
    assert.match(html, /<pre><code class="language-dot">digraph \{ left -&gt; alone \}/);
    assert.match(html, /<div class="graphviz-error" role="alert"><pre>syntax error in line 2 near ';'/);
    assert.match(html, /2 │   x -&gt; ;/);
    assert.deepEqual(logged, ['digraph { w [shape=bogus] }: using box for unknown shape bogus']);
    // Rendering the same document again is served from the cache, so nothing is logged twice.
    preview.extendMarkdownIt(new MarkdownIt()).render(document);
    assert.equal(logged.length, 1);
  } finally {
    preview.dispose();
  }
});
