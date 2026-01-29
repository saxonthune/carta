# Carta Codebase Context
<!-- Refresh this periodically to keep task-master efficient -->

## Architecture Summary

React Flow visual editor with Yjs state management.

## Component Tree

```
App.tsx
├── Header.tsx                    # Title, export/import, settings menu, theme, Share (server mode)
│   ├── ConnectionStatus.tsx      # Connection indicator (server mode only)
│   └── DocumentBrowserModal.tsx  # Document browser/selector (server mode)
├── Map.tsx                       # React Flow canvas, context menus, wizard state
│   ├── ConstructNode.tsx         # Node rendering, port handles, tooltips
│   │   └── Handle (per port)     # Port connection points, hover state
│   ├── DeployableBackground.tsx  # Colored regions for deployables
│   ├── SchemaCreationWizard.tsx  # Multi-step wizard for schema creation/editing
│   │   └── ui/WizardModal.tsx    # Reusable wizard modal shell
│   └── ContextMenu.tsx (src/)    # Canvas right-click menu ("New Construct Schema", etc.)
├── Drawer.tsx                    # Right-side panel with floating tabs
│   ├── ConstructEditor.tsx       # Schema CRUD (Constructs tab)
│   │   └── GroupedSchemaList.tsx # Grouped schema listing
│   ├── SchemaGroupEditor.tsx     # Group management (Groups tab)
│   ├── PortSchemaEditor.tsx      # Port type CRUD (Ports tab)
│   └── DeployablesEditor.tsx     # Deployable CRUD (Deployables tab)
└── Modals
    ├── CompileModal.tsx          # Compilation output
    ├── ExportPreviewModal.tsx    # Export preview
    ├── ImportPreviewModal.tsx    # Import preview
    ├── ProjectInfoModal.tsx      # Edit project metadata
    ├── ExamplesModal.tsx         # Load example projects
    └── ConfirmationModal.tsx     # Generic confirm dialog
```

When user references a file, check the tree to find the actual component handling that feature.

### Key Directories
- `src/components/` - React components (UI)
- `src/hooks/` - Custom hooks (useDocument, useGraphOperations, useConnections)
- `src/constructs/` - Domain logic (portRegistry, compiler, schemas)
- `src/stores/adapters/` - Yjs adapter implementation
- `src/contexts/` - React context providers (DocumentContext)
- `tests/integration/` - Vitest integration tests
- `tests/e2e/` - Playwright E2E tests

### Key Files by Feature

**Document/State:**
- `src/hooks/useDocument.ts` - Document state hook
- `src/stores/adapters/yjsAdapter.ts` - Yjs implementation
- `src/contexts/DocumentContext.tsx` - Provider

**Graph Operations:**
- `src/hooks/useGraphOperations.ts` - Node CRUD
- `src/hooks/useConnections.ts` - Edge management
- `src/constructs/portRegistry.ts` - Port validation

**UI Components:**
- `src/components/Header.tsx` - Top bar, settings, export/import, Share (server mode)
- `src/components/ConnectionStatus.tsx` - Connection indicator (server mode only)
- `src/components/DocumentBrowserModal.tsx` - Document browser (server mode, required when ?doc= missing)
- `src/components/Drawer.tsx` - Right-side panel with floating tabs
- `src/components/ConstructNode.tsx` - Node rendering, port handles, port hover tooltips
- `src/components/Map.tsx` - React Flow canvas, context menus, drag-drop

**Existing Behaviors:**
- Port hover: Shows `port.label` tooltip (ConstructNode.tsx:108-121)
- Port colors: Determined by `getPortColor(port.portType)`
- Node selection: Border + shadow via `selected` prop

**Editors:**
- `src/components/ConstructEditor.tsx` - Schema editor
- `src/components/InstanceEditor.tsx` - Node instance editor
- `src/components/PortSchemaEditor.tsx` - Port type editor

### Test Infrastructure
- `tests/setup/testProviders.tsx` - React test wrapper
- `tests/setup/testHelpers.ts` - createTestNode(), createTestEdge()
- `tests/e2e/helpers/CartaPage.ts` - Page Object Model

### Styling
- `src/index.css` - Theme variables
- `.cursor/rules/styling-best-practices.mdc` - Spacing/color rules
- `.cursor/rules/look-and-feel.mdc` - Depth system

## Recent Changes
<!-- Update this after significant work -->

- URL routing: "room" → "doc" terminology (?room= → ?doc=)
- Hosting modes: "localMode" → "staticMode" (VITE_LOCAL_MODE → VITE_STATIC_MODE)
- Static mode: Single document in IndexedDB, no server (like Excalidraw)
- Server mode: Documents on server with ?doc= routing, forced selection when missing
- DocumentBrowserModal: Required mode when ?doc= param missing in server mode
- ConnectionStatus component: Shows sync state in server mode only
- Package.json scripts: Simplified dev/dev:client/server commands
- Removed Dock.tsx - Replaced with Drawer.tsx (right-side slide-out panel)
- Drawer uses floating tab buttons instead of bottom panel tabs
- Removed Zustand - Yjs is now single source of truth
- Removed singleton registries (registry.ts, deployables.ts)
- All state access via useDocument() hook through adapter
- Schema grouping feature added
- Type rename: `description` -> `semanticDescription` on ConstructSchema, FieldSchema, PortConfig
- Structured enum options: FieldSchema.options changed from `string[]` to `{ value: string; semanticDescription?: string }[]`
- SchemaCreationWizard: Multi-step wizard for creating/editing construct schemas (Basics, Fields, Ports)
- WizardModal: Reusable multi-step wizard modal shell in `src/components/ui/`
- Context menu: "New Construct Schema" added to pane right-click menu

## Conventions

- Node IDs: UUID via `crypto.randomUUID()`
- Semantic IDs: `{type}-{timestamp}{random}`
- Display names: Use `getDisplayName(data, schema)` from `src/utils/displayUtils.ts`
- Spacing: 4px-based scale only (4, 8, 12, 16, 24, 32)
- Primary buttons: emerald-500, Secondary: surface + border
