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

**`.docs/` is the canonical source of truth.** `CLAUDE.md` is a derived artifact kept consistent with `.docs/`.

| Title | Contents |
|-------|----------|
| `.docs/00-codex/` | Taxonomy, conventions, maintenance |
| `.docs/01-context/` | Mission, principles, glossary, UX principles |
| `.docs/02-system/` | Architecture, state, interfaces, decisions, metamodel, design system, frontend architecture |
| `.docs/03-product/` | Features, use cases, workflows |
| `.docs/04-operations/` | Development, testing, deployment, contributing |

Cross-references use `docXX.YY.ZZ` syntax (e.g., `doc02.06` = metamodel architecture).

## Skills & Agents

**Skills** (invoke with `/skill-name`): Opus analyzes, haiku workers execute in parallel.

| Skill | Purpose | When to use |
|-------|---------|-------------|
| `/documentation-nag` | Keeps `.docs/` and derived files in sync with code | After significant code changes |
| `/style-nag` | Audits and fixes UI styling against doc02.07 | After UI changes, or periodically |
| `/frontend-architecture-nag` | Audits component layering against doc02.08 | After architectural changes |
| `/test-builder` | Creates integration/E2E tests | When adding test coverage |
| `/git-sync-trunk` | Syncs trunk branch with remote or main | Before creating worktrees, after remote updates |
| `/git-sync-worktree` | Syncs worktree's claude branch with trunk via rebase | Every 30-60 min while working in a worktree |

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
| `/git-sync-trunk` | Git worktree workflows | `.claude/skills/git-sync-trunk/SKILL.md` |
| `/git-sync-worktree` | Git worktree workflows | `.claude/skills/git-sync-worktree/SKILL.md` |

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
        @carta/compiler  @carta/document
                    ↓    ↙       ↘
         @carta/web-client   @carta/server
                ↓
         @carta/desktop
```

| Package | Location | Purpose |
|---------|----------|---------|
| `@carta/types` | `packages/types/` | Shared TypeScript types, no runtime deps |
| `@carta/domain` | `packages/domain/` | Domain model, port registry, built-in schemas, utils |
| `@carta/document` | `packages/document/` | Shared Y.Doc operations, Yjs helpers, file format, migrations |
| `@carta/compiler` | `packages/compiler/` | Compilation engine (Carta → AI-readable output) |
| `@carta/web-client` | `packages/web-client/` | React web app (currently `src/`) |
| `@carta/server` | `packages/server/` | Collaboration server + MCP server |
| `@carta/desktop` | `packages/desktop/` | Electron desktop app with embedded document server |

### Current state

Implemented packages: `@carta/types`, `@carta/domain`, `@carta/document`, `@carta/compiler`, `@carta/server`, `@carta/web-client`, and `@carta/desktop`. Cross-package dependencies are resolved via Vite/TypeScript aliases.

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
│  - App.tsx → orchestration, modals, layout                  │
│  - CanvasContainer.tsx → view switching, level switcher     │
│  - components/canvas/Map.tsx → React Flow canvas (instance) │
│  - components/metamap/Metamap.tsx → schema/metamodel view   │
│  - ConstructNode.tsx → node rendering                       │
│  - SchemaNode.tsx → schema node rendering (Metamap)         │
└─────────────────────────────────────────────────────────────┘
```

## Hosting Modes

Carta supports two deployment modes determined at build time:

### Static Mode (Default for Development)
- **Purpose**: Single-user offline-first editing (like Excalidraw)
- **Storage**: IndexedDB only (persistent local state)
- **URL**: `?doc=` param set automatically via history.replaceState (no redirect)
- **First visit**: Auto-creates document with starter content (3 connected Notes), no DocumentBrowserModal
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

### Desktop Mode
- **Purpose**: Desktop app with embedded server, MCP integration
- **Storage**: Filesystem (binary Y.Doc snapshots in `{userData}/documents/`)
- **Architecture**: Embedded HTTP+WebSocket server in Electron main process
- **MCP**: Auto-discovered via `server.json`, zero-config with Claude Desktop
- **UI**: Settings > Copy MCP Config for Claude Desktop integration

```bash
cd packages/desktop
pnpm dev          # Build + launch Electron (connects to Vite dev server)
```

### Key Files

**@carta/document** (shared Y.Doc operations, platform-agnostic):

| File | Purpose |
|------|---------|
| `packages/document/src/yjs-helpers.ts` | Yjs ↔ plain object conversion: objectToYMap, yToPlain, yMapToObject, deepPlainToY, safeGet |
| `packages/document/src/id-generators.ts` | ID generators: generateDeployableId, generateDeployableColor, generateSchemaGroupId, generateLevelId, generateNodeId |
| `packages/document/src/constants.ts` | Y.Doc map names (YDOC_MAPS), MCP_ORIGIN, CARTA_FILE_VERSION, SERVER_FORMAT_VERSION |
| `packages/document/src/doc-operations.ts` | Level-aware CRUD for constructs, edges, deployables, schemas (used by collab-server MCP) |
| `packages/document/src/migrations.ts` | migrateToLevels: flat Y.Doc → level-based structure migration |
| `packages/document/src/file-format.ts` | CartaFile/CartaFileLevel types, validateCartaFile, importProjectFromString |

**@carta/domain** (shared domain logic, no UI/storage dependencies):

| File | Purpose |
|------|---------|
| `packages/domain/src/types/index.ts` | Core type definitions: PortSchema, FieldSchema, DocumentAdapter, CartaDocument, Polarity (5 values), VirtualParentNodeData, SchemaGroup; ConstructSchema with backgroundColorPolicy; ConstructNodeData with instanceColor |
| `packages/domain/src/schemas/built-ins.ts` | Default construct schemas, port schemas, and schema groups |
| `packages/domain/src/ports/registry.ts` | PortRegistry class with two-step polarity-based canConnect() validation |
| `packages/domain/src/ports/helpers.ts` | Port helper functions: canConnect, getPortsForSchema, getHandleType, getPortColor |
| `packages/domain/src/utils/display.ts` | Display utilities: getDisplayName, getFieldsForSummary, semanticIdToLabel |
| `packages/domain/packages/web-client/src/utils/color.ts` | Color utilities: hexToHsl, hslToHex, generateTints (7-stop tint generation) |

**Web client** (React app):

| File | Purpose |
|------|---------|
| `packages/web-client/src/contexts/DocumentContext.tsx` | Document provider: manages Yjs adapter lifecycle |
| `packages/web-client/src/stores/adapters/yjsAdapter.ts` | Yjs implementation of DocumentAdapter interface |
| `packages/web-client/src/constructs/compiler/index.ts` | Compiler engine that takes schemas/deployables as parameters |
| `packages/web-client/src/hooks/useDocument.ts` | Primary hook for accessing document state and operations via adapter |
| `packages/web-client/src/hooks/useGraphOperations.ts` | Node CRUD: addConstruct, deleteNode, renameNode, createVirtualParent, etc. |
| `packages/web-client/src/hooks/useConnections.ts` | Connection logic: onConnect, handleEdgesDelete, validation |
| `packages/web-client/src/hooks/useUndoRedo.ts` | Y.UndoManager wrapper for undo/redo (local, not shared) |
| `packages/web-client/src/hooks/useClipboard.ts` | Copy/paste (local state, not collaborative) |
| `packages/web-client/src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcut handling |
| `packages/web-client/src/hooks/useMapState.ts` | Extracted menu/modal UI state from Map.tsx: context menu, add menu, editor modal, full view modal, mouse tracking |
| `packages/web-client/src/components/canvas/Map.tsx` | React Flow canvas, UI event handlers, virtual-parent node type |
| `packages/web-client/src/components/canvas/CanvasContainer.tsx` | Canvas container: view switching (Map/Metamap), ViewToggle, LevelSwitcher overlays, Footer |
| `packages/web-client/src/components/canvas/VirtualParentNode.tsx` | Visual grouping container node for child constructs |
| `packages/web-client/src/components/Header.tsx` | Header with "Carta" branding, title, document browser, import/export, compile, theme, settings, Share (server mode) |
| `packages/web-client/src/components/metamap/Metamap.tsx` | React Flow canvas for schema-level metamodel view (SchemaNode, SchemaGroupNode, EdgeDetailPopover) |
| `packages/web-client/src/components/metamap/EdgeDetailPopover.tsx` | Click-to-edit popover for metamap edges: edit labels, delete relationships |
| `packages/web-client/src/components/metamap/SchemaNode.tsx` | Schema node rendering in Metamap view |
| `packages/web-client/src/components/metamap/SchemaGroupNode.tsx` | Schema group node rendering in Metamap view |
| `packages/web-client/src/components/metamap/MetamapConnectionModal.tsx` | Modal for creating connections between schemas in Metamap (includes port color picker) |
| `packages/web-client/src/components/modals/ProjectInfoModal.tsx` | Modal for editing project title and description |
| `packages/web-client/src/components/modals/ExamplesModal.tsx` | Modal for loading example projects |
| `packages/web-client/src/components/modals/DocumentBrowserModal.tsx` | Document browser/selector for server mode |
| `packages/web-client/src/components/modals/HelpModal.tsx` | Multi-tab Help modal with About tab (copyright, version, config); opened from Footer |
| `packages/web-client/src/components/ConnectionStatus.tsx` | Connection status indicator (server mode only) |
| `packages/web-client/src/components/ConstructEditor.tsx` | Full-screen schema editor with tabs (Basics/Fields/Ports) and live preview |
| `packages/web-client/src/components/ui/ContextMenuPrimitive.tsx` | Reusable context menu primitive with nested submenu support |
| `packages/web-client/src/components/canvas/DynamicAnchorEdge.tsx` | Dynamic nearest-edge routing edge component with bundle count badge |
| `packages/web-client/src/components/canvas/PortDrawer.tsx` | Hover-to-expand port drawer at bottom of construct nodes |
| `packages/web-client/src/components/canvas/IndexBasedDropZones.tsx` | Horizontal strip drop zones for connection targeting |
| `packages/web-client/src/hooks/useEdgeBundling.ts` | Hook for grouping parallel edges between same node pair |
| `packages/web-client/src/components/canvas/lod/lodPolicy.ts` | LOD band configuration (pill/compact/normal modes with zoom thresholds) |
| `packages/web-client/src/components/canvas/lod/useLodBand.ts` | Hook that returns discrete LOD band based on current zoom level |
| `packages/web-client/src/components/ui/ContextMenu.tsx` | Shared context menu for canvas right-click; view-specific options (Map shows node ops, Metamap shows schema ops) |
| `packages/web-client/src/utils/examples.ts` | Utility to load bundled example .carta files |
| `packages/web-client/src/main.tsx` | Entry point: resolves documentId (migration, last-opened, or auto-create), updates URL via history.replaceState, renders DocumentProvider |
| `packages/web-client/src/utils/starterContent.ts` | Seeds starter graph (3 Note nodes, 2 edges) on first document initialization |
| `packages/web-client/src/components/ui/icons.tsx` | Shared icon components: PinIcon, WindowIcon, CloseIcon, ExpandIcon, CollapseIcon |
| `packages/web-client/src/components/ui/DraggableWindow.tsx` | Draggable, pinnable window component for full view modal (no backdrop, island UX) |
| `packages/web-client/src/components/modals/ConstructFullViewModal.tsx` | Full view window displaying all node information: fields, deployable, identity, connections, compile preview |
| `packages/web-client/src/components/canvas/DeployableBackground.tsx` | Deployable background renderer with LOD-aware font sizing |

**Desktop** (Electron app):

| File | Purpose |
|------|---------|
| `packages/desktop/src/main/index.ts` | Electron main process: starts embedded server, creates window, IPC handlers |
| `packages/desktop/src/main/server.ts` | Embedded HTTP + WebSocket document server with filesystem persistence |
| `packages/desktop/src/main/config.ts` | Dev/prod detection, renderer URL resolution |
| `packages/desktop/src/preload/index.ts` | Preload: exposes isDesktop, server info, MCP config IPC to renderer |

## Key Design Principles

### The Dual-Mandate
All design decisions must balance two objectives:
1. **Properly bounded modeling capability** — flexible enough for any domain, restrictive enough to prevent muddled models
2. **Semantically sufficient compilation** — state must compile to AI-actionable instructions with enough meaning to generate quality output

When evaluating changes, ask: Does this expand capability without confusion? Does this preserve semantic clarity? See `.docs/02-system/06-metamodel.md` for full details.

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
**Consult:** `.docs/03-product/01-features/03-ports-and-connections.md`

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
packages/web-client/src/components/canvas/ConstructNode.tsx   → Node rendering, port drawer, color picker, LOD modes (shadow-based cards, left accent bar)
packages/web-client/src/components/canvas/lod/lodPolicy.ts    → LOD band thresholds and configuration
packages/web-client/src/components/canvas/lod/useLodBand.ts   → Hook for discrete zoom-based LOD band detection
packages/web-client/src/utils/displayUtils.ts                 → Node title derivation
packages/web-client/src/utils/colorUtils.ts                   → Color utilities (tint generation, HSL conversion)
packages/web-client/src/index.css                             → Styling (handles, colors, text-halo, --node-shadow, --edge-default-color CSS vars)
```

### Modify keyboard shortcuts
```
packages/web-client/src/hooks/useKeyboardShortcuts.ts  → All keyboard handlers
```

### Edit port schemas (port types)
```
packages/web-client/src/components/metamap/MetamapConnectionModal.tsx  → Create ports with color when connecting schemas in Metamap
packages/web-client/src/constructs/portRegistry.ts                     → Port validation and registry logic
packages/web-client/src/stores/adapters/yjsAdapter.ts                  → Port schema persistence
packages/web-client/src/constructs/schemas/built-ins.ts                → Default port schema definitions
```

### Modify collaboration behavior (server mode)
```
packages/web-client/src/contexts/DocumentContext.tsx           → Document provider lifecycle, mode detection
packages/web-client/src/stores/adapters/yjsAdapter.ts          → Yjs adapter implementation, WebSocket connection
packages/web-client/src/hooks/useUndoRedo.ts                   → Y.UndoManager configuration
packages/web-client/src/main.tsx                               → Boot logic: document resolution, auto-create (local mode), history.replaceState
packages/web-client/src/components/modals/DocumentBrowserModal.tsx    → Document browser/selector for server mode
packages/web-client/src/components/ConnectionStatus.tsx        → Connection status indicator
```

### Modify desktop embedded server
```
packages/desktop/src/main/server.ts                → HTTP routes, WebSocket sync, filesystem persistence
packages/desktop/src/main/index.ts                 → Server lifecycle, IPC handlers, MCP config
packages/desktop/src/preload/index.ts              → Desktop API exposed to renderer
packages/web-client/src/config/featureFlags.ts     → Desktop mode detection and auto-configuration
```

### Modify header behavior or add modals
```
packages/web-client/src/components/Header.tsx                  → Header: "Carta" branding, title, document browser, export/import, compile, theme, settings, Share (server mode)
packages/web-client/src/components/modals/ProjectInfoModal.tsx        → Edit project title and description
packages/web-client/src/components/modals/ExamplesModal.tsx           → Load example projects from bundled .carta files
packages/web-client/src/components/modals/DocumentBrowserModal.tsx    → Browse/create/select documents (server mode, required on ?doc= missing)
packages/web-client/src/components/modals/HelpModal.tsx               → Multi-tab Help modal (About tab: copyright, version, config); opened from Footer
packages/web-client/src/components/ConstructEditor.tsx         → Full-screen schema editor with tabs and live preview
packages/web-client/src/utils/examples.ts                      → Load examples using Vite's import.meta.glob
```

### Add or modify context menus
```
packages/web-client/src/components/ui/ContextMenu.tsx                        → Shared context menu (instance ops optional, schema ops always available)
packages/web-client/src/components/ui/ContextMenuPrimitive.tsx               → Reusable context menu primitive with nested submenus
packages/web-client/src/components/canvas/Map.tsx                            → Map view: passes node/paste callbacks for instance operations
packages/web-client/src/components/metamap/Metamap.tsx                       → Metamap view: passes only schema/group callbacks
```

### Modify edge appearance or bundling
```
packages/web-client/src/components/canvas/DynamicAnchorEdge.tsx       → Dynamic nearest-edge routing edge component with bundle count badge
packages/web-client/src/hooks/useEdgeBundling.ts                      → Hook for grouping parallel edges between same node pair
packages/web-client/src/components/canvas/Map.tsx                     → Registers DynamicAnchorEdge as custom edge type, uses useEdgeBundling, custom zoom controls
packages/web-client/src/components/metamap/EdgeDetailPopover.tsx      → Click-to-edit popover for metamap relationship edges
packages/web-client/src/index.css                                     → Edge styling (colors, stroke width)
```

### Modify zoom controls or LOD rendering
```
packages/web-client/src/components/canvas/Map.tsx                     → Custom zoom controls (1.15x step), minZoom: 0.15
packages/web-client/src/components/canvas/ConstructNode.tsx           → Two-band LOD rendering (pill/normal modes)
packages/web-client/src/components/canvas/lod/lodPolicy.ts            → LOD band configuration and thresholds
packages/web-client/src/components/canvas/lod/useLodBand.ts           → Hook for zoom-based discrete band selection
packages/web-client/src/index.css                                     → text-halo utility for legible text on any background
```

## Testing Requirements

**All tests and builds must pass before committing changes.**

Run the build and test suites:
```bash
pnpm build         # Build all packages (checks TypeScript compilation)
pnpm test          # Integration tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright)
```

If the build or tests fail after your changes, fix them before proceeding.

## Testing Checklist

When modifying constructs or connections:
- [ ] Can create construct with custom ports in Schema Editor
- [ ] Can create/edit port schemas via Metamap connection modal
- [ ] Port polarity validation works correctly (source-source blocked, relay acts as source, intercept acts as sink)
- [ ] Relay/intercept bypass compatibleWith checks; plain source+sink require compatibleWith match
- [ ] Port drawer appears on hover at bottom of construct nodes
- [ ] Port drawer does not appear in pill LOD mode
- [ ] Drop zones appear as horizontal strips on target node during connection drag
- [ ] Connections store on source construct's `connections[]`
- [ ] Parallel edges between same nodes bundle visually with count badge
- [ ] Edges use dynamic nearest-edge routing (attach to closest boundary point)
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
- [ ] Deployable backgrounds use theme-adaptive opacity via CSS vars (0.06 fill, 0.12 stroke)
- [ ] Deployable labels are readable at normal zoom (16px font, 600 weight, 85% opacity)
- [ ] Clicking deployable label selects all nodes in that deployable
- [ ] Dragging deployable label moves all nodes in that deployable
- [ ] Metamap schema nodes use shadow depth instead of dashed borders
- [ ] Metamap ports are rounded squares matching canvas port style
- [ ] Schema group nodes use subtle solid borders instead of dashed
- [ ] Accent bars on nodes are 2px softened (color-mixed at 70%) and respect rounded corners

**Static mode** (VITE_STATIC_MODE=true):
- [ ] First visit auto-creates document with starter content (no DocumentBrowserModal)
- [ ] Starter content has nodes and edges on canvas
- [ ] URL gets `?doc=` param via history.replaceState (no page reload)
- [ ] Returning visit reopens last document
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
