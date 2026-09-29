# README screenshots

Real captures of VS Code's built-in Markdown preview showing `examples/demo.md` with the
packaged extension installed — not mockups. `npm run screenshots` regenerates them: it
installs the VSIX into a throwaway profile, opens the demo beside its preview in a
1357×768 window with the Default Dark Modern theme, and grabs each frame through
Playwright's Electron support, so no screen-recording permission is needed.

- `diagrams.jpg`: a dot pipeline, then a neato graph.
- `caption-and-error.jpg`: a captioned, centred diagram with a cluster and a gradient
  node, and a syntax error quoting its line.
