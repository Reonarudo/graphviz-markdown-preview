# Changelog

## 0.1.0 — 2026-09-27

- Render `graphviz` fences in the Markdown preview with Graphviz 16.0.0 (viz-js
  3.30.0), in a worker with a 3 s layout limit that recovers after a timeout.
- Sanitize every diagram through an SVG allowlist; keep `http:`, `https:` and
  `mailto:` links with their tooltips.
- `alt`, `caption`, `align` and `class` fence attributes; malformed attributes are
  ignored and reported in the output channel.
- Error reports quote the offending source line; Graphviz warnings go to the output
  channel.
