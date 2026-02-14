---
title: Research Sessions
status: active
---

# Research Sessions

Design exploration records from AI-assisted development sessions. These capture research findings, design reasoning, and the "why behind the why" for features that emerge from modeling Carta with Carta.

## What belongs here

- **Design exercises** that explore "how would Carta need to change to support X?"
- **External research** synthesized from specifications, academic papers, and standards
- **Trade-off analysis** where multiple approaches were considered and the reasoning was worth preserving
- **Cross-cutting explorations** that touch multiple layers (presentation, domain, schema model)

## What does NOT belong here

- **Decisions already made** — those go in ADRs (doc02.04)
- **Feature specifications** — those go in doc03.01
- **Implementation plans** — those go in `todo-tasks/`

## Relationship to other docs

Research sessions often *precede* ADRs and feature specs. A session might explore a design space, leading to:
- A `todo-tasks/` plan for implementation
- An ADR (doc02.04) once a decision crystallizes
- A feature spec (doc03.01) once the feature ships

Sessions reference the docs they drew on and the artifacts they produced. They are not updated after the fact — they are point-in-time records of exploration.

## Session format

Each session file captures:
1. **The question** — what design problem was being explored
2. **Research** — external sources, codebase analysis, prior art
3. **Analysis** — trade-offs, options considered, principles applied
4. **Outcome** — what artifacts were produced (todo-tasks, ADRs, etc.)
