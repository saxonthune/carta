---
title: "ADR: Presentation Model and Organizers"
status: accepted
---

# ADR: Presentation Model and Organizers

## Context

The codebase has visual grouping logic scattered across Map.tsx (data enhancement, callback injection, sorting), useVisualGroups (collapse/hide/edge remap), useGroupOperations (CRUD), ConstructNode (render style dispatch), and individual variant components. "Visual groups" use React Flow's parentId; "virtual parents" use a separate port-based grouping mechanism. The two concepts overlap and confuse the distinction between spatial organization and semantic relationships.

## Decision

1. **Rename visual groups to Organizers.** Organizers are a canvas-level grouping mechanism for spatial organization. They are never compiled. Constructs inside an organizer are "members", not "children" — parent/child is reserved for port semantics.

2. **Remove virtual parents entirely.** They bridge visual and semantic grouping, which is exactly the conflation we want to eliminate. Port connections are the sole way to express semantic parent/child relationships.

3. **Introduce a Presentation Model layer.** A pure function that transforms domain state into view state: node visibility, positioning, component dispatch, edge routing. Extracted from the current implicit logic in Map.tsx and useVisualGroups.

4. **Add layout strategies to organizers.** Each organizer has a layout strategy (freeform, stack, grid) that determines how members are arranged. Layout strategies are pure functions.

## Implementation Plan

### Phase 1: Domain Types and Utilities

**Goal:** Clean type foundation.

**Files to change:**
- `packages/domain/src/types/index.ts`
  - Rename `VisualGroupNodeData` → `OrganizerNodeData`
  - Add `layout: OrganizerLayout` field (`'freeform' | 'stack' | 'grid'`)
  - Add layout-specific state fields: `stackIndex?: number`, `gridColumns?: number`
  - Remove `VirtualParentNodeData` entirely
  - Remove `allowsGrouping` from `PortConfig` (virtual parent support)
  - Keep `groupId` on `ConstructSchema` and `PortSchema` unchanged (that's schema groups, unrelated)

- `packages/domain/src/utils/group-geometry.ts`
  - Rename to `organizer-geometry.ts`
  - Update function names: `computeGroupBounds` → `computeOrganizerBounds`, etc.
  - Add `nodeOverlapsOrganizer`, `nodeContainedInOrganizer` (rename from group variants)

- `packages/domain/src/utils/index.ts`
  - Update barrel export

### Phase 2: Presentation Model (New Module)

**Goal:** Pure, testable transformation layer.

**New directory:** `packages/web-client/src/presentation/`

**New files:**
- `presentation/index.ts` — barrel export
- `presentation/presentationModel.ts` — main entry point
  ```typescript
  interface PresentationInput {
    nodes: Node[];
    edges: Edge[];
    schemas: Map<string, ConstructSchema>;
    zoom: number;
  }

  interface PresentationOutput {
    processedNodes: Node[];  // with hidden, position adjustments
    processedEdges: Edge[];  // with remapping, bundling
    edgeRemap: Map<string, string>;  // hidden node → collapsed organizer
  }

  function computePresentation(input: PresentationInput): PresentationOutput
  ```

- `presentation/organizerProcessor.ts` — organizer-specific logic
  - Compute collapsed set (which organizers are collapsed)
  - Compute hidden descendants (recursive)
  - Build edge remap map
  - Delegate to layout strategies for positioning

- `presentation/layoutStrategies.ts` — layout strategy implementations
  ```typescript
  interface LayoutStrategy {
    computeLayout(organizer: OrganizerNodeData, members: Node[]): LayoutResult;
  }

  interface LayoutResult {
    positions: Map<string, { x: number; y: number }>;
    visibleSet: Set<string>;  // which members are visible (all for freeform/grid, one for stack)
    organizerSize?: { width: number; height: number };  // auto-computed size
  }
  ```
  - `freeformLayout` — members keep their positions (current behavior)
  - `stackLayout` — all members at same position, only `stackIndex` visible
  - `gridLayout` — compute grid cell positions from `gridColumns` and member count

- `presentation/nodeDispatch.ts` — render style + LOD dispatch table
  ```typescript
  type NodePresenterMap = Record<string, Record<LodBand, React.ComponentType<ConstructNodeVariantProps>>>;

  function getNodeComponent(renderStyle: string, lodBand: LodBand): React.ComponentType
  ```

**Migrate from:**
- `useVisualGroups.ts` → logic moves to `organizerProcessor.ts` (pure functions)
- Map.tsx enhancement pipeline → logic moves to `presentationModel.ts`
- ConstructNode/index.tsx dispatch → lookup moves to `nodeDispatch.ts`

### Phase 3: Organizer Components

**Goal:** Replace VisualGroupNode and VirtualParentNode with layout-aware OrganizerNode.

**Files to change:**
- `components/canvas/VisualGroupNode.tsx` → rename to `OrganizerNode.tsx`
  - Dispatch expanded state to layout-specific sub-components
  - Collapsed state shared across all layouts (chip with name + member count)

- **Delete** `components/canvas/VirtualParentNode.tsx`

**New files:**
- `components/canvas/organizer/OrganizerNode.tsx` — dispatcher (collapsed → chip, expanded → layout component)
- `components/canvas/organizer/OrganizerChip.tsx` — collapsed marker/chip (shared)
- `components/canvas/organizer/FreeformOrganizerLayout.tsx` — current expanded behavior (NodeResizer, free positioning)
- `components/canvas/organizer/StackOrganizerLayout.tsx` — single visible member, prev/next arrows, breadcrumb dots
- `components/canvas/organizer/GridOrganizerLayout.tsx` — auto-grid with column control

**Update:**
- `components/canvas/Map.tsx`
  - Replace `nodeTypes` registration: remove `virtual-parent`, rename `visual-group` → `organizer`
  - Remove all virtual parent handling code
  - Replace inline data enhancement with call to presentation model
  - Simplify callback injection (keep, but move visibility/position logic out)

- `components/canvas/index.ts` — update barrel exports

### Phase 4: Hooks Refactor

**Goal:** Clean hook API aligned with new naming.

**Files to change:**
- `hooks/useVisualGroups.ts` → delete (logic moved to presentation model pure functions)

- `hooks/useGroupOperations.ts` → rename to `hooks/useOrganizerOperations.ts`
  - Rename all operations: `createGroup` → `createOrganizer`, `attachToGroup` → `attachToOrganizer`, etc.
  - Add `changeLayout(organizerId, layout)` operation
  - Add attach validation: stacks/grids reject organizer members
  - Remove virtual parent operations (moved from useGraphOperations too)

- `hooks/useGraphOperations.ts`
  - Remove `createVirtualParent`, `toggleVirtualParentCollapse`, `removeVirtualParent`

- `hooks/index.ts` — update barrel exports

- **New:** `hooks/usePresentation.ts` — thin hook wrapper around the pure presentation model
  ```typescript
  function usePresentation(nodes, edges, schemas, zoom) {
    return useMemo(() => computePresentation({ nodes, edges, schemas, zoom }), [...]);
  }
  ```

### Phase 5: Context and UI Updates

**Goal:** Consistent terminology in all user-facing code.

**Files to change:**
- `contexts/NodeActionsContext.tsx` — update type from `UseGroupOperationsResult` to `UseOrganizerOperationsResult`

- `components/ui/ContextMenu.tsx`
  - "Group Selected" → "Organize Selected"
  - "Remove from Group" → "Remove from Organizer"
  - "Create new group" → "Create new Organizer"

- `components/canvas/Map.tsx` — update keyboard shortcut labels

### Phase 6: Compiler Update

**Goal:** Clean organizer handling in compiler.

**Files to change:**
- `packages/compiler/src/index.ts`
  - Update filter: `visual-group` → `organizer`
  - Remove virtual-parent filtering (type no longer exists)
  - Keep organizers excluded from semantic output

### Phase 7: Tests

**Goal:** All tests green with new naming and behavior.

**Files to change:**
- `tests/integration/visual-groups.test.tsx` → rename to `organizer.test.tsx`, update all references
- `tests/integration/group-operations.test.tsx` → rename to `organizer-operations.test.tsx`, update references
- `tests/e2e/visual-groups.spec.ts` → rename to `organizers.spec.ts`, update references
- `tests/integration/metamap-layout.test.ts` — update if it references visual groups
- `tests/integration/context-menu-add-related.test.tsx` — update group terminology
- `tests/setup/testHelpers.ts` — update if it has group helpers

**New tests:**
- `tests/integration/presentation-model.test.ts` — unit tests for the pure presentation model functions
- `tests/integration/layout-strategies.test.ts` — unit tests for freeform/stack/grid layout strategies
- `tests/integration/organizer-nesting.test.ts` — nesting rules, business rule enforcement

### Phase 8: Example Files and Starter Content

**Files to change:**
- `packages/web-client/src/utils/starterContent.ts` — update visual group creation to use organizer type
- `packages/web-client/examples/*.carta` — update node types in example files

### Phase 9: Server/MCP

**Files to change:**
- `packages/server/src/mcp/tools.ts` — no change needed (groupId there is for schema groups, unrelated)

## Ordering

Phases 1-2 can be built first (types + pure functions) and tested independently. Phase 3-5 are the UI refactor (depends on 1-2). Phase 6-9 are cleanup (depends on 3-5).

Recommended execution order: 1 → 2 → 3+4 (parallel) → 5 → 6 → 7 → 8+9 (parallel).

## Consequences

- Virtual parents are gone. Users who relied on `allowsGrouping` ports will use organizers instead.
- The presentation model is testable without React or React Flow.
- New layout strategies can be added without touching existing ones.
- New render styles can be added without touching dispatch logic.
- Organizer nesting business rules are centralized in one validation function.

## Implementation Status

**Accepted and Implemented** (February 2026)

All phases (1-9) completed:
- Domain types updated: `OrganizerNodeData` with layout strategies, `VirtualParentNodeData` removed
- Presentation model implemented: `packages/web-client/src/presentation/` with pure transformation functions
- Layout strategies implemented: freeform, stack, grid
- Component refactor complete: `OrganizerNode` replaces `VisualGroupNode`, `VirtualParentNode` deleted
- Hooks refactored: `useOrganizerOperations` replaces `useGroupOperations`, `useVisualGroups` logic moved to presentation model
- Tests updated: `organizer.test.tsx`, `organizer-operations.test.tsx`, `organizer-geometry.test.ts`
- MCP tools updated with organizer operations
- Compiler updated to filter organizers (not compiled)

The presentation model is now the single source of truth for rendering decisions (visibility, positioning, component dispatch, edge routing). Organizers and port connections are cleanly separated at the architectural level.
