# Carta - Claude Code Context

## Quick Start

Carta is a visual software architecture editor using React Flow. Users create "Constructs" (typed nodes), connect them, and compile to AI-readable output.

## Cursor Rules

Detailed guidance lives in `.cursor/`:

| Rule | When to consult |
|------|-----------------|
| `.cursor/about.mdc` | Project overview, architecture, file structure |
| `.cursor/rules/react-flow.mdc` | React Flow patterns, handles, node types |
| `.cursor/rules/ports-and-connections.mdc` | Port model, connection semantics, relationship design |
| `.cursor/rules/metamodel-design.mdc` | Three-level metamodel (M2/M1/M0) |
| `.cursor/rules/clean-composable-react.mdc` | React patterns, hooks, state management |
| `.cursor/rules/yjs-collaboration.mdc` | Yjs collaboration preparation |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Document Store (Zustand)                src/stores/        │
│  - nodes[], edges[], title                                  │
│  - schemas[] (M1 construct definitions)                     │
│  - deployables[] (logical groupings)                        │
│  - Node IDs: UUID via crypto.randomUUID()                   │
│  - Auto-saves to localStorage ('carta-document')            │
│  → Future: swap localStorage adapter for Yjs Y.Doc          │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Service Layer (Registry Facades)        src/constructs/    │
│  - registry → schema CRUD (delegates to store)              │
│  - deployableRegistry → deployable CRUD (delegates to store)│
│  - These maintain API compatibility while store owns data   │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Hooks Layer                             src/hooks/         │
│  - useDocumentStore() → document state access               │
│  - useGraphOperations() → add/delete/update nodes           │
│  - useConnections() → connection management                 │
│  - useClipboard() → copy/paste (local state)                │
│  - useKeyboardShortcuts() → keyboard handling               │
│  - useUndoRedo() → undo/redo history                        │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Components (UI only)                    src/components/    │
│  - Map.tsx → React Flow bindings, context menus             │
│  - App.tsx → orchestration, modals, layout                  │
│  - ConstructNode.tsx → node rendering                       │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `src/stores/documentStore.ts` | Zustand store: nodes, edges, title, schemas, deployables |
| `src/stores/adapters/types.ts` | DocumentAdapter interface for Yjs migration |
| `src/constructs/registry.ts` | Schema facade (delegates to store) |
| `src/constructs/deployables.ts` | Deployable facade (delegates to store) |
| `src/hooks/useGraphOperations.ts` | Node CRUD: addConstruct, deleteNode, renameNode, etc. |
| `src/hooks/useConnections.ts` | Connection logic: onConnect, handleEdgesDelete, validation |
| `src/hooks/useClipboard.ts` | Copy/paste (local state, not collaborative) |
| `src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcut handling |
| `src/components/Map.tsx` | React Flow canvas, UI event handlers |

## Key Design Principles

### The Dual-Mandate
All design decisions must balance two objectives:
1. **Properly bounded modeling capability** — flexible enough for any domain, restrictive enough to prevent muddled models
2. **Semantically sufficient compilation** — state must compile to AI-actionable instructions with enough meaning to generate quality output

When evaluating changes, ask: Does this expand capability without confusion? Does this preserve semantic clarity? See `.cursor/rules/metamodel-design.mdc` for full details.

### State Management
- **Document state** lives in Zustand store (`useDocumentStore`)
- **UI state** (selection, menus, modals) stays in component useState
- **No ref patterns** for cross-component communication—use store directly
- Store auto-saves to localStorage with 500ms debounce

### Port & Connection Model
**Consult:** `.cursor/rules/ports-and-connections.mdc`

- Edges have **no metadata**—all data lives on constructs
- **Port types** (`flow-in`, `flow-out`, `parent`, `child`, `symmetric`) determine connection meaning
- Compatibility-based validation via `portRegistry.canConnect()`
- Inverse relationships are **derivable**, never duplicated
- Port configuration is **per-schema**, not per-instance

### Construct Identity
- **No `name` field** on instances—titles come from schema's `displayField` or `semanticId`
- `semanticId` is required, auto-generated as `{type}-{timestamp}{random}`
- Use `getDisplayName(data, schema)` from `src/utils/displayUtils.ts`

## Common Tasks

### Modify graph operations (add/delete/update nodes)
```
src/hooks/useGraphOperations.ts   → Node CRUD operations
src/stores/documentStore.ts       → updateNode with semantic ID cascade
```

### Modify connection behavior
```
src/hooks/useConnections.ts       → onConnect, handleEdgesDelete, isValidConnection
src/constructs/ports.ts           → Built-in port configurations
src/constructs/portRegistry.ts    → Port definitions, canConnect()
```

### Add a built-in construct type
```
src/constructs/schemas/{name}.ts  → Define ConstructSchema
src/constructs/schemas/index.ts   → Register with registry
```

### Modify compilation output
```
src/constructs/compiler/index.ts           → Main compiler logic
src/constructs/compiler/formatters/*.ts    → Format-specific output
```

### Change node appearance
```
src/components/ConstructNode.tsx   → Node rendering
src/utils/displayUtils.ts          → Node title derivation
src/index.css                      → Styling (handles, colors)
```

### Modify keyboard shortcuts
```
src/hooks/useKeyboardShortcuts.ts  → All keyboard handlers
```

### Prepare for Yjs collaboration
```
src/stores/adapters/types.ts              → DocumentAdapter interface
src/stores/adapters/localStorageAdapter.ts → Current implementation
# Future: create yjsAdapter.ts implementing same interface
```

## Testing Checklist

When modifying constructs or connections:
- [ ] Can create construct with custom ports in Schema Editor
- [ ] Handles appear at correct positions on canvas
- [ ] Connections store on source construct's `connections[]`
- [ ] Compilation output includes ports and relationships
- [ ] Import/export preserves port configurations
- [ ] Node titles display from displayField or semanticId
- [ ] Undo/redo works for all graph operations
- [ ] Copy/paste preserves node data with new IDs
