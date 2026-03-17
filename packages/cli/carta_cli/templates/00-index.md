---
title: Codex
status: active
summary: Meta-documentation — how to read this workspace
tags: [index, meta]
deps: []
---

# Codex

This is the `.carta/` workspace for **{{title}}**. It contains structured specifications that humans and AI agents can read, write, and reconcile against code.

## Reading Docs

- Documents use `docXX.YY.ZZ` cross-references (e.g., `doc01.02` = second doc in first group)
- `MANIFEST.md` is the machine-readable index — start there to find anything
- YAML frontmatter on every doc provides title, status, summary, tags, and dependency refs

## Managing Structure

Use the `carta` CLI for structural operations:

```bash
carta create <group> <slug>     # add a doc
carta delete <ref>              # remove with gap-closing
carta move <ref> <dest>         # move/reorder
carta punch <ref>               # expand file into directory
carta flatten <ref>             # dissolve directory
carta regenerate                # rebuild MANIFEST.md
```

Content changes are normal file edits. Run `carta regenerate` if you change frontmatter directly.
