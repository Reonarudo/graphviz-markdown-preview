// Runs inside a real VS Code (scripts/test-extension.mjs). Renders through the Markdown preview's
// own markdown-it via `markdown.api.render`, so every assertion sees what the preview would show.
const vscode = require('vscode');
const assert = require('node:assert/strict');

const fence = (info, source) => '```' + info + '\n' + source + '\n```\n';

exports.run = async () => {
  const extension = vscode.extensions.getExtension('ReoX86.graphviz-diagram-preview');
  assert(extension, 'extension ReoX86.graphviz-diagram-preview is installed');
  assert.deepEqual(extension.packageJSON.contributes['markdown.previewStyles'], ['media/preview.css']);
  await extension.activate();
  await vscode.extensions.getExtension('vscode.markdown-language-features').activate();
  const render = (markdown) => vscode.commands.executeCommand('markdown.api.render', markdown);

  // A diagram, a neato layout, and fences this extension must leave alone.
  const mixed = await render([
    fence('graphviz', 'digraph { source -> parse -> render }'),
    fence('graphviz', 'graph { layout=neato; a -- b -- c -- a }'),
    fence('dot', 'digraph { left -> alone }'),
    fence('pikchr', 'box "hi"'),
    fence('swift', 'let x = 42')
  ].join('\n'));
  assert.equal((mixed.match(/<svg class="graphviz"/g) ?? []).length, 2);
  assert.match(mixed, />parse<\/text>/);
  assert.match(mixed, /class="[^"]*\blanguage-dot"/);
  assert.match(mixed, /class="[^"]*\blanguage-pikchr"/);
  assert.match(mixed, /class="[^"]*\blanguage-swift"/);

  // Attributes, escaping and a tolerated typo.
  const attributed = await render(fence('graphviz {alt="Two nodes" caption="Figure 1: <pipeline>" align="center" algin="x"}', 'digraph { a -> b }'));
  assert.match(attributed, /<figure class="graphviz-figure graphviz-align-center"><div role="img" aria-label="Two nodes"><svg class="graphviz"/);
  assert.match(attributed, /<figcaption>Figure 1: &lt;pipeline&gt;<\/figcaption>/);

  // Links: https survives with its tooltip, javascript: is unwrapped and the node stays.
  const linked = await render(fence('graphviz', 'digraph { safe [URL="https://graphviz.org" tooltip="Docs"] bad [URL="javascript:alert(1)"] }'));
  assert.match(linked, /<a xlink:href="https:\/\/graphviz\.org" xlink:title="Docs">/);
  assert.doesNotMatch(linked, /javascript/);
  assert.match(linked, />bad<\/text>/);

  // A fontname breakout never reaches the preview.
  const hostile = await render(fence('graphviz', 'digraph { a [fontname="x\\"/><script>alert(1)</script><text x=\\""] }'));
  assert.doesNotMatch(hostile, /<script/);

  // Gradients, and two copies of one diagram with distinct ids.
  const twice = await render(fence('graphviz', 'digraph { a [style=filled fillcolor="red:blue"] }').repeat(2));
  assert.match(twice, /<stop offset="0" style="stop-color:red;/);
  const gradientIds = [...twice.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(gradientIds).size, 2);

  // A syntax error becomes an error report quoting the line; the rest of the document survives.
  const broken = await render('Before\n\n' + fence('graphviz', 'digraph {\n  x -> ;\n}') + '\nAfter');
  assert.match(broken, /<div class="graphviz-error" role="alert"><pre>syntax error in line 2 near ';'/);
  assert.match(broken, /2 │   x -&gt; ;/);
  assert.match(broken, /<p\b[^>]*>After<\/p>/);

  // A graph too dense to lay out times out, and the next diagram still renders.
  const edges = [];
  for (let i = 0; i < 300; i++) for (let k = 1; k <= 8; k++) edges.push(`n${i} -> n${(i * 7 + k * 13) % 300};`);
  const started = Date.now();
  const dense = await render(fence('graphviz', `digraph { ${edges.join(' ')} }`));
  assert.match(dense, /Graphviz layout took longer than 3 s/);
  assert.ok(Date.now() - started < 6000, 'timeout returns promptly');
  assert.match(await render(fence('graphviz', 'digraph { after -> timeout }')), />timeout<\/text>/);
};
