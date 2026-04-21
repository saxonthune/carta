---
title: Vision
summary: Carta is the transmission mechanism between AI and SDLC — converting AI capability into software through structured specifications
tags: [vision, transmission, ai, sdlc, spec-driven]
deps: []
---

# Vision

## The Transmission Mechanism

Building software requires reconciling two sources of truth: **product expectations** (the unstated assumptions and aspirations of everyone who touches the product) and **source code** (the concrete reality). The challenge of software development is to close the gap between them.

Traditional SDLC methodologies bridge this gap with artifacts — Figma mocks, API docs, PRDs, Jira tickets. But each artifact in the chain introduces noise. By the time engineers write code from tickets, the product signal is significantly diluted.

AI changes the economics. LLMs are structure translators — they understand encodings (prose, JSON, TypeScript, markdown) and can transform between them. AI coding is fast when the source structure is precise, and fails when it isn't (the Pac-Man problem: vague prompts produce vague code). The bottleneck shifts from coding to the rest of the SDLC.

**Carta is the transmission mechanism between AI (the motor) and SDLC (the tool).** Human labor turns the machine; the output is software.

Specifications are the gears. They exist at the precision level AI needs to produce correct transformations — not so vague that AI guesses, not so detailed that you're writing code by hand. Spec groups are gear ratios: each level steps down from abstract product expectations toward concrete code. AI operates at every stage of the chain.

## Carta Gold

Everything built before this doc is **Carta Gold** (doc01). It represents the first iteration of the specification system — workspace format, CLI tools, canvas editor, metamodel. Carta Gold bootstraps Carta: its docs, architecture, and tools are the raw material from which the current system is being rebuilt.

The codex (doc00) predates both — it describes the workspace format itself and remains the foundation.

## Sources

### Author's writings

- **Two Sources of Truth** — Product expectations and source code are the two poles; artifacts bridge them but dilute signal; spec-driven development integrates AI across the full pipeline, not just the last mile.
- **Product and Software** — Software exists only to implement a product. The product gap (the distance between product strategy and source code) is the root of overengineering. Engineers embed implicit design decisions into code; AI bridges the gap by making product documentation economical to maintain.
- **What is AI?** — LLMs are structure translators: they understand encodings and transform between them. Output quality is determined by input precision. The future of software engineering is the art of building and maintaining precise instructions.

### Theoretical foundations

- **Daniel Jackson, *The Essence of Software* (2021)** — Software as a composition of concepts: reusable, purpose-driven design abstractions with purpose, state, actions, and operational principle. Concepts should be freestanding, generic, and composed by synchronizing actions. One concept per purpose, one purpose per concept.
- **Christopher Alexander, *The Nature of Order: The Process of Creating Life* (2002)** — Living structure is created through step-by-step, structure-preserving transformations. Unfolding: start minimal, add complexity only when forces demand it. Each step preserves and extends the wholeness of what exists. The process, not the plan, produces life.
- **Herbert Simon, *The Architecture of Complexity* (1962)** — Complex systems organize hierarchically. Near-decomposable systems evolve faster because stable intermediate forms are preserved. Hierarchic assembly, means-end analysis, economical description through recoding.
- **Claude Shannon, *A Mathematical Theory of Communication* (1948)** — Information is the reduction of uncertainty. Every encoding introduces noise; channel capacity limits fidelity. Signal preservation through a chain of transformations is the design goal.
