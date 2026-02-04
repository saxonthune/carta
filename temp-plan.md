# Web-Client Codebase Census

**Status:** Complete with Improvement Examples
**Generated:** 2026-02-04
**Total Lines of Code:** ~5,500 (core src/) + ~16,000 (all components/hooks/utils)
**Reference Patterns:** [Vercel React Best Practices](~/.claude/skills/vercel-react-best-practices/AGENTS.md), [Vercel Composition Patterns](~/.claude/skills/vercel-composition-patterns/AGENTS.md)

This document is a primary source for architectural analysis. It catalogs patterns, anti-patterns, and improvement opportunities found during a thorough census of `@carta/web-client`. **Sections 9-10 provide concrete before/after code examples** showing how to apply Vercel Engineering patterns to the codebase.

---

## Table of Contents

1. [Directory Structure Overview](#1-directory-structure-overview)
2. [Component Layer Analysis](#2-component-layer-analysis)
3. [Hooks Analysis](#3-hooks-analysis)
4. [State Management Patterns](#4-state-management-patterns)
5. [Context Usage](#5-context-usage)
6. [Improvement Opportunities](#6-improvement-opportunities)
7. [Anti-Pattern Catalog](#7-anti-pattern-catalog)
8. [Recommendations Summary](#8-recommendations-summary)
9. [Concrete Improvement Examples](#9-concrete-improvement-examples) ← **NEW: Before/After Code**
10. [Additional Suggestions from React Best Practices](#10-additional-suggestions-from-react-best-practices) ← **NEW**

---

## 1. Directory Structure Overview

```
packages/web-client/src/
├── App.tsx                    # Root app component (284 lines)
├── main.tsx                   # Entry point with document resolution
├── index.css                  # Global styles, CSS variables, theming
├── ai/                        # AI assistant subsystem
│   ├── components/            # AISidebar, ChatMessage, ToolCallStatus
│   ├── hooks/                 # useAIChat (320 lines)
│   ├── openrouter/            # OpenRouter client, adapter, types
│   └── tools/                 # AI tools: addConstruct, deleteNode, etc.
├── components/
│   ├── canvas/                # Map.tsx (772 lines), ConstructNode.tsx (688 lines)
│   ├── metamap/               # Metamap.tsx (557 lines), SchemaNode, EdgeDetailPopover
│   ├── modals/                # 10 modal components
│   ├── ui/                    # Primitives: Button, Input, Modal, Select, etc.
│   ├── construct-editor/      # Full-screen schema editor (8 tab components)
│   ├── editors/               # Inline editors for constructs, ports, fields
│   ├── fields/                # Field type renderers: StringField, EnumField, etc.
│   ├── field-display/         # DraggableField, TierZone
│   └── schema-wizard/         # Schema creation wizard steps
├── config/
│   └── featureFlags.ts        # Runtime config from env vars
├── contexts/
│   └── DocumentContext.tsx    # Document provider with Yjs adapter lifecycle
├── hooks/                     # 13 hooks total
│   ├── useDocument.ts         # Primary document access hook (479 lines)
│   ├── useGraphOperations.ts  # Node CRUD operations (413 lines)
│   ├── useConnections.ts      # Edge connection logic (208 lines)
│   ├── useMapState.ts         # UI state extraction (160 lines)
│   ├── useMetamapLayout.ts    # Dagre-based layout (603 lines)
│   ├── useVisualGroups.ts     # Visual group computation (276 lines)
│   └── ... (6 more hooks)
├── stores/
│   ├── adapters/
│   │   └── yjsAdapter.ts      # Yjs document adapter (1170 lines)
│   └── documentRegistry.ts    # IndexedDB document registry
└── utils/                     # 11 utility modules
    ├── cartaFile.ts           # File format, import/export
    ├── documentImporter.ts    # Import logic
    ├── importAnalyzer.ts      # Import preview analysis
    ├── exportAnalyzer.ts      # Export preview analysis
    └── ... (7 more utils)
```

### File Size Distribution

| Category | Files | Total Lines | Largest File |
|----------|-------|-------------|--------------|
| Containers | 4 | ~1,700 | Map.tsx (772) |
| Domain Components | 15+ | ~3,000 | ConstructNode.tsx (688) |
| Hooks | 13 | ~2,300 | useMetamapLayout.ts (603) |
| UI Primitives | 18 | ~1,200 | Modal.tsx (105) |
| Stores/Adapters | 2 | ~1,350 | yjsAdapter.ts (1170) |
| Utils | 11 | ~1,100 | documentImporter.ts (241) |

---

## 2. Component Layer Analysis

### Layer Mapping (per doc02.08)

| Layer | Components | Status |
|-------|------------|--------|
| **Primitives** | Button, Input, Textarea, Select, Modal, TabBar, SegmentedControl, SearchBar, Breadcrumb, icons | ✓ Good abstraction |
| **Domain** | ConstructNode, SchemaNode, PortDrawer, DynamicAnchorEdge, VisualGroupNode, VirtualParentNode | ⚠️ Mixed concerns |
| **Container** | Map, Metamap, CanvasContainer, App | ⚠️ Large containers |
| **Layout** | (none explicit) | ❌ Missing layer |

### Layer Violations Detected

#### 1. **ConstructNode.tsx (688 lines)** — Domain component with mixed concerns

**Issues:**
- Contains inline `ColorPicker` component (should be extracted to primitive)
- Directly calls `useDocument()` hook inside a memoized component (should receive data via props)
- Multiple render modes (pill/card/default) with significant duplication
- Contains business logic for deployable creation (`handleCreateDeployable`)
- Manages local UI state (`editingField`, `showNewDeployableModal`)

**Evidence:**
```tsx
// Line 83: useDocument() called inside domain component
const { getSchema, addDeployable } = useDocument();

// Line 164: Business logic in domain component
const handleCreateDeployable = (name: string, description: string) => {
  const newDeployable = addDeployable({...});
  data.onDeployableChange?.(newDeployable.id);
};
```

**Recommendation:** Extract data access to parent, pass via props. Split into `ConstructNodePill`, `ConstructNodeCard`, `ConstructNodeDefault` variants.

#### 2. **Map.tsx (772 lines)** — Container with too many responsibilities

**Issues:**
- Manages 15+ pieces of state
- Contains debug component (`ZoomDebug`) inline
- Imports 20+ modules
- Renders 6+ overlays/modals inline
- Contains business logic that should be in hooks

**Evidence:**
```tsx
// Lines 208-210: Multiple state declarations
const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
```

**Recommendation:** Extract `ZoomDebug` to separate file. Create `useMapSelection` hook for selection state. Move modal rendering to a `MapModals` subcomponent.

#### 3. **Header.tsx (488 lines)** — Large component with embedded menus

**Issues:**
- 9+ useState declarations
- 3 inline menus (theme, settings, share) with duplication
- Contains business logic (`changeTheme`, `handleStartSharing`)
- Renders 4 modals inline

**Evidence:**
```tsx
// Lines 36-51: Many useState calls
const [theme, setTheme] = useState<'light' | 'dark' | 'warm'>(...);
const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
// ... 6 more useState calls
```

**Recommendation:** Extract menus to `ThemeMenu`, `SettingsMenu`, `ShareMenu` components. Create `useHeaderState` hook for state consolidation.

#### 4. **Missing Layout Layer**

No explicit layout components exist. The container components directly manage layout concerns.

**Recommendation:** Create `AppLayout`, `CanvasLayout` components that handle structural arrangement via slots.

---

## 3. Hooks Analysis

### Hook Inventory

| Hook | Lines | Purpose | Issues |
|------|-------|---------|--------|
| `useDocument` | 479 | Primary document access | ⚠️ Returns 50+ methods, monolithic interface |
| `useGraphOperations` | 413 | Node CRUD | ✓ Well-factored |
| `useMetamapLayout` | 603 | Dagre layout for Metamap | ⚠️ Complex, hard to test |
| `useConnections` | 208 | Edge connection logic | ✓ Well-factored |
| `useVisualGroups` | 276 | Compute group nodes | ✓ Well-factored |
| `useMapState` | 160 | UI state for Map | ✓ Good extraction |
| `useClipboard` | 118 | Copy/paste | ✓ Well-factored |
| `useUndoRedo` | 103 | Y.UndoManager wrapper | ✓ Well-factored |
| `useKeyboardShortcuts` | 109 | Keyboard handling | ✓ Well-factored |
| `useEdgeBundling` | 77 | Edge grouping | ✓ Well-factored |
| `useLodBand` | ~30 | LOD band detection | ✓ Well-factored |
| `useAwareness` | ~50 | Yjs awareness | ✓ Well-factored |
| `useDirtyStateGuard` | ~40 | Unsaved changes guard | ✓ Well-factored |
| `useClearDocument` | ~30 | Document clearing | ✓ Well-factored |

### Hook Issues

#### 1. **useDocument (479 lines)** — God hook

Returns 50+ methods and state values. This violates the single-responsibility principle.

**Current interface excerpt:**
```tsx
export interface UseDocumentResult {
  nodes, edges, title, description, schemas, portSchemas, deployables,
  levels, activeLevel, schemaGroups,
  setNodes, setEdges, setTitle, setDescription, getNextNodeId, updateNode,
  setActiveLevel, createLevel, deleteLevel, updateLevel, duplicateLevel, copyNodesToLevel,
  getSchema, setSchemas, addSchema, updateSchema, removeSchema,
  getPortSchema, getPortSchemas, setPortSchemas, addPortSchema, updatePortSchema, removePortSchema,
  getDeployable, setDeployables, addDeployable, updateDeployable, removeDeployable,
  getSchemaGroup, getSchemaGroups, setSchemaGroups, addSchemaGroup, updateSchemaGroup, removeSchemaGroup,
  getVisualGroups, addVisualGroup, updateVisualGroup, removeVisualGroup,
  importNodes,
}
```

**Recommendation:** Split into focused hooks:
- `useNodes()` — Node state and mutations
- `useSchemas()` — Schema CRUD
- `useDeployables()` — Deployable CRUD
- `useLevels()` — Level management
- `usePortSchemas()` — Port schema CRUD
- `useSchemaGroups()` — Schema group CRUD
- `useVisualGroups()` — Visual group CRUD

#### 2. **useMetamapLayout (603 lines)** — Complex layout algorithm

Contains Dagre layout computation with group nesting, auto-layout, and edge generation. Hard to test in isolation.

**Recommendation:** Extract Dagre-specific logic to a pure function in `utils/metamapLayout.ts`. Hook becomes a thin wrapper that calls the pure function and manages React state.

---

## 4. State Management Patterns

### Current State Partitioning

| Lifetime | Where | Examples |
|----------|-------|----------|
| App (global) | localStorage | Theme, AI API key |
| Document | Yjs Y.Doc via adapter | Nodes, edges, schemas, deployables |
| Component | useState | Modal open/close, hover, rename mode |
| URL | URL params | `?doc={id}` |

### State Flow

```
DocumentProvider (creates adapter, manages lifecycle)
       ↓
useDocumentContext() (provides adapter)
       ↓
useDocument() (wraps adapter with React state sync)
       ↓
Components (consume via props or direct hook calls)
```

### Issues

1. **Double state sync**: `useDocument` maintains local React state that mirrors adapter state, with `useEffect` subscription to keep in sync. This creates potential for stale reads during rapid updates.

2. **No memoization on adapter methods**: Every render creates new callback references, potentially causing unnecessary re-renders in children.

3. **Visual groups require manual version bumping**:
```tsx
// Line 328-333 in useDocument.ts
const getVisualGroups = useCallback(
  (levelId: string) => {
    void visualGroupsVersion; // Force re-evaluation
    return adapter.getVisualGroups(levelId);
  },
  [adapter, visualGroupsVersion]
);
```

---

## 5. Context Usage

### Contexts

| Context | Purpose | Consumers |
|---------|---------|-----------|
| `DocumentContext` | Provides adapter and document metadata | All document-aware components |
| React Flow internal contexts | Canvas state | Map, Metamap |

### Context Pattern Analysis

**Good:**
- Single document context with clear lifecycle management
- Adapter abstraction allows swapping implementations

**Issues:**
- No context for UI preferences (theme is in localStorage + useState)
- No context for selection state (passed via props through multiple levels)
- No context for modal state (each component manages its own modals)

**Recommendation:** Consider adding:
- `UIContext` for theme, preferences
- `SelectionContext` for canvas selection state
- Or adopt compound component pattern for modals

---

## 6. Improvement Opportunities

### High Impact, Low Effort

| Opportunity | Effort | Benefit | Files Affected |
|-------------|--------|---------|----------------|
| Extract `ZoomDebug` to separate file | 0.5h | Code organization | Map.tsx, Metamap.tsx |
| Extract `ColorPicker` to primitives | 1h | Reusability | ConstructNode.tsx, ui/ColorPicker.tsx |
| Create `ThemeMenu` component | 1h | Reduce Header complexity | Header.tsx |
| Add index.ts exports | 0.5h | Clean imports | hooks/, components/ui/ |

### High Impact, Medium Effort

| Opportunity | Effort | Benefit | Files Affected |
|-------------|--------|---------|----------------|
| Split `useDocument` into focused hooks | 4h | Testability, clarity | useDocument.ts, all consumers |
| Extract `ConstructNode` variants | 3h | Maintainability | ConstructNode.tsx |
| Create `useHeaderState` hook | 2h | Reduce Header complexity | Header.tsx |
| Add Layout layer components | 3h | Architectural clarity | New files, App.tsx |

### Medium Impact, High Effort

| Opportunity | Effort | Benefit | Files Affected |
|-------------|--------|---------|----------------|
| Extract Metamap layout to pure function | 6h | Testability | useMetamapLayout.ts |
| Implement compound component pattern for modals | 8h | Composition | All modal consumers |
| Adopt state/actions/meta interface pattern | 8h | Dependency injection | All hooks and providers |

---

## 7. Anti-Pattern Catalog

### 7.1 Boolean Prop Proliferation

**Location:** `ContextMenu.tsx`

The `ContextMenu` component accepts many conditional props to control behavior:

```tsx
interface ContextMenuProps {
  type: 'pane' | 'node' | 'edge';
  nodeId?: string;
  edgeId?: string;
  selectedCount: number;
  relatedConstructs?: RelatedConstructOption[];
  constructOptions?: ConstructOption[];
  canPaste: boolean;
  // ... 15+ more props
}
```

**Recommendation:** Split into `PaneContextMenu`, `NodeContextMenu`, `EdgeContextMenu` variants, or use compound component pattern.

### 7.2 Monolithic Components

**Location:** `ConstructNode.tsx` (688 lines)

Single component handles pill mode, card mode, and default mode with significant code duplication between branches.

**Evidence:**
```tsx
// Three nearly-identical render paths:
if (lod.band === 'pill') { /* 54 lines */ }
if (isCard) { /* 175 lines */ }
/* default: 250 lines */
```

**Recommendation:** Extract to variant components or use polymorphic pattern.

### 7.3 UI State in Multiple Places

**Location:** Header.tsx

Theme state is managed in three places:
1. localStorage (persistence)
2. useState (component state)
3. DOM attribute (`data-theme`)

```tsx
const [theme, setTheme] = useState<'light' | 'dark' | 'warm'>(() => {
  const initialTheme = getInitialTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);
  return initialTheme;
});
```

**Recommendation:** Create `ThemeProvider` context that centralizes theme state management.

### 7.4 Direct Adapter Access in Domain Components

**Location:** ConstructNode.tsx

Domain component directly accesses document adapter via hook:

```tsx
const { getSchema, addDeployable } = useDocument();
```

This couples the domain component to the data access layer.

**Recommendation:** Pass schema and deployable operations via props (dependency inversion).

### 7.5 Inline Subcomponents

**Location:** Map.tsx, Metamap.tsx

Both files define `ZoomDebug` component inline:

```tsx
function ZoomDebug() {
  // 25 lines of component code
}

export default function Map(...) {
  // ...
  return <ZoomDebug />
}
```

**Recommendation:** Extract to shared component file.

### 7.6 Large Callback Objects Passed as Props

**Location:** Map.tsx → ConstructNode.tsx

Callbacks are attached to node data objects, creating large prop objects:

```tsx
data: {
  onRename: (newName: string) => renameNode(node.id, newName),
  onValuesChange: (values: ConstructValues) => updateNodeValues(node.id, values),
  onSetViewLevel: (level: 'summary' | 'details') => setNodeViewLevel(node.id, level),
  onToggleDetailsPin: () => toggleNodeDetailsPin(node.id),
  onOpenFullView: () => setFullViewNodeId(node.id),
  onDeployableChange: (deployableId: string | null) => updateNodeDeployable(node.id, deployableId),
  onInstanceColorChange: (color: string | null) => updateNodeInstanceColor(node.id, color),
  // ...
}
```

**Recommendation:** Create a `NodeActionsContext` that provides these callbacks, avoiding prop drilling.

### 7.7 Effect-Based State Sync

**Location:** useDocument.ts

Uses `useEffect` to sync React state with adapter:

```tsx
useEffect(() => {
  const unsubscribe = adapter.subscribe(() => {
    setNodesState(adapter.getNodes() as Node[]);
    setEdgesState(adapter.getEdges() as Edge[]);
    // ... 8 more setState calls
  });
  return unsubscribe;
}, [adapter]);
```

This creates a subscription that updates all state on any change, even if only one piece of state changed.

**Recommendation:** Use `useSyncExternalStore` for more efficient subscriptions, or split into separate hooks that subscribe independently.

---

## 8. Recommendations Summary

### Priority 1: Quick Wins (< 1 day total)

1. **Extract inline components**
   - `ZoomDebug` → `components/canvas/ZoomDebug.tsx`
   - `ColorPicker` → `components/ui/ColorPicker.tsx`
   - Effort: 1h | Benefit: Code organization

2. **Add index.ts barrel exports**
   - `hooks/index.ts`
   - `components/ui/index.ts`
   - `components/modals/index.ts`
   - Effort: 30min | Benefit: Clean imports

3. **Extract menu components from Header**
   - `ThemeMenu.tsx`
   - `SettingsMenu.tsx`
   - Effort: 2h | Benefit: Header.tsx complexity reduction

### Priority 2: Architectural Improvements (1-2 days each)

4. **Split useDocument hook**
   - Create `useNodes`, `useSchemas`, `useDeployables`, `useLevels`
   - Keep `useDocument` as facade that combines them
   - Effort: 4h | Benefit: Testability, single responsibility

5. **Extract ConstructNode variants**
   - `ConstructNodePill.tsx`
   - `ConstructNodeCard.tsx`
   - `ConstructNodeDefault.tsx`
   - Effort: 3h | Benefit: Maintainability, reduced complexity

6. **Add Layout layer**
   - `AppLayout.tsx` — Header/content/footer structure
   - `CanvasLayout.tsx` — Toolbar/canvas/sidebar structure
   - Effort: 3h | Benefit: Architectural clarity

### Priority 3: Pattern Adoption (3-5 days each)

7. **Adopt Vercel composition patterns**
   - Implement `state/actions/meta` interface for contexts
   - Create compound components for complex UI (modals, menus)
   - Effort: 8h | Benefit: Dependency injection, composition

8. **Create selection context**
   - `SelectionContext` for canvas selection state
   - Remove selection prop drilling through Map → ContextMenu → etc.
   - Effort: 4h | Benefit: Cleaner component interfaces

9. **Extract Metamap layout logic**
   - Pure function in `utils/metamapLayout.ts`
   - Unit-testable Dagre configuration
   - Effort: 6h | Benefit: Testability

### Overlap with Vercel Composition Patterns

| Vercel Pattern | Current Status | Opportunity |
|----------------|---------------|-------------|
| Avoid boolean prop proliferation | ❌ ContextMenu, ConstructNode | Split into variant components |
| Compound components | ❌ Not used | Modal, Menu patterns |
| State decoupled from UI | ⚠️ Partial | DocumentProvider is good; add ThemeProvider |
| Generic context interfaces | ❌ Not used | Adopt `state/actions/meta` pattern |
| Lift state into providers | ⚠️ Partial | Add SelectionProvider, NodeActionsProvider |
| Explicit component variants | ❌ Conditional rendering | Create explicit variants |
| Children over render props | ✓ Mostly followed | — |

### Files Requiring Most Attention

1. **ConstructNode.tsx** (688 lines) — Split variants, extract ColorPicker, remove direct adapter access
2. **Map.tsx** (772 lines) — Extract ZoomDebug, create useMapSelection, modularize overlays
3. **Header.tsx** (488 lines) — Extract menus, create useHeaderState
4. **useDocument.ts** (479 lines) — Split into focused hooks
5. **useMetamapLayout.ts** (603 lines) — Extract pure layout function

---

## 9. Concrete Improvement Examples

This section provides before/after code examples for the highest-impact improvements, incorporating patterns from **Vercel React Best Practices**.

### 9.1 Split useDocument Hook — Before/After

**Before (current):** God hook with 50+ methods, monolithic state sync

```tsx
// hooks/useDocument.ts (479 lines)
export function useDocument(): UseDocumentResult {
  const { adapter } = useDocumentContext();

  // All state synced via useEffect — triggers on ANY change
  const [nodesState, setNodesState] = useState<Node[]>([]);
  const [edgesState, setEdgesState] = useState<Edge[]>([]);
  const [schemasState, setSchemasState] = useState<ConstructSchema[]>([]);
  const [deployablesState, setDeployablesState] = useState<Deployable[]>([]);
  // ... 8 more useState calls

  useEffect(() => {
    const unsubscribe = adapter.subscribe(() => {
      // Updates ALL state on ANY change — inefficient
      setNodesState(adapter.getNodes() as Node[]);
      setEdgesState(adapter.getEdges() as Edge[]);
      setSchemasState(adapter.getSchemas());
      // ... 8 more setState calls
    });
    return unsubscribe;
  }, [adapter]);

  // 50+ useCallback methods...
  return { nodes, edges, schemas, addNode, updateNode, ... };
}
```

**After:** Focused hooks using `useSyncExternalStore` (Vercel pattern `rerender-derived-state`)

```tsx
// hooks/useNodes.ts
import { useSyncExternalStore } from 'react';

export function useNodes() {
  const { adapter } = useDocumentContext();

  // useSyncExternalStore only re-renders when nodes change
  const nodes = useSyncExternalStore(
    adapter.subscribeToNodes,  // Subscribe function
    adapter.getNodes,          // Get snapshot
    adapter.getNodes           // Get server snapshot (SSR)
  );

  // Functional setState for stable callbacks (Vercel pattern rerender-functional-setstate)
  const updateNode = useCallback((id: string, data: Partial<ConstructNodeData>) => {
    adapter.updateNode(id, data);
  }, [adapter]);

  return { nodes, updateNode };
}

// hooks/useSchemas.ts
export function useSchemas() {
  const { adapter } = useDocumentContext();

  const schemas = useSyncExternalStore(
    adapter.subscribeToSchemas,
    adapter.getSchemas,
    adapter.getSchemas
  );

  const addSchema = useCallback((schema: Partial<ConstructSchema>) => {
    return adapter.addSchema(schema);
  }, [adapter]);

  return { schemas, addSchema, updateSchema, removeSchema };
}

// hooks/useDocument.ts — facade that composes focused hooks
export function useDocument() {
  const { nodes, updateNode } = useNodes();
  const { schemas, addSchema } = useSchemas();
  const { deployables } = useDeployables();
  // ...compose all focused hooks

  return { nodes, schemas, deployables, updateNode, addSchema, ... };
}
```

**Adapter changes needed:**

```tsx
// stores/adapters/yjsAdapter.ts
class YjsAdapter {
  private nodeListeners = new Set<() => void>();
  private schemaListeners = new Set<() => void>();

  // Granular subscription methods for useSyncExternalStore
  subscribeToNodes = (callback: () => void) => {
    this.nodeListeners.add(callback);
    return () => this.nodeListeners.delete(callback);
  };

  subscribeToSchemas = (callback: () => void) => {
    this.schemaListeners.add(callback);
    return () => this.schemaListeners.delete(callback);
  };

  // Notify only relevant listeners on changes
  private notifyNodeChange() {
    this.nodeListeners.forEach(cb => cb());
  }
}
```

**Impact:** Eliminates unnecessary re-renders. Components using only schemas won't re-render on node changes.

---

### 9.2 Extract ConstructNode Variants — Before/After

**Before (current):** Single component with 3 conditional render paths

```tsx
// components/canvas/ConstructNode.tsx (688 lines)
const ConstructNode = memo(function ConstructNode({ id, data, selected }: NodeProps<ConstructNodeData>) {
  // Direct hook call inside domain component — violates layer separation
  const { getSchema, addDeployable } = useDocument();

  const schema = getSchema(data.schemaId);
  const lod = useLodBand();

  // 54 lines for pill mode
  if (lod.band === 'pill') {
    return (
      <div className="construct-node-pill">
        {/* duplicated logic */}
      </div>
    );
  }

  // 175 lines for card mode
  if (data.viewLevel === 'card') {
    return (
      <div className="construct-node-card">
        {/* similar but different rendering */}
      </div>
    );
  }

  // 250 lines for default mode
  return (
    <div className="construct-node">
      {/* full rendering */}
    </div>
  );
});
```

**After:** Explicit variant components (Vercel composition pattern)

```tsx
// components/canvas/ConstructNode/index.tsx — entry point with LOD dispatch
interface ConstructNodeProps {
  id: string;
  data: ConstructNodeData;
  selected: boolean;
  // Props passed from parent — dependency inversion
  schema: ConstructSchema;
  onUpdateNode: (id: string, data: Partial<ConstructNodeData>) => void;
  onAddDeployable: (data: Partial<Deployable>) => Deployable;
}

export const ConstructNode = memo(function ConstructNode(props: ConstructNodeProps) {
  const lod = useLodBand();

  // Explicit variant selection — no duplicated logic
  if (lod.band === 'pill') {
    return <ConstructNodePill {...props} />;
  }

  if (props.data.viewLevel === 'card') {
    return <ConstructNodeCard {...props} />;
  }

  return <ConstructNodeDefault {...props} />;
});

// components/canvas/ConstructNode/ConstructNodePill.tsx (~80 lines)
export const ConstructNodePill = memo(function ConstructNodePill({
  data,
  schema,
  selected
}: ConstructNodeProps) {
  const displayName = getDisplayName(data, schema);
  const backgroundColor = data.instanceColor ?? schema.defaultBackgroundColor;

  return (
    <div
      className={cn('construct-node-pill', selected && 'selected')}
      style={{ backgroundColor }}
    >
      <span className="name">{displayName}</span>
    </div>
  );
});

// components/canvas/ConstructNode/ConstructNodeCard.tsx (~150 lines)
export const ConstructNodeCard = memo(function ConstructNodeCard({
  data,
  schema,
  onUpdateNode,
  id
}: ConstructNodeProps) {
  // Card-specific state
  const [isEditing, setIsEditing] = useState(false);

  // Functional setState for stable callback (Vercel pattern)
  const handleFieldChange = useCallback((fieldId: string, value: unknown) => {
    onUpdateNode(id, {
      values: { ...data.values, [fieldId]: value }
    });
  }, [id, onUpdateNode, data.values]);

  return (
    <div className="construct-node-card">
      <ConstructNodeHeader data={data} schema={schema} />
      <ConstructNodeFields
        fields={schema.fields}
        values={data.values}
        onChange={handleFieldChange}
      />
    </div>
  );
});

// components/canvas/ConstructNode/ConstructNodeDefault.tsx (~200 lines)
export const ConstructNodeDefault = memo(function ConstructNodeDefault(props: ConstructNodeProps) {
  // Full rendering with all features
  return (
    <div className="construct-node">
      <ConstructNodeHeader {...props} />
      <ConstructNodeFields {...props} />
      <PortDrawer {...props} />
    </div>
  );
});
```

**Parent provides data (dependency inversion):**

```tsx
// components/canvas/Map.tsx
const { nodes } = useNodes();
const { schemas, getSchema } = useSchemas();

// Build index map for O(1) lookups (Vercel pattern js-index-maps)
const schemaById = useMemo(
  () => new Map(schemas.map(s => [s.id, s])),
  [schemas]
);

const nodeTypes = useMemo(() => ({
  construct: (nodeProps: NodeProps) => (
    <ConstructNode
      {...nodeProps}
      schema={schemaById.get(nodeProps.data.schemaId)!}
      onUpdateNode={updateNode}
      onAddDeployable={addDeployable}
    />
  ),
}), [schemaById, updateNode, addDeployable]);
```

**Impact:** Smaller files, easier testing, no direct hook calls in domain components, explicit variants over conditional rendering.

---

### 9.3 Replace Effect-Based State Sync — Before/After

**Before (current):** Theme managed in 3 places

```tsx
// components/Header.tsx
const [theme, setTheme] = useState<'light' | 'dark' | 'warm'>(() => {
  const initialTheme = getInitialTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);
  return initialTheme;
});

// Theme change requires manual DOM sync
const changeTheme = (newTheme: 'light' | 'dark' | 'warm') => {
  setTheme(newTheme);
  localStorage.setItem('carta-theme', newTheme);
  document.documentElement.setAttribute('data-theme', newTheme);
};
```

**After:** ThemeProvider with lazy initialization (Vercel patterns `rerender-lazy-state-init`, `server-cache-lru`)

```tsx
// contexts/ThemeContext.tsx
type Theme = 'light' | 'dark' | 'warm';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Cache localStorage reads (Vercel pattern js-cache-storage)
let cachedTheme: Theme | null = null;

function getStoredTheme(): Theme {
  if (cachedTheme !== null) return cachedTheme;
  try {
    const stored = localStorage.getItem('carta-theme');
    cachedTheme = (stored as Theme) ?? 'light';
  } catch {
    cachedTheme = 'light';
  }
  return cachedTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initialization (Vercel pattern)
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = getStoredTheme();
    // Set DOM attribute synchronously during init
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initial);
    }
    return initial;
  });

  // Stable callback via functional update pattern
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    cachedTheme = newTheme;
    try {
      localStorage.setItem('carta-theme', newTheme);
    } catch {}
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

**Usage in Header becomes trivial:**

```tsx
// components/Header.tsx
function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <ThemeMenu
      currentTheme={theme}
      onThemeChange={setTheme}
    />
  );
}
```

**Impact:** Single source of truth for theme, no manual DOM sync scattered across components.

---

### 9.4 Stable Callbacks with Functional Updates — Before/After

**Before (current):** Callbacks depend on state, causing re-renders

```tsx
// hooks/useClipboard.ts
const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

// Callback recreated when clipboard changes
const paste = useCallback(() => {
  if (!clipboard) return;
  // Use clipboard.nodes
  addNodes(clipboard.nodes);
}, [clipboard, addNodes]); // ❌ clipboard in deps causes recreation
```

**After:** Functional setState for stable callbacks (Vercel pattern `rerender-functional-setstate`)

```tsx
// hooks/useClipboard.ts
const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
const clipboardRef = useRef<ClipboardData | null>(null);

// Keep ref in sync (for callbacks that don't update state)
useEffect(() => {
  clipboardRef.current = clipboard;
}, [clipboard]);

// Stable callback — never recreated
const paste = useCallback(() => {
  const data = clipboardRef.current;
  if (!data) return;
  addNodes(data.nodes);
}, [addNodes]); // ✅ No clipboard dependency

// For state updates, use functional form
const appendToClipboard = useCallback((nodes: Node[]) => {
  setClipboard(curr => ({
    nodes: [...(curr?.nodes ?? []), ...nodes],
  }));
}, []); // ✅ Empty deps — always stable
```

---

### 9.5 Extract Metamap Layout to Pure Function — Before/After

**Before (current):** Algorithm mixed with React state

```tsx
// hooks/useMetamapLayout.ts (603 lines)
export function useMetamapLayout(...) {
  const [layoutNodes, setLayoutNodes] = useState<Node[]>([]);
  const [layoutEdges, setLayoutEdges] = useState<Edge[]>([]);

  useEffect(() => {
    // 400+ lines of Dagre layout computation...
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', ... });

    // Complex nesting logic...
    schemaGroups.forEach(group => {
      // ...
    });

    dagre.layout(g);

    // Extract positions...
    const nodes = g.nodes().map(...);
    setLayoutNodes(nodes);
    setLayoutEdges(edges);
  }, [schemas, schemaGroups, portSchemas]);

  return { layoutNodes, layoutEdges };
}
```

**After:** Pure function + thin hook wrapper

```tsx
// utils/metamapLayout.ts — PURE FUNCTION, testable in isolation
export interface MetamapLayoutInput {
  schemas: ConstructSchema[];
  schemaGroups: SchemaGroup[];
  portSchemas: PortSchema[];
  config?: LayoutConfig;
}

export interface MetamapLayoutOutput {
  nodes: Node[];
  edges: Edge[];
}

export function computeMetamapLayout(input: MetamapLayoutInput): MetamapLayoutOutput {
  const { schemas, schemaGroups, portSchemas, config = defaultConfig } = input;

  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir: config.rankdir, nodesep: config.nodesep, ... });

  // Build index maps for O(1) lookups (Vercel pattern js-index-maps)
  const schemaById = new Map(schemas.map(s => [s.id, s]));
  const groupById = new Map(schemaGroups.map(g => [g.id, g]));

  // Add nodes
  schemas.forEach(schema => {
    g.setNode(schema.id, {
      width: config.nodeWidth,
      height: estimateNodeHeight(schema)
    });
  });

  // Add groups
  schemaGroups.forEach(group => {
    g.setNode(group.id, { ... });
    group.schemaIds.forEach(schemaId => {
      g.setParent(schemaId, group.id);
    });
  });

  // Add edges from port relationships
  // ...

  dagre.layout(g);

  // Extract results
  const nodes: Node[] = g.nodes().map(id => ({
    id,
    position: { x: g.node(id).x, y: g.node(id).y },
    // ...
  }));

  return { nodes, edges };
}

// hooks/useMetamapLayout.ts — thin wrapper (~50 lines)
export function useMetamapLayout(
  schemas: ConstructSchema[],
  schemaGroups: SchemaGroup[],
  portSchemas: PortSchema[]
) {
  // Memoize with stable reference check
  const layout = useMemo(
    () => computeMetamapLayout({ schemas, schemaGroups, portSchemas }),
    [schemas, schemaGroups, portSchemas]
  );

  return layout;
}
```

**Test file becomes possible:**

```tsx
// utils/__tests__/metamapLayout.test.ts
describe('computeMetamapLayout', () => {
  it('positions schemas in groups', () => {
    const result = computeMetamapLayout({
      schemas: [mockSchema1, mockSchema2],
      schemaGroups: [{ id: 'g1', schemaIds: ['s1', 's2'] }],
      portSchemas: [],
    });

    expect(result.nodes).toHaveLength(3); // 2 schemas + 1 group
    expect(result.nodes[0].position.y).toBeLessThan(result.nodes[1].position.y);
  });
});
```

**Impact:** Unit-testable layout algorithm, easier debugging, hook stays simple.

---

### 9.6 Extract ColorPicker to Primitive — Before/After

**Before (current):** ColorPicker defined inline in ConstructNode

```tsx
// components/canvas/ConstructNode.tsx
function ConstructNode(...) {
  // Inline component definition — recreated every render
  const ColorPicker = ({ color, onChange }: ColorPickerProps) => (
    <Popover>
      <PopoverTrigger>
        <div style={{ backgroundColor: color }} />
      </PopoverTrigger>
      <PopoverContent>
        {tints.map(tint => (
          <button onClick={() => onChange(tint)} />
        ))}
      </PopoverContent>
    </Popover>
  );

  return (
    <div>
      <ColorPicker color={data.instanceColor} onChange={handleColorChange} />
    </div>
  );
}
```

**After:** Extracted to primitive, hoisted (Vercel pattern `rendering-hoist-jsx`)

```tsx
// components/ui/ColorPicker.tsx
interface ColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  palette: string[];
  allowNull?: boolean;
}

export const ColorPicker = memo(function ColorPicker({
  value,
  onChange,
  palette,
  allowNull = true,
}: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="color-picker-trigger"
          style={{ backgroundColor: value ?? 'transparent' }}
        />
      </PopoverTrigger>
      <PopoverContent className="color-picker-content">
        <div className="color-grid">
          {allowNull && (
            <button
              className="color-swatch reset"
              onClick={() => onChange(null)}
            />
          )}
          {palette.map(color => (
            <button
              key={color}
              className={cn('color-swatch', value === color && 'selected')}
              style={{ backgroundColor: color }}
              onClick={() => onChange(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

// Usage in ConstructNode
import { ColorPicker } from '@/components/ui/ColorPicker';

function ConstructNodeDefault({ data, schema, onUpdateNode }: Props) {
  // Compute palette from schema (memoized)
  const palette = useMemo(
    () => generateTints(schema.defaultBackgroundColor),
    [schema.defaultBackgroundColor]
  );

  return (
    <ColorPicker
      value={data.instanceColor}
      onChange={color => onUpdateNode(data.id, { instanceColor: color })}
      palette={palette}
    />
  );
}
```

**Impact:** Reusable primitive, no inline component recreation, testable in isolation.

---

### 9.7 Create NodeActionsContext — Before/After

**Before (current):** Large callback objects passed via props

```tsx
// components/canvas/Map.tsx
const nodeTypes = useMemo(() => ({
  construct: (props: NodeProps) => (
    <ConstructNode
      {...props}
      data={{
        ...props.data,
        // 10+ callbacks attached to data object
        onRename: (newName: string) => renameNode(props.id, newName),
        onValuesChange: (values) => updateNodeValues(props.id, values),
        onSetViewLevel: (level) => setNodeViewLevel(props.id, level),
        onToggleDetailsPin: () => toggleNodeDetailsPin(props.id),
        onOpenFullView: () => setFullViewNodeId(props.id),
        onDeployableChange: (id) => updateNodeDeployable(props.id, id),
        onInstanceColorChange: (color) => updateNodeInstanceColor(props.id, color),
        // ...more callbacks
      }}
    />
  ),
}), [renameNode, updateNodeValues, ...]); // Many dependencies
```

**After:** Context provides stable callbacks (Vercel composition pattern)

```tsx
// contexts/NodeActionsContext.tsx
interface NodeActions {
  renameNode: (nodeId: string, newName: string) => void;
  updateNodeValues: (nodeId: string, values: ConstructValues) => void;
  setNodeViewLevel: (nodeId: string, level: 'summary' | 'details') => void;
  toggleNodeDetailsPin: (nodeId: string) => void;
  openFullView: (nodeId: string) => void;
  updateNodeDeployable: (nodeId: string, deployableId: string | null) => void;
  updateNodeInstanceColor: (nodeId: string, color: string | null) => void;
}

const NodeActionsContext = createContext<NodeActions | null>(null);

export function NodeActionsProvider({ children }: { children: ReactNode }) {
  const { updateNode } = useNodes();

  // All callbacks are stable (empty or minimal deps)
  const renameNode = useCallback((nodeId: string, newName: string) => {
    updateNode(nodeId, { label: newName });
  }, [updateNode]);

  const updateNodeValues = useCallback((nodeId: string, values: ConstructValues) => {
    updateNode(nodeId, { values });
  }, [updateNode]);

  // ... other callbacks

  const actions = useMemo(() => ({
    renameNode,
    updateNodeValues,
    setNodeViewLevel,
    toggleNodeDetailsPin,
    openFullView,
    updateNodeDeployable,
    updateNodeInstanceColor,
  }), [renameNode, updateNodeValues, ...]); // Stable because callbacks are stable

  return (
    <NodeActionsContext.Provider value={actions}>
      {children}
    </NodeActionsContext.Provider>
  );
}

export function useNodeActions() {
  const context = useContext(NodeActionsContext);
  if (!context) throw new Error('useNodeActions must be used within NodeActionsProvider');
  return context;
}
```

**Usage in ConstructNode:**

```tsx
// components/canvas/ConstructNode/ConstructNodeDefault.tsx
function ConstructNodeDefault({ id, data, schema }: Props) {
  const { renameNode, updateNodeValues, openFullView } = useNodeActions();

  const handleRename = useCallback((newName: string) => {
    renameNode(id, newName);
  }, [id, renameNode]);

  return (
    <div>
      <EditableTitle value={data.label} onSave={handleRename} />
      <button onClick={() => openFullView(id)}>Expand</button>
    </div>
  );
}
```

**Map.tsx becomes simpler:**

```tsx
// components/canvas/Map.tsx
function Map() {
  return (
    <NodeActionsProvider>
      <ReactFlow
        nodeTypes={nodeTypes}
        // No callbacks in nodeTypes — they come from context
      />
    </NodeActionsProvider>
  );
}

const nodeTypes = {
  construct: ConstructNode, // Just the component, no wrapper
};
```

**Impact:** Eliminates prop drilling, stable callback references, cleaner component interfaces.

---

### 9.8 Derive State During Render — Before/After

**Before (current):** Visual groups require manual version bumping

```tsx
// hooks/useDocument.ts
const [visualGroupsVersion, setVisualGroupsVersion] = useState(0);

// Force re-evaluation trick
const getVisualGroups = useCallback(
  (levelId: string) => {
    void visualGroupsVersion; // Force re-evaluation
    return adapter.getVisualGroups(levelId);
  },
  [adapter, visualGroupsVersion]
);

// Mutation must bump version manually
const addVisualGroup = useCallback((group: Partial<VisualGroup>) => {
  adapter.addVisualGroup(group);
  setVisualGroupsVersion(v => v + 1); // Manual bump
}, [adapter]);
```

**After:** useSyncExternalStore eliminates version tracking (Vercel pattern `rerender-derived-state-no-effect`)

```tsx
// hooks/useVisualGroups.ts
export function useVisualGroups(levelId: string) {
  const { adapter } = useDocumentContext();

  // Subscribe to visual groups for this level
  const subscribe = useCallback(
    (callback: () => void) => adapter.subscribeToVisualGroups(levelId, callback),
    [adapter, levelId]
  );

  const getSnapshot = useCallback(
    () => adapter.getVisualGroups(levelId),
    [adapter, levelId]
  );

  // Automatic re-render when visual groups change — no manual version
  const visualGroups = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Stable mutation callbacks
  const addVisualGroup = useCallback((group: Partial<VisualGroup>) => {
    return adapter.addVisualGroup({ ...group, levelId });
  }, [adapter, levelId]);

  const updateVisualGroup = useCallback((id: string, updates: Partial<VisualGroup>) => {
    adapter.updateVisualGroup(id, updates);
  }, [adapter]);

  return { visualGroups, addVisualGroup, updateVisualGroup, removeVisualGroup };
}
```

**Impact:** No manual version tracking, automatic re-renders on actual data changes.

---

## 10. Additional Suggestions from React Best Practices

### 10.1 Use useRef for Mouse Position Tracking

**Current issue:** Map.tsx tracks mouse position in state, causing re-renders

```tsx
// Map.tsx
const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

// Every mouse move triggers re-render
const handleMouseMove = (e: React.MouseEvent) => {
  setMousePosition({ x: e.clientX, y: e.clientY });
};
```

**Fix:** Use ref for transient values (Vercel pattern `rerender-use-ref-transient-values`)

```tsx
const mousePositionRef = useRef<{ x: number; y: number } | null>(null);

const handleMouseMove = (e: React.MouseEvent) => {
  mousePositionRef.current = { x: e.clientX, y: e.clientY };
};

// Read from ref when needed (e.g., in context menu)
const handleContextMenu = () => {
  const pos = mousePositionRef.current;
  if (pos) showContextMenu(pos.x, pos.y);
};
```

### 10.2 Narrow Effect Dependencies in useMapState

**Current issue:** Effects depend on objects

```tsx
// hooks/useMapState.ts
useEffect(() => {
  if (contextMenu) {
    // Do something with contextMenu.position
  }
}, [contextMenu]); // Re-runs on any contextMenu property change
```

**Fix:** Depend on primitives (Vercel pattern `rerender-dependencies`)

```tsx
const contextMenuOpen = contextMenu !== null;
const contextMenuX = contextMenu?.position.x ?? 0;
const contextMenuY = contextMenu?.position.y ?? 0;

useEffect(() => {
  if (contextMenuOpen) {
    // Position-based logic
  }
}, [contextMenuOpen, contextMenuX, contextMenuY]); // Only runs when position actually changes
```

### 10.3 Build Index Maps for Schema Lookups

**Current issue:** `getSchema()` does array find

```tsx
// Multiple O(n) lookups during render
const schema1 = getSchema(node1.schemaId); // O(n)
const schema2 = getSchema(node2.schemaId); // O(n)
// For 100 nodes = 100 × O(n) lookups
```

**Fix:** Build index map once (Vercel pattern `js-index-maps`)

```tsx
// In useSchemas hook or memoized in component
const schemaById = useMemo(
  () => new Map(schemas.map(s => [s.id, s])),
  [schemas]
);

// O(1) lookups
const schema1 = schemaById.get(node1.schemaId);
const schema2 = schemaById.get(node2.schemaId);
```

### 10.4 Lazy State Initialization for Theme

**Current issue:** Theme reads localStorage on every render cycle init

```tsx
const [theme, setTheme] = useState(getStoredTheme()); // Function called, not passed
```

**Fix:** Pass function for lazy init (Vercel pattern `rerender-lazy-state-init`)

```tsx
const [theme, setTheme] = useState(() => getStoredTheme()); // Function passed, called once
```

### 10.5 Add content-visibility for Node Lists

**Current issue:** All nodes rendered even when off-screen

**Fix:** CSS content-visibility (Vercel pattern `rendering-content-visibility`)

```css
/* index.css */
.react-flow__node {
  content-visibility: auto;
  contain-intrinsic-size: 0 150px; /* Estimated node height */
}
```

**Impact:** Faster initial render for documents with many nodes.

---

## Appendix: Component Dependency Graph

```
App.tsx
├── Header.tsx
│   ├── ConnectionStatus.tsx
│   ├── DocumentBrowserModal.tsx
│   ├── ExamplesModal.tsx
│   ├── ProjectInfoModal.tsx
│   ├── ClearWorkspaceModal.tsx
│   └── RestoreDefaultSchemasModal.tsx
├── CanvasContainer.tsx
│   ├── Map.tsx
│   │   ├── ConstructNode.tsx
│   │   │   ├── PortDrawer.tsx
│   │   │   ├── IndexBasedDropZones.tsx
│   │   │   └── CreateDeployablePopover.tsx
│   │   ├── VirtualParentNode.tsx
│   │   ├── VisualGroupNode.tsx
│   │   ├── DynamicAnchorEdge.tsx
│   │   ├── NodeControls.tsx
│   │   ├── AddConstructMenu.tsx
│   │   ├── ContextMenu.tsx
│   │   ├── ConstructEditor.tsx
│   │   └── ConstructFullViewModal.tsx
│   ├── Metamap.tsx
│   │   ├── SchemaNode.tsx
│   │   ├── SchemaGroupNode.tsx
│   │   ├── MetamapConnectionModal.tsx
│   │   ├── EdgeDetailPopover.tsx
│   │   ├── ContextMenu.tsx
│   │   └── ConstructEditor.tsx
│   ├── ViewToggle.tsx
│   ├── LevelSwitcher.tsx
│   ├── SearchBar.tsx
│   └── Footer.tsx
├── ImportPreviewModal.tsx
├── ExportPreviewModal.tsx
├── CompileModal.tsx
└── AISidebar.tsx
    ├── AISettings.tsx
    ├── ChatMessage.tsx
    ├── ToolCallStatus.tsx
    └── MessageDetailModal.tsx
```

---

## Appendix: Hook Dependency Graph

```
DocumentContext (provides adapter)
       │
       ▼
useDocumentContext()
       │
       ▼
useDocument() ─────────────────────────────────────┐
       │                                           │
       ├── useGraphOperations() ◄──────────────────┤
       │       │                                   │
       │       ├── useReactFlow()                  │
       │       └── useUpdateNodeInternals()        │
       │                                           │
       ├── useConnections() ◄──────────────────────┤
       │       └── useReactFlow()                  │
       │                                           │
       ├── useVisualGroups() ◄─────────────────────┤
       │                                           │
       └── useClearDocument() ◄────────────────────┘

useMapState() (standalone UI state)
useClipboard() (depends on selection)
useKeyboardShortcuts() (depends on selection, operations)
useUndoRedo() (depends on adapter.ydoc)
useEdgeBundling() (pure computation)
useLodBand() (uses React Flow zoom state)
useMetamapLayout() (depends on schemas, groups)
useAwareness() (depends on adapter.ydoc)
useDirtyStateGuard() (depends on document state)
```
