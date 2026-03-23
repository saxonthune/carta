---
title: Canvas Glossary
status: active
summary: Canvas-specific vocabulary — construct, schema, port, polarity, organizer, LOD
tags: [glossary, canvas, terms]
deps: [doc03.09]
---

# Canvas Glossary

Canvas-specific vocabulary. For workspace/spec vocabulary, see doc01.08.

## Modeling Concepts

**Construct**: A typed node on the canvas representing a software component. Each construct is an instance of a construct schema.

**Construct Schema**: A type definition for constructs. Defines fields, ports, display behavior, color, and compilation rules. Schemas are the M1 layer (types) in the metamodel.

**Field**: A named data slot on a construct schema. Types include string, number, boolean, enum, and date. Field values are the user-entered data on construct instances.

**Display Tier**: The visibility level assigned to a field on a construct schema. Two tiers: `pill` (node title, max 1 field) and `summary` (shown on canvas). Fields without a tier are inspector-only.

**Semantic ID**: A unique identifier for a construct instance, auto-generated as `{type}-{timestamp}{random}`. Used as the primary identifier throughout the system.

**Display Name**: The human-readable title of a construct instance, derived from the field with `displayTier: 'pill'`, falling back to the semantic ID.

**Page**: A separate architectural view within a document. Each page has its own nodes and edges. Schemas are shared across pages.

**LOD Band**: One of two discrete zoom-based rendering modes (`marker`, `normal`) that control node detail level. Marker (zoom < 0.5) shows tinted surface chips. Normal (zoom >= 0.5) shows full card.

**Node Shape**: The visual style of a construct node. Shapes include `default`, `simple`, `circle`, `diamond`, `document`, `stadium`, and `parallelogram`. Defined on the construct schema.

## Ports and Connections

**Port**: A typed attachment point on a construct where connections can be made. Defined by a port schema.

**Port Schema**: A type definition for ports. Defines polarity, compatibility rules, color, and labels. Port schemas are user-editable.

**Polarity**: The directional role of a port. Five values: `source` (outgoing), `sink` (incoming), `bidirectional`, `relay` (acts as source, bypasses compatibility), `intercept` (acts as sink, bypasses compatibility).

**Connection**: A link between two constructs via their ports. Stored on the source construct's `connections` array.

**Edge**: The visual representation of a connection on the canvas. Edges carry no metadata — they are derived from connection data on constructs.

## Organization

**Schema Package**: The unit of schema bundling and library portability. Contains construct schemas, port schemas, and optional schema groups.

**Schema Group**: A visual grouping of construct schemas within a package, used for metamap organization and menu nesting.

**Organizer**: A canvas-level grouping mechanism for visual organization. Never compiled. Constructs inside an organizer are **members**, not children — "parent/child" is reserved for the port system. See doc02.08.

**Layout Strategy**: The arrangement algorithm used by an organizer. Currently only `freeform` is implemented.

**Presentation Model**: A stateless transformation layer that converts domain state into view state. See doc02.08.

## Views

**Map**: The instance view — the primary canvas where users create and connect construct instances.

**Metamap**: The schema view — a canvas for viewing and editing construct schemas and their relationships.

**Full View Window**: A draggable, pinnable window that displays comprehensive node information.
