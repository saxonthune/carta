---
title: System Index
status: active
summary: System section index: architecture, state, interfaces, decisions
tags: [index, architecture]
deps: []
---

# System

Architecture and technical design. How Carta is built — the layers, the state model, the interfaces, and the decisions that shaped them.

## Audience

Developers working on Carta's internals. Read the overview (doc02.01) first for layer orientation, then dive into specific subsystems as needed. Architects should also read the ADRs (doc02.04) to understand why things are the way they are.

## What belongs here

- Layer architecture and package structure
- State management (Yjs, adapters, hooks)
- External interfaces (file format, MCP, WebSocket, compiler output)
- Architecture decision records (ADRs)
- Deployment configuration
- Metamodel (schema system, ports, fields)
- Design system (visual language, depth, typography)
- Frontend architecture (component layers, data pipelines)
- Presentation model (organizers, layout strategies)
- Canvas engine (viewport, connections, primitives)

## What does NOT belong here

- Feature descriptions from the user's perspective — those go in `03-product/`
- Why Carta exists or what it values — that goes in `01-context/`
- How to set up a dev environment — that goes in `04-operations/`

## Contents

| Ref | Item | Summary |
|-----|------|---------|
| doc02.01 | Overview | Layer architecture, monorepo structure, data flow |
| doc02.02 | State | Yjs Y.Doc, state partitioning, hooks, adapters |
| doc02.03 | Interfaces | File format, compiler output, MCP, WebSocket |
| doc02.04 | Decisions | ADR directory (Yjs state, port polarity, formatters, etc.) |
| doc02.05 | Deployment Targets | VITE_SYNC_URL, VITE_AI_MODE, document sources |
| doc02.06 | Metamodel | M2/M1/M0, DataKind, ConstructSchema |
| doc02.07 | Design System | Depth system, island pattern, colors, typography |
| doc02.08 | Frontend Architecture | Four-layer component model, state partitioning |
| doc02.09 | Presentation Model | Organizers, layout strategies, visual vs semantic |
| doc02.10 | Canvas Data Pipelines | Map.tsx memo cascades, node/edge pipelines |
| doc02.11 | Canvas Engine | Viewport, connections, composition pattern |
