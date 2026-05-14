---
title: move — Move or reorder an entry
summary: "Action spec for carta move: relocate a file or directory, renumbering siblings and rewriting refs"
tags: [action-catalog, move, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# move

Move a file or directory to a new parent (or reorder within the same parent), renumbering siblings at both source and destination, and rewriting all cross-references to the new ref.

## Intent

`move` is the primary restructuring operation. It handles three cases: relocate across directories, reorder within a directory (same-parent), and rename-and-relocate in one step (via `--rename`). Bundles travel — attachments sharing the target's prefix move with the root.

## Why a design spec, not just prose

The machine-readable spec — guards, effects, error modes, invariants preserved, properties — lives in the sidecar `02-move.yaml`. The implementation in `carta_cli/commands/structure.py` and the property tests both derive from it.

## See also

- Sidecar `02-move.yaml` — the action-catalog row.
- doc03.01.02 — Workspace invariants.
- doc03.01.03 — Property catalog.
- doc03.01.04 — Error catalog.
