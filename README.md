# Graphviz Diagram Preview

Adds Graphviz (DOT) support to VS Code's built-in Markdown preview. Diagrams are
drawn by [graphviz-renderer](https://github.com/Reonarudo/graphviz-renderer), the
same library that renders Graphviz on reonarudo.github.io. Requires VS Code 1.101
or later; older versions stay on 0.1.0.

Write DOT source in a fence tagged `graphviz`:

````markdown
```graphviz
digraph {
  rankdir=LR
  source -> parse -> render
}
```
````

Only `graphviz` fences are claimed — `dot` fences are left to other renderers.
To use another layout engine, set it inside the source, e.g. `layout=neato`.

![A dot pipeline and a neato graph rendered in VS Code's built-in Markdown preview](media/screenshots/diagrams.jpg)

## Fence attributes

An optional attribute block after the tag adjusts how one diagram is presented:

````markdown
```graphviz {alt="Three stages, left to right" caption="Figure 1: Pipeline" align="center"}
digraph { rankdir=LR; source -> parse -> render }
```
````

| Attribute | Effect |
| --- | --- |
| `alt` | Description for readers who cannot see the diagram |
| `caption` | Text shown beneath the diagram |
| `align` | `left`, `center` or `right` |
| `class` | Extra CSS class on the diagram's `<svg>` |

Values are quoted. A mistyped or malformed attribute never costs you the
diagram: it is ignored, and a note is written to the *Graphviz Diagram Preview*
output channel.

![A captioned, centred diagram with a cluster and a gradient node, and a syntax error report quoting its line](media/screenshots/caption-and-error.jpg)

## Errors and limits

A DOT syntax error is shown in place of the diagram, with the offending source
line. Layout is limited to 3 seconds per diagram and 64 000 characters of source; a graph
that takes longer shows a timeout message until its source changes. Graphviz
warnings (unknown shapes, fonts without metrics) go to the output channel.

Links (`URL`, `href`) work for `http:`, `https:` and `mailto:` and keep their
tooltips; other links are removed but the node stays. Images (`image=`,
`<IMG SRC>`) are not supported. The extension reads no files, so it works fully
in Restricted Mode and virtual workspaces.

## Fonts

Graphviz measures text with built-in width tables, so labels fit their shapes
only for these families: Times / Times New Roman, Helvetica / Arial,
Courier / Courier New, DejaVu Sans, Consolas, Nunito, Trebuchet. Other fonts are
measured as Times, and a warning is written to the *Graphviz Diagram Preview*
output channel. Name a single family — a CSS-style list such as
`fontname="Helvetica,Arial,sans-serif"` or a generic family such as `sans-serif`
is measured as Times.

## Development

Requires Node 22 or newer (see `.nvmrc`).

```sh
npm ci
npm run lint            # tsc --noEmit
npm test                # node --test, after building
npm run package         # vsce package
npm run test:package    # the VSIX inside a real VS Code
npm run screenshots     # regenerate media/screenshots from examples/demo.md
```

## License

MIT for this extension; Graphviz, shipped inside graphviz-renderer, is EPL-2.0 — see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
