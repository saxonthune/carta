---
title: Rhidoc Docs API
summary: Deterministic Python operations on .rhidoc/ workspace documents — designed primarily for AI agents
tags: [docs-api, workspace, tools, scripts, ai]
deps: [doc03.05]
---

# Rhidoc Docs API

The Rhidoc Docs API is a set of deterministic Python operations for manipulating `.rhidoc/` workspace documents. It is designed primarily for AI agents — providing reliable, scriptable workspace mutations that agents can call without ambiguity.

## Operations

The full command catalog — guards, effects, invariants preserved, error modes — lives in doc02.01 (Rhidoc Docs API — Design). All structural operations maintain cross-reference integrity and treat **bundles** (root doc + same-prefix sidecars) as units.

## Delivery

The API is delivered two ways:

- **`pip install rhidoc`** — Installed CLI (`rhidoc make`, `rhidoc move`, etc.)
- **`rhidoc portable`** — Dumps raw, editable Python scripts into `.rhidoc/` so the workspace carries its own tooling with no external installation

Both invoke the same `commands.py` implementation. The portable form is the default for new workspaces — it embodies the right-to-repair principle (doc03.01).

## Scope Boundary

The Docs API operates on workspace structure — files, directories, numbering, frontmatter, and cross-references. Spec-code reconciliation (doc03.07) is a separate concern that may *use* the Docs API but is not part of it.
