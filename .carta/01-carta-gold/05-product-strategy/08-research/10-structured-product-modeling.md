---
title: Structured Product Modeling
status: exploring
summary: The set of formal structures needed to fully describe a business product — entity models, decision tables, state machines, and six more — plus how they compose
tags: [product-modeling, decision-tables, state-machines, entities, enumerations, constraints, spec-driven]
deps: [doc01.05.08.09, doc01.05.06.04, doc01.05.04.01]
---

# Structured Product Modeling

What structures does a product designer need to fully describe a business — thoroughly enough that an engineer or AI can build it — without writing prose?

Prose specs are ambiguous. Code is too detailed. The middle ground is a set of **formal but lightweight structures**, each capturing one aspect of the product. This doc enumerates the structures, what each captures, how they compose, and which are essential vs domain-specific.

## The Structures

### 1. Entity Model

**What it captures:** What things exist in the business and what properties they have.

**Example:** Employee (name, SSN, exempt status, hire date, hourly rate).

**Editor metaphor:** Form builder — add fields, set types, add validations.

**Field properties:**
- Name, type (text, number, date, bool, enum, reference)
- Required / optional, with optional conditional requirement (`required-when: { exempt-status: non-exempt }`)
- Validation: format patterns, range constraints, cross-field rules (`termination-date > hire-date`)
- Enum fields reference shared enumeration structures (structure #3)
- Annotations: sensitive (determines encryption/masking), product-level metadata

**Storage:** JSON or YAML.

### 2. Relationships

**What it captures:** How entities connect to each other — cardinality, optionality, and referential constraints.

**Example:** An employer has many employees. An employee has one paycheck per pay period. A paycheck has many deduction line items.

**Editor metaphor:** ER diagram or adjacency list — connect entities, set cardinality (1:1, 1:N, M:N), set optionality.

**Storage:** JSON or YAML, or visual on the canvas.

### 3. Enumerations / Taxonomy

**What it captures:** Controlled vocabularies shared across entities and decision tables. Flat — no hierarchy. If hierarchical taxonomies are needed, that's a separate structure.

**Example:** Employee types: full-time, part-time, contractor, seasonal. (If contractor has subtypes, those are a separate enumeration — e.g., Contractor Subtypes: 1099-independent, 1099-agency.)

**Editor metaphor:** Flat list editor with optional ordinal ordering.

**Storage:** YAML. These are resource files referenced by entity fields and decision table columns.

### 4. Decision Table

**What it captures:** Stateless branching logic — given a set of inputs, what output is produced?

**Example:** Overtime rules, tax brackets, pricing tiers, eligibility criteria.

**Properties:** Typed input/output columns (bool, enum, number, text). Hit policy (unique, first, collect, collect+sum, etc.). Implicit product set collation shows coverage gaps.

**Editor metaphor:** Spreadsheet with typed columns.

**Storage:** JSON, with markdown export for AI consumption. See doc01.05.06.04.

### 5. State Machine

**What it captures:** Stateful lifecycles — what states exist, what transitions between them, under what conditions?

**Example:** Order lifecycle (pending → paid → shipped → delivered → archived). Account status (active → suspended → terminated).

**Properties:** States, transitions with guards (predicates) and effects (what changes). Hierarchical states (Harel statecharts — "active" contains "free tier" and "paid tier"). Parallel regions.

**Editor metaphor:** Node-and-edge editor (the canvas).

**Storage:** JSON or Yjs.

### 6. Process Flow

**What it captures:** Ordered sequences of steps with conditions and branching. "First verify identity, then create account, then send welcome email."

A state machine can model this but it's overkill for a linear sequence. A process flow is a simpler structure — an ordered list of steps where some steps branch or loop.

**Example:** Employee onboarding: collect personal info → verify SSN → set up payroll → assign benefits → send welcome packet.

**Editor metaphor:** Ordered step list with branching, or a flowchart.

**Storage:** JSON, with Mermaid export for visualization.

### 7. Schedule / Time Rule

**What it captures:** Temporal rules — when things happen, recurrence patterns, deadline derivation.

**Example:** Payroll runs biweekly on Friday. Withholding deadline is 3 business days before pay date. Tax deposits are due by the 15th of the following month.

**Editor metaphor:** Recurrence editor + deadline formula.

**Storage:** YAML.

### 8. Constraint / Invariant

**What it captures:** Cross-cutting rules that must always be true, spanning multiple entities or structures.

**Example:** An employee's termination date must be after their hire date. A paycheck's gross pay must equal the sum of its line items. No two employees can have the same SSN within an employer.

These don't belong to any single entity or table — they're assertions over the entire model. Single-entity constraints can live inline on the entity (field validations). Cross-entity constraints need their own structure.

**Editor metaphor:** Assertion editor — predicate over entities.

**Storage:** YAML or Datalog rules.

### 9. Rate Table / Lookup

**What it captures:** Reference data that changes on a schedule, keyed by date and often by jurisdiction.

**Example:** Federal tax brackets for 2026 married filing jointly: 10% up to $23,200, 12% up to $94,300... State-specific minimum wages. Benefits contribution limits.

Structurally similar to a decision table, but distinguished by: it's versioned (2025 vs 2026 brackets), it's externally sourced (IRS publishes it), and it changes on a known schedule.

**Editor metaphor:** Versioned decision table keyed by date/jurisdiction.

**Storage:** JSON, with markdown export.

### 10. Data Flow

**What it captures:** How data moves between processes, data stores, and external entities. Distinct from process flow — a DFD shows data movement, not control flow (no decisions, no loops, no ordering).

**Example:** Payroll system: Employee Records (store) → Calculate Payroll (process) → Paycheck Records (store) → Create Transactions (process) → Bank API (external entity).

**Editor metaphor:** Node-and-edge diagram with three node shapes: processes (rounded), data stores (open rectangle), external entities (square). Directed edges labeled with the data that flows.

**Storage:** YAML.

**Lineage:** Yourdon/DeMarco DFD notation (1970s). BPMN incorporates a similar concept via data objects, but DFDs are simpler and single-purpose.

## Essential vs Domain-Specific

**Essential (can't describe a business without these):**
1. Entity model — what things exist
2. Relationships — how they connect
3. Enumerations — the controlled vocabularies
4. Decision table — the branching rules
5. State machine — the lifecycles

**Important (hit quickly in any real business):**
6. Process flow — the sequences
7. Data flow — what data moves where
8. Constraints — the invariants

**Domain-specific (payroll, finance, compliance, logistics):**
9. Schedules — temporal rules
10. Rate tables — versioned lookups

## How They Compose

The structures reference each other through typed edges:

```
Enumerations ← referenced by → Entity fields, Decision table columns
Entities ← connected by → Relationships
Entities ← have lifecycles described by → State machines
State machine transitions ← use → Decision tables (for guard logic)
Process flows ← sequence → State machine transitions
Data flows ← show data moving between → Processes, Entities (as data stores), External entities
Constraints ← assert over → Entities, Relationships
Rate tables ← feed → Decision tables
```

This mirrors the `implements` / `depends-on` / `relates-to` reference system from the spec ladder (doc01.05.08.06). Each structure type is a node kind; references between them are typed edges. The full product model is a graph of these structures.

## Two Computational Patterns

The structures divide into two computational patterns (from the Datalog/pipeline discussion):

**Pattern 1 — Relational (Datalog):** "Who can access what, given what conditions?" Entities, relationships, enumerations, constraints, state machine reachability. Declarative, monotone, queryable. Datalog handles this naturally.

**Pattern 2 — Transformational (Pipeline):** "Given these inputs, what sequence of calculations produces the output?" Decision tables, process flows, data flows, rate table lookups. Compositional, ordered, branching. A pipeline/flowchart engine handles this.

A real business needs both: Datalog selects and configures (what applies?), the pipeline executes (what's the result?).

## Mathematical Grounding

| Structure | Math | Why |
|---|---|---|
| Entity model | Set theory, relational algebra | Entities are rows in relations |
| Relationships | Graph theory, relational algebra | Edges with cardinality constraints |
| Enumerations | Finite sets, optionally totally ordered | Value domains |
| Decision table | Boolean algebra, propositional logic | Truth table = decision table |
| State machine | Automata theory | DFA/NFA, Mealy/Moore machines |
| Process flow | Partial orders, DAGs | Steps with dependency ordering |
| Data flow | Directed graphs, Petri nets | Data movement between processes and stores |
| Schedule | Temporal logic, calendar arithmetic | Recurrence relations |
| Constraint | First-order logic, Datalog | Predicates over the model |
| Rate table | Piecewise functions, versioned lookup | Step functions keyed by thresholds |
| Composition of the above | Category theory (Fong Ch. 2, 4) | Composing open systems via decorated cospans |
