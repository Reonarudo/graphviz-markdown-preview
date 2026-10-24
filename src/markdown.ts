import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import type { RenderInput, RenderResult } from '@reonarudo/graphviz-renderer';
import { parseAttributes, type FenceAttributes } from './attributes';

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
    let result: RenderResult;
    try {
      result = render({ source: token.content });
    } catch (error) {
      // A throw inside a markdown-it rule would remove the whole extension from the preview.
      result = { status: 'failure', message: error instanceof Error ? error.message : String(error) };
    }
    if (result.status !== 'success') return errorReport(md, result, token.content);
    return wrap(md, sized(withClass(md, result.output, attributes.class)), attributes);
  };
  return md;
}

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
