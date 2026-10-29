# The view toggle

Every `graphviz` fence below carries a button in its top corner that flips it between the
diagram and the fence's source. This file is the fixture for `npm run test:preview` and the
document for the manual checklist (the source-toggle spec in `onnx-markdown-preview`, section
9.5): open it in a development window and view it in a light, a dark and a high-contrast theme.

## 1. A plain fence

```graphviz
digraph pipeline {
  rankdir = LR
  source -> parse -> layout -> render
  render -> preview
}
```

## 2. Captioned, centred: the button stays at the column edge

```graphviz {caption="Figure 1: a small state machine" align="center"}
digraph states {
  idle -> running [label="start"]
  running -> idle [label="stop"]
  running -> failed [label="error"]
  failed -> idle [label="reset"]
}
```

## 3. Right-aligned with alt: the card sits under the button

```graphviz {alt="a two-node graph" align="right"}
digraph tiny {
  a -> b
}
```

## 4. Error card: the source view shows the body alone

```graphviz
digraph broken {
  a -> ;
}
```

## 5. Long lines and a tall body: horizontal scroll, height jump

```graphviz
digraph wide {
  node [shape=box style="rounded,filled" fillcolor="#f0f4ff" fontname="Helvetica" fontsize=11 margin="0.2,0.1" penwidth=1.2 color="#334466" tooltip="a very long attribute list that runs well past the width of the preview column"]
  edge [color="#334466" arrowsize=0.8 penwidth=1.1]
  parse -> check
  check -> layout
  layout -> paint
  paint -> sanitize
  sanitize -> cache
  cache -> preview
  preview -> reader
}
```

## 6. Two identical bodies: flip the second one only, then edit this heading

```graphviz
digraph same {
  x -> y
}
```

```graphviz
digraph same {
  x -> y
}
```

## 7. An ordinary fence: no toggle, VS Code's own copy button on hover

```json
{ "compare": "hover me: the copy button is top-right, on hover only" }
```

## 8. Right-to-left container: the button moves to the left

<div dir="rtl">

```graphviz
digraph rtl {
  a -> b
}
```

</div>

## 9. Quirks

The Graphviz preview has no loading placeholder, notes or slot cache; a graph that takes longer
than the layout limit shows a timeout card, which the toggle treats like any error card.
