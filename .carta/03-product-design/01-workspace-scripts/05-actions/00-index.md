---
title: Actions
summary: Action catalog — one doc per Carta Docs API command, each with a machine-readable YAML sidecar
tags: [action-catalog, docs-api, specs]
deps: [doc03.01.02, doc03.01.03, doc03.01.04]
---

# Actions

The action catalog. One command per entry. Each entry is a bundle: a prose `.md` doc explaining intent plus a `.yaml` sidecar carrying the machine-readable row (guards, effects, error modes, invariants preserved, properties).

## Entry shape

Each command doc is structured identically:

- **Prose (.md)** — human-readable orientation: what the command does, why it exists, how it fits with other commands.
- **Sidecar (.yaml)** — authoritative at design time. Defines:
  - `inputs` — CLI arguments and their types
  - `guards` — preconditions with their check expressions and mapped error IDs (`G-<CMD>-<N>`)
  - `effects` — state transformations (`E-<CMD>-<N>`)
  - `invariants_preserved` — which `INV-*` the command maintains across its mutation
  - `error_modes` — the `ERR-*` codes this command can raise
  - `properties` — action-local `PROP-<CMD>-*` statements

## Reading order

Start with doc03.01.02 (invariants), doc03.01.03 (properties), doc03.01.04 (errors) for the shared vocabulary. Then read any command spec — the vocabulary makes the sidecar's correlation columns legible.

## Contents

This group grows as commands are specified. Numbering is stable; new commands append. See `MANIFEST.md` for the current entries.
