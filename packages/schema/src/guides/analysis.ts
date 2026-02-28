/**
 * Analysis Guide - How to find flaws and make helpful suggestions
 *
 * This guide teaches AI agents how to analyze Carta documents for
 * structural issues, completeness gaps, and code generation readiness.
 */

export const ANALYSIS_GUIDE = `# Carta Analysis Guide

## Overview

This guide helps you analyze Carta documents for structural issues, completeness gaps, and code generation readiness. The goal is to help users create well-structured architecture designs that can be translated into working code.

## Workflow

1. **Start with \`carta_compile\`** — Get the complete AI-readable representation
2. **Read schemas via \`carta_schema op:list\`** — Understand what construct types exist in THIS canvas
3. **Use \`semanticDescription\` fields** — Understand what things mean in this specific domain

## Generic Structural Checks

**Orphan constructs:** Nodes with no connections at all. May indicate forgotten work or copy-paste artifacts.

**Missing parents:** Constructs whose schema defines a \`child\` port but have no parent connection. Check the compiled output for constructs with \`child\` ports but no matching parent connections.

**Empty required fields:** Fields with no values. Look through construct field values — empty strings or null values in important fields suggest incomplete modeling.

**Schemas with no instances:** Defined construct types that are never used. Compare the schema list with the construct list to find unused types.

**Disconnected clusters:** Groups of constructs with no cross-connections. May indicate incomplete integration between system components.

**Placeholders:** Look for "TODO", "TBD", or empty strings in field values — these indicate incomplete work.

## Code Generation Readiness

Check whether the compiled output has enough detail for an LLM to generate code:

**Look for \`semanticDescription\` coverage:** Schemas and fields without semantic descriptions are harder to interpret. The more descriptions present, the clearer the intent.

**Check connection completeness:** Are the relationships between constructs sufficient to understand data flow and ownership?

**Field value completeness:** Are critical fields populated with actual values, not placeholders?

**Schema usage:** Are all defined schema types actually used, or are there orphan schemas?

## Making Helpful Suggestions

**Be specific, not generic:** Reference actual construct names and field values from the document. Point to evidence from the compiled output.

**Reference related constructs:** When suggesting additions, cite other constructs or connections that imply the missing piece.

**Prioritize by impact:**
1. **Blockers:** Missing connections or fields that prevent understanding the design
2. **Important:** Incomplete schemas or missing semantic descriptions
3. **Nice-to-have:** Naming consistency, visual organization

## Using Compiled Output as a Specification

After running \`carta_compile\`, the output is a structured specification. Here's how to interpret each section for code generation:

**Organizer groupings** → Module or package boundaries. Each organizer represents a logical grouping — map these to directories, packages, or namespaces in your codebase.

**Schema definitions** → Type contracts. Each schema with its fields defines the interface for a category of components. Use field names, types, and semantic descriptions to generate type definitions, interfaces, or class structures.

**Constructs by type** → Instances. Each construct is a concrete component. Field values provide configuration, naming, and behavioral details.

**Relationship metadata** → Dependency graph. The references/referencedBy maps show which components depend on each other. Use these to generate imports, injection, API calls, or event subscriptions.

### Checking Code Consistency

To verify code matches the spec:
1. Compile the canvas
2. For each construct, check: does a corresponding code artifact exist?
3. For each relationship, check: does the code reflect this dependency?
4. For each field value, check: does the code use this configuration?
`;
