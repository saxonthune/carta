---
title: Conventions
status: active
summary: Cross-reference syntax, frontmatter schema, file naming, writing style
tags: [docs, conventions]
deps: []
---

# Conventions

## Cross-Reference Syntax

Use `docXX.YY` to reference another document. Every segment is two digits:

- `doc01.02` — group 01, item 02
- `doc02.08.01` — group 02, subdir 08, item 01

Two digits per segment, unlimited depth. Nesting can go as deep as the directory structure requires. Each segment maps to a numbered directory or file. If a directory exceeds 99 items, split it into subdirectories rather than widening the numbering.

The regex pattern `doc\d{2}(\.\d{2})*` matches all references and is grep-friendly:

```bash
grep -rn "doc01\.02" {{dir_name}}/
```

## Frontmatter

Every document starts with YAML frontmatter:

```yaml
---
title: Human-readable title
status: active
summary: One-line description for MANIFEST
tags: [keyword1, keyword2]
deps: [doc01.02]
---
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Display name |
| `status` | yes | `active`, `draft`, `deprecated` |
| `summary` | yes | One-line description for MANIFEST retrieval |
| `tags` | yes | Lowercase keywords for search and file-path-to-doc mapping |
| `deps` | no | Doc refs to check when this doc changes |

**epoch** (optional): Used for staleness auditing. See doc00.02.

## File Naming

Files use numbered prefixes with kebab-case slugs:

```
NN-slug.md
```

Examples: `01-mission.md`, `03-glossary.md`, `01-authentication.md`.

Directories follow the same pattern: `00-codex/`, `01-context/`, `02-system/`.

Numbers determine ordering. Leave gaps when useful — you can add `02-something.md` between `01` and `03` later.

## Index Files

Every group directory should contain a `00-index.md` that orients readers to the section:

1. **Purpose** — one sentence: what this group covers
2. **Audience** — who reads this and when
3. **What belongs here / what doesn't** — boundary rules to prevent misplacement
4. **Contents** — lightweight list of what's inside (names and one-liners)

### Relationship to MANIFEST.md

MANIFEST.md is the **machine-readable retrieval index** — a flat table with refs, summaries, tags, and dependency links. AI agents read MANIFEST to find documents.

00-index.md is the **human-readable section guide** — narrative framing that explains organizational logic. The two serve different readers and should not duplicate each other.

## Writing Style

- **One concept per file.** If a file covers two distinct things, split it.
- **Reference, don't repeat.** If a concept has a canonical doc, link to it with `docXX.YY` instead of re-explaining.
- **Describe behavior, not implementation.** Docs should be clear enough to write a test from.
- **Use the glossary.** Domain terms should be used consistently. Don't invent synonyms.
