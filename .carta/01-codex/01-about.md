---
title: About This Workspace
summary: Why this workspace exists, two-sources-of-truth theory, how to read
tags: [docs, meta, theory]
deps: []
---

# About This Workspace

This is the `.carta/` workspace for Carta — a spec-driven development standard for AI-assisted software development. It contains structured specifications that bridge the gap between what the artifact intends to be and what the code actually does.

## Two Sources of Truth

Every software project has exactly two sources of truth:

1. **Source code** — the concrete reality. It determines what happens when users interact with the product. Without any other frame of reference, there is no such thing as a bug.

2. **Docs** — the team's declarative intent. Docs describe what the artifact is for and what it does, in present tense. They are explicit and structured, not implicit assumptions or aspirations.

Together, the two sources form opposite poles: intent and reality. Reconciliation is the mechanism for catching drift — Carta surfaces the gap between intent (docs) and reality (code), and the human decides which side moved.

## Why Specs

Traditional SDLC processes create artifacts (PRDs, Figma mocks, Jira tickets) in a hierarchical procession where each layer introduces noise. By the time engineers write code, the product signal is significantly diluted.

AI shifts the documentation-code equilibrium. Extensive, structured specs are now viable because AI can help maintain them. Instead of a pipeline that dilutes signal, **spec groups** bridge the two sources directly, and AI helps reconcile specs derived from intent against specs derived from code.

This workspace organizes specs into groups. See doc01.05 for Carta's specific group taxonomy.

## Growing a Workspace

A `.carta/` workspace starts almost empty — just the codex. That's intentional. Groups and docs appear when you need them:

- You clarify what you're building → create a purpose doc
- You design your first feature → create a product design group
- You make an architecture decision → create an architecture group
- You set up CI → create an operations group

Each addition should be the simplest doc that captures what you just decided. It deepens through the development loop (doc01.02) as the work demands.

## How to Read

**New to the project?** Start with the product-strategy title — mission, glossary, and docs system.

**Want to know what Carta does?** Browse the products directory under product-strategy — the Carta Docs API and related offerings.

**Need to understand internals?** Read the architecture title — design patterns and reconciliation architecture.

## Cross-References

Documents reference each other using `doc` syntax: `docXX.YY.ZZ` where each segment is a two-digit number mapping to the directory/file numbering. For example, `doc04.01` refers to title 01, subdir 03 (product strategy), item 01 (mission).

See doc01.03 for full conventions.

## One Canonical Location

Every concept has exactly one canonical document. Other documents reference it rather than re-explaining. If you're tempted to describe something that already has a doc, link to it instead.
