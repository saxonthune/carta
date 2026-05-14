---
title: attach — Attach a non-md sidecar to a doc
summary: "Action spec for carta attach: copy a file into a doc's bundle, sharing the host's NN prefix"
tags: [action-catalog, attach, docs-api, specs, bundles]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# attach

Attach a non-md file to an existing `.md` doc by copying it into the doc's directory with the doc's NN prefix. The file becomes part of the host's bundle — it travels with the host through every future structural op.

## Intent

`attach` is how non-md artifacts enter the workspace as sidecars rather than free-floating files. Attachments are identified by prefix alone (no frontmatter), so `attach` is really a rename-and-copy operation: the real work is picking the right slug and prefix.

## Why a design spec, not just prose

The sidecar `06-attach.yaml` specifies the bundle-invariant (INV-3) contract: after attach, the host's bundle has exactly one more element, and it shares the host's NN.

## See also

- Sidecar `06-attach.yaml`.
- doc03.02.01 — Attachment concept.
- doc03.01.02 — Workspace invariants (INV-3).
