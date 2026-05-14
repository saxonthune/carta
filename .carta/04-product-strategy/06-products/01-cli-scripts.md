---
title: Carta Docs API
summary: Deterministic Python operations on .carta/ workspace documents — designed primarily for AI agents
tags: [docs-api, workspace, tools, scripts, ai]
deps: [doc04.05]
---

# Carta Docs API

The Carta Docs API is a set of deterministic Python operations for manipulating `.carta/` workspace documents. It is designed primarily for AI agents — providing reliable, scriptable workspace mutations that agents can call without ambiguity.

## Operations

The full command catalog — guards, effects, invariants preserved, error modes — lives in doc03.01 (Carta Docs API — Design). All structural operations maintain cross-reference integrity and treat **bundles** (root doc + same-prefix sidecars) as units.

## Delivery

The API is delivered two ways:

- **`pip install carta-cli`** — Installed CLI (`carta create`, `carta move`, etc.)
- **`carta portable`** — Dumps raw, editable Python scripts into `.carta/` so the workspace carries its own tooling with no external installation

Both invoke the same `commands.py` implementation. The portable form is the default for new workspaces — it embodies the right-to-repair principle (doc04.01).

## Scope Boundary

The Docs API operates on workspace structure — files, directories, numbering, frontmatter, and cross-references. Spec-code reconciliation (doc04.07) is a separate concern that may *use* the Docs API but is not part of it.
