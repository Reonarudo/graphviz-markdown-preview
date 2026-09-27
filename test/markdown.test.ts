import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { markdownPlugin } from '../src/markdown';
import type { RenderResult } from '../src/renderer';

const diagram = (output = '<svg class="graph"></svg>'): RenderResult => ({ status: 'success', output, errors: [] });

test('claims exactly graphviz fences and passes the DOT source through', () => {
  let seen = '';
  const md = markdownPlugin(new MarkdownIt(), (source) => { seen = source; return diagram(); });
  assert.match(md.render('```graphviz\ndigraph { a -> b }\n```'), /<svg/);
  assert.equal(seen, 'digraph { a -> b }\n');
});

test('preserves unrelated fences byte for byte including highlighting', () => {
  for (const language of ['dot', 'gv', 'Graphviz', 'graphviz extra', 'pikchr', 'swift', '']) {
    const input = '```' + language + '\ndigraph { a -> b }\n```';
    const options = { highlight: () => '<b>highlight</b>' };
    const delegated = markdownPlugin(new MarkdownIt(options), () => { throw new Error('wrong fence'); });
    assert.equal(delegated.render(input), new MarkdownIt(options).render(input), language);
  }
});

test('a previously registered fence renderer still receives its fences', () => {
  const md = new MarkdownIt();
  md.renderer.rules.fence = () => '<div class="other-extension"></div>';
  markdownPlugin(md, () => diagram());
  assert.equal(md.render('```dot\ndigraph {}\n```'), '<div class="other-extension"></div>');
  assert.match(md.render('```graphviz\ndigraph {}\n```'), /<svg/);
});

test('missing fence renderer falls back without throwing', () => {
  const md = new MarkdownIt();
  delete md.renderer.rules.fence;
  const expected = md.render('```swift\n42\n```');
  markdownPlugin(md, () => diagram());
  assert.equal(md.render('```swift\n42\n```'), expected);
});

test('a bare fence emits the diagram with the graphviz class and no wrapper', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg width="10pt"><g/></svg>'));
  assert.match(md.render('```graphviz\ndigraph {}\n```'), /^<svg class="graphviz" width="10pt"><g\/><\/svg>\n?$/);
});

test('alt becomes an accessible name, caption a figure, align a class', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg></svg>'));
  const html = md.render('```graphviz {alt="Two nodes" caption="Figure 1" align="center"}\ndigraph {}\n```');
  assert.match(html, /<figure class="graphviz-figure graphviz-align-center">/);
  assert.match(html, /<div role="img" aria-label="Two nodes"><svg class="graphviz"><\/svg><\/div>/);
  assert.match(html, /<figcaption>Figure 1<\/figcaption>/);
  // The caption must sit outside the image role to stay readable by assistive technology.
  assert.ok(html.indexOf('</div>') < html.indexOf('<figcaption>'));
});

test('align alone still produces a figure to carry the class', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg></svg>'));
  assert.match(md.render('```graphviz {align="right"}\ndigraph {}\n```'),
    /<figure class="graphviz-figure graphviz-align-right"><svg class="graphviz"><\/svg><\/figure>/);
});

test('class lands on the root svg beside the base class, escaped', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg><g class="node"></g></svg>'));
  const html = md.render('```graphviz {class="wide &quot;x\\" onload=\\"y"}\ndigraph {}\n```');
  assert.match(html, /^<svg class="graphviz wide &amp;quot;x&quot; onload=&quot;y"><g class="node"><\/g><\/svg>/);
});

test('attribute text is escaped, including quotes, markup and Markdown', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg></svg>'));
  const html = md.render('```graphviz {alt="<img src=x onerror=alert(1)>" caption="**bold** & \\"quoted\\""}\ndigraph {}\n```');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /aria-label="&lt;img src=x onerror=alert\(1\)&gt;"/);
  assert.match(html, /<figcaption>\*\*bold\*\* &amp; &quot;quoted&quot;<\/figcaption>/);
});

test('malformed attributes are reported, never shown, and the diagram still renders', () => {
  const reported: string[] = [];
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg></svg>'), (m) => reported.push(m));
  const html = md.render('```graphviz {alt="unterminated}\ndigraph {}\n```');
  assert.match(html, /^<svg class="graphviz"><\/svg>/);
  assert.equal(reported.length, 1);
});

test('two identical fences in one document get distinct ids that reference only themselves', () => {
  const svg = '<svg><linearGradient id="node1_l_0"/><polygon fill="url(#node1_l_0)"/></svg>';
  const md = markdownPlugin(new MarkdownIt(), () => diagram(svg));
  const html = md.render('```graphviz\ndigraph {}\n```\n\n```graphviz\ndigraph {}\n```');
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]!);
  const refs = [...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  assert.deepEqual(refs, ids);
});

const fence = (source: string) => '# Before\n```graphviz\n' + source + '\n```\nAfter';

test('a failure shows every error, prefix-stripped, with the named source line', () => {
  const md = markdownPlugin(new MarkdownIt(), () => ({
    status: 'failure',
    errors: [
      { level: 'error', message: "syntax error in line 2 near '->'" },
      { level: 'warning', message: 'Warning: not shown in the report' },
      { level: 'error', message: 'Error: <b>second</b> problem' }
    ]
  }));
  const html = md.render(fence('digraph {\n  a -> -> b\n}'));
  assert.match(html, /<div class="graphviz-error" role="alert"><pre>syntax error in line 2 near '-&gt;'\n&lt;b&gt;second&lt;\/b&gt; problem\n\n2 │   a -&gt; -&gt; b<\/pre><\/div>/);
  assert.doesNotMatch(html, /not shown/);
  assert.match(html, /<p>After<\/p>/);
});

test('a failure naming no line, or a line outside the source, shows messages only', () => {
  const md = markdownPlugin(new MarkdownIt(), () => ({
    status: 'failure', errors: [{ level: 'error', message: 'syntax error in line 9 near x' }]
  }));
  assert.match(md.render(fence('digraph {')), /<pre>syntax error in line 9 near x<\/pre>/);
});

test('a timeout and an unavailable renderer have fixed wording', () => {
  const timeout = markdownPlugin(new MarkdownIt(), () => ({ status: 'timeout' }));
  assert.match(timeout.render(fence('digraph {}')),
    /<div class="graphviz-error" role="alert"><pre>Graphviz layout took longer than 3 s\. Simplify or split the graph\.<\/pre><\/div>/);
  const unavailable = markdownPlugin(new MarkdownIt(), () => ({ status: 'unavailable', reason: 'out of <memory>' }));
  assert.match(unavailable.render(fence('digraph {}')),
    /<pre>Graphviz could not start: out of &lt;memory&gt;\. It will retry on the next render\.<\/pre>/);
});
