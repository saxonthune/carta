---
title: About This Codex
status: active
summary: How to read docs, cross-reference syntax
tags: [docs, meta]
deps: []
---

# About This Codex

This is the canonical documentation for Carta — the spec-driven development standard and its visual editor. It uses a numbered title system where each title covers one category of knowledge, organized by reader intent.

## How to Read

**New to the project?** Start with `01-product/01-goals/` — mission, principles, and glossary.

**Want to know what Carta does?** Browse `01-product/02-features/` — documentation system, canvas, workspace scripts.

**Need to understand internals?** Read `02-architecture/` — system architecture, canvas subsystem, and design decisions.

## Cross-References

Documents reference each other using `doc` syntax: `docXX.YY.ZZ` where each segment is a two-digit number mapping to the directory/file numbering. For example, `doc01.06.02` refers to title 01 (product), subdir 02 (features), item 04 (canvas).

See doc00.03 for full conventions.

## One Canonical Location

Every concept has exactly one canonical document. Other documents reference it rather than re-explaining. If you're tempted to describe something that already has a doc, link to it instead.
