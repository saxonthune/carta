---
title: Metamap
status: active
---

# Metamap

The Metamap is a schema-level visual editor — a second canvas view where users design construct types and their relationships rather than instances.

## Schema Graph

Construct schemas appear as nodes. Connections between schema nodes represent port relationships — which types can connect to which. Schema packages appear as top-level container nodes; schema groups appear as nested containers within packages for visual organization.

## Operations

- **View schemas**: All defined construct schemas displayed as a graph
- **Reposition schemas**: Drag to arrange the schema graph
- **Connect schemas**: Drag between schema nodes to open the MetamapConnectionModal, which creates port schemas and adds ports to both schemas
- **Group schemas**: Drag schemas into schema group nodes for organization
- **Auto-layout**: Button to automatically arrange the schema graph
- **Create schema**: Right-click context menu to create a new construct schema (opens wizard, doc03.01.01.06)
- **Create group**: Right-click context menu to create a new schema group
- **Expand/collapse schemas**: Double-click a schema node to toggle between compact (summary) and expanded (full detail) views
- **Edit relationships**: Click an edge to open the EdgeDetailPopover for editing labels or deleting relationships
- **Reparent groups**: Drag schema group nodes into other groups to change hierarchy

## Connection Modal

When connecting two schemas in the Metamap, a modal opens to configure the port relationship:
- Connection label and inverse label
- Port color selection
- Bidirectional option
- Creates port schemas and assigns them to both participating schemas

## Edge Detail Popover

Clicking an edge in the Metamap opens a popover showing:
- Source and target schema names with color indicators
- Port information (from/to port labels)
- Classification tag (structural vs semantic)
- Editable relationship label
- Delete relationship button

## Schema Node Display Modes

Schema nodes support two display modes, toggled by double-clicking:
- **Compact** (default): Shows schema name, type, and field/port counts in a condensed 80px-height card
- **Expanded**: Shows full detail including field list and port list with labels

## Package Visibility

All loaded packages appear in the metamap, including empty packages (packages with 0 schemas). This ensures users can always see what packages are loaded in their document, even when schemas have been lost due to sync issues or export/import round-trips. Empty packages render as containers with no schema nodes inside.

## Relationship to Map

The Map (doc03.01.01.01) shows instances. The Metamap shows types. Changes in the Metamap (adding ports to a schema, creating new schemas) immediately affect what's available in the Map. The two views are toggled via a view switcher on the canvas.
