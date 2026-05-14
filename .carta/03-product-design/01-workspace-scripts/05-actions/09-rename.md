---
title: rename — Change an entry's slug in place
summary: "Action spec for carta rename: change the slug portion of NN-slug without changing NN or refs"
tags: [action-catalog, rename, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# rename

Rename the slug portion of `NN-slug.md` (or `NN-slug/`) without changing the numeric prefix. Bundle attachments are renamed in lockstep so their slugs match the root. Doc refs are unaffected (refs key on prefix position, not slug).

## Intent

`rename` is for terminology changes that don't affect a doc's position. Because refs encode position, not slug, renames are structurally cheap — just file-system renames plus a MANIFEST refresh.

## Why a design spec, not just prose

The sidecar `09-rename.yaml` formalizes the bundle-rename contract: every attachment's slug must track the root's new slug, or INV-3 bundle coherence would be observed only by prefix and the attachment would become semantically detached.

## See also

- Sidecar `09-rename.yaml`.
- doc03.01.02 — Workspace invariants.
- `08-rewrite.md` — separate command for rewriting doc refs (rename does not).
