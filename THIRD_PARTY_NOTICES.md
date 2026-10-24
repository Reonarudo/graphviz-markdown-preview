# Third-party notices

The extension's original TypeScript, tests, build scripts, and artwork are MIT
licensed (see `LICENSE`). This does not relicense bundled software.

## Graphviz renderer

Diagrams are rendered by
[graphviz-renderer](https://github.com/Reonarudo/graphviz-renderer) (MIT), shipped
in this extension under `node_modules/@reonarudo/graphviz-renderer/`. It carries
**Graphviz 16.0.0**, the unmodified official release compiled to WebAssembly by
viz-js 3.30.0. Its own `THIRD_PARTY_NOTICES.md` and `licenses/` directory give the
engine's provenance and licenses; keep them with any redistribution:

- Graphviz 16.0.0, under the Eclipse Public License 2.0
  (`licenses/GRAPHVIZ-EPL-2.0`); copyright AT&T and the Graphviz contributors,
  <https://graphviz.org>.
- viz-js 3.30.0 by Michael Daines, MIT (`licenses/VIZ-JS-LICENSE`).
- Expat 2.8.4, MIT (`licenses/EXPAT-COPYING`).
- The Emscripten runtime, MIT / University of Illinois/NCSA
  (`licenses/EMSCRIPTEN-LICENSE`).

## xmldom

[`@xmldom/xmldom`](https://github.com/xmldom/xmldom), used by the renderer's SVG
sanitizer, is shipped under `node_modules/@xmldom/xmldom/` with its MIT license. The
exact version is locked in `package-lock.json`.
