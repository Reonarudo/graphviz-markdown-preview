# Graphviz Diagram Preview

## Pipeline

```graphviz
digraph {
  rankdir=LR
  node [shape=box style="rounded,filled" fillcolor=lightyellow]
  source -> parse -> layout -> render
  parse -> error [label="bad input" style=dashed]
}
```

## Neato layout

```graphviz
graph {
  layout=neato
  node [style=filled fillcolor=lightblue]
  a -- b -- c -- a
  c -- d
}
```

## Caption, colours and a gradient

```graphviz {alt="Compiler stages with a gradient node" caption="Figure 1: Front end to code generation" align="center"}
digraph {
  node [style=filled]
  subgraph cluster_front { label="Front end"; fillcolor=lightyellow; style=filled; lexer -> parser }
  codegen [fillcolor="red:orange"]
  parser -> codegen [color=darkgreen]
}
```

## Syntax error

```graphviz
digraph {
  x -> ;
}
```
