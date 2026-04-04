# Unfolding in Practice: Embryonic Development for Software

## What is unfolding?

Unfolding is Christopher Alexander's term for how living structures grow. In *The Nature of Order*, he describes how the built environment develops through **structure-preserving transformations** — each step strengthens existing centers rather than demolishing and rebuilding. A cathedral isn't designed in full and then constructed. It begins as a simple enclosure, and over centuries, develops centers of light, ornament, and spatial complexity as forces accumulate and cross thresholds.

Embryonic development works the same way. An embryo doesn't start with a miniature skeleton and then add flesh. It begins as undifferentiated cells that gradually differentiate — each transformation preserving the integrity of what came before. Bones don't appear until the forces that demand bones exist. Ornament doesn't appear until the structure can bear it.

Applied to software: **start with the simplest possible living system, and let complexity emerge only when forces demand it.** Don't design for hypothetical requirements. Don't add infrastructure before the structure needs it. Each change should be a structure-preserving transformation — the system after the change should feel like a natural growth of the system before it.

## How to apply this to any software project

### 1. Start with hello world — and mean it

Your first commit should be a working system. Not a skeleton with TODO comments. Not a boilerplate with twelve config files. A system that does one thing, end to end. The entire happy path — from user action to system response — should work, even if what it does is trivial.

This is the embryo. Every future change grows from this.

### 2. Let forces cross thresholds before adding complexity

Don't add authentication because you "will need it." Add it when a user story actually requires distinguishing between people. Don't add a database because "real apps have databases." Add it when in-memory state can no longer hold. Don't add infrastructure-as-code because "we'll deploy eventually." Add it when you're actually deploying.

A change in quantity begets a change in quality. Three actions can share a single handler file. Thirty cannot. The force — the quantity — tells you when the structure must change.

### 3. Structure-preserving transformations only

When you do add complexity, it should feel like a natural outgrowth. Auth doesn't replace the existing request flow — it wraps it. A database doesn't change how actions work — it replaces the storage layer beneath them. The system's shape is preserved; a new center develops within it.

If a change requires rewriting everything that came before, something has gone wrong. Either the change was premature or the prior structure was too rigid. Both are signs of non-living design.

### 4. Everything must remain refactorable

Specs, contracts, APIs, UI flows, infrastructure — every artifact must be changeable. If a part of the system resists change, it becomes a dead structure that the rest of the system must work around. REST APIs backed by SQL tables, in large organizations, often become exactly this: immovable structures that require massive investment to keep from collapsing, while simultaneously preventing the system from growing.

Action-based APIs, concept-driven design, and spec-driven development all serve the same goal: keeping the system alive and responsive to forces.

## How tinyForum unfolded

tinyForum is a forum application built from scratch using this process. Here's how the embryo developed, traced through the actual git history across two days of development.

### Day 1 (April 1, 2026) — The embryo and first differentiation

**Hello world.** The first commit is a plan for implementing hello world. The second commit implements it: a React client and a Node.js server, connected end to end. Nothing else. No routing, no auth, no database. Just a client that talks to a server.

**Concept testing.** The next step adds a concept testing system and vitest. This isn't premature infrastructure — it's the earliest organ of the embryo. Concepts (identity, session, post, subforum, thread) are defined as testable TypeScript modules using Jackson's concept-driven design. The concepts exist before the code that implements them, the way a blueprint precedes a building.

**Contract and screens.** A shared `contract` package appears, defining the action-based API between client and server. The client gets screens. The server gets action handlers backed by mock data. The system now has a real shape: users can navigate screens and trigger actions that traverse the full stack, even though the server just returns mock responses.

**Auth.** Identity, authentication, and credential concepts exist in the concept layer. Now the forces demand they manifest in code: auth backend middleware, then auth frontend UI. The system preserves its existing structure — auth wraps the action flow rather than replacing it.

**AWS infrastructure.** The server needs to be deployable. Server-AWS and CDK appear — not because "we might deploy someday" but because the system has reached the point where running it locally is no longer sufficient. Infrastructure grows from the embryo.

### Day 2 (April 2, 2026) — Ornamentation and centers of complexity

**Appointment concept.** A new concept emerges to handle scheduled/time-based interactions. The concept layer continues to differentiate.

**Auth refactoring and SMS.** Auth, now a real center of the system, develops its own complexity. The auth concepts are refactored, and phone/SMS authentication is added. This is ornamentation — the auth center was simple at first, and now the forces (multiple auth methods) cause it to develop richer internal structure.

**Visual design.** The luminous design pass, look-and-feel commits, and theme work represent the system developing its visual identity. The structure was plain; now it acquires presence. Like ornament on a building, this doesn't change the structure — it intensifies what's already there.

**Reactions and composition.** TinyPost reactions and the compose flow appear. The posting system — initially just a contract action — develops into a center with its own internal complexity: composing, reacting, viewing.

**Homepage and subforum views.** The navigation structure differentiates. What was a flat set of screens becomes a hierarchy: homepage, subforum views, threaded discussions.

**SQLite.** The most striking example of unfolding. For the entire first day and most of the second, the server runs on mock data. No database. The system doesn't need one — mock data is sufficient for building out the full stack, testing the contract, developing the UI. Only when the mock data can no longer hold (there are real actions that need real persistence) does SQLite appear. And when it does, it's a structure-preserving transformation: the schema mirrors the existing action handlers, and the handler rewrites replace mock returns with real queries without changing the action signatures.

The database is the last thing added. In a traditional approach, it would have been the first.

## What this demonstrates

The tinyForum timeline shows that unfolding works. In two days, a hello-world client-server pair grew into a full forum application with authentication, SMS verification, posting, reactions, subforum navigation, visual design, cloud infrastructure, and a real database — through a series of structure-preserving transformations where each step grew naturally from the forces present in the previous step.

No step was wasted. No infrastructure was premature. No refactor required throwing away prior work. The system unfolded.

This is what Alexander means when he says living structure cannot be designed — it can only be generated, step by step, through a process that respects what already exists.
