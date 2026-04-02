# Learnings from tinyForum: What Carta Should Steal

This document is written for AI agents working on the carta codebase. It captures what works well in tinyForum's use of carta + concept-driven development, and proposes concrete improvements to carta based on observed friction and success patterns.

Source project: `/home/saxon/code/github/saxonthune/tinyForum/`

---

## Part 1: What Works Here

### 1.1 Concept specs drive implementation with zero drift

tinyForum defines Jackson-style concepts in `.carta/02-development/03-concepts/`. Each concept has purpose, state, actions, and operational principle. These specs are the single source of truth — implementation flows deterministically through a pipeline documented in `doc02.04.05`:

```
concept spec → concept code → contract types → server action → client component
```

Each stage is independently testable. A concept can exist at stage 1-2 (spec + pure TypeScript) before it has any server or UI code. This means design discussions happen in carta docs, and implementation is mechanical.

**Why it works:** The concept spec format is constrained enough that an AI agent can read a spec and produce implementation without ambiguity. The pipeline doc (`doc02.04.05`) tells the agent exactly which files to create at each stage and what patterns to follow.

**Evidence:** Three concepts (Identity, Auth, Credential) were designed conversationally in a docs-development session, written as carta specs, then implemented by a headless agent that read the specs and followed the pipeline. The agent produced correct code on the first pass.

### 1.2 Unfolding keeps the workspace alive

tinyForum follows Alexander's unfolding process: start minimal, add complexity only when forces demand it. This applies to both code and docs.

**In practice:**
- Concepts start sparse (Post had no auth, no ordering, no timestamps). Each was added later when a real force appeared.
- The concept index (`doc02.03.00`) has a "Concepts that don't exist yet (and why)" section — documenting the *absence* of concepts is as valuable as documenting their presence.
- Contract types start fat ("return everything, optimize later") and get trimmed when performance forces arrive.
- Parameters that aren't surfaced yet get defaulted at the server layer, not removed from the concept. This keeps concepts honest.

**Why it works:** Unfolding prevents premature abstraction. The docs capture decisions and their rationale, so when forces do arrive, the agent (or human) knows what was deferred and why.

### 1.3 MANIFEST.md is the right entry point

AI agents read MANIFEST.md first, find relevant docs by tag/summary, then read only what's needed. This works. The tag index is especially useful for mapping a task description to relevant specs.

**Evidence:** Every agent session in tinyForum starts with reading MANIFEST.md, then reads 2-4 docs. No agent has needed to read more than 6 docs to complete a task. Token budget stays under control.

### 1.4 Cross-references create a navigable graph

`docXX.YY` refs with deps/reverse-deps in MANIFEST make the workspace a directed graph. An agent can trace from a concept spec (`doc02.03.03` Post) to its screen (`doc02.05.02` ThreadView) to the component pattern it follows (`doc02.04.02` React Components). This traceability means changes propagate correctly — when Post gains a `createdAt` field, the agent finds all downstream docs via refs.

### 1.5 The docs-development skill enables conversational design

The `docs-development` skill template (hydrated by `carta hydrate`) is the bridge between human thinking and machine-readable specs. The user thinks out loud, the skill captures decisions as sparse docs, and those docs later drive implementation.

**Key pattern:** The user never writes specs directly. They describe what they want conversationally, the AI writes a spec, the user validates or corrects, and only then does implementation begin. This feels like pair programming at the design level.

### 1.6 Headless agents can implement from specs alone

tinyForum uses a todo-task system where groomed plans reference carta docs, and headless agents execute those plans in isolated worktrees. The agents succeed because:

- Concept specs are unambiguous (purpose, state, actions — no prose interpretation needed)
- The pipeline doc tells them exactly what files to create
- Pattern docs (server architecture, React components) give them the structural template
- Existing code in the repo provides the concrete example

**Implication for carta:** The workspace format is already good enough for headless agent consumption. The gap is in helping users *create* specs that are agent-ready, and in validating that specs stay in sync with code.

---

## Part 2: Suggestions for Carta

### 2.1 Add a `carta validate` command

**Problem observed:** tinyForum has docs with missing or weak summaries, empty deps, and inconsistent status values. These degrade MANIFEST quality, which degrades AI retrieval.

**Suggestion:** Add `carta validate` that checks:
- All docs have non-empty `title`, `status`, `summary`, `tags`
- `status` values are from a known set (`draft`, `active`, `deprecated`)
- All `deps` refs point to existing docs
- All `docXX.YY` references in document bodies point to existing docs (broken link detection)
- Tags are lowercase and alphanumeric

Output a report of warnings. Don't block — just surface issues. This helps the docs-development skill catch quality problems early.

**Implementation hint:** Most of this data is already computed during `regenerate`. The validation can piggyback on the same traversal in `regenerate_core.py`.

### 2.2 Add concept spec templates

**Problem observed:** Every tinyForum concept follows the same structure (Purpose, State, Actions, Operational Principle, Composition). This structure was invented by the user and manually maintained. New concepts copy the pattern from existing ones.

**Suggestion:** Add a `carta create --template concept` option that scaffolds a doc with the Jackson concept structure:

```markdown
---
title: {Name}
status: draft
summary: Concept — {one-line purpose}
tags: [concepts, jackson, {slug}]
deps: [doc02.03.00]
---

# {Name}

## Purpose

{Why this concept exists — what user need it serves.}

## State

- {collection}: set of {Type}
- {Type}: { field1, field2 }

## Actions

- {action}(params) -> result

## Operational Principle

{How a user interacts with this concept in practice.}
```

Templates should live in `carta_cli/templates/doc-templates/` and be user-extensible (users can add their own in `.carta/templates/`).

**Why this matters:** The concept format is carta's killer use case for AI-driven development. Standardizing it makes concept specs more consistent, reduces friction in the docs-development workflow, and gives headless agents a reliable structure to parse.

### 2.3 Add `carta search` command

**Problem observed:** AI agents must read MANIFEST.md into context and do their own text matching to find relevant docs. This works but is wasteful — MANIFEST.md is ~150 lines in tinyForum and growing.

**Suggestion:** Add `carta search [--tag TAG] [--status STATUS] [--ref REF] [--text QUERY]` that filters docs and returns matching refs with summaries. Output format should be machine-readable (one ref per line, or JSON).

This gives agents a cheaper alternative to reading the full MANIFEST for targeted lookups.

### 2.4 Add spec-code reconciliation hooks

**Problem observed:** tinyForum's concept specs describe state and actions, and the code in `packages/concepts/src/` implements them. These can drift — a concept spec might say `rename(identity, newName)` but the code function might be called `updateName`. Currently, drift is caught manually or when an agent reads both and notices the mismatch.

**Suggestion:** Define a convention for linking specs to code locations. For example, a `code` frontmatter field:

```yaml
---
title: Identity
code: [packages/concepts/src/identity.ts]
---
```

Then `carta validate --reconcile` could check that:
- Named actions in the spec have corresponding exported functions in the code file
- State types in the spec roughly match TypeScript type definitions

This doesn't need to be perfect — even a "these files are linked" pointer helps agents know where to look. Full semantic reconciliation is a harder problem (noted as out-of-scope in `doc01.06.01`), but pointer-level linking is cheap and immediately useful.

### 2.5 Support structured sections in docs

**Problem observed:** Concept specs have a consistent internal structure (Purpose, State, Actions, OP), but carta treats all document content as opaque markdown. The CLI has no awareness of sections within docs.

**Suggestion:** Allow optional `sections` in frontmatter that declare expected section headings:

```yaml
---
title: Post
sections: [Purpose, State, Actions, Operational Principle]
---
```

`carta validate` can then check that these sections exist in the document body. This is lightweight — no parsing of section content, just checking that `## Purpose`, `## State`, etc. appear.

This enables the `ai-skill` output to include section-level metadata, helping agents navigate within large docs.

### 2.6 Add a pipeline/traceability view

**Problem observed:** tinyForum's adding-concepts pipeline (`doc02.04.05`) describes how concepts flow from spec to code. But there's no way to see, at a glance, which concepts have reached which pipeline stage.

**Suggestion:** Support an optional `pipeline` field in frontmatter:

```yaml
---
title: Identity
pipeline: { spec: doc02.03.06, code: packages/concepts/src/identity.ts, contract: true, server: true, client: false }
---
```

Or simpler — just let users add custom frontmatter fields and have `carta ai-skill` include them in its output. The key insight is that traceability across the pipeline is what makes tinyForum's workflow succeed, and carta could make it a first-class feature.

### 2.7 Improve the `ai-skill` output for agent consumption

**Problem observed:** The `ai-skill` command generates a semantic reference, but it doesn't include enough context for an agent to know *how* to use the workspace — only *what's in it*.

**Suggestion:** Include in `ai-skill` output:
- The doc templates available (if 2.2 is implemented)
- A "common workflows" section derived from the docs-development skill
- Tag frequency (which tags are most used → which areas are most developed)
- Docs with `status: draft` (these are the active work areas)

### 2.8 Add workspace health metrics to `regenerate` output

**Problem observed:** After `carta regenerate`, the only output is "Wrote MANIFEST.md". There's no feedback on workspace health.

**Suggestion:** After regeneration, print a brief summary:

```
Wrote MANIFEST.md (34 docs, 8 groups)
  active: 12 | draft: 20 | deprecated: 2
  2 docs missing summary
  1 broken ref: doc02.03.10 in doc02.04.05
```

This gives immediate feedback without requiring a separate `validate` command.

### 2.9 Support doc-level change detection for CI

**Problem observed:** When a PR changes a concept spec, all downstream docs (screens, patterns, contract) should be reviewed. The deps graph in MANIFEST captures these relationships, but there's no tooling to surface "these docs changed, check their dependents."

**Suggestion:** Add `carta affected [--since REF]` that:
1. Finds docs changed since a git ref
2. Walks the reverse-deps graph
3. Outputs all potentially affected docs

This is useful for PR review bots and CI pipelines. Output format: list of doc refs with reason ("changed directly" vs "depends on doc02.03.06 which changed").

### 2.10 Let `rename` rewrite refs by default

**Current behavior:** `carta rename` changes the file/directory slug on disk but does NOT rewrite cross-references. Users must manually run `carta rewrite`.

**Problem:** This is a footgun. If you rename `03-post.md` to `03-contribution.md`, all `docXX.YY` refs still work (they use numbers, not slugs). But if `rename` also changes position numbers, refs break silently.

**Suggestion:** Make `rename` rewrite refs by default (it already doesn't change numbers, so this may be moot — but document the behavior clearly). If `rename` ever gains a `--reposition` flag, ref rewriting should be automatic.

---

## Summary: The Pattern That Works

The tinyForum workflow succeeds because of a tight loop:

1. **Think** — conversational design session using docs-development skill
2. **Specify** — concept specs in carta with Jackson's structure
3. **Plan** — pipeline doc tells agents exactly what to implement
4. **Execute** — headless agents read specs + patterns, produce code
5. **Unfold** — when forces demand new concepts, return to step 1

Carta enables steps 2-4. The suggestions above aim to tighten the loop by reducing friction (templates, validation), improving traceability (pipeline view, reconciliation), and making the workspace more agent-friendly (search, structured sections, health metrics).

The biggest single improvement would be **concept templates** (2.2) combined with **validation** (2.1). These two features would make carta a concept-design tool, not just a documentation tool — and that's where the real value is.
