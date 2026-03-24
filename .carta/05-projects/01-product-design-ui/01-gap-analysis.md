---
title: Gap Analysis
summary: What exists today vs what's needed for structured product modeling tools
tags: [project, gap-analysis, canvas, product-modeling]
deps: [doc01.08.10, doc03.07, doc01.06.02, doc01.06.04, doc02.06]
---

# Gap Analysis

## What exists

- **Canvas engine** (doc03.07) — domain-agnostic primitives: viewport, node drag, resize, connection drag, selection, box select, keyboard shortcuts, node links. Composable via hooks. No knowledge of constructs or schemas.
- **Architecture canvas** (doc01.06.02) — typed constructs, port connections, organizers, LOD rendering, metamap. Built on the canvas engine.
- **Decision table renderer** (doc01.06.04) — draft spec for a spreadsheet-like editor with typed columns, hit policies, and implicit set collation. Not yet built.
- **Presentation model** (doc02.06) — transforms domain state into view state. Currently coupled to the architecture canvas (constructs, schemas, organizers).
- **Node shapes** — seven shape variants (default, simple, circle, diamond, document, stadium, parallelogram) dispatched by schema `nodeShape` + LOD band.
- **Layout algorithms** — flow layout (Sugiyama), constraint layout, compact nodes, hierarchical layout.
- **Structured product modeling research** (doc01.08.10) — catalogs nine structure types with editor metaphors, composition model, and mathematical grounding.

## What's missing

- **Non-canvas editors** — decision tables and enumerations are not node-and-edge tools internally, but they still live on the canvas as nodes inside file containers. They need table/list editing surfaces rendered as React components inside canvas nodes.
- **Structure-specific interaction patterns** — state machines need transition guards, ER diagrams need cardinality labels on edges, flowcharts need conditional branching at nodes. The canvas engine supports none of these natively.
- **Cross-structure references** — an entity field references an enumeration, a state machine transition uses a decision table for guard logic. No mechanism for typed cross-references between structures today.
- **Nontechnical user experience** — current canvas is designed for software architects. Product owners need guided creation flows, sensible defaults, and domain-specific vocabulary instead of generic "construct" and "port" language.
