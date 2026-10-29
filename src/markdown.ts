import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import type { RenderInput, RenderResult } from '@reonarudo/graphviz-renderer';
import { parseAttributes, type FenceAttributes } from './attributes';

/** The class on every diagram's root `<svg>`, and the prefix of every class the preview stylesheet selects. */
export const BASE_CLASS = 'graphviz';

/**
 * `graphviz`, alone or followed by an attribute block. First word only, case-sensitive.
 *
 * A fence whose block is malformed is still claimed: the attributes are dropped and the diagram
 * renders bare, rather than falling through to another renderer as raw DOT source (ADR 0002).
 */
const CLAIMED = /^graphviz(\s+\{|$)/;

export type Render = (input: RenderInput) => RenderResult;
export type Report = (message: string) => void;

/**
 * Claim `graphviz` fences and render them as diagrams.
 *
 * Every fence we do not claim is delegated to whichever fence renderer was registered before us
 * (markdown-it's default, or another extension's, e.g. a Pikchr or gnuplot preview).
 */
export function markdownPlugin(md: MarkdownIt, render: Render, report: Report = () => {}): MarkdownIt {
  const original = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]!;
    const info = token.info.trim();
    if (!CLAIMED.test(info)) {
      return original
        ? original(tokens, index, options, env, self)
        : self.renderToken(tokens, index, options);
    }
    const { attributes, diagnostics } = parseAttributes(info);
    for (const diagnostic of diagnostics) {
      report(diagnostic);
    }
    // Before rendering, so every return path below, including the catch, has the source view.
    const source = sourceView(md, original, tokens, index, options, env, self);
    let result: RenderResult;
    try {
      result = render({ source: token.content });
    } catch (error) {
      // A throw inside a markdown-it rule would remove the whole extension from the preview.
      result = { status: 'failure', message: error instanceof Error ? error.message : String(error) };
    }
    if (result.status !== 'success') return fence(token, errorReport(md, result, token.content), source);
    return fence(token, wrap(md, sized(withClass(md, result.output, attributes.class)), attributes), source);
  };
  return md;
}

// The view toggle (docs/source-toggle-spec.md): every claimed fence is wrapped with a toggle
// button, its rendering, and the hidden source view that media/preview.js and preview.css swap.

type FenceRule = NonNullable<MarkdownIt['renderer']['rules']['fence']>;

/**
 * The source view: VS Code's highlighted `<pre><code>` for this fence, from the fence rule that
 * was registered before us, called with a shallow-cloned token so neither rule sees the other's
 * changes. Without one (bare markdown-it in a unit test) a plain escaped block stands in.
 */
function sourceView(md: MarkdownIt, original: FenceRule | undefined, ...args: Parameters<FenceRule>): string {
  const [tokens, index, options, env, self] = args;
  const token = tokens[index]!;
  if (!original) {
    const word = md.utils.escapeHtml(token.info.trim().split(/\s+/)[0] ?? '');
    return `<pre><code class="language-${word}">${md.utils.escapeHtml(token.content)}</code></pre>\n`;
  }
  const clone = Object.assign(Object.create(Object.getPrototypeOf(token)), token, {
    attrs: token.attrs ? token.attrs.map((attr) => [...attr]) : null
  });
  const copy = tokens.slice();
  copy[index] = clone;
  return unsynced(original(copy, index, options, env, self));
}

/**
 * Drop VS Code's `code-line` class and `data-line` from the delegated `<code>`, so the wrapper is
 * the one element VS Code's scroll sync sees for this fence. VS Code measures an element's height
 * up to its first nested `.code-line`; a hidden one has a zero rect, which collapsed the wrapper
 * to a pixel in rendering view and sent editor-to-preview sync to the top of the page.
 */
function unsynced(html: string): string {
  return html.replace(/^<pre><code\b[^>]*>/, (tag) =>
    tag.replace(/ data-line="[^"]*"/, '').replace(/ class="([^"]*)"/, (_, names: string) => {
      const kept = names.split(' ').filter((name) => name !== 'code-line').join(' ');
      return kept ? ` class="${kept}"` : '';
    }));
}

/**
 * The wrapper every claimed fence gets: toggle first, the rendering slot, then the source `<pre>`.
 * `code-line` and `data-line` keep VS Code's scroll sync; a token without a map (a bare string
 * through `markdown.api.render`) gets neither.
 */
function fence(token: { content: string; map: [number, number] | null }, rendering: string, source: string): string {
  const line = token.map?.[0];
  const classes = line === undefined ? `${BASE_CLASS}-fence` : `${BASE_CLASS}-fence code-line`;
  const lineAttr = line === undefined ? '' : ` data-line="${line}"`;
  return `<div class="${classes}"${lineAttr} data-fence-key="${fenceKey(token.content)}">${TOGGLE}` +
    `<div class="${BASE_CLASS}-rendering">${rendering}</div>${source}</div>\n`;
}

/** The fence key: FNV-1a, 32-bit, of the exact body, as eight hex digits. The script never hashes. */
function fenceKey(body: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    hash ^= body.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// Both glyphs ship; the stylesheet shows the one naming the view a click leads to.
const ICON_CODE = `<svg class="${BASE_CLASS}-icon-code" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">` +
  '<path d="M5.7 3.3 1 8l4.7 4.7.9-.9L2.8 8l3.8-3.8zM10.3 3.3l-.9.9L13.2 8l-3.8 3.8.9.9L15 8z"/></svg>';
const ICON_GRAPH = `<svg class="${BASE_CLASS}-icon-graph" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2">` +
  '<rect x="1.5" y="1.5" width="5" height="3.5" rx=".5"/><rect x="9.5" y="1.5" width="5" height="3.5" rx=".5"/><rect x="5.5" y="11" width="5" height="3.5" rx=".5"/>' +
  '<path d="M4 5v3h8V5M8 8v3"/></svg>';
const TOGGLE = `<button type="button" class="${BASE_CLASS}-toggle" aria-pressed="false" aria-label="Source view" title="Source view">${ICON_CODE}${ICON_GRAPH}</button>`;

/** The library's root `<svg class="graphviz" viewBox="…">`, up to its closing `>`. */
const ROOT = /^<svg\b[^>]*>/;

/** Add the author's class, escaped, beside the `graphviz` class the library put on the root. */
function withClass(md: MarkdownIt, svg: string, extra: string | undefined): string {
  if (!extra) return svg;
  return svg.replace(ROOT, (tag) => tag.replace(/\bclass="graphviz"/, `class="graphviz ${md.utils.escapeHtml(extra)}"`));
}

/**
 * Give the diagram its natural width, which the library leaves to the consumer: its SVG carries a
 * `viewBox` only, in Graphviz's points. Without it a two-node graph would stretch to the column;
 * the stylesheet still scales a wide one down.
 */
function sized(svg: string): string {
  return svg.replace(ROOT, (tag) => {
    const width = Number(/\bviewBox="[^"]*?([\d.]+)\s+[\d.]+"/.exec(tag)?.[1]);
    return width > 0 ? tag.replace(/^<svg\b/, `<svg width="${width}pt"`) : tag;
  });
}

function wrap(md: MarkdownIt, diagram: string, attributes: FenceAttributes): string {
  const escape = md.utils.escapeHtml;
  let html = diagram;
  if (attributes.alt !== undefined) {
    // `role="img"` sits inside the figure so that a caption stays outside the image role and
    // remains available to assistive technology.
    html = `<div role="img" aria-label="${escape(attributes.alt)}">${html}</div>`;
  }
  if (attributes.caption === undefined && attributes.align === undefined) {
    return html;
  }
  const classes = attributes.align
    ? `graphviz-figure graphviz-align-${attributes.align}`
    : 'graphviz-figure';
  const caption = attributes.caption === undefined
    ? ''
    : `<figcaption>${escape(attributes.caption)}</figcaption>`;
  return `<figure class="${classes}">${html}${caption}</figure>`;
}

/**
 * The error report shown in place of a diagram. Warnings never appear here — they go to the
 * output channel (ADR 0002).
 */
function errorReport(md: MarkdownIt, result: Exclude<RenderResult, { status: 'success' }>, source: string): string {
  let text: string;
  if (result.status === 'timeout') {
    text = `Graphviz layout took longer than ${result.budget / 1000} s. Simplify or split the graph.`;
  } else if (result.status === 'unavailable') {
    text = `Graphviz could not start: ${result.reason}. It will retry on the next render.`;
  } else {
    text = result.line === undefined
      ? `Graphviz error: ${result.message}`
      : `Graphviz error at line ${result.line}: ${result.message}`;
    // Echo the line, so the author need not count lines in the fence.
    const lines = source.split('\n');
    if (result.line !== undefined && result.line <= lines.length) text += `\n\n${result.line} │ ${lines[result.line - 1]}`;
  }
  return `<div class="graphviz-error" role="alert"><pre>${md.utils.escapeHtml(text)}</pre></div>\n`;
}
