---
title: Vision
status: draft
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
