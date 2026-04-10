---
title: Contract-First Development
status: exploring
summary: The action contract is the skeleton, not the database — define contracts, build screens against mocks, defer persistence until the contract stabilizes
tags: [contract-first, mock-first, action-based, unfolding, persistence, methodology]
deps: [doc01.03.04.03, doc01.03.08.09]
---

# Contract-First Development

Traditional development treats the data model as the skeleton and builds upward: schema first, then repositories, then services, then API, then UI. Unfolding inverts this. **The action contract is the skeleton.** The database comes last.

## The Pattern

1. **Define the action contract.** A shared typed contract between client and server, listing every action the system can perform with its input and output types. This is the system's shape.

2. **Build screens against mock responses.** The server implements each action handler with hardcoded mock data. The client renders real screens, navigates real flows, triggers real actions — all backed by fake data. The full happy path works end-to-end.

3. **Develop the backend behind stable contracts.** As screens prove out the contract shape, implement real logic behind the action handlers. Auth wraps existing handlers. Business rules fill in handler bodies. Each change preserves the contract — the client doesn't know or care what's behind it.

4. **Add persistence last.** Only when real actions need real state does a database appear. The schema mirrors the existing action handlers. Handler rewrites replace mock returns with real queries without changing action signatures.

## Why This Works

**The contract is the cheapest thing to change early.** Adding a field to a TypeScript action type costs nothing. Adding a column to a production database with migration scripts and backwards compatibility costs real engineering time. By stabilizing the contract shape through UI iteration *before* any persistence exists, you avoid the most expensive kind of change.

**Mock data is sufficient longer than you think.** A forum with mock posts, mock users, and mock threads is enough to build and validate the entire UI, the entire navigation structure, the entire auth flow, and the entire action contract. The database adds persistence, not capability. Recognizing this unlocks a development sequence where the system is fully explorable — and fully testable — before persistence exists.

**AI agents work better against stable contracts.** When an AI agent implements a database layer, the action signatures are already proven by working screens. The agent doesn't need to guess what the API shape should be — it's defined. The agent doesn't need to handle UI implications of schema changes — the UI already works. The transformation is narrow and well-specified: "implement this exact action signature against SQLite."

## Connection to Action-Based APIs

doc01.03.08.09 (Action-Based API Design) argues that action-based APIs grow additively and resist dead structure. Contract-first development is the development *process* that produces action-based APIs naturally. You don't design the action taxonomy upfront — you discover it by building screens and finding out what actions the UI needs. Each new screen may add actions; no screen forces you to restructure existing ones.

## Anti-Pattern: Schema-First

The conventional approach — design the database schema, generate CRUD endpoints, build UI on top — optimizes for the wrong thing. It freezes the data model before anyone has used the system. Every subsequent discovery ("users actually need to see threads grouped by subforum, not chronologically") requires schema migration, API changes, and UI changes in lockstep. The database, intended as foundation, becomes the heaviest thing to move.
