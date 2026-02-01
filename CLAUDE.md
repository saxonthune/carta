# Carta - Claude Code Context

## Quick Start

Carta is a visual software architecture editor using React Flow. Users create "Constructs" (typed nodes), connect them, and compile to AI-readable output.

@.docs/MANIFEST.md

## Development Philosophy

**IMPORTANT: Backwards Compatibility is NOT a Concern**

This codebase is in active development. When refactoring or improving patterns:
- Remove old patterns completely—don't maintain them alongside new ones
- Update all references to use the new approach
- Don't preserve deprecated code paths "just in case"
- Simplicity and clarity take priority over backwards compatibility

Adding compatibility layers creates unnecessary complexity. Clean, modern patterns are preferred over supporting legacy approaches.

## Documentation

**`.docs/` is the canonical source of truth.** All other docs (CLAUDE.md, `.cursor/rules/`, skill configs) are derived artifacts.

| Title | Contents |
|-------|----------|
| `.docs/00-codex/` | Taxonomy, conventions, maintenance |
| `.docs/01-context/` | Mission, principles, glossary, UX principles |
| `.docs/02-system/` | Architecture, state, interfaces, decisions, metamodel, design system, frontend architecture |
| `.docs/03-product/` | Features, use cases, workflows |
| `.docs/04-operations/` | Development, testing, deployment, contributing |

Cross-references use `docXX.YY.ZZ` syntax (e.g., `doc02.06` = metamodel architecture).

### Cursor Rules (derived from .docs/)

| Rule | When to consult |
|------|-----------------|
| `.cursor/rules/react-flow.mdc` | React Flow patterns, handles, node types |
| `.cursor/rules/ports-and-connections.mdc` | Port model, connection semantics |
| `.cursor/rules/metamodel-design.mdc` | Three-level metamodel (M2/M1/M0) |
| `.cursor/rules/yjs-collaboration.mdc` | Yjs collaboration preparation |
| `.cursor/rules/look-and-feel.mdc` | Visual depth system, island patterns |
| `.cursor/rules/styling-best-practices.mdc` | UI styling standards |
| `.cursor/rules/lod-rendering.mdc` | Level-of-detail rendering |

## Skills & Agents

**Skills** (invoke with `/skill-name`): Opus analyzes, haiku workers execute in parallel.

| Skill | Purpose | When to use |
|-------|---------|-------------|
| `/documentation-nag` | Keeps `.docs/` and derived files in sync with code | After significant code changes |
| `/style-nag` | Audits and fixes UI styling against doc02.07 | After UI changes, or periodically |
| `/frontend-architecture-nag` | Audits component layering against doc02.08 | After architectural changes |
| `/test-builder` | Creates integration/E2E tests | When adding test coverage |

**Agents** (launch with `Task` tool): Long-running autonomous workers.

| Agent | Purpose | When to use |
|-------|---------|-------------|
| `batch-executor` | Processes all tasks sequentially | "process tasks" - small/medium tasks |
| `task-master` | Spawns parallel agents per task | "launch task-master" - large tasks |
| `test-builder` | Creates integration/E2E tests autonomously | "launch test-builder" |

### Skill Details

All skills follow the same pattern: opus reads `.docs/` and code, analyzes, generates edit instructions, launches parallel haiku workers.

| Skill | Reference Docs | Config |
|-------|---------------|--------|
| `/documentation-nag` | `.docs/` (all titles) | `.claude/skills/documentation-nag/SKILL.md` |
| `/style-nag` | doc02.07 (design system), doc01.04 (UX principles) | `.claude/skills/style-nag/SKILL.md` |
| `/frontend-architecture-nag` | doc02.08 (frontend architecture), doc02.01 (overview) | `.claude/skills/frontend-architecture-nag/SKILL.md` |
| `/test-builder` | doc04.02 (testing), `packages/web-client/tests/README.md` | `.claude/skills/test-builder/SKILL.md` |

### Agent Details

| Agent | Config |
|-------|--------|
| `batch-executor` | `.claude/agents/batch-executor.md` |
| `task-master` | `.claude/agents/task-master.md` |
| `test-builder` | `.claude/agents/test-builder.md` |

## Monorepo Structure

### Target dependency graph

Packages can only depend on packages above them in the graph.

```
                    @carta/types
                         ↓
                    @carta/domain
                    ↙    ↓    ↘
           @carta/storage  @carta/compiler
                ↓               ↓
         @carta/web-client   @carta/server
                ↓               ↓
         @carta/desktop      @carta/cli
```

| Package | Location | Purpose |
|---------|----------|---------|
| `@carta/types` | `packages/types/` | Shared TypeScript types, no runtime deps |
| `@carta/domain` | `packages/domain/` | Domain model, port registry, built-in schemas, utils |
| `@carta/storage` | `packages/storage/` | StorageProvider interface + implementations (IndexedDB, filesystem, MongoDB) |
| `@carta/compiler` | `packages/compiler/` | Compilation engine (Carta → AI-readable output) |
| `@carta/web-client` | `packages/web-client/` | React web app (currently `src/`) |
| `@carta/server` | `packages/server/` | Collaboration server + MCP server |
| `@carta/desktop` | `packages/desktop/` | Electron desktop app |
| `@carta/cli` | `packages/cli/` | CLI tools (init, compile, validate) |

### Current state

Implemented packages: `@carta/types`, `@carta/domain`, `@carta/storage`, `@carta/compiler`, `@carta/server`, and `@carta/web-client`. Cross-package dependencies are resolved via Vite/TypeScript aliases.

- `@carta/core` (`packages/core/`) - **STALE**: divergent types the server still depends on; needs reconciliation with `@carta/domain`
- `packages/app/` - **Dead code**: no TS files, should be deleted

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  @carta/domain                  packages/domain/src/        │
│  - Core types (ConstructSchema, PortSchema, etc.)           │
│  - Port registry and validation (PortRegistry, canConnect)  │
│  - Built-in schemas and port schemas                        │
│  - Utility functions (display, color)                       │
│  - Platform-agnostic, no React/Yjs dependencies             │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Document Store (Yjs Y.Doc)     packages/web-client/src/   │
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
│  DocumentAdapter Interface      packages/web-client/src/   │
│  - adapters/yjsAdapter.ts → Yjs implementation              │
│  - DocumentContext → manages adapter lifecycle              │
│  - All state operations go through adapter methods          │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Hooks Layer                    packages/web-client/src/   │
│  - useDocument() → document state access and operations     │
│  - useGraphOperations() → add/delete/update nodes           │
│  - useConnections() → connection management                 │
│  - useClipboard() → copy/paste (local state)                │
│  - useKeyboardShortcuts() → keyboard handling               │
│  - useUndoRedo() → undo/redo history                        │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Components (UI only)           packages/web-client/src/   │
│  - Map.tsx → React Flow canvas (instance view)              │
│  - Metamap.tsx → React Flow canvas (schema/metamodel view)  │
│  - App.tsx → orchestration, modals, layout, view toggle     │
│  - ConstructNode.tsx → node rendering                       │
│  - SchemaNode.tsx → schema node rendering (Metamap)         │
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
pnpm dev          # Static mode (VITE_STATIC_MODE=true)
```

### Server Mode
- **Purpose**: Multi-user collaboration with server-stored documents
- **Storage**: Server database (MongoDB) with IndexedDB caching
- **URL**: Requires `?doc={documentId}` parameter
- **UI**: Share button, connection status, document browser
- **Behavior**: Without `?doc=` param, user must select/create a document
- **Use case**: Team collaboration, shared projects

```bash
pnpm server       # Start MongoDB + collab server
pnpm dev:client   # Start client in server mode
```

Visit `http://localhost:5173/?doc=my-document-id` to open a specific document.

### Key Files

**@carta/domain** (shared domain logic, no UI/storage dependencies):

| File | Purpose |
|------|---------|
| `packages/domain/src/types/index.ts` | Core type definitions: PortSchema, FieldSchema, DocumentAdapter, CartaDocument, Polarity (5 values), VirtualParentNodeData, SchemaGroup; ConstructSchema with backgroundColorPolicy and portDisplayPolicy; ConstructNodeData with instanceColor |
| `packages/domain/src/schemas/built-ins.ts` | Default construct schemas, port schemas, and schema groups |
| `packages/domain/src/ports/registry.ts` | PortRegistry class with two-step polarity-based canConnect() validation |
| `packages/domain/src/ports/helpers.ts` | Port helper functions: canConnect, getPortsForSchema, getHandleType, getPortColor |
| `packages/domain/packages/web-client/src/utils/display.ts` | Display utilities: getDisplayName, semanticIdToLabel |
| `packages/domain/packages/web-client/src/utils/color.ts` | Color utilities: hexToHsl, hslToHex, generateTints (7-stop tint generation) |

**Web client** (React app):

| File | Purpose |
|------|---------|
| `packages/web-client/src/contexts/DocumentContext.tsx` | Document provider: manages Yjs adapter lifecycle |
| `packages/web-client/src/stores/adapters/yjsAdapter.ts` | Yjs implementation of DocumentAdapter interface |
| `packages/web-client/src/constructs/ports.ts` | React-specific port utility: getHandleStyle (CSS positioning) |
| `packages/web-client/src/constructs/compiler/index.ts` | Compiler engine that takes schemas/deployables as parameters |
| `packages/web-client/src/hooks/useDocument.ts` | Primary hook for accessing document state and operations via adapter |
| `packages/web-client/src/hooks/useGraphOperations.ts` | Node CRUD: addConstruct, deleteNode, renameNode, createVirtualParent, etc. |
| `packages/web-client/src/hooks/useConnections.ts` | Connection logic: onConnect, handleEdgesDelete, validation |
| `packages/web-client/src/hooks/useUndoRedo.ts` | Y.UndoManager wrapper for undo/redo (local, not shared) |
| `packages/web-client/src/hooks/useClipboard.ts` | Copy/paste (local state, not collaborative) |
| `packages/web-client/src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcut handling |
| `packages/web-client/src/components/Map.tsx` | React Flow canvas, UI event handlers, virtual-parent node type |
| `packages/web-client/src/components/VirtualParentNode.tsx` | Visual grouping container node for child constructs |
| `packages/web-client/src/components/Header.tsx` | Project header with title, import/export, settings menu, Map/Metamap toggle, Share (server mode) |
| `packages/web-client/src/components/Metamap.tsx` | React Flow canvas for schema-level metamodel view (SchemaNode, SchemaGroupNode) |
| `packages/web-client/src/components/SchemaNode.tsx` | Schema node rendering in Metamap view |
| `packages/web-client/src/components/SchemaGroupNode.tsx` | Schema group node rendering in Metamap view |
| `packages/web-client/src/components/MetamapConnectionModal.tsx` | Modal for creating connections between schemas in Metamap (includes port color picker) |
| `packages/web-client/src/components/ProjectInfoModal.tsx` | Modal for editing project title and description |
| `packages/web-client/src/components/ExamplesModal.tsx` | Modal for loading example projects |
| `packages/web-client/src/components/DocumentBrowserModal.tsx` | Document browser/selector for server mode |
| `packages/web-client/src/components/ConnectionStatus.tsx` | Connection status indicator (server mode only) |
| `packages/web-client/src/components/ConstructEditor.tsx` | Full-screen schema editor with tabs (Basics/Fields/Ports) and live preview |
| `packages/web-client/src/components/ui/ContextMenuPrimitive.tsx` | Reusable context menu primitive with nested submenu support |
| `packages/web-client/src/components/ui/PortPickerPopover.tsx` | Port picker popover for collapsed port nodes |
| `packages/web-client/src/components/BundledEdge.tsx` | Custom edge component for bundled parallel edges |
| `packages/web-client/src/hooks/useEdgeBundling.ts` | Hook for grouping parallel edges between same node pair |
| `packages/web-client/src/components/lod/lodPolicy.ts` | LOD band configuration (pill/compact/normal modes with zoom thresholds) |
| `packages/web-client/src/components/lod/useLodBand.ts` | Hook that returns discrete LOD band based on current zoom level |
| `packages/web-client/src/ContextMenu.tsx` | Shared context menu for canvas right-click; view-specific options (Map shows node ops, Metamap shows schema ops) |
| `packages/web-client/src/utils/examples.ts` | Utility to load bundled example .carta files |
| `packages/web-client/src/main.tsx` | Entry point, configures staticMode from VITE_STATIC_MODE env var |
| `packages/web-client/src/components/ui/icons.tsx` | Shared icon components: PinIcon, WindowIcon, CloseIcon, ExpandIcon, CollapseIcon |
| `packages/web-client/src/components/ui/DraggableWindow.tsx` | Draggable, pinnable window component for full view modal (no backdrop, island UX) |
| `packages/web-client/src/components/ConstructFullViewModal.tsx` | Full view window displaying all node information: fields, deployable, identity, connections, compile preview |
| `packages/web-client/src/components/DeployableBackground.tsx` | Deployable background renderer with LOD-aware font sizing |

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
- **Port schemas** define port types with polarity (`source`, `sink`, `bidirectional`, `relay`, `intercept`)
- **Built-in ports**: `flow-in`, `flow-out`, `parent`, `child`, `symmetric`, `intercept`, `relay`
- Two-step polarity validation via `portRegistry.canConnect()`:
  1. Block same-direction pairs (relay maps to source, intercept maps to sink)
  2. Skip `compatibleWith` if either side is relay, intercept, or bidirectional; otherwise require match
- Inverse relationships are **derivable**, never duplicated
- Port configuration is **per-schema**, not per-instance
- Port schemas stored in document store, user-editable via Metamap view

### Construct Identity
- **No `name` field** on instances—titles come from schema's `displayField` or `semanticId`
- `semanticId` is required, auto-generated as `{type}-{timestamp}{random}`
- Use `getDisplayName(data, schema)` from `packages/web-client/src/utils/displayUtils.ts`

## Common Tasks

### Modify graph operations (add/delete/update nodes)
```
packages/web-client/src/hooks/useGraphOperations.ts   → Node CRUD, virtual parent operations
packages/web-client/src/stores/adapters/yjsAdapter.ts → updateNode with semantic ID cascade
```

### Modify connection behavior
```
packages/web-client/src/hooks/useConnections.ts       → onConnect, handleEdgesDelete, isValidConnection
packages/web-client/src/constructs/portRegistry.ts    → Two-step polarity-based canConnect() validation
packages/web-client/src/stores/adapters/yjsAdapter.ts → Port schema CRUD (add/update/remove)
```

### Add a built-in construct type
```
packages/web-client/src/constructs/schemas/built-ins.ts → Add to builtInConstructSchemas array
packages/web-client/src/constructs/schemas/index.ts     → Exports builtInConstructSchemas
```

### Modify compilation output
```
packages/web-client/src/constructs/compiler/index.ts           → Main compiler logic (takes schemas/deployables as params)
packages/web-client/src/constructs/compiler/formatters/*.ts    → Format-specific output
```

### Access schemas or deployables
```
packages/web-client/src/hooks/useDocument.ts                   → Use this hook to get schemas/deployables from adapter
components: const { schemas, deployables } = useDocument()
```

### Change node appearance
```
packages/web-client/src/components/ConstructNode.tsx   → Node rendering, port handles (inline/collapsed), color picker, LOD modes
packages/web-client/src/components/lod/lodPolicy.ts    → LOD band thresholds and configuration
packages/web-client/src/components/lod/useLodBand.ts   → Hook for discrete zoom-based LOD band detection
packages/web-client/src/utils/displayUtils.ts          → Node title derivation
packages/web-client/src/utils/colorUtils.ts            → Color utilities (tint generation, HSL conversion)
packages/web-client/src/index.css                      → Styling (handles, colors, text-halo utility)
```

### Modify keyboard shortcuts
```
packages/web-client/src/hooks/useKeyboardShortcuts.ts  → All keyboard handlers
```

### Edit port schemas (port types)
```
packages/web-client/src/components/MetamapConnectionModal.tsx  → Create ports with color when connecting schemas in Metamap
packages/web-client/src/constructs/portRegistry.ts             → Port validation and registry logic
packages/web-client/src/stores/adapters/yjsAdapter.ts          → Port schema persistence
packages/web-client/src/constructs/schemas/built-ins.ts        → Default port schema definitions
```

### Modify collaboration behavior (server mode)
```
packages/web-client/src/contexts/DocumentContext.tsx           → Document provider lifecycle, mode detection
packages/web-client/src/stores/adapters/yjsAdapter.ts          → Yjs adapter implementation, WebSocket connection
packages/web-client/src/hooks/useUndoRedo.ts                   → Y.UndoManager configuration
packages/web-client/src/main.tsx                               → VITE_STATIC_MODE flag (determines UI visibility)
packages/web-client/src/components/DocumentBrowserModal.tsx    → Document browser/selector for server mode
packages/web-client/src/components/ConnectionStatus.tsx        → Connection status indicator
```

### Modify header behavior or add modals
```
packages/web-client/src/components/Header.tsx                  → Header controls: title, export/import, settings, theme, Share (server mode)
packages/web-client/src/components/ProjectInfoModal.tsx        → Edit project title and description
packages/web-client/src/components/ExamplesModal.tsx           → Load example projects from bundled .carta files
packages/web-client/src/components/DocumentBrowserModal.tsx    → Browse/create/select documents (server mode, required on ?doc= missing)
packages/web-client/src/components/ConstructEditor.tsx         → Full-screen schema editor with tabs and live preview
packages/web-client/src/utils/examples.ts                      → Load examples using Vite's import.meta.glob
```

### Add or modify context menus
```
packages/web-client/src/ContextMenu.tsx                        → Shared context menu (instance ops optional, schema ops always available)
packages/web-client/src/components/ui/ContextMenuPrimitive.tsx → Reusable context menu primitive with nested submenus
packages/web-client/src/components/Map.tsx                     → Map view: passes node/paste callbacks for instance operations
packages/web-client/src/components/Metamap.tsx                 → Metamap view: passes only schema/group callbacks
```

### Modify edge appearance or bundling
```
packages/web-client/src/components/BundledEdge.tsx             → Custom edge component for bundled parallel edges (smoothstep style)
packages/web-client/src/hooks/useEdgeBundling.ts               → Hook for grouping parallel edges between same node pair
packages/web-client/src/components/Map.tsx                     → Registers BundledEdge as custom edge type, uses useEdgeBundling, custom zoom controls
packages/web-client/src/index.css                              → Edge styling (colors, stroke width)
```

### Modify zoom controls or LOD rendering
```
packages/web-client/src/components/Map.tsx                     → Custom zoom controls (1.15x step), minZoom: 0.15
packages/web-client/src/components/ConstructNode.tsx           → Three-band LOD rendering (pill/compact/normal)
packages/web-client/src/components/lod/lodPolicy.ts            → LOD band configuration and thresholds
packages/web-client/src/components/lod/useLodBand.ts           → Hook for zoom-based discrete band selection
packages/web-client/src/index.css                              → text-halo utility for legible text on any background
```

## Testing Requirements

**All tests must pass before committing changes.**

Run the test suites:
```bash
pnpm test          # Integration tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright)
```

If tests fail after your changes, fix them before proceeding.

## Testing Checklist

When modifying constructs or connections:
- [ ] Can create construct with custom ports in Schema Editor
- [ ] Can create/edit port schemas via Metamap connection modal
- [ ] Port polarity validation works correctly (source-source blocked, relay acts as source, intercept acts as sink)
- [ ] Relay/intercept bypass compatibleWith checks; plain source+sink require compatibleWith match
- [ ] Handles appear at correct positions on canvas (inline or collapsed mode)
- [ ] Collapsed ports show PortPickerPopover when port icon clicked
- [ ] Connections store on source construct's `connections[]`
- [ ] Parallel edges between same nodes bundle visually with count badge
- [ ] Edges use smoothstep (curved) style
- [ ] Compilation output includes ports and relationships
- [ ] Import clears existing document before loading (like Excalidraw)
- [ ] Export preserves port configurations, port schemas, and instance colors (v3 file format)
- [ ] Node titles display from displayField or semanticId
- [ ] Background color picker respects schema's backgroundColorPolicy (defaultOnly/tints/any)
- [ ] Instance color changes persist and reset to null correctly
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
