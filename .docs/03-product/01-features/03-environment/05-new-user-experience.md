---
title: New User Experience
status: active
---

# New User Experience

The first-time experience must get a user to the "aha moment" — seeing connected constructs on a canvas — within seconds of opening Carta. No modals, no choices, no blank canvas.

## Principle

A new user should be **plopped into a working document** with a few connected notes that demonstrate the core interaction model: typed nodes with connections between them. This aligns with the Rough-to-Refined philosophy (doc03.03.08) — start in the sketch phase, not an empty void.

Relevant UX principles (doc01.04):
- **Peak-End Rule**: The first nodes + connections moment must feel satisfying. Don't gate it behind a document browser.
- **Progressive Disclosure**: First encounter prioritizes discoverability. A populated canvas teaches by example.
- **Doherty Threshold**: Canvas must appear within 400ms. No loading spinners, no async document creation flow.
- **Jakob's Law**: Excalidraw, Figma, and Miro all drop users into a ready workspace. Carta should do the same.

## Static Mode (Local-Only)

### First Visit

When a user visits Carta for the first time (no existing documents in IndexedDB):

1. **Auto-create a starter document** — no DocumentBrowserModal, no choices
2. **Seed the canvas with starter content** — a small graph of connected constructs that demonstrates the tool
3. **Set the URL** to `?doc={generated-id}` via `history.replaceState` (no page reload) so persistence works immediately
4. **Title**: "Untitled Project" (user can rename via header click)

### Starter Content

The starter document contains **3-5 connected nodes** using sketching schemas (Note, Box, or similar low-friction types). The content should:

- Show at least two different schema types to demonstrate typing
- Include at least 2 connections between nodes to demonstrate relationships
- Use positions that create a readable left-to-right or top-to-bottom flow
- Fit within the default viewport without requiring pan/zoom
- Use generic, domain-neutral labels (not tied to software architecture)

Example starter graph:
```
[Note: "Your idea"]  ──→  [Note: "Break it down"]  ──→  [Note: "Connect the pieces"]
```

The exact content is an implementation detail, but it must be **minimal enough to not overwhelm** and **connected enough to demonstrate the core interaction**.

### Returning Visit

When a user returns (existing documents in IndexedDB):

1. **Reopen the last document** — use `carta-last-document-id` from localStorage
2. **No modal** — go straight to canvas
3. **Document browser** available via header menu for switching documents

### Multiple Documents

The DocumentBrowserModal is still available for managing multiple documents, but it is never forced on the user. It is accessed through the header as a deliberate navigation action, not as a gate.

## Server Mode

Server mode retains the DocumentBrowserModal for first-time visitors because the user must choose between existing shared documents or create a new one. The auto-create behavior applies only to static/local mode where there's a single user.

## Implementation Notes

### Starter Content Seeding

Starter content is seeded in `DocumentContext.tsx` during adapter initialization, gated on the `initialized` flag being unset. The implementation:

- Uses `seedStarterContent()` from `src/utils/starterContent.ts`
- Creates 3 Note nodes connected by 2 edges via `adapter.setNodes()` and `adapter.setEdges()`
- Runs inside the same transaction as built-in schema seeding
- Uses `generateSemanticId()` for proper identity

### E2E Testability

The NUX must be testable with a clean browser state (cleared IndexedDB). The e2e test should verify:

- First visit renders canvas (not DocumentBrowserModal)
- Starter nodes are visible on the canvas
- Starter edges connect the nodes
- User can immediately interact (select, drag, delete nodes)
- After clearing and reloading, the NUX triggers again

### Data Test IDs

Starter content nodes should not require special test IDs. Standard React Flow selectors (`.react-flow__node`, `.react-flow__edge`) are sufficient. The test verifies count and interactability, not specific content.
