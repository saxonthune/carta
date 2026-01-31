---
title: Compilation
status: active
---

# Compilation

Compilation transforms the visual canvas state into AI-readable structured output.

## Process

1. Collect all nodes and edges from the active document
2. Exclude virtual parent nodes
3. Group constructs by deployable, then by schema type
4. Resolve relationships: build bidirectional reference maps using semantic IDs
5. Format each construct using its schema's compilation configuration
6. Produce structured JSON output

## Output Structure

- **Deployables section**: Lists all logical groupings with descriptions
- **Schema definitions**: All construct schemas used in the document, with field definitions, port configurations, and semantic descriptions
- **Deployment sections**: Constructs grouped by deployable assignment
- **Type sections**: Within each deployment, constructs grouped by type
- **Relationship metadata**: Each construct includes `references` (outgoing) and `referencedBy` (incoming) arrays using semantic IDs

## Compiler Architecture

The compiler is a pure function that receives schemas and deployables as explicit parameters — no global state. It lives in `@carta/compiler` package. Format-specific output is handled by formatters (currently JSON only, extensible).

## User Interface

- Compile button in the header
- CompileModal shows output in a monospace view
- Copy to clipboard and download as .txt file
