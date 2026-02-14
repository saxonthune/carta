---
title: Principles
status: active
---

# Principles

## Backwards Compatibility Is Not a Concern

This codebase is in active development. When refactoring:
- Remove old patterns completely — don't maintain them alongside new ones
- Update all references to use the new approach
- Don't preserve deprecated code paths
- Simplicity and clarity over backwards compatibility

## Deletion Requires Conscious Intent

Deleting user data should only happen when the user consciously decides to delete something. It should never be a consequence or requirement of any other user flow. "Restore defaults" adds missing items — it never removes custom ones. "Import" merges — it never replaces. Any destructive operation must be its own explicit action with its own confirmation.

## Single Source of Truth

Yjs Y.Doc is the only state store. All document state (nodes, edges, schemas, deployables, port schemas) lives in Yjs. UI state (selection, menus, modals) stays in component useState.

## No Singleton Registries

Schema and deployable data is accessed through the document adapter, not global imports. Functions receive their dependencies as parameters.

## Edges Carry No Metadata

All relationship data lives on constructs. Edges are visual representations of connections stored in construct data. Direction derives from port ownership and polarity, not edge metadata.

## Symmetric Storage, Asymmetric Interpretation

Connections are symmetric in storage but asymmetric in interpretation. The edge itself carries no metadata — direction and meaning derive entirely from which construct owns which port type. A single relationship definition covers both directions: "Database contains Table" and "Table belongs to Database" are the same connection read from different ends.

## Inverse Is Always Derivable

You never define (A to B) and (B to A) separately. If you need different meanings for each direction, use different construct types, not different connections.

## Necessary and Sufficient Primitives

The goal is minimal primitives that express all needed relationships:
1. Don't add features unless they enable something impossible before
2. Don't duplicate semantics — if port types give direction, edges don't need it
3. Prefer structural meaning (port ownership) over explicit metadata

## No Embedded Tables

Don't embed structured data (like parameters or columns) as table fields inside a construct. Use child constructs connected via parent-child ports instead. This gives visual representation, consistent editing, and reusable definitions.

## DataKind Is Exhaustive

Every field must have exactly one of the five data kinds: string, number, boolean, date, enum. There are no special field types. DisplayHints (multiline, code, url, etc.) affect rendering only, not data storage.

## Dual Identity System

Construct instances use two separate identifiers:
- **Technical ID** (Node.id): Immutable UUID from `crypto.randomUUID()`, used internally by React Flow and Yjs. Never exposed to users, never changes.
- **Semantic ID** (semanticId): Human/AI-readable identifier used in connections and compilation. Generated as `{type}-{timestamp}{random}`. Can be renamed by users, which triggers cascade updates to all referencing connections.

## One Concept, One Location

Every domain concept has exactly one canonical definition. Other documents and code reference it rather than re-explaining. The glossary (doc01.03) is the authority for domain vocabulary.

## Make Invalid States Unrepresentable

Prefer discriminated unions over independent boolean flags for state that has lifecycle phases. A discriminated union is a TypeScript union of object types sharing a common literal-typed "discriminant" field, where each variant carries only the data valid for that phase:

```typescript
// Good: status discriminant proves adapter exists when ready
type DocState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; adapter: ReadyAdapter; ydoc: Y.Doc }

// Bad: independent fields admit invalid combinations
type DocState = { isReady: boolean; adapter: ReadyAdapter | null; error: string | null }
```

When a context provider gates rendering on readiness, the context value exposed to children should be the narrowed "ready" type — no null checks, no `isReady` booleans. The gate and the type are the same thing.

For functions that access state that may not exist yet (e.g. Yjs maps before sync), return `null` rather than a sentinel value that pretends to be valid. Callers handle the absence explicitly. This is the "parse, don't validate" principle: encode invariants in types rather than checking them at runtime.

## Organizers Are Not Connections

Visual organization (organizers) and semantic relationships (port connections) are completely independent systems. Dropping a node into an organizer never creates a connection. Connecting two nodes via ports never puts them in the same organizer. The word "parent/child" is reserved for the port system — constructs inside an organizer are "members." Organizers serve the human (spatial convenience); connections serve the AI (semantic meaning). See doc02.09.
