---
title: create — Create a new numbered doc
summary: "Action spec for carta create: write a new NN-slug.md at a position in a directory, with draft frontmatter"
tags: [action-catalog, create, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# create

Create a new `.md` file at a given position in a directory, with frontmatter drafted from the CLI args. Does not renumber siblings — either appends or inserts at `--order`, bumping only entries at/above that position.

## Intent

`create` is the spawn operation for new docs. It is deliberately narrow: no template expansion, no body scaffolding beyond frontmatter. Anything richer belongs to a separate template command, not here.

## Why a design spec, not just prose

The sidecar `04-create.yaml` is the machine-readable row. The frontmatter shape comes from the inputs directly, so the implementation can validate inputs and emit frontmatter in one pass.

## See also

- Sidecar `04-create.yaml`.
- doc03.01.02 — Workspace invariants.
- doc03.01.03 — Property catalog.
- doc03.01.04 — Error catalog.
