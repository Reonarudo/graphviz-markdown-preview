import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import type { RenderResult } from './renderer';
import { parseAttributes, type FenceAttributes } from './attributes';
import { namespaceSvg } from './sanitizer';
import { randomBytes } from 'node:crypto';

/** The class on every diagram's root `<svg>`, so the preview stylesheet can select it. */
export const BASE_CLASS = 'graphviz';

/**
 * `graphviz`, alone or followed by an attribute block. First word only, case-sensitive.
 *
 * A fence whose block is malformed is still claimed: the attributes are dropped and the diagram
 * renders bare, rather than falling through to another renderer as raw DOT source (ADR 0002).
 */
const CLAIMED = /^graphviz(\s+\{|$)/;

export type Render = (source: string) => RenderResult;
export type Report = (message: string) => void;

/**
 * Claim `graphviz` fences and render them as diagrams.
 *
 * Every fence we do not claim is delegated to whichever fence renderer was registered before us
 * (markdown-it's default, or another extension's, e.g. a Pikchr or gnuplot preview).
 */
export function markdownPlugin(md: MarkdownIt, render: Render, report: Report = () => {}): MarkdownIt {
  const original = md.renderer.rules.fence;
  // Graphviz reuses ids like `node1_l_0` in every diagram, and a cached diagram can appear twice,
  // so every occurrence gets its own prefix.
  const session = randomBytes(6).toString('hex');
  let occurrence = 0;
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
    const result = render(token.content);
    if (result.status !== 'success') return errorReport(md, result, token.content);
    const svg = namespaceSvg(result.output, `gv-${session}-${++occurrence}-`);
    return wrap(md, withClass(md, svg, attributes.class), attributes);
  };
  return md;
}

/** Put our base class — and the author's, if any — on the root `<svg>` Graphviz left unclassed. */
function withClass(md: MarkdownIt, svg: string, extra: string | undefined): string {
  const classes = extra ? `${BASE_CLASS} ${extra}` : BASE_CLASS;
  return svg.replace(/^<svg\b/, `<svg class="${md.utils.escapeHtml(classes)}"`);
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
    text = 'Graphviz layout took longer than 3 s. Simplify or split the graph.';
  } else if (result.status === 'unavailable') {
    text = `Graphviz could not start: ${result.reason}. It will retry on the next render.`;
  } else {
    const messages = result.errors
      .filter((error) => error.level === 'error')
      .map((error) => error.message.replace(/^(?:Error|Warning):\s*/, '').trim());
    text = messages.join('\n');
    // Echo the line Graphviz names, so the author need not count lines in the fence.
    const line = Number(/\bin line (\d+)\b/.exec(text)?.[1]);
    const lines = source.split('\n');
    if (line >= 1 && line <= lines.length) text += `\n\n${line} │ ${lines[line - 1]}`;
  }
  return `<div class="graphviz-error" role="alert"><pre>${md.utils.escapeHtml(text)}</pre></div>\n`;
}
