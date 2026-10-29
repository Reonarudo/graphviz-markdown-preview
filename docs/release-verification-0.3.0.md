# Graphviz Diagram Preview 0.3.0 verification

Release: the view toggle on every claimed fence (source-toggle spec in `onnx-markdown-preview`). Publisher: ReoX86.
Source tag: `v0.3.0` (`56aba87599aa3b442710df34100aadc0b9132fb3`).

- GitHub release: https://github.com/Reonarudo/graphviz-markdown-preview/releases/tag/v0.3.0, built by `release.yml` from the tag (https://github.com/Reonarudo/graphviz-markdown-preview/actions/runs/40857426469): lint, build, 38 unit tests, packaging and the packaged-VSIX host test under Xvfb.
- VSIX: `graphviz-diagram-preview-0.3.0.vsix`, **865 041 bytes, 45 files** (0.2.0: 860 766 bytes; the growth is `media/preview.js` and the toggle's stylesheet).
- SHA-256: `d5ff636ed14d9a5bf73773fb0ea2470513520c09949401deab5995febab56448`.
- CI passed on Linux, Windows, macOS and the VS Code 1.101.0 minimum-version job: https://github.com/Reonarudo/graphviz-markdown-preview/actions/runs/40857426310
- The release asset was downloaded, checked against the release's `SHA256SUMS`, and passed `npm run test:package -- <asset>` on VS Code 1.144.0 (2026-10-29).
- `npm run test:preview` on the tagged commit: **8 live checks passed** on VS Code 1.144.0 (2026-10-29), the required line for the first release carrying the toggle (spec 9.7).
- The manual checklist (spec 9.5: three themes, copy-button row, RTL container, focus ring, scroll sync, the extension's quirks) was done on `examples/view-toggle.md` in a development window and accepted by the user on 2026-10-29.

## Marketplace

Published on 2026-10-29 with `npx vsce publish --packagePath <release asset>`, so the Marketplace and GitHub carry the same bytes:
https://marketplace.visualstudio.com/items?itemName=ReoX86.graphviz-diagram-preview

- Listing: 0.3.0 has engine `^1.101.0`; 0.2.0 keeps `^1.101.0` and the older releases `^1.95.0`.
- Installed by ID (`ReoX86.graphviz-diagram-preview@0.3.0`) into an isolated temporary profile with VS Code 1.139.0's CLI. The installed files equal the release asset; `package.json` differs only by the `__metadata` the installer adds.

The normal profile was not modified.
