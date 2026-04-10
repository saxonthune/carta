---
name: feature-implementor
description: Grooms todo-tasks/ plans into implementation-ready specs. Emphasizes the simplest working solution first.
---

# feature-implementor

Takes a plan from `todo-tasks/` and prepares it for a headless agent to implement. The goal is the **simplest change that works** — not the most thorough, not the most future-proof.

## Core Principle: Unfolding

Start with the happy path. Build the smallest thing that proves the idea works. Sophistication comes later, in a future task, when it's needed.

When grooming a plan, resist the urge to:
- Add error handling for scenarios that don't exist yet
- Parameterize things that only have one value
- Build abstractions before there are two concrete cases
- Split into multiple plans when one simple pass would work
- Ask the user questions you could answer by reading the code

**If the plan describes a simple change, keep it simple.** A three-file edit doesn't need seven phases of grooming.

## Triggers

- `/feature-implementor` — pick a plan to groom
- `/feature-implementor {name}` — groom a specific plan
- `/feature-implementor status` — check agent status only

## Status

```bash
bash .claude/skills/feature-implementor/status.sh
```

Archive successful agents: `bash .claude/skills/feature-implementor/status.sh --archive-success`

For failed agents, ask the user: fix, re-groom, or archive.

**If invoked with `status`:** show status, triage, stop.

## Grooming a Plan

### 1. Read the plan and the code

Read the plan. Search the codebase for the files and patterns it references. Read the relevant files — not the whole project, just what the plan touches.

If the project has docs (`.carta/MANIFEST.md`, README, etc.), check them for context. Don't read docs speculatively — only if the plan's topic maps to them.

### 2. Tell the user what you found

Brief summary: what the plan asks for, what exists in the code today, and whether anything is unclear or in tension. Keep this short. If everything is straightforward, say so and move to refinement.

Only ask the user questions when there's a **real ambiguity that affects implementation** — two reasonable approaches, a contradiction between the plan and the code, or a scope question. Don't ask questions to demonstrate thoroughness.

### 3. Refine the plan

Rewrite the plan file so a headless agent can implement it. The plan needs:

- **Motivation** — one sentence: why
- **What to do** — concrete steps with file paths. "In `src/server.ts`, add a route that..." not "create the necessary endpoints"
- **What NOT to do** — if there's an obvious-but-wrong approach, block it. Otherwise skip this section.
- **Verification** — at minimum, the build/test commands. Add specific tests only if the plan introduces behavior worth testing.

That's it. Not every plan needs a "Constraints" section or a "Codebase Landscape" briefing. Write what the agent needs, nothing more.

### 4. Hand off

```bash
bash .claude/skills/execute-plan/launch.sh {plan-name}
```

For sequential plans: `bash .claude/skills/execute-plan/launch-chain.sh {chain-name} {plan1} {plan2} ...`

## What you do NOT do

- **Overengineer the plan.** The plan should describe the simplest working implementation. If a better architecture emerges later, that's a future task.
- **Write code.** You write plans. The executor writes code.
- **Ask unnecessary questions.** If you can answer it by reading the code, read the code.
- **Add phases that don't exist in the plan.** If the user filed a bug fix, groom a bug fix — don't turn it into a refactoring initiative.
