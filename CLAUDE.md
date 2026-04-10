# Carta - Claude Code Context

## Quick Start

Carta is a spec-driven development tool. The primary product is the `.carta/` workspace format — a structured documentation system that keeps specifications synchronized with code.

@.carta/MANIFEST.md

## Development Philosophy

**Backwards Compatibility is NOT a Concern.** Remove old patterns completely, update all references, don't preserve deprecated code paths. Simplicity and clarity over backwards compatibility.

## Concept-Driven Design (Jackson)

Carta uses concept-driven design from Daniel Jackson's *The Essence of Software*. Full reference: `/book-summary jackson-essence-of-software`. Key principles for this codebase:

- **Every concept must have a clear, articulated purpose.** If you can't identify a compelling purpose, it's not a concept. Real-world entities don't automatically become software concepts.
- **If there's no behavior, there's no concept.** Design for behavior first, not state structure. No compelling operational principle → not a concept.
- **Concepts should be freestanding and mutually independent.** Dependencies belong to the composition layer, not to concepts themselves.
- **Concepts and purposes should be in one-to-one correspondence.** One concept per purpose, one purpose per concept. Split overloaded concepts; merge redundant ones.
- **Compose concepts by synchronizing their actions.** Concepts run independently; the composition layer coordinates them. Actors, ownership, and cross-cutting concerns live in composition.
- **Concepts localize data models.** Each concept owns its own state (micromodel). Grow or shrink the data model by adding or removing concepts.
- **Cast concepts in generic terms.** Avoid needless specialization. A generic Link concept instantiated as docXX.YY refs is better than a Ref concept.
- **Grow a product a few concepts at a time.** Start with seed concepts. Unfold complexity only when forces demand it.
- **Implement concepts as separate modules.** One file per concept, exporting state types and action functions. Follows tinyForum's pattern: pure state as first parameter, no framework dependencies.

## Documentation

**`.carta/` is the canonical source of truth** — a Carta workspace containing specifications and architecture docs. Docs represent the best current understanding, not templates to fill in. Sparse docs are intentional — do not elaborate beyond what the work demands (see doc00.02). Cross-references use `docXX.YY.ZZ` syntax (e.g., `doc01.02.05` = metamodel). **When referencing a doc in conversation, always include its title and enough context for the user to understand the reference without looking it up** (e.g., "doc01.03.08.08 (Structured Product Modeling — the nine formal structures for describing a business product)" not just "doc01.03.08.08"). Key docs:

- **Strategy**: doc01.03.01 (mission), doc01.03.02 (principles), doc01.03.06 (products), doc01.03.07 (reconciliation), doc01.03.08 (research)
- **Design**: doc01.02.01 (workspace scripts), doc01.02.05 (metamodel), doc01.02.06 (presentation model), doc01.02.03 (ADRs)
- **Architecture**: doc01.01.01 (overview), doc01.01.04 (canvas state), doc01.01.05 (frontend), doc01.01.08 (design system)
- **Code Shapes**: doc01.02.02 (empty — future)
- **Projects**: doc01.01.01 (product-design-ui)

**Carta CLI**: Before using any `carta` command, run `carta ai-skill` to get the full semantic reference (syntax, arguments, side effects, sequencing rules). Do not guess flags or arguments.

## Skills & Agents

**Skills** (invoke with `/skill-name`): Opus analyzes, haiku workers execute in parallel.

| Skill | Purpose | When to use |
|-------|---------|-------------|
| `/docs-development` | Develops `.carta/` docs at any level — elicits info, finds edge cases, reads code for context | When writing or refining docs at any level of the 4-title model |
| `/carta-builder` | Design thinking and document modeling for Carta | Before `/carta-feature-implementor`, to resolve decisions |
| `/project-builder` | Dogfooding reflector for external projects | While building non-Carta projects, to identify Carta improvements |
| `/carta-feature-groomer` | Researches codebase, discusses approach, refines plans into specs | Before `/carta-feature-implementor`, to resolve decisions |
| `/carta-feature-implementor` | Status, launch, triage, chain orchestration | After grooming, to launch plans and manage agents |
| `/documentation-nag` | Keeps `.carta/` and derived files in sync with code | After significant code changes |
| `/documentation-auditor` | Audits `.carta/` claims against codebase, finds stale refs | Periodically, or before releases |
| `/git-sync-trunk` | Syncs trunk branch with remote or main | Before creating worktrees, after remote updates |
| `/git-sync-worktree` | Syncs worktree's claude branch with trunk via rebase | Every 30-60 min while working in a worktree |
| `/execute-plan` | Launches background agent to implement a plan from todo-tasks/ | After agreeing on a plan interactively |
| `/spec-builder` | Elicits requirements via structured interviewing, produces shape files | When defining new modules, features, or services |
| `/carta-spec-builder` | Composes spec-builder with .carta/ workspace knowledge and script pipeline | When building specs inside a .carta/ workspace |
| `/carta-cli` | Carta Docs API reference: init, create, delete, move, punch, flatten, rewrite, regenerate, portable | When initializing workspaces or restructuring `.carta/` docs |
| `/todo-task` | Quick-capture a bug, improvement, or feature idea as a todo-task file | When any session discovers work that should be deferred, not done now |

**Agents** (launch with `Task` tool): Long-running autonomous workers.

| Agent | Purpose | When to use |
|-------|---------|-------------|
| `batch-executor` | Processes all tasks sequentially | "process tasks" - small/medium tasks |
| `task-master` | Spawns parallel agents per task | "launch task-master" - large tasks |
| `plan-executor` | Implements a plan headlessly in a worktree | Background worker for `/execute-plan` |

### Skill Details

All skills follow the same pattern: opus reads `.carta/` and code, analyzes, generates edit instructions, launches parallel haiku workers.

| Skill | Reference Docs | Config |
|-------|---------------|--------|
| `/docs-development` | `.carta/MANIFEST.md`, codebase, MCP tools | `.claude/skills/docs-development/SKILL.md` |
| `/carta-builder` | `.carta/MANIFEST.md`, MCP tools | `.claude/skills/carta-builder/SKILL.md` |
| `/project-builder` | `.carta/MANIFEST.md`, MCP tools, external project context | `.claude/skills/project-builder/SKILL.md` |
| `/carta-feature-groomer` | `.carta/MANIFEST.md`, plan files, codebase | `.claude/skills/carta-feature-groomer/SKILL.md` |
| `/carta-feature-implementor` | Plan files, status script | `.claude/skills/carta-feature-implementor/SKILL.md` |
| `/documentation-nag` | `.carta/` (all titles) | `.claude/skills/documentation-nag/SKILL.md` |
| `/documentation-auditor` | `.carta/MANIFEST.md`, codebase source | `.claude/skills/documentation-auditor/SKILL.md` |
| `/git-sync-trunk` | Git worktree workflows | `.claude/skills/git-sync-trunk/SKILL.md` |
| `/git-sync-worktree` | Git worktree workflows | `.claude/skills/git-sync-worktree/SKILL.md` |
| `/execute-plan` | Plan executor workflow | `.claude/skills/execute-plan/SKILL.md` |
| `/spec-builder` | doc01.03.08.04 (reconciliation), doc01.03.08.05 (spec quality) | `.claude/skills/spec-builder/SKILL.md` |
| `/carta-spec-builder` | doc01.03.08.04, doc01.03.08.05, `.carta/` workspace structure | `.claude/skills/carta-spec-builder/SKILL.md` |
| `/carta-cli` | doc01.03.06.01 (Docs API), doc01.02.01 (design) | `.claude/skills/carta-cli/SKILL.md` |
| `/todo-task` | — | `.claude/skills/todo-task/SKILL.md` |

### Agent Details

| Agent | Config |
|-------|--------|
| `batch-executor` | `.claude/agents/batch-executor.md` |
| `task-master` | `.claude/agents/task-master.md` |
| `plan-executor` | `.claude/agents/plan-executor.md` |

## Project Structure

Carta is a Python project with two main components:

| Component | Location | Purpose |
|-----------|----------|---------|
| `.carta/` | `.carta/` | Workspace format — specifications and architecture docs |
| `carta-cli` | `carta_cli/` | Python CLI for workspace operations |
| Tests | `tests/` | pytest test suite |

## Build & Test

```bash
make test    # Run all tests (pytest)
```

`make test` must pass before committing. Carta is pure Python — no build step needed.

## Codebase Exploration Strategy

**Two-phase search**: Locate files cheaply before reading them.

1. **Cheap triage** — Run parallel `Grep` calls with `output_mode: "files_with_matches"` to identify relevant files without reading content. Use `MANIFEST.md` tag index to map keywords to doc refs.
2. **Targeted reads** — Read only the files surfaced by triage. Prefer `.carta/` refs first (architectural context without reading source), then source files at matched line ranges.

**Do NOT**: Launch Explore agents for simple searches. Read entire directories speculatively. Read files not surfaced by Grep or referenced by the plan.

**Escalate to Explore agent only if**: Grep returns 0 hits for all terms, the subsystem has no `.carta/` coverage, or you can't identify which files to modify after triage.

## Constraints

- **`.carta/` conventions**: Cross-references use `docXX.YY.ZZ` syntax. Sparse docs are intentional — do not elaborate beyond what the work demands.
- **Python patterns**: See doc01.01.02.01 (Python for AI — file structure, typing, naming, testability patterns).
- **Carta CLI**: Always run `carta ai-skill` before using any `carta` command — do not guess flags or arguments.
