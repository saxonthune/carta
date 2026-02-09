# Rename Levels to Pages

> **Scope**: refactor
> **Layers touched**: types, domain, document, web-client, server, compiler, docs
> **Summary**: Rename the "Level" concept to "Page" across the entire codebase — types, MCP tools, UI strings, state operations, file format, and documentation.

## Motivation

"Level" implies hierarchy or depth (like levels in a building or game). "Page" better communicates what the feature actually is: independent named views of a document that users switch between, like pages in a notebook. The rename aligns the terminology with user mental models.

## Scope

~60 files, ~190+ occurrences across all packages. This is a complete feature rename touching data, logic, UI, and docs. Backwards compatibility is NOT a concern (per project philosophy).

## Changes by Category

### 1. Types (`@carta/types`, `@carta/domain`)

- `interface Level` → `interface Page`
- `LevelId` → `PageId` (if type alias exists)
- ID prefix: `level-{timestamp}-{random}` → `page-{timestamp}-{random}` (in `id-generators.ts`)

### 2. Document Operations (`@carta/document`)

- Yjs array path: `doc.getArray('levels')` → `doc.getArray('pages')`
- All functions: `createLevel`, `deleteLevel`, `getActiveLevelId`, `setActiveLevelId`, etc. → `createPage`, `deletePage`, `getActivePageId`, `setActivePageId`
- `interface LevelInfo` → `interface PageInfo`
- File format: `levels` array key → `pages`
- **Migration**: Add a versioned migration that renames the Yjs array and updates ID prefixes in existing documents

### 3. MCP Tools (`@carta/server`)

Tool renames (5 tools):
- `carta_list_levels` → `carta_list_pages`
- `carta_create_level` → `carta_create_page`
- `carta_rename_level` → `carta_rename_page`
- `carta_delete_level` → `carta_delete_page`
- `carta_set_active_level` → `carta_set_active_page`

Parameter renames: `levelId` → `pageId`, `levelName` → `pageName`

Response field renames: `activeLevel` → `activePage`

All tool descriptions updated ("level" → "page").

### 4. Web Client Hooks & Adapter

- `useLevels.ts` → `usePages.ts` (hook + all return values)
- `yjsAdapter.ts`: 12+ method renames (`getLevels` → `getPages`, `setActiveLevel` → `setActivePage`, etc.)
- `useClearDocument.ts`: default "Main" level → default "Main" page

### 5. Web Client Components

- `LevelSwitcher.tsx` → `PageSwitcher.tsx` (component + props)
- `ContextMenu.tsx`: "Copy to Level" → "Copy to Page", "+ New Level" → "+ New Page"
- `ImportPreviewModal.tsx`: "+ New Level" → "+ New Page"
- `CanvasContainer.tsx`: prop names and imports
- `App.tsx`: imports and usage

### 6. UI Strings

- "Rename level" → "Rename page"
- "Duplicate level" → "Duplicate page"
- "Delete level" → "Delete page"
- "Edit levels" → "Edit pages"
- "+ New Level" → "+ New Page"
- "Copy to Level" → "Copy to Page"
- Delete confirmation dialog text

### 7. Tests

- `levels.test.tsx` → `pages.test.tsx`
- ~50+ test assertions referencing level terminology
- Any E2E tests that interact with the level switcher UI

### 8. Documentation (~29 files)

- `04-levels.md` → `04-pages.md` (full rewrite of feature doc)
- Glossary entry: "Level" → "Page"
- MANIFEST.md references
- Architecture docs (state, interfaces, frontend, presentation model)
- Workflow docs (iterative modeling, import, rough-to-refined)
- Use case docs

### 9. Seeds & Constants

- Default level name "Main" stays "Main" (it's the page name, not the concept name)
- Seed files: update level ID prefixes and variable names
- Starter document, kitchen-sink, SaaS seeds

## Migration

Existing documents have `levels` arrays in Yjs and exported `.carta` files.

- **Yjs migration**: On document load, check for `doc.getArray('levels')`. If present and `doc.getArray('pages')` is empty, copy data from `levels` to `pages` and delete the old array. Gate with a version flag in meta.
- **File format migration**: In `file-operations.ts` import path, accept both `levels` and `pages` keys. Write only `pages`.
- **ID prefixes**: Existing `level-xxx` IDs continue to work (they're opaque strings). New pages get `page-xxx` IDs. No need to rewrite existing IDs.

## Explicitly Out of Scope

- Changing the conceptual model (pages are still independent views, same behavior as levels)
- Adding new page features (page ordering, page templates, etc.)
- Renaming "level of detail" / LOD references (those are a different concept)
