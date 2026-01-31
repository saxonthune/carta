---
title: Connect Constructs
status: draft
---

# Connect Constructs

## Steps (Inline Ports)

1. Hover over a construct to reveal port handles (if portDisplayPolicy is inline)
2. Click and drag from a source port handle
3. Drag to a compatible target port on another construct
4. If validation passes (polarity compatibility, not same construct), the connection is created
5. The edge appears on canvas; connection data is stored on the source construct

## Steps (Collapsed Ports)

1. Click the port icon on a construct with collapsed port display
2. The PortPickerPopover opens showing available ports
3. Select a port, then drag to the target construct's port
4. Connection is created as above

## Validation Feedback

- Invalid connections are blocked — the edge snaps back
- Self-connections are not allowed
- Same-construct connections are not allowed
- Polarity rules: source-source and sink-sink pairs are blocked
- Compatibility rules: plain source+sink require compatibleWith match; relay/intercept/bidirectional bypass this

## Features

- doc03.01.03 (Ports and Connections)
- doc03.01.01 (Canvas)
