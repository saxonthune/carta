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

Use the **Tag Index** at the bottom of MANIFEST.md to map changed code areas to doc refs. For each changed area, identify relevant tags (e.g., `hooks` → hooks tag, `components/canvas/*` → canvas/ui tags, `packages/schema/*` → schemas/metamodel tags) and look up the corresponding docs in the tag index.

Build a **doc checklist**: the docs to read and verify.

---

## Phase 3: Read the Docs AND the Code

This is the core. Read each doc on the checklist. Then read the corresponding code. Compare them.

### 3A: Read Docs

For each doc on the checklist, read it fully. Don't use section-level grep here — you need to understand the doc's claims holistically to spot gaps.

```typescript
// Read all relevant docs in parallel — resolve paths from MANIFEST's File column
// e.g., doc01.04.08 → .carta/02-architecture/04-canvas/04-presentation-model.md
```

### 3B: Read Code to Verify Claims

For each doc's claims, spot-check the code. Focus on:

- **Tables of hooks/components/files** — are there new ones missing? Are listed ones deleted?
- **Behavioral descriptions** — does the code still work that way?
- **Architecture claims** — do the layers/patterns still match?

```typescript
// Spot-check code claims from the docs you read.
// Example: if a doc describes organizer features, grep for the hooks/components it mentions:
Grep({ pattern: 'pin|constraint|PinConstraint', path: 'carta_cli/', output_mode: 'files_with_matches' })
```

### 3B-extra: Barrel Export Reconciliation (always runs)

**The frontend architecture doc lists every export from barrel files.** These lists drift silently. **Always** reconcile the barrel tables against actual barrel files, regardless of what Phase 1 found.

Look up the frontend architecture doc ref from MANIFEST (tags: `components, hooks, architecture`), read it, then read all barrel files it documents in parallel. For each barrel file, compare the **actual exports** against the **documented exports**. Flag:
- **Listed in doc but not in code** — stale entry, remove from doc
- **In code but not in doc** — missing entry, add to doc

Also reconcile MCP tool registrations against any doc that inventories them:
```typescript
Grep({ pattern: "name: 'carta_", path: 'carta_cli/', output_mode: 'content' })
```

### 3C: Build Gap Report

For each gap between doc claims and code reality:

```markdown
### Gaps Found

| Doc | What Doc Says (or Doesn't) | What Code Actually Does | Severity |
|-----|---------------------------|------------------------|----------|
| docXX.YY | No mention of feature X | `useFeatureX` hook exists in code | Major — new feature undocumented |
| docXX.YY | Behavior described as one-shot | Code now persists state in Y.Doc | Major — behavior changed |
| docXX.YY | Export table missing entries | 3 new exports in barrel file | Minor — table incomplete |
```

**Severity guide:**
- **Major**: New feature/behavior completely absent from docs, or doc describes something that no longer works that way
- **Minor**: Table entries missing, small description tweaks needed
- **None**: Doc accurately describes the code (report this too, with evidence)

**If no gaps found:** Report with evidence. "docXX.YY §Section accurately describes feature X at line 45" is credible. "Already synchronized" is not.

---

## Phase 4: Check Dependencies

From MANIFEST's **Deps** column — when a doc needs updates, check docs that depend on it:

```typescript
// Use MANIFEST's Deps column to find which docs depend on the one you're updating.
// Then grep those dependent docs for the specific ref being changed.
Grep({ pattern: 'docXX\\.YY', path: '.carta/path/to/dependent-doc.md' })
```

Only flag dependents that reference the specific content being changed.

---

## Phase 5: Generate Edit Instructions

For each gap, write concrete edit instructions with provenance:

```markdown
## Edit: .carta/path/to/doc.md
Source: carta_cli/...
Section: §SectionName (after "Subsection" subsection)

Add new subsection:

### Feature X

Description of the feature based on what the code actually does.
```

**Provenance rules:**
- Every edit must cite source (code file path or doc section)
- Use `§` to reference doc sections: `docXX.YY §Section`
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
| Feature X | useFeatureX.ts, FeatureXPanel.tsx | docXX.YY | Updated |
| Feature Y | featureYStore.ts | docXX.YY | Updated |
| Feature Z | FeatureZ.tsx | docXX.YY | Already current |
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
| docXX.YY | §Section | Added new subsection |
| docXX.YY | §Section | Updated description |

### Verified Current (with evidence)
| Doc | Section | Verified Against |
|-----|---------|-----------------|
| docXX.YY | §Section | Code matches doc (line N) |

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
