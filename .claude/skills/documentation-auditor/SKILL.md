---
name: documentation-auditor
description: Audits .carta/ claims against actual codebase, finding stale references, missing exports, wrong type signatures, and phantom files
context: fork
model: sonnet
---

# documentation-auditor

Reverse-audits documentation against the codebase. While `/documentation-nag` is forward-sync (commits → docs), this skill is reverse-audit (docs → code). It finds claims in `.carta/` that no longer match reality.

## When This Triggers

- "Audit the docs"
- "Check docs against code"
- "Find stale doc references"
- `/documentation-auditor`
- `/documentation-auditor doc01.03.05`

## What It Does NOT Do

- Edit documentation (output is a discrepancy report)
- Replace `/documentation-nag` (they're complementary)
- Read the full codebase (uses targeted verification queries)

---

## Phase 0: Scope Selection

```bash
# Default: audit all docs
# With argument: audit specific doc(s)
```

**If specific doc named:** Match against MANIFEST refs and resolve file path from MANIFEST's File column. Audit only that file.

**If no argument:** Read MANIFEST, then audit all active docs. Process them in priority order:
1. Architecture docs — highest density of verifiable claims (barrel exports, type definitions)
2. Feature docs — reference specific components and behaviors
3. Context/goals docs — glossary terms, principles
4. Research docs — lowest priority, mostly speculative

Report scope to user: "Auditing N docs against codebase."

---

## Phase 1: Extract Verifiable Claims

Read each doc and extract **structured claims only** — skip freeform prose. Claims come from:

### Claim Types

| Type | Pattern | Example | Verification |
|------|---------|---------|-------------|
| **File path** | Backtick-quoted path or path in table | `` `hooks/useEdgeCleanup.ts` `` | `Glob` for existence |
| **Barrel export** | Listed name in barrel section | `useSchemas` in hooks/index.ts list | `Grep` the actual index.ts |
| **Type/field** | `Type.field` or field in type table | `ConstructSchema.nodeShape` | `Grep` the type definition |
| **Enum values** | Union type or value list | `'default' \| 'simple' \| 'circle'` | `Grep` the type definition, compare values |
| **Component name** | PascalCase in backticks | `` `ConstructNodeMarker` `` | `Glob('**/{name}.tsx')` |
| **Hook name** | `use*` in backticks | `` `useGraphOperations` `` | `Grep` in hooks directory |
| **MCP tool name** | `carta_*` in table or list | `carta_update_schema` | `Grep` in tools.ts |
| **Env var** | `VITE_*` or `PORT` | `VITE_SYNC_URL` | `Grep` in source |
| **CLI command** | `make *` | `make test` | `Grep` in Makefile |

### Extraction Strategy

For each doc file, use targeted extraction:

```typescript
// Extract backtick-quoted identifiers
Grep({ pattern: '`[A-Za-z_/.]+`', path: docFile, output_mode: 'content' })

// Extract table rows (most verifiable claims live in tables)
Grep({ pattern: '\\|.*`.*`.*\\|', path: docFile, output_mode: 'content' })
```

**Token conservation:** Do NOT read full doc files during extraction. Use Grep to pull only lines containing backtick-quoted identifiers and table rows. Read the full file only when context is needed to disambiguate a claim.

### Claim Classification

Classify each extracted claim by confidence:

- **High confidence**: File paths, barrel exports, type fields — these are binary (exists or doesn't)
- **Medium confidence**: Component names, hook names — may have moved or been renamed
- **Low confidence**: Behavioral descriptions, architectural rules — hard to verify mechanically

**Only verify high and medium confidence claims.** Low confidence claims require human judgment.

---

## Phase 2: Batch Verification

Group claims by verification method to minimize tool calls:

### File Existence (Glob)

Batch all file path claims into parallel Glob calls:

```typescript
// Up to 10 parallel Glob calls
Glob({ pattern: '**/useEdgeCleanup.ts' })
Glob({ pattern: '**/ConstructNodeMarker.tsx' })
Glob({ pattern: '**/lodPolicy.ts' })
// etc.
```

### Barrel Export Lists (Grep)

For docs that list barrel exports (find via MANIFEST tags: `components, hooks, architecture`), verify each list against the actual barrel file:

```typescript
// Read the actual barrel file
Read('carta_cli/...')  # read the relevant source file

// Compare exported names against doc's listed names
// Flag: in doc but not in code (stale), in code but not in doc (undocumented)
```

This is the highest-value check. Barrel lists drift constantly.

### Type/Field Verification (Grep)

For type claims, grep the type definition:

```typescript
Grep({
  pattern: 'nodeShape',
  path: 'carta_cli/...',  # grep the relevant source file
  output_mode: 'content',
  context: 2
})
```

### MCP Tool Inventory (Grep)

Compare documented tools against registered tools:

```typescript
// Extract tool names from code
Grep({
  pattern: "name: 'carta_",
  path: 'carta_cli/mcp/...',  # grep the MCP tools file
  output_mode: 'content'
})

// Compare against any doc that inventories MCP tools (find via MANIFEST tags: mcp)
```

### Env Var Verification (Grep)

For each documented env var, verify it's actually read:

```typescript
Grep({ pattern: 'VITE_SYNC_URL', output_mode: 'files_with_matches' })
```

---

## Phase 3: Discrepancy Report

Present findings as a structured report. Group by severity:

### Severity Levels

| Severity | Description | Example |
|----------|-------------|---------|
| **Error** | Claim is verifiably wrong | Doc lists `useVisualGroups` but export doesn't exist |
| **Warning** | Claim is likely stale | Doc references `renderStyle` but code uses `nodeShape` |
| **Info** | Undocumented addition | Code exports `useEdgeCleanup` but doc doesn't list it |

### Report Format

```markdown
## Documentation Audit Report

**Scope**: {N} docs audited
**Claims verified**: {M} high/medium confidence claims
**Discrepancies found**: {X}

### Errors (verifiably wrong)

| Doc | Claim | Issue |
|-----|-------|-------|
| docXX.YY §barrel-section | `useFoo` exported | Export not found in barrel file |
| docXX.YY §MCP Tools | `carta_foo` tool | Tool not registered in `tools.ts` |

### Warnings (likely stale)

| Doc | Claim | Issue |
|-----|-------|-------|
| docXX.YY §section | References `oldName` | Code uses `newName` |

### Info (undocumented)

| Doc | Missing | Source |
|-----|---------|--------|
| docXX.YY §barrel-section | `useBar` not listed | Barrel file exports it |

### Verified OK

| Doc | Claims Checked | Status |
|-----|---------------|--------|
| docXX.YY | N type/field claims | All verified |
```

---

## Phase 4: Suggest Fixes

For each Error and Warning, suggest the fix (but don't apply it):

```markdown
### Suggested Fixes

1. **docXX.YY §barrel-section**: Remove `useFoo`, add `useBar`
2. **docXX.YY §section**: Replace `oldName` → `newName` (N occurrences)
3. **docXX.YY §MCP Tools**: Add `carta_new_tool` tool entry
```

If the user wants fixes applied, recommend running `/documentation-nag` or applying manually.

---

## Token Budget

| Operation | Tokens | When |
|-----------|--------|------|
| MANIFEST read | ~2,500 | Always |
| Claim extraction (Grep per doc) | ~500/doc | Per doc audited |
| Barrel file reads | ~300/file | Per barrel in frontend arch doc |
| Type verification (Grep) | ~200/check | Per type claim |
| Full doc read (disambiguation) | ~1,500/doc | Only when needed |

**Target:** Audit all system docs (~10 files) in under 15,000 tokens of input. Full audit (~35 files) in under 30,000 tokens.

### Parallelization Strategy

- Phase 1 (extraction): Parallel Grep calls across all doc files
- Phase 2 (verification): Group by method, parallel Glob/Grep batches
- Phase 3-4 (report): Sequential, low cost

---

## Priority Audit Targets

Read MANIFEST.md and prioritize docs with the highest density of verifiable, drift-prone claims. Look for docs whose tags include: `components`, `hooks`, `architecture`, `metamodel`, `schemas`, `mcp`, `design`, `glossary`. These docs typically contain barrel export lists, type definitions, tool inventories, and CSS token values — all of which are binary-verifiable and drift constantly.

When running without arguments, audit these high-value docs first before expanding to the full set.
