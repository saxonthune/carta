---
name: documentation-nag
description: Analyzes recent code changes and updates documentation to keep it synchronized with the codebase
context: fork
model: sonnet
---

# documentation-nag

Reads docs, reads code, finds where they disagree, fixes the docs. No git-history tricks — the detection is content-based.

## Source of Truth

**`.carta/` is the canonical source of truth.** `CLAUDE.md` references `.carta/` — do NOT duplicate content into it.

**CLAUDE.md policy:** Only update CLAUDE.md when a **new package, new top-level directory, or new major subsystem** is added. Bug fixes, feature tweaks, new hooks, new components, and refactors do NOT warrant CLAUDE.md changes.

---

## Phase 1: Identify What Areas Changed (1 Bash Call)

```bash
bash .claude/skills/documentation-nag/analyze.sh
```

This outputs changed files by package, new files, new exports/hooks/components. Use it to scope which docs to check — not to detect whether docs are stale.

**The script tells you WHERE to look. Content comparison tells you WHETHER docs are stale.**

---

## Phase 2: Map Changes to Docs via MANIFEST

```typescript
Read('.carta/MANIFEST.md')
```

Use the **Tag Index** to map changed areas to doc files:

| Code Change Area | Tags | Relevant Docs |
|-----------------|------|---------------|
| `hooks/use*.ts` | hooks, state | doc02.02, doc02.08 |
| `components/canvas/*` | canvas, ui | doc03.01.01.01, doc02.07 |
| `components/metamap/*` | metamap, schemas | doc03.01.01.05, doc02.06 |
| Edge routing, waypoints | pipeline, edges, waypoints | doc02.10 |
| Organizers, layout | organizers, layout, presentation | doc02.09 |
| Schemas, fields, ports | schemas, metamodel, ports | doc02.06, doc03.01.01.03, doc03.01.01.06 |
| `packages/domain/*` | schemas, metamodel | doc02.06, doc01.03 |
| `packages/document/*` | state, interfaces | doc02.02, doc02.03 |
| `packages/server/*` | deployment, collaboration | doc02.05 |
| `packages/compiler/*` | compiler | doc03.01.02.01 |

Build a **doc checklist**: the docs to read and verify.

---

## Phase 3: Read the Docs AND the Code

This is the core. Read each doc on the checklist. Then read the corresponding code. Compare them.

### 3A: Read Docs

For each doc on the checklist, read it fully. Don't use section-level grep here — you need to understand the doc's claims holistically to spot gaps.

```typescript
// Read all relevant docs in parallel
Read('.carta/02-system/09-presentation-model.md')
Read('.carta/02-system/10-canvas-data-pipelines.md')
Read('.carta/02-system/08-frontend-architecture.md')
Read('.carta/02-system/06-metamodel.md')
// etc.
```

### 3B: Read Code to Verify Claims

For each doc's claims, spot-check the code. Focus on:

- **Tables of hooks/components/files** — are there new ones missing? Are listed ones deleted?
- **Behavioral descriptions** — does the code still work that way?
- **Architecture claims** — do the layers/patterns still match?

```typescript
// Example: doc02.09 describes organizer features. Check what the code supports:
Grep({ pattern: 'pin|constraint|PinConstraint', path: 'packages/web-client/src/', output_mode: 'files_with_matches' })

// Example: doc02.10 describes edge pipeline. Check current implementation:
Grep({ pattern: 'waypoint|routeEdges|patchEdgeData', path: 'packages/web-client/src/', output_mode: 'files_with_matches' })
```

### 3B-extra: Barrel Export Reconciliation (always runs)

**doc02.08 lists every export from 7 barrel files.** These lists drift silently — deletions, renames, and additions don't always trigger a git-scoped check. **Always** reconcile the barrel tables against actual barrel files, regardless of what Phase 1 found.

Read all barrel files in parallel:
```typescript
Read('packages/web-client/src/hooks/index.ts')
Read('packages/web-client/src/contexts/index.ts')
Read('packages/web-client/src/components/canvas/index.ts')
Read('packages/web-client/src/components/metamap/index.ts')
Read('packages/web-client/src/components/modals/index.ts')
Read('packages/web-client/src/components/ui/index.ts')
Read('packages/web-client/src/utils/index.ts')
```

For each barrel file, compare the **actual exports** against the **documented exports** in doc02.08's corresponding section. Flag:
- **Listed in doc but not in code** — stale entry, remove from doc
- **In code but not in doc** — missing entry, add to doc

Also reconcile doc02.03 §MCP Tools against the actual tool registrations:
```typescript
Grep({ pattern: "name: 'carta_", path: 'packages/server/src/mcp/tools.ts', output_mode: 'content' })
```

### 3C: Build Gap Report

For each gap between doc claims and code reality:

```markdown
### Gaps Found

| Doc | What Doc Says (or Doesn't) | What Code Actually Does | Severity |
|-----|---------------------------|------------------------|----------|
| doc02.09 | No mention of pin constraints | `usePinConstraints` hook, `PinBadge` component exist | Major — new feature undocumented |
| doc02.10 | Edge routing described as one-shot | Persistent waypoints now stored in Y.Doc | Major — behavior changed |
| doc02.08 | Hooks table missing 3 hooks | `usePinConstraints`, `useIconMarkers`, `useFieldEvolution` exported | Minor — table incomplete |
| doc02.06 | Field type changes not described | `changeFieldType` in schema editor, migration support | Major — new capability |
```

**Severity guide:**
- **Major**: New feature/behavior completely absent from docs, or doc describes something that no longer works that way
- **Minor**: Table entries missing, small description tweaks needed
- **None**: Doc accurately describes the code (report this too, with evidence)

**If no gaps found:** Report with evidence. "doc02.09 §Organizers accurately describes pin constraints at line 45, layout strategies at line 72" is credible. "Already synchronized" is not.

---

## Phase 4: Check Dependencies

From MANIFEST's **Deps** column — when a doc needs updates, check docs that depend on it:

```typescript
// Example: updating doc02.09 → doc02.10 depends on it
Grep({ pattern: 'doc02\\.09', path: '.carta/02-system/10-canvas-data-pipelines.md' })
```

Only flag dependents that reference the specific content being changed.

---

## Phase 5: Generate Edit Instructions

For each gap, write concrete edit instructions with provenance:

```markdown
## Edit: .carta/02-system/09-presentation-model.md
Source: packages/web-client/src/hooks/usePinConstraints.ts
Section: §Organizers (after "Layout Strategies" subsection)

Add new subsection:

### Pin Constraints

Organizers support pinned constructs that maintain fixed positions during layout.
Pin constraints are stored in the organizer's Y.Map and respected by all layout strategies.
The `usePinConstraints` hook provides the data model; `PinBadge` renders the visual indicator.
```

**Provenance rules:**
- Every edit must cite source (code file path or doc section)
- Use `§` to reference doc sections: `doc02.09 §Organizers`
- If adding content, specify where it goes

---

## Phase 6: Launch Parallel Haiku Workers

For each doc file that needs edits, launch a haiku worker:

```typescript
Task({
  subagent_type: 'general-purpose',
  model: 'haiku',
  prompt: `Apply these documentation updates to ${file}:

${editInstructions}

Instructions:
1. Read ${file}
2. Find the section indicated
3. Apply the changes — add new content, update stale claims, fix references
4. Use Edit tool to apply each change
5. Preserve existing formatting and cross-reference style (docXX.YY)`,
  description: `Patch ${file}`
})
```

Launch ALL workers in a single message.

---

## Phase 7: Verification

### Coverage Check

Every significant code area maps to at least one verified doc:

```markdown
### Coverage Report
| Feature/Area | Code Evidence | Doc | Status |
|-------------|---------------|-----|--------|
| Pin constraints | usePinConstraints.ts, PinBadge.tsx | doc02.09 | Updated |
| Persistent waypoints | waypointStore.ts | doc02.10 | Updated |
| Schema field evolution | FieldEvolutionPanel.tsx | doc02.06 | Already current |
```

### Cross-Reference Integrity

```typescript
Grep({ pattern: 'doc[0-9][0-9]\\.[0-9][0-9]', path: '.carta/', output_mode: 'content' })
// Verify each ref appears in MANIFEST
```

---

## Phase 8: Update Sync Marker (1 Bash Call)

```bash
git rev-parse HEAD > .carta/.last-sync
```

---

## Phase 9: Return Summary

```markdown
## Documentation Update Summary

**Docs checked:** X docs read and compared against code
**Gaps found:** N (M major, P minor)

### Gaps Fixed
| Doc | Section | What Changed |
|-----|---------|-------------|
| doc02.09 | §Organizers | Added pin constraints section |
| doc02.10 | §Edge Pipeline | Updated waypoint persistence description |

### Verified Current (with evidence)
| Doc | Section | Verified Against |
|-----|---------|-----------------|
| doc02.07 | §Icon System | Phosphor imports in code match doc (line 23) |

### CLAUDE.md Status
No update needed / Updated because [reason]

### Sync Marker
Updated `.carta/.last-sync` → `{HEAD_SHORT}`
```

---

## Important Notes

- **Read docs and code, then compare.** The analyze script scopes the work; content comparison does the detection. Never conclude "already synchronized" from git metadata alone.
- **Read docs fully, not by section.** When checking a doc for gaps, read the whole thing. Section-level grep misses "this entire topic is absent."
- **Evidence for "no changes needed."** If a doc is current, say WHY — cite the lines that cover the relevant features. This is how users trust the result.
- **Bash budget: 2 calls total.** The analyze script and the sync marker write. Everything else is Read/Grep/Edit/Task.
