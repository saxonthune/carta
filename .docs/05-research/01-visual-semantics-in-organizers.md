---
title: Visual Semantics in Organizers
status: active
date: 2026-02-08
tags: presentation, rendering, organizers, bpmn, notation, dual-mandate
---

# Visual Semantics in Organizers

> **Question**: How can Carta improve the visual clarity of constructs inside organizers — conveying sequence, category, and subtype — without hardcoding notation-specific visual sugar?

## Context

While modeling the Carta dev workflow as a BPMN-style process (Dev Workflow page in the Carta-describes-Carta document), we observed that all Activity nodes look identical. The only way to determine sequence order is to trace edges. An expert glancing at a BPMN diagram expects to *see* flow order from spatial arrangement and shape variation. This is a general problem — not specific to BPMN — that affects any sequential flow modeled in organizers.

Related work already in progress: directional auto-layout algorithms that respect port polarity (see `todo-tasks/`).

## Research: BPMN 2.0 Visual Encoding

Source: [OMG BPMN 2.0 Specification](http://www.omg.org/spec/BPMN/2.0/), [Visual Paradigm notation overview](https://www.visual-paradigm.com/guide/bpmn/bpmn-notation-overview/)

BPMN uses four visual variables to differentiate elements:

| Visual Variable | What It Encodes | Example |
|---|---|---|
| **Shape** (circle / rounded-rect / diamond) | Element category (event / activity / gateway) | Circle = event |
| **Border weight** (thin / thick / double) | Lifecycle position (start / end / subprocess) | Thick circle = end event |
| **Internal marker** (icon inside shape) | Subtype | Envelope = message event, X = exclusive gateway |
| **Fill** (hollow vs filled marker) | Direction (catching vs throwing) | Filled envelope = throwing message |

Key insight: BPMN's shape system works because the three core shapes (circle, rounded-rect, diamond) occupy distinct perceptual categories. The internal markers are where BPMN gets cognitively overloaded.

## Research: Moody's "Physics of Notations"

Source: [Moody, "The Physics of Notations," IEEE TSE 2009](https://ieeexplore.ieee.org/document/5353439/)

Nine principles for cognitively effective visual notations. Most relevant to this design:

| Principle | Definition | Implication for Carta |
|---|---|---|
| **Semiotic Clarity** | 1:1 mapping between symbols and semantic constructs | Each schema type should have a visually distinct rendering |
| **Perceptual Discriminability** | Symbols should be easy to tell apart | Shape differentiation > marker differentiation > color-only |
| **Dual Coding** | Use both text and graphics for the same information | Visual shape encodes `constructType`; text labels encode identity |
| **Semantic Transparency** | Symbols should suggest their meaning | Circles for events (cyclical), diamonds for decisions (branching) |
| **Cognitive Fit** | Notation adapts to audience/task | Schema authors choose renderStyle; users don't configure it |
| **Graphic Economy** | Manageable number of distinct symbols | Small set of renderStyles; markers via existing enum fields |

The [cognitive effectiveness analysis of BPMN 2.0](https://www.researchgate.net/publication/221055397_Analysing_the_Cognitive_Effectiveness_of_the_BPMN_20_Visual_Notation) found that BPMN violates several principles — notably symbol overload (too many markers on the same circle shape) and perceptual discriminability (markers too small at normal zoom). This validates our instinct NOT to replicate BPMN's full marker system.

## Analysis: Three Mechanisms

### 1. Schema-driven `renderStyle` variants

**What**: Add new `renderStyle` values (`'circle'`, `'diamond'`, `'document'`) to the presentation model dispatch table. Each maps to a new React component in the `(renderStyle, LOD band) → Component` table.

**Why it works for the dual mandate**: The AI reads `constructType: "bpmn-event"` — it doesn't need the circle. The human sees the circle and instantly knows "event." The visual shape is a redundant encoding of the type (Moody's **Dual Coding** principle). No new semantic concept needed.

**Why it's not BPMN-specific**: A `'circle'` renderStyle works for state machines (states), network topology (hosts), entity-relationship (entities), system context diagrams (actors). The shape is general-purpose; the schema gives it meaning.

**Scope**: Presentation layer only. New variant components added to the dispatch table. Schema model gains new valid values for existing `renderStyle` field.

### 2. Computed sequence badges (topology-derived ordinals)

**What**: When an organizer uses a directional layout strategy, the presentation model computes topological order from the `flow-out → flow-in` edge chain and renders a small ordinal badge (1, 2, 3...) on each node.

**Key design decisions**:
- Derived from existing semantic data (edges), not a new field
- Only shown when directional layout is active (not in freeform)
- Presentation-layer computation — no schema or domain changes
- Handles branching: nodes after a gateway get the same ordinal (parallel) or branched ordinals (exclusive)

**Why it works**: Visual order = semantic order. They can't get out of sync because the badge IS the topology.

**Scope**: Presentation layer + layout engine. No schema model changes.

### 3. Enum-driven markers (`enumIconField` / `enumIconMap`)

**What**: New optional schema properties that map enum field values to visual markers (text symbols, emoji, or icon identifiers) rendered as overlays on the node.

Example:
```
enumIconField: "gatewayType"
enumIconMap: {
  "Exclusive (XOR)": "×",
  "Parallel (AND)": "+",
  "Inclusive (OR)": "○"
}
```

**Why it's general-purpose**: Works for any enum field on any schema — BPMN gateway types, deployment status indicators, priority markers, cloud provider badges. The schema author defines the mapping; the presentation layer renders it.

**Why it works for the dual mandate**: The AI reads the field value; the human sees the icon. Same data, two encodings (Dual Coding).

**Scope**: Schema model (new optional properties) + presentation layer (overlay rendering).

## Outcome

Three `todo-tasks/` plans created:
- `render-style-variants.md` — Shape differentiation via new renderStyle values
- `computed-sequence-badges.md` — Topology-derived ordinal badges in directional layouts
- `enum-icon-markers.md` — Schema-driven icon markers from enum field values

## References

- [OMG BPMN 2.0 Specification](http://www.omg.org/spec/BPMN/2.0/)
- [BPMN Notation Overview — Visual Paradigm](https://www.visual-paradigm.com/guide/bpmn/bpmn-notation-overview/)
- [Moody, "The Physics of Notations" — IEEE TSE 2009](https://ieeexplore.ieee.org/document/5353439/)
- [Analysing the Cognitive Effectiveness of BPMN 2.0 — ResearchGate](https://www.researchgate.net/publication/221055397_Analysing_the_Cognitive_Effectiveness_of_the_BPMN_20_Visual_Notation)
- Carta docs: doc02.09 (presentation model), doc02.07 (design system), doc02.06 (metamodel), doc01.02 (principles)
