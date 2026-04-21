---
title: Unfolding as Software Development
summary: Embryonic development applied to software — start with a working end-to-end system, let forces cross thresholds before adding complexity, preserve structure at every step
tags: [unfolding, methodology, alexander, forces, structure-preserving, ai, development]
deps: [doc01.03.01, doc01.03.04.01, doc01.03.04.02]
role: primary-source
---

# Unfolding as Software Development

Unfolding is Christopher Alexander's term for how living structures grow. Applied to software: **start with the simplest possible living system, and let complexity emerge only when forces demand it.** Each change should be a structure-preserving transformation — the system after the change should feel like a natural growth of the system before it.

This is not a metaphor. It is a concrete development methodology, validated by building real applications end-to-end with AI agents.

## The Four Rules

### 1. Start with hello world — and mean it

The first commit is a working system. Not a skeleton with TODO comments. Not a boilerplate with twelve config files. A system that does one thing, end to end — from user action to system response. This is the embryo. Every future change grows from this.

### 2. Let forces cross thresholds before adding complexity

Don't add authentication because you "will need it." Add it when a user story actually requires distinguishing between people. Don't add a database because "real apps have databases." Add it when in-memory state can no longer hold. Don't add infrastructure-as-code because "we'll deploy eventually." Add it when you're actually deploying.

**A change in quantity begets a change in quality.** Three actions can share a single handler file. Thirty cannot. The force — the quantity — tells you when the structure must change. This is the timing discipline: the force must be present and observable, not hypothetical.

### 3. Structure-preserving transformations only

When complexity is added, it must feel like a natural outgrowth. Auth wraps the existing request flow — it doesn't replace it. A database replaces the storage layer beneath existing action handlers — it doesn't change how actions work. The system's shape is preserved; a new center develops within it.

If a change requires rewriting everything that came before, something has gone wrong. Either the change was premature (the force hadn't actually crossed its threshold) or the prior structure was too rigid (it was designed for a specific future rather than being responsive to forces).

### 4. Everything must remain refactorable

Every artifact — specs, contracts, APIs, UI flows, infrastructure — must be changeable. If a part of the system resists change, it becomes a dead structure that the rest of the system must work around. REST APIs backed by SQL tables, in large organizations, often become exactly this: immovable structures that require massive investment to keep from collapsing, while simultaneously preventing the system from growing.

Action-based APIs, concept-driven design, and spec-driven development all serve this goal: keeping the system alive and responsive to forces.

## Why This Matters for AI-Powered Development

AI agents are structure translators (doc01.03.04.01 — The Carta Experiment). They work best when each transformation is small and well-defined. Unfolding produces exactly this: a sequence of small, structure-preserving transformations where each step has clear inputs (the current system + the force that crossed its threshold) and clear outputs (the system with one new center of complexity).

Contrast with big-bang development: "here is a complete spec, generate the whole system." The AI has no intermediate checkpoints, no way to verify that subsystems work before composing them, and no way to recover from a wrong assumption in the spec. Unfolding gives AI the same advantage it gives human developers — the ability to build on what works.

## Connection to Carta's Docs System

doc00.02 (Maintenance — unfolding philosophy) already applies these principles to documentation: "docs differentiate over time, like embryonic development." The rules above generalize the same principles to the full development process — code, infrastructure, and architecture, not just docs.
