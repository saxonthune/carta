# MCP mutation tools should accept an explicit pageId

## Motivation

MCP mutation tools operate on the "active page" — shared Yjs state. When an AI agent calls `set_active_page`, it changes the user's browser view. If the user navigates during agent work, mutations land on the wrong page. Adding an optional `pageId` parameter to all page-scoped mutation tools eliminates this race condition.

## Design constraint

`pageId` is an **optional** parameter on every page-scoped MCP tool. When provided, the operation targets that page directly without changing the active page. When omitted, existing behavior is preserved (use active page). The document adapter layer (`doc-operations.ts`) already requires explicit `pageId` on every method — no changes needed there.

## Do NOT

- Do NOT modify `packages/document/src/doc-operations.ts` — it already takes explicit `pageId`
- Do NOT modify any web client code
- Do NOT change how `set_active_page` works
- Do NOT make `pageId` required on any tool — it must remain optional for backwards compatibility
- Do NOT change any domain, compiler, or types packages
- Do NOT add `pageId` to tools that aren't page-scoped (e.g., `list_pages`, `create_page`, `get_construct`, `update_construct`, `delete_construct`, `update_organizer`, `delete_organizer`, `list_schemas`, `get_schema`, `create_schema`, `compile` — these either operate cross-page or target a specific entity by ID)
- Do NOT add `pageName` support — only `pageId`. The `pageName` convenience is for `set_active_page` and `get_document_summary` only.

## Files to Modify

### 1. `packages/server/src/mcp/tools.ts`

**Zod schemas** — add `pageId: z.string().optional().describe('Target page ID (uses active page if omitted)')` to:

| Schema | Line | Notes |
|--------|------|-------|
| `CreateConstructSchema` | 72 | |
| `CreateOrganizerSchema` | 113 | |
| `ConnectConstructsSchema` | 98 | |
| `DisconnectConstructsSchema` | 106 | |
| `CreateConstructsBulkSchema` | ~142 | Find exact name — bulk create |
| `ConnectConstructsBulkSchema` | ~153 | Find exact name — bulk connect |
| `MoveConstructSchema` | 163 | |
| `DeleteConstructsSchema` | 171 | |
| `BatchMutateSchema` | 176 | |
| `FlowLayoutSchema` | 220 | |
| `ArrangeLayoutSchema` | 286 | |

`ListConstructsSchema` (line 66) **already has `pageId`** — skip it.

**Tool handlers** — destructure `pageId` from the parsed args and include it in the HTTP request body. Pattern to follow for each POST handler:

```typescript
// BEFORE (e.g., carta_create_construct):
carta_create_construct: async (args) => {
  const { documentId, constructType, values, x, y, parentId } = CreateConstructSchema.parse(args);
  const result = await apiRequest<{ construct: unknown }>(
    'POST',
    `/api/documents/${encodeURIComponent(documentId)}/constructs`,
    { constructType, values, x, y, parentId }
  );

// AFTER:
carta_create_construct: async (args) => {
  const { documentId, constructType, values, x, y, parentId, pageId } = CreateConstructSchema.parse(args);
  const result = await apiRequest<{ construct: unknown }>(
    'POST',
    `/api/documents/${encodeURIComponent(documentId)}/constructs`,
    { constructType, values, x, y, parentId, pageId }
  );
```

Apply to all 11 tool handlers listed above. For the DELETE handler (`carta_delete_constructs`), include `pageId` in the body alongside `semanticIds`.

**Tool descriptions** — update the description strings for each tool to mention the `pageId` parameter. Add a brief note like "Optionally accepts pageId to target a specific page." to each relevant tool's description. Look for the tool registration objects (around lines 388-500) that define `name` and `description`.

### 2. `packages/server/src/document-server-core.ts`

**HTTP route handlers** — update each handler that calls `getActivePageId()` to accept `pageId` from the request body (for POST/PATCH/DELETE) or query params (for GET). The pattern:

```typescript
// BEFORE:
const pageId = getActivePageId(docState.doc);

// AFTER (for POST/PATCH/DELETE — read from body):
const pageId = body.pageId || getActivePageId(docState.doc);

// AFTER (for GET — already done at line 526):
const pageId = url.searchParams.get('pageId') || getActivePageId(docState.doc);
```

**Important**: Some handlers parse the body AFTER the `pageId` line. You'll need to restructure slightly — parse body first, then resolve `pageId`. Check each handler's flow carefully.

Locations to update (all in `document-server-core.ts`):

| Endpoint | Method | Current line | Notes |
|----------|--------|-------------|-------|
| `/constructs` | GET/POST | 526 | GET already works. For POST, body is parsed at ~559. Move `pageId` resolution after body parse, use `body.pageId \|\| ...` |
| `/constructs/bulk` | DELETE | 600 | `body.pageId \|\| getActivePageId(...)` |
| `/constructs/bulk` | POST | 616 | `body.pageId \|\| getActivePageId(...)` |
| `/constructs/:id/move` | POST | 658 | `body.pageId \|\| getActivePageId(...)` |
| `/organizers` | GET/POST | 728 | For POST, `body.pageId \|\| getActivePageId(...)`. For GET, add query param support like constructs GET. |
| `/organizers/:id` | PATCH/DELETE | 791 | `body.pageId \|\| getActivePageId(...)` |
| `/connections` | POST | ~852 | Find exact line. `body.pageId \|\| getActivePageId(...)` |
| `/connections` | DELETE | ~880 | `body.pageId \|\| getActivePageId(...)` |
| `/connections/bulk` | POST | 895 | `body.pageId \|\| getActivePageId(...)` |
| `/batch` | POST | 1137 | `body.pageId \|\| getActivePageId(...)` |
| `/layout/flow` | POST | 1173 | `body.pageId \|\| getActivePageId(...)` |
| `/layout/arrange` | POST | 1209 | `body.pageId \|\| getActivePageId(...)` |

For handlers where `pageId` is resolved before `body` is parsed, restructure to parse body first. Example:

```typescript
// BEFORE (constructs POST, simplified):
const pageId = url.searchParams.get('pageId') || getActivePageId(docState.doc);
if (method === 'POST') {
  const body = await parseJsonBody<{...}>(req);
  // ... uses pageId

// AFTER:
if (method === 'GET') {
  const pageId = url.searchParams.get('pageId') || getActivePageId(docState.doc);
  // ... GET logic
} else if (method === 'POST') {
  const body = await parseJsonBody<{...}>(req);
  const pageId = body.pageId || url.searchParams.get('pageId') || getActivePageId(docState.doc);
  // ... POST logic
```

Read the actual code structure carefully before editing — the handler branching varies per endpoint.

## Implementation Steps

1. **Add `pageId` to all 11 Zod schemas** in `tools.ts`. Use the exact description string: `'Target page ID (uses active page if omitted)'`.

2. **Update all 11 tool handlers** in `tools.ts` to destructure `pageId` and include it in the HTTP request body/params.

3. **Update tool description strings** in `tools.ts` for each affected tool to mention the optional `pageId` parameter.

4. **Update all 12 HTTP route handler locations** in `document-server-core.ts` to accept `pageId` from the request body (or query params for GET), falling back to `getActivePageId()`.

5. **Run `pnpm build`** to verify TypeScript compilation.

6. **Run `pnpm test`** to verify existing tests pass (no behavior change when `pageId` is omitted).

## Constraints

- `erasableSyntaxOnly` — no constructor parameter shorthand
- Barrel exports use `.js` extensions
- The `getActivePageId()` helper must remain — it's the fallback when `pageId` is omitted

## Verification

- `pnpm build` passes
- `pnpm test` passes (existing tests don't provide `pageId`, so they exercise the fallback path)
- Manual check: grep for `getActivePageId` in `document-server-core.ts` — every call site should now have a `body.pageId ||` or `url.searchParams.get('pageId') ||` prefix

## Plan-specific checks

```bash
# Every getActivePageId call should be preceded by a body.pageId or query param fallback
# (except the helper function definition itself and setActivePage logic)
grep -n 'getActivePageId' packages/server/src/document-server-core.ts
# Verify: each route handler usage has the pattern: body.pageId || ... || getActivePageId(...)

# All 11 mutation tool schemas should have pageId
grep -c 'pageId' packages/server/src/mcp/tools.ts
# Should be significantly higher than current count (currently ~12, should be ~34+)
```
