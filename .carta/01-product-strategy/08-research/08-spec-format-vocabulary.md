---
title: Spec Format Vocabulary
status: exploring
summary: What parts of the spec format Carta has opinions on vs what's up to users — format concerns vs user concerns
tags: [specs, vocabulary, format, agnosticism, workspace, principles]
deps: [doc01.05, doc01.02, doc01.08, doc01.08.06]
---

# Spec Format Vocabulary

Carta needs a vocabulary for talking about specs that distinguishes between what the format defines (opinionated) and what users decide (open). This matters because the web platform (doc02.01) serves nontechnical users who need to understand what they can change without breaking things — and because AI agents need to know when they're following format rules vs making suggestions.

## The Two Domains

The `.carta/` workspace format has **format concerns** — things Carta has opinions on, that tooling enforces — and **user concerns** — things the format is deliberately silent about, where users (and their AI agents) make all decisions.

This is not just about *arrangement* (how specs are grouped into directories). It's a whole set of topics: arrangement, typing, granularity, abstraction level, prose style, dependency topology, and more. The principle (doc01.02, "Spec Agnosticism") is that the format provides structural machinery and stays out of everything else.

## Format Concerns (Carta-Opinionated)

Things the format spec defines and tooling enforces. Breaking these breaks the workspace.

### Atomic Unit

The **spec file** is the atomic unit — a single markdown file with YAML frontmatter. A spec file is the smallest thing that can be created, moved, cross-referenced, or deleted. You can't cross-reference a section within a file; you can only reference the file itself.

### Frontmatter Schema

Every spec file has a YAML frontmatter block. The format defines which fields exist and their types:

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `title` | yes | string | Display name |
| `status` | yes | string | Free-form (see User Concerns) |
| `summary` | yes | string | One-line, used in MANIFEST |
| `tags` | yes | string[] | Keywords for retrieval |
| `deps` | no | string[] | Doc refs to check on change |

The format defines the *schema* — the fields and their types. It does not define what values are appropriate. There is no `type` field — the format has no concept of spec kind or abstraction level.

### Cross-Reference Syntax

The `docXX.YY.ZZ` syntax and the ref-rewriting behavior on structural changes. This is a format-level invariant — users use the syntax, tooling maintains it.

### Structural Operations

The set of operations that modify workspace structure — create, delete, move, punch, flatten, regenerate. These are format-level because they maintain invariants (numbering, gap-closing, ref-rewriting). Users invoke them; bypassing them breaks the format.

### Numbering Scheme

Directories use `NN-slug/` naming. Files within directories are numbered. Gaps are closed automatically on delete. This is format-level — the tooling owns numbering.

### MANIFEST.md

Auto-generated from frontmatter. The generation algorithm and output format are fixed. Users don't edit it directly.

## User Concerns (Carta-Agnostic)

Things the format is deliberately silent about. The tooling supports these but never enforces, suggests, or judges them.

### Partition Strategy

How specs are grouped into directories. The format provides titles (numbered directories) but doesn't say what should be a title. Is `01-product/` a good top-level title? The format doesn't care. Should research be separate from features? User's call.

### Spec Typing

Whether specs have a "kind" (entity, process, service, shape, research, etc.) and how that's tracked. The format provides no `type` field. Users can add custom frontmatter fields, use tags, use directory structure, or use nothing at all. The `/carta-spec-builder` skill has a "spec ladder" concept — this is a skill convention, not a format requirement. It may formalize later, but for now it's user-level.

### Abstraction Level

Whether a spec is high-level research or low-level code shapes. The format doesn't know. A workspace with all specs at the same abstraction level is just as valid as one with a strict ladder.

### Granularity

How much goes in one spec file vs when to punch it into a directory with children. The format supports both — a single-file spec and a punched directory are structurally equivalent. The decision of when to punch is the user's.

### Frontmatter Values

The format defines which fields exist, but not what goes in them. Tags, summaries, deps, status values — the format validates types but not semantics. "Is this the right tag?" is a user concern.

### Status Vocabulary

The format requires a `status` field (string) but doesn't define a vocabulary. `draft`, `active`, `deprecated`, `implemented`, `exploring`, `resolved` — these are all conventions. Different teams may use different values.

### Cross-Reference Topology

Which specs reference which other specs via deps. The format maintains the references, but doesn't say what the dependency graph should look like. A flat graph, a deep tree, a dense mesh — all valid.

### Prose Style and Content

What goes in the markdown body. The format doesn't prescribe sections, headings, or structure within a spec file. Some specs are three lines of prose; some have formal sections with typed properties. Both are valid.

## Boundary Items

Some mechanisms are format-level but their *content* is user-level:

| Mechanism | Format owns | User owns |
|-----------|-------------|-----------|
| `_group.json` | File existence, JSON schema | What metadata to put in it |
| `_defaults.yaml` | Mechanism (default frontmatter for a directory) | What defaults to set |
| `workspace.json` | File existence, required fields | Title, description, custom metadata |
| Tags | Field type (string array) | Tag vocabulary, conventions |

## Init

`carta init` creates the bare minimum: `workspace.json`, `MANIFEST.md`, `00-codex/00-index.md`. This is format-level scaffolding — the minimum valid workspace. No templates, no pre-created directories, no seed files beyond the codex.

All arrangement decisions come from the user or their AI agent after init. In the web platform's conversational flow (doc03.04), the agent can scaffold the workspace interactively — "What's this project about? Let me set up a workspace for you." This keeps arrangement decisions in the user's session rather than baked into the CLI.

## Why This Matters

1. **Tooling boundaries**: Format concerns get enforced by tooling (CLI, server, validation scripts). User concerns get supported but never enforced.
2. **AI agent behavior**: Skills like `/carta-spec-builder` make user-concern suggestions. It should be clear when the agent is following format rules vs making an arrangement/typing/granularity suggestion.
3. **Web platform UX**: Nontechnical users need to know "the system requires this" (format) vs "this is how your team organized things" (user).
4. **Interoperability**: Two `.carta/` workspaces with radically different arrangements, typing systems, and prose styles should both be valid — only format violations break things.

## Open Questions

1. Should the format grow a `type` field in the future, or should spec typing always be a user concern? What would have to be true for typing to become a format concern?
2. Are there format concerns we're missing — things the tooling should enforce but currently doesn't?
