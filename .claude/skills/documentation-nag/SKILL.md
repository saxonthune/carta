# documentation-nag

Analyzes recent code changes and updates documentation to keep it synchronized.

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

| File | Updated When |
|------|-------------|
| `CLAUDE.md` | New key files, common tasks, architecture changes |
| `.cursor/rules/about.mdc` | Component tree, file structure changes |
| `.cursor/rules/look-and-feel.mdc` | Visual patterns, design system changes |
| `.cursor/rules/lod-rendering.mdc` | LOD thresholds, zoom behavior changes |
| `.cursor/rules/react-flow.mdc` | React Flow integration pattern changes |
| `.cursor/rules/metamodel-design.mdc` | Type system, metamodel changes |
| `.cursor/rules/ports-and-connections.mdc` | Port types, connection rules |
| `.cursor/rules/styling-best-practices.mdc` | Styling conventions, design tokens |
| `.cursor/rules/yjs-collaboration.mdc` | Collaboration patterns, Yjs usage |
| `.claude/skills/frontend-architecture/SKILL.md` | Layering rules, state partitioning |
| `tasks/context.md` | Quick reference for task agents |

**MCP documentation** (only when API surface changes):
- `packages/core/src/guides/metamodel.ts`
- `packages/core/src/guides/analysis.ts`
- `packages/server/src/mcp/tools.ts`

## Execution Pattern

You are opus. You do the analysis work:

### 1. Read Current State (Parallel)
```typescript
// Read all doc files in parallel
const docFiles = await Glob('**/*.{md,mdc}', { path: '.cursor/rules' });
// + CLAUDE.md, tasks/context.md, etc.
```

### 2. Analyze Changes
- Check git status for modified files
- Compare code changes against doc content
- Identify which docs are stale
- Write specific edit instructions per file

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

### Files Updated (6)
- CLAUDE.md - Added LOD files to Key Files table
- .cursor/rules/lod-rendering.mdc - Created new file
- tasks/context.md - Updated Recent Changes section
- ...

### No Updates Needed (3)
- .cursor/rules/metamodel-design.mdc - No metamodel changes
- ...

### Notes
- Created new LOD rendering guide with thresholds and examples
- Updated all references to zoom controls
```

## Important Notes

- **Read before editing**: Always read current doc state before writing edit instructions
- **Specific instructions**: Give haiku workers exact line numbers and text to add/change
- **Parallel execution**: Launch all haiku workers in one message (multiple Task calls)
- **MCP docs**: Only update when API surface changes, not internal implementation
- **Match existing style**: Maintain markdown format, tone, heading hierarchy

## Example Usage

```
User: "update docs"
You: [Read all doc files in parallel]
     [Analyze recent git changes]
     [Generate edit plan for each stale file]
     [Launch 5 haiku agents in parallel with edit instructions]
     [Return summary]
```
