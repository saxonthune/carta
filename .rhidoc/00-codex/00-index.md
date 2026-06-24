---
title: Codex
summary: Meta-documentation — how to read, navigate, and maintain this workspace
tags: [index, meta]
deps: []
---

# Codex

This is the `.rhidoc/` workspace for **Rhidoc**. It contains structured specifications that humans and AI agents can read, write, and reconcile against code.

## Reading Docs

- `MANIFEST.md` is the machine-readable index — start there to find anything.
- Documents use `docXX.YY.ZZ` cross-references (e.g., `doc01.02` = second doc in first group).
- YAML frontmatter on every doc provides title, summary, tags, and dependency refs.

## Finding Things Efficiently

Two-phase search keeps reads small: **triage** against `MANIFEST.md` summaries and tags (plus `grep` for terms), then **targeted reads** of only the docs that surfaced. Read foundational docs (codex) before detailed specs. Don't read whole directories speculatively.

Read *part* of a doc instead of the whole file:

```bash
rhidoc mdapi outline <ref>           # section skeleton with addresses
rhidoc mdapi read <ref> --depth 1    # top-level sections + their lede
rhidoc mdapi read <ref> --at 2.3     # one subtree, full depth
```

## Managing Structure

Use the `rhidoc` CLI for structural operations:

```bash
rhidoc make <group> <slug>       # add a doc
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
| doc00.02 | Maintenance | Doc philosophy — signal conversion, declarative intent, banned patterns, growing a doc |
| doc00.03 | Conventions | Cross-reference syntax, frontmatter schema, file naming |
