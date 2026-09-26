# Graphviz output passes through an allowlist SVG sanitizer

VS Code's Markdown preview does not sanitize plugin output, so whatever an extension
emits reaches the webview verbatim. Unlike Pikchr — whose sibling extension ships no
sanitizer
([pikchr-markdown-preview ADR 0001](https://github.com/Reonarudo/pikchr-markdown-preview/blob/main/docs/adr/0001-no-svg-sanitizer.md))
— Graphviz is not benign by construction: its SVG renderer writes `fontname` and the
HTML-label `<FONT FACE>` into `font-family="…"` with no escaping
(`plugin/core/gvrender_core_svg.c`), so a `graphviz` fence can inject arbitrary
elements and attributes, and Graphviz has no switch to turn this off. Every rendered
diagram is therefore parsed and rebuilt from an allowlist, adapted from the
[gnuplot-markdown-preview](https://github.com/Reonarudo/gnuplot-markdown-preview)
sanitizer.

## Considered options

Relying on the preview's Strict CSP was rejected: it blocks script but not page-wide
CSS injection or `https:` fetches, and at the user-selectable "Allow scripts and all
content" level there is no CSP at all. Validating font names before rendering was
rejected: `FACE` values are entity-decoded inside Graphviz's HTML-label lexer, so a
pre-check would have to reimplement it.

## Consequences

Hyperlinks survive only for `http:`, `https:` and `mailto:`; every other `<a>` is
unwrapped rather than removed, so a node with a URL or tooltip never disappears.
`style` survives only as gradient-stop colour. `image=`, `shapefile=` and `<IMG SRC>`
are unsupported, and rendering uses the `svg_inline` format so no `xml-stylesheet`
processing instruction is emitted. Ids are namespaced per occurrence.

A future Graphviz release that escapes `fontname` does not by itself justify removing
the sanitizer.
