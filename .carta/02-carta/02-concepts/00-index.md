---
title: Concepts
summary: Jackson-style concept inventory for Carta — the domain is software production
tags: [concepts, jackson, design]
deps: [doc02.01]
---

# Concepts

Product concepts for Carta, following Jackson's concept-driven design. Each concept has a purpose, state, actions, and operational principle. The concept domain is **software production** — the subset of concepts a user must interact with to produce living software.

## Implementation

Concepts are implemented as TypeScript modules in `packages/concepts/src/`, one file per concept. Each module exports the concept's state type and action functions.

## Inventory

- **doc02.02.01 — Attachment**: Non-md artifacts that inherit a host doc's structural position through prefix co-location. Purpose: let supporting files (diagrams, data, etc.) travel with their spec through every workspace operation without frontmatter declaration.

## Concepts that don't exist yet (and why)

(to be populated as we identify candidates and defer them)
