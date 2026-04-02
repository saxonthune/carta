---
title: Decision Table Renderer
status: draft
summary: GUI editor for decision tables — structured data storage, rich table editing, markdown export for AI consumption
tags: [decision-tables, product, editor, rules]
deps: [doc01.05.01]
---

# Decision Table Renderer

A sibling application to the canvas editor, focused on decision tables and flowcharts. Users author rules in a rich table GUI; the system stores structured data and exports AI-readable formats.

## Freeform Mode

The initial mode. The user defines all input and output columns manually. No schema enforcement beyond column types.

### Column Types

Input and output columns can be:

| Type | Cell Values | Example |
|---|---|---|
| **bool** | true / false | "Is exempt" |
| **enum** | One of a defined set | "Employee type: full-time, part-time, contractor" |
| **number** | Numeric value or range expression (`>= 10`, `< 40`, `5-15`) | "Years of service" |
| **text** | Free text | "Notes", "Override reason" |

### Editing

- Add/remove rows and columns via GUI buttons
- Each column is designated as input or output
- Each column has a type (bool, enum, number, text) and a label
- Enum columns define their value set inline (the user types the options)
- Cells are validated against their column type
- Hit policy is set per table (unique, first, collect, etc.)

### Implicit Set Collation

The renderer collates the **implicit product sets** from the table and displays them as lists:

- **Input product set**: The Cartesian product of all input column value sets. For a table with `exempt-status: [exempt, non-exempt]` and `pay-frequency: [weekly, biweekly, semi-monthly]`, the input product set is 6 combinations. The renderer shows this as a list so the user can see which combinations are covered by rules and which are missing.
- **Output product set**: The set of all distinct output value combinations that appear in the rules. For a table with `overtime-multiplier` and `overtime-threshold` as outputs, the renderer lists all unique `(multiplier, threshold)` pairs that rules produce.

This makes gaps visible — if 6 input combinations are possible but only 4 rules exist, the 2 uncovered combinations are shown.

## Storage Format

Decision tables are stored as structured data (JSON or Yjs), not markdown. The GUI manipulates the structured data directly. Markdown is a **derived export** for AI consumption and git diffing — generated on save, committed alongside the source.

## Future Considerations (Not Yet Designed)

- Resource file references: input enum columns could reference shared enum definitions instead of inline values
- Flowchart mode: visual decision flows where nodes are conditions and leaves are outcomes
- Table composition: one table's output feeds another table's input
- Validation: checking completeness (all input combinations covered) and consistency (no contradictory rules for a given hit policy)
