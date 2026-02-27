---
title: "Filesystem-first workspace architecture"
status: draft
supersedes: "Unified deployment model (ADR 004), partially"
---

# Decision 009: Filesystem-First Workspace Architecture

## Context

Carta's document model is a monolithic Y.Doc: a single CRDT document containing all pages, schemas, resources, constructs, edges, and organizers. This model was appropriate when Carta was a typed diagramming tool, but the product vision has shifted toward **spec-driven development** — a multi-level specification system where users enrich napkin descriptions through progressively more specific artifacts until reaching specifications that AI can reliably translate into production code.

### The Code-N ladder

The core thesis (doc01.05.01) asks: what is the maximum distance between code and its nearest artifact, such that AI can translate between the two reliably? The answer is a ladder of specification levels:

```
napkin description → Code-∞
    ↓
product vision     → Code-3
    ↓
architecture spec  → Code-2
    ↓
implementation plan → Code-1
    ↓
production code
```

Each level enriches the previous one. Refactoring at Code-3 propagates down to Code-1 and then to production code. Carta needs to support this workflow — which means supporting heterogeneous artifacts (canvases, data contracts, prose specs, API definitions) organized into logical groups at different specification levels.

### Why the monolithic Y.Doc doesn't fit

The monolithic document model creates friction for the Code-N workflow:

- **Pages and resources are flat lists** — no way to express that certain artifacts belong together at a specification level
- **Resources have Carta-specific versioning** when the industry already has git
- **AI agents can't work with the document directly** — everything goes through MCP tools, even reading a TypeScript type definition
- **The document is opaque to the OS** — no filesystem search, no git diff, no external tool access
- **Schema sharing is document-scoped** — can't share schema definitions across projects via npm or git submodules

The industry is converging on spec-driven development (Thoughtworks's "spec-first/spec-anchored/spec-as-source" taxonomy, AWS Kiro's Requirements→Design→Tasks pipeline, GitHub's spec-kit). These tools all share a common insight: **specifications should be files in a repository, versioned with git, editable by both humans and AI agents**.

### Precedent: filesystem-first tools

| Tool | Config dir | Content format | Filesystem role |
|------|-----------|----------------|----------------|
| Obsidian | `.obsidian/` | Markdown files | Vault = directory. App watches and renders. Git provides versioning |
| VS Code | `.vscode/` | Source files | Workspace = directory. App provides editing intelligence |
| JetBrains | `.idea/` | Source files | Project = directory. App provides indexing and refactoring |
| Zed | `.zed/` | Source files | Worktree snapshots with immutable `Arc` for lock-free reads |
| Dendron | `dendron.yml` | Markdown w/ frontmatter | Multi-vault workspace. Schema files validate note hierarchies |

Universal pattern: the config directory stores app state (how to view/edit), not content. Content lives as individual files the user can see, move, rename, and version-control independently.

## Decision

### Workspace = directory with `.carta/` config

A Carta workspace is a directory containing a `.carta/` configuration directory and content files organized by the user. The `.carta/` directory plays the same role as `.obsidian/`, `.vscode/`, or `.idea/` — it stores Carta-specific configuration and transient state, not content.

```
my-project/
├── .carta/
│   ├── workspace.json          # Workspace metadata: title, version, compiler config
│   ├── ui-state.json           # Gitignored: active page, panel sizes, zoom levels
│   └── .state/                 # Gitignored: binary Y.Doc sidecars for collaboration
│       ├── endpoint-map.ystate
│       └── service-layers.ystate
│
├── 01-product-vision/          # Spec group = directory
│   ├── _group.json             # Group metadata: name, description
│   ├── domain-sketch.canvas    # Canvas file (JSON)
│   └── user-stories.md         # Resource: just a file
│
├── 02-api-contract/
│   ├── _group.json
│   ├── endpoint-map.canvas
│   ├── prospect-api.ts         # Resource: TypeScript type
│   └── openapi-spec.yaml       # Resource: OpenAPI
│
├── schemas/                    # Shared across all canvases
│   ├── endpoint.schema.json
│   └── service.schema.json
│
└── .gitignore                  # Ignores .carta/ui-state.json, .carta/.state/
```

### Content file types

**`.canvas` files** — JSON representation of a canvas page. Contains nodes (constructs with positions, field values, connections), edges, and organizers. Human-readable, git-diffable. One canvas per file. This is the Carta-native format, equivalent to a "page" in the current model.

**`.schema.json` files** — Schema definitions. Shared across all canvases in the workspace. Contains construct type definitions with fields, ports, display properties. Equivalent to the current schema entries in the Y.Doc.

**`_group.json` files** — Spec group metadata. The directory IS the group; this file provides its name and description. The `_` prefix convention signals metadata, not content.

**Resource files** — Any format: TypeScript, JSON Schema, OpenAPI, DBML, Markdown, freeform text. Carta stores and compiles them but does not parse or validate their content (same principle as ADR 008). The filesystem IS the resource storage — no Carta-specific resource format.

**`workspace.json`** — Workspace manifest. Contains workspace title, schema version, compiler configuration. Does NOT contain file listings — the filesystem is the manifest.

### Dual representation: JSON canonical, binary sidecar

Canvas files are JSON — the canonical, git-versioned representation. Binary Y.Doc state (required for Yjs CRDT collaboration) is stored as a sidecar in `.carta/.state/`, gitignored.

On canvas open:
1. If `.ystate` sidecar exists and is newer than `.canvas` → hydrate Yjs from binary (preserves CRDT history for seamless collaboration continuity)
2. If sidecar is missing or stale (e.g., `.canvas` was edited externally via git) → rebuild Y.Doc from JSON (fresh CRDT, no merge history)

On save / session end:
- Write JSON to `.canvas` (the canonical file)
- Write binary to `.carta/.state/*.ystate` (the collaboration cache)

This means `git diff` always shows the real state. External tools (AI agents, text editors) can read and write `.canvas` JSON directly. The binary sidecar is a performance optimization for collaboration, not a correctness requirement.

### Spec groups = directories

Spec groups are directories with numbered prefixes (`01-product-vision/`, `02-api-contract/`). Ordering is lexical — the same convention as `.docs/` titles. This means:

- The directory structure IS the spec group hierarchy
- Renaming/reordering is a filesystem operation (rename the directory)
- Nesting is supported naturally (subdirectories)
- `_group.json` provides the human-readable name and description that appears in the navigator and compiler output

Files not inside a spec group directory (e.g., at the workspace root) appear in an "ungrouped" section.

### MCP narrows to canvas + schema editing

In a filesystem-first world, AI agents (Claude Code, Cursor, etc.) can read and write files directly. MCP tools are only needed for operations that require Carta's runtime:

| Capability | Mechanism |
|-----------|-----------|
| Read/write resources | Agent reads/writes files directly |
| Version resources | Git (commit, log, diff) |
| List workspace contents | Agent reads directory tree |
| Read/write canvas constructs | MCP tools (binary Y.Doc requires Carta's adapter) |
| Schema operations + migration | MCP tools (transactional: rename field + update all canvases) |
| Layout algorithms | MCP tools (compute positions, write back to Y.Doc) |
| Compilation | CLI command (`carta compile .`) or MCP tool |

The MCP tool surface shrinks from 13 tools to approximately 5:

```
carta_canvas    { op: list | get | create | update | delete | connect | disconnect | move | ... }
carta_schema    { op: list | get | create | update | migrate | ... }
carta_layout    { op: flow | arrange | pin | ... }
carta_compile
carta_workspace { op: status | init }
```

### `carta init` emits workspace scaffold + agent instructions

Initializing a workspace creates the `.carta/` directory and can optionally emit agent instruction files:

```
$ npx carta init

Created .carta/workspace.json
Created schemas/
Created .gitignore entries
```

The workspace scaffold can include a `CLAUDE.md` or skill file that teaches AI agents how to work with the workspace — when to use MCP tools (canvas/schema editing) vs. direct file operations (resources), how the spec group hierarchy works, how to compile.

### Server architecture: `carta serve .`

The Carta server becomes a **workspace server** that serves a directory:

```
$ npx carta serve .
Serving workspace at http://localhost:51234
```

The server:
- Watches the workspace directory tree (file change notifications)
- Serves individual canvas files as Y.Docs (one WebSocket room per canvas)
- Exposes the directory tree as REST (for the navigator)
- Handles JSON↔binary sidecar reconciliation
- Runs the compiler by walking the workspace directory
- Serves the static web client bundle
- Exposes MCP tools for canvas/schema editing

This is the same server used by:
- **Desktop app**: Electron wraps it with native chrome, tray icon, auto-launch
- **Local development**: Developer runs `npx carta serve .` in their repo
- **Enterprise/SaaS**: Hosted server with auth, permissions, multi-workspace

### Deployment modes

| Mode | How it starts | Filesystem | Collaboration |
|------|--------------|-----------|--------------|
| **Desktop app** | Launch Carta.app | Embedded server, real filesystem | Local or remote |
| **Local server** | `npx carta serve .` | Standalone server, any browser | Local (single user) or LAN |
| **Remote server** | Enterprise/SaaS hosted | Server-side filesystem or object store | Multi-user WebSocket |
| **Demo site** | Visit carta.dev | No filesystem, IndexedDB single canvas | None |

Only two architectures:
1. **Server-backed** (desktop, local CLI, remote hosted) — full workspace, collaboration, MCP
2. **Serverless** (demo site) — single canvas playground in IndexedDB, no workspace features

The web client does not use the File System Access API or IndexedDB filesystem emulation. Workspace features require a server (local or remote). This keeps the browser client simple — it always connects to a server for workspace operations.

### Supersedes ADR 004 (partially)

ADR 004's two-mode model (single-document vs. multi-document based on server presence) still holds conceptually but the semantics change:

- **No server** → single canvas playground (demo site). Same as ADR 004's "single-document mode"
- **Server present** → workspace mode. Replaces ADR 004's "multi-document mode" with filesystem-backed workspaces instead of server-managed document collections

The `VITE_SYNC_URL` / `VITE_AI_MODE` configuration model survives. `VITE_SYNC_URL` still means "connect to this server." What the server provides changes from "a list of Y.Doc documents" to "a workspace directory."

## Consequences

### What we gain

- **Git versioning for free** — replaces Carta's resource publish/history/diff system entirely. Every file in the workspace is version-controlled by the user's VCS
- **AI agent interoperability** — agents read/write spec files directly without MCP. Canvas and schema editing still needs MCP, but the workspace is legible to any tool
- **OS-level capabilities for free** — file search (ripgrep, Spotlight), file management (rename, move, delete), access control (permissions, .gitignore), backup (Time Machine, cloud sync), diffing (git diff)
- **Spec groups without new domain entities** — directories with numbered prefixes. No Y.Doc schema for groups, no migration, no new state management
- **`.docs/` as a pattern, not a one-off** — the xx.yy.zz numbering convention becomes a Carta feature. Carta is "`.docs/` with a canvas editor, schema validation, and compilation"
- **Desktop app becomes optional** — `npx carta serve .` gives the full experience in any browser

### What we lose or must migrate

- **Monolithic `.carta` file format** — the current single-file import/export format is replaced by the workspace directory. A migration tool (or AI agent script) can explode a `.carta` file into a workspace directory. Sharing a workspace = zip the directory or push to git
- **Carta-managed resource versioning** — the working copy + published versions model (ADR 008) is replaced by git commits. Resource bodies are just files. Version pinning on construct fields would reference git commit hashes instead of Carta content hashes
- **Single-Y.Doc simplicity** — one Y.Doc per workspace becomes one Y.Doc per canvas. The server manages multiple Y.Doc instances. Connection management and memory usage patterns change
- **Browser-only multi-file editing** — no more multi-document browser mode without a server. The demo site is single-canvas only. This is acceptable because the target audience (developers in repos) always has access to a local server

### What changes in existing systems

| System | Change |
|--------|--------|
| **DocumentAdapter** | Per-canvas scope instead of per-document. Multiple adapters active simultaneously (one per open canvas tab) |
| **Compiler** | Walks workspace directory tree instead of Y.Doc. Reads canvas JSON files + resource files + schema files. Spec groups become top-level sections in output |
| **Navigator** | Reads directory tree from server REST API. Spec groups = directories. Pages and resources interleaved by filesystem order |
| **Schema system** | Schemas loaded from `.schema.json` files. Shared across all canvases. Schema editing writes files via server API |
| **Import/Export** | `.carta` monolithic file becomes a legacy import source (explode into workspace). Export = zip the workspace directory |
| **MCP tools** | Reduced surface: canvas + schema + layout + compile + workspace init. File operations delegated to agent |
| **Server** | Becomes workspace-aware: directory watching, per-canvas Y.Doc management, REST file API, static asset serving |

### Future: canvas as editor plugin

The dual representation (JSON canonical, Y.Doc for runtime) creates a natural seam for embedding Carta's canvas as a plugin in other editors:

- **VS Code**: A `.canvas` file type registered with a custom editor provider. VS Code handles the workspace, file tree, git, tabs. Carta provides the canvas renderer/editor as a webview
- **Zed**: A `.canvas` file type with a custom rendering engine. Zed handles the worktree, file watching, collaboration. Carta provides the canvas logic
- **Obsidian**: A `.canvas` file type plugin (like the Excalidraw plugin). Obsidian handles the vault, linking, search. Carta provides rich typed-node canvas editing

In each case, the host editor owns the filesystem and workspace. Carta's contribution narrows to: **canvas rendering + schema-aware editing + compilation**. The canvas becomes a file format with an editor, not a standalone application.

This is enabled by the filesystem-first architecture because:
1. `.canvas` files are JSON — any editor can register a handler for them
2. Schemas are separate files — the host editor's file tree shows them alongside canvases
3. Spec groups are directories — the host editor's sidebar IS the navigator
4. Compilation is a CLI command — works from any editor's terminal

The standalone Carta app (`carta serve .`) would then serve users who want the integrated experience (navigator, spec groups, multi-canvas tabs) without installing VS Code or Zed.

## Open questions

1. **Canvas JSON schema**: What is the exact JSON structure of a `.canvas` file? Likely a subset of the current `.carta` export format (one page's worth of nodes, edges, organizers) plus a header referencing which schema files it uses
2. **Cross-canvas references**: Can a construct on one canvas reference a construct on another canvas? If so, references need to be `file:semanticId` pairs. If not, the compiler handles cross-canvas relationships through shared schema and resource references
3. **Schema file granularity**: One `.schema.json` per schema, or one file containing all schemas? Per-schema is more git-friendly (atomic diffs). All-in-one is simpler to manage. Could support both via a `schemas/` directory convention
4. **Hot reload**: When an external tool modifies a `.canvas` or `.schema.json` file while Carta is running, how does the server detect and reconcile? Filesystem watching with debounce (Zed uses 100ms). Conflict resolution when both Carta and an external tool modify the same file simultaneously
5. **Compilation scope**: Does `carta compile .` compile the entire workspace, or can you compile a single spec group? Probably both: `carta compile .` for full workspace, `carta compile ./02-api-contract/` for a single group
