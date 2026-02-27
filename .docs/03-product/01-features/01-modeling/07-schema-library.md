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

- **Instant check**: `isPackageModified(adapter, packageId)` — hash current schemas for a packageId, compare to manifest's `contentHash`. Clean or dirty.
- **Library update check**: `isLibraryNewer(manifestEntry, libraryDefinition)` — compare snapshot hash against current library definition hash.
- **Detailed diff (doc vs snapshot)**: `computePackageDiff(adapter, packageId)` — compare current document state against snapshot with field-level detail. On-demand only.
- **Detailed diff (snapshot vs library)**: `computePackageDiffFromDefinitions(baseline, current)` — diff two definitions directly. Used to show "Library Update" changes when a newer library version exists.
- **Diagnostic helper**: `debugPackageDrift(adapter, packageId)` — dumps intermediate state (group mapping, hashes, reconstructed definition) to diagnose why a package shows as "Modified" when the diff view shows no changes. Development/debug use only.
- **No live linking**: Loaded packages are forks. The document owns its copy.

### UI Implementation

**PackagePickerModal** — tabbed modal for browsing, loading, and managing schema packages.

- **Location**: `packages/web-client/src/components/modals/PackagePickerModal.tsx`
- **Hook**: `usePackagePicker` provides package list, loaded status, load/repair/create actions

**Library tab** — Browse and load standard library packages:
- Each card shows: color dot, name, description, schema count, load status
- Status indicators: Available (can load), Loaded (green check), Modified (amber), Update Available (blue)
- Actions: Load, Repair (0 schemas desync), Reset to Library (modified), Update to Library Version (newer library available)
- "View Changes" on modified packages opens the Package Diff Modal

**Document tab** — Manage all packages loaded in the document:
- Lists every `SchemaPackage` in the document (library-origin and user-created)
- Each card shows: name, color, schema count, origin badge ("Library" vs custom)
- For library-origin: drift status (clean/modified/desync) and update availability
- "View Changes" and "Publish" actions per package
- "+ Create Package" button: inline form with name, color, description, optional schema selection from unpackaged schemas

**Package Diff Modal** — Schema-level change summary:
- Opened from "View Changes" on modified or update-available packages
- Shows schemas grouped by status: Added (green), Removed (red), Modified (amber)
- Modified schemas expand to show field-level changes
- When both local modifications and library updates exist: toggle between "Your Changes" (doc vs snapshot) and "Library Update" (snapshot vs library)
- Footer action: "Reset to Library" or "Update to Library Version"

**Publish** — Export `.carta-schemas` file:
- Available on Document tab for packages with schemas
- Extracts current document state as `SchemaPackageDefinition`
- Downloads as `.carta-schemas` JSON file (portable package format)

## Design Decisions

### Fork ancestry, not live linking

When a library package is loaded into a document, the document gets a **snapshot copy**. The document is self-contained — no runtime dependency on the library. The snapshot enables diff/drift tooling but doesn't constrain the document.

Rationale: Live linking violates single source of truth. The document's schemas would be computed from library + delta, making them harder to reason about. Fork ancestry keeps documents independent while enabling optional sync.

### Built-in port schemas are document template, not a package

Built-in port schemas (flow-in/out, parent/child, relay, intercept, symmetric) are part of every new document's initial state — like how a new document has empty maps for nodes and schemas. They are M2-level plumbing, not opt-in packages. They have no `packageId`.

### Loading and repair

Loading a package is a one-time operation. Re-loading the same UUID is blocked by the manifest idempotency check. However, packages can enter desynced states (e.g., schemas lost during export/import, partial sync). A **repair** action in the package picker allows users to reset a package to the standard library version:

1. Clear the manifest entry (removes idempotency block)
2. Remove existing schemas, port schemas, groups, and relationships for the package
3. Re-apply the package from the standard library definition

For packages with 0 schemas (desync), this is labeled "Repair." For packages with user-modified schemas, this is labeled "Reset to library version" with a confirmation warning — instance data is preserved but custom fields become orphaned (visible in the instance editor).

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

The existing schema seeds are repackaged as `SchemaPackageDefinition` objects with stable UUIDs, shipped in `@carta/schema`:

- Software Architecture (services, APIs, databases)
- BPMN (activities, events, gateways)
- AWS (EC2, S3, Lambda)
- Capability Model (capabilities, sub-capabilities)
- Sketching (Note, Box — low-friction types)

Each has a catalog entry with displayName, description, and color for the package picker.

## Interactions

### Loading a package

1. User opens package picker → Library tab
2. Browse standard library packages
3. Each package shows: name, description, schema count, color, status
4. Load → `applyPackage()` writes to document + manifest

### Checking for drift

The package picker shows drift status per loaded package:

- **Loaded** — matches snapshot (content hash unchanged)
- **Modified** — document schemas differ from snapshot (user edits)
- **Update Available** — snapshot differs from current standard library (app shipped newer version)
- **Repair available** — manifest exists but 0 schemas match the packageId (desync)

### Viewing changes (diff)

"View Changes" on a modified package opens the **Package Diff Modal**:

1. Shows schema-level summary: added/removed/modified schemas with field-level details
2. When both local modifications and library updates exist, toggle between "Your Changes" and "Library Update" views
3. Footer action: "Reset to Library" or "Update to Library Version"

### Creating a package

1. User opens package picker → Document tab
2. Click "+ Create Package"
3. Enter name, color, description
4. Optionally select unpackaged schemas to include
5. Creates `SchemaPackage` entry; selected schemas get `packageId` assigned
6. New package appears in metamap as a container; additional schemas can be dragged in

### Publishing a package

1. User opens package picker → Document tab
2. Click "Publish" on any package with schemas
3. Current document state is extracted as a `SchemaPackageDefinition`
4. Downloads as a `.carta-schemas` file

### Orphaned data visibility

When a schema is reset or replaced, construct instances may retain field values that no longer match the schema's field definitions. This orphaned data is:

- **Visible in the instance editor**: An "Orphaned Data" section below schema fields shows key-value pairs that don't match any current field name. Read-only display.
- **Visible in MCP responses**: `get_construct` includes an `orphanedValues` key when orphans are detected, so AI tools can assist with data migration.
- **Never auto-deleted**: Orphaned data persists until explicitly removed by the user or AI tools. This preserves work that may be recoverable via field renaming or schema edits.

## Library File Format

A `.carta-schemas` file — the portable package format:

```json
{
  "formatVersion": 1,
  "type": "carta-schemas",
  "package": { ...SchemaPackageDefinition }
}
```

Contains M1 definitions only:

- SchemaPackage metadata (name, description, color)
- Schemas (`ConstructSchema[]`)
- In-package port schemas (`PortSchema[]`)
- Schema groups (`SchemaGroup[]`)
- Schema relationships (`SchemaRelationship[]`)
- No instances, no pages, no M0 data

## Metamap Presentation

- **Package nodes**: Rendered as top-level organizer containers. Show package name, color, and drift badge.
- **Schema groups**: Rendered as nested organizers within the package.
- **Cross-package edges**: Connections between schemas in different packages use document-level or built-in port types.

## Out of Scope

- Remote sync protocol (libraries are files; sync is the vault's job)
- Multi-user concurrent library editing
- Automatic update notifications (update detection is user-initiated via package picker)
- Library dependency resolution
- Library marketplace or sharing platform
- Port classification metadata — bundling is derived from reference graph
- Per-schema revert in diff view (whole-package reset only)
- Merge/cherry-pick between library and document versions
- Importing `.carta-schemas` files (future — would use `applyPackage`)
