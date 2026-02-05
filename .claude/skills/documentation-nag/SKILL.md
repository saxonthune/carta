---
name: documentation-nag
description: Analyzes recent code changes and updates documentation to keep it synchronized with the codebase
context: fork
model: sonnet
---

# documentation-nag (Token-Optimized)

Analyzes recent code changes and updates documentation. Uses lazy loading, section-level retrieval, and completeness verification inspired by legal RAG research (doc00.05).

## Source of Truth

**`.docs/` is the canonical source of truth.** `CLAUDE.md` references `.docs/` — do NOT duplicate content into it.

**CLAUDE.md policy:** Only update CLAUDE.md when a **new package, new top-level directory, or new major subsystem** is added. Bug fixes, feature tweaks, new hooks, new components, and refactors do NOT warrant CLAUDE.md changes. When in doubt, skip it.

---

## Phase 1: Identify Changes (Minimal Reads)

```bash
# Get changed files summary (not full diff)
git diff --stat HEAD~5
git status --short
```

Extract:
- Which packages changed (web-client, server, domain, etc.)
- Which subsystems changed (hooks, components, stores, etc.)

---

## Phase 2: Read MANIFEST and Map Tags

```typescript
// Always read MANIFEST first - it's the retrieval index
Read('.docs/MANIFEST.md')
```

Use the **Tag Index** at the bottom of MANIFEST to map changes → docs:

| Changed Path | Tags to Match | Relevant Docs |
|-------------|---------------|---------------|
| `hooks/use*.ts` | hooks, state | doc02.02, doc02.08 |
| `components/canvas/*` | canvas, ui | doc03.01.01, doc02.07 |
| `components/metamap/*` | metamap, schemas | doc03.01.05, doc02.06 |
| `components/modals/*` | collaboration, ui | doc03.01.09, doc02.07 |
| `components/ui/*` | ui, design | doc02.07 |
| `stores/*`, `adapters/*` | state, adapters | doc02.02, doc02.03 |
| `constructs/compiler/*` | compiler | doc03.01.07, doc02.03 |
| `constructs/schemas/*` | schemas | doc02.06, doc03.01.02 |
| `constructs/port*` | ports | doc03.01.03, doc02.06 |
| `config/*` | deployment, config | doc02.05, doc04.01 |
| `tests/*` | testing | doc04.02 |
| `packages/server/*` | deployment, collaboration | doc02.05, doc03.01.09 |
| `packages/desktop/*` | deployment, collaboration | doc02.05, doc03.01.09 |
| `packages/domain/*` | schemas, metamodel | doc02.06, doc01.03 |
| `packages/document/*` | state, interfaces | doc02.02, doc02.03 |

---

## Phase 3: Section-Level Retrieval

Instead of reading entire docs, use **targeted section reads**:

```typescript
// Option A: Read specific section with grep
Grep({
  pattern: '### Hooks Layer',
  path: '.docs/02-system/02-state.md',
  output_mode: 'content',
  context: 30  // Lines of context
})

// Option B: Read doc but only if you need multiple sections
Read('.docs/02-system/02-state.md')
```

**Decision heuristic:**
- Need 1 section → use Grep with context
- Need 2+ sections → Read entire doc
- Need to add new section → Read entire doc

---

## Phase 4: Check Dependencies

From MANIFEST, each doc has a **Deps** column. When editing a doc, also check its dependents:

```typescript
// Example: Editing doc02.02 (state.md)
// MANIFEST shows doc02.08 depends on doc02.02
// → Also read doc02.08 to check for cascading updates

const editing = 'doc02.02';
const dependents = ['doc02.08'];  // From MANIFEST Deps column (reverse lookup)

for (const dep of dependents) {
  // Check if dependent doc needs updates too
  Grep({ pattern: 'doc02.02', path: getDocPath(dep) })
}
```

---

## Phase 5: Generate Compact Edit Instructions

Use **diff-style patches with provenance**:

```markdown
## Edit: .docs/02-system/02-state.md
Source: hooks/useVisualGroups.ts (new file)

```diff
@@ line 45, in "### Hooks Layer" section @@
+| `useVisualGroups` | Computes group nodes from flat storage |
```
```

**CLAUDE.md:** Skip unless a new package/directory/subsystem was added.

**Provenance rules:**
- Every edit must cite source (file path or doc section)
- Use `§` to reference doc sections: `doc02.02 §Hooks Layer`

---

## Phase 6: Launch Parallel Haiku Workers

For each file, launch a haiku worker with **minimal context**:

```typescript
Task({
  subagent_type: 'general-purpose',
  model: 'haiku',
  prompt: `Apply this patch to ${file}:

Source: ${provenance}

\`\`\`diff
@@ line 45 @@
+| \`useVisualGroups\` | Computes group nodes |
\`\`\`

Instructions:
1. Read ${file}
2. Find line 45 (or the section header if line moved)
3. Insert the + lines, remove any - lines
4. Use Edit tool to apply`,
  description: `Patch ${file}`
})
```

Launch ALL workers in a single message (parallel execution).

---

## Phase 7: Completeness Verification

Before returning, verify:

### Coverage Check
Every changed code path maps to at least one doc:

```markdown
### Coverage Report
| Changed File | Mapped Tags | Docs Updated |
|-------------|-------------|--------------|
| hooks/useVisualGroups.ts | hooks, state | doc02.02 ✓ |
| components/canvas/VisualGroupNode.tsx | canvas, ui | doc03.01.01 ✓ |
| stores/adapters/yjsAdapter.ts | state, adapters | doc02.02 ✓ |

**Unmapped files:** none
```

### Dependency Check
Docs that depend on edited docs were reviewed:

```markdown
### Dependency Check
| Edited Doc | Dependents | Status |
|-----------|------------|--------|
| doc02.02 | doc02.08 | Checked, no changes needed |
```

### Cross-Reference Integrity
Existing `docXX.YY` references still resolve:

```bash
# Quick check for broken refs
grep -rn "doc[0-9][0-9]\.[0-9][0-9]" .docs/ | grep -v MANIFEST
```

---

## Phase 8: Return Summary

```markdown
## Documentation Update Summary

**Token efficiency:**
- Docs read: 3 of 35 (91% saved)
- Section-level reads: 2

### Updated (with provenance)
- .docs/02-system/02-state.md §Hooks Layer — Added useVisualGroups (source: new file)

### CLAUDE.md Status
No update needed (no new packages/directories/subsystems)

### Dependency Cascade
- doc02.08 checked — no updates needed

### Coverage
- 3/3 changed files mapped to docs ✓
- 0 unmapped files

### Skipped
- .docs/03-product/* — No matching tags
- .docs/04-operations/* — No matching tags
```

---

## Quick Reference

### Doc Path Resolution

```typescript
function getDocPath(ref: string): string {
  // doc02.02 → .docs/02-system/02-state.md
  // doc03.01.07 → .docs/03-product/01-features/07-compilation.md
  // Use MANIFEST to resolve
}
```

### Token Budget

| Operation | Tokens | When |
|-----------|--------|------|
| MANIFEST only | ~2,500 | Initial scan |
| MANIFEST + grep 2 sections | ~4,000 | Targeted update |
| MANIFEST + 2 full docs | ~6,000 | Multi-section update |
| MANIFEST + CLAUDE.md | ~12,000 | New package/subsystem only |
| Full .docs/ | ~40,000 | Epoch bump only |

**Target: Read <15% of docs for 90% of updates**
