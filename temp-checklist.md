# Refactoring Checklist

**Goal:** Make refactoring quick, make isolating bugs quick.

## Priority Order

### 1. Index.ts barrel exports (30 min) ✅
- [x] `packages/web-client/src/hooks/index.ts`
- [x] `packages/web-client/src/components/ui/index.ts`
- [x] `packages/web-client/src/components/modals/index.ts`
- [x] `packages/web-client/src/components/canvas/index.ts`
- [x] `packages/web-client/src/components/metamap/index.ts`

**Why:** Enables cleaner refactoring for everything else. Moving files doesn't require updating imports everywhere.

---

### 2. Split useDocument hook (4h)
- [ ] Add granular subscription methods to `yjsAdapter.ts` (`subscribeToNodes`, `subscribeToSchemas`, etc.)
- [ ] Create `useNodes.ts` with `useSyncExternalStore`
- [ ] Create `useSchemas.ts` with `useSyncExternalStore`
- [ ] Create `useDeployables.ts` with `useSyncExternalStore`
- [ ] Create `useLevels.ts` with `useSyncExternalStore`
- [ ] Create `usePortSchemas.ts` with `useSyncExternalStore`
- [ ] Create `useSchemaGroups.ts` with `useSyncExternalStore`
- [ ] Refactor `useDocument.ts` to be a facade composing focused hooks
- [ ] Update consumers (can be incremental—facade maintains backwards compat)

**Why:** 479-line god hook with 50+ methods. Components subscribe to everything, any change triggers re-renders everywhere. Granular hooks = granular testing, granular re-renders.

**Reference:** temp-plan.md Section 9.1

---

### 3. Extract ConstructNode variants (3h)
- [ ] Create `components/canvas/ConstructNode/` directory
- [ ] Extract `ConstructNodePill.tsx` (~80 lines)
- [ ] Extract `ConstructNodeCard.tsx` (~150 lines)
- [ ] Extract `ConstructNodeDefault.tsx` (~200 lines)
- [ ] Create `index.tsx` with LOD dispatch logic
- [ ] Extract `ColorPicker` to `components/ui/ColorPicker.tsx`
- [ ] Pass schema via props (dependency inversion) instead of calling `useDocument()` inside

**Why:** 688 lines with 3 conditional render paths. Bugs hard to trace. Each variant testable independently.

**Reference:** temp-plan.md Section 9.2, 9.6

---

### 4. Extract Metamap layout to pure function (6h)
- [ ] Create `utils/metamapLayout.ts` with pure `computeMetamapLayout()` function
- [ ] Define `MetamapLayoutInput` and `MetamapLayoutOutput` interfaces
- [ ] Move Dagre configuration and algorithm to pure function
- [ ] Refactor `useMetamapLayout.ts` to thin wrapper (~50 lines) calling pure function
- [ ] Add unit tests for `computeMetamapLayout()`

**Why:** 603-line hook mixing Dagre algorithm with React state is untestable. Pure function = unit testable with just input data.

**Reference:** temp-plan.md Section 9.5

---

### 5. Create NodeActionsContext (3h)
- [ ] Create `contexts/NodeActionsContext.tsx` with stable callbacks
- [ ] Define `NodeActions` interface (renameNode, updateNodeValues, etc.)
- [ ] Create `NodeActionsProvider` wrapping `useNodes` operations
- [ ] Create `useNodeActions()` hook
- [ ] Wrap ReactFlow in `NodeActionsProvider` in Map.tsx
- [ ] Update ConstructNode variants to use `useNodeActions()` instead of prop callbacks
- [ ] Remove callback props from node data objects

**Why:** Large callback objects passed as props require tracing prop drilling when refactoring. Context makes callbacks available anywhere.

**Reference:** temp-plan.md Section 9.7

---

## Future Considerations (not in scope)

- ThemeProvider context (Section 9.3)
- Derive state during render for visual groups (Section 9.8)
- Selection context
- Layout layer components (AppLayout, CanvasLayout)
