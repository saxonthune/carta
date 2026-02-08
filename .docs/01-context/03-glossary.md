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

**Full View Window**: A draggable, pinnable window that displays comprehensive node information (all fields, deployable, identity, connections, compile preview). Opened via the full view icon button in node headers. Features no backdrop darkening and uses island UX patterns.

**Display Tier**: The visibility level assigned to a field on a construct schema. Four tiers: `pill` (node title, max 1 field), `minimal` (collapsed/summary view), `details` (expanded details view), `full` (only in full view modal). Controls which fields appear at different levels of detail.

**Semantic ID**: A unique identifier for a construct instance, auto-generated as `{type}-{timestamp}{random}`. Used as the primary identifier throughout the system, including in compiled output.

**Display Name**: The human-readable title of a construct instance, derived from the schema's `displayField` value or falling back to the semantic ID.

**Page**: A separate architectural view or layer within a document. Each page has its own nodes, edges, and deployables. Schemas are shared across pages.

**LOD Band**: One of three discrete zoom-based rendering modes (pill, compact, normal) that control node detail level. Pill shows title only, compact shows title + minimal fields, normal shows all fields based on display tier. Bands switch at zoom thresholds 0.5 and 1.0.

## Ports and Connections

**Port**: A typed attachment point on a construct where connections can be made. Defined by a port schema. Ports are accessed through the port drawer at the bottom of nodes.

**Port Drawer**: A collapsible UI element at the bottom of construct nodes. Collapsed state shows small colored dots; expanded (on hover) shows port circles with labels. Drag from a port circle to initiate connections.

**Port Schema**: A type definition for ports. Defines polarity, compatibility rules, color, and labels. Port schemas are user-editable.

**Polarity**: The directional role of a port. Five values: `source` (outgoing), `sink` (incoming), `bidirectional`, `relay` (acts as source, bypasses compatibility), `intercept` (acts as sink, bypasses compatibility).

**Connection**: A link between two constructs via their ports. Stored on the source construct's `connections` array. Contains: portId, targetSemanticId, targetPortId.

**Edge**: The visual representation of a connection on the canvas. Edges carry no metadata — they are derived from connection data on constructs.

**Drop Zone**: A horizontal strip that appears on target nodes during connection drag. Ordered by port array index, colored for valid targets, grayed for invalid ones.

## Organization

**Deployable**: A logical grouping for constructs representing a deployment unit (e.g., API Service, Database Layer, UI Application). Helps AI tools understand which components should be deployed together.

**Schema Group**: A grouping of construct schemas for organizational purposes. Shown in context menus and the schema wizard.

**Virtual Folder**: A folder path derived from document metadata, not stored as a separate entity. Documents have a `folder` field (e.g., `/projects/webapp`) and the folder hierarchy is derived dynamically by the UI. Folders are created implicitly when documents are saved to them.

**Organizer**: A canvas-level grouping mechanism for visual organization. Organizers let users arrange constructs into collections without affecting the semantic model — they are never compiled. Each organizer has a **layout strategy** (`freeform`, `stack`, `grid`) that determines how its members are arranged. Organizers can nest (a freeform organizer can contain other organizers). Constructs inside an organizer are **members**, not children — "parent/child" is reserved for the port system. See doc02.09.

**Organized Collection**: The set of constructs that belong to a single organizer. The organizer is the container; the collection is its contents.

**Layout Strategy**: The arrangement algorithm used by an organizer. `freeform` (free positioning within bounds), `stack` (one member visible at a time with arrow navigation), `grid` (auto-arranged in a resizable grid). Layout strategies are a Strategy pattern — each computes member positions and visibility as a pure function.

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
