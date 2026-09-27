# Graphviz Diagram Preview 0.1.0 verification

Release date: 2026-09-27. Publisher: ReoX86. Identifier: `ReoX86.graphviz-diagram-preview`.

## Artifact

- Source tag: `v0.1.0` (`a60d784`).
- GitHub release: https://github.com/Reonarudo/graphviz-markdown-preview/releases/tag/v0.1.0
- VSIX: `graphviz-diagram-preview-0.1.0.vsix`.
- SHA-256: `67cf7e4c4fcfae99131fa0e0ca52d9d8284ee240317e4d5d1c31de34229de80d`.

## Validation

- TypeScript check and 46 automated tests pass.
- Packaged VSIX passes the real VS Code host test in an isolated temporary profile.
- CI passes on Linux, Windows and macOS, including VS Code 1.95.0 compatibility:
  https://github.com/Reonarudo/graphviz-markdown-preview/actions/runs/36328253762
- The original Windows checksum failure was caused by Git converting vendor metadata
  to CRLF. `.gitattributes` now preserves all vendored bytes; the checksum test passes
  unchanged on Windows.
- Packaged renderer, worker, vendor module, icon and stylesheet match the checked build.

## Marketplace

Published under the personal ReoX86 publisher:
https://marketplace.visualstudio.com/items?itemName=ReoX86.graphviz-diagram-preview

Marketplace verification passed. Version 0.1.0 installed successfully from the store
in an isolated temporary VS Code profile. The installed renderer, worker, vendor
module, icon and stylesheet match the released VSIX byte-for-byte.
The normal VS Code profile was not modified.
