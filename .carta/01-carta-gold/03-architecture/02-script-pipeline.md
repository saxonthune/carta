---
title: Reconciliation Architecture
status: draft
summary: Architecture considerations for spec-code reconciliation — mechanism-agnostic, research-stage
tags: [reconciliation, architecture, specs, alignment]
deps: [doc01.05.07]
---

# Reconciliation Architecture

Architecture considerations for comparing `.carta/` specifications against source code. This document will evolve as reconciliation moves from research (doc01.05.08.06) into implementation.

## Design Constraints

1. **Mechanism-agnostic**: Carta does not prescribe a specific reconciliation pipeline. The architecture should support multiple approaches — LLM-assisted, static analysis, hybrid — without coupling to any one.

2. **Docs API is separate**: The Carta Docs API (doc01.05.06.01) manages workspace structure. Reconciliation tooling is a distinct concern that may *use* the Docs API but is not part of it.

3. **Specs are the source of truth for intent**: Reconciliation compares specs (intent) against code (reality). The comparison may surface drift in either direction — specs that don't match code, or code that has no corresponding spec.

4. **Format alignment**: Whatever mechanism extracts information from code should produce output comparable to what the workspace format provides — structured data with identifiers, relationships, and typed metadata.

## Open Questions

- What is the right intermediate representation for code-side extraction?
- Should reconciliation be a `carta` subcommand, a separate tool, or an AI agent workflow?
- How do we handle the gap between deterministic extraction (what scripts can do) and semantic comparison (what LLMs can do)?

## References

- doc01.05.07 — Feature description (spec-code reconciliation)
- doc01.05.08.06 — Research session (two-source-of-truth model, data formats, script architecture)
