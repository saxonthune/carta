---
title: Compilation
status: active
---

# Compilation

Compilation transforms the visual canvas state into AI-readable structured output.

## Process

1. Collect all nodes and edges from the active document
2. Filter out visual-only nodes (organizers are excluded from semantic compilation)
3. Add organizers section for AI context (visual grouping information)
4. List all construct schemas used in the document
5. Resolve relationships: build bidirectional reference maps using semantic IDs
6. Group constructs by schema type
7. Format each construct using its schema's compilation configuration
8. Produce structured output

## Output Structure

The compiler outputs three main sections:

- **Organizers section**: Lists visual groupings (name, layout strategy, member list). Included for AI context but not semantic — organizers have no ports and represent spatial organization only.
- **Schema definitions**: All construct schemas used in the document, with field definitions, port configurations, and semantic descriptions
- **Constructs section**: Constructs grouped by schema type
  - **Type sections**: Constructs grouped by their schema type
  - **Relationship metadata**: Each construct includes `references` (outgoing) and `referencedBy` (incoming) arrays using semantic IDs

## Compiler Architecture

The compiler is a pure function that receives schemas and deployables as explicit parameters — no global state. It lives in the `@carta/document` package (under `src/compiler/`). Format-specific output is handled by formatters (currently JSON only, extensible).

## User Interface

- Compile button in the header
- CompileModal shows output in a monospace view
- Copy to clipboard and download as .txt file
