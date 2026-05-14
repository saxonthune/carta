---
title: flatten — Dissolve a directory into its parent
summary: "Action spec for carta flatten: hoist a directory's children into the parent and renumber"
tags: [action-catalog, flatten, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# flatten

Dissolve a numbered directory by hoisting its children into the parent, renumbering siblings in the parent, and rewriting all refs. `flatten` is the inverse of `punch` over a group whose only meaningful content is its children.

## Intent

`flatten` is used when a directory no longer pulls its weight — its children are few enough, or the grouping no longer clarifies anything. The parent absorbs them. The directory's `00-index.md` is discarded by default (kept with `--keep-index`).

## Why a design spec, not just prose

The sidecar `05-flatten.yaml` captures the machinery: guards, renumbering effects, ref rewrites, and the inverse relationship with `punch`.

## See also

- Sidecar `05-flatten.yaml`.
- doc03.01.02 — Workspace invariants.
- doc03.01.03 — Property catalog.
- doc03.01.04 — Error catalog.
- `01-punch.md` — the inverse operation.
