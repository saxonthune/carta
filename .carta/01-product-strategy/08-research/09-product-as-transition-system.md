---
title: Product Design as Transition System
status: exploring
summary: Modeling products as guarded transition systems — verifiable reachability, dead-end detection, and deductive architecture from product properties
tags: [product-modeling, transition-systems, verification, architecture, reachability, spec-driven, artifact-driven development]
deps: [doc01.04.01, doc01.04.02, doc01.08.05]
---

# Product Design as Transition System

Two related insights from exploring game world randomizers and business product design:

1. **Every product is a transition system** with states, guarded transitions, and reachability requirements — and the same algorithms that verify game worlds can verify business designs.
2. **Architecture decisions are deducible from product properties** — if the product spec encodes temporal and access characteristics, caching/storage/API choices follow as logical consequences rather than design judgment.

## Part I: Products as Guarded Transition Systems

### The Game World Analogy

A game randomizer (studied: OoT Randomizer) encodes its world as a directed graph where regions are nodes, edges have predicate guards ("requires hookshot AND bombs"), and items at locations grant new capabilities. The randomizer must verify that the world is **beatable** — that a valid ordering exists from start to goal.

Every product has the same structure:

| Game Concept | Business Equivalent |
|---|---|
| Location/region | Customer state (onboarding step, account tier, workflow stage) |
| Item | Capability/credential (verified email, payment method, completed training) |
| Edge guard | Business rule ("requires verified identity AND payment method") |
| Beatable | Every customer journey reaches a successful outcome |
| Dead end | Customer state with no available transitions toward goal |
| Settings/tricks | Business configurations, product tiers, feature flags |

### Vocabulary: Labeled Transition Systems

The formal name for this structure is a **labeled transition system** (LTS) — a directed graph where nodes are states, edges are transitions, and transitions carry guards and effects. The working vocabulary:

| Term | Meaning |
|---|---|
| **State** | Where you are (customer account status, player location) |
| **Transition** | An edge from one state to another |
| **Guard** | Predicate on a transition — "requires verified email AND payment method" |
| **Effect** | What changes when you traverse — "gains `has-payment-method`" |
| **Reachable** | Can you get there from the start by following transitions whose guards are satisfied? |
| **Dead state** | Reachable, but no path from it to any goal |
| **Fixpoint** | Iterate "check all transitions, add newly reachable states" until nothing changes |
| **Monotone** | Capabilities only accumulate — gaining something never blocks a transition |

**Recommended source for further reading:** David Harel's **statecharts** — state machines extended with hierarchy (states contain sub-states), guards, actions, and parallel regions. The XState documentation (stately.ai/docs) is the most accessible modern treatment. Statecharts handle hierarchical states ("active account" contains "free tier" and "paid tier") and parallel regions (customer is simultaneously in "onboarding" and "billing" tracks) without an explosion of nodes.

### The Mathematical Structure

The player/customer's state `(capabilities, reachable_states)` grows monotonically. This is a **closure operator** on the power set of capabilities:

- Define `cl(I)` = all capabilities reachable given current capabilities `I`
- Extensive: `I ⊆ cl(I)` (you keep what you have)
- Monotone: `I ⊆ J => cl(I) ⊆ cl(J)` (more capabilities never reduce reachability)
- Idempotent: `cl(cl(I)) = cl(I)` (applying again adds nothing)

"Product works" = the fixpoint `cl*({initial})` contains all goal states.

There is a **Galois connection** between capabilities and reachable states — given capabilities, what states can you reach? Given states, what capabilities do you need? The fixpoints of the round-trip are the stable states of a journey.

### Connection to Category Theory

The product-as-transition-system maps onto several structures from Fong's "Seven Sketches in Compositionality":

- **Resource theory** (Ch. 2): Capabilities are resources in a symmetric monoidal preorder. Transitions are resource-consuming morphisms. The feasibility question — "can the customer reach the goal from nothing?" — is a resource theory reachability query.
- **Feasibility relations** (Ch. 4): Each transition is a feasibility relation `(required_capabilities) -> (gained_capabilities, new_state)`. Composing along a path gives total feasibility. The product works iff the composed relation from initial to goal is inhabited starting from `{}`.
- **Near-decomposability** (Simon): Well-designed products have regions with strong internal connectivity and weak cross-region edges. Verification decomposes by region.
- **Monotone maps** (Ch. 1): Adding product features or configurations only adds transitions, never removes them — a monotone map on the preorder of transition systems.

### Practical Verification

The core algorithm is **fixpoint iteration** — essentially Datalog's semi-naive evaluation:

1. **Forward pass**: Start with initial capabilities. Repeatedly scan all transitions; if a guard is satisfied, mark the target state reachable and collect any gained capabilities. Repeat until nothing changes.
2. **Backward pass**: Start from goal states. Which states can reach a goal? Any forward-reachable state NOT in the backward-reachable set is a **dead end**.
3. **Completeness check**: For every reachable state, verify at least one outgoing transition's guard is satisfiable — catches states where the customer is stuck.

This runs in polynomial time for monotone systems (capabilities only accumulate). If capabilities can be revoked (discounts that disqualify other offers), the problem becomes PSPACE-complete and requires heavier tools (Petri nets, model checking).

### Verification Tools by Complexity

| Tool | When to Use |
|---|---|
| **Fixpoint iteration** | Standard case — capabilities accumulate monotonically. ~20 lines of code, milliseconds. |
| **SMT solvers (Z3)** | "Can ANY configuration of business rules create a dead end?" — exhaustive verification across all configurations. |
| **Alloy** | Exploratory counterexample finding — "show me a customer journey that gets stuck." Small-scope hypothesis checking. |
| **Petri nets** | Resources are consumed (money spent, credits used), not just accumulated. |
| **Model checking (TLA+)** | Invariants across all possible executions — "every reachable state has at least one path to the goal." |

### How OoT Randomizer Encodes This

The OoT Randomizer uses JSON region files with Python expression strings as guards:

```json
{
    "region_name": "Kokiri Forest",
    "locations": {
        "KF Kokiri Sword Chest": "is_child",
        "KF GS House of Twins": "is_adult and at_night and (Hookshot or ...)"
    },
    "exits": {
        "KF Outside Deku Tree": "is_adult or open_forest == 'open' or 'Showed Mido Sword & Shield'",
        "Lost Woods": "True"
    }
}
```

At load time, these strings are AST-transformed and compiled to Python lambdas: item names become `state.has(item_id)`, settings are inlined as constants (enabling dead branch elimination), and aliases expand. The fill algorithm uses reverse-fill — assume all items, remove one at a time, verify the world remains beatable at each step.

**What's good:** Human-readable, diffable, version-controllable. Partial evaluation against settings is elegant.

**What's awkward for business modeling:** Rules are embedded Python (tight language coupling, hard to verify independently). For spec-driven development, we'd want rules as pure data with a standalone verifier — closer to Datalog than to compiled lambdas.

---

## Part II: Deductive Architecture from Product Properties

### The Thesis

Architecture decisions are driven by **quality attributes**, and quality attributes are **product properties**, not software properties. If the product spec makes these properties explicit, architecture decisions become if/then deductions rather than design judgment.

The reason architecture decisions feel hard is that these properties are usually **implicit** — in someone's head, excavated through meetings, often guessed wrong. Spec-driven development makes them explicit.

This is the decreasing indirection thesis (doc01.04.02) applied to architecture: the product properties ARE the architecture decisions, viewed from a different angle. The indirection was never necessary — it existed because the product properties were never written down.

### Product Properties That Determine Architecture

Every piece of data or interaction in a product has observable properties that the product designer already knows:

| Product Property | What It Determines | Product Designer Knows This As |
|---|---|---|
| **Read/write ratio** | Caching strategy, storage engine | "Customers check this constantly but it rarely changes" |
| **Staleness tolerance** | Cache TTL, consistency model | "Seeing yesterday's menu is fine" vs "must see current order status" |
| **Change trigger** | Invalidation strategy | "Changes when driver updates" vs "changes on a schedule" |
| **Consistency scope** | Replication, cache topology | "Everyone sees the same homepage" vs "only the customer sees their order" |
| **Burst pattern** | Scaling strategy | "Everyone orders lunch at noon" vs "steady trickle" |
| **Failure tolerance** | Redundancy, retry strategy | "Payment must never be lost" vs "a failed recommendation is fine" |
| **Coupling** | Sync vs async, API style | "Can't show receipt until payment confirms" vs "send email whenever" |

These are all questions a product person can answer without knowing anything about caching, databases, or APIs.

### Worked Example: Delivery App

**Order status entity:**
- Read frequency: high (customer checks every 30s while waiting)
- Write frequency: low (changes ~5 times per order lifecycle)
- Staleness tolerance: 10s (customer expects near-real-time)
- Change trigger: event (driver actions cause updates)
- Consistency scope: narrow (only ordering customer sees it)
- Failure tolerance: low (stale status is annoying, not catastrophic)

**Deduction:** High read + low write = cache it. 10s staleness + event trigger = event-driven invalidation. Narrow scope = per-user cache key, no CDN. Low failure tolerance = local cache with DB fallback.

**Homepage content entity:**
- Read frequency: very high (every visitor)
- Write frequency: very low (merchandising team updates weekly)
- Staleness tolerance: 24h (yesterday's featured items are fine)
- Change trigger: manual (editor publishes)
- Consistency scope: broad (everyone sees the same page)
- Failure tolerance: medium (showing nothing is bad)

**Deduction:** Very high read + very low write + 24h staleness = long-lived cache. Broad scope = CDN. Manual trigger = cache-bust on publish. Medium failure tolerance = serve stale on origin failure.

### Frequency Separation IS Architecture

This connects directly to Simon's near-decomposability (doc01.04.02). Architecture is the discovery of **frequency boundaries** in the product:

- **Fast-changing data** (order status, live scores) — needs invalidation machinery, event-driven
- **Slow-changing data** (menus, catalogs) — cacheable, CDN-friendly, publish-driven
- **Never-changing data** (historical orders, receipts) — store once, cache forever

These frequencies are **observable from the product design**. The product designer knows "order status changes 5 times per lifecycle" and "the menu changes weekly." They don't need to know what a CDN is — they annotate the data's rhythm, and the architecture follows.

### Taxonomy of Architecture Decisions

A comprehensive catalog of the decisions typically made at the architecture level, organized by concern. Each decision has a set of options; the thesis is that for most of these, the right option is deducible from product-level properties if those properties are made explicit.

#### Compute & Runtime
- **Execution model**: serverless functions, containers, VMs, edge functions, static hosting, WebAssembly
- **Orchestration**: Kubernetes, ECS/Fargate, PaaS-managed, none
- **Region strategy**: single region, multi-region active-passive, multi-region active-active
- **Process model**: event loop, thread-per-request, actor model, coroutines
- **Cold start tolerance**: acceptable (batch/async) vs unacceptable (latency-sensitive)

#### Data Storage
- **Engine**: relational (Postgres, MySQL), document (MongoDB, Firestore), wide-column (Cassandra, DynamoDB), graph (Neo4j), key-value (Redis), time-series (TimescaleDB)
- **Schema approach**: schema-on-write vs schema-on-read vs schemaless
- **Consistency model**: strong, eventual, causal, read-your-writes, bounded staleness
- **Replication**: single primary, primary-replica, multi-primary, leaderless
- **Partitioning**: hash-based, range-based, geographic, tenant-based, none
- **Data retention**: indefinite, TTL auto-deletion, tiered hot/warm/cold/archive
- **Polyglot persistence**: one engine for everything vs specialized stores per access pattern

#### Caching
- **Layer**: client-side, CDN edge, reverse proxy, application-level, dedicated cache service, DB query cache
- **Invalidation**: TTL expiry, event-driven, write-through, write-behind, cache-aside
- **Topology**: local in-memory (per-instance), distributed shared, sidecar, embedded
- **Eviction**: LRU, LFU, size-based, priority-based
- **Warming**: on deploy, on demand, background prefetch, lazy

#### Communication & API
- **External API style**: REST, GraphQL, gRPC, tRPC, WebSocket, SSE
- **Internal communication**: synchronous RPC, async messaging, shared database, service mesh
- **Message broker**: Kafka, RabbitMQ, NATS, SQS/SNS, Redis Streams
- **Delivery guarantee**: at-most-once, at-least-once, exactly-once
- **Serialization**: JSON, Protocol Buffers, MessagePack, Avro
- **API contract**: OpenAPI, GraphQL SDL, Protocol Buffers, AsyncAPI, none

#### Authentication & Authorization
- **Auth mechanism**: session-based, JWT tokens, mutual TLS, API keys
- **Identity provider**: build vs Auth0/Cognito/Clerk/Keycloak
- **Authorization model**: RBAC, ABAC, ReBAC (Zanzibar/OpenFGA), policy-based (OPA/Cedar), ACL
- **Permission granularity**: resource-level, field-level, row-level, operation-level
- **MFA**: TOTP, WebAuthn/passkeys, SMS, push notification
- **Service-to-service auth**: mutual TLS, service tokens, IAM roles

#### State Management
- **Service statefulness**: stateless (state in external stores), stateful sessions, in-memory stateful (CRDTs, actors)
- **Session storage**: Redis, database, cookie-only JWT, encrypted cookie
- **Distributed state**: CRDTs, operational transforms, distributed consensus (Raft)

#### Data Flow & Processing
- **Write path**: direct write, CQRS, event sourcing
- **Distributed transactions**: saga (orchestration vs choreography), outbox pattern, 2PC, accept eventual consistency
- **Event architecture**: thin events (notification), fat events (state transfer), event sourcing
- **Idempotency**: idempotency keys, natural (PUT semantics), deduplication layer
- **Ordering guarantees**: total order, partial (per-entity), causal, none

#### Deployment & Organization
- **Topology**: monolith, modular monolith, microservices, serverless functions
- **Repository**: monorepo, multi-repo, hybrid
- **Deployment strategy**: rolling, blue-green, canary, A/B
- **Database migrations**: versioned migrations, auto-migration from schema diff, manual DDL
- **Infrastructure**: Terraform, Pulumi, CDK, click-ops

#### Scaling
- **Direction**: horizontal (more instances), vertical (bigger instances), both
- **Auto-scaling trigger**: CPU/memory, queue depth, latency, scheduled, fixed
- **Read scaling**: read replicas, caching, CDN, materialized views, CQRS read models
- **Write scaling**: sharding, partitioning, write-behind queues, event sourcing with partitioned streams
- **Load balancing**: round-robin, least connections, consistent hashing, geographic

#### Reliability
- **Retry strategy**: immediate, exponential backoff, backoff with jitter, retry budget
- **Circuit breaker**: per-endpoint, per-dependency, global
- **Graceful degradation**: fallback responses, stale cache, reduced functionality, feature flag-controlled
- **Disaster recovery**: RPO/RTO targets, warm standby, multi-site active-active
- **Dependency failure**: fail open vs fail closed

#### Observability
- **Logging**: structured vs unstructured, correlation IDs, log levels
- **Tracing**: OpenTelemetry, distributed traces, span-based
- **Metrics**: RED (rate/errors/duration), USE (utilization/saturation/errors), golden signals
- **Alerting**: static thresholds, anomaly detection, SLO-based burn rate
- **Audit trail**: embedded in app logs, separate audit table, event sourcing

#### Security
- **Encryption**: TLS everywhere, mutual TLS internal, field-level encryption, at-rest encryption
- **Secret management**: Vault, cloud secret manager, environment variables, sealed secrets
- **Network**: VPC, security groups, zero-trust, VPN
- **Input validation**: schema validation, parameterized queries, allowlists
- **Compliance**: SOC 2, HIPAA, GDPR, PCI-DSS — each imposes architectural constraints

#### Frontend & Content
- **Rendering**: SSG, SSR, CSR, ISR, streaming SSR, island architecture, edge rendering
- **Data fetching**: REST, GraphQL, tRPC, React Query/SWR
- **CDN strategy**: static assets only, full-page caching, edge compute

#### Multi-Tenancy
- **Data isolation**: shared DB + tenant column, schema-per-tenant, DB-per-tenant, instance-per-tenant
- **Tenant identification**: subdomain, URL path, header, JWT claim
- **Resource isolation**: shared compute, namespace-isolated, dedicated instances

#### Background Processing
- **Job queue**: BullMQ, Celery, SQS + Lambda, Temporal
- **Workflow orchestration**: Temporal, Step Functions, Airflow, custom saga
- **Scheduling**: cron, managed scheduler, in-app

#### Integration & External Systems
- **Inbound**: webhooks, polling, streaming API, file drop
- **Outbound**: HTTP calls, message publishing, webhook delivery
- **Resilience**: retry, circuit breaker, fallback provider, caching

#### Versioning & Evolution
- **API versioning**: URL path, header, content negotiation, additive-only
- **Schema evolution**: additive-only migrations, expand-contract, online migration
- **Feature lifecycle**: feature flags, beta/GA stages, deprecation period

#### Domain Modeling
- **Entity identity**: UUID v4, UUID v7 (time-sortable), ULID, auto-increment, content-addressed hash
- **Deletion**: soft delete, hard delete, event-sourced (no delete concept)
- **Temporal modeling**: current-state only, bi-temporal, event log with projections
- **Polymorphism**: single-table inheritance, JSON variant column, separate tables, discriminated union
- **Normalization**: fully normalized, strategically denormalized, document-style

---

### What Product-Level Information Makes These Decisions Deducible?

The architecture taxonomy above contains ~100 distinct decisions. Most architects make them through experience, intuition, and negotiation. The claim is that the majority reduce to a small set of **product-level observables** — properties the product designer already knows but rarely writes down.

#### The Product Properties

Organized by what they determine:

**1. Temporal rhythm** — how data moves through time

| Property | What the product person knows | What it determines |
|---|---|---|
| **Change frequency** | "Order status changes 5 times per lifecycle" / "Menu changes weekly" | Cache TTL, storage tier, replication strategy |
| **Change trigger** | "Changes when the driver does something" / "Editor publishes" | Invalidation strategy (event vs schedule vs manual) |
| **Staleness tolerance** | "Customer expects current status" / "Yesterday's menu is fine" | Consistency model, cache policy, read replica lag tolerance |
| **Lifetime** | "Orders are relevant for 2 hours, then archival" / "Receipts are forever" | Data retention, tiered storage, backup strategy |
| **Burst pattern** | "Everyone orders at noon" / "Steady trickle" | Scaling strategy, queue sizing, serverless vs persistent |

**2. Access shape** — who touches what, how

| Property | What the product person knows | What it determines |
|---|---|---|
| **Read/write ratio** | "Checked constantly, rarely changes" vs "Written once, read once" | Caching, CQRS, read replicas, storage engine |
| **Audience scope** | "Everyone sees the same homepage" / "Only you see your order" | CDN vs per-user cache, consistency scope, replication topology |
| **Concurrency** | "Many people edit this simultaneously" / "Only one person at a time" | Conflict resolution (CRDTs, OT, locking), distributed state |
| **Cardinality** | "We'll have 100 products" / "We'll have 10 million events per day" | Partitioning, index strategy, storage engine choice |
| **Growth rate** | "Adds ~1000 records/day" / "Doubles monthly" | Sharding strategy, auto-scaling, cost model |

**3. Dependency & coupling** — what depends on what

| Property | What the product person knows | What it determines |
|---|---|---|
| **Causal dependency** | "Can't show receipt until payment confirms" | Sync vs async, saga vs direct call |
| **Temporal coupling** | "Email can be sent whenever" vs "Must respond in 100ms" | Message queue vs RPC, serverless vs service |
| **Data coupling** | "Order needs customer info, product info, and inventory" | Join strategy, polyglot persistence, service boundaries |
| **Fan-out** | "One event triggers notifications to 100 people" | Event bus, fan-out queue, push vs pull |

**4. Failure & trust** — what matters when things break

| Property | What the product person knows | What it determines |
|---|---|---|
| **Failure consequence** | "Lost payment = catastrophic" / "Stale recommendation = annoying" | Redundancy, retry, durability, circuit breaker policy |
| **Correctness requirement** | "Balance must always be accurate" / "Approximate count is fine" | Consistency model, transaction boundaries, eventual vs strong |
| **Recovery expectation** | "Must recover within 5 minutes" / "Next business day is fine" | RPO/RTO, disaster recovery strategy, backup frequency |
| **Degradation preference** | "Show stale data" vs "Show nothing" vs "Show error" | Graceful degradation, fallback strategy, cache-on-failure |

**5. Identity & access** — who is who, who can do what

| Property | What the product person knows | What it determines |
|---|---|---|
| **Actor types** | "Customers, drivers, restaurant staff, admins" | Auth model, permission granularity, multi-tenancy |
| **Permission model** | "Drivers see only their deliveries" / "Admins see everything" | RBAC vs ABAC vs ReBAC, row-level security |
| **Trust boundary** | "External API for partners" / "Internal only" | API gateway, rate limiting, auth mechanism, network segmentation |
| **Verification requirements** | "Must verify identity before payment" / "Anonymous browsing OK" | Auth flow, MFA, KYC pipeline |

**6. Presentation & delivery** — how users consume the product

| Property | What the product person knows | What it determines |
|---|---|---|
| **Interactivity** | "Read-only dashboard" / "Real-time collaborative editor" | CSR vs SSR vs SSG, WebSocket vs REST, state management |
| **Offline requirement** | "Must work without internet" / "Always connected" | Service worker, local storage, sync strategy |
| **Search behavior** | "Search across all products by keyword" / "Look up by ID" | Search index vs DB query, full-text vs vector, Elasticsearch vs pg_trgm |
| **Content type** | "Mostly text and images" / "Video streaming" / "PDFs and documents" | CDN, transcoding, blob storage, processing pipeline |
| **Personalization** | "Everyone sees the same thing" / "Feed is unique per user" | Cache granularity, recommendation engine, edge compute |

#### The Mapping Principle

For each architecture decision in the taxonomy, there exists a **decision function** that takes product properties as input and produces the architecture choice (or a small set of viable options) as output:

```
architecture_decision = f(temporal_rhythm, access_shape, coupling, failure_trust, identity_access, presentation)
```

Example decision functions:

- `caching_strategy(change_freq=low, staleness_tol=24h, audience=broad, change_trigger=manual)` → CDN with publish-time bust
- `storage_engine(data_coupling=dense_cross_refs, access=complex_queries, cardinality=moderate)` → relational
- `communication_style(causal_dep=none, temporal_coupling=loose, fan_out=high)` → event bus
- `compute_model(burst=extreme, temporal_coupling=loose, coupling=independent)` → serverless

Some decisions are **not fully deducible** — they involve genuine tradeoffs where multiple options are equally valid given the product properties. These are the decisions that actually require architectural judgment. But they are far fewer than people assume. Most "architecture decisions" are product properties wearing a technical costume.

---

### Part III: Languages and Tools for Product Properties

The question: what languages and tools can we construct that make these product properties **easy to create, manipulate, and reason about**? This is the resources-of-the-metamodel question — what should the medium of expression be?

Following Deleuze's Bergsonism: a well-formulated problem is already mostly solved. The task is to frame the problem correctly, not to pick a solution prematurely.

#### Framing 1: Product Properties as Annotations on a Transition System

The product is already a transition system (Part I). Product properties are **annotations on the nodes and edges** of that system. The question is: what annotation language?

**What this looks like:** Each entity, state, and transition in the product spec carries structured metadata — temporal rhythm, access shape, coupling, failure tolerance. Architecture decisions are derived by a rule engine that reads annotations and emits recommendations.

**The tension:** Annotations are easy to attach but hard to validate. How do you know the product designer's annotation is correct? "Staleness tolerance: 10s" is a claim — what happens when the business actually needs 100ms? The annotation language needs to be **testable** — either through simulation, formal verification, or empirical measurement.

**Tools that fit:** YAML/JSON frontmatter on spec files (what Carta already uses), extended with a controlled vocabulary for product properties. The controlled vocabulary is the key contribution — not a new language, but a shared set of terms that product people and architects both understand.

#### Framing 2: Product Properties as a Dimensional Space

Each entity lives in a multi-dimensional space defined by its product properties. Architecture decisions are **regions** in this space. The entity's position determines which region it falls in, and the region determines the architecture.

**What this looks like:** A matrix or scatter plot where entities are positioned by their properties. Clusters of entities with similar properties share architecture. Outliers get special treatment. The architect's job is to draw the region boundaries; the product designer's job is to position the entities.

**The tension:** Dimensions interact. An entity that is high-read, low-write, broad-scope, and high-staleness-tolerance is clearly a CDN candidate. But what about high-read, high-write, broad-scope, low-staleness-tolerance? The dimensional space has regions where multiple architectures are viable and the choice depends on cost, team skill, or existing infrastructure.

**Tools that fit:** Spreadsheets (the entity-component matrix from the ECS conversation), radar charts, decision matrices. The visualization makes the clustering visible. Outliers are entities that don't fit any cluster — they need bespoke architecture or product redesign.

#### Framing 3: Product Properties as Constraints in a Solver

Product properties define a **constraint satisfaction problem**. Each architecture decision is a variable with a domain of options. Product properties impose constraints ("if staleness tolerance < 1s, then caching strategy != long-TTL"). A solver finds consistent assignments.

**What this looks like:** A declarative specification: "order-status has change-frequency=low, staleness-tolerance=10s, scope=narrow." A constraint solver derives: "caching=event-invalidation, storage=cache-aside, consistency=read-your-writes." Conflicts are surfaced: "you said staleness-tolerance=100ms but also failure-tolerance=low — these conflict because 100ms staleness with graceful degradation requires expensive infrastructure."

**The tension:** Constraint solvers find consistent solutions but don't explain why. The architect needs to understand the reasoning, not just the output. And the constraint set is never complete — there are always factors the solver doesn't model (team expertise, existing infrastructure, vendor relationships).

**Tools that fit:** SMT solvers (Z3), Alloy for counterexample finding, or simpler rule engines (if/then tables that can be audited). Datalog is attractive here — rules are readable, execution is transparent, and the fixpoint semantics match the reachability analysis from Part I.

#### Framing 4: Product Properties as Flows in a Network

Product properties describe **flows** — data flows, control flows, user attention flows, money flows. Architecture decisions are about how to implement those flows efficiently. The product is a network; the architecture is a physical realization of that network.

**What this looks like:** A graph where nodes are entities/actors and edges are flows. Each flow has properties: volume (how much), frequency (how often), latency requirement (how fast), reliability requirement (how certain). Architecture decisions are about **routing** — which flows share infrastructure, which need dedicated paths, where to place caches and queues.

**The tension:** Flow analysis is powerful but requires quantitative data that product designers may not have early on. "How many requests per second?" is a question that often can't be answered until the product exists. The flow model needs to work with **qualitative** estimates ("high," "low," "bursty") as well as quantitative ones.

**Tools that fit:** Wardley maps (value chain as a flow), service blueprints (four-layer flow from customer to support), Petri nets (flows with resource consumption), queuing theory (for quantitative analysis when data exists). Mermaid flowcharts for lightweight visualization.

#### Framing 5: Product Properties as a Type System

Product properties define **types** on entities and transitions. "This entity is high-read, low-write, broad-scope" is a type. Architecture patterns are **implementations** of those types. The architecture is a type-directed compilation from product types to infrastructure.

**What this looks like:** A product entity has a type composed of its property values. A library of architecture patterns is indexed by product type. The "compiler" matches entity types to patterns. Type errors surface as architectural conflicts: "this entity has contradictory properties that no known pattern satisfies."

**The tension:** Type systems are rigid. Products evolve, and an entity's properties change over time. The type system needs to handle **gradual typing** — some properties are known precisely, others are estimated, others are completely unknown. Architecture decisions for well-typed entities are deductive; for partially-typed ones, they're advisory.

**Tools that fit:** TypeScript-style structural typing (where the "type" is the set of declared properties), JSON Schema for validation, or a custom type language that allows partial specifications. The Carta metamodel's existing schema system (DataKind, ConstructSchema) is already a type system for canvas constructs — extending it with product-property types would be natural.

#### Synthesis: The Problem, Well-Formulated

The five framings are not competing solutions — they are five aspects of one problem:

1. **Annotations** tell you what the product properties are
2. **Dimensions** let you see the clustering and outliers
3. **Constraints** check consistency and surface conflicts
4. **Flows** reveal the quantitative demands
5. **Types** make the mapping from product to architecture mechanical

A good tool would support all five aspects without committing to any single formalism. The minimum viable version:

- **A vocabulary** of product properties (the tables in the previous section) — not a language, just shared terms
- **A way to attach them** to entities and processes (frontmatter, annotations, columns in a matrix)
- **A way to visualize clustering** (spreadsheet, radar chart, dimensional plot)
- **A way to check consistency** (rules, constraints, even just a checklist)
- **A way to derive architecture** (decision tables, rule engine, or just a human reading the properties and deducing)

The Deleuze/Bergson insight: the problem is not "what tool should we build?" but "what vocabulary makes the product properties visible?" Once visible, the architecture follows — whether by human judgment, rule engine, or constraint solver. The tool is secondary to the vocabulary.

## Open Questions

1. Should operational annotations (read frequency, staleness tolerance, etc.) be a standard part of the entity spec format, or a separate "operational profile" spec that references the entity?
2. How much of the transition-system verification can be automated as a script in the reconciliation pipeline? What spec format would make the fixpoint algorithm trivial to implement?
3. Is there a useful middle ground between "pure data rules" (Datalog) and "embedded code rules" (OoT's Python expressions) for encoding business guards?
4. How do non-monotone systems (capability revocation, resource consumption) appear in typical business products? How common are they, and do they require the heavier verification tools?
5. Which of the five framings (annotations, dimensions, constraints, flows, types) should Carta prioritize? Are some more natural for different abstraction levels of the spec ladder?
6. Can the decision functions be encoded as Datalog rules, making architecture derivation part of the reconciliation pipeline?
7. What is the minimum set of product properties that covers 80% of architecture decisions? Can the vocabulary be kept to ~20 terms without losing too much?

## Sources

- Harel, D. (1987). "Statecharts: A Visual Formalism for Complex Systems." *Science of Computer Programming*.
- OoT Randomizer: github.com/OoTRandomizer/OoT-Randomizer — studied as a case of guarded transition system encoding.
- Fong, B. & Spivak, D. (2019). *Seven Sketches in Compositionality*. Cambridge University Press. Chapters 1 (preorders), 2 (resource theories), 4 (co-design/feasibility).
- Simon, H.A. (1962). "The Architecture of Complexity." — frequency separation as the basis of near-decomposability.
- See also: doc01.04.01 (artifact-driven development), doc01.04.02 (theoretical foundations), doc01.08.05 (decomposition and composition theory).
