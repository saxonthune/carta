# Add State Machine Sidecars to Carta Docs

## Motivation

Carta's docs describe lifecycles and transitions in prose (e.g., the todo-task directory-as-state-machine, the bundle lifecycle through move/punch/flatten, the reconciliation loop between spec and code). Formal state machine diagrams would make these more maintainable: they'd catch contradictions between prose and behavior, serve as oracles for testing, and give AI agents a structured artifact to reason about instead of paragraphs.

The bundle/attachment concept (doc02.02.01) is the natural proving ground — attachments are defined precisely as "non-md sidecars that travel with a host doc through structural operations," which is itself a state machine over filesystem operations.

This task is **discovery-stage**: a separate session will identify which docs benefit most from a state machine sidecar, what format to use (Mermaid? PlantUML? a custom YAML the reconciliation scripts can parse?), and how the sidecars integrate with the existing bundle mechanism.

## Description

Identify Carta docs where a state machine sidecar would meaningfully improve maintainability. For each candidate, note:

- What states and transitions the prose currently describes
- Whether the transitions are already expressible as formal guards (see doc01.03.08.07 — Product as Transition System)
- What format the sidecar should take given Carta's "symmetric storage" and "inverse derivability" principles (doc01.03.02)

The deliverable from the discovery session is a ranked list of candidate docs + a recommended sidecar format, not the sidecars themselves. Implementation is a follow-up task.

## Scope

- Survey `.carta/` for docs that describe lifecycles, transitions, or state-dependent behavior
- Cross-reference with doc01.03.08.07 (transition-systems) and doc01.03.08.08 (structured product modeling) — these already argue that state machines are one of the nine formal structures for describing a product
- Evaluate candidate formats (Mermaid, PlantUML, YAML/JSON transition tables) against Carta's principles
- Produce a ranked candidate list with rationale

## Out of Scope

- Actually writing any state machine sidecars
- Extending `carta attach` or other CLI commands to handle state machines specially
- Integrating state machines into the reconciliation pipeline

## Notes

- Related: doc02.02.01 (Attachment concept) — attachments are the mechanism; this task explores one compelling use case for them
- Related: sidecar discoverability work in the current session (`carta tree` showing attachments, etc.) — once that lands, state machine sidecars become first-class visible artifacts
- The "goal is to identify resources that make carta development more maintainable" framing suggests this is broader than just state machines — the discovery session should stay open to other sidecar types (decision tables, entity diagrams) that doc01.03.08.08 enumerates
