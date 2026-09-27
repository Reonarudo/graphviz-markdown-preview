import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import { markdownPlugin } from './markdown';
import { createRenderer, createRuntime } from './renderer';
import { sanitizeSvg } from './sanitizer';

export interface Preview {
  extendMarkdownIt(md: MarkdownIt): MarkdownIt;
  dispose(): void;
}

/**
 * Assemble the preview: the Graphviz worker, the sanitizer as the cache's cleaner, and the fence
 * plugin. Kept free of `vscode` so it can be exercised end to end in tests.
 *
 * `log` receives what never reaches the preview (ADR 0002): attribute diagnostics, and Graphviz's
 * warnings — once per fresh render, labelled with the fence's first line so the author can find it.
 */
export async function createPreview(distDirectory: string, log: (line: string) => void): Promise<Preview> {
  const runtime = await createRuntime(distDirectory);
  const render = createRenderer(runtime, sanitizeSvg, (source, result) => {
    if (result.status !== 'success') return;
    for (const warning of result.errors) {
      log(`${label(source)}: ${warning.message.replace(/^Warning:\s*/, '').trim()}`);
    }
  });
  return {
    extendMarkdownIt: (md) => markdownPlugin(md, render, log),
    dispose: () => runtime.dispose()
  };
}

function label(source: string): string {
  const first = source.trim().split('\n', 1)[0]!.trim();
  return first.length > 60 ? `${first.slice(0, 59)}…` : first;
}
