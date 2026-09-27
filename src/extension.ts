import type { ExtensionContext } from 'vscode';
import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import { window } from 'vscode';
import { createPreview } from './preview';

export async function activate(context: ExtensionContext): Promise<{ extendMarkdownIt(md: MarkdownIt): MarkdownIt }> {
  // Unrecognised fence attributes and Graphviz warnings never surface in the preview (ADR 0002);
  // they are reported here so an author who suspects a typo has somewhere to look.
  const channel = window.createOutputChannel('Graphviz Diagram Preview');
  context.subscriptions.push(channel);
  const preview = await createPreview(context.asAbsolutePath('dist'), (line) => channel.appendLine(line));
  context.subscriptions.push({ dispose: () => preview.dispose() });
  return { extendMarkdownIt: (md) => preview.extendMarkdownIt(md) };
}
