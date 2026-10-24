# Graphviz Diagram Preview v0.2.0

Diagrams are now rendered by [graphviz-renderer](https://github.com/Reonarudo/graphviz-renderer) 1.0.0, the same library that renders Graphviz on reonarudo.github.io, instead of a copy inside the extension. The engine is still the unmodified Graphviz 16.0.0 compiled to WebAssembly. **Requires VS Code 1.101 or later**; older versions stay on 0.1.0.

- Error reports read `Graphviz error at line N: …` and quote the offending line.
- Diagram ids are derived from the source.
