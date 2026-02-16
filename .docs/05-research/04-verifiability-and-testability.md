---
title: Verifiability and Testability
status: active
date: 2026-02-15
tags: testing, verification, epistemology, agents, testability, oracles, properties
---

# Verifiability and Testability

How do we engineer architecture that AI agents can verify? What does it mean for a software feature to be verifiable? These questions matter because Carta uses headless AI agents to implement features from plans — and the only feedback loop is automated verification.

## The Core Question

> What would be true about this feature if it were implemented correctly, stated without reference to the implementation?

If you can answer that, the feature is testable and the test is valuable. If you can't answer it without saying "the function returns the value from line 47," the feature needs a clearer specification before implementation begins.

A feature is verifiable to the degree that we can state, before implementation begins, what "correct" looks like in terms a machine can check. Plans are informal specifications; the question is how far we push them toward formal ones.

## The Verification Spectrum

**Level 0 — Builds and tests pass.** `pnpm build && pnpm test` confirms type-checking and behavioral assertions. Necessary but weak — it only catches what the test author anticipated. The agent can satisfy all tests while implementing something structurally wrong.

**Level 1 — Contract-based verification.** Input/output schemas, success criteria, termination conditions. Plan files with "Do NOT" sections and grep-based postconditions are an informal version of this. The formalized version: every plan defines *preconditions* (what must be true before), *postconditions* (what must be true after), and *invariants* (what must remain true throughout).

**Level 2 — Specification equivalence.** Generate code AND a machine-checkable proof that it satisfies a formal spec. Current LLMs achieve <1% end-to-end success on this (Clever benchmark). Years from being practical for application code.

The sweet spot for agent-verifiable features is Level 1 with property-based postconditions.

## The Epistemic Problem

No framework distinguishes validated knowledge from conjecture. When an agent says "done, tests pass," the plan's design decisions are still conjectures (L0) until empirically validated by a human reviewing actual behavior.

Three epistemic layers apply to design decisions in plans:

- **L0 — Conjecture**: "We think this is right" (unverified hypothesis)
- **L1 — Logically verified**: "This follows from the architecture docs" (consistent with known constraints)
- **L2 — Empirically validated**: "We tested this in a prototype" (observed to work)

The rule: **no aggregation may exceed the weakest link.** Three L0 conjectures don't add up to L1 confidence. Research found ~23% of architectural decisions had stale evidence within two months, with 86% discovered only reactively during incidents.

## What Makes a Test Valuable

### The Test Value Hierarchy

**Tier 1 — Tautological tests (low value).** Assert on the mechanism of the code. "If I mock the database to return X, does the function return X?" These test the language runtime and the mocks. They pass even if the logic is wrong because the answer is wired into the test.

**Tier 2 — Example-based behavioral tests (moderate value).** Concrete inputs and expected outputs. These make a real claim: "given this input, the system produces this output." But they only cover what the author thought of. Unit tests collectively catch more mutations through sheer volume (~85%), but each individual test has narrow reach.

**Tier 3 — Property-based / metamorphic tests (high value).** Assert on *relationships* rather than specific outputs. Round-trip properties (`decode(encode(x)) === x`), invariants (`sorted output length === input length`), metamorphic relations (`sin(pi - x) === sin(x)`). Powerful because they sidestep the oracle problem — you don't need the correct answer, just structural constraints. Each property test finds ~50x more mutations than each example test.

**Tier 4 — Integration tests against real state (highest practical value).** Exercise the actual system through real interfaces. For Carta: create documents, add constructs, connect them, compile, verify output — through Yjs state, not mocks. Expensive, but the only tests that validate subsystem composition.

### The Oracle Problem

Every test is only as good as its oracle — the mechanism that determines what "correct" means.

1. **Exact oracle**: you know the right answer (golden files, trivial cases)
2. **Partial oracle**: you know *properties* of the right answer (sorted, non-empty, round-trips)
3. **Metamorphic oracle**: you know *relationships between outputs* given related inputs
4. **Statistical oracle**: the output distribution matches expectations
5. **No oracle**: you can only check "didn't crash" (smoke tests)

Most AI-generated tests land at level 1 or level 5. The sweet spot for agent-verifiable features is levels 2 and 3.

### What Makes Code Testable

- **Observable outputs** — effects visible in return values or inspectable state, not hidden in side effects
- **Controllable inputs** — preconditions can be set up without elaborate ceremony
- **Decomposable** — subsystems testable independently
- **Deterministic** — same inputs, same outputs (or at least same *properties* of outputs)
- **Has specifiable properties** — invariants, round-trip laws, or metamorphic relations can be stated about it

The last point is the key. A feature is testable to the degree that you can articulate properties about it *before looking at the implementation*.

### Developers Are Bad at Judging Test Effectiveness

Research shows developers are wrong about which testing techniques actually find bugs 50% of the time, with a 31 percentage-point penalty in defect detection when they choose the wrong technique. Developers attribute effectiveness to their own performance rather than the technique's inherent capability. Intuitions about "what's testable" are unreliable — this is why we need explicit frameworks.

## Integration Tests vs E2E Tests

The question "what would be true" splits based on **where the truth lives**.

### Integration: truth lives in the data model

If the property can be stated in terms of state transformations — inputs to the adapter, outputs from the adapter — no browser needed.

Decision rule: can you state the property in terms of `DocumentAdapter` operations and their observable results?

Examples: port polarity validation, schema CRUD, organizer collapse propagation, page isolation, compilation output correctness, undo/redo reversibility, package application. All statable as: given state S, after operation O, property P holds.

### E2E: truth lives in the composition

E2E is warranted when the property cannot be stated without the rendering pipeline, user interaction model, or cross-system composition. Canvas bugs are 35% visual (rendering, layout) and 14% user-interaction — categories that don't exist without a browser.

Examples: drag updates position in document, port handles appear at correct positions, parallel edges bundle visually, first visit creates starter document.

Decision rule: use E2E only when **fidelity** is the dimension you can't sacrifice — when the property is about the composition itself.

### The gray zone: UI logic without the canvas

Some things feel like E2E but aren't. Schema editor field validation, page switcher active state, context menu rendering — these are UI properties testable with React Testing Library against the component tree. Real Yjs document, real hooks, real React tree, no browser. Integration-test speed with near-E2E fidelity.

## Architectural Choices for Testability

### What already works

**Single source of truth in Yjs.** All state in `Y.Doc`, all operations through `DocumentAdapter`. Any document state can be set up programmatically, operated on, and inspected without rendering.

**Pure presentation model.** `computePresentation`, `computeCollapsedSet`, `computeEdgeRemap` are pure functions from data to data — functional core, imperative shell. The hardest logic is in the testable core.

**Focused hooks.** Each subscribes to a state slice. Tests exercise one concern without triggering unrelated re-renders.

### What would improve things further

**Separate command layer from hook layer.** Extract operation logic from hooks into plain functions that take an adapter and return mutations. Testable without `renderHook`/`TestProviders`/`waitFor`. The presentation model already uses this pattern.

**Property-based tests over the adapter.** Round-trip properties are implicit in the adapter contract: `addSchema(s); getSchema(s.id)` returns equivalent to `s`. `undo()` after any single operation returns to prior state. Page isolation: operations on page A don't affect page B. One property covers thousands of concrete cases.

**Compiler as semantic oracle.** The compiler transforms document state into structured text. For any manipulation: compile before, compile after, diff. "Adding a construct increases output by one block." "Renaming a schema updates all references." Tests through the full pipeline without a browser.

**Invariant preservation checks in plans.** Define what must NOT change (test count, API surface, file count) and verify post-execution. Crude but effective guardrails.

### The meta-principle

> Testability is a function of the distance between where truth is defined and where it can be observed.

- Truth in the data model, observable through the adapter: trivially testable
- Truth in the data model, observable only through rendered DOM: needs E2E, but fundamentally about data
- Truth in the rendering pipeline itself: needs E2E, inherently about composition

Architectural choices that shrink this distance — pure functions, compilation oracles, command functions separate from hooks — make both integration and E2E tests easier by giving more observation points closer to where truth lives.

## Partitioning a Project into Verifiable Domains

The verification question and the decomposition question are the same question asked twice:

> **Partitioning**: "What are the independently describable parts of this system?"
> **Verification**: "What would be true about each part if it worked correctly?"

If you can't state an invariant for a partition, it's not a real partition — it's an implementation grouping. If you can't describe a feature without referencing its implementation, it's not a feature — it's a code detail.

### Decomposition Methods

Four methods for partitioning a project, each with different verification affinities:

**1. Capability/Domain (DDD-style)** — Ask: "What does this system *know about*?" Group by nouns — entities and their invariants. Bounded contexts formalize this. Verification affinity: domain logic is almost always integration-testable. Each domain has invariants that can be stated as properties.

**2. User Activity (Story Mapping-style)** — Ask: "What does the user *do*?" Group by verbs — workflows and interactions. Activities that stay in the data model are integration-testable; activities involving interaction need E2E. The story map visually separates these.

**3. Abstraction Level (C4 Model)** — Ask: "At what zoom level am I looking?" System context → containers → components → code. Each level has a natural test type: system = E2E smoke, container = cross-package integration, component = within-package integration, code = unit/property tests.

**4. Risk/Confidence** — Ask: "What am I least sure about?" Partition by certainty, not structure. Novel components need more verification investment. Commodities rely on existing tests. This is where epistemic layers (L0/L1/L2) become a column in the inventory.

### The Verification Inventory

These methods converge on a single artifact — a table where rows are features/domains and columns capture what matters for verification:

| Domain | Activities | Key Invariants | Oracle | Test Level | Confidence |
|--------|-----------|----------------|--------|------------|------------|
| Schemas | Define, edit, group, package | Type uniqueness, field DataKind exhaustive | Adapter round-trip | Integration | L1 |
| Ports | Add to schema, connect, validate | Polarity blocks same-direction, compatibleWith symmetry | Adapter + validation fn | Integration | L1 |
| Constructs | Create, place, edit fields, delete | semanticId uniqueness per page, values match schema | Compiler oracle | Integration | L0 |
| Connections | Connect, disconnect, validate | Stored on source node, bidirectional reference integrity | Compiler oracle | Integration | L0 |
| Pages | Create, switch, delete, duplicate | Page isolation, at least one page always exists | Adapter round-trip | Integration | L1 |
| Organizers | Group, nest, collapse, layout | Bounds enclose members, collapse hides descendants | Presentation model (pure fn) | Integration | L1 |
| Compilation | Compile document | Every construct once, relationships accurate | Self-referential | Integration | L0 |
| Canvas | Pan, zoom, drag, select, LOD | Positions persist, LOD transitions, viewport math | Requires rendered geometry | E2E | L1 |
| Packages | Apply, publish, drift detection | Applied schemas match manifest, dual identity | Adapter + manifest check | Integration | L0 |
| Collaboration | Sync, awareness, conflict resolution | Convergence (both clients see same state) | Two-adapter comparison | Integration | L0 |
| Storage | Save, load, browse, create docs | Round-trip (save then load = original) | Adapter.toJSON() round-trip | Integration | L1 |

Columns:
- **Domain**: what the system knows about (DDD noun)
- **Activities**: what users do with it (story mapping verb)
- **Key Invariants**: "what would be true if implemented correctly" — the correctness properties
- **Oracle**: how you check correctness
- **Test Level**: integration vs E2E, driven by where truth lives
- **Confidence**: epistemic status (L0 conjecture / L1 logically verified / L2 empirically validated)

This inventory is the artifact where partitioning and verification meet. Each row is a domain with its own truth. Each row's invariants are the specification. Each row's oracle is how you check it. The confidence column is how sure you are right now.

## Implications for the Design Process

When grooming plans for agent execution:

1. **State the "what would be true" question explicitly.** Every plan should include properties of correctness that don't reference implementation.
2. **Classify each property as integration-testable or E2E-required.** Push as many as possible into integration territory.
3. **Tag design decisions with epistemic status.** Is this a conjecture (L0), logically consistent (L1), or empirically validated (L2)?
4. **Write postconditions as grep-able or script-able assertions.** The agent runs these after implementation as a first-pass verification gate.
5. **Use the compiler as an oracle.** If the feature affects document semantics, state the expected change in compiler output.

## Sources

- [Agent Contracts: A Formal Framework for Resource-Bounded Autonomous AI Systems](https://arxiv.org/html/2601.08815)
- [AI-Assisted Engineering Should Track Epistemic Status of Architectural Decisions](https://arxiv.org/html/2601.21116)
- [Clever: A Curated Benchmark for Formally Verified Code Generation](https://arxiv.org/html/2505.13938v1)
- [Agentic Property-Based Testing: Finding Bugs Across the Python Ecosystem](https://arxiv.org/html/2510.09907v1)
- [An Empirical Evaluation of Property-Based Testing in Python (OOPSLA 2025)](https://dl.acm.org/doi/10.1145/3764068)
- [The Oracle Problem in Software Testing: A Survey (IEEE TSE)](https://ieeexplore.ieee.org/document/6963470/)
- [Metamorphic Testing: A Review of Challenges and Opportunities (ACM)](https://dl.acm.org/doi/10.1145/3143561)
- [On (Mis)Perceptions of Testing Effectiveness](https://arxiv.org/html/2402.07222)
- [Investigating Developers' Perception on Software Testability (Empirical SE)](https://link.springer.com/article/10.1007/s10664-023-10373-0)
- [Test-case Quality: Understanding Practitioners' Perspectives](https://arxiv.org/html/2309.16801)
- [A Taxonomy of Testable HTML5 Canvas Issues](https://arxiv.org/abs/2201.07351)
- [Software Engineering at Google: Unit Testing](https://abseil.io/resources/swe-book/html/ch12.html)
- [Google Testing Blog: SMURF — Beyond the Test Pyramid](https://testing.googleblog.com/2024/10/smurf-beyond-test-pyramid.html)
- [Google Testing Blog: Guide to Writing Testable Code](https://testing.googleblog.com/2008/11/guide-to-writing-testable-code.html)
- [Bounded Context — Martin Fowler](https://martinfowler.com/bliki/BoundedContext.html)
- [Context Mapper: Domain-Driven Architecture Modeling (Springer)](https://link.springer.com/chapter/10.1007/978-3-030-67445-8_11)
- [C4 Model — Abstractions](https://c4model.com/abstractions)
- [Collaborative LLM Agents for C4 Architecture Design (arxiv)](https://arxiv.org/html/2510.22787v1)
- [User Story Mapping — Jeff Patton (ACM)](https://dl.acm.org/doi/10.5555/2688795)
- [Requirements Traceability Matrix — Verification (IEEE)](https://ieeexplore.ieee.org/document/8780518/)
