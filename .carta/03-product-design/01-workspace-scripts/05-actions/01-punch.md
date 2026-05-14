---
title: punch — Expand a leaf into a directory
summary: "Action spec for carta punch: convert NN-slug.md into NN-slug/00-index.md, moving bundle siblings with it"
tags: [action-catalog, punch, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# punch

Expand a leaf `.md` file into a directory by converting `NN-slug.md` to `NN-slug/00-index.md`. Attachments sharing the target's prefix travel with it. Doc refs do not change.

## Intent

`punch` is used when a leaf doc outgrows itself and needs children. It is the inverse of `flatten` over a single leaf. Because the doc ref is preserved (the directory inherits the original prefix), existing cross-references survive the transformation without rewriting.

## Why a design spec, not just prose

The machine-readable spec for this command — guards, effects, error modes, invariants preserved, properties — lives in the sidecar `01-punch.yaml`. That YAML is authoritative at design time: the implementation in `carta_cli/commands/transform.py` and the property tests in `tests/properties/test_punch.py` both import it. When the behavior of `punch` changes, the sidecar changes first; code and tests follow mechanically.

## See also

- Sidecar `01-punch.yaml` — the action-catalog row (guards/effects/errors/properties).
- doc03.01.02 — Workspace invariants.
- doc03.01.03 — Property catalog.
- doc03.01.04 — Error catalog.
