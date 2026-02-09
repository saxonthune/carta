# Schema Seeding Redesign

## Motivation

The current seeding model seeds all built-ins once on document initialization (gated by `meta.initialized` flag). This is too aggressive — it seeds everything even when importing a `.carta` file with its own schemas. The new model gives users explicit control: auto-seed only on empty documents, selective schema group addition via a menu, and example page loading.

## Design Constraint

**Schemas are always additive, never deduplicated.** Each `hydrateSeeds()` call generates fresh UUIDs. Adding "Sketching" twice creates two independent copies. Do NOT check names or human identifiers for duplication.

## Do NOT

- Do NOT add duplicate-detection or name-matching logic when adding schema groups. Every addition creates fresh IDs.
- Do NOT pass `existingGroups` to `hydrateSeeds()` — that parameter enables name-based ID reuse, which we explicitly don't want.
- Do NOT modify the seed functions (`starter.ts`, `saas.ts`, `kitchen-sink.ts`, `perf-150.ts`). They stay unchanged. The caller handles page creation and navigation.
- Do NOT create new modal components. Use dropdown menus inside `SettingsMenu` (sub-menus or expandable sections).
- Do NOT remove the existing "Clear" button from SettingsMenu. It stays.
- Do NOT touch the `SeedsMenu` component (debug-only, separate concern).
- Do NOT add backwards-compatibility shims for `meta.initialized`. Just replace the check.
- Do NOT add the `perf-150` seed to the "Load Example" menu — it's a dev tool, not user-facing content.

## Files to Modify

| File | Changes |
|------|---------|
| `packages/web-client/src/contexts/DocumentContext.tsx` | Replace `meta.initialized` check with zero-schema check |
| `packages/domain/src/schemas/built-ins.ts` | Export individual seeds and a `hydrateSeed()` function for single-group hydration |
| `packages/domain/src/schemas/seed-loader.ts` | No changes needed — `loadSeeds`/`hydrateSeeds` already work with single-seed arrays |
| `packages/domain/src/index.ts` | Export new symbols from built-ins |
| `packages/web-client/src/components/Header/SettingsMenu.tsx` | Add "Add Built-in Schemas" and "Load Example Page" sub-menus |
| `packages/web-client/src/components/Header/Header.tsx` | Pass adapter/hooks down to SettingsMenu for schema and page operations |

## Implementation Steps

### Step 1: Export individual seeds from domain package

**File: `packages/domain/src/schemas/built-ins.ts`**

Currently, seeds are aggregated into a single `loadSeeds([...all...])` call at module scope. Add exports so the UI can access individual seeds:

```ts
// Add named exports for each seed (already imported at top of file):
export { softwareArchitectureSeed } from './seeds/software-architecture.js';
export { sketchingSeed } from './seeds/sketching.js';
export { bpmnSeed } from './seeds/bpmn.js';
export { awsSeed } from './seeds/aws.js';
export { capabilityModelSeed } from './seeds/capability-model.js';

// Also export the SchemaSeed type from seed-loader
export type { SchemaSeed } from './seed-loader.js';
```

Add a convenience array with display metadata for the UI:

```ts
export const builtInSeedCatalog: Array<{ name: string; seed: SchemaSeed; description: string }> = [
  { name: 'Software Design', seed: softwareArchitectureSeed, description: 'REST APIs, databases, UI screens, user stories' },
  { name: 'Sketching', seed: sketchingSeed, description: 'Freeform notes and boxes' },
  { name: 'BPMN', seed: bpmnSeed, description: 'Business process modeling' },
  { name: 'AWS', seed: awsSeed, description: 'AWS cloud services' },
  { name: 'Capability Model', seed: capabilityModelSeed, description: 'Domain capabilities and features' },
];
```

Add a function to hydrate a single seed:

```ts
export function hydrateSeed(seed: SchemaSeed): { groups: SchemaGroup[]; schemas: ConstructSchema[] } {
  const { groups, schemas } = loadSeeds([seed]);
  return hydrateSeeds(groups, schemas);
}
```

**File: `packages/domain/src/index.ts`** — Export the new symbols: `builtInSeedCatalog`, `hydrateSeed`, `SchemaSeed`.

### Step 2: Replace `meta.initialized` with zero-schema check

**File: `packages/web-client/src/contexts/DocumentContext.tsx` lines 88–107**

Replace:
```ts
const isInitialized = yjsAdapter.ydoc.getMap('meta').get('initialized') as boolean | undefined;
if (!isInitialized) {
  const { groups, schemas } = hydrateBuiltIns();
  yjsAdapter.transaction(() => {
    yjsAdapter.setSchemaGroups(groups);
    yjsAdapter.setSchemas(schemas);
    yjsAdapter.setPortSchemas(builtInPortSchemas);
    yjsAdapter.ydoc.getMap('meta').set('initialized', true);
  }, 'init');
  // Seed content ...
}
```

With:
```ts
const hasSchemas = yjsAdapter.getSchemas().length > 0;
if (!hasSchemas) {
  const { groups, schemas } = hydrateBuiltIns();
  yjsAdapter.transaction(() => {
    yjsAdapter.setSchemaGroups(groups);
    yjsAdapter.setSchemas(schemas);
    yjsAdapter.setPortSchemas(builtInPortSchemas);
  }, 'init');
  // Seed content ...
}
```

Remove the `meta.initialized` set. Keep the `skipStarterContent` / `seedName` logic for the initial content seed — that stays the same.

### Step 3: Add sub-menus to SettingsMenu

**File: `packages/web-client/src/components/Header/SettingsMenu.tsx`**

This is the main UI work. The SettingsMenu currently has just "Copy MCP Config" (desktop) and "Clear". Add two new items with expandable sub-menus.

**Props changes**: SettingsMenu needs callbacks for the new actions:
```ts
export interface SettingsMenuProps {
  onOpenClearModal: () => void;
  onAddBuiltInSchemas: (seeds: SchemaSeed[]) => void;
  onLoadExample: (seedName: string) => void;
}
```

**Menu structure** (inside the dropdown `div`):

```
[Copy MCP Config]          ← desktop only, unchanged
[Add Built-in Schemas ▸]   ← NEW: expands to show checkboxes for each seed group
[Load Example Page ▸]      ← NEW: expands to show example seeds
[Clear]                    ← unchanged
```

**"Add Built-in Schemas" sub-menu**:
- Import `builtInSeedCatalog` from `@carta/domain`
- Show each catalog entry as a checkbox item (name + description)
- "Add Selected" button at the bottom
- On click: calls `onAddBuiltInSchemas(selectedSeeds)`
- Close the menu after action

**"Load Example Page" sub-menu**:
- Show 3 options: Starter, SaaS Architecture, Kitchen Sink
- Each is a button that calls `onLoadExample('starter')` etc.
- Close the menu after action

**Sub-menu pattern**: Use a simple state toggle (`showSchemasPicker` / `showExamplePicker`) that swaps the dropdown content. When a sub-menu is active, show a "← Back" button at the top to return to the main menu. This avoids nested positioning complexity. Follow the existing pattern from `ThemeMenu.tsx` if it has expandable sections, otherwise keep it simple with conditional rendering.

### Step 4: Wire up callbacks in Header

**File: `packages/web-client/src/components/Header/Header.tsx`**

Add handler functions and pass them to SettingsMenu:

```ts
// In Header component body:
const { adapter } = useDocumentContext();

const handleAddBuiltInSchemas = (selectedSeeds: SchemaSeed[]) => {
  adapter.transaction(() => {
    // Ensure port schemas exist
    const existingPortIds = new Set(adapter.getPortSchemas().map(p => p.id));
    for (const ps of builtInPortSchemas) {
      if (!existingPortIds.has(ps.id)) {
        adapter.addPortSchema(ps);
      }
    }
    // Hydrate and add each selected seed group
    for (const seed of selectedSeeds) {
      const { groups, schemas } = hydrateSeed(seed);
      for (const g of groups) adapter.addSchemaGroup(g);
      for (const s of schemas) adapter.addSchema(s);
    }
  }, 'user');
};

const handleLoadExample = (seedName: string) => {
  const seedFn = seeds[seedName];
  if (!seedFn) return;
  // Create new page and switch to it
  const page = adapter.createPage(seedName);
  adapter.setActivePage(page.id);
  // Run seed function — it writes nodes/edges to the active page
  seedFn(adapter);
};
```

Import `hydrateSeed`, `builtInPortSchemas`, `builtInSeedCatalog`, `SchemaSeed` from `@carta/domain`. Import `seeds` from `../../utils/seeds`.

Pass to SettingsMenu:
```tsx
<SettingsMenu
  onOpenClearModal={() => setIsClearWorkspaceModalOpen(true)}
  onAddBuiltInSchemas={handleAddBuiltInSchemas}
  onLoadExample={handleLoadExample}
/>
```

### Step 5: Handle port schema bootstrapping for examples

The example seeds (starter, saas, kitchen-sink) assume built-in schemas and port schemas already exist. When loading an example page on a document that was imported with custom schemas, the built-in port schemas might be missing.

In `handleLoadExample`, before running the seed, ensure port schemas and any schemas the seed needs are present. The simplest approach: also run `handleAddBuiltInSchemas` for the relevant seed group if the seed uses built-in construct types.

Actually, the seed functions (`starter`, `saas`, `kitchen-sink`) reference construct types by string (e.g., `'note'`, `'rest-endpoint'`). If those schema types don't exist in the document, the nodes will be created but the schema won't match. This is acceptable behavior — the nodes will render as unknown types. But we should ensure port schemas exist so connections work.

Add port schema bootstrapping at the start of `handleLoadExample`:
```ts
const existingPortIds = new Set(adapter.getPortSchemas().map(p => p.id));
for (const ps of builtInPortSchemas) {
  if (!existingPortIds.has(ps.id)) {
    adapter.addPortSchema(ps);
  }
}
```

Port schemas have fixed IDs (not UUID-generated), so checking by ID for idempotency is correct here — this is infrastructure, not user-facing schema groups.

## Constraints

- `erasableSyntaxOnly`: No `private`/`protected`/`public` constructor parameter shorthand
- Barrel exports use `.js` extensions in domain package
- All state mutations go through DocumentAdapter methods
- Follow existing component patterns in Header/ directory (useRef, useClickOutside, conditional rendering)

## Verification

1. `pnpm build` — TypeScript compilation succeeds across all packages
2. `pnpm test` — All existing integration tests pass
3. **Manual checks**:
   - New empty document auto-seeds all built-in schemas (zero-schema path)
   - Importing a `.carta` file with custom schemas does NOT auto-seed built-ins
   - "Add Built-in Schemas" adds fresh schema groups (verify unique IDs in adapter)
   - Adding the same group twice creates two independent copies (no dedup)
   - "Load Example Page" creates a new page, populates it, and switches to it
   - Port schemas are ensured before example content is loaded

## Plan-Specific Checks

```bash
# meta.initialized should no longer be set during init
! grep -q "meta.*set.*initialized" packages/web-client/src/contexts/DocumentContext.tsx

# No existingGroups param passed to hydrateSeeds in the new hydrateSeed function
grep -q "hydrateSeeds(groups, schemas)" packages/domain/src/schemas/built-ins.ts

# SettingsMenu has the new menu items
grep -q "Add Built-in Schemas\|Load Example" packages/web-client/src/components/Header/SettingsMenu.tsx
```
