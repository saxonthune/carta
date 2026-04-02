---
title: Engine Changes
summary: Canvas engine rework required to support the full range of product design editors
tags: [project, canvas-engine, architecture]
deps: [doc01.03.07, doc01.04.06, doc01.01.01.01]
---

# Engine Changes

Changes needed in the canvas engine (doc01.03.07 — Canvas Engine) and presentation model (doc01.04.06 — Presentation Model) to support the product design structure editors.

## Confirmed gaps

| Gap | Needed by | Notes |
|-----|-----------|-------|
| Edge hit-testing | Process flow, state machine, ER diagram | Right-click/click on existing edges. Current engine only hit-tests connection targets. Likely solvable with SVG `pointer-events: stroke` on consumer-rendered edge paths — may not need an engine primitive. |
| Context menu integration | All Phase 2 structures | Screen position + target identity (which node/edge) on right-click. Consumers handle their own `onContextMenu` — but may want a shared pattern for positioning menus in canvas space. |

## Not needed (confirmed)

| Item | Why |
|------|-----|
| Inline text editing | Plain React `<input>` inside node component + `data-no-pan`. No engine change. |
| Node drag, selection, connection drag, viewport, keyboard shortcuts | Already exist and work as-is. |

## Still assessing

Engine changes for ER diagrams (cardinality labels on edges, node internal structure) and state machines (hierarchical states, transition guards) are not yet designed. Will be added as those structures are designed.
