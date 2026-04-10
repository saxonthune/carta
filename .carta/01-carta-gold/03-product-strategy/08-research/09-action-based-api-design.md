---
title: Action-Based API Design
status: exploring
summary: Why REST taxonomies are dead structures, how action-based APIs grow additively, and the connection between API shape and living systems
tags: [api, rest, rpc, trpc, concept-design, living-structure, additive-growth]
deps: [doc01.03.04.02, doc01.03.08.07, doc01.03.08.08]
---

# Action-Based API Design

How should a product expose its capabilities to clients? REST encodes domain structure as URL taxonomies. This research argues that structure-based APIs resist additive growth, and that action-based APIs — where the unit of interface is a named action with guards and effects — are the natural fit for systems that unfold incrementally.

## REST as Dead Structure

A REST API is a taxonomy frozen in URLs. You decide upfront that the world contains `/canvases` and `/sources` and `/blocks`, arrange them in a hierarchy, assign CRUD verbs, and publish the contract. Clients couple to it.

Problems that follow from this:

- **Versioning** (`/v1/`, `/v2/`) — the taxonomy was wrong and you can't fix it without breaking clients
- **Verb shoehorning** — "approve this order" isn't a PUT or POST, it's a domain action forced into CRUD
- **Endpoint proliferation** — new capabilities need new URLs because the taxonomy has no place for them
- **Breaking changes** — removing a field, renaming a path, changing a response shape all break clients

In Alexander's terms, REST forces a master plan (the URL taxonomy) upfront, then fabricates endpoints to fit. When the domain evolves and the taxonomy doesn't fit, the only option is a structure-destroying transformation: a versioned rewrite.

## The Alternative: Actions, Not Resources

Instead of encoding **what exists** (nouns as URLs), encode **what can happen** (actions as named operations). The API surface is a set of named actions with typed inputs and outputs.

Three levels of this approach, from simplest to most expressive:

### Flat Action List (JSON-RPC style)

```
POST /api/action
{ "action": "source.add", "payload": { "filename": "types.md" } }
```

No URL taxonomy. Adding a new action type is purely additive — old clients never send it. Removing an action is the only breaking change. Used by: Ethereum/blockchain nodes, Slack (methods like `chat.postMessage`, `conversations.create`).

### Typed RPC (tRPC)

tRPC eliminates the URL layer entirely for TypeScript-on-both-sides systems. The server defines procedures (queries and mutations) with Zod-validated inputs and typed outputs. The client imports only the server's type — no runtime code, no code generation. TypeScript's inference gives autocomplete and type checking across the network boundary.

```typescript
// Server
const router = t.router({
  'source.add': t.procedure
    .input(z.object({ filename: z.string() }))
    .mutation(({ input }) => { /* ... */ }),
})
type AppRouter = typeof router

// Client — imports only the type
const client = createTRPCClient<AppRouter>({ /* ... */ })
await client['source.add'].mutate({ filename: 'types.md' })
```

Adding a procedure is additive. The compiler catches misuse. The escape hatch to REST/OpenAPI exists via `trpc-openapi` if non-TypeScript clients need access later.

### State-Advertised Actions (HATEOAS done right)

The server returns current state plus the set of actions valid from that state:

```json
{
  "state": { "sources": ["types.md"], "layout": { "types.md": { "x": 0, "y": 0 } } },
  "actions": [
    { "name": "source.add", "params": { "filename": "string" } },
    { "name": "source.remove", "params": { "filename": "enum:types.md" } },
    { "name": "block.edit", "params": { "file": "string", "block": "number", "body": "object" } }
  ]
}
```

The client doesn't hardcode what's possible — the server advertises it based on current state. Adding a new action means the server starts including it in responses. Old clients ignore actions they don't recognize.

This is Fielding's original HATEOAS vision: hypermedia as the engine of application state. The response IS a state machine — current state plus valid transitions.

## Connection to Concept Design

Daniel Jackson's concept design (*The Essence of Software*) decomposes a system into concepts, each with a purpose, state, and actions. A concept's actions are its API. Composing concepts produces a system whose full API is the union of all concept actions, mediated by synchronizations.

For a product like the product design server (doc01.02.09), the concepts are:

```
concept Canvas
  purpose: compose a spatial view of source files
  actions: source.add, source.remove, container.move

concept Source
  purpose: create and modify structure content
  actions: source.create, block.edit

concept Watch
  purpose: keep the canvas current with external changes
  actions: (system) file.changed
```

The action-based API falls out directly from the concept decomposition. Each concept contributes its actions. The namespace (`source.*`, `block.*`, `container.*`) reflects concept ownership. Adding a concept means adding its actions — purely additive.

## Connection to Living Structure

Alexander's structure-preserving transformation has a precise meaning for APIs:

**An API change is structure-preserving when:**
1. Every action that existed before still exists after (no removals)
2. Every existing action's input/output types are backward-compatible (new optional fields only)
3. New actions are independently coherent (serve a clear purpose, don't require modifying existing actions to be useful)

**An API change is structure-destroying when:**
- Actions are removed or renamed
- Input/output types change incompatibly
- The URL taxonomy is reorganized (REST versioning)

Action-based APIs make structure-preserving changes the default and structure-destroying changes require explicit effort. REST makes the opposite true — any taxonomy change is destructive.

Stripe demonstrates this at scale: their core rule is that new fields and new endpoints are always safe, and when they must break compatibility, they write transformation modules that downgrade new responses to old formats per-version. The API never actually breaks — old clients get old-shaped responses forever. This is additive growth enforced by engineering discipline.

## Guards Are Not State Machines

An earlier analysis considered modeling the product design server as a state machine (doc01.03.08.07). The conclusion: the server's actions are mostly independent and always available. The "guards" are input validation (does this file exist? is this block index valid?), not state-dependent gates (is the canvas in editing mode?).

The distinction matters:

| Concept | State machine guard | Input validation |
|---|---|---|
| "Can't edit block 3 if file has 2 blocks" | No — structural constraint | Yes |
| "Can't add sources after canvas is locked" | Yes — depends on mode | N/A for this product |
| "Filename must be .md" | No — input format | Yes |

State machines are the right model when **what you can do depends on where you are** — the valid actions change based on lifecycle phase. An action catalog (flat list of actions with guards and effects) is sufficient when actions are independent and mostly always available.

The product design server is an action catalog grouped by concept. State machines would model the *structures themselves* (an order lifecycle, a document workflow), not the server API.

## Practical Caveats

**Discoverability.** REST's URLs are self-documenting. `GET /api/users/42` is obvious. Action-based APIs need either state-advertised actions (server tells you what's possible) or generated docs from type definitions (tRPC gives autocomplete).

**Tooling.** HTTP caches, CDNs, API gateways — all assume REST's URL-per-resource model. A single-endpoint RPC API makes caching and rate-limiting harder. Irrelevant for local single-user servers, real cost for public APIs.

**Namespace discipline.** As the system grows, the flat action list needs organization. Namespace by concept: `source.add`, `block.edit`, `canvas.layout`. This keeps the list navigable and mirrors the concept decomposition.

**Idempotency.** REST GET is naturally idempotent. POST to a single endpoint is not. For systems where network drops matter, include a client-generated idempotency key. Stripe does this.

**Guard-failure errors.** REST returns `404 Not Found` for missing resources. Action-based APIs need structured errors that report which guard failed: `{ "error": "guard", "action": "source.add", "guard": "file-not-found", "detail": "no file at types.md" }`.

## Sources

- Fielding, R.T. (2000). "Architectural Styles and the Design of Network-Based Software Architectures." Doctoral dissertation, UC Irvine. (The original REST definition, including HATEOAS.)
- Jackson, D. (2021). *The Essence of Software: Why Concepts Matter for Great Design*. Princeton University Press.
- Fikes, R. & Nilsson, N. (1971). "STRIPS: A New Approach to the Application of Theorem Proving to Problem Solving." *Artificial Intelligence*.
- Stripe Engineering. "APIs as Infrastructure: Future-Proofing Stripe with Versioning." stripe.com/blog/api-versioning.
