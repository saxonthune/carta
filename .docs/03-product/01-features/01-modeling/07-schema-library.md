---
title: Schema Library
status: draft
---

# Schema Library

Reusable, versioned schema packages that users can publish from one document and apply to others.

## Problem

Carta users discover useful schema groups through iterative modeling — the "code-minus-one" artifacts described in doc01.05.01. Today, schema groups are trapped inside individual documents. Reusing them requires manual export/import with no version tracking, no diff view, and no way to propagate improvements.

## Vision

A schema library lets users accumulate modeling knowledge across projects. When a user discovers that "Services need a `stateless` field," that learning flows into the library and benefits all future work. The library is the evolving record of what the user has learned about the right modeling abstractions for their domain.

## Design Decisions

### Fork ancestry, not live linking

When a library schema group is applied to a document, the document gets a **snapshot copy** plus ancestry metadata (library ID, version number). The document is self-contained — no runtime dependency on the library. The ancestry enables diff/update tooling but doesn't constrain the document.

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

The existing schema seeds (`softwareArchitectureSeed`, `bpmnSeed`, etc.) are repackaged as read-only library entries. Every deployment gets a standard library for free.

### Manual update checks

No automatic notifications. Users explicitly check for library updates. This avoids nag UX and keeps the interaction predictable.

### No library-on-library dependencies

A library is a flat collection of schemas. Libraries do not depend on other libraries. This avoids dependency resolution complexity.

## Library File Format

A `.carta-schemas` file (or a subset of `.carta`) containing M1 definitions only:

- Schemas (ConstructSchema[])
- Port schemas (PortSchema[])
- Schema group metadata
- Version number and changelog
- No instances, no pages, no M0 data

## Interactions

### Applying a library to a document

1. User opens schema picker (or a new "Add from library" action)
2. Browse available libraries (standard + vault libraries)
3. Select a schema group → preview its schemas
4. Apply → schemas are copied into the document with ancestry metadata

### Checking for updates

1. User manually triggers "Check library updates" (from metamap or document settings)
2. Carta compares document's forked-from version against library's current version
3. Diff view shows: new schemas, changed schemas (fields/ports added/removed/modified), deleted schemas
4. Merge options: accept all, accept new + keep local changes, cherry-pick per schema
5. AI-assisted migration for instance-level changes (e.g., "47 Service instances need a new field — suggest defaults based on existing data")

### Publishing to library

1. Right-click schema group in metamap → "Publish to library"
2. Diff view: document's schemas vs. library version forked from (or blank if new)
3. Cherry-pick which changes to promote
4. Choose: new version of existing library entry, or new library entry
5. Version number bumps, changelog entry recorded

## Incremental Build Plan

1. **Library file format** — define `.carta-schemas`, implement read/write
2. **Vault-local library** — `_library/` convention, publish from metamap, browse from schema picker, fork ancestry in documents
3. **Built-in seeds as standard library** — repackage existing seeds into library format
4. **Server-hosted libraries** — REST endpoint, same UX over server storage

## Out of Scope

- Remote sync protocol (libraries are files; sync is the vault's job)
- Multi-user concurrent library editing (one publisher, many consumers)
- Automatic update notifications
- Library dependency resolution (library-depends-on-library)
- Library marketplace or sharing platform
