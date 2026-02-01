---
title: Frontend Architecture
status: active
---

# Frontend Architecture

Component layering, state partitioning, and structural patterns for the Carta web client.

## Four-Layer Model

Every component belongs to exactly one layer. Mixing responsibilities across layers is a code smell.

| Layer | Responsibility | Knows Business Logic? |
|-------|---------------|-----------------------|
| **Primitives** | Single visual job, no domain knowledge | Never |
| **Domain** | Business-specific UI, receives data via props | Yes, but doesn't fetch or orchestrate |
| **Container** | Data orchestration, dependency injection | Yes, owns data flow |
| **Layout** | Structural arrangement of children via slots | Never |

### Layer Rules

1. **Primitives** fully abstract HTML tags. Domain components should not use raw `<div>`, `<button>`, `<input>` directly. CSS touches primitives only.
2. **Domain components** receive everything via props (dependency inversion). They encapsulate business behavior so consumers don't need to know the details.
3. **Containers** exist at feature entry points only. Never nested. One container per route or major feature boundary.
4. **Layout components** are purely structural. Accept `children` or named slots. No business logic, no data fetching.

### Naming Convention

Names reveal purpose, not layer membership:

```
Primitives:  Button, Input, Card, Modal, Text, Icon
Domain:      ConstructNode, SchemaNode, PortHandle
Container:   Map, Metamap, App
Layout:      AppLayout, CanvasLayout
```

## State Partitioning

### By Ownership Lifecycle

| Lifetime | Where | Examples |
|----------|-------|----------|
| App (global) | Context / localStorage | Theme, AI API key |
| Document | Yjs Y.Doc via adapter | Nodes, edges, schemas, deployables |
| Component | useState | Modal open/close, hover, rename mode |
| URL | URL params | `?doc={id}` in server mode |

### By Update Frequency

| Frequency | Mechanism | Examples |
|-----------|-----------|----------|
| High (every keystroke) | useState | Form input drafts, search text |
| Medium (user actions) | Context or adapter | Schema edits, node moves |
| Low (session-level) | External store | Theme, preferences |

### By Data Source

| Source | Management | Examples |
|--------|-----------|----------|
| Server/persistent | Yjs adapter | Document data |
| Client-only | useState / Zustand | UI state, selection |
| Derived | useMemo (never stored) | Filtered lists, computed layouts |

### Colocation Principle

Keep state as close as possible to where it's used. Lift only when shared.

## Component Splitting Heuristics

**Split when:**
- Parts own independent state (prevent cascade re-renders)
- Different re-render boundaries needed
- Different data sources
- Visual pattern appears 3+ times

**Don't split when:**
- Three similar lines beat a premature abstraction
- Single-use arrangement
- Splitting adds indirection without value

## Props as Dependency Inversion

Props are the UI equivalent of dependency injection. A component defines an interface (its props), and the parent provides implementations. This enables testing in isolation, reuse in different contexts, and clear contracts.

## Container Pattern

Containers exist at feature boundaries. They orchestrate data and inject it into domain components. Extract container orchestration into hooks — the container becomes a thin shell.

```
App.tsx (layout orchestration)
  Map.tsx (container: instances canvas)
    ConstructNode (domain: receives data via props)
  Metamap.tsx (container: schema canvas)
    SchemaNode (domain)
```

## Feature Boundaries

| Feature | Data | Intent | Key Files |
|---------|------|--------|-----------|
| Canvas (instances) | Nodes, edges, connections | Build architecture | Map.tsx, useGraphOperations |
| Metamap (schemas) | Schemas, groups, port schemas | Define types | Metamap.tsx |
| Schema editing | Schema form, field tiers, ports | Create/edit types | ConstructEditor.tsx |
| Compilation | Compiled output | Generate AI output | compiler/index.ts |
| Import/Export | File I/O | Persist and share | cartaFile.ts |
| AI Assistant | Chat, tool calls | AI-assisted editing | ai/ directory |

## Progressive Disclosure for Features

| Frequency | Surfacing | Loading |
|-----------|-----------|---------|
| Every session (>10%) | Primary button, always visible | Eager |
| Regular (1-10%) | Secondary button or menu | Lazy |
| Rare (<1%) | Settings or overflow menu | Code-split |

## Audit Checklist

- Layer violations: raw HTML in domain components, business logic in layouts
- Nested containers: smart components inside smart components
- State misplacement: document data in useState, derived state stored instead of computed
- Prop drilling: props through 3+ levels without hooks/context
- Missing abstraction: repeated UI pattern (3+ places) without a primitive
- Premature abstraction: single-use wrapper component
- Mixed concerns: single component that fetches AND renders complex UI
- Service coupling: domain components directly accessing adapters
