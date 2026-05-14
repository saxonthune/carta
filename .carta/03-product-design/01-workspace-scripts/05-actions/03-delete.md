---
title: delete — Remove entries with gap-closing
summary: "Action spec for carta delete: remove files or directories, renumber siblings, rewrite refs, and report orphaned refs"
tags: [action-catalog, delete, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# delete

Delete one or more entries. Bundle attachments go with the root. Siblings gap-close, cross-references rewrite to the new numbering. Surviving refs to the deleted ref are reported as orphans (but not auto-removed — user decides).

## Intent

`delete` is destructive by necessity. Unlike `move`, it has no inverse — the deleted content is gone. The orphan report is the user's safety net: after delete, any lingering ref to the removed doc is surfaced so the user can fix it by hand or with a follow-up `rewrite`.

## Why a design spec, not just prose

The machine-readable spec lives in the sidecar `03-delete.yaml`. Orphan-ref reporting is part of the contract and is exercised by property tests.

## See also

- Sidecar `03-delete.yaml` — the action-catalog row.
- doc03.01.02 — Workspace invariants.
- doc03.01.03 — Property catalog.
- doc03.01.04 — Error catalog.
