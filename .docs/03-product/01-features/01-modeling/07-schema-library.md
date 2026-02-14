---
title: Schema Library
status: draft
---

# Schema Library

Reusable, versioned schema packages that users can publish from one document and apply to others.

## Problem

Carta users discover useful schema packages through iterative modeling — the "code-minus-one" artifacts described in doc01.05.01. Today, packages are trapped inside individual documents. Reusing them requires manual export/import with no version tracking, no diff view, and no way to propagate improvements.

## Vision

A schema library lets users accumulate modeling knowledge across projects. When a user discovers that "Services need a `stateless` field," that learning flows into the library and benefits all future work. The library is the evolving record of what the user has learned about the right modeling abstractions for their domain.

## Key Vocabulary

- **Schema Package** (`SchemaPackage`): The unit of bundling and library portability. Contains schemas, in-package port schemas, and optional visual groups. See doc01.03, doc02.06.
- **Schema Group** (`SchemaGroup`): Visual grouping within a package for metamap organization and menu nesting. Cosmetic only — does not affect bundling or compilation.
- **In-package port**: A port schema with a `packageId` — domain-specific vocabulary that travels with the package (e.g., "modifies/modified-by").
- **Document-level port**: A port schema without a `packageId` — cross-package connector. The built-in port schemas (flow, parent/child, relay, intercept) are the default cross-package plumbing.

## Design Decisions

### Fork ancestry, not live linking

When a library package is applied to a document, the document gets a **snapshot copy** plus ancestry metadata (library ID, version number). The document is self-contained — no runtime dependency on the library. The ancestry enables diff/update tooling but doesn't constrain the document.

Rationale: Live linking (base + overlay) violates single source of truth. The document's schemas would be computed from library + delta, making them harder to reason about. Fork ancestry keeps documents independent while enabling optional sync.

### Library files live where documents live

The library is not a separate storage system. It reuses document sources:

| Deployment | Library storage |
|---|---|
| Demo / solo browser | Built-in seeds only (read-only standard library) |
| Desktop standalone | `_library/` folder alongside documents |
| Desktop connected | Local `_library/` + server-hosted |
| Enterprise / SaaS | Server-hosted (`GET /api/libraries`) |

### Built-in seeds become the standard library

The existing schema seeds (`softwareArchitectureSeed`, `bpmnSeed`, etc.) are repackaged as read-only library packages. Every deployment gets a standard library for free.

### Manual update checks

No automatic notifications. Users explicitly check for library updates. This avoids nag UX and keeps the interaction predictable.

### No library-on-library dependencies

A library is a flat collection of packages. Libraries do not depend on other libraries. This avoids dependency resolution complexity.

### Ports are not classified — bundling is by reference graph

Port schemas do not carry a "structural vs semantic" classification. Instead, `packageId` presence determines bundling: ports with a `packageId` travel with their package; ports without are document-level. When the library bundler exports a package, it collects all port schemas referenced by the package's schemas that also have the same `packageId`. Built-in ports (no `packageId`) are never bundled — they're assumed present in every document.

### Cross-package connections create document-level ports

When a user draws a connection between schemas in different packages (e.g., REST API → UI Screen), any new port types created are document-level (no `packageId`). They belong to the document, not to either package. The built-in port types (flow, parent/child, relay, intercept) serve as default cross-package connectors.

## Library File Format

A `.carta-schemas` file containing M1 definitions only:

- SchemaPackage metadata (name, version, changelog)
- Schemas (`ConstructSchema[]`) — all with matching `packageId`
- In-package port schemas (`PortSchema[]`) — those with matching `packageId`
- Schema groups (`SchemaGroup[]`) — visual grouping within the package
- No instances, no pages, no M0 data

## Interactions

### Applying a library package to a document

1. User opens schema picker (or a new "Add from library" action)
2. Browse available libraries (standard + vault libraries)
3. Select a package → preview its schemas and port vocabulary
4. Apply → schemas, in-package ports, and groups are copied into the document with ancestry metadata

### Checking for updates

1. User manually triggers "Check library updates" (from metamap or document settings)
2. Carta compares document's forked-from version against library's current version
3. Diff view shows: new schemas, changed schemas (fields/ports added/removed/modified), deleted schemas, port vocabulary changes
4. Merge options: accept all, accept new + keep local changes, cherry-pick per schema
5. AI-assisted migration for instance-level changes (e.g., "47 Service instances need a new field — suggest defaults based on existing data")

### Publishing to library

1. Right-click schema package in metamap → "Publish to library"
2. Diff view: document's package contents vs. library version forked from (or blank if new)
3. Cherry-pick which changes to promote (schemas, port types, groups)
4. Choose: new version of existing library entry, or new library entry
5. Version number bumps, changelog entry recorded

## Metamap Presentation

- **Package nodes**: Rendered as top-level organizer containers in the metamap. Show package name, color, and version badge (if library ancestry exists).
- **Port vocabulary card**: When a package has port schemas referenced by 3+ of its schemas, a summary card appears inside the package organizer showing the port vocabulary. Heuristic-based visibility — not shown for packages where ports are 1:1 with schema pairs.
- **Schema groups**: Rendered as nested organizers within the package, as today.
- **Cross-package edges**: Connections between schemas in different packages render as edges crossing package boundaries, using document-level or built-in port types.

## Incremental Build Plan

1. **Data model split** — Add `SchemaPackage` type, add `packageId` to schemas/ports/groups, migrate existing top-level groups to packages
2. **Library file format** — Define `.carta-schemas`, implement read/write
3. **Vault-local library** — `_library/` convention, publish from metamap, browse from schema picker, fork ancestry in documents
4. **Built-in seeds as standard library** — Repackage existing seeds into library format
5. **Server-hosted libraries** — REST endpoint, same UX over server storage

## Out of Scope

- Remote sync protocol (libraries are files; sync is the vault's job)
- Multi-user concurrent library editing (one publisher, many consumers)
- Automatic update notifications
- Library dependency resolution (library-depends-on-library)
- Library marketplace or sharing platform
- Port classification metadata (structural vs semantic) — bundling is derived from reference graph
