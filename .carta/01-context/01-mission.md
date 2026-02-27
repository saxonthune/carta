---
title: Mission
status: active
---

# Mission

Carta is a visual software architecture editor. Users design systems by creating typed nodes (constructs), connecting them through ports, and compiling the result into AI-readable output that drives code generation.

## Core Goal

Professionalize vibe coding. Provide an instrument panel rich enough that users never need to touch source code — the same way compilers let users stay out of assembly. Bridge the gap between high-level architecture design and AI-assisted code generation through a visual interface that produces structured, machine-readable specifications.

## The Dual Mandate

All design decisions must balance two objectives:

1. **Properly bounded modeling capability** — flexible enough for any domain, restrictive enough to prevent muddled models
2. **Semantically sufficient compilation** — state must compile to AI-actionable instructions with enough meaning to generate quality output

When evaluating changes, ask: Does this expand capability without confusion? Does this preserve semantic clarity?

### Properly Bounded Modeling Capability

Carta gives users the ability to model their own domains. Domains can range from software architecture to sentence diagramming to electrical circuitry, and the level of specificity can range from abstract (e.g., User - UI - API - Data Store) to extremely granular (database attribute constraints, assembly instructions chained by execution order).

To facilitate this range, Carta provides M2 primitives and structure through its metamodel. The tooling must have sufficient flexibility and robustness that a user can model any domain at any level of granularity. On the other hand, the tooling must also be restrictive — if it's too permissive, users drown in options and create muddled models.

There is a range of modeling capability whose lower bound is "too restrictive" and upper bound is "not restrictive enough." Carta's modeling capability must fall within this range.

### Semantically Sufficient Compilation

The state of a user's data — models, instances, relationships, metadata — must convert into instructions that an AI agent can interface with. An AI agent should extract meaning from the state and translate it into other forms: textual explanations, working production code, infrastructure definitions.

To meet this requirement, Carta's modeling capability must store sufficient semantic data that:
- Different instances can be differentiated from each other
- Relationships between schema are distinguishable
- Domain intent is preserved through compilation

When a coding agent cannot write high-quality code from compiled output, there are three possible failure points:
1. **Compilation failure**: The conversion from state to AI context lost structure
2. **Insufficient user input**: The user didn't put enough data into their model, but had the capability to do so
3. **Insufficient modeling capability**: Carta didn't provide enough modeling tools, or the metamodel was too complicated to apply effectively

Carta's designs should strive to avoid all failures except case 2 where the user simply needs to add more meaning (and has the capability to do so easily).
