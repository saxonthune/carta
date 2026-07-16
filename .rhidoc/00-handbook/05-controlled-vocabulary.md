---
title: Controlled Vocabulary
summary: The workspace glossary as a controlled vocabulary — entry kinds and sentence patterns from fact-based modeling (ORM), a worked example, and the naming rule
tags: [glossary, vocabulary, facts, subtypes, naming, docs]
deps: []
---

# Controlled Vocabulary

The workspace glossary is a controlled vocabulary: one term per concept, one concept per term. Docs use the glossary's terms exactly and introduce no domain terms of their own.

Entries follow the verbalization patterns of fact-based modeling (Object-Role Modeling — Halpin; standardized by OMG as SBVR; the same one-concept-one-term discipline as ISO 704). A verbalized fact is a subject–verb–object sentence a domain expert can affirm or reject. One entry kind, Unnamed, is our extension and is marked as such.

## Entry Kinds

| Kind | Source construct (ORM) | Pattern |
|---|---|---|
| Term | Object type | `**Name** — ⟨purpose⟩.` |
| Fact | Fact type reading | `⟨Term⟩ ⟨verb phrase⟩ ⟨Term⟩ ⟨…⟩.` |
| Subtype | Subtype definition | `Each ⟨Subtype⟩ is a ⟨Term⟩ that ⟨condition⟩.` |
| Partition | Exclusive + exhaustive constraint | `Every ⟨Term⟩ is exactly one of: ⟨A⟩, ⟨B⟩.` |
| Derivation | Derived fact type | `⟨name⟩ := ⟨rule over stated facts⟩.` |
| Unnamed | — (extension) | `*(unnamed)* — ⟨description⟩. Candidates: ⟨a⟩, ⟨b⟩.` |

- A Term's purpose is one line saying what the term is for — the part a reader cannot recover from the word itself. It is not a definition.
- A Fact states a direction. Write only load-bearing facts and cardinalities; a fact may bind more than two roles. A `predicate(role, role)` shadow may follow a fact that tooling should lint or query.
- A Subtype's membership condition is the that-clause. Add a Partition line only when the subtypes are genuinely exclusive and exhaustive.
- A Derivation states the rule; the value is computed at read time. Never write the computed value into a doc — it drifts.
- An Unnamed entry is complete as written: a described concept with no confirmed name. Only the user turns a candidate into a Term.
- A Term may carry an anti-term line — `Not: "x", "y".` — when a wrong synonym has appeared or is predictably tempting. Do not list speculative bans.

Placement: a Fact rides under the Term that owns its first role; Subtype and Partition lines ride under the parent Term; a Fact with no single owner may stand alone.

## Worked Example

```markdown
## Orders

- **Order** — a customer's committed request; the unit that fulfillment,
  billing, and reporting all hang off.
  - A Customer places an Order. `places(customer, order)`
  - An Order holds one or more Line Items.
  - Each draft Order is an Order not yet committed by its customer.
  - Each placed Order is an Order committed by its customer.
  - Every Order is exactly one of: draft, placed.
  - Not: "purchase", "request", "ticket".

- **Shipment** — the physical act of fulfilling; kept separate from Order
  so partial fulfillment stays sayable.
  - A Shipment fulfills part or all of one Order. `fulfills(shipment, order)`

- backlog := count of Orders that are placed and not fulfilled.
  Computed at read time; a written-down backlog number drifts.

- *(unnamed)* — placed Orders the customer can still cancel without a fee.
  Recurs in refund prose; needs a term before it fans out.
  Candidates: cancellation window, open Order.
```

## Using the Vocabulary

A conforming doc repeats the exact term. Varying the word for style is the defect, not the repetition.

| ✗ | ✓ |
|---|---|
| When a buyer submits a purchase, the warehouse dispatches the request. | When a Customer places an Order, a Shipment fulfills it. |

- Domain nouns and verbs come from the glossary; every other word is plain English carrying no domain weight.
- A concept the glossary does not name is described in plain words and added as an Unnamed entry — never named in passing.

## Naming

Names carry the highest cost of change: every doc, type, and identifier inherits them. The user decides names. When work reaches a concept the glossary does not name, add an Unnamed entry with the description and candidate names, and surface the decision. A good candidate is distinct from every existing Term and specific enough to stand alone out of context.
