# Carta Codebase Context
<!-- Refresh this periodically to keep task-master efficient -->

## Architecture Summary

React Flow visual editor with Yjs state management.

## Component Tree

```
App.tsx
├── Header.tsx                    # Title, export/import, settings, Map/Metamap toggle, Share (server mode)
│   ├── ConnectionStatus.tsx      # Connection indicator (server mode only)
│   └── DocumentBrowserModal.tsx  # Document browser/selector (server mode)
├── Map.tsx                       # React Flow canvas (instance view), context menus, wizard state, virtual-parent type
│   ├── ConstructNode.tsx         # Node rendering, port handles, tooltips
│   │   └── Handle (per port)     # Port connection points, hover state
│   ├── VirtualParentNode.tsx     # Visual grouping container (expand/collapse/no-edges)
│   ├── DeployableBackground.tsx  # Colored regions for deployables
│   ├── SchemaCreationWizard.tsx  # Multi-step wizard for schema creation/editing (Basics, Fields, Ports)
│   │   └── ui/WizardModal.tsx    # Reusable wizard modal shell
│   └── ContextMenu.tsx (src/)    # Shared context menu; Map shows node/paste ops + schema ops
├── Metamap.tsx                   # React Flow canvas (schema view), auto-layout, schema connections
│   ├── SchemaNode.tsx            # Schema node with port diamonds
│   ├── SchemaGroupNode.tsx       # Schema group node
│   ├── MetamapConnectionModal.tsx # Inter-schema connection modal (port color picker)
│   ├── SchemaCreationWizard.tsx  # Wizard for new schema creation
│   └── ContextMenu.tsx (src/)    # Shared context menu; Metamap shows only "New Construct Schema" + "New Group"
├── Footer.tsx                    # Footer bar
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
- `src/components/Header.tsx` - Top bar, settings, export/import, Map/Metamap toggle, Share (server mode)
- `src/components/ConnectionStatus.tsx` - Connection indicator (server mode only)
- `src/components/DocumentBrowserModal.tsx` - Document browser (server mode, required when ?doc= missing)
- `src/components/ConstructNode.tsx` - Node rendering, port handles (inline/collapsed), color picker (defaultOnly/tints/any), tooltips, three-band LOD rendering (pill/compact/normal)
- `src/components/Map.tsx` - React Flow canvas (instance view), context menus, drag-drop, edge bundling, smoothstep edges, custom zoom controls (1.15x step, minZoom: 0.15)
- `src/components/Metamap.tsx` - React Flow canvas (schema view), auto-layout, schema connections
- `src/components/BundledEdge.tsx` - Custom edge component for bundled parallel edges with count badge
- `src/components/lod/lodPolicy.ts` - LOD band configuration (pill/compact/normal modes with zoom thresholds)
- `src/components/lod/useLodBand.ts` - Hook that returns discrete LOD band based on current zoom level
- `src/components/ui/ContextMenuPrimitive.tsx` - Reusable context menu with nested submenus
- `src/components/ui/PortPickerPopover.tsx` - Port picker popover for collapsed port nodes
- `src/utils/colorUtils.ts` - Color utilities: hexToHsl, hslToHex, generateTints (7-stop lightness 92%-45%)
- `src/hooks/useEdgeBundling.ts` - Hook for grouping parallel edges between same node pair

**Existing Behaviors:**
- Port hover: Shows `port.label` tooltip with optional long-hover semantic description (ConstructNode.tsx)
- Port colors: Determined by `getPortColor(port.portType)` from port schema
- Node selection: Border + shadow via `selected` prop
- Port display modes: 'inline' (visible handles) or 'collapsed' (hidden, click port icon to reveal PortPickerPopover)
- Background color picker: 'defaultOnly' (no picker), 'tints' (7 swatches 92%-45% lightness), or 'any' (full HTML5 color picker)
- Instance color: Stored in `instanceColor` field, visual-only, not compiled, reset to null to use schema default
- Edge bundling: Parallel edges (same source/target nodes + port types) grouped visually with count badge
- Edge style: Smoothstep (curved) connections for all edges
- LOD rendering: Three zoom-based bands (pill <0.5, compact 0.5-1.0, normal ≥1.0) adjust node detail for performance/readability
- Text legibility: text-halo utility applies layered soft shadow for readable text on any background color
- Zoom controls: Custom implementation with 1.15x step (finer than default 1.2x), minZoom: 0.15 for deep zoom-out

**Editors:**
- `src/components/InstanceEditor.tsx` - Node instance editor
- `src/components/SchemaCreationWizard.tsx` - Multi-step schema creation/editing wizard
- `src/components/MetamapConnectionModal.tsx` - Schema connection modal with port color picker

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
- Removed Zustand - Yjs is now single source of truth
- Removed singleton registries (registry.ts, deployables.ts)
- All state access via useDocument() hook through adapter
- Schema grouping feature added
- Type rename: `description` -> `semanticDescription` on ConstructSchema, FieldSchema, PortConfig
- Structured enum options: FieldSchema.options changed from `string[]` to `{ value: string; semanticDescription?: string }[]`
- SchemaCreationWizard: Multi-step wizard for creating/editing construct schemas (Basics, Fields, Ports)
- WizardModal: Reusable multi-step wizard modal shell in `src/components/ui/`
- Context menu: "New Construct Schema" added to pane right-click menu
- Five-polarity model: Polarity extended from 3 to 5 values (added `relay`, `intercept`)
- Port `forward` renamed to `relay`; polarity-based wildcards (`*source*`, `*sink*`) removed
- Two-step canConnect validation: (1) polarity direction check, (2) compatibleWith for plain source+sink only
- VirtualParentNode: Visual grouping containers for child constructs (expand/collapse/no-edges)
- allowsGrouping on PortConfig and PortSchema enables virtual parent creation
- useGraphOperations: Added createVirtualParent(), toggleVirtualParentCollapse(), removeVirtualParent()
- SchemaCreationWizard Ports step: Full port configuration with PortsInitialChoice, PortsListStep, PortSubWizard
- Removed Drawer system: Drawer.tsx, DrawerTabs.tsx, ConstructEditor.tsx, PortSchemaEditor.tsx, SchemaGroupEditor.tsx, DeployablesEditor.tsx all deleted
- Metamap view: Schema-level modeling canvas with SchemaNode, SchemaGroupNode, auto-layout
- MetamapConnectionModal: Port color picker added for new port creation during schema connections
- Header toggle renamed: "Instances" → "Map" (toggles between Map and Metamap views)
- ContextMenu: Instance callbacks (onAddNode, onDeleteNode, etc.) now optional; Metamap only shows "New Construct Schema" and "New Group"
- Node facelift: Added backgroundColorPolicy ('defaultOnly', 'tints', 'any') and portDisplayPolicy ('inline', 'collapsed') to ConstructSchema
- Instance colors: ConstructNodeData.instanceColor for visual-only color overrides
- ContextMenuPrimitive: Reusable context menu primitive with nested submenu support (replaces inline implementations)
- Color utilities: hexToHsl, hslToHex, generateTints (7-stop tint generation) in colorUtils.ts
- PortPickerPopover: Port selection popover for collapsed port nodes
- Edge bundling: useEdgeBundling hook and BundledEdge component group parallel edges with count badge
- Edge style: Changed from straight to smoothstep (curved) connections
- Note schema: Built-in note type with backgroundColorPolicy: 'any' and portDisplayPolicy: 'collapsed'
- LOD system: Three-band level-of-detail rendering (pill/compact/normal) based on zoom thresholds for performance/readability
- text-halo utility: Universal text shadow utility in index.css for readable text on any background (layered soft blur)
- Custom zoom controls: 1.15x step (finer than default 1.2x) and minZoom: 0.15 for better zoom granularity
- ZoomDebug component: Temporary bottom-left debug display showing current zoom and LOD band

## Conventions

- Node IDs: UUID via `crypto.randomUUID()`
- Semantic IDs: `{type}-{timestamp}{random}`
- Display names: Use `getDisplayName(data, schema)` from `src/utils/displayUtils.ts`
- Spacing: 4px-based scale only (4, 8, 12, 16, 24, 32)
- Primary buttons: emerald-500, Secondary: surface + border
