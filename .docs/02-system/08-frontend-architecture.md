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
Container:   CanvasContainer, Map, Metamap, App
Layout:      AppLayout, CanvasLayout
```

## State Partitioning

### By Ownership Lifecycle

| Lifetime | Where | Examples |
|----------|-------|----------|
| App (global) | Context / localStorage | Theme, AI API key |
| Document | Yjs Y.Doc via adapter | Nodes, edges, schemas |
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
  CanvasContainer.tsx (container: view switching + level navigation)
    Map.tsx (container: instances canvas)
      ConstructNode (domain: receives data via props)
    MetamapV2.tsx (container: schema canvas)
      SchemaNode (domain)
```

## Presentation Model

The presentation model is a pure transformation layer between domain state and React Flow rendering. It is not a React component or context — it is a stateless function that converts domain data into view-ready data. See doc02.09 for the full architecture.

**Key responsibilities:**
- Node visibility (organizer collapse hides members, stack layout hides non-active members)
- Node positioning (layout strategies compute child positions)
- Component dispatch (render style + LOD band → variant component)
- Edge routing (remapping edges for collapsed organizers, bundling parallel edges)

**Location:** `packages/web-client/src/presentation/` — pure functions consumed by Map.tsx.

## Feature Boundaries

| Feature | Data | Intent | Key Files |
|---------|------|--------|-----------|
| Canvas (instances) | Nodes, edges, connections | Build architecture | CanvasContainer.tsx, Map.tsx, useLayoutActions, useMapState |
| Metamap (schemas) | Schemas, groups, port schemas | Define types | MetamapV2.tsx |
| Schema editing | Schema form, field tiers, ports | Create/edit types | ConstructEditor.tsx |
| Compilation | Compiled output | Generate AI output | compiler/index.ts |
| Import/Export | File I/O | Persist and share | cartaFile.ts |
| Help / About | Config display, version | Show app info | Footer.tsx, HelpModal.tsx |
| AI Assistant | Chat, tool calls | AI-assisted editing | ai/ directory |

## Barrel Export Organization

Feature directories expose public APIs through `index.ts` barrel exports:

### `contexts/index.ts`
Organized by purpose:
- **Document context**: `DocumentProvider`, `useDocumentContext`, types
- **Node actions context**: `NodeActionsProvider`, `useNodeActions`, types

### `hooks/index.ts`
Organized by purpose:
- **Document state**: `useNodes`, `useEdges`, `useSchemas`, `usePortSchemas`, `useSchemaGroups`, `useSchemaPackages`, `useSpecGroups`, `useSchemaRelationships`, `usePages`, `useDocumentMeta`, `usePackagePicker`
- **Document operations**: `usePresentation`, `useOrganizerOperations`, `useLayoutActions`, `useEdgeCleanup`, `usePinConstraints`
- **UI state**: `useMapState`, `useNarrative`, `useEdgeBundling`, `useFlowTrace`
- **Map pipelines**: `useEdgeColor`, `useMapNodePipeline`, `useMapEdgePipeline`
- **Utilities**: `useUndoRedo`, `useClearDocument`
- **Workspace mode**: `useWorkspaceMode`

### `components/canvas/index.ts`
Canvas components and LOD:
- **Components**: `MapV2`, `MapV2Toolbar`, `CanvasContainer`, `AddConstructMenu`, `Narrative`, `CanvasToolbar`
- **LOD**: `DEFAULT_LOD_POLICY`, `getLodConfig`, types

**Note:** React Flow has been fully removed. `MapV2.tsx` uses canvas-engine primitives for full control over rendering and interaction. `MapV2PlaceholderNode` renders constructs whose schemas are missing from the document (drift detection fallback).

**Note:** `MapV2ConstructNode.tsx` renders construct nodes on the canvas. `Header` is a directory with modular implementations: `Header.tsx`, `ThemeMenu.tsx`, `SettingsMenu.tsx`, `ShareMenu.tsx`, `useClickOutside.ts`.

### `components/metamap/index.ts`
Schema view:
- `EdgeDetailPopover`, `MetamapConnectionModal`, `MetamapFilter`

### `components/modals/index.ts`
All modal dialogs:
- `CompileModal`, `HelpModal`, `DocumentBrowserModal`, `ImportPreviewModal`, `ExportPreviewModal`, `ConstructDebugModal`, `ClearWorkspaceModal`, `DeleteEmptySchemasModal`, `DeleteEmptyGroupsModal`, `PackagePickerModal`, `PackageDiffModal`

### `components/ui/index.ts`
Organized by type:
- **Primitives**: `Button`, `Input`, `Textarea`, `Select`, `Modal`, `ConfirmationModal`, `ColorPicker`, `Tooltip`
- **Navigation**: `TabBar`, `SegmentedControl`, `Breadcrumb`, `SearchBar`
- **Menus**: `ContextMenu`, `ContextMenuPrimitive`, `PopoverMenu`
- **Domain components**: `DocumentRow`, `FolderRow`, `GroupedSchemaList`, `SchemaGroupSelector`, `CollapsibleSelector`, `ChoiceCard`, `DraggableWindow`, `SimpleMarkdown`
- **Icons** (from `icons.tsx`): `PinIcon`, `WindowIcon`, `CloseIcon`, `ExpandIcon`, `CollapseIcon`, `EyeIcon`, `EyeOffIcon`

### `utils/index.ts`
Organized by purpose:
- **File format**: `exportProject`, `CartaFile`, `CartaFilePage` types
- **Import/export**: `importDocument`, `analyzeImport`, `analyzeExport`, related types
- **Preferences**: `getLastDocumentId`, `setLastDocumentId`
- **Random names**: `generateRandomName`
- **String utilities**: `stripHandlePrefix`
- **Node dimensions**: `getNodeDimensions`
- **Edge geometry**: `getRectBoundaryPoint`, `waypointsToPath`, `computeBezierPath`, types

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
- Presentation leakage: visibility/layout logic in React components instead of the presentation model
