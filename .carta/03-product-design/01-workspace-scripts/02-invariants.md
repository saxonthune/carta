---
title: Workspace Invariants
summary: Invariants that every valid .carta/ workspace must satisfy at rest — functions of state, oracles for property tests
tags: [invariants, workspace, properties, specs]
deps: []
---

# Workspace Invariants

Every invariant is a pure function `Workspace → bool` (or `→ list[Violation]`). They are the oracles every structural command must preserve and the basis for property tests.

## Catalog

| ID | Invariant | Statement |
|---|---|---|
| INV-1 | Ref uniqueness | For every `docXX.YY[.ZZ]` ref, at most one doc in the workspace resolves to it. |
| INV-2 | Prefix uniqueness per directory | Within any directory, no two entries share the same two-digit `NN` prefix. |
| INV-3 | Bundle coherence | Every attachment with prefix `NN` in a directory has a corresponding `NN-*.md` root in the same directory. Orphans trigger warnings but do not break this invariant; they surface violations. |
| INV-4 | MANIFEST derivability | `MANIFEST.md` equals the output of `regenerate(tree)`. Manual edits that diverge from frontmatter are violations. |
| INV-5 | Ref resolvability | Every `docXX.YY[.ZZ]` occurrence in any doc body or frontmatter `deps` resolves to an existing doc. |
| INV-6 | Directory index convention | Every directory that holds numbered children contains a `00-index.md`. |

## Contract with commands

Each command in the action catalog declares `invariants_preserved: [INV-*, ...]`. Correctness of that declaration is what the global stateful property test (doc03.01.03 — PROP-GLOBAL-*) verifies.

Invariants are written as executable functions in `carta_cli/invariants.py` (naming: `inv_1_ref_uniqueness`, etc.). They are reusable by:

- Command implementation — enforcement on mutation
- Validators (`carta doctor` — future) — user-invoked audit
- Test suite — post-condition assertions

## Orphan vs violation

A workspace may legally contain orphan attachments (INV-3 warns but the carta CLI does not block). An orphan is a **soft violation**: current code treats it as a warning, not an error. The action catalog records which commands are permitted to introduce orphans (none, currently) and which surface them (`regenerate`).
