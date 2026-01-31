---
title: Ports and Connections
status: active
---

# Ports and Connections

Constructs connect to each other through ports — typed attachment points that determine relationship semantics.

## Port Schemas

Port schemas define port types. Each has:
- Unique ID and label
- **Polarity**: source, sink, bidirectional, relay, or intercept
- **Color**: visual handle color on the canvas
- **compatibleWith**: list of port schema IDs this port can connect to

Built-in port schemas: flow-in (sink), flow-out (source), parent (sink), child (source), symmetric (bidirectional), intercept, relay.

Port schemas are user-editable. New port schemas are created via the Metamap connection modal (doc03.01.05) or the schema creation wizard (doc03.01.06).

## Polarity

Five values governing directional semantics:
- **source**: outgoing connection origin
- **sink**: incoming connection target
- **bidirectional**: either direction
- **relay**: acts as source but bypasses compatibility checks (middleware/proxy pattern)
- **intercept**: acts as sink but bypasses compatibility checks

## Connection Validation

Two-step validation when a user drags a connection:
1. Block same-direction pairs (relay maps to source, intercept maps to sink for this check)
2. If either side is relay, intercept, or bidirectional: skip compatibleWith. Otherwise: require the source port's compatibleWith list to include the target port type (or vice versa)

Self-connections and same-construct connections are always blocked.

## Connection Storage

Connections are stored on the **source construct's** `connections` array. Each entry: `{ portId, targetSemanticId, targetPortId }`. Edges on the canvas are visual representations derived from this data.

## Port Display

Controlled by the schema's `portDisplayPolicy`:
- **inline**: Port handles are always visible on the node edges
- **collapsed**: Ports are hidden. A port icon on the node opens a PortPickerPopover when clicked, revealing available ports for connection

## Edge Bundling

When multiple connections exist between the same two nodes, they are visually bundled into a single edge with a count badge. All individual connections remain in state — bundling is display-only. Edges use smoothstep (curved) routing.

## Port Tooltips

Hovering over a port handle shows a tooltip with the port label. After 800ms, an extended tooltip appears with additional details (port type, polarity, connected targets).
