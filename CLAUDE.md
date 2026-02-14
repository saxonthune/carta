# Carta - Claude Code Context

## Quick Start

Carta is a visual software architecture editor using React Flow. Users create "Constructs" (typed nodes), connect them, and compile to AI-readable output.

@.docs/MANIFEST.md

## Development Philosophy

**Backwards Compatibility is NOT a Concern.** Remove old patterns completely, update all references, don't preserve deprecated code paths. Simplicity and clarity over backwards compatibility.

## Documentation

**`.docs/` is the canonical source of truth.** Cross-references use `docXX.YY.ZZ` syntax (e.g., `doc02.06` = metamodel). Key docs:

- **Architecture**: doc02.01 (overview), doc02.02 (state), doc02.08 (frontend)
- **Metamodel**: doc02.06 (schemas, ports, fields)
- **Deployment**: doc02.05 (server/local/desktop modes)
- **Features**: doc03.01.xx (modeling, output, environment)
- **Testing**: doc04.02

## Skills & Agents

**Skills** (invoke with `/skill-name`): Opus analyzes, haiku workers execute in parallel.

| Skill | Purpose | When to use |
|-------|---------|-------------|
| `/carta-feature-implementor` | Grooms todo-tasks/ plans into implementation-ready specs | Before `/execute-plan`, to resolve decisions and refine |
| `/documentation-nag` | Keeps `.docs/` and derived files in sync with code | After significant code changes |
| `/documentation-auditor` | Audits `.docs/` claims against codebase, finds stale refs | Periodically, or before releases |
| `/style-nag` | Audits and fixes UI styling against doc02.07 | After UI changes, or periodically |
| `/frontend-architecture-nag` | Audits component layering against doc02.08 | After architectural changes |
| `/test-builder` | Creates integration/E2E tests | When adding test coverage |
| `/react-flow-expert` | React Flow performance, uncontrolled mode, presentation layer | Performance issues, designing visual features |
| `/git-sync-trunk` | Syncs trunk branch with remote or main | Before creating worktrees, after remote updates |
| `/git-sync-worktree` | Syncs worktree's claude branch with trunk via rebase | Every 30-60 min while working in a worktree |
| `/execute-plan` | Launches background agent to implement a plan from todo-tasks/ | After agreeing on a plan interactively |

**Agents** (launch with `Task` tool): Long-running autonomous workers.

| Agent | Purpose | When to use |
|-------|---------|-------------|
| `batch-executor` | Processes all tasks sequentially | "process tasks" - small/medium tasks |
| `task-master` | Spawns parallel agents per task | "launch task-master" - large tasks |
| `test-builder` | Creates integration/E2E tests autonomously | "launch test-builder" |
| `plan-executor` | Implements a plan headlessly in a worktree | Background worker for `/execute-plan` |

### Skill Details

All skills follow the same pattern: opus reads `.docs/` and code, analyzes, generates edit instructions, launches parallel haiku workers.

| Skill | Reference Docs | Config |
|-------|---------------|--------|
| `/carta-feature-implementor` | `.docs/MANIFEST.md`, plan files | `.claude/skills/carta-feature-implementor/SKILL.md` |
| `/documentation-nag` | `.docs/` (all titles) | `.claude/skills/documentation-nag/SKILL.md` |
| `/documentation-auditor` | `.docs/MANIFEST.md`, barrel exports, type defs | `.claude/skills/documentation-auditor/SKILL.md` |
| `/style-nag` | doc02.07 (design system), doc01.04 (UX principles) | `.claude/skills/style-nag/SKILL.md` |
| `/frontend-architecture-nag` | doc02.08 (frontend architecture), doc02.01 (overview) | `.claude/skills/frontend-architecture-nag/SKILL.md` |
| `/test-builder` | doc04.02 (testing), `packages/web-client/tests/README.md` | `.claude/skills/test-builder/SKILL.md` |
| `/react-flow-expert` | doc02.09 (presentation model), Map.tsx, DynamicAnchorEdge.tsx | `.claude/skills/react-flow-expert/SKILL.md` |
| `/git-sync-trunk` | Git worktree workflows | `.claude/skills/git-sync-trunk/SKILL.md` |
| `/git-sync-worktree` | Git worktree workflows | `.claude/skills/git-sync-worktree/SKILL.md` |
| `/execute-plan` | Plan executor workflow | `.claude/skills/execute-plan/SKILL.md` |

### Agent Details

| Agent | Config |
|-------|--------|
| `batch-executor` | `.claude/agents/batch-executor.md` |
| `task-master` | `.claude/agents/task-master.md` |
| `test-builder` | `.claude/agents/test-builder.md` |
| `plan-executor` | `.claude/agents/plan-executor.md` |

## Monorepo Structure

Packages can only depend on packages above them in the graph.

```
                    @carta/types
                         ↓
                    @carta/domain
                    ↙    ↓    ↘
        @carta/compiler  @carta/document
                    ↓    ↙       ↘
         @carta/web-client   @carta/server
                ↓
         @carta/desktop
```

| Package | Location | Purpose |
|---------|----------|---------|
| `@carta/types` | `packages/types/` | Shared TypeScript types, no runtime deps |
| `@carta/domain` | `packages/domain/` | Domain model, port registry, built-in schemas, utils |
| `@carta/document` | `packages/document/` | Shared Y.Doc operations, Yjs helpers, file format, migrations |
| `@carta/compiler` | `packages/compiler/` | Compilation engine (Carta → AI-readable output) |
| `@carta/web-client` | `packages/web-client/` | React web app |
| `@carta/server` | `packages/server/` | Document server + MCP server |
| `@carta/desktop` | `packages/desktop/` | Electron desktop app with embedded document server |

Cross-package dependencies are resolved via Vite/TypeScript aliases. Packages use `index.ts` barrel exports for public APIs. Web client feature directories (hooks, components/canvas, components/metamap, components/modals, components/ui) each have barrel exports.

**Stale/dead code:** `@carta/core` (`packages/core/`) has divergent types the server still depends on. `packages/app/` is dead code.

## Build & Test

```bash
pnpm build         # Build all packages (checks TypeScript compilation)
pnpm test          # Integration tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright, port 5273)
```

All three must pass before committing. E2E uses port 5273 (separate from dev server 5173).

**Vite dev server restart:** If the user is running `pnpm dev` and your changes require a Vite restart (e.g., new files, config changes, dependency updates, or Vite alias changes), tell the user to restart Vite. Do not restart it yourself — the user manages the dev server.

## Codebase Exploration Strategy

**Two-phase search**: Locate files cheaply before reading them.

1. **Cheap triage** — Run parallel `Grep` calls with `output_mode: "files_with_matches"` to identify relevant files without reading content. Use `MANIFEST.md` tag index to map keywords to doc refs.
2. **Targeted reads** — Read only the files surfaced by triage. Prefer `.docs/` refs first (architectural context without reading source), then source files at matched line ranges.

**Do NOT**: Launch Explore agents for simple searches. Read entire directories speculatively. Read files not surfaced by Grep or referenced by the plan.

**Escalate to Explore agent only if**: Grep returns 0 hits for all terms, the subsystem has no `.docs/` coverage, or you can't identify which files to modify after triage.

## Known Pitfalls

- **`reactFlow.getNodes()` is stale after `setNodes()`** — In uncontrolled mode, `getNodes()` called immediately after `setNodes(updater)` in the same synchronous block returns stale data. **Pattern**: Pass known positions forward as parameters instead of re-reading from the RF store. See doc05.03.

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand. Declare fields explicitly.
- **Barrel exports**: Packages use `.js` extensions (e.g., `export * from './types/index.js'`)
- **State**: Yjs Y.Doc is the single source of truth. All state operations go through DocumentAdapter. No singleton registries.
- **Node identity**: No `name` field on instances — titles come from schema's `displayField` or `semanticId`.
