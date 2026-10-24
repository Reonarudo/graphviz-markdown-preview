# Changelog

## 0.2.0 — 2026-10-24

- Diagrams are rendered by graphviz-renderer 1.0.0, the library reonarudo.github.io
  uses, instead of a copy of Graphviz inside the extension. The engine is still
  Graphviz 16.0.0 (viz-js 3.30.0). **Requires VS Code 1.101 or later.**
- Error reports read `Graphviz error at line N: …` and still quote the line.
- Diagram ids are derived from the source, so identical graphs get identical ids.
- README screenshots captured from a real VS Code by `npm run screenshots`, with
  `examples/demo.md` as the document they show.

## 0.1.0 — 2026-09-27

- Render `graphviz` fences in the Markdown preview with Graphviz 16.0.0 (viz-js
  3.30.0), in a worker with a 3 s layout limit that recovers after a timeout.
- Sanitize every diagram through an SVG allowlist; keep `http:`, `https:` and
  `mailto:` links with their tooltips.
- `alt`, `caption`, `align` and `class` fence attributes; malformed attributes are
  ignored and reported in the output channel.
- Error reports quote the offending source line; Graphviz warnings go to the output
  channel.
