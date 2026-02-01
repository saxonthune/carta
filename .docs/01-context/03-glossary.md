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

**Level**: A separate architectural view or layer within a document. Each level has its own nodes, edges, and deployables. Schemas are shared across levels.

**LOD Band**: One of three discrete zoom-based rendering modes (pill, compact, normal) that control node detail level. Pill shows title only, compact shows title + minimal fields, normal shows all fields based on display tier. Bands switch at zoom thresholds 0.5 and 1.0.

## Ports and Connections

**Port**: A typed attachment point on a construct where connections can be made. Defined by a port schema and positioned on the node.

**Port Schema**: A type definition for ports. Defines polarity, compatibility rules, color, and labels. Port schemas are user-editable.

**Polarity**: The directional role of a port. Five values: `source` (outgoing), `sink` (incoming), `bidirectional`, `relay` (acts as source, bypasses compatibility), `intercept` (acts as sink, bypasses compatibility).

**Connection**: A link between two constructs via their ports. Stored on the source construct's `connections` array. Contains: portId, targetSemanticId, targetPortId.

**Edge**: The visual representation of a connection on the canvas. Edges carry no metadata — they are derived from connection data on constructs.

## Organization

**Portfolio**: A collection of Carta documents. Represents a user's mental grouping of related projects. Portfolios can be backed by IndexedDB (browser), the filesystem (desktop), or a server API. The app always supports portfolio browsing regardless of deployment configuration. See doc02.05 for deployment details.

**Deployable**: A logical grouping for constructs representing a deployment unit (e.g., API Service, Database Layer, UI Application). Helps AI tools understand which components should be deployed together.

**Schema Group**: A grouping of construct schemas for organizational purposes. Shown in context menus and the schema wizard.

**Virtual Parent**: A container node that visually groups child constructs. Has three collapse states: expanded, no-edges, collapsed (pill).

**Pin**: UI control that keeps expanded or open state persistent. Used in node headers (pin expanded details view) and draggable windows (keep window open when clicking outside).

## Views

**Map**: The instance view — the primary canvas where users create and connect construct instances.

**Metamap**: The schema view — a canvas for viewing and editing construct schemas, their ports, and relationships between types.

## System Concepts

**Document Adapter**: The interface through which all state operations are performed. The Yjs adapter is the current implementation.

**Compilation**: The process of transforming visual canvas state into AI-readable structured output (currently JSON format).

**Feature Flags**: Build-time configuration that controls which capabilities are available in a deployment. Flags include `STORAGE_BACKENDS`, `AI_MODE`, and `COLLABORATION`. These are build settings, not architectural concepts — the underlying app model is always the same. See doc02.05.

**Integration Surface**: A concern that Carta exposes hooks for but does not implement. Authentication, authorization policy, billing, and user management are integration surfaces — consumers (enterprise, SaaS providers) build these on top of Carta's editing platform.

**Preferences Provider**: Abstract interface for storing app preferences (last portfolio, last document, UI settings). Implemented as localStorage in browser, filesystem in desktop app.
