import type { ExtensionContext } from 'vscode';
import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import { window } from 'vscode';

export function activate(context: ExtensionContext): { extendMarkdownIt(md: MarkdownIt): MarkdownIt } {
  // Unrecognised fence attributes and Graphviz warnings never surface in the preview (ADR 0002);
  // they are reported here so an author who suspects a typo has somewhere to look.
  const channel = window.createOutputChannel('Graphviz Diagram Preview');
  context.subscriptions.push(channel);
  // Graphviz fences are not claimed yet: every fence still reaches the previous renderer.
  return { extendMarkdownIt: (md) => md };
}
