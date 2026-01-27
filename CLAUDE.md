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
| `documentation-nag` | Keeps docs in sync with code | After significant code changes |

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

### documentation-nag

Keeps documentation synchronized with code changes:
- `CLAUDE.md` - Key files, common tasks, architecture
- `.cursor/rules/about.mdc` - Component tree, file structure
- `tasks/context.md` - Quick reference for task agents

**Scope:** Structural changes, new components, new patterns.

**Config:** `.claude/agents/documentation-nag.md`

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
│  - schemaGroups[] (schema grouping metadata)                │
│  - Node IDs: UUID via crypto.randomUUID()                   │
│  - Persists to IndexedDB via y-indexeddb                    │
│  - Optional WebSocket sync for collaboration (server mode)  │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  DocumentAdapter Interface               src/stores/        │
│  - adapters/yjsAdapter.ts → Yjs implementation              │
│  - DocumentContext → manages adapter lifecycle              │
│  - All state operations go through adapter methods          │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Hooks Layer                             src/hooks/         │
│  - useDocument() → document state access and operations     │
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
│  - Drawer.tsx → right-side panel with Constructs/Ports/     │
│                Groups/Deployables tabs                      │
└─────────────────────────────────────────────────────────────┘
```

## Hosting Modes

Carta supports two deployment modes determined at build time:

### Static Mode (Default for Development)
- **Purpose**: Single-user offline-first editing (like Excalidraw)
- **Storage**: IndexedDB only (persistent local state)
- **URL**: No document parameter needed
- **UI**: Share button and connection status are hidden
- **Use case**: Personal use, demos, development

```bash
npm run dev          # Static mode (VITE_STATIC_MODE=true)
```

### Server Mode
- **Purpose**: Multi-user collaboration with server-stored documents
- **Storage**: Server database (MongoDB) with IndexedDB caching
- **URL**: Requires `?doc={documentId}` parameter
- **UI**: Share button, connection status, document browser
- **Behavior**: Without `?doc=` param, user must select/create a document
- **Use case**: Team collaboration, shared projects

```bash
npm run server       # Start MongoDB + collab server
npm run dev:client   # Start client in server mode
```

Visit `http://localhost:5173/?doc=my-document-id` to open a specific document.

### Key Files

| File | Purpose |
|------|---------|
| `src/contexts/DocumentContext.tsx` | Document provider: manages Yjs adapter lifecycle |
| `src/stores/adapters/yjsAdapter.ts` | Yjs implementation of DocumentAdapter interface |
| `src/constructs/types.ts` | Core type definitions: PortSchema, FieldSchema, DocumentAdapter, CartaDocument, Polarity, SchemaGroup |
| `src/constructs/schemas/index.ts` | Built-in schema exports: builtInConstructSchemas, builtInPortSchemas |
| `src/constructs/schemas/built-ins.ts` | Default construct and port schema definitions |
| `src/constructs/portRegistry.ts` | Port schema registry with polarity-based validation, wildcard support |
| `src/hooks/useDocument.ts` | Primary hook for accessing document state and operations via adapter |
| `src/hooks/useGraphOperations.ts` | Node CRUD: addConstruct, deleteNode, renameNode, etc. |
| `src/hooks/useConnections.ts` | Connection logic: onConnect, handleEdgesDelete, validation |
| `src/hooks/useUndoRedo.ts` | Y.UndoManager wrapper for undo/redo (local, not shared) |
| `src/hooks/useClipboard.ts` | Copy/paste (local state, not collaborative) |
| `src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcut handling |
| `src/components/Map.tsx` | React Flow canvas, UI event handlers |
| `src/components/Header.tsx` | Project header with title, import/export, settings menu, Share (server mode) |
| `src/components/ProjectInfoModal.tsx` | Modal for editing project title and description |
| `src/components/ExamplesModal.tsx` | Modal for loading example projects |
| `src/components/DocumentBrowserModal.tsx` | Document browser/selector for server mode |
| `src/components/ConnectionStatus.tsx` | Connection status indicator (server mode only) |
| `src/components/PortSchemaEditor.tsx` | Two-panel editor for port schemas |
| `src/constructs/compiler/index.ts` | Compiler engine that takes schemas/deployables as parameters |
| `src/utils/examples.ts` | Utility to load bundled example .carta files |
| `src/main.tsx` | Entry point, configures staticMode from VITE_STATIC_MODE env var |

## Key Design Principles

### The Dual-Mandate
All design decisions must balance two objectives:
1. **Properly bounded modeling capability** — flexible enough for any domain, restrictive enough to prevent muddled models
2. **Semantically sufficient compilation** — state must compile to AI-actionable instructions with enough meaning to generate quality output

When evaluating changes, ask: Does this expand capability without confusion? Does this preserve semantic clarity? See `.cursor/rules/metamodel-design.mdc` for full details.

### State Management
- **Single source of truth**: Yjs Y.Doc is the only state store
- **Access pattern**: Components use `useDocument()` hook to access state via adapter
- **Document state** (nodes, edges, schemas, deployables, port schemas) lives in Yjs Y.Doc
- **UI state** (selection, menus, modals) stays in component useState
- **Adapter interface**: All state operations go through DocumentAdapter methods
- Yjs auto-syncs to IndexedDB via y-indexeddb provider
- Undo/redo uses Y.UndoManager (local per-user, not shared)
- **Server mode**: Optional WebSocket provider for real-time collaboration
- **Static mode**: No server connection, single document in IndexedDB
- **No singleton registries**: Schema and deployable data accessed through adapter, not global imports

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
src/constructs/compiler/index.ts           → Main compiler logic (takes schemas/deployables as params)
src/constructs/compiler/formatters/*.ts    → Format-specific output
```

### Access schemas or deployables
```
src/hooks/useDocument.ts                   → Use this hook to get schemas/deployables from adapter
components: const { schemas, deployables } = useDocument()
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

### Modify collaboration behavior (server mode)
```
src/contexts/DocumentContext.tsx           → Document provider lifecycle, mode detection
src/stores/adapters/yjsAdapter.ts          → Yjs adapter implementation, WebSocket connection
src/hooks/useUndoRedo.ts                   → Y.UndoManager configuration
src/main.tsx                               → VITE_STATIC_MODE flag (determines UI visibility)
src/components/DocumentBrowserModal.tsx    → Document browser/selector for server mode
src/components/ConnectionStatus.tsx        → Connection status indicator
```

### Modify header behavior or add modals
```
src/components/Header.tsx                  → Header controls: title, export/import, settings, theme, Share (server mode)
src/components/ProjectInfoModal.tsx        → Edit project title and description
src/components/ExamplesModal.tsx           → Load example projects from bundled .carta files
src/components/DocumentBrowserModal.tsx    → Browse/create/select documents (server mode, required on ?doc= missing)
src/utils/examples.ts                      → Load examples using Vite's import.meta.glob
```

## Testing Requirements

**All tests must pass before committing changes.**

Run the test suites:
```bash
npm run test          # Integration tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
```

If tests fail after your changes, fix them before proceeding.

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
- [ ] Project title click opens ProjectInfoModal to edit title and description
- [ ] Settings menu shows "Load Example" when examples are available
- [ ] ExamplesModal displays all .carta files from `/examples/` directory
- [ ] Loading an example clears existing document and imports example data

**Static mode** (VITE_STATIC_MODE=true):
- [ ] Share button is hidden
- [ ] Connection status indicator is hidden
- [ ] Single document persisted to IndexedDB

**Server mode** (VITE_STATIC_MODE=false):
- [ ] WebSocket collaboration syncs changes between clients
- [ ] Share button visible in header
- [ ] Connection status indicator shows sync state
- [ ] Without ?doc= param, DocumentBrowserModal appears in required mode
- [ ] DocumentBrowserModal cannot be dismissed until document selected/created
- [ ] Document browser shows list of server documents with metadata
- [ ] Creating new document without title defaults to "Untitled Project" in required mode
- [ ] Selecting document navigates to ?doc={documentId} URL
