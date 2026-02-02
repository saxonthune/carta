---
name: documentation-nag
description: Analyzes recent code changes and updates documentation to keep it synchronized with the codebase
---

# documentation-nag

Analyzes recent code changes and updates documentation to keep it synchronized.

## Source of Truth

**`.docs/` is the canonical source of truth for all project documentation.** It uses a numbered title system (see `.docs/00-codex/` for conventions). `CLAUDE.md` is the only **derived artifact** whose content should be consistent with `.docs/`.

When updating documentation:
1. **Update `.docs/` first** — this is the primary target
2. **Then propagate** to `CLAUDE.md` to keep it consistent
3. If `.docs/` and `CLAUDE.md` disagree, `.docs/` is correct

### .docs/ Structure

```
.docs/
├── 00-codex/        Meta-docs: taxonomy, conventions, maintenance
├── 01-context/      Mission, principles, glossary, UX principles
├── 02-system/       Architecture, state, interfaces, decisions, metamodel, design system, frontend architecture
├── 03-product/      Features, use cases, workflows
└── 04-operations/   Development, testing, deployment, contributing
```

Cross-references use `docXX.YY.ZZ` syntax (e.g., `doc03.01.07` = product > features > compilation). See `.docs/00-codex/03-conventions.md` for full rules.

## When to Use

Invoke after significant code changes:
- New components, hooks, or utilities added
- Architecture changes (state management, data flow)
- New patterns or conventions emerge
- Feature implementations that affect multiple files

## What This Does

1. **Reads all documentation files** in parallel (Glob + Read)
2. **Analyzes recent changes** against current documentation
3. **Generates specific edit instructions** for each file that needs updates
4. **Launches parallel haiku workers** to apply edits simultaneously
5. **Returns summary** of what was updated

## Target Documentation Files

### Primary (source of truth)

| Directory | Updated When |
|-----------|-------------|
| `.docs/01-context/` | Domain vocabulary changes, new principles, UX principles |
| `.docs/02-system/` | Architecture changes, new decisions, metamodel, design system, frontend architecture |
| `.docs/03-product/01-features/` | New features, feature behavior changes |
| `.docs/03-product/02-use-cases/` | New user personas or goals |
| `.docs/03-product/03-workflows/` | New or changed user flows |
| `.docs/04-operations/` | Build, test, deploy, or contribution process changes |

### Derived (propagate from .docs/)

| File | Updated When |
|------|-------------|
| `CLAUDE.md` | New key files, common tasks, architecture changes |

**MCP documentation** (only when API surface changes):
- `packages/core/src/guides/metamodel.ts`
- `packages/core/src/guides/analysis.ts`
- `packages/server/src/mcp/tools.ts`

## Execution Pattern

You are opus. You do the analysis work:

### 1. Read Current State (Parallel)
```typescript
// Read .docs/ files first (source of truth)
const docsFiles = await Glob('**/*.md', { path: '.docs' });
// Then read CLAUDE.md
```

### 2. Analyze Changes
- Check git status for modified files
- Compare code changes against `.docs/` content first
- Identify which docs are stale
- Write specific edit instructions per file
- For derived files, check consistency with `.docs/`

### 3. Launch Parallel Workers
For each file needing updates:
```typescript
Task({
  subagent_type: 'general-purpose',
  model: 'haiku',
  prompt: `Edit ${file}:

  1. Add to "Key Files" table:
     | src/components/lod/lodPolicy.ts | LOD band configuration |

  2. Update "Common Tasks" section:
     - Change line X from Y to Z

  3. Add new section after line N:
     \`\`\`markdown
     [exact markdown to insert]
     \`\`\`

  Use Edit tool to apply these changes.`,
  description: `Update ${file}`
})
```

Launch all Task calls in a single message for parallel execution.

### 4. Return Summary
```markdown
## Documentation Update Summary

### .docs/ Updated (3)
- .docs/03-product/01-features/01-canvas.md - Added LOD band details
- .docs/02-system/04-decisions/04-lod-bands.md - Created new ADR
- .docs/01-context/03-glossary.md - Added "LOD band" term

### Derived Files Updated (1)
- CLAUDE.md - Added LOD files to Key Files table

### Notes
- Created new LOD rendering ADR with thresholds and examples
```

## Important Notes

- **`.docs/` is the source of truth**: Update it first, then propagate to derived files
- **Read before editing**: Always read current doc state before writing edit instructions
- **Specific instructions**: Give haiku workers exact line numbers and text to add/change
- **Parallel execution**: Launch all haiku workers in one message (multiple Task calls)
- **MCP docs**: Only update when API surface changes, not internal implementation
- **Match existing style**: Maintain markdown format, tone, heading hierarchy
- **Use doc references**: When adding cross-references in `.docs/`, use `docXX.YY.ZZ` syntax
