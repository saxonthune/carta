---
title: Canvas
status: active
summary: Visual architecture editor — typed constructs, ports, connections, LOD rendering
tags: [canvas, editor, constructs, ports]
deps: [doc01.01.01]
---

# Canvas

The canvas is Carta's visual architecture editor. Users create typed constructs, connect them via ports, and organize them visually with organizers. The canvas operates on a three-level metamodel (M2/M1/M0) that makes it domain-agnostic.

## Key Capabilities

- **Typed constructs**: Nodes on the canvas, each an instance of a user-defined schema
- **Port connections**: Directional relationships with five-value polarity model
- **Schema packages**: Bundled vocabulary sets (Software Architecture, BPMN, AWS, etc.)
- **Organizers**: Visual grouping containers that don't affect semantic meaning
- **LOD rendering**: Level-of-detail bands that simplify nodes at low zoom
- **Multiple pages**: Separate architectural views sharing the same schema vocabulary
- **Metamap**: Schema-level editor for defining types and their relationships

## Architecture

Canvas architecture is documented in the 02-architecture/04-canvas/ title:

- **State**: doc02.04.01 — Yjs Y.Doc, state partitioning, hooks, adapters
- **Metamodel**: doc02.04.02 — M2/M1/M0, DataKind, ConstructSchema
- **Frontend**: doc02.04.03 — Four-layer component model
- **Presentation**: doc02.04.04 — Organizers, layout strategies, node dispatch
- **Pipelines**: doc02.04.05 — Memo cascades, node/edge data flow
- **Engine**: doc02.04.06 — Canvas engine primitives (viewport, connections, selection)
- **Design**: doc02.04.07 — Visual specifications for nodes, edges, LOD
- **Glossary**: doc02.04.08 — Canvas-specific vocabulary
