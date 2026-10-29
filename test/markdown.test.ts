import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { markdownPlugin } from '../src/markdown';
import { rendering } from './helpers';
import type { RenderResult } from '@reonarudo/graphviz-renderer';

const diagram = (output = '<svg class="graphviz"></svg>'): RenderResult => ({ status: 'success', output, notes: [] });

const ICON_CODE = '<svg class="graphviz-icon-code" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
  '<path d="M5.7 3.3 1 8l4.7 4.7.9-.9L2.8 8l3.8-3.8zM10.3 3.3l-.9.9L13.2 8l-3.8 3.8.9.9L15 8z"/></svg>';
const ICON_GRAPH = '<svg class="graphviz-icon-graph" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2">' +
  '<rect x="1.5" y="1.5" width="5" height="3.5" rx=".5"/><rect x="9.5" y="1.5" width="5" height="3.5" rx=".5"/><rect x="5.5" y="11" width="5" height="3.5" rx=".5"/>' +
  '<path d="M4 5v3h8V5M8 8v3"/></svg>';
const TOGGLE = `<button type="button" class="graphviz-toggle" aria-pressed="false" aria-label="Source view" title="Source view">${ICON_CODE}${ICON_GRAPH}</button>`;

test('claims exactly graphviz fences and passes the DOT source through', () => {
  let seen = '';
  const md = markdownPlugin(new MarkdownIt(), ({ source }) => { seen = source; return diagram(); });
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

test('a previously registered fence renderer still receives its fences, and supplies the source view of ours', () => {
  const md = new MarkdownIt();
  md.renderer.rules.fence = () => '<div class="other-extension"></div>';
  markdownPlugin(md, () => diagram());
  assert.equal(md.render('```dot\ndigraph {}\n```'), '<div class="other-extension"></div>');
  const html = md.render('```graphviz\ndigraph {}\n```');
  assert.match(html, /<svg/);
  assert.match(html, /<\/div><div class="other-extension"><\/div><\/div>\n$/);
});

// The DOM contract (docs/source-toggle-spec.md in onnx-markdown-preview, section 2): asserted
// exactly once, here.
test('every claimed fence is wrapped: toggle first, rendering slot, then the delegated source <pre>', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram());
  assert.equal(md.render('```graphviz\nm\n```'),
    `<div class="graphviz-fence code-line" data-line="0" data-fence-key="bd2eb076">${TOGGLE}` +
    '<div class="graphviz-rendering"><svg class="graphviz"></svg></div>' +
    '<pre><code class="language-graphviz">m\n</code></pre>\n</div>\n');
});

test('the wrapper carries code-line and data-line from the token map, and neither without a map', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram());
  const tokens = md.parse('# Title\n\n```graphviz\nm\n```', {});
  assert.match(md.renderer.render(tokens, md.options, {}), /<div class="graphviz-fence code-line" data-line="2" data-fence-key="bd2eb076">/);
  for (const token of tokens) token.map = null;
  const bare = md.renderer.render(tokens, md.options, {});
  assert.match(bare, /<div class="graphviz-fence" data-fence-key="bd2eb076">/);
  assert.doesNotMatch(bare, /data-line/);
});

test('the fence key is FNV-1a of the exact body', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram());
  assert.match(md.render('```graphviz\nm\n```'), /data-fence-key="bd2eb076"/);
  assert.match(md.render('```graphviz\n```'), /data-fence-key="811c9dc5"/);
  // The info string and attributes play no part: same body, same key.
  assert.match(md.render('```graphviz {caption="c"}\nm\n```'), /data-fence-key="bd2eb076"/);
  assert.match(md.render('```graphviz\nm \n```'), /data-fence-key="(?!bd2eb076)[0-9a-f]{8}"/);
});

test('the source <pre> is the delegated fence rule output, with VS Code-style highlighting kept verbatim', () => {
  const highlighted = markdownPlugin(new MarkdownIt({ highlight: (code, lang) => `<i class="${lang}">${code.trim()}</i>` }), () => diagram());
  assert.match(highlighted.render('```graphviz {alt="x"}\nm\n```'), /<\/div><pre><code class="language-graphviz"><i class="graphviz">m<\/i><\/code><\/pre>\n<\/div>\n$/);
  // VS Code's shell keeps its highlighting and `dir`, but not the scroll-sync class and line,
  // which the wrapper carries for the whole fence.
  const vscode = new MarkdownIt();
  vscode.renderer.rules.fence = (tokens, index) =>
    `<pre><code data-line="${tokens[index]!.map![0]}" class="code-line language-graphviz" dir="auto">${tokens[index]!.content}</code></pre>\n`;
  markdownPlugin(vscode, () => diagram());
  assert.match(vscode.render('```graphviz\nm\n```'), /<\/div><pre><code class="language-graphviz" dir="auto">m\n<\/code><\/pre>\n<\/div>\n$/);
  // Bare markdown-it with no fence rule at all: a hand-built, escaped fallback.
  const md = new MarkdownIt();
  delete md.renderer.rules.fence;
  markdownPlugin(md, () => diagram());
  assert.match(md.render('```graphviz\n<m>\n```'), /<\/div><pre><code class="language-graphviz">&lt;m&gt;\n<\/code><\/pre>\n<\/div>\n$/);
});

test('the error card and a renderer that threw sit in the rendering slot, with the source <pre> beside them', () => {
  const failed = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'no' }));
  assert.equal(failed.render('```graphviz\nm\n```'),
    `<div class="graphviz-fence code-line" data-line="0" data-fence-key="bd2eb076">${TOGGLE}` +
    '<div class="graphviz-rendering"><div class="graphviz-error" role="alert"><pre>Graphviz error: no</pre></div>\n</div>' +
    '<pre><code class="language-graphviz">m\n</code></pre>\n</div>\n');
  const threw = markdownPlugin(new MarkdownIt(), () => { throw new Error('x'); });
  assert.match(threw.render('```graphviz\nm\n```'), /<div class="graphviz-rendering"><div class="graphviz-error" role="alert"><pre>Graphviz error: x<\/pre><\/div>\n<\/div><pre><code class="language-graphviz">m\n<\/code><\/pre>\n<\/div>\n$/);
});

test('missing fence renderer falls back without throwing', () => {
  const md = new MarkdownIt();
  delete md.renderer.rules.fence;
  const expected = md.render('```swift\n42\n```');
  markdownPlugin(md, () => diagram());
  assert.equal(md.render('```swift\n42\n```'), expected);
});

test('a bare fence emits the diagram at its natural width in points, with no figure', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg class="graphviz" viewBox="0.00 0.00 62.00 116.00"><g/></svg>'));
  assert.equal(rendering(md.render('```graphviz\ndigraph {}\n```')),
    '<svg width="62pt" class="graphviz" viewBox="0.00 0.00 62.00 116.00"><g/></svg>');
});

test('a diagram without a viewBox gets no width', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg class="graphviz"><g viewBox="0 0 9 9"/></svg>'));
  assert.equal(rendering(md.render('```graphviz\ndigraph {}\n```')), '<svg class="graphviz"><g viewBox="0 0 9 9"/></svg>');
});

test('alt becomes an accessible name, caption a figure, align a class', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram());
  const html = md.render('```graphviz {alt="Two nodes" caption="Figure 1" align="center"}\ndigraph {}\n```');
  assert.match(html, /<figure class="graphviz-figure graphviz-align-center">/);
  assert.match(html, /<div role="img" aria-label="Two nodes"><svg class="graphviz"><\/svg><\/div>/);
  assert.match(html, /<figcaption>Figure 1<\/figcaption>/);
  // The caption must sit outside the image role to stay readable by assistive technology.
  assert.ok(html.indexOf('</div>') < html.indexOf('<figcaption>'));
});

test('align alone still produces a figure to carry the class', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram());
  assert.match(md.render('```graphviz {align="right"}\ndigraph {}\n```'),
    /<figure class="graphviz-figure graphviz-align-right"><svg class="graphviz"><\/svg><\/figure>/);
});

test('class lands on the root svg beside the base class, escaped', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram('<svg class="graphviz"><g class="graphviz"></g></svg>'));
  const html = md.render('```graphviz {class="wide &quot;x\\" onload=\\"y"}\ndigraph {}\n```');
  assert.equal(rendering(html), '<svg class="graphviz wide &amp;quot;x&quot; onload=&quot;y"><g class="graphviz"></g></svg>');
});

test('attribute text is escaped, including quotes, markup and Markdown', () => {
  const md = markdownPlugin(new MarkdownIt(), () => diagram());
  const html = md.render('```graphviz {alt="<img src=x onerror=alert(1)>" caption="**bold** & \\"quoted\\""}\ndigraph {}\n```');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /aria-label="&lt;img src=x onerror=alert\(1\)&gt;"/);
  assert.match(html, /<figcaption>\*\*bold\*\* &amp; &quot;quoted&quot;<\/figcaption>/);
});

test('malformed attributes are reported, never shown, and the diagram still renders', () => {
  const reported: string[] = [];
  const md = markdownPlugin(new MarkdownIt(), () => diagram(), (m) => reported.push(m));
  const html = md.render('```graphviz {alt="unterminated}\ndigraph {}\n```');
  assert.equal(rendering(html), '<svg class="graphviz"></svg>');
  assert.equal(reported.length, 1);
});

test('a throwing renderer becomes an error report, not a broken preview', () => {
  const md = markdownPlugin(new MarkdownIt(), () => { throw new Error('render() called after <dispose()>'); });
  const html = md.render('```graphviz\ndigraph {}\n```\n\nAfter');
  assert.match(html, /<pre>Graphviz error: render\(\) called after &lt;dispose\(\)&gt;<\/pre>/);
  assert.match(html, /<p>After<\/p>/);
});

const fence = (source: string) => '# Before\n```graphviz\n' + source + '\n```\nAfter';

test('a failure shows the message, escaped, with its line echoed from the source', () => {
  const md = markdownPlugin(new MarkdownIt(), () => ({
    status: 'failure', message: "syntax error near '->'\n<b>second</b> problem", line: 2
  }));
  const html = md.render(fence('digraph {\n  a -> -> b\n}'));
  assert.match(html, /<div class="graphviz-error" role="alert"><pre>Graphviz error at line 2: syntax error near '-&gt;'\n&lt;b&gt;second&lt;\/b&gt; problem\n\n2 │   a -&gt; -&gt; b<\/pre><\/div>/);
  assert.match(html, /<p>After<\/p>/);
});

test('a failure without a line shows the message only', () => {
  const md = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'the fence contains no graph' }));
  assert.match(md.render(fence('')), /<pre>Graphviz error: the fence contains no graph<\/pre>/);
});

test('a timeout states its budget; an unavailable renderer says it will retry', () => {
  const timeout = markdownPlugin(new MarkdownIt(), () => ({ status: 'timeout', budget: 3000 }));
  assert.match(timeout.render(fence('digraph {}')),
    /<div class="graphviz-error" role="alert"><pre>Graphviz layout took longer than 3 s\. Simplify or split the graph\.<\/pre><\/div>/);
  const unavailable = markdownPlugin(new MarkdownIt(), () => ({ status: 'unavailable', reason: 'out of <memory>' }));
  assert.match(unavailable.render(fence('digraph {}')),
    /<pre>Graphviz could not start: out of &lt;memory&gt;\. It will retry on the next render\.<\/pre>/);
});
