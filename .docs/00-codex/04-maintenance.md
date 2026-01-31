---
title: Maintenance
status: active
---

# Maintenance

## Versioning

Git is the version system. No version numbers in documents.

- File history: `git log --follow .docs/03-product/features/canvas.md`
- Point-in-time snapshots: use git tags (`git tag docs-v1.0`)
- Blame for specific lines: `git blame .docs/02-system/01-overview.md`

## Epochs

Epochs are optional staleness markers. When a major architectural change happens, bump the epoch number in a central location and audit docs that reference the old epoch.

Add `epoch: N` to front matter of any doc you want tracked:

```yaml
---
title: Canvas
status: active
epoch: 1
---
```

Staleness audit:

```bash
grep -rn "epoch: 1" .docs/    # Find docs not yet reviewed for epoch 2
```

Epochs are coarse-grained — bump only on major shifts, not routine changes.

## Adding a Document

1. Identify the correct title by reader intent (see doc00.02)
2. Choose the next available number prefix
3. Add front matter with `status: draft`
4. Write content following conventions (doc00.03)
5. Add cross-references to/from related docs
6. Change status to `active` when reviewed

## Deprecating a Document

1. Set `status: deprecated` in front matter
2. Add a note at the top: "Superseded by docXX.YY"
3. Do not delete — git history is permanent, but grep should still find it
4. Update any docs that reference the deprecated doc

## Adding a Title

Almost never needed. The base titles (00-04) cover universal software documentation needs. If you need a project-specific title, use number 05 or higher and document the rationale in this file or doc00.02.
