# Carta - Claude Code Context

## Quick Start

Carta is a visual software architecture editor using React Flow. Users create "Constructs" (typed nodes), connect them, and compile to AI-readable output.

## Development Philosophy

**IMPORTANT: Backwards Compatibility is NOT a Concern**

This codebase is in active development. When refactoring or improving patterns:
- Remove old patterns completely—don't maintain them alongside new ones
- Update all references to use the new approach
- Don't preserve deprecated code paths "just in case"
- Simplicity and clarity take priority over backwards compatibility

Adding compatibility layers creates unnecessary complexity. Clean, modern patterns are preferred over supporting legacy approaches.

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
| `.cursor/rules/look-and-feel.mdc` | Visual depth system, island patterns |
| `.cursor/rules/styling-best-practices.mdc` | UI styling standards, spacing, buttons, colors |

## Custom Agents

Launch these agents with "launch {agent-name}" to run them in the background.

| Agent | Purpose | When to use |
|-------|---------|-------------|
| `batch-executor` | Processes all tasks sequentially | "process tasks" - small/medium tasks |
| `task-master` | Spawns parallel agents per task | "launch task-master" - large tasks |
| `style-nag` | Audits and fixes UI styling issues | After UI changes, or periodically |
| `test-builder` | Creates integration/E2E tests | When adding test coverage |

### batch-executor (recommended)

Processes all pending tasks sequentially. Handles impl, tests, or both.

```bash
./tasks/maketask fix button color
./tasks/maketask add tooltip + test
./tasks/prepare
# "process tasks"
```

- Reads `.claude/skills/testing.md` when writing tests
- More token-efficient than spawning multiple agents
- Good for small/medium tasks

**Config:** `.claude/agents/batch-executor.md`

### style-nag

Audits application UI for styling inconsistencies:
- Spacing violations (non-4px-based values)
- Button hierarchy issues (too many primary buttons competing)
- Color misuse (semantic mismatches, competing saturated colors)
- Typography inconsistencies
- Touch target violations

**Scope:** Application chrome only. Does NOT audit user-created content.

**Config:** `.claude/agents/style-nag.md`

### test-builder

Creates integration tests (Vitest) and E2E tests (Playwright):
- Integration: Hook logic, state management, adapter behavior
- E2E: User workflows, UI interactions, persistence

**Does NOT write:** Unit tests

**Config:** `.claude/agents/test-builder.md`

### task-master

Processes task files in `/tasks/inputs/` and delegates to appropriate agents:
- **TEST tasks** → `test-builder` (sonnet model)
- **IMPLEMENTATION tasks** → `task-executor` (haiku model)

Uses sonnet (needs to reliably spawn sub-agents). Delegates heavy work to sub-agents (haiku/sonnet).

**Usage:**
```bash
./tasks/maketask your task description  # Add task
./tasks/prepare                          # Concat context (saves tokens)
# Then: "launch task-master"
```

**Config:** `.claude/agents/task-master.md`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Document Store (Yjs Y.Doc)              src/stores/        │
│  - nodes[], edges[], title                                  │
│  - schemas[] (M1 construct definitions)                     │
│  - deployables[] (logical groupings)                        │
│  - portSchemas[] (M1 port type definitions)                 │
│  - Node IDs: UUID via crypto.randomUUID()                   │
│  - Persists to IndexedDB via y-indexeddb                    │
│  - Optional WebSocket sync for collaboration                │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Service Layer (Registry Facades)        src/constructs/    │
│  - registry → schema CRUD (delegates to store)              │
│  - deployableRegistry → deployable CRUD (delegates to store)│
│  - portRegistry → port schema registry with validation      │
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
│  - Dock.tsx → bottom panel with Viewer/Constructs/Deploy/   │
│              Ports tabs                                     │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `src/contexts/DocumentContext.tsx` | Document provider: manages Yjs adapter lifecycle |
| `src/stores/adapters/yjsAdapter.ts` | Yjs implementation of DocumentAdapter interface |
| `src/constructs/types.ts` | Core type definitions: PortSchema, FieldSchema, DocumentAdapter, CartaDocument, Polarity |
| `src/constructs/schemas/index.ts` | Built-in schema exports: builtInConstructSchemas, builtInPortSchemas |
| `src/constructs/schemas/built-ins.ts` | Default port schema definitions |
| `src/constructs/registry.ts` | Schema facade (syncs with adapter) |
| `src/constructs/deployables.ts` | Deployable facade (syncs with adapter) |
| `src/constructs/portRegistry.ts` | Port schema registry with polarity-based validation, wildcard support |
| `src/hooks/useGraphOperations.ts` | Node CRUD: addConstruct, deleteNode, renameNode, etc. |
| `src/hooks/useConnections.ts` | Connection logic: onConnect, handleEdgesDelete, validation |
| `src/hooks/useUndoRedo.ts` | Y.UndoManager wrapper for undo/redo (local, not shared) |
| `src/hooks/useClipboard.ts` | Copy/paste (local state, not collaborative) |
| `src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcut handling |
| `src/components/Map.tsx` | React Flow canvas, UI event handlers |
| `src/components/PortSchemaEditor.tsx` | Two-panel editor for port schemas |

## Key Design Principles

### The Dual-Mandate
All design decisions must balance two objectives:
1. **Properly bounded modeling capability** — flexible enough for any domain, restrictive enough to prevent muddled models
2. **Semantically sufficient compilation** — state must compile to AI-actionable instructions with enough meaning to generate quality output

When evaluating changes, ask: Does this expand capability without confusion? Does this preserve semantic clarity? See `.cursor/rules/metamodel-design.mdc` for full details.

### State Management
- **Document state** lives in Yjs Y.Doc via DocumentAdapter interface
- **UI state** (selection, menus, modals) stays in component useState
- **No ref patterns** for cross-component communication—use adapter directly
- Yjs auto-syncs to IndexedDB via y-indexeddb provider
- Undo/redo uses Y.UndoManager (local per-user, not shared)
- Optional WebSocket provider for real-time collaboration

### Port & Connection Model
**Consult:** `.cursor/rules/ports-and-connections.mdc`

- Edges have **no metadata**—all data lives on constructs
- **Port schemas** define port types with polarity (`source`, `sink`, `bidirectional`)
- **Built-in ports**: `flow-in`, `flow-out`, `parent`, `child`, `symmetric`, `intercept`, `forward`
- Polarity-based validation via `portRegistry.canConnect()` prevents incompatible connections
- Wildcard support in `compatibleWith`: `*`, `*source*`, `*sink*`, `*bidirectional*`
- Inverse relationships are **derivable**, never duplicated
- Port configuration is **per-schema**, not per-instance
- Port schemas stored in document store, user-editable via Ports tab

### Construct Identity
- **No `name` field** on instances—titles come from schema's `displayField` or `semanticId`
- `semanticId` is required, auto-generated as `{type}-{timestamp}{random}`
- Use `getDisplayName(data, schema)` from `src/utils/displayUtils.ts`

## Common Tasks

### Modify graph operations (add/delete/update nodes)
```
src/hooks/useGraphOperations.ts   → Node CRUD operations
src/stores/adapters/yjsAdapter.ts → updateNode with semantic ID cascade
```

### Modify connection behavior
```
src/hooks/useConnections.ts       → onConnect, handleEdgesDelete, isValidConnection
src/constructs/portRegistry.ts    → Port schema definitions, polarity-based canConnect()
src/stores/adapters/yjsAdapter.ts → Port schema CRUD (add/update/remove)
```

### Add a built-in construct type
```
src/constructs/schemas/built-ins.ts → Add to builtInConstructSchemas array
src/constructs/schemas/index.ts     → Exports builtInConstructSchemas
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

### Edit port schemas (port types)
```
src/components/PortSchemaEditor.tsx        → Port schema CRUD UI
src/constructs/portRegistry.ts             → Port validation and registry logic
src/stores/adapters/yjsAdapter.ts          → Port schema persistence
src/constructs/schemas/built-ins.ts        → Default port schema definitions
```

### Modify collaboration behavior
```
src/contexts/DocumentContext.tsx           → Document provider lifecycle
src/stores/adapters/yjsAdapter.ts          → Yjs adapter implementation
src/hooks/useUndoRedo.ts                   → Y.UndoManager configuration
src/main.tsx                               → VITE_LOCAL_MODE feature flag
```

## Testing Checklist

When modifying constructs or connections:
- [ ] Can create construct with custom ports in Schema Editor
- [ ] Can create/edit port schemas in Ports tab
- [ ] Port polarity validation works correctly (source-source blocked, etc.)
- [ ] Wildcard compatibility rules work (`*`, `*source*`, `*sink*`)
- [ ] Handles appear at correct positions on canvas
- [ ] Connections store on source construct's `connections[]`
- [ ] Compilation output includes ports and relationships
- [ ] Import clears existing document before loading (like Excalidraw)
- [ ] Export preserves port configurations and port schemas (v3 file format)
- [ ] Node titles display from displayField or semanticId
- [ ] Undo/redo works for all graph operations (local, not shared)
- [ ] Copy/paste preserves node data with new IDs
- [ ] IndexedDB persists state across page reloads
- [ ] WebSocket collaboration syncs changes between clients (when enabled)
