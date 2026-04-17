---
title: Attachment
status: draft
summary: Non-md artifacts that inherit a host doc's structural position through prefix co-location
tags: [concepts, jackson, attachment, bundles, sidecars]
deps: []
---

# Attachment

**Purpose**: Let non-md artifacts inherit a host doc's structural position so that diagrams, data files, and other supporting assets travel with their spec through every workspace operation — without frontmatter or explicit declaration.

**State**: Filesystem adjacency. An attachment is any file in the same directory as a doc root (`NN-<slug>.md`) that shares the doc's numeric prefix (`NN`). Membership is positional, not declared.

**Actions**:
- `attach` — place a non-md file alongside its host doc, giving it the host's `NN` prefix.
- implicit travel — `move`, `delete`, `rename`, `punch`, `flatten` operate on the bundle (root + all same-prefix siblings) as a unit.

**Operational principle**: If I attach an artifact to doc X, then when X moves, the artifact moves; when X is deleted, the artifact is deleted; when X is renamed, the artifact is renamed. The attachment follows its host through every structural operation without requiring further instruction.

**Out of scope**: Content interpretation, kind declarations, and reconciliation-level awareness of attachment types belong to the reconciliation layer (doc01.03.07), not to this concept.
