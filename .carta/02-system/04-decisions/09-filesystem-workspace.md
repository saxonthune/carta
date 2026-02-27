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

### Workspace = project directory with `.carta/` vault

A Carta workspace is a project directory containing a `.carta/` vault directory. The `.carta/workspace.json` describes the project in `..` — the parent directory is the project root. All Carta content (canvases, schemas, spec groups, resources) lives inside `.carta/`, keeping the project source tree clean. This is the vault model: `.carta/` contains everything Carta manages, coexisting with the project's own source code.

```
my-project/
├── .carta/                              # Carta vault — all content here
│   ├── workspace.json                   # Workspace metadata: title, description
│   ├── ui-state.json                    # Gitignored: active page, panel sizes, zoom levels
│   ├── .state/                          # Gitignored: binary Y.Doc sidecars for collaboration
│   │   ├── endpoint-map.ystate
│   │   └── service-layers.ystate
│   │
│   ├── 01-product-vision/               # Spec group = directory
│   │   ├── _group.json                  # Group metadata: name, description
│   │   ├── domain-sketch.canvas.json    # Canvas file (JSON)
│   │   └── user-stories.md              # Resource: just a file
│   │
│   ├── 02-api-contract/
│   │   ├── _group.json
│   │   ├── endpoint-map.canvas.json
│   │   ├── prospect-api.ts              # Resource: TypeScript type
│   │   └── openapi-spec.yaml            # Resource: OpenAPI
│   │
│   └── schemas/                         # Shared across all canvases
│       └── schemas.json                 # All schemas, port schemas, groups, relationships
│
├── src/                                 # Project source (untouched by Carta)
│   └── ...
└── .gitignore                           # Ignores .carta/ui-state.json, .carta/.state/
```

### Content file types

**`.canvas.json` files** — JSON representation of a canvas page. Contains nodes (constructs with positions, field values, connections), edges, and organizers in a single `nodes` array (organizers distinguished by `isOrganizer: true`). Human-readable, git-diffable. One canvas per file. This is the Carta-native format, equivalent to a "page" in the current model.

**`schemas/schemas.json`** — All-in-one schema file containing construct schemas, port schemas, schema groups, schema relationships, and schema packages. Shared across all canvases in the workspace. Starting with all-in-one for simplicity; can be split into per-package files later as the format stabilizes.

**`_group.json` files** — Spec group metadata. The directory IS the group; this file provides its name and description. The `_` prefix convention signals metadata, not content.

**Resource files** — Any format: TypeScript, JSON Schema, OpenAPI, DBML, Markdown, freeform text. Carta stores and compiles them but does not parse or validate their content (same principle as ADR 008). The filesystem IS the resource storage — no Carta-specific resource format.

**`workspace.json`** — Workspace manifest. Contains workspace title and description. Does NOT contain file listings — the filesystem is the manifest.

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

Spec groups are directories inside `.carta/` with numbered prefixes (`01-product-vision/`, `02-api-contract/`). Ordering is lexical — the same convention as `.carta/` titles. This means:

- The directory structure IS the spec group hierarchy
- Renaming/reordering is a filesystem operation (rename the directory)
- Nesting is supported naturally (subdirectories)
- `_group.json` provides the human-readable name and description that appears in the navigator and compiler output

Files not inside a spec group directory (e.g., directly in `.carta/`) appear in an "ungrouped" section.

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

Initializing a workspace creates the `.carta/` directory inside the project root:

```
$ npx carta init

Created .carta/workspace.json
Created .carta/schemas/
Updated .gitignore
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
- **Team server**: Hosted on internal infrastructure, wraps a git clone, commits on behalf of web users

### Git integration: the server as git intermediary

The workspace lives in a git repository. Developers interact with it via `git` directly. Non-developers (product managers, domain experts) interact via the web client, and the server performs git operations on their behalf. This follows the **git-backed CMS** pattern established by Decap CMS, TinaCMS, GitBook, and Prose.io: web UI for humans, git commits as persistence, the repository as single source of truth.

#### Layering: Yjs for real-time, git for durable sharing

Yjs and git serve different timescales and audiences:

| Concern | Mechanism |
|---------|-----------|
| Two users editing the same canvas simultaneously | Yjs CRDT over WebSocket |
| Edits persist to disk | Debounced `.canvas.json` writes (workspace-06) |
| External changes (developer edits, `git pull`) reconcile with active rooms | Filesystem watcher (workspace-07) |
| Sharing changes with people not currently connected | Git commit + push |

Users with the web client open never need git to collaborate with each other — they're in the same Yjs room. Git is the boundary between "people with the web client open" and "everyone else working in the repo."

#### Publish model

**Explicit publish** is the primary mechanism. The user clicks "Publish to repository" in the web client. The server stages files, commits, and pushes.

**Auto-quiesce** is the safety net. When all WebSocket rooms have been idle for N minutes, or the last client disconnects, or the server shuts down, the server auto-commits any uncommitted changes. This prevents data loss if a user closes their laptop without publishing. The auto-commit captures all uncommitted changes (never a partial subset).

| Trigger | Scope | Commit message |
|---------|-------|----------------|
| User clicks "Publish" | User-selected files | User-provided (or default) |
| All rooms idle for N minutes | All uncommitted changes | `Auto-save` |
| Last client disconnects | All uncommitted changes | `Auto-save` |
| Server shutdown | All uncommitted changes | `Auto-save` |

#### Selective staging

When a user publishes, the server shows which files have uncommitted changes, grouped by who touched them:

- **Your changes** — files in rooms the publishing user edited. Pre-selected.
- **Other changes** — files in rooms other users edited. Visible but not selected.

The user can select or deselect any file before committing. This prevents accidentally committing another user's half-finished work. The server tracks `Map<filePath, Set<userId>>` — updated when a Yjs room processes an edit, cleared per-file on commit.

#### Author identity

Each git commit includes `--author` mapping the web client user to a git identity. In the simplest case, the server operator configures a default author. In a team deployment, the server maps authenticated users to git author strings (e.g., `Jane PM <jane@company.com>`).

#### Server git operations

The server wraps these git CLI operations:

| Operation | When | Notes |
|-----------|------|-------|
| `git status` | On client connect, surfaces dirty/clean state to web client | |
| `git add <files>` | On publish (selected files) or auto-quiesce (all dirty files) | |
| `git commit` | After staging | `--author` from user identity mapping |
| `git push` | After commit, to configured remote | Fails gracefully if no remote configured |
| `git pull` | On client connect, periodic, or manual trigger | Filesystem watcher reconciles Yjs rooms after pull modifies files |

**Merge conflicts**: Canvas JSON is machine-written, so conflicts from concurrent git edits are rare. If `git pull` encounters a conflict, the server surfaces it to the user rather than auto-resolving. In practice, "theirs" (accept the developer's version) or "ours" (keep the web client's version) is usually correct — line-level merge of `.canvas.json` is not meaningful.

**No branch management in v1**: The server works on a single branch. Branch-per-user workflows are a future sophistication.

**No remote hosting**: The server is not a git hosting service. The remote is GitHub, GitLab, etc. The server just runs `git push`.

### Deployment modes

| Mode | How it starts | Filesystem | Collaboration | Git |
|------|--------------|-----------|--------------|-----|
| **Local server** | `npx carta serve .` | Standalone server, any browser | WebSocket (LAN or tunneled) | Developer uses git directly |
| **Team server** | Hosted on internal infra or cloud | Server-side filesystem (git clone) | Multi-user WebSocket | Server commits on behalf of web users |
| **Desktop app** | Launch Carta.app | Embedded server, real filesystem | Local | Developer uses git directly |
| **Demo site** | Visit carta.dev | No filesystem, IndexedDB single canvas | None | None |

Only two architectures:
1. **Server-backed** (local CLI, team server, desktop) — full workspace, collaboration, MCP, optional git integration
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
- **`.carta/` as a pattern, not a one-off** — the xx.yy.zz numbering convention becomes a Carta feature. Carta is "`.carta/` with a canvas editor, schema validation, and compilation"
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

## Resolved design decisions

1. **Canvas JSON format**: `.canvas.json` files — one per canvas. Nodes and organizers share a single `nodes` array (organizers identified by `isOrganizer: true`). Same shape as current Y.Doc page data.
2. **Cross-canvas references**: Not supported initially. Each canvas is self-contained. Shared semantics come from shared schemas and resources. Future: `targetCanvas` field on connections with `file:semanticId` pairs.
3. **Schema file granularity**: All-in-one `schemas/schemas.json` to start. Contains schemas, port schemas, schema groups, schema relationships, and schema packages. Can be split into per-package files later.
4. **Content location**: Vault model — all Carta content lives inside `.carta/`. The project source tree stays clean. `.carta/workspace.json` describes the project in `..`.
5. **Compilation scope**: Per-canvas is the unit of compilation. Workspace-level compilation composes per-canvas transforms.

## Open questions

### Resolved: Hot reload strategy

The workspace server watches `.carta/` with `fs.watch({ recursive: true })` and 100ms debounce. Reconciliation uses idle/active room semantics:

- **Room not loaded**: No action — next open loads fresh from disk
- **Room loaded, not dirty**: Re-hydrate Y.Doc from disk (safe, no unsaved edits)
- **Room loaded, dirty**: Ignore external change — user's CRDT state wins, next save overwrites disk

This is "last writer wins" at the room level. Resource files (`.ts`, `.md`) are not reconciled — they're plain files managed by git.
2. **Compiler rename**: "Compilation" overstates what the operation does — it's a transform that strips coordinates and produces context-window-friendly output. Consider renaming to `transform`, `render`, or `present` in a future pass.
