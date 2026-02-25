---
title: "Resources: versioned data contracts in the metamodel"
status: draft
---

# Decision 008: Resources — Versioned Data Contracts in the Metamodel

## Context

Carta's metamodel is optimized for graph relationships — typed nodes connected by ports. This works well for architecture diagrams ("Service A calls Service B") but is awkward for structured data models — things with fields, nested objects, arrays, constraints, and evolution over time.

Real-world modeling frequently involves data contracts: API payloads, database schemas, TypeScript interfaces, OpenAPI specs, DBML definitions. These are "shape-first" artifacts — their identity is their structure, not their position in a graph. Users currently approximate them with construct schemas and parent/child connections, which is verbose and loses the "shape" of the data. There is also no way to track how these models evolve.

### What is a resource?

A resource is a materialization of an external artifact — a distilled representation that eases translation between Carta and source code, and between Carta pages themselves. It is a document-level entity that exists alongside schemas and pages. It is not a canvas object. It does not appear as a node on the map.

Resources are reference material: they define the shape of data that exists (or will exist) outside the Carta document. Constructs on the map can reference resources via the `resource` DataKind, creating links between "what the data looks like" (the resource) and "how the data flows through the system" (the graph).

### The dialectical nature of resources

Resources sit between source code and instance maps. The flow is bidirectional:

- **Bottom-up (distillation):** A user has legacy code or an existing API. An MCP agent reads the code and distills a resource from it — a JSON Schema, a TypeScript type, an OpenAPI fragment. This resource then informs schema creation, letting the agent generate a construct vocabulary that mirrors the real system.

- **Top-down (iteration):** A user models an architecture on the canvas — services, endpoints, data flows. Through modeling, they discover the shape of data contracts that don't exist yet. The map work spurs resource creation, and the resource becomes the specification that drives code generation.

Neither direction is primary. A resource might be born from code and refined on the canvas, or born on the canvas and compiled to code. This dialectic — code informs model, model informs code — is the core value proposition. It means resources must be editable both through MCP tooling (programmatic) and through the UI (visual), and changes from either direction must be trackable.

### Dual mandate implications

- **Modeling capability:** Resources must be rich enough to represent real data contracts (nested objects, arrays, enums, constraints) without forcing decomposition into construct graphs. But they must also be bounded — a resource is not a general-purpose file store.
- **Compilation sufficiency:** Resources must compile to AI-readable output alongside the construct graph. An AI agent needs both the "shape" (resource) and the "relationships" (connections) to generate quality code.

## Decision

### Format is user-determined

Resources are format-agnostic. A resource has a declared format (JSON Schema, TypeScript type, OpenAPI fragment, DBML, freeform text, or anything else) and a body. Carta does not enforce or validate the body against the format — it stores and compiles whatever the user provides.

Rationale: Carta cannot anticipate every domain's contract format. Blocking one shape over another would limit modeling capability (dual mandate, leg 1). The user is the authority on what constitutes a valid resource in their domain.

Static analysis and validation of resource content is the user's responsibility. Carta may in the future provide a plugin system for user-authored validation (see "Future: Plugin system for resource validation" below), but the core resource primitive is intentionally unvalidated.

### Resource bodies are opaque to Carta

Resources have internal structure — nested types, fields, constraints — but Carta does not parse or understand that structure. The body is an opaque string. Carta stores it, versions it, compiles it, and presents it. Parsing, validation, and structural understanding are the domain of the user and their MCP agents.

This means a single resource can represent an arbitrarily complex model (a full document model as a 200-line TypeScript definition, or a 5,000-line OpenAPI spec). Carta doesn't need to decompose it into parts. The user decides granularity — one resource per API, one per entity, one per entire system — based on what makes sense in their domain.

### The `resource` DataKind

Resources introduce the first reference type to Carta's DataKind system, expanding it from five scalar kinds to six (see doc01.02, doc02.06).

A field of type `resource` stores a compound value:

```
{
  resourceId: string         // which resource
  pathHint: string           // where in the resource (freeform, optional)
  versionHash: string        // content hash of the resource version this reference was made against (optional)
}
```

The `versionHash` pins the reference to a specific published version's content hash. This enables per-field drift detection: if the resource's current hash differs from the field's `versionHash`, the reference is stale. The hash is deterministic and directly comparable — no need to resolve a UUID.

The `pathHint` is a human/AI-readable string. Carta stores and displays it but never validates or navigates it. It means whatever makes sense for the resource's format:

| Format | Example pathHint |
|--------|-----------------|
| TypeScript | `ConstructNodeData.connections` |
| OpenAPI | `paths./api/users.get.responses.200` |
| Book | `Chapter 3, p.42` |
| DBML | `Table users` |
| Freeform | `the section about billing` |

#### Why a DataKind, not a connection or proxy construct

Connections (ports) link constructs to constructs on the canvas. Resources are not on the canvas — there is no target node to connect to. A proxy construct whose only job is to stand in for a resource adds ceremony without value. A field type is the natural mechanism: it's rendered in the inspector (as a resource picker + pathHint text input), on the canvas (as a pill showing the resource name), and in compilation (as a reference the AI can resolve).

#### UI rendering of resource fields

- **Inspector:** Resource picker dropdown (list of document resources) + text input for pathHint
- **Canvas pill:** Shows resource name + pathHint, e.g. "Carta Document Model → Page.nodes"
- **Canvas pill (no pathHint):** Shows resource name only, e.g. "Prospect API"
- **Drift indicator:** If versionHash doesn't match the resource's current hash, show a stale indicator on the pill

#### How this replaces `resourceId` on schemas

Earlier design exploration considered a magic `resourceId` property on ConstructSchema for schema-resource linking. The `resource` DataKind is more general — any construct on any schema can reference any resource. A schema can include a `resource`-type field (e.g., "implements") to declare which resource it's derived from, but this is a regular field, not special metamodel plumbing.

### Isolation between resources and the map

Map editing (creating constructs, connecting ports, rearranging nodes) **never mutates a resource**. Resources and the instance graph are independent entities with independent lifecycles. A user can freely iterate on the map without touching any resource, and freely edit a resource without affecting any page.

The dialectical flow between resources and the map is mediated by MCP agents, not by automatic side effects:

- An agent can **detect drift** between a resource and the schemas/instances that reference it — e.g., "the Prospect resource now has a `billingAddress` field, but the Prospect schema on the map doesn't have a corresponding child construct"
- An agent can **recommend changes** to either side — update the resource to match what the map discovered, or update the map to match what the resource defines
- The user (or agent) **acts on the recommendation** — editing the resource body, publishing a new version, or updating schemas/instances on the map

This keeps resources inert from the map's perspective. No cascade effects, no surprise mutations. The intelligence lives in the MCP session, not in the data model.

### MCP tool surface

Resources are managed through a multiplexed `carta_resource` tool following the existing pattern (doc02.03):

```
carta_resource { op: list | get | create | update | delete | publish | history | diff }
```

- `op: list` — list all resources (id, name, format, currentHash, version count)
- `op: get` — get resource by id (includes current body)
- `op: create` — create resource with name, format, body
- `op: update` — edit the working copy body (no version created)
- `op: delete` — delete resource (fields referencing it become orphaned)
- `op: publish` — create a published version snapshot from the current working copy
- `op: history` — return the version timeline for a resource
- `op: diff` — compare two versions, or working copy against a published version

Publishing is a distinct, intentional operation — never a side effect of `update`. An MCP agent that modifies a resource body updates the working copy; it must issue a separate `publish` call to create a version. This gives users (or agents acting on their behalf) explicit control over when a version boundary is drawn.

### Relationship to schemas

Resources inform schemas but do not replace them:

- A resource defines a data shape
- Carta (or an MCP agent) can generate or suggest ConstructSchemas from a resource (e.g., a JSON Schema with nested objects → parent construct + child constructs)
- Schemas can include a `resource`-type field (e.g., "implements") whose value points to the resource, establishing a queryable link
- When the resource updates, an MCP agent can find all schemas/constructs with resource-type fields pointing to it and check for drift

This preserves the metamodel's graph nature while adding a "dictionary" layer that gives constructs their shape.

### Versioning: working copy + published versions

Resources use a **working copy model** — free edits without version overhead, with intentional publication when the user wants to mark a milestone.

#### Working copy

The resource body is freely editable at all times. Every edit updates the working copy in the Y.Doc. No version is created, no history entry is recorded. This is how users explore, iterate, and refine a resource without ceremony.

Content hashing (SHA-256 of the body) provides instant drift detection: "has this resource changed since the last published version?" — without requiring the user to do anything.

#### Published versions

When a user deliberately chooses to publish, Carta creates a **version snapshot**:

```
ResourceVersion {
  versionId: string              // UUID
  contentHash: string            // SHA-256 of body at publish time
  publishedAt: string            // ISO timestamp
  label: string                  // User-provided (optional, e.g., "Added billing address")
  body: string                   // Frozen copy of the resource body
}
```

The label is optional but encouraged. A published version with no label shows as its timestamp in the UI. Labels are not version numbers — they are human-readable notes explaining the change.

#### Why not automatic versioning?

Automatic snapshots on every edit would create noise (dozens of versions per editing session). Semver would impose categorization decisions ("is this major or minor?") that users won't make consistently. Auto-increment gives meaningless numbers. The working copy + publish model matches how real-world contracts evolve: continuous editing punctuated by intentional "this is the new version" moments.

#### Analogy

This is closer to **document publishing** (Google Docs → "Name this version") than to **source control** (git commits). The working copy is always live. Published versions are bookmarks.

### Version history storage

Published versions form an append-only list stored on the resource entity in the Y.Doc. This is not git — there is no DAG, no branches, no merge.

The history is a flat timeline:

```
Resource {
  id: string
  name: string
  format: string                     // "json-schema", "typescript", "openapi", "freeform", etc.
  body: string                       // Current working copy
  currentHash: string                // SHA-256 of current body
  versions: ResourceVersion[]        // Append-only published version history
}
```

**What you can do with history:**
- View any published version's body
- Diff any two published versions, or diff working copy against the latest published version
- See when and why (if labeled) each version was published

**What you cannot do (and why):**
- Revert to a previous version by overwriting the working copy — *could be added later, but not required at launch*
- Branch or fork a resource — *resources are single-timeline entities; branching is document-level (copy the document)*
- Rebuild history from content hashes alone — *the full body is stored per version, not as deltas*

#### Comparison to schema packages

Schema packages (doc02.04.07) store a single snapshot at load time and detect drift against it. Resources extend this pattern with **multiple snapshots** (published versions), enabling a richer history. But the fundamental mechanism is the same: content hash for drift detection, frozen body for diffing.

### Version pinning lives on the field value

There is no separate page-resource binding entity. The `versionHash` on each resource field value IS the binding. This means:

- **Drift detection is per-construct:** "This construct's resource reference was made against hash X, but the resource is now at hash Y"
- **No page-level bookkeeping:** The version pin travels with the field value, not with the page
- **Updating is explicit:** The user or agent updates the field's `versionHash` to acknowledge a newer resource version

This is simpler than a page-level binding map and more granular — different constructs on the same page can reference different versions of the same resource.

### Compiler integration

The compiler emits resources in context — not parsed, but juxtaposed with the architectural graph that references them. The value is juxtaposition: the AI gets the data contract AND the architectural graph AND the links between them. Carta doesn't parse the resource — the consuming AI does.

Proposed output structure (extending existing compiler output):

```json
{
  "resources": [
    {
      "name": "Prospect API",
      "format": "typescript",
      "body": "...(the full type definition)...",
      "version": { "label": "Added billing address", "publishedAt": "2026-02-24T..." },
      "referencedBy": [
        { "schemaType": "ProspectService", "field": "implements", "pathHint": "Prospect" },
        { "schemaType": "AddressValidator", "field": "target", "pathHint": "Prospect.billingAddress" }
      ]
    }
  ]
}
```

This resolves the tension between "format-agnostic" and "compilation-sufficient" — Carta doesn't need to understand the format to produce useful output. It emits the body and the reference graph; the consuming AI interprets both.

### Resource view

Resources get their own top-level view, equivalent in stature to the Map, Metamap, and Layout Map views. Selecting a resource opens a dedicated view for viewing and editing its body.

**POC approach:** The resource view is an uncoupled component — a resource list and a body editor. It does not need to integrate with the existing page selector at launch.

**Future direction:** A left-side navigation panel (VS Code / Obsidian style) will let users switch between page selector and resource selector. The page selector drives map/metamap/layout views; the resource selector drives the resource editor view. This unifies navigation but is out of scope for the initial implementation.

### File format

Resources are included in the `.carta` file as a top-level `resources` array, alongside `schemas`, `pages`, etc.

```json
{
  "title": "My Project",
  "schemas": [...],
  "pages": [...],
  "resources": [
    {
      "id": "abc-123",
      "name": "Prospect API",
      "format": "typescript",
      "body": "...",
      "currentHash": "sha256-...",
      "versions": [...]
    }
  ]
}
```

Import follows the same merge-not-replace pattern as schemas (doc01.02, "Deletion Requires Conscious Intent"). Conflict detection on import: if a resource with the same ID already exists, show it in the preview modal.

### Y.Doc storage

Resources live in a top-level `resources` Y.Map on the document, keyed by resource ID. Each resource is a Y.Map containing:

- Scalar fields (`id`, `name`, `format`, `body`, `currentHash`) as Y.Map entries
- `versions` as a Y.Array of ResourceVersion objects

This follows the same pattern as `schemas`, `pages`, and `packages`.

### DocumentAdapter surface

New methods on DocumentAdapter:

- `getResources()` → all resources (summary)
- `getResource(id)` → single resource with current body
- `createResource(name, format, body)` → create
- `updateResource(id, { name?, format?, body? })` → edit working copy
- `deleteResource(id)` → remove
- `publishResourceVersion(id, label?)` → snapshot current body as published version
- `getResourceHistory(id)` → version timeline
- `getResourceVersion(id, versionId)` → specific version body

## Consequences

- The metamodel gains a new entity class (Resource) at M1 level — user-defined, document-scoped, versioned
- DataKind expands from five scalar types to six (adding `resource` as the first reference type). The "DataKind Is Exhaustive" principle (doc01.02) and metamodel doc (doc02.06) are updated accordingly
- Compiler output gains a `resources` section: resource bodies + reference graph from constructs that point to them
- MCP tool surface grows by one multiplexed tool (`carta_resource`)
- Schema packages and resources are orthogonal — a schema can belong to a package AND have a resource-type field
- Y.Doc gains a new top-level map, adding to document size proportional to resource count and version history depth
- Resource-type fields on constructs become orphaned if the referenced resource is deleted (same pattern as orphaned field values when a schema changes)

## Dialectical analysis (design validation)

### Test case: modeling Carta's document interaction surface

A Carta document modeling how UI actions and MCP operations interact with the document model. The document model itself is a resource (TypeScript type hierarchy). Pages show interaction topology:

- **Page: "UI Interactions"** — UI action constructs (e.g., "Add Related", "Connect Ports") → AdapterMethod constructs (e.g., `addNode`, `addConnection`) → Document Entity constructs (e.g., "Node", "Page")
- **Page: "MCP Tool Surface"** — MCP operation constructs → same AdapterMethod constructs → same Document Entity constructs

Each AdapterMethod construct has a `resource`-type field `mutates` with value `{ resourceId: "carta-doc-model", pathHint: "Page.nodes" }`. The resource holds the full type hierarchy; the map holds the interaction graph. The resource lets the map stay clean (entity-level constructs, not field-level) because the detail lives in the resource body.

Both pages reference the same resource. The resource is the shared vocabulary — the intermediate representation that eases translation between pages and between Carta and source code.

### Where resources add the most value

Resources are most valuable when there's a **gap between a real external system and the map** — and the resource bridges that gap. The resource is a materialization of an external artifact: a real API, a real database schema, a real TypeScript interface.

For example, a Prospect API at work: the resource IS the TypeScript interface. The map shows how the Prospect flows through services, validators, and data stores. When the API changes, the resource is updated, drift is detected, and the map is reconciled. Without the resource, the map drifts from reality silently.

Resources add less value when the map IS the primary artifact (nothing external to drift from). In that case, the map is already the source of truth.

### Tensions acknowledged

| Tension | Resolution |
|---------|------------|
| Format-agnostic vs. compilation-sufficient | Compiler emits resource in context (juxtaposition), not parsed. The consuming AI interprets the format |
| Resource as static reference vs. resource as living document | Working copy is always live; published versions are stable bookmarks. Both states coexist |
| One big resource vs. many small ones | User decides granularity. Carta doesn't decompose. One resource per API or one per entire system — whatever fits the domain |
| Resources inform schemas, but schemas also inform resources | Mediated by MCP agents, not automatic coupling. Isolation prevents cascade; intelligence enables reconciliation |
| Referencing sub-parts of a resource without parsing it | `pathHint` — freeform string, unvalidated, means whatever makes sense for the format. Future plugins could provide structured navigation |

## Future: Plugin system for resource validation

Because resources are format-agnostic, Carta cannot validate resource content out of the box. A future plugin system could let users register validators per format.

### Survey of plugin approaches

| Approach | Example | Execution model | Tradeoffs |
|----------|---------|----------------|-----------|
| **Declarative schema** | JSON Schema / AJV | Schema document references pre-registered validators | Clean security boundary (schema = data, validator = trusted code). Users can't define truly arbitrary validation without developer involvement |
| **Sandboxed JS (WASM)** | Figma plugins | User JS runs in QuickJS compiled to WebAssembly; communicates with host via postMessage | Strong isolation; production-proven in browsers. Complex for plugin authors (two-sided architecture, async-only) |
| **Unsandboxed JS** | VS Code, Obsidian | Extensions run in Node.js / Electron with full system access | Maximum power; huge ecosystems. Security depends entirely on user trust, not runtime enforcement |
| **Inline expressions** | Retool, low-code platforms | JS expression strings evaluated in app context | Fast to write. No isolation — only viable for trusted single-org contexts |
| **Serverless per-execution** | Zapier Code steps | User code runs in AWS Lambda per invocation | Process-level isolation. Latency and cost overhead; overkill for simple field checks |

**Recommended direction for Carta (when the time comes):**

Start with the **declarative model** — Carta ships named validators for common formats (JSON Schema, OpenAPI, TypeScript via a parser). Users select a format, and Carta applies the matching validator if one exists. No custom code execution.

If demand warrants it, the **Figma-style QuickJS/WASM sandbox** is the production-proven path for browser-based execution of untrusted user code. It provides strong isolation without requiring server infrastructure.

This is explicitly out of scope for the initial resource implementation.

## Open Questions

1. Are resources per-document or can they be shared across documents (like schema packages)? Document-scoped at launch; sharing is a library concern for later
2. How large can a resource body + version history grow before Y.Doc performance degrades? Practical sizes range from ~2 KB (single interface) to ~200 KB (full OpenAPI spec). Version history multiplies this. May need pruning or size warnings for extreme cases
