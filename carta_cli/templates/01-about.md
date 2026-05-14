---
title: About This Workspace
summary: Why this workspace exists, how to read it, two-sources-of-truth theory
tags: [docs, meta, theory]
deps: []
---

# About This Workspace

This is the `.carta/` workspace for **{{title}}**. It contains structured specifications that bridge the gap between what the artifact intends to be and what the code actually does.

## Two Sources of Truth

Every software project has exactly two sources of truth:

1. **Source code** — the concrete reality. It determines what happens when users interact with the product. Without any other frame of reference, there is no such thing as a bug.

2. **Docs** — the team's declarative intent. Docs describe what the artifact is for and what it does, in present tense. They are explicit and structured, not implicit assumptions or aspirations.

Together, the two sources form opposite poles: intent and reality. Reconciliation is the mechanism for catching drift — Carta surfaces the gap between intent (docs) and reality (code), and the human decides which side moved.

## Why Specs

Traditional SDLC processes create artifacts (PRDs, Figma mocks, Jira tickets) in a hierarchical procession where each layer introduces noise. By the time engineers write code, the product signal is significantly diluted.

AI shifts the documentation-code equilibrium. Extensive, structured specs are now viable because AI can help maintain them. Instead of a pipeline that dilutes signal, **spec groups** bridge the two sources directly, and AI helps reconcile specs derived from intent against specs derived from code.

This workspace organizes specs into groups. The number and names of groups are up to you — they should reflect the natural abstraction levels of your project and the different audiences who read them.

## Growing a Workspace

This workspace starts almost empty — just the codex. That's intentional. Groups and docs appear when you need them:

- You clarify what you're building → create a purpose doc
- You design your first feature → create a product group
- You make an architecture decision → create a system group
- You set up CI → create an operations group

Each addition should be the simplest doc that captures what you just decided. It deepens through the development loop (doc00.02) as the work demands.

## How to Read

- `MANIFEST.md` is the machine-readable index — AI agents start there to find anything
- Documents use `docXX.YY.ZZ` cross-references (e.g., `doc01.02` = second doc in first group)
- YAML frontmatter on every doc provides title, summary, tags, and dependency refs

## One Canonical Location

Every concept has exactly one canonical document. Other documents reference it rather than re-explaining. If you're tempted to describe something that already has a doc, link to it with `docXX.YY` instead.
