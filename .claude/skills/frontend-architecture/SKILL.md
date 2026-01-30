---
name: frontend-architecture
description: Frontend architecture principles for auditing Carta's component design, state partitioning, and layering decisions
---

# Frontend Architecture Principles

These principles govern how Carta's UI should be structured. Use them to audit existing code for refactoring opportunities and to guide high-level design decisions.

## The Four Layers

Every component belongs to exactly one layer. Mixing responsibilities across layers is a code smell.

| Layer | Idiomatic Name | Responsibility | Knows About Business Logic? |
|-------|---------------|----------------|-----------------------------|
| **Primitives** | Base Components | Single visual job, no domain knowledge | Never |
| **Domain** | Domain Components | Business-specific UI, receives data via props | Yes, but doesn't fetch or orchestrate |
| **Container** | Page/Container Components | Data orchestration, dependency injection | Yes, owns data flow |
| **Layout** | Layout Components | Structural arrangement of children via slots | Never |

### Layer Rules

1. **Primitives** should fully abstract HTML tags. Domain components should never use raw `<div>`, `<p>`, `<button>`, `<table>`, `<form>`, `<input>` directly. CSS should only touch primitives.
2. **Domain components** receive everything via props (dependency inversion). They encapsulate business behavior (loading states, error handling, side effects) so consumers don't need to know the details.
3. **Containers** exist at feature entry points only. They are never nested. One container per route or major feature boundary.
4. **Layout components** are purely structural. They accept `children` or named slots. No business logic, no data fetching, no conditional rendering based on user roles.

### Naming Convention

Names should reveal purpose, not layer membership:

```
Base:      Button, Input, Card, Modal, Text, Icon
Domain:    ConstructNode, SchemaNode, AddConstructButton, PortHandle
Container: ProductPage, CartPage (suffix describes placement)
Layout:    AppLayout, DashboardLayout, CanvasLayout
Hook:      useCart, useDocument, useConnections
Service:   cartService, compilerService
```

Avoid generic suffixes like `Container`, `Domain`, `Feature` that describe architecture rather than purpose.

## State Partitioning

State should be partitioned by three dimensions:

### By Ownership Lifecycle

| Lifetime | Where It Lives | Carta Examples |
|----------|---------------|----------------|
| App lifetime (global) | Context / external store | Theme, user auth |
| Document lifetime | Yjs Y.Doc via adapter | Nodes, edges, schemas, deployables |
| Component lifetime | `useState` | Modal open/close, hover state, rename mode |
| URL lifetime | URL params | `?doc={id}` in server mode, view mode |

### By Update Frequency

| Frequency | Mechanism | Examples |
|-----------|-----------|----------|
| High (every keystroke) | `useState` | Form input drafts, search text |
| Medium (user actions) | Context or adapter | Schema edits, node moves |
| Low (session-level) | External store | Theme, preferences |

### By Data Source

| Source | Management | Examples |
|--------|-----------|----------|
| Server/persistent state | Yjs adapter (or TanStack Query for REST) | Document data |
| Client-only state | `useState` / Zustand | UI state, selection |
| Derived state | `useMemo` (never stored) | Filtered lists, computed layouts |
| Device state | Custom hooks | Window size, online/offline |

### The Colocation Principle

Keep state as close as possible to where it's used. Lift only when shared. If two sibling components need the same state, lift to their parent. If widely shared, use context or external store.

## Component Partitioning Heuristics

### When to Split a Component

- **Different state owners**: If parts of a component own independent state, split them so updates don't cascade.
- **Different re-render boundaries**: Isolate expensive renders behind component boundaries.
- **Different data sources**: Each data dependency is a candidate for a separate component.
- **Reuse potential**: If a visual pattern appears twice, extract it.

### When NOT to Split

- Three similar lines of code is better than a premature abstraction.
- Don't create a component for a one-time arrangement.
- Don't split purely for "cleanliness" if it adds indirection without value.

## Props as Dependency Inversion

Props are the UI equivalent of dependency injection. A component defines an interface (its props), and the parent provides implementations.

```tsx
// Component declares what it needs (interface)
interface ConstructNodeProps {
  data: ConstructNodeData
  onDelete: (id: string) => void
  onUpdate: (id: string, values: Record<string, unknown>) => void
}

// Parent provides implementations (injection)
<ConstructNode
  data={node.data}
  onDelete={graphOps.deleteNode}
  onUpdate={graphOps.updateNodeValues}
/>
```

Benefits:
- Testable in isolation (pass mock functions)
- Reusable in different contexts (different implementations)
- Clear contract between parent and child

## Container Pattern

### Containers Are Not Nested

Containers exist at feature boundaries (pages, major views). They orchestrate data and inject it into domain components. Nesting containers creates dependency chains and testing nightmares.

```
// CORRECT: One container per feature boundary
App.tsx (layout orchestration)
  Map.tsx (container for instances canvas)
    ConstructNode (domain, receives data via props)
    VirtualParentNode (domain)
  Metamap.tsx (container for schema canvas)
    SchemaNode (domain)
    SchemaGroupNode (domain)
```

### Custom Hooks as Container Logic

Extract container orchestration into hooks. The container component becomes a thin shell that calls hooks and renders domain components.

```tsx
// Hook owns the orchestration
function useCanvasState() {
  const { nodes, edges, schemas } = useDocument()
  const graphOps = useGraphOperations()
  const connections = useConnections()
  const undoRedo = useUndoRedo()
  return { nodes, edges, schemas, graphOps, connections, undoRedo }
}

// Container is just wiring
function Map() {
  const state = useCanvasState()
  return <ReactFlow nodes={state.nodes} edges={state.edges} ... />
}
```

## Service Abstraction

Operations that can have multiple implementations should be abstracted behind service interfaces, provided via context or hooks:

```tsx
// Abstract: what, not how
interface CompilerService {
  compile(document: CartaDocument): CompileOutput
}

// Implementation chosen by context
function useCompilerService(): CompilerService {
  // Could return different implementations based on environment
}
```

This enables swapping implementations (local vs remote, real vs mock) without changing domain components.

## Feature Boundaries (Bounded Contexts)

Features are vertical slices containing their own components, hooks, and state. Identify boundaries by asking:

1. **Different data sources?** Different API endpoints or store slices.
2. **Different user intents?** Browsing vs editing vs configuring.
3. **Different business rules?** Port validation vs schema creation vs compilation.
4. **Cohesive data?** Data that changes together belongs together.

### Carta's Feature Boundaries

| Feature | Data | Intent | Key Files |
|---------|------|--------|-----------|
| Canvas (instances) | Nodes, edges, connections | Build architecture models | Map.tsx, useGraphOperations, useConnections |
| Metamap (schemas) | Schemas, schema groups, port schemas | Define construct types | Metamap.tsx, useMetamapLayout |
| Compilation | Compiled output | Generate AI-readable output | compiler/index.ts, CompileModal |
| Import/Export | File I/O | Persist and share | cartaFile.ts, documentImporter |
| AI Assistant | Chat messages, tool calls | AI-assisted editing | ai/ directory |

## React Flow as a Primitive

React Flow (`<ReactFlow>`, `<Handle>`, `useReactFlow()`) is a primitive layer component. It provides pan/zoom canvas, node rendering, edge routing, selection, and handle systems. Carta layers domain behavior on top.

Both `Map.tsx` and `Metamap.tsx` are independent containers that use the same React Flow primitive with different node types, edge behavior, and interaction models. If a third canvas were added, that would be the trigger to extract shared canvas infrastructure into a `useCanvasBase()` hook.

## Progressive Disclosure for Features

Not all features need equal visibility. Surface features based on usage frequency:

| Frequency | Surfacing | Optimization |
|-----------|-----------|-------------|
| Every session (>10% of users) | Primary button, always visible | Eagerly loaded |
| Regular (1-10%) | Secondary button or menu item | Lazy loaded |
| Rare (<1%) | Settings page or overflow menu | Code-split |
| Admin/power user | Behind permissions or feature flags | Conditionally included |

## Audit Checklist

When reviewing Carta code, check for:

- [ ] **Layer violations**: Does a domain component use raw HTML tags? Does a layout component contain business logic?
- [ ] **Nested containers**: Are there smart components rendered inside other smart components?
- [ ] **State misplacement**: Is server/document state stored in `useState`? Is derived state being stored instead of computed?
- [ ] **Prop drilling**: Are props passed through more than 2 levels? Consider hooks or context.
- [ ] **Missing abstraction**: Are raw HTML elements used where a base component should exist?
- [ ] **Premature abstraction**: Is there a wrapper component used only once?
- [ ] **Mixed concerns**: Does a single component fetch data AND render complex UI?
- [ ] **Fat components**: Does a component have more than 7-10 props for behavior (not styling)?
- [ ] **Service coupling**: Do domain components directly call APIs or access adapters?
- [ ] **Re-render waste**: Could isolating a frequently-updating piece into its own component prevent unnecessary re-renders of siblings?
