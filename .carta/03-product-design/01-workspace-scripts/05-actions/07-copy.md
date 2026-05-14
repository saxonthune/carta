---
title: copy — Copy an external file into the workspace
summary: "Action spec for carta copy: bring an outside file in as a numbered entry at a destination"
tags: [action-catalog, copy, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# copy

Copy an external file into the workspace at a numbered position. Unlike `attach`, `copy` places the file as an independent numbered entry (its own slot), not as a sidecar to a host doc.

## Intent

`copy` is the ingest operation for `.md` (or any) files that should become first-class entries. Contrast with `attach`, which binds a file to a host's bundle.

## Why a design spec, not just prose

The sidecar `07-copy.yaml` keeps the boundary with `attach` sharp and lists the narrow guards (no renumber, no ref rewrite — just place and regenerate).

## See also

- Sidecar `07-copy.yaml`.
- `06-attach.md` — attach a non-md as a sidecar instead.
- doc03.01.02 — Workspace invariants.
