---
title: Mission
status: active
summary: Core goal — spec-driven development tool
tags: [mission, principles]
deps: []
---

# Mission

Carta is a standard for spec-driven software development. The primary product is the `.carta/` workspace format — a structured documentation system that AI agents and humans read, write, and reconcile against code. Secondary products include a canvas-based visual editor, a VS Code extension, and a set of reconciliation scripts that keep specs and code in sync.

## Core Goal

Professionalize vibe coding. Provide a specification layer rich enough that AI agents can generate and maintain code from structured documentation — the same way compilers let users stay out of assembly. Bridge the gap between high-level architecture design and AI-assisted code generation through structured, machine-readable specifications.

## Right to Repair

Carta tooling should be transparent, modifiable, and self-contained. Users own their workspace — including the scripts that operate on it. When Carta distributes portable tooling (e.g., `carta init --portable`), it dumps raw, readable source files into the `.carta/` directory rather than opaque archives. Users can read, modify, and extend these scripts to fit their workflow.

The `.carta/` directory is a self-contained portable unit: documentation and the tooling that operates on it travel together. Copy the directory to another repo and it carries its own scripts. This is the core design goal of portable mode — not a side effect, but the entire point. A workspace should be useful without any external installation.

## The Dual Mandate

All design decisions must balance two objectives:

1. **Properly bounded modeling capability** — flexible enough for any domain, restrictive enough to prevent muddled models
2. **Semantically sufficient specifications** — specs must compile to AI-actionable instructions with enough meaning to generate quality output

When evaluating changes, ask: Does this expand capability without confusion? Does this preserve semantic clarity?

### Properly Bounded Modeling Capability

Carta gives users the ability to model their own domains. Domains can range from software architecture to sentence diagramming to electrical circuitry, and the level of specificity can range from abstract (e.g., User - UI - API - Data Store) to extremely granular (database attribute constraints, assembly instructions chained by execution order).

To facilitate this range, Carta provides a hierarchical documentation format with typed frontmatter, cross-references, and manifest indexing. The tooling must have sufficient flexibility and robustness that a user can specify any domain at any level of granularity. On the other hand, the tooling must also be restrictive — if it's too permissive, users drown in options and create muddled specifications.

There is a range of modeling capability whose lower bound is "too restrictive" and upper bound is "not restrictive enough." Carta's modeling capability must fall within this range.

### Semantically Sufficient Specifications

The state of a user's specifications — documents, cross-references, typed frontmatter, canvas diagrams — must convert into instructions that an AI agent can interface with. An AI agent should extract meaning from the specs and translate it into other forms: working production code, infrastructure definitions, test suites.

To meet this requirement, Carta's specification format must store sufficient semantic data that:
- Different components can be differentiated from each other
- Relationships between specifications are distinguishable
- Domain intent is preserved through the spec-to-code pipeline

When a coding agent cannot write high-quality code from specifications, there are three possible failure points:
1. **Reconciliation failure**: The conversion from spec to code context lost structure
2. **Insufficient user input**: The user didn't put enough data into their specs, but had the capability to do so
3. **Insufficient modeling capability**: Carta didn't provide enough specification tools, or the format was too complicated to apply effectively

Carta's designs should strive to avoid all failures except case 2 where the user simply needs to add more meaning (and has the capability to do so easily).
