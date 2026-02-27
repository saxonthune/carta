---
title: Compilation
status: active
---

# Compilation

Compilation transforms a single canvas into a context-window-friendly presentation — stripping coordinates, visual-only data, and other information not useful to AI agents, while preserving semantic structure and relationships.

## Scope

The unit of compilation is a **single canvas file**. Each `.canvas.json` compiles independently. Workspace-level compilation (aggregating multiple canvases into a single output) is a higher-level operation that composes per-canvas transforms — it is not the compiler's core responsibility.

## Process

1. Read the canvas: nodes, edges, organizers
2. Filter out visual-only data (coordinates, sizes, UI state)
3. Add organizers section for AI context (visual grouping information)
4. List construct schemas referenced by this canvas's nodes
5. Resolve relationships: build bidirectional reference maps using semantic IDs
6. Group constructs by schema type
7. Format each construct using its schema's compilation configuration
8. Produce structured output

## Output Structure

The compiler outputs three main sections:

- **Organizers section**: Lists visual groupings (name, layout strategy, member list). Included for AI context but not semantic — organizers have no ports and represent spatial organization only.
- **Schema definitions**: Construct schemas referenced by this canvas, with field definitions, port configurations, and semantic descriptions
- **Constructs section**: Constructs grouped by schema type
  - **Type sections**: Constructs grouped by their schema type
  - **Relationship metadata**: Each construct includes `references` (outgoing) and `referencedBy` (incoming) arrays using semantic IDs

## Compiler Architecture

The compiler is a pure function that receives a canvas's nodes, edges, and schemas as explicit parameters — no global state. It lives in the `@carta/document` package (under `src/compiler/`). Format-specific output is handled by formatters (currently JSON only, extensible).

## User Interface

- Compile button in the header
- CompileModal shows output in a monospace view
- Copy to clipboard and download as .txt file
