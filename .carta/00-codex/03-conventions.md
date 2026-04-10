---
title: Conventions
status: active
summary: docXX.YY syntax, front matter, file naming
tags: [docs, conventions]
deps: []
---

# Conventions

## Cross-Reference Syntax

Use `docXX.YY` to reference another document. Every segment is two digits:

- `doc01.03.08` — title 01 (product), subdir 01 (goals), item 03 (glossary)
- `doc01.01.09` — title 02 (architecture), subdir 04 (canvas), item 02 (metamodel)
- `doc01.02.03.01` — title 02 (architecture), subdir 06 (decisions), item 01

Two digits per segment, unlimited depth. Nesting can go as deep as the directory structure requires — `doc01.03.04.01` is perfectly valid if the file tree warrants it. Each segment maps to a numbered directory or file. If a directory exceeds 99 items, split it into subdirectories rather than widening the numbering.

The regex pattern `doc\d{2}(\.\d{2})*` matches all references and is grep-friendly:

```bash
grep -rn "doc01.03\.01" .carta/
```

## Front Matter

Every document starts with YAML front matter:

```yaml
---
title: Human-readable title
status: active
---
```

**status** values:
- `draft` — work in progress, may be incomplete or inaccurate
- `active` — current and maintained
- `deprecated` — superseded, kept for historical reference

**epoch** (optional): Used for staleness auditing. See doc00.02.

## File Naming

Files use numbered prefixes with kebab-case slugs:

```
NN-slug.md
```

Examples: `01-mission.md`, `03-glossary.md`, `01-yjs-state.md`.

Directories follow the same pattern: `00-codex/`, `01-goals/`, `02-architecture/`.

Numbers determine ordering. Leave gaps when useful — you can add `02-something.md` between `01` and `03` later.

## Index Files

Every title directory should contain a `00-index.md` that orients readers to the section. This is the human entry point — what you read when you open a directory and want to understand what's here and why.

### Required structure

1. **Purpose** — one sentence: what this title covers
2. **Audience** — who reads this and when
3. **What belongs here / what doesn't** — boundary rules to prevent misplacement
4. **Contents** — lightweight list of what's inside (names and one-liners)

### Relationship to MANIFEST.md

MANIFEST.md is the **machine-readable retrieval index** — a flat table with refs, summaries, tags, and dependency links. AI agents read MANIFEST to find documents. It is not meant to be read by humans for orientation.

00-index.md is the **human-readable section guide** — narrative framing that explains organizational logic. When an AI needs to explain a section to a user, it reads the 00-index.

The two serve different readers and should not duplicate each other. MANIFEST tracks every document with retrieval metadata. 00-index explains why the section is organized the way it is.

### Subdirectory indexes

Subdirectories may also have a `00-index.md` when their organizational logic needs explanation (e.g., `04-primary-sources/00-index.md`). This is optional — use when the directory's purpose isn't obvious from its name and contents.

## Writing Style

- **One concept per file.** If a file covers two distinct things, split it.
- **Reference, don't repeat.** If a concept has a canonical doc, link to it with `docXX.YY` instead of re-explaining.
- **Describe behavior, not implementation.** Feature docs should be clear enough to write a test from. Architecture docs should explain structure, not paste code.
- **Use the glossary.** Domain terms defined in doc01.03.08 should be used consistently. Don't invent synonyms.
