import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { sanitizeSvg, namespaceSvg } from '../src/sanitizer';

const require = createRequire(import.meta.url);
let viz: { render(source: string, options: { format: string }): { status: string; output?: string } };
before(async () => { viz = await require('../vendor/viz/viz.cjs').instance(); });

/** Render DOT exactly as the worker does, so every case runs against real Graphviz output. */
function dot(source: string): string {
  const result = viz.render(source, { format: 'svg_inline' });
  assert.equal(result.status, 'success', source);
  return result.output!;
}

test('plain Graphviz output becomes a namespaced SVG with its shapes and labels', () => {
  const svg = sanitizeSvg(dot('digraph { hello -> world }'));
  assert.match(svg, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<ellipse /);
  assert.match(svg, />hello<\/text>/);
  assert.match(svg, /<path /);
  assert.doesNotMatch(svg, /<!--/);
});

/**
 * Sanitize, treating a refusal (malformed XML after a breakout) as an acceptable outcome — its
 * message ends up in the error report, so it is checked along with any output.
 */
function sanitizedOrRefused(svg: string): string {
  try { return sanitizeSvg(svg); } catch (error) { return (error as Error).message; }
}

test('markup injected through fontname or FONT FACE never survives', () => {
  for (const source of [
    'digraph { a [fontname="Arial\\" onload=\\"alert(1)\\" x=\\""] }',
    'digraph { a [fontname="x\\"/><script>alert(1)</script><foreignObject><img src=https://evil.example/x></foreignObject><text x=\\""] }',
    'digraph { a [fontname="x\\" style=\\"position:fixed;background:url(https://evil.example/t)"] }',
    'digraph { a [label=<<FONT FACE="x&quot; onload=&quot;alert(1)">hi</FONT>>] }',
    'digraph { a [fontname="x\\"/><a href=\\"javascript:alert(1)\\"><text>click</text></a><text x=\\""] }'
  ]) {
    const output = sanitizedOrRefused(dot(source));
    assert.doesNotMatch(output, /<script|onload|<foreignObject|<img|style=|javascript:|https:/, source);
  }
});

test('a node with an unsafe link or only a tooltip keeps its shapes but loses the link', () => {
  for (const attrs of [
    'URL="javascript:alert(1)"',
    'href="&#106;avascript:alert(1)"',
    'href="data:text/html,<script>alert(1)</script>"',
    'URL="vscode://some.extension/run"',
    'URL="relative/page.html"',
    'tooltip="just a tooltip"'
  ]) {
    const svg = sanitizeSvg(dot(`digraph { node1 [${attrs}] }`));
    assert.match(svg, /<ellipse /, attrs);
    assert.match(svg, />node1<\/text>/, attrs);
    assert.doesNotMatch(svg, /<a[\s>]|javascript|data:|vscode:|relative/, attrs);
  }
});

test('http, https and mailto links survive with their tooltip; target does not', () => {
  for (const [url, expected] of [
    ['https://graphviz.org/docs/', 'https://graphviz.org/docs/'],
    ['http://example.com/a?b=1&c=2', 'http://example.com/a?b=1&amp;c=2'],
    ['mailto:someone@example.com', 'mailto:someone@example.com']
  ] as const) {
    const svg = sanitizeSvg(dot(`digraph { a [URL="${url}" tooltip="Open the docs" target="_blank"] }`));
    assert.match(svg, new RegExp(`<a xlink:href="${expected.replace(/[?.]/g, '\\$&')}" xlink:title="Open the docs">`), url);
    assert.match(svg, /<ellipse /, url);
    assert.doesNotMatch(svg, /target=/, url);
  }
});

test('gradient stops keep their colours and Graphviz classes survive', () => {
  const svg = sanitizeSvg(dot('digraph { a [style=filled fillcolor="red:blue" class="highlight"] }'));
  assert.match(svg, /<stop offset="0" style="stop-color:red;stop-opacity:1\.;"\/>/);
  assert.match(svg, /<stop offset="1" style="stop-color:blue;stop-opacity:1\.;"\/>/);
  assert.match(svg, /fill="url\(#[^)]+\)"/);
  assert.match(svg, /class="node highlight"/);
  assert.match(svg, /class="graph"/);
});

test('style is dropped everywhere except on gradient stops', () => {
  const svg = sanitizedOrRefused(dot('digraph { a [fontname="x\\" style=\\"stop-color:red;background:url(https://evil.example/t)"] }'));
  assert.doesNotMatch(svg, /style=|evil/);
});

test('two copies of one diagram get distinct ids that each reference only themselves', () => {
  const svg = sanitizeSvg(dot('digraph { a [style=filled fillcolor="red:blue"] b -> a }'));
  const ids = (s: string) => [...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
  const refs = (s: string) => [...s.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map((m) => m[1] ?? m[2]!);
  const first = namespaceSvg(svg, 'd1-');
  const second = namespaceSvg(svg, 'd2-');
  assert.ok(refs(first).length > 0);
  assert.deepEqual(ids(first).filter((id) => ids(second).includes(id)), []);
  for (const copy of [first, second]) {
    for (const ref of refs(copy)) assert.ok(ids(copy).includes(ref), ref);
  }
});
