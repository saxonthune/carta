# Carta Codebase Context
<!-- Refresh this periodically to keep task-master efficient -->

## Architecture Summary

React Flow visual editor with Yjs state management.

## Component Tree

```
App.tsx
├── Header.tsx                    # Title, export/import, settings menu, theme
├── Map.tsx                       # React Flow canvas, context menus
│   ├── ConstructNode.tsx         # Node rendering, port handles, tooltips
│   │   └── Handle (per port)     # Port connection points, hover state
│   └── DeployableBackground.tsx  # Colored regions for deployables
├── Dock.tsx                      # Bottom panel with tabs
│   ├── InstanceEditor.tsx        # Selected node properties (Editor tab)
│   ├── ConstructEditor.tsx       # Schema CRUD (Constructs tab)
│   │   └── GroupedSchemaList.tsx # Grouped schema listing
│   ├── SchemaGroupEditor.tsx     # Group management (Groups tab)
│   ├── PortSchemaEditor.tsx      # Port type CRUD (Ports tab)
│   └── DeployablesEditor.tsx     # Deployable CRUD (Deployables tab)
└── Modals
    ├── CompileModal.tsx          # Compilation output
    ├── ExportPreviewModal.tsx    # Export preview
    ├── ImportPreviewModal.tsx    # Import preview
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
- `src/components/Header.tsx` - Top bar, settings, export/import
- `src/components/Dock.tsx` - Bottom panel, tabs
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

- Removed Zustand - Yjs is now single source of truth
- Removed singleton registries (registry.ts, deployables.ts)
- All state access via useDocument() hook through adapter
- Schema grouping feature added
- Style audit completed (spacing, button hierarchy)
- Test infrastructure set up (Vitest + Playwright)

## Conventions

- Node IDs: UUID via `crypto.randomUUID()`
- Semantic IDs: `{type}-{timestamp}{random}`
- Display names: Use `getDisplayName(data, schema)` from `src/utils/displayUtils.ts`
- Spacing: 4px-based scale only (4, 8, 12, 16, 24, 32)
- Primary buttons: emerald-500, Secondary: surface + border
