---
title: Rough to Refined
status: active
---

# Rough to Refined

The overall journey from initial sketch to structured, compilable architecture. Carta should feel like Excalidraw when you're starting to plan — minimal friction, fast placement, no schema overhead — then progressively layer in structure as the model matures.

## Rough Sketch Phase

Start with generic, low-friction constructs. Drop boxes on the canvas, label them, draw connections. Don't worry about schema types, field definitions, or port semantics. The goal is to externalize thinking — get ideas out of your head and onto the canvas.

- Use sketching schemas (simple box, group, note) that require zero configuration
- Connections are generic flow relationships
- No compilation pressure — the model is for human consumption

## Shaping Phase

As patterns emerge, start replacing generic constructs with typed schemas. Group related constructs. Introduce domain-specific ports. The model transitions from "rough boxes and arrows" to "typed components with relationships."

- Retype constructs from sketching schemas to domain schemas
- Add fields that capture important attributes
- Replace generic connections with typed port connections
- Organize into levels if multiple concerns emerge

## Refinement Phase

Tighten the model for compilation. Ensure all constructs have meaningful field values. Verify port connections are semantically correct. Assign deployables. The model is now structured enough for AI consumption.

- Fill in field values
- Assign deployables for grouping
- Compile and review output
- Iterate on schema definitions if compilation reveals gaps

## Key Principle

The tool should never force you into the refinement phase prematurely. A rough sketch is a valid artifact. Structure is added incrementally as the user's understanding grows — not imposed by the tool upfront.
