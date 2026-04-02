---
title: Structures
summary: The product design structures and their visual editors — from doc01.05.08.10 editor metaphors to real tools
tags: [project, product-modeling, editors, structures]
deps: [doc01.05.08.10, doc01.01.01.01, doc01.01.01.02]
---

# Structures

The structured product modeling types from doc01.05.08.10 (plus additions from this project), viewed as product design tools to build. Each structure gets a visual editor. Structures compose — an entity field references an enumeration, a state machine transition uses a decision table for guard logic.

## Build order

Priority balances ease of implementation with value to product designers. Phase 1 structures are form/list/grid editors — no canvas engine needed. Phase 2 structures require node-and-edge canvas primitives.

### Phase 1 — form-based editors

1. **Enumerations** — flat list editor. Simplest structure. Referenced by entity fields and decision table columns. See doc01.01.01.03.01.
2. **Entity model** — form builder. Add fields, set types, add validations. Can't describe a business without entities.
3. **Decision table** — spreadsheet with typed columns and hit policies. See doc01.05.06.04. Highest value for nontechnical users — "show me the rules."

### Phase 2 — canvas-based editors

4. **Relationships (ER diagram)** — connect entities, set cardinality and optionality. Nodes with internal structure (fields), edges with cardinality labels.
5. **State machine** — node-and-edge editor for lifecycles. States as nodes, transitions as edges with guards.
6. **Process flow** — ordered step list with branching, or flowchart. Click-edge-to-insert interaction. See doc01.01.01.03.02.
7. **Data flow** — processes, data stores, external entities, and the data flowing between them. Distinct from process flow: DFDs show data movement, not control flow. Canvas-based (nodes and directed edges).

### Later

8. **Constraints** — assertion editor over entities.
9. **Schedule / time rule** — recurrence editor plus deadline formula.
10. **Rate table** — versioned decision table keyed by date/jurisdiction.
