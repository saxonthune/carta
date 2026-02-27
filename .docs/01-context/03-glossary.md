---
title: Glossary
status: active
---

# Glossary

Canonical definitions for domain terms used throughout Carta. Use these terms consistently — don't invent synonyms.

## Modeling Concepts

**Construct**: A typed node on the canvas representing a software component. Each construct is an instance of a construct schema.

**Construct Schema**: A type definition for constructs. Defines fields, ports, display behavior, color, and compilation rules. Schemas are the M1 layer (types) in the metamodel.

**Field**: A named data slot on a construct schema. Types include string, number, boolean, enum, and date. Field values are the user-entered data on construct instances.

**Full View Window**: A draggable, pinnable window that displays comprehensive node information (all fields, identity, connections, compile preview). Opened via the full view icon button in node headers. Features no backdrop darkening and uses island UX patterns.

**Display Tier**: The visibility level assigned to a field on a construct schema. Two tiers: `pill` (node title, max 1 field) and `summary` (shown on canvas). Fields without a tier are inspector-only (not shown on canvas).

**Semantic ID**: A unique identifier for a construct instance, auto-generated as `{type}-{timestamp}{random}`. Used as the primary identifier throughout the system, including in compiled output.

**Display Name**: The human-readable title of a construct instance, derived from the schema's `displayField` value or falling back to the semantic ID.

**Page**: A separate architectural view or layer within a document. Each page has its own nodes and edges. Schemas are shared across pages.

**LOD Band**: One of two discrete zoom-based rendering modes (`marker`, `normal`) that control node detail level. Marker (zoom < 0.5) shows tinted surface chips with accent dot and name. Normal (zoom >= 0.5) shows full card with all controls. See doc02.07 for visual specs.

**Node Shape**: The visual style of a construct node. Shapes include `default` (standard card), `simple` (plain rectangle), `circle`, `diamond`, `document`, `stadium` (capsule/pill with fully rounded ends), and `parallelogram` (skewed quadrilateral for I/O). Defined on the construct schema via the `nodeShape` field.

## Ports and Connections

**Port**: A typed attachment point on a construct where connections can be made. Defined by a port schema. Ports are accessed through the port drawer at the bottom of nodes.

**Port Drawer**: A collapsible UI element at the bottom of construct nodes. Collapsed state shows small colored dots; expanded (on hover) shows port circles with labels. Drag from a port circle to initiate connections.

**Port Schema**: A type definition for ports. Defines polarity, compatibility rules, color, and labels. Port schemas are user-editable.

**Polarity**: The directional role of a port. Five values: `source` (outgoing), `sink` (incoming), `bidirectional`, `relay` (acts as source, bypasses compatibility), `intercept` (acts as sink, bypasses compatibility).

**Connection**: A link between two constructs via their ports. Stored on the source construct's `connections` array. Contains: portId, targetSemanticId, targetPortId.

**Edge**: The visual representation of a connection on the canvas. Edges carry no metadata — they are derived from connection data on constructs.

**Drop Zone**: A horizontal strip that appears on target nodes during connection drag. Ordered by port array index, colored for valid targets, grayed for invalid ones.

## Organization

**Schema Package**: The unit of schema bundling and library portability. A package contains construct schemas, in-package port schemas, and optional schema groups for visual organization. Packages are what get published to and applied from the schema library. Example: "Backend Stack" package containing Service, Endpoint, Repository, and DataStore schemas with their domain-specific port types.

**Schema Group**: A visual grouping of construct schemas within a package, used for metamap organization and menu nesting. Groups are cosmetic — they affect how schemas are displayed and navigated, not how they are bundled or compiled. A group always belongs to a package via `packageId`.

**Virtual Folder**: A folder path derived from document metadata, not stored as a separate entity. Documents have a `folder` field (e.g., `/projects/webapp`) and the folder hierarchy is derived dynamically by the UI. Folders are created implicitly when documents are saved to them.

**Organizer**: A canvas-level grouping mechanism for visual organization. Organizers let users arrange constructs into collections without affecting the semantic model — they are never compiled. Each organizer uses a `freeform` layout strategy (free positioning within bounds). Organizers can nest only via wagons (a construct's wagon organizer inherits nesting from its parent organizer). Constructs inside an organizer are **members**, not children — "parent/child" is reserved for the port system. See doc02.09.

**Organized Collection**: The set of constructs that belong to a single organizer. The organizer is the container; the collection is its contents.

**Layout Strategy**: The arrangement algorithm used by an organizer. Currently only `freeform` (free positioning within bounds) is implemented. Layout strategies follow a Strategy pattern — each computes member positions and visibility as a pure function.

**Presentation Model**: A stateless transformation layer that converts domain state into view state. Decides node visibility (organizer collapse), positioning (layout strategies), component selection (render style + LOD dispatch), and edge routing (remapping for collapsed organizers). Lives in the Visual Editor Layer but is conceptually distinct from React components. See doc02.09.

**Pin**: UI control that keeps expanded or open state persistent. Used in node headers (pin expanded details view) and draggable windows (keep window open when clicking outside).

## Views

**Map**: The instance view — the primary canvas where users create and connect construct instances.

**Metamap**: The schema view — a canvas for viewing and editing construct schemas, their ports, and relationships between types.

## System Concepts

**Document Adapter**: The interface through which all state operations are performed. The Yjs adapter is the current implementation.

**Document Source**: Where documents are persisted and listed. Three source types: **browser** (IndexedDB), **server** (REST API + WebSocket), **folder** (filesystem). Available sources depend on the platform and deployment configuration. See doc02.05.

**Storage Host**: The operator running a Carta server — an enterprise IT department, a SaaS provider, or the embedded server in the desktop app. Controls persistence, document organization (via metadata), authentication, and AI access. Carta's contract with storage hosts is minimal: "give me documents with optional grouping metadata." See doc02.05.

**Compilation**: The process of transforming visual canvas state into AI-readable structured output (currently JSON format).

**Configuration**: Two build-time environment variables set by the operator: `VITE_SYNC_URL` (server to connect to; absent = single-document browser mode) and `VITE_AI_MODE` (how AI chat gets credentials: `none`, `user-key`, `server-proxy`). Desktop mode is runtime-detected via Electron API. All other behavior (collaboration, document browser, WebSocket sync) is derived from whether a server URL is present. See doc02.05.

**Integration Surface**: A concern that Carta exposes hooks for but does not implement. Authentication, authorization policy, billing, user management, and document organization are integration surfaces — consumers (enterprise, SaaS providers) build these on top of Carta's editing platform.
