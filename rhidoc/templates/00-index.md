---
title: Codex
summary: Meta-documentation — how to read this workspace
tags: [index, meta]
deps: []
---

# Codex

This is the `.rhidoc/` workspace for **{{title}}**. It contains structured specifications that humans and AI agents can read, write, and reconcile against code.

## Reading Docs

- Documents use `docXX.YY.ZZ` cross-references (e.g., `doc01.02` = second doc in first group)
- `MANIFEST.md` is the machine-readable index — start there to find anything
- YAML frontmatter on every doc provides title, summary, tags, and dependency refs

## Managing Structure

Use the `rhidoc` CLI for structural operations:

```bash
rhidoc create <group> <slug>     # add a doc
rhidoc delete <ref>              # remove with gap-closing
rhidoc move <ref> <dest>         # move/reorder
rhidoc punch <ref>               # expand file into directory
rhidoc hoist <ref>               # dissolve directory
rhidoc regenerate                # rebuild MANIFEST.md
```

Content changes are normal file edits. Run `rhidoc regenerate` if you change frontmatter directly.

## Contents

| Ref | Item | Summary |
|-----|------|---------|
| doc00.01 | About | Why this workspace exists, two-sources-of-truth theory |
| doc00.02 | Maintenance | Doc lifecycle — unfolding philosophy, development loop, versioning |
| doc00.03 | Conventions | Cross-reference syntax, frontmatter schema, file naming |
| doc00.04 | AI Retrieval | How AI agents navigate this workspace efficiently |
