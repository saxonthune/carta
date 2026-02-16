---
title: Schema Library
status: active
---

# Schema Library

Reusable schema packages that users explicitly load into documents from a standard library or user-created collections.

## Problem

The original seed system ran as imperative side-effects during document initialization, gated on a fragile `initialized` flag. There was no manifest of which packages were loaded, so seeding was not idempotent — schemas and groups duplicated on every load. Users had no control over which schemas appeared in their documents.

## Vision

A schema library lets users accumulate modeling knowledge across projects. When a user discovers that "Services need a `stateless` field," that learning flows into the library and benefits all future work. The library is the evolving record of what the user has learned about the right modeling abstractions for their domain.

All schema loading is **explicit and opt-in**. No auto-seeding. The user chooses which packages to load via a package picker.

## Key Vocabulary

- **Schema Package** (`SchemaPackage`): The unit of bundling and library portability. Contains schemas, in-package port schemas, and optional visual groups. See doc01.03, doc02.06.
- **Schema Package Definition** (`SchemaPackageDefinition`): The portable, self-contained format for a package — everything needed to load it into a document. This is the unit of storage in the standard library and the unit of snapshotting in the manifest.
- **Schema Group** (`SchemaGroup`): Visual grouping within a package for metamap organization and menu nesting. Cosmetic only — does not affect bundling or compilation.
- **In-package port**: A port schema with a `packageId` — domain-specific vocabulary that travels with the package (e.g., "modifies/modified-by").
- **Document-level port**: A port schema without a `packageId` — cross-package connector. The built-in port schemas (flow, parent/child, relay, intercept) are the default cross-package plumbing.
- **Package manifest**: A Y.Map in the document tracking which packages have been loaded, with snapshots for drift detection.

## Core Architecture

See doc02.04.07 for the full ADR.

### Dual identity model

Every package has two identity mechanisms:

| Mechanism | Purpose | Answers |
|-----------|---------|---------|
| **UUID** | Package identity (immutable) | "Is this the same package?" |
| **Content hash** (SHA-256) | Content integrity | "Has the content been modified since loading?" |

Display names are freely renameable and not used for identity or idempotency.

### Package manifest

The Y.Doc contains a `packages` Y.Map with one entry per loaded package:

```
PackageManifestEntry {
  packageId: string                  // UUID — idempotency key
  contentHash: string                // SHA-256 at load time
  displayName: string                // label at load time
  loadedAt: string                   // ISO timestamp
  snapshot: SchemaPackageDefinition  // frozen copy of loaded definition
}
```

### Loading function

A single `applyPackage(adapter, definition)` function replaces all imperative seeding:

1. Check manifest by UUID — block if already present
2. Create SchemaPackage entry in Y.Doc
3. Hydrate schemas with fresh UUIDs + packageId
4. Write port schemas, groups, relationships
5. Compute content hash
6. Record manifest entry with hash + snapshot

Callable from initialization, package picker UI, or future library browser.

### Drift detection

- **Instant check**: Hash current schemas for a packageId, compare to manifest's `contentHash`. Clean or dirty.
- **Detailed diff**: Compare current state against `snapshot`. On-demand only.
- **No live linking**: Loaded packages are forks. The document owns its copy.

### UI Implementation

**PackagePickerModal** — modal dialog for browsing and loading schema packages.

- **Location**: `packages/web-client/src/components/modals/PackagePickerModal.tsx`
- **Hook**: `usePackagePicker` provides package list, loaded status, and load action
- **Displays**: Standard library packages with name, description, schema count, color, and load status
- **Status indicators**: Available (can load), Loaded (already in document by UUID), Loaded (modified) (content hash differs from snapshot)
- **Action**: Load button calls `applyPackage()` to write package to document + manifest

The modal implements the "Loading a package (v1)" interaction flow described in the Interactions section.

## Design Decisions

### Fork ancestry, not live linking

When a library package is loaded into a document, the document gets a **snapshot copy**. The document is self-contained — no runtime dependency on the library. The snapshot enables diff/drift tooling but doesn't constrain the document.

Rationale: Live linking violates single source of truth. The document's schemas would be computed from library + delta, making them harder to reason about. Fork ancestry keeps documents independent while enabling optional sync.

### Built-in port schemas are document template, not a package

Built-in port schemas (flow-in/out, parent/child, relay, intercept, symmetric) are part of every new document's initial state — like how a new document has empty maps for nodes and schemas. They are M2-level plumbing, not opt-in packages. They have no `packageId`.

### Loading is one-way and permanent (v1)

Loading a package is a one-time operation. Re-loading the same UUID is blocked. There is no "reset to library version" action in v1. The snapshot data supports building this in the future, but the initial implementation focuses on clean loading and drift visibility.

### Library files live where documents live

The library is not a separate storage system. It reuses document sources:

| Deployment | Library storage |
|---|---|
| All deployments | Built-in standard library (read-only, shipped with app) |
| Desktop standalone | `_library/` folder alongside documents (future) |
| Desktop connected | Local `_library/` + server-hosted (future) |
| Enterprise / SaaS | Server-hosted (`GET /api/libraries`) (future) |

### No library-on-library dependencies

A library is a flat collection of packages. Libraries do not depend on other libraries. This avoids dependency resolution complexity.

### Ports bundled by packageId, not classification

Port schemas do not carry a "structural vs semantic" classification. `packageId` presence determines bundling: ports with a `packageId` travel with their package; ports without are document-level. Built-in ports (no `packageId`) are never bundled.

### Cross-package connections create document-level ports

When a user connects schemas in different packages, any new port types are document-level (no `packageId`). The built-in port types serve as default cross-package connectors.

## Standard Library

The existing schema seeds are repackaged as `SchemaPackageDefinition` objects with stable UUIDs, shipped in `@carta/domain`:

- Software Architecture (services, APIs, databases)
- BPMN (activities, events, gateways)
- AWS (EC2, S3, Lambda)
- Capability Model (capabilities, sub-capabilities)
- Sketching (Note, Box — low-friction types)

Each has a catalog entry with displayName, description, and color for the package picker.

## Interactions

### Loading a package (v1)

1. User opens package picker (from toolbar, metamap, or new document flow)
2. Browse standard library packages (and vault libraries when available)
3. Each package shows: name, description, schema count, color, loaded/modified status
4. Select → preview schemas and port vocabulary
5. Load → `applyPackage()` writes to document + manifest

### Checking for drift (v1)

The package picker and metamap show drift status per package:

- **Loaded** — matches snapshot (content hash unchanged)
- **Loaded (modified)** — differs from snapshot (content hash changed)

Detailed diff view (what changed) is a future enhancement; the data is already in the snapshot.

### Publishing to library (future)

1. Right-click schema package in metamap → "Publish to library"
2. Diff view: current package state vs. snapshot (or blank if user-created)
3. Cherry-pick changes to promote
4. Save as `.carta-schemas` file

### Checking for library updates (future)

1. User triggers "Check library updates"
2. Compare document's snapshot against library's current version
3. Diff view with merge options

## Library File Format (future)

A `.carta-schemas` file containing M1 definitions only:

- SchemaPackage metadata (name, description, color)
- Schemas (`ConstructSchema[]`) with matching `packageId`
- In-package port schemas (`PortSchema[]`) with matching `packageId`
- Schema groups (`SchemaGroup[]`) within the package
- No instances, no pages, no M0 data

## Metamap Presentation

- **Package nodes**: Rendered as top-level organizer containers. Show package name, color, and drift badge.
- **Schema groups**: Rendered as nested organizers within the package.
- **Cross-package edges**: Connections between schemas in different packages use document-level or built-in port types.

## Out of Scope

- Remote sync protocol (libraries are files; sync is the vault's job)
- Multi-user concurrent library editing
- Automatic update notifications
- Library dependency resolution
- Library marketplace or sharing platform
- Port classification metadata — bundling is derived from reference graph
- Reset-to-library-version action (data supports it; UI is future)
