# Rhidoc - Claude Code Context

## Quick Start

Rhidoc is a spec-driven development tool. The primary product is the `.rhidoc/` workspace format — a structured documentation system that keeps specifications synchronized with code.

@.rhidoc/MANIFEST.md

## Development Philosophy

**Backwards Compatibility is NOT a Concern.** Remove old patterns completely, update all references, don't preserve deprecated code paths. Simplicity and clarity over backwards compatibility.

## Documentation

**`.rhidoc/` is the canonical source of truth** — a Rhidoc workspace containing specifications and architecture docs. Docs represent the best current understanding, not templates to fill in. Sparse docs are intentional — do not elaborate beyond what the work demands (see doc00.02). Cross-references use `docXX.YY.ZZ` syntax (e.g., `doc03.06.01` = Rhidoc Docs API). **When referencing a doc in conversation, always include its title and enough context for the user to understand the reference without looking it up** (e.g., "doc03.08.08 (Structured Product Modeling — the nine formal structures for describing a business product)" not just "doc03.08.08"). Key docs:

- **Strategy**: doc03.01 (mission), doc03.02 (vision), doc03.03 (glossary), doc03.04 (primary sources), doc03.05 (docs system), doc03.06 (products), doc03.07 (spec-code reconciliation), doc03.08 (research), doc03.09 (docs syntax reference — formal grammar for refs, sections, frontmatter, MANIFEST)
- **Design**: doc02.01 (workspace scripts — the Docs API), doc02.02 (CLI user flow), doc02.03 (ADRs)
- **Architecture**: doc01.01 (reconciliation architecture), doc01.02 (design patterns)
- **Codex**: doc00.01 (about), doc00.02 (maintenance), doc00.03 (conventions), doc00.04 (AI retrieval)

**Rhidoc CLI**: Before using any `rhidoc` command, run `rhidoc ai-skill` to get the full semantic reference (syntax, arguments, side effects, sequencing rules). Do not guess flags or arguments.

## Skills & Agents

**Skills** (invoke with `/skill-name`): Opus analyzes, haiku workers execute in parallel.

| Skill | Purpose | When to use |
|-------|---------|-------------|
| `/docs-development` | Develops `.rhidoc/` docs at any level — elicits info, finds edge cases, reads code for context | When writing or refining docs at any level of the 4-title model |
| `/rhidoc-builder` | Design thinking and document modeling for Rhidoc | Before `/todo-task triage`, to resolve decisions |
| `/project-builder` | Dogfooding reflector for external projects | While building non-Rhidoc projects, to identify Rhidoc improvements |
| `/documentation-nag` | Keeps `.rhidoc/` and derived files in sync with code | After significant code changes |
| `/documentation-auditor` | Audits `.rhidoc/` claims against codebase, finds stale refs | Periodically, or before releases |
| `/git-sync-trunk` | Syncs trunk branch with remote or main | Before creating worktrees, after remote updates |
| `/git-sync-worktree` | Syncs worktree's claude branch with trunk via rebase | Every 30-60 min while working in a worktree |
| `/spec-builder` | Elicits requirements via structured interviewing, produces shape files | When defining new modules, features, or services |
| `/rhidoc-spec-builder` | Composes spec-builder with .rhidoc/ workspace knowledge and script pipeline | When building specs inside a .rhidoc/ workspace |
| `/rhidoc-cli` | Rhidoc Docs API reference: init, create, delete, move, punch, flatten, rewrite, regenerate, portable | When initializing workspaces or restructuring `.rhidoc/` docs |
| `/todo-task` | Task lifecycle manager: create, triage, execute, status, monitor | Capturing deferred work, grooming plans, launching headless agents |

**Agents** (launch with `Task` tool): Long-running autonomous workers.

| Agent | Purpose | When to use |
|-------|---------|-------------|
| `batch-executor` | Processes all tasks sequentially | "process tasks" - small/medium tasks |
| `task-master` | Spawns parallel agents per task | "launch task-master" - large tasks |
| `plan-executor` | Implements a plan headlessly in a worktree | Background worker for `/todo-task execute` |

### Skill Details

All skills follow the same pattern: opus reads `.rhidoc/` and code, analyzes, generates edit instructions, launches parallel haiku workers.

| Skill | Reference Docs | Config |
|-------|---------------|--------|
| `/docs-development` | `.rhidoc/MANIFEST.md`, codebase, MCP tools | `.claude/skills/docs-development/SKILL.md` |
| `/rhidoc-builder` | `.rhidoc/MANIFEST.md`, MCP tools | `.claude/skills/rhidoc-builder/SKILL.md` |
| `/project-builder` | `.rhidoc/MANIFEST.md`, MCP tools, external project context | `.claude/skills/project-builder/SKILL.md` |
| `/documentation-nag` | `.rhidoc/` (all titles) | `.claude/skills/documentation-nag/SKILL.md` |
| `/documentation-auditor` | `.rhidoc/MANIFEST.md`, codebase source | `.claude/skills/documentation-auditor/SKILL.md` |
| `/git-sync-trunk` | Git worktree workflows | `.claude/skills/git-sync-trunk/SKILL.md` |
| `/git-sync-worktree` | Git worktree workflows | `.claude/skills/git-sync-worktree/SKILL.md` |
| `/spec-builder` | doc03.08.04 (reconciliation), doc03.08.05 (spec quality) | `.claude/skills/spec-builder/SKILL.md` |
| `/rhidoc-spec-builder` | doc03.08.04, doc03.08.05, `.rhidoc/` workspace structure | `.claude/skills/rhidoc-spec-builder/SKILL.md` |
| `/rhidoc-cli` | doc03.06.01 (Docs API), doc02.01 (design) | `.claude/skills/rhidoc-cli/SKILL.md` |
| `/todo-task` | Plan files, agent worktrees | `.claude/skills/todo-task/SKILL.md` |

### Agent Details

| Agent | Config |
|-------|--------|
| `batch-executor` | `.claude/agents/batch-executor.md` |
| `task-master` | `.claude/agents/task-master.md` |
| `plan-executor` | `.claude/agents/plan-executor.md` |

## Project Structure

Rhidoc is a Python project with two main components:

| Component | Location | Purpose |
|-----------|----------|---------|
| `.rhidoc/` | `.rhidoc/` | Workspace format — specifications and architecture docs |
| `rhidoc-cli` | `rhidoc/` | Python CLI for workspace operations |
| Tests | `tests/` | pytest test suite |

## Build & Test

```bash
make test    # Run all tests (pytest)
```

`make test` must pass before committing. Rhidoc is pure Python — no build step needed.

## Codebase Exploration Strategy

**Two-phase search**: Locate files cheaply before reading them.

1. **Cheap triage** — Run parallel `Grep` calls with `output_mode: "files_with_matches"` to identify relevant files without reading content. Use `MANIFEST.md` tag index to map keywords to doc refs.
2. **Targeted reads** — Read only the files surfaced by triage. Prefer `.rhidoc/` refs first (architectural context without reading source), then source files at matched line ranges.

**Do NOT**: Launch Explore agents for simple searches. Read entire directories speculatively. Read files not surfaced by Grep or referenced by the plan.

**Escalate to Explore agent only if**: Grep returns 0 hits for all terms, the subsystem has no `.rhidoc/` coverage, or you can't identify which files to modify after triage.

## Constraints

- **`.rhidoc/` conventions**: Cross-references use `docXX.YY.ZZ` syntax. Sparse docs are intentional — do not elaborate beyond what the work demands.
- **Python patterns**: See doc01.02.01 (Python for AI — file structure, typing, naming, testability patterns).
- **Rhidoc CLI**: Always run `rhidoc ai-skill` before using any `rhidoc` command — do not guess flags or arguments.
