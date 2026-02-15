---
title: "Package-based schema loading with dual identity"
status: active
---

# Decision 007: Package-Based Schema Loading with Dual Identity

## Context

The existing seed system runs as imperative side-effects during document initialization, gated on a fragile `initialized` flag. There is no manifest of which packages are loaded, so seeding is not idempotent — schemas and groups duplicate on every load. The system cannot answer "is this package already here?" or "has it been modified since loading?"

We need a clean loading architecture that makes schema packages a first-class concept with explicit user opt-in, idempotency guarantees, and drift detection.

## Decision

### Dual identity model

Every schema package uses two identity mechanisms:

| Mechanism | Purpose | Answers |
|-----------|---------|---------|
| **UUID** | Package identity | "Is this the same package?" |
| **Content hash** (SHA-256 of definition) | Content integrity | "Has the content been modified?" |

The UUID is assigned at package creation and is immutable. The content hash is computed from the `SchemaPackageDefinition` at load time. Display names are freely renameable and not used for identity.

Inspiration: Git uses content-addressable storage (identity IS content), but Carta users modify packages after loading, so a stable UUID is needed for tracking "this is still the Software Architecture package" even after edits. The content hash provides instant drift detection without diffing, like npm lockfile integrity hashes.

### Document-level package manifest

The Y.Doc gains a `packages` Y.Map storing a manifest of loaded packages:

```
PackageManifestEntry {
  packageId: string                  // UUID — idempotency key
  contentHash: string                // SHA-256 at load time
  displayName: string                // label at load time
  loadedAt: string                   // ISO timestamp
  snapshot: SchemaPackageDefinition  // frozen copy of loaded definition
}
```

The manifest is the idempotency key: before loading any package, check by UUID. If present, block the load.

### Single loading function

Replace imperative seeding with `applyPackage(adapter, definition)`:

1. Check manifest — skip if UUID already present
2. Create SchemaPackage entry in Y.Doc
3. Hydrate schemas with fresh UUIDs + packageId
4. Write port schemas, groups, relationships
5. Compute content hash of definition
6. Record manifest entry with hash + snapshot

This function is callable from anywhere: initialization, UI, future library browser.

### Drift detection

- **Instant check**: Hash current schemas for a packageId, compare to manifest's `contentHash`. O(1) answer: clean or dirty.
- **Detailed diff**: Compare current state against `snapshot` in manifest. On-demand only.
- **No live linking**: Loaded packages are forks. The document owns its copy. No Figma-style "update all instances" problem.

### Built-in port schemas as document template

Built-in port schemas (flow-in/out, parent/child, relay, intercept, symmetric) are part of the document template — present in every new Y.Doc from creation. They are not part of any package. They are M2-level plumbing.

### Standard library

Existing schema seeds are repackaged as `SchemaPackageDefinition` objects with stable UUIDs. Shipped with the app in `@carta/domain`. All packages are opt-in — no auto-seeding.

## Consequences

- Idempotent package loading — no more duplicate schemas on reload
- Explicit user control — all schema packages are opt-in
- Drift detection is cheap (content hash comparison)
- Detailed "what changed" is available on demand (snapshot diffing)
- Old seed system can be removed entirely
- New user experience must be redesigned (blank canvas + package picker)
- Future library features (publish, update, version tracking) build on this manifest foundation
