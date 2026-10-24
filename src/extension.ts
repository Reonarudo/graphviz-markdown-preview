import type { ExtensionContext } from 'vscode';
import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import { window } from 'vscode';
import type { Runtime } from '@reonarudo/graphviz-renderer';
import { createPreview, type Preview } from './preview';

let runtime: Runtime | undefined;

export async function activate(context: ExtensionContext): Promise<{ extendMarkdownIt(md: MarkdownIt): MarkdownIt }> {
  // Unrecognised fence attributes and Graphviz warnings never surface in the preview (ADR 0002);
  // they are reported here so an author who suspects a typo has somewhere to look.
  const channel = window.createOutputChannel('Graphviz Diagram Preview');
  context.subscriptions.push(channel);
  const log = (line: string) => channel.appendLine(line);

  let preview: Preview;
  try {
    // Required here, not imported, so that a library that fails to load lands in this `try`
    // instead of failing activation. esbuild leaves it external (ADR 0010).
    const library: typeof import('@reonarudo/graphviz-renderer') = require('@reonarudo/graphviz-renderer');
    runtime = await library.createRuntime();
    preview = createPreview(runtime, log);
  } catch (error) {
    log(`Graphviz renderer failed to load: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    preview = createPreview({
      render: () => ({ status: 'unavailable', reason: 'the renderer failed to load; see the "Graphviz Diagram Preview" output' })
    }, log);
  }
  return { extendMarkdownIt: (md) => preview.extendMarkdownIt(md) };
}

export async function deactivate(): Promise<void> {
  await runtime?.dispose();
  runtime = undefined;
}
