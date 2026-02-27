---
title: Token Efficiency in Skills and Agents
status: active
date: 2026-02-08
tags: tokens, efficiency, skills, agents, context-engineering
---

# Token Efficiency in Skills and Agents

> **Question**: Where do skills and agents waste tokens, and what patterns keep usage proportional to the value delivered?

## Context

After running the `/carta-feature-implementor` skill through several grooming sessions, we audited where tokens were spent versus where they provided value. The findings generalize to any multi-phase skill or background agent.

## Research: Anthropic's Context Engineering Principles

Source: [Effective Context Engineering for AI Agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

Core principle: **find the smallest set of high-signal tokens that maximize the likelihood of the desired outcome.** Context is a finite attention budget, not an unlimited commodity.

Key techniques relevant to skill/agent design:

| Technique | What it means | When to apply |
|-----------|--------------|---------------|
| **Tool result compression** | Clear or truncate tool outputs once their information has been extracted | Any phase that reads files for metadata extraction |
| **Just-in-time retrieval** | Hold lightweight identifiers; fetch full content only when needed | Doc lookups, codebase exploration |
| **Subagent isolation** | Delegate verbose operations to subagents; return condensed summaries | Codebase exploration, test running, log analysis |
| **Structured note-taking** | Write findings to files rather than keeping them in active context | Multi-phase workflows where early findings inform later phases |

Source: [Manage costs effectively — Claude Code Docs](https://code.claude.com/docs/en/costs)

Additional techniques from the official Claude Code cost guide:

| Technique | What it means | When to apply |
|-----------|--------------|---------------|
| **Surgical reads** | Read specific line ranges, not whole files, when you only need a section | Reading docs or large source files for a specific section |
| **CLI over MCP when possible** | CLI tools don't add persistent tool definitions to context | Prefer `gh` over GitHub MCP, etc. |
| **Hooks for preprocessing** | Shell hooks can filter/compress data before Claude sees it | Test output, log files, build output |

## Analysis: Token Spend Categories

Every skill phase falls into one of three categories:

### 1. Structural overhead (unavoidable)

Token cost that's inherent to the skill's job. Examples:
- Loading the skill prompt itself (SKILL.md)
- Reading the plan file being groomed
- Interactive Q&A with the user
- Writing the refined output

**Optimization**: Keep SKILL.md focused. Move examples and edge-case handling to the end where auto-compaction can drop them if needed.

### 2. Context gathering (valuable but controllable)

Token cost for understanding the codebase. Examples:
- Exploring source files to understand patterns
- Reading documentation for architectural context
- Reading adjacent code to check for conflicts

**Optimization**: Delegate to Explore subagents (isolates verbose reads from main context). Read doc sections surgically — grep for the relevant header, then read just that range rather than the full file. Prefer reading source files over documentation when the source is the authoritative answer.

### 3. Status/bookkeeping (often wasteful)

Token cost for checking on things, not for doing the actual work. Examples:
- Reading completed agent result files for debrief
- Checking running agent progress
- Listing and scanning plans for conflict detection

**Optimization**: This is where the biggest wins live. Extract only the fields you need. For structured files with known formats, use targeted reads (head, grep for sections) rather than full-file reads.

## Findings: Specific Patterns

### Pattern: Lean metadata extraction

**Problem**: Reading full result files (~100-130 lines each) when only ~10 lines contain actionable information (status, merge result, retried flag, notes section).

**Fix**: Use targeted extraction:
```bash
# Instead of reading 130 lines:
Read('agent-results/foo.md')

# Read just the header (8 lines) + notes section:
head -8 agent-results/foo.md
grep -A 20 '## Notes' agent-results/foo.md
```

**Savings**: ~80% reduction per file. With 8 completed agents, this saves ~5,600 input tokens.

### Pattern: Section-targeted doc reads

**Problem**: Reading a 200-line doc file when only a 15-line section is relevant.

**Fix**: Grep for the section header first, then read just that range. Or use the Explore subagent which returns a condensed summary.

**Savings**: Varies. Most impactful for large reference docs (metamodel, presentation model, design system).

### Pattern: Subagent delegation for exploration

**Status**: Already good. The Explore subagent pattern correctly isolates verbose codebase reads from the main context. A 73k-token exploration returns a ~2k-token summary. This is the recommended pattern per Anthropic's context engineering guide.

**Rule of thumb**: If gathering context will require reading more than 3 files, delegate to a subagent.

### Pattern: Write-to-disk, don't hold in context

**Status**: Already good. Refined plans are written to `todo-tasks/` files. The main context doesn't need to hold the full plan text after writing it.

**Corollary**: If a skill produces a large artifact (plan, report, test file), write it early and reference it by path rather than keeping the content in conversational context.

## Guidelines for Future Skills

When designing or auditing a skill:

1. **Audit each phase**: What tokens are spent? What value do they provide? Is the ratio reasonable?
2. **Separate metadata from content**: If you only need 3 fields from a file, don't read the whole file.
3. **Delegate verbose work**: Any operation that reads >3 files or produces >1000 lines of output belongs in a subagent.
4. **Prefer targeted reads**: `Read(file, { offset, limit })` and grep-then-read over full-file reads.
5. **Front-load the skill prompt**: Put critical instructions at the top. Auto-compaction drops from the middle/end of long conversations, but skill prompts loaded early benefit from prompt caching.
6. **Don't re-read what you've written**: After writing a file, reference it by path. Don't read it back unless you need to verify.

## Outcome

- Updated `/carta-feature-implementor` SKILL.md with lean debrief approach (Phase 0)
- These guidelines apply to all future skills and agents in the project

## References

- [Effective Context Engineering for AI Agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Manage costs effectively — Claude Code Docs](https://code.claude.com/docs/en/costs)
- [The Context Window Problem — Factory.ai](https://factory.ai/news/context-window-problem)
