---
title: regenerate — Rebuild MANIFEST.md from frontmatter
summary: "Action spec for carta regenerate: recompute MANIFEST.md from current workspace state"
tags: [action-catalog, regenerate, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# regenerate

Rebuild `MANIFEST.md` entirely from current frontmatter across all workspace docs. No file moves, no ref rewrites. `regenerate` is pure: it is the function whose fixpoint defines INV-4 (MANIFEST derivability).

## Intent

`regenerate` is the oracle for INV-4 and the cleanup step after any batch of structural operations run with `--no-regen`. It is also the safest diagnostic: running it is non-destructive (mod the MANIFEST file itself) and reveals orphan attachments on stderr.

## Why a design spec, not just prose

The sidecar `10-regenerate.yaml` pins down the functional contract: `MANIFEST.md` after regenerate equals the deterministic projection of the frontmatter-bearing tree. Every structural command's invariant preservation leans on this.

## See also

- Sidecar `10-regenerate.yaml`.
- doc03.01.02 — Workspace invariants (INV-4 especially).
