---
title: Concept-First Sequencing
summary: How concept-driven design composes with unfolding — concepts before code, contracts before backends, the ordering that makes AI-powered development coherent
tags: [concepts, jackson, unfolding, sequencing, methodology, ai]
deps: [doc01.03.04.03, doc01.03.08.10, doc01.03.08.09]
---

# Concept-First Sequencing

Jackson's concept-driven design says: decompose software into freestanding concepts, each with a purpose, state, actions, and operational principle. Unfolding (doc01.03.04.03 — Unfolding as Software Development) says: start with the simplest working system and let forces demand complexity. These two methodologies compose into a specific development sequence.

## The Sequence

```
concepts → contract → screens → backend → persistence
```

1. **Concepts.** Define the domain as testable concept modules — pure TypeScript, no framework dependencies. Each concept has a purpose, state type, and action functions. The concepts exist as tested specifications before any application code.

2. **Contract.** Derive the action-based API contract from the concepts. Each concept's actions become contract actions with typed inputs and outputs. The contract is a shared package imported by both client and server.

3. **Screens.** Build UI screens that invoke contract actions and render responses. The server returns mock data. The full user flow is navigable and testable.

4. **Backend.** Implement real logic behind the contract actions. Auth, business rules, validation — each wrapped around the existing action handlers.

5. **Persistence.** Add a database when stateful actions can no longer run on mock data. The schema mirrors the concept state types.

## Why Concepts Come First

Concepts are the cheapest unit of design. A concept module is a single file with types and pure functions. It has no dependencies, no framework, no infrastructure. It can be written, tested, refactored, or deleted in minutes.

By defining concepts first, you accomplish three things:

**Domain clarity.** Writing a concept forces you to articulate its purpose. If you can't state the purpose in one sentence, the concept is overloaded or doesn't exist. This catches design mistakes before any code is written.

**Testable specifications.** Concept modules are executable specs. A test that exercises a concept's operational principle ("a user who creates a session can authenticate, and an authenticated user can post") is a runnable statement of domain intent. These tests survive every subsequent development step — they don't depend on UI, API shape, or database schema.

**Natural contract derivation.** The contract falls out of the concepts. If the Identity concept has `register` and `authenticate` actions, the contract has `identity.register` and `identity.authenticate` endpoints. No API design meeting needed — the concepts *are* the API design.

## How AI Agents Use This Sequence

Each step in the sequence is a well-defined transformation with clear inputs and outputs:

| Step | Input | Output | AI suitability |
|------|-------|--------|----------------|
| Concepts | Domain knowledge (specs, user stories) | Typed concept modules with tests | High — structure translation |
| Contract | Concept action signatures | Shared typed API package | Mechanical — direct derivation |
| Screens | Contract types + wireframes | React components against mock data | High — UI from typed contracts |
| Backend | Contract + business rules | Action handler implementations | High — narrow, well-specified |
| Persistence | Concept state types + action handlers | Database schema + queries | High — schema mirrors types |

No step requires the AI to hold the entire system in context. Each step builds on artifacts produced by the previous step. This is why unfolding and concept-driven design compose well with AI — they produce a sequence of narrow, verifiable transformations rather than one large, ambiguous generation task.
