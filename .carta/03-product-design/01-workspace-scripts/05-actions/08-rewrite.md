---
title: rewrite — Rewrite doc refs by explicit mapping
summary: "Action spec for carta rewrite: apply old=new ref rewrites across the workspace"
tags: [action-catalog, rewrite, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# rewrite

Rewrite doc refs across the workspace using explicit `old=new` mappings. No file moves, no MANIFEST regen — just text substitution over refs in `.md` files and `externalRefPaths`.

## Intent

`rewrite` is the manual escape hatch when automatic ref rewriting (during `move`/`delete`) is insufficient — for example, after a filesystem-only restructure, or to correct stale refs in external docs. It is also useful for batched ref renames.

## Why a design spec, not just prose

The sidecar `08-rewrite.yaml` notes the invariant risk: rewrite can violate INV-5 (ref resolvability) if the `new` side doesn't resolve. This is the user's responsibility.

## See also

- Sidecar `08-rewrite.yaml`.
- doc03.01.02 — Workspace invariants.
