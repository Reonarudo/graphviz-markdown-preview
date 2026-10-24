import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import type { RenderResult, Runtime } from '@reonarudo/graphviz-renderer';
import { createHash } from 'node:crypto';
import { markdownPlugin, type Render } from './markdown';

const maxEntries = 96;

export interface Preview {
  extendMarkdownIt(md: MarkdownIt): MarkdownIt;
}

/**
 * Assemble the preview: the library runtime behind a cache, and the fence plugin. Kept free of
 * `vscode` so it can be exercised end to end in tests.
 *
 * `log` receives what never reaches the preview (ADR 0002): attribute diagnostics, and Graphviz's
 * notes — once per fresh render, labelled with the fence's first line so the author can find it.
 */
export function createPreview(runtime: Pick<Runtime, 'render'>, log: (line: string) => void): Preview {
  const render = createRenderer(runtime, (source, result) => {
    if (result.status !== 'success') return;
    for (const note of result.notes) log(`${label(source)}: ${note}`);
  });
  return { extendMarkdownIt: (md) => markdownPlugin(md, render, log) };
}

/**
 * Put a cache in front of the runtime, so re-rendering an unchanged fence on every keystroke costs
 * a lookup rather than a layout. The library does not cache (ADR 0003).
 *
 * Outcomes are cached, timeouts included: a graph too dense to lay out is not retried until its
 * source changes, so it does not block the extension host for the full budget on every edit
 * elsewhere in the document. `onFresh` hears every real render — never a cache hit — so notes are
 * logged once rather than on every keystroke.
 */
export function createRenderer(
  runtime: Pick<Runtime, 'render'>,
  onFresh: (source: string, result: RenderResult) => void = () => {}
): Render {
  const cache = new Map<string, RenderResult>();
  return ({ source }) => {
    const key = createHash('sha256').update(source).digest('hex');
    let result = cache.get(key);
    if (result) {
      // Re-insert so Map order tracks recency and the first key is the least recently used.
      cache.delete(key);
    } else {
      result = runtime.render({ source });
      onFresh(source, result);
      // An unavailable renderer says nothing about this source; the next render retries.
      if (result.status === 'unavailable') return result;
    }
    cache.set(key, result);
    if (cache.size > maxEntries) cache.delete(cache.keys().next().value!);
    return result;
  };
}

function label(source: string): string {
  const first = source.trim().split('\n', 1)[0]!.trim();
  return first.length > 60 ? `${first.slice(0, 59)}…` : first;
}
