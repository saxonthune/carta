---
title: Conventions
status: active
---

# Conventions

## Cross-Reference Syntax

Use `docXX.YY` to reference another document. Every segment is two digits:

- `doc01.03` — title 01 (context), item 03 (glossary)
- `doc03.01.02.01` — title 03 (product), subdir 01 (features), subdir 02 (output), item 01 (compilation)
- `doc02.04.01` — title 02 (system), subdir 04 (decisions), item 01

Two digits per segment, unlimited depth. Nesting can go as deep as the directory structure requires — `doc03.01.01.03.02.01` is perfectly valid if the file tree warrants it. Each segment maps to a numbered directory or file. If a directory exceeds 99 items, split it into subdirectories rather than widening the numbering.

The regex pattern `doc\d{2}(\.\d{2})*` matches all references and is grep-friendly:

```bash
grep -rn "doc03\.01" .carta/
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

**epoch** (optional): Used for staleness auditing. See doc00.04.

## File Naming

Files use numbered prefixes with kebab-case slugs:

```
NN-slug.md
```

Examples: `01-mission.md`, `03-glossary.md`, `01-yjs-state.md`.

Directories follow the same pattern: `00-codex/`, `01-context/`, `02-system/`.

Numbers determine ordering. Leave gaps when useful — you can add `02-something.md` between `01` and `03` later.

## Index Files

Each title directory may contain a `00-index.md` that provides an overview and table of contents for that title. Not required for small titles.

## Writing Style

- **One concept per file.** If a file covers two distinct things, split it.
- **Reference, don't repeat.** If a concept has a canonical doc, link to it with `docXX.YY` instead of re-explaining.
- **Describe behavior, not implementation.** Feature docs should be clear enough to write a test from. Architecture docs should explain structure, not paste code.
- **Use the glossary.** Domain terms defined in doc01.03 should be used consistently. Don't invent synonyms.
