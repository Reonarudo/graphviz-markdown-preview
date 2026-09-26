# Graphviz Diagram Preview

A VS Code extension that turns DOT source, written in fenced code blocks, into
rendered diagrams inside VS Code's built-in Markdown preview.

## Language

**Graphviz fence**:
A fenced code block that this extension claims as its own and renders as a
diagram, identified by the first word of its info string being `graphviz`.
_Avoid_: dot block, DOT fence, code block, diagram block

**DOT source**:
The text inside a Graphviz fence, written in the DOT language.
_Avoid_: graph code, DOT diagram, script

**Info string**:
The text following the opening fence delimiter, which names the fence's
language and carries any attributes.
_Avoid_: fence header, language tag, fence info

**Attribute block**:
The brace-delimited portion of a Graphviz fence's info string that adjusts how
that one diagram is presented.
_Avoid_: options, params, fence args

**Delegation**:
Handing a fence this extension does not claim back to whichever fence renderer
was registered before it, so that other extensions' fences survive in the same
preview.
_Avoid_: fallthrough, passthrough, skipping

**Diagram**:
The rendered, sanitized SVG produced from a Graphviz fence's DOT source.
_Avoid_: image, picture, graph, chart — in DOT a *graph* is the source-level
`graph`/`digraph`, not the rendered output

**Figure**:
A diagram presented together with its caption, alignment, or both — as opposed
to a bare diagram, which stands alone in the preview.
_Avoid_: block, container, wrapper

**Caption**:
Plain text shown beneath a diagram, describing it for a reader who can see it.
_Avoid_: label, title, legend, description

**Description**:
Plain text conveying a diagram to a reader who cannot see it, spelled `alt` in
the attribute block by analogy with images — though a diagram is inline SVG and
has no HTML `alt` attribute.
_Avoid_: alt text, title, tooltip, a11y label

**Alignment**:
Where a figure sits across the width of the preview.
_Avoid_: float, position, justification

**Error report**:
The message block shown in place of a diagram when DOT source fails to render,
exceeds the time limit, or the renderer cannot start.
_Avoid_: error message, alert, stack trace
