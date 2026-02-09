# Schema Group Hydration Fix

> **Scope**: bug fix
> **Layers touched**: domain (seed-loader), document (doc-operations), web-client (init, restore, import)
> **Summary**: Fix broken schema↔group association caused by `listSchemas()` bypassing Y.Doc for built-ins and `hydrateBuiltIns()` generating fresh UUIDs on every call, producing orphan groups and mismatched groupIds.

## Motivation

Built-in schemas are currently special-cased: `listSchemas()` starts with `[...builtInConstructSchemas]` (raw seed constants with seed-local groupIds like `api`), then appends custom schemas from Y.Doc. But groups in Y.Doc have generated UUIDs (`grp_xxx`). The groupIds never match, so:

- The metamap can't associate schemas with their groups
- "Restore defaults" generates a new generation of group UUIDs each call (caused 360 duplicate groups in the Carta-describes-Carta document)
- Schemas keep their original groupIds from init, pointing to generation-1 UUIDs. All subsequent group generations are empty orphans.
- If a user customizes a built-in schema, the constant override in `listSchemas()` hides their changes on the server/MCP side.

## Design Principle

**Built-in schemas are seed data, not special-cased constants.** Once written to Y.Doc on init, they are indistinguishable from custom schemas. Y.Doc is the single source of truth. No built-in constant should override it.

## Changes

### 1. `listSchemas()` and `getSchema()` — read Y.Doc only

**File**: `packages/document/src/doc-operations.ts`

`listSchemas()` (line 908): Remove `const schemas = [...builtInConstructSchemas]`. Read all schemas from Y.Doc's `schemas` map. Built-ins were written there on init — they're just regular schemas now.

`getSchema()` (line 927): Remove the `builtInConstructSchemas.find()` check. Read from Y.Doc only.

### 2. Idempotent hydration — reuse existing group IDs by name

**File**: `packages/domain/src/schemas/seed-loader.ts`

Change `hydrateSeeds()` to accept an optional `existingGroups` parameter:

```typescript
export function hydrateSeeds(
  groups: SchemaGroup[],
  schemas: ConstructSchema[],
  existingGroups?: SchemaGroup[],  // groups already in the document
): { groups: SchemaGroup[]; schemas: ConstructSchema[] }
```

When building the ref→UUID map:
- For each seed group, check if `existingGroups` has a group with the **same name** (and same parentId name, for subgroups)
- If found: reuse the existing group's ID
- If not found: generate a new UUID

This makes hydration idempotent. Calling it 40 times with the same existing groups produces the same output every time.

### 3. `handleRestoreDefaultSchemas` — merge, don't append

**File**: `packages/web-client/src/App.tsx` (line 179)

Pass `adapter.getSchemaGroups()` as `existingGroups` to `hydrateBuiltIns()`. The hydrated groups will reuse existing IDs, so adding them is a no-op (same ID already exists in Y.Map). Schemas will have groupIds matching the existing groups.

### 4. Import — merge groups by name, schemas by type

**File**: `packages/web-client/src/utils/documentImporter.ts`

When importing schema groups from another document:
- For each incoming group, check if a group with the same name already exists
- If yes: remap the incoming group's ID to the existing group's ID
- Apply the same remapping to all imported schemas' groupIds
- Skip schemas whose type already exists (or prompt for overwrite — but that's a separate UX feature)

### 5. Init — no change needed

**File**: `packages/web-client/src/contexts/DocumentContext.tsx` (line 91)

First init (`!isInitialized`) already writes hydrated schemas and groups to Y.Doc. This is correct. The fix ensures that subsequent operations (restore, import) don't break the initial state.

## Data Migration

Existing documents have corrupted data (duplicate groups, mismatched groupIds). On load, a one-time migration should:

1. Deduplicate groups by name (keep first occurrence, remap all references)
2. Resolve schema groupIds: for each schema with a seed-local groupId (`api`, `database`, etc.), find the matching group by name and update the groupId to the group's UUID
3. Remove orphan groups (not referenced by any schema or as a parent)

This can be a migration step in the document loading path, versioned by a flag in the Y.Doc meta map.

## Explicitly Out of Scope

- Schema conflict resolution UI (import brings `rest-endpoint` with different fields than existing — prompt user). Useful but separate.
- Schema versioning or schema evolution tracking.
- Renaming group IDs from UUIDs to stable names. UUIDs are fine — the fix is making them stable within a document, not eliminating them.
