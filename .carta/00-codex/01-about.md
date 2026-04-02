---
title: About This Workspace
status: active
summary: Why this workspace exists, two-sources-of-truth theory, how to read
tags: [docs, meta, theory]
deps: []
---

# About This Workspace

This is the `.carta/` workspace for Carta — the spec-driven development standard and its visual editor. It contains structured specifications that bridge the gap between what we want to build and what the code actually does.

## Two Sources of Truth

Every software project has exactly two sources of truth:

1. **Source code** — the concrete reality. It determines what happens when users interact with the product. Without any other frame of reference, there is no such thing as a bug.

2. **Product expectations** — the unstated assumptions and aspirations of everyone who touches the product. They shift as fast as markets do; they are as dynamic as the human societies they reflect. Whereas source code is completely real, product expectations are completely unreal, waiting to be realized.

Together, the two sources form opposite poles: potential and actual. A software team's sole purpose is to **reconcile this misfit** — modifying source code to better realize the product, or adjusting expectations to match reality.

## Why Specs

Traditional SDLC processes create artifacts (PRDs, Figma mocks, Jira tickets) in a hierarchical procession where each layer introduces noise. By the time engineers write code, the product signal is significantly diluted.

AI shifts the documentation-code equilibrium. Extensive, structured specs are now viable because AI can help maintain them. Instead of a pipeline that dilutes signal, **spec groups** bridge the two sources directly, and AI helps reconcile specs derived from expectations against specs derived from code.

This workspace organizes specs into groups. See doc00.05 for Carta's specific group taxonomy.

## Growing a Workspace

A `.carta/` workspace starts almost empty — just the codex. That's intentional. Groups and docs appear when you need them:

- You clarify what you're building → create a purpose doc
- You design your first feature → create a product design group
- You make an architecture decision → create an architecture group
- You set up CI → create an operations group

Each addition should be the simplest doc that captures what you just decided. It will deepen through the development loop (doc00.02) as the work demands.

## How to Read

**New to the project?** Start with `01-product-strategy/` — mission, principles, and glossary.

**Want to know what Carta does?** Browse `01-product-strategy/06-products/` — documentation system, canvas, workspace scripts.

**Need to understand internals?** Read `03-architecture/` — system architecture, canvas subsystem, and design decisions.

## Cross-References

Documents reference each other using `doc` syntax: `docXX.YY.ZZ` where each segment is a two-digit number mapping to the directory/file numbering. For example, `doc01.05.06.02` refers to title 01 (product-strategy), subdir 06 (products), item 02 (canvas).

See doc00.03 for full conventions.

## One Canonical Location

Every concept has exactly one canonical document. Other documents reference it rather than re-explaining. If you're tempted to describe something that already has a doc, link to it instead.
